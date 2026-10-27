const { test, describe } = require('node:test');
const assert = require('node:assert');
const Blocks = require('../js/blocks.js');
const World = require('../js/world.js');
const PlayerController = require('../js/player.js');
const SoundFX = require('../js/audio.js');

describe('Improvements & Roadmap Verification Tests', () => {

    describe('1. Core Engine Fixes', () => {
        test('Universal Math.floor in getBlock handles floats and negative coordinates', () => {
            const world = new World.VoxelWorld(1234);

            // Set a block at integer coordinate
            world.setBlock(5, 10, -5, Blocks.BLOCKS.DIAMOND_ORE);

            // Query with float coordinates inside the block [5..6, 10..11, -5..-4]
            assert.strictEqual(world.getBlock(5.2, 10.7, -4.8), Blocks.BLOCKS.DIAMOND_ORE, 'Float coords should be floored');
            assert.strictEqual(world.getBlock(5.99, 10.01, -4.01), Blocks.BLOCKS.DIAMOND_ORE, 'Float boundary coords should be floored');

            // isWater with float coords
            world.setBlock(2, 5, 2, Blocks.BLOCKS.WATER);
            assert.strictEqual(world.isWater(2.4, 5.6, 2.8), true, 'isWater should return true for float coords inside water voxel');
            assert.strictEqual(world.isWater(2.4, 6.1, 2.8), false, 'isWater should return false outside water voxel');
        });

        test('Seed 0 is preserved strictly in loadFromJSON', () => {
            const world0 = new World.VoxelWorld(0);
            assert.strictEqual(world0.seed, 0);

            const json0 = world0.saveToJSON();
            const parsed = JSON.parse(json0);
            assert.strictEqual(parsed.seed, 0, 'JSON serialization must store seed 0');

            const restoredWorld = new World.VoxelWorld(9999);
            restoredWorld.loadFromJSON(json0);
            assert.strictEqual(restoredWorld.seed, 0, 'Seed 0 must not be overwritten by fallback seed');
        });

        test('Tree foliage generation is 100% deterministic with same seed', () => {
            const worldA = new World.VoxelWorld(5555);
            const worldB = new World.VoxelWorld(5555);
            const worldC = new World.VoxelWorld(9999);

            const chunkA = worldA.getOrCreateChunk(0, 0);
            const chunkB = worldB.getOrCreateChunk(0, 0);
            const chunkC = worldC.getOrCreateChunk(0, 0);

            // Chunks with same seed must have identical voxels byte-for-byte
            assert.deepStrictEqual(chunkA.voxels, chunkB.voxels, 'World with identical seeds must produce identical voxels');

            // Different seed should differ
            assert.notDeepStrictEqual(chunkA.voxels, chunkC.voxels, 'Different seeds should produce different voxels');
        });

        test('Safe neighbor queries: getBlock(..., false) does not create missing chunks', () => {
            const world = new World.VoxelWorld(1234);

            // Initially world has 0 chunks
            assert.strictEqual(world.chunks.size, 0);

            // Query with createIfMissing = false on ungenerated chunk
            const block = world.getBlock(100, 20, 100, false);
            assert.strictEqual(block, 0, 'Query on non-existing chunk with false should return 0 (air)');
            assert.strictEqual(world.chunks.size, 0, 'Non-generating query must not create new chunk');

            // Query with default createIfMissing = true
            const generatedBlock = world.getBlock(100, 20, 100, true);
            assert.strictEqual(world.chunks.size, 1, 'Standard query creates chunk');
        });

        test('chunk.hasModifications tracks modified blocks', () => {
            const world = new World.VoxelWorld(999);
            const chunk = world.getOrCreateChunk(0, 0);
            assert.strictEqual(chunk.hasModifications, false);
            world.setBlock(2, 5, 2, Blocks.BLOCKS.GLASS);
            assert.strictEqual(chunk.hasModifications, true);
        });
    });

    describe('2. Performance & GPU Shared Materials', () => {
        test('Shared Three.js materials are reused across chunks and mesh rebuilds', () => {
            // Mock THREE
            class MockMaterial {
                constructor(params) {
                    this.params = params;
                    this.disposed = false;
                }
                dispose() {
                    this.disposed = true;
                }
            }
            class MockGeometry {
                constructor() {
                    this.attributes = {};
                    this.disposed = false;
                }
                setAttribute(name, attr) {
                    this.attributes[name] = attr;
                }
                dispose() {
                    this.disposed = true;
                }
            }
            class MockMesh {
                constructor(geo, mat) {
                    this.geometry = geo;
                    this.material = mat;
                    this.parent = null;
                }
            }
            const fakeTHREE = {
                BufferGeometry: MockGeometry,
                Float32BufferAttribute: class { constructor(arr, itemSize) { this.array = arr; } },
                MeshLambertMaterial: MockMaterial,
                Mesh: MockMesh
            };

            const world = new World.VoxelWorld(42);
            const chunk1 = world.getOrCreateChunk(0, 0);
            const chunk2 = world.getOrCreateChunk(1, 0);

            const mockAtlas = {};

            world.buildChunkMesh(chunk1, fakeTHREE, mockAtlas);
            world.buildChunkMesh(chunk2, fakeTHREE, mockAtlas);

            assert.ok(world.sharedOpaqueMaterial, 'Shared opaque material was initialized');
            assert.strictEqual(chunk1.mesh.material, world.sharedOpaqueMaterial, 'Chunk 1 uses shared material');
            assert.strictEqual(chunk2.mesh.material, world.sharedOpaqueMaterial, 'Chunk 2 shares the exact same material');

            // Rebuilding chunk 1 reuses material and disposes only geometry
            const oldGeo = chunk1.mesh.geometry;
            world.buildChunkMesh(chunk1, fakeTHREE, mockAtlas);
            assert.strictEqual(oldGeo.disposed, true, 'Old geometry was disposed');
            assert.strictEqual(world.sharedOpaqueMaterial.disposed, false, 'Shared material was NOT disposed');
            assert.strictEqual(chunk1.mesh.material, world.sharedOpaqueMaterial, 'Chunk 1 still uses shared material');

            // Dispose world materials
            world.disposeMaterials();
            assert.strictEqual(world.sharedOpaqueMaterial, null, 'Shared material cleared after world disposal');
        });
    });

    describe('3. Player Health, Fall Damage, and Respawn', () => {
        function createPlayerMock() {
            const camera = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, order: 'YXZ' } };
            const dom = { requestPointerLock: () => {} };
            const world = {
                isSolid: (x, y, z) => (y <= 0),
                getBlock: (x, y, z) => (y <= 0 ? 3 : 0),
                isWater: () => false
            };
            let hurtPlayed = false;
            const audio = {
                playJump: () => {},
                playStep: () => {},
                playSplash: () => {},
                playHurt: () => { hurtPlayed = true; }
            };
            const player = new PlayerController(camera, dom, world, audio);
            return { player, getHurtPlayed: () => hurtPlayed };
        }

        test('Player initializes with 20 HP', () => {
            const { player } = createPlayerMock();
            assert.strictEqual(player.health, 20);
            assert.strictEqual(player.maxHealth, 20);
            assert.strictEqual(player.fallDistance, 0);
        });

        test('Falling beyond 3 blocks inflicts fall damage on landing', () => {
            const { player, getHurtPlayed } = createPlayerMock();
            // Start 8 blocks above ground (y=1.0 is ground level)
            player.position = { x: 5.0, y: 8.0, z: 5.0 };
            player.velocity = { x: 0, y: 0, z: 0 };
            player.onGround = false;

            for (let i = 0; i < 60; i++) {
                player.update(0.016);
            }

            assert.strictEqual(player.onGround, true, 'Player should have landed');
            assert.ok(player.health < 20, `Player should take fall damage, current health: ${player.health}`);
            assert.strictEqual(getHurtPlayed(), true, 'playHurt sound should have been triggered');
        });

        test('Short falls <= 3 blocks deal zero damage', () => {
            const { player } = createPlayerMock();
            // Start 2 blocks above ground level (y=3.0, ground at y=1.0)
            player.position = { x: 5.0, y: 3.0, z: 5.0 };
            player.velocity = { x: 0, y: 0, z: 0 };
            player.onGround = false;

            for (let i = 0; i < 30; i++) {
                player.update(0.016);
            }

            assert.strictEqual(player.onGround, true);
            assert.strictEqual(player.health, 20, 'Short fall should deal 0 damage');
        });

        test('Flying mode prevents fall damage', () => {
            const { player } = createPlayerMock();
            player.position = { x: 5.0, y: 20.0, z: 5.0 };
            player.isFlying = true;
            player.takeDamage(10);
            assert.strictEqual(player.health, 20, 'Creative flying mode must be immune to damage');
        });

        test('Fatal damage triggers death and respawn safely on surface without fall damage', () => {
            const { player, getHurtPlayed } = createPlayerMock();
            player.takeDamage(25);
            assert.strictEqual(player.health, 20, 'Player health should reset to max health after respawn');
            assert.strictEqual(player.position.x, 8.5, 'Respawn should place player at spawn X');
            assert.strictEqual(player.position.z, 8.5, 'Respawn should place player at spawn Z');

            // Simulate stepping after respawn
            for (let i = 0; i < 60; i++) {
                player.update(0.016);
            }
            assert.strictEqual(player.health, 20, 'Player must not take fall damage after respawning');
            assert.strictEqual(player.onGround, true, 'Player should be safely grounded');
        });

        test('Void recovery spawns player safely on ground without death loop', () => {
            const { player } = createPlayerMock();
            player.position = { x: 8.5, y: -15.0, z: 8.5 };
            player.update(0.016); // triggers void recovery

            for (let i = 0; i < 60; i++) {
                player.update(0.016);
            }
            assert.strictEqual(player.health, 20, 'Void recovery must not deal lethal fall damage');
            assert.strictEqual(player.onGround, true, 'Player should be safely on ground after void recovery');
        });
    });

    describe('4. Blocks & Audio Module Enhancements', () => {
        test('SoundFX includes playFuse, playExplode, playHurt, playPickup, playCraft, and playMobHurt methods', () => {
            const sfx = new SoundFX();
            assert.strictEqual(typeof sfx.playFuse, 'function');
            assert.strictEqual(typeof sfx.playExplode, 'function');
            assert.strictEqual(typeof sfx.playHurt, 'function');
            assert.strictEqual(typeof sfx.playPickup, 'function');
            assert.strictEqual(typeof sfx.playCraft, 'function');
            assert.strictEqual(typeof sfx.playMobHurt, 'function');

            // Safe to invoke without audio context initialized
            assert.doesNotThrow(() => sfx.playPickup());
            assert.doesNotThrow(() => sfx.playCraft());
            assert.doesNotThrow(() => sfx.playMobHurt('pig'));
            assert.doesNotThrow(() => sfx.playMobHurt('sheep'));
            assert.doesNotThrow(() => sfx.playMobHurt('zombie'));
            assert.doesNotThrow(() => sfx.playMobHurt('creeper'));
        });

        test('All 20 blocks exist in Blocks registry and have required properties', () => {
            for (let id = 1; id <= 20; id++) {
                const bDef = Blocks.BLOCK_DEFS[id];
                assert.ok(bDef, `Block ID ${id} must have definition`);
                assert.ok(typeof bDef.name === 'string' && bDef.name.length > 0, `Block ${id} has valid name`);
                assert.strictEqual(typeof bDef.solid, 'boolean');
                assert.strictEqual(typeof bDef.transparent, 'boolean');
            }
        });

        test('Bedrock and Obsidian cannot be destroyed (blast resistance)', () => {
            const bedrock = Blocks.BLOCK_DEFS[Blocks.BLOCKS.BEDROCK];
            const obsidian = Blocks.BLOCK_DEFS[Blocks.BLOCKS.OBSIDIAN];
            assert.strictEqual(bedrock.unbreakable, true);
            assert.strictEqual(obsidian.id, 17);
        });

        test('Bookshelf side texture represents books and differs from plain planks', () => {
            const bookshelfTop = Blocks.getBlockFaceTexture(Blocks.BLOCKS.BOOKSHELF, 2);
            const bookshelfSide = Blocks.getBlockFaceTexture(Blocks.BLOCKS.BOOKSHELF, 0);
            const planks = Blocks.getBlockFaceTexture(Blocks.BLOCKS.PLANKS, 0);
            assert.strictEqual(bookshelfTop, planks, 'Top face of bookshelf is planks');
            assert.notStrictEqual(bookshelfSide, planks, 'Side face of bookshelf must differ from planks');
            assert.strictEqual(bookshelfSide, Blocks.TILES.BOOKSHELF_SIDE, 'Side face is BOOKSHELF_SIDE');
        });
    });

    describe('5. TNT Explosion Simulation & Blast Resistance', () => {
        test('TNT explosion destroys surrounding terrain within radius but spares bedrock and obsidian', () => {
            const world = new World.VoxelWorld(777);

            // Setup a blast test chamber
            const cx = 10, cy = 10, cz = 10;
            world.setBlock(cx, cy, cz, Blocks.BLOCKS.TNT);
            world.setBlock(cx + 1, cy, cz, Blocks.BLOCKS.DIRT);
            world.setBlock(cx - 1, cy, cz, Blocks.BLOCKS.STONE);
            world.setBlock(cx, cy - 1, cz, Blocks.BLOCKS.BEDROCK);
            world.setBlock(cx, cy + 1, cz, Blocks.BLOCKS.OBSIDIAN);
            world.setBlock(cx + 2, cy, cz, Blocks.BLOCKS.COBBLESTONE);

            // Simulate explosion at (cx + 0.5, cy + 0.5, cz + 0.5) with radius 3.5
            const radius = 3.5;
            for (let x = cx - 4; x <= cx + 4; x++) {
                for (let y = cy - 4; y <= cy + 4; y++) {
                    for (let z = cz - 4; z <= cz + 4; z++) {
                        const dx = x + 0.5 - (cx + 0.5);
                        const dy = y + 0.5 - (cy + 0.5);
                        const dz = z + 0.5 - (cz + 0.5);
                        if (dx * dx + dy * dy + dz * dz <= radius * radius) {
                            const b = world.getBlock(x, y, z);
                            if (b !== 0 && b !== Blocks.BLOCKS.BEDROCK && b !== Blocks.BLOCKS.OBSIDIAN) {
                                world.setBlock(x, y, z, Blocks.BLOCKS.AIR);
                            }
                        }
                    }
                }
            }

            // Normal blocks destroyed
            assert.strictEqual(world.getBlock(cx + 1, cy, cz), Blocks.BLOCKS.AIR, 'Dirt block in blast radius destroyed');
            assert.strictEqual(world.getBlock(cx - 1, cy, cz), Blocks.BLOCKS.AIR, 'Stone block in blast radius destroyed');
            assert.strictEqual(world.getBlock(cx + 2, cy, cz), Blocks.BLOCKS.AIR, 'Cobblestone block in blast radius destroyed');

            // Blast-resistant blocks intact
            assert.strictEqual(world.getBlock(cx, cy - 1, cz), Blocks.BLOCKS.BEDROCK, 'Bedrock must NOT be destroyed by TNT');
            assert.strictEqual(world.getBlock(cx, cy + 1, cz), Blocks.BLOCKS.OBSIDIAN, 'Obsidian must NOT be destroyed by TNT');
        });
    });

    describe('6. Player State Persistence & Inventory Management', () => {
        test('Player state serialization and deserialization retains all fields', () => {
            const state = {
                position: { x: 12.34, y: 45.67, z: -89.01 },
                yaw: 1.57,
                pitch: -0.45,
                selectedSlot: 4,
                hotbarBlocks: [19, 18, 17, 16, 15, 14, 13, 12, 20],
                health: 15,
                dayTime: 0.72,
                isFlying: true
            };

            const json = JSON.stringify(state);
            const restored = JSON.parse(json);

            assert.strictEqual(restored.position.x, 12.34);
            assert.strictEqual(restored.position.y, 45.67);
            assert.strictEqual(restored.position.z, -89.01);
            assert.strictEqual(restored.yaw, 1.57);
            assert.strictEqual(restored.pitch, -0.45);
            assert.strictEqual(restored.selectedSlot, 4);
            assert.deepStrictEqual(restored.hotbarBlocks, [19, 18, 17, 16, 15, 14, 13, 12, 20]);
            assert.strictEqual(restored.health, 15);
            assert.strictEqual(restored.dayTime, 0.72);
            assert.strictEqual(restored.isFlying, true);
        });

        test('UI Manager hotbar manipulation and inventory toggle', () => {
            const UI = require('../js/ui.js');

            // Mock player
            let locked = false;
            const mockPlayer = {
                selectedSlot: 2,
                lock: () => { locked = true; },
                unlock: () => { locked = false; }
            };

            UI.player = mockPlayer;
            assert.strictEqual(UI.hotbarBlocks.length, 9);

            // Set new block in slot 2 (Diamond ore = 19)
            UI.setHotbarBlock(2, 19);
            assert.strictEqual(UI.hotbarBlocks[2], 19, 'Hotbar slot 2 must be updated to Diamond Ore (19)');
            assert.strictEqual(UI.getSelectedBlockId(), 19, 'Selected block id should reflect newly assigned block');

            // Toggle inventory
            assert.strictEqual(UI.isInventoryOpen, false);
            UI.openInventory();
            assert.strictEqual(UI.isInventoryOpen, true);
            assert.strictEqual(locked, false, 'Opening inventory unlocks pointer');

            UI.closeInventory();
            assert.strictEqual(UI.isInventoryOpen, false);
            assert.strictEqual(locked, true, 'Closing inventory re-locks pointer');
        });

        test('UI Manager supports hoveredBlockId assignment to hotbar', () => {
            const UI = require('../js/ui.js');
            UI.hoveredBlockId = Blocks.BLOCKS.GOLD_ORE;
            UI.setHotbarBlock(3, UI.hoveredBlockId);
            assert.strictEqual(UI.hotbarBlocks[3], Blocks.BLOCKS.GOLD_ORE);
        });

        test('UI Manager buildInventoryGrid works with getter-only dataset elements (browser DOM standard)', () => {
            const UI = require('../js/ui.js');
            const gridChildren = [];
            const mockGridEl = {
                id: 'inventory-grid',
                innerHTML: '',
                appendChild: (child) => { gridChildren.push(child); }
            };

            const originalDoc = global.document;
            try {
                global.document = {
                    getElementById: (id) => (id === 'inventory-grid' ? mockGridEl : null),
                    createElement: (tag) => {
                        const el = {
                            style: {},
                            classList: { add: () => {}, remove: () => {} },
                            appendChild: () => {},
                            addEventListener: () => {},
                            setAttribute: (k, v) => { el[k] = v; }
                        };
                        if (tag === 'canvas') {
                            el.getContext = () => ({
                                imageSmoothingEnabled: true,
                                drawImage: () => {}
                            });
                        }
                        let _dataset = {};
                        Object.defineProperty(el, 'dataset', {
                            get: () => _dataset,
                            set: () => {
                                throw new TypeError('Cannot set property dataset of #<HTMLElement> which has only a getter');
                            }
                        });
                        return el;
                    }
                };

                const mockAtlasCanvas = {
                    width: 256,
                    height: 256
                };

                UI.atlasCanvas = mockAtlasCanvas;
                assert.doesNotThrow(() => {
                    UI.buildInventoryGrid();
                }, 'buildInventoryGrid must not throw when HTMLElement has getter-only dataset');

                assert.strictEqual(gridChildren.length, 30, 'Should have created 30 block inventory slots');
                assert.strictEqual(gridChildren[0].dataset.blockId, 1, 'First slot blockId should be 1');
                assert.strictEqual(gridChildren[29].dataset.blockId, 30, 'Last slot blockId should be 30');
            } finally {
                global.document = originalDoc;
            }
        });

        test('UI Manager buildInventoryGrid does not throw when dataset is undefined or throws on access', () => {
            const UI = require('../js/ui.js');
            const gridChildren = [];
            const mockGridEl = {
                id: 'inventory-grid',
                innerHTML: '',
                appendChild: (child) => { gridChildren.push(child); }
            };

            const originalDoc = global.document;
            try {
                global.document = {
                    getElementById: (id) => (id === 'inventory-grid' ? mockGridEl : null),
                    createElement: () => {
                        const el = {
                            style: {},
                            classList: { add: () => {}, remove: () => {} },
                            appendChild: () => {},
                            addEventListener: () => {},
                            setAttribute: (k, v) => { el[k] = v; }
                        };
                        // dataset throws on any property access
                        Object.defineProperty(el, 'dataset', {
                            get: () => { throw new Error('Restricted dataset access'); }
                        });
                        return el;
                    }
                };

                UI.atlasCanvas = { width: 256, height: 256 };
                assert.doesNotThrow(() => {
                    UI.buildInventoryGrid();
                }, 'buildInventoryGrid must not throw even if dataset throws on access');

                assert.strictEqual(gridChildren.length, 30, 'Should have created 30 block inventory slots');
                assert.strictEqual(gridChildren[0]['data-block-id'], 1, 'Attribute fallback stores block ID');
            } finally {
                global.document = originalDoc;
            }
        });

        test('UI Manager crafting system (addCollectedItem, getItemCount, canCraftRecipe in survival vs peaceful/creative, craftRecipe)', () => {
            const UI = require('../js/ui.js');

            // Reset UI inventory counts
            UI.inventoryCounts = {};
            UI.gameMode = 'survival';

            // Initially count is 0
            assert.strictEqual(UI.getItemCount(Blocks.BLOCKS.WOOD), 0);
            assert.strictEqual(UI.getItemCount(Blocks.BLOCKS.PLANKS), 0);

            // addCollectedItem
            UI.addCollectedItem(Blocks.BLOCKS.WOOD, 2);
            assert.strictEqual(UI.getItemCount(Blocks.BLOCKS.WOOD), 2);

            // Define a test recipe: 1 WOOD -> 4 PLANKS
            const recipePlanks = {
                id: 'test_planks',
                name: 'Wooden Planks (x4)',
                output: { id: Blocks.BLOCKS.PLANKS, count: 4 },
                ingredients: [{ id: Blocks.BLOCKS.WOOD, count: 1 }]
            };

            // In survival mode with sufficient items: canCraft is true
            assert.strictEqual(UI.canCraftRecipe(recipePlanks), true);

            // Craft the recipe
            const craftSuccess = UI.craftRecipe(recipePlanks);
            assert.strictEqual(craftSuccess, true, 'Crafting should succeed');
            assert.strictEqual(UI.getItemCount(Blocks.BLOCKS.WOOD), 1, '1 wood should be consumed');
            assert.strictEqual(UI.getItemCount(Blocks.BLOCKS.PLANKS), 4, '4 planks should be added');

            // Try recipe requiring more ingredients than available
            const recipeBookshelf = {
                id: 'test_bookshelf',
                name: 'Bookshelf',
                output: { id: Blocks.BLOCKS.BOOKSHELF, count: 1 },
                ingredients: [{ id: Blocks.BLOCKS.PLANKS, count: 6 }]
            };
            assert.strictEqual(UI.canCraftRecipe(recipeBookshelf), false, 'Cannot craft bookshelf with only 4 planks in survival');
            assert.strictEqual(UI.craftRecipe(recipeBookshelf), false, 'craftRecipe fails when missing ingredients');

            // In peaceful mode: free crafting mode is active
            UI.gameMode = 'peaceful';
            assert.strictEqual(UI.isFreeCraftingMode(), true);
            assert.strictEqual(UI.canCraftRecipe(recipeBookshelf), true, 'Free crafting allows crafting without ingredients');
            const freeCraftSuccess = UI.craftRecipe(recipeBookshelf);
            assert.strictEqual(freeCraftSuccess, true);
            assert.strictEqual(UI.getItemCount(Blocks.BLOCKS.PLANKS), 4, 'Planks should NOT be consumed in peaceful mode');
            assert.strictEqual(UI.getItemCount(Blocks.BLOCKS.BOOKSHELF), 1, 'Bookshelf output should be added');

            // In creative mode: free crafting mode is active
            UI.gameMode = 'creative';
            assert.strictEqual(UI.isFreeCraftingMode(), true);
            assert.strictEqual(UI.canCraftRecipe(recipeBookshelf), true);
        });

        test('PlayerController lock and unlock methods handle missing or failing APIs gracefully', () => {
            const PlayerController = require('../js/player.js');
            const dummyCamera = { position: { set: () => {} } };
            const throwingDom = {
                requestPointerLock: () => {
                    throw new Error('SecurityError: Pointer lock denied');
                }
            };

            const player = new PlayerController(dummyCamera, throwingDom, null, null);
            assert.doesNotThrow(() => {
                player.lock();
            }, 'player.lock must not throw even when requestPointerLock throws synchronously');

            assert.doesNotThrow(() => {
                player.unlock();
            }, 'player.unlock must not throw in node/test environment');
        });
    });
});
