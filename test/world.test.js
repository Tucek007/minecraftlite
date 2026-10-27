const { test, describe } = require('node:test');
const assert = require('node:assert');
const Blocks = require('../js/blocks.js');
const World = require('../js/world.js');

describe('World and Chunk tests', () => {
    test('Chunk get/set block within bounds', () => {
        const chunk = new World.Chunk(0, 0);
        assert.strictEqual(chunk.getBlock(5, 10, 5), 0, 'Initial block should be AIR (0)');

        chunk.setBlock(5, 10, 5, Blocks.BLOCKS.STONE);
        assert.strictEqual(chunk.getBlock(5, 10, 5), Blocks.BLOCKS.STONE);
        assert.strictEqual(chunk.dirty, true, 'Setting block should mark chunk dirty');
    });

    test('Chunk bounds protection', () => {
        const chunk = new World.Chunk(0, 0);
        assert.strictEqual(chunk.getBlock(-1, 0, 0), 0);
        assert.strictEqual(chunk.getBlock(0, 100, 0), 0);
        assert.strictEqual(chunk.setBlock(-1, 0, 0, 1), false);
        assert.strictEqual(chunk.setBlock(0, World.CHUNK_HEIGHT + 5, 0, 1), false);
    });

    test('VoxelWorld on-demand chunk generation and bounds', () => {
        const world = new World.VoxelWorld(777);

        // Bedrock check at y=0
        const b0 = world.getBlock(0, 0, 0);
        assert.strictEqual(b0, Blocks.BLOCKS.BEDROCK, 'Block at y=0 must be BEDROCK');

        // Negative y returns bedrock
        assert.strictEqual(world.getBlock(0, -5, 0), Blocks.BLOCKS.BEDROCK);

        // Above max height returns AIR
        assert.strictEqual(world.getBlock(0, World.CHUNK_HEIGHT + 1, 0), 0);
    });

    test('VoxelWorld block modifications and serialization', () => {
        const world = new World.VoxelWorld(42);

        // Set arbitrary blocks
        world.setBlock(10, 25, 10, Blocks.BLOCKS.DIAMOND_ORE);
        world.setBlock(10, 26, 10, Blocks.BLOCKS.GOLD_ORE);

        assert.strictEqual(world.getBlock(10, 25, 10), Blocks.BLOCKS.DIAMOND_ORE);
        assert.strictEqual(world.getBlock(10, 26, 10), Blocks.BLOCKS.GOLD_ORE);

        // Serialize
        const json = world.saveToJSON();
        assert.ok(typeof json === 'string');

        // Create new world and deserialize
        const newWorld = new World.VoxelWorld(999);
        newWorld.loadFromJSON(json);

        assert.strictEqual(newWorld.seed, 42, 'Seed should be restored');
        assert.strictEqual(newWorld.getBlock(10, 25, 10), Blocks.BLOCKS.DIAMOND_ORE);
        assert.strictEqual(newWorld.getBlock(10, 26, 10), Blocks.BLOCKS.GOLD_ORE);
    });

    test('Biome distribution returns expected types', () => {
        const world = new World.VoxelWorld(1234);
        const validBiomes = new Set(['plains', 'forest', 'desert', 'mountains']);

        for (let x = -200; x <= 200; x += 50) {
            for (let z = -200; z <= 200; z += 50) {
                const biome = world.getBiome(x, z);
                assert.ok(validBiomes.has(biome), `Biome "${biome}" is valid`);
            }
        }
    });

    test('chunkModifications O(1) map is populated and preserved across saveToJSON / loadFromJSON', () => {
        const world = new World.VoxelWorld(123);
        const chunk = world.getOrCreateChunk(0, 0);

        world.setBlock(5, 20, 7, Blocks.BLOCKS.STONE);
        world.setBlock(10, 30, 12, Blocks.BLOCKS.WOOD);

        assert.ok(world.chunkModifications.has('0,0'), 'chunkModifications should contain key "0,0"');
        const cMap = world.chunkModifications.get('0,0');
        assert.strictEqual(cMap.get(chunk.getIndex(5, 20, 7)), Blocks.BLOCKS.STONE);
        assert.strictEqual(cMap.get(chunk.getIndex(10, 30, 12)), Blocks.BLOCKS.WOOD);

        // Also block in chunk (1, 2)
        world.setBlock(16 + 3, 25, 32 + 4, Blocks.BLOCKS.GOLD_ORE);
        assert.ok(world.chunkModifications.has('1,2'), 'chunkModifications should contain key "1,2"');
        const cMap2 = world.chunkModifications.get('1,2');
        assert.strictEqual(cMap2.get(chunk.getIndex(3, 25, 4)), Blocks.BLOCKS.GOLD_ORE);

        // Save and Load
        const json = world.saveToJSON();
        const restoredWorld = new World.VoxelWorld(999);
        restoredWorld.loadFromJSON(json);

        assert.ok(restoredWorld.chunkModifications.has('0,0'), 'Restored world has "0,0" in chunkModifications');
        assert.ok(restoredWorld.chunkModifications.has('1,2'), 'Restored world has "1,2" in chunkModifications');
        const restoredMap = restoredWorld.chunkModifications.get('0,0');
        assert.strictEqual(restoredMap.get(chunk.getIndex(5, 20, 7)), Blocks.BLOCKS.STONE);
        assert.strictEqual(restoredMap.get(chunk.getIndex(10, 30, 12)), Blocks.BLOCKS.WOOD);
        assert.strictEqual(restoredWorld.chunkModifications.get('1,2').get(chunk.getIndex(3, 25, 4)), Blocks.BLOCKS.GOLD_ORE);

        // Verify terrain generation applies chunkModifications
        const loadedChunk = restoredWorld.getOrCreateChunk(0, 0);
        assert.strictEqual(loadedChunk.hasModifications, true);
        assert.strictEqual(loadedChunk.getBlock(5, 20, 7), Blocks.BLOCKS.STONE);
        assert.strictEqual(loadedChunk.getBlock(10, 30, 12), Blocks.BLOCKS.WOOD);
    });

    test('Diagonal chunk neighbor is marked dirty when setBlock modifies a corner (0, y, 0) or (15, y, 15)', () => {
        const world = new World.VoxelWorld(456);

        // Ensure chunks (-1, -1), (-1, 0), (0, -1), (0, 0) are loaded
        const c00 = world.getOrCreateChunk(0, 0);
        const cNeg1Neg1 = world.getOrCreateChunk(-1, -1);
        const cNeg10 = world.getOrCreateChunk(-1, 0);
        const c0Neg1 = world.getOrCreateChunk(0, -1);

        // Reset dirty flags
        c00.dirty = false;
        cNeg1Neg1.dirty = false;
        cNeg10.dirty = false;
        c0Neg1.dirty = false;

        // Modify corner (0, 20, 0)
        world.setBlock(0, 20, 0, Blocks.BLOCKS.STONE);

        assert.strictEqual(c00.dirty, true, 'Origin chunk should be dirty');
        assert.strictEqual(cNeg10.dirty, true, 'West neighbor (-1, 0) should be dirty');
        assert.strictEqual(c0Neg1.dirty, true, 'North neighbor (0, -1) should be dirty');
        assert.strictEqual(cNeg1Neg1.dirty, true, 'Diagonal neighbor (-1, -1) should be dirty');

        // Test opposite corner (15, y, 15)
        const c11 = world.getOrCreateChunk(1, 1);
        const c10 = world.getOrCreateChunk(1, 0);
        const c01 = world.getOrCreateChunk(0, 1);

        c00.dirty = false;
        c11.dirty = false;
        c10.dirty = false;
        c01.dirty = false;

        world.setBlock(15, 20, 15, Blocks.BLOCKS.STONE);

        assert.strictEqual(c00.dirty, true, 'Origin chunk should be dirty');
        assert.strictEqual(c10.dirty, true, 'East neighbor (1, 0) should be dirty');
        assert.strictEqual(c01.dirty, true, 'South neighbor (0, 1) should be dirty');
        assert.strictEqual(c11.dirty, true, 'Diagonal neighbor (1, 1) should be dirty');

        // Test non-corner edge (0, y, 5) - diagonal should NOT be marked dirty
        c11.dirty = false;
        cNeg1Neg1.dirty = false;
        cNeg10.dirty = false;
        world.setBlock(0, 20, 5, Blocks.BLOCKS.STONE);
        assert.strictEqual(cNeg10.dirty, true, 'West neighbor (-1, 0) should be dirty');
        assert.strictEqual(cNeg1Neg1.dirty, false, 'Diagonal neighbor should NOT be dirty for non-corner edge');
    });

    test('Seamless border dirtying: existing loaded neighbor with mesh is marked dirty when new neighbor is created', () => {
        const world = new World.VoxelWorld(789);
        const c00 = world.getOrCreateChunk(0, 0);
        // Simulate already built mesh
        c00.mesh = { id: 'mock-mesh' };
        c00.dirty = false;

        // Create adjacent chunk (1, 0)
        world.getOrCreateChunk(1, 0);
        assert.strictEqual(c00.dirty, true, 'Existing chunk (0, 0) should be marked dirty when adjacent (1, 0) is created');
    });

    test('isOpaqueForAO and getVertexAO work as expected', () => {
        const world = new World.VoxelWorld(111);

        // getVertexAO table verification
        assert.strictEqual(world.getVertexAO(false, false, false), 3, 'No occlusion -> 3');
        assert.strictEqual(world.getVertexAO(true, false, false), 2, 'One side occlusion -> 2');
        assert.strictEqual(world.getVertexAO(false, true, false), 2, 'One side occlusion -> 2');
        assert.strictEqual(world.getVertexAO(false, false, true), 2, 'One corner occlusion -> 2');
        assert.strictEqual(world.getVertexAO(true, false, true), 1, 'Side + corner occlusion -> 1');
        assert.strictEqual(world.getVertexAO(true, true, false), 0, 'Two sides occlusion -> 0 (corner ignored)');
        assert.strictEqual(world.getVertexAO(true, true, true), 0, 'Two sides + corner occlusion -> 0');

        // isOpaqueForAO bounds checks
        assert.strictEqual(world.isOpaqueForAO(0, -1, 0), false, 'y < 0 returns false');
        assert.strictEqual(world.isOpaqueForAO(0, World.CHUNK_HEIGHT, 0), false, 'y >= CHUNK_HEIGHT returns false');

        // Solid opaque block
        world.setBlock(8, 20, 8, Blocks.BLOCKS.STONE);
        assert.strictEqual(world.isOpaqueForAO(8, 20, 8), true, 'Stone is opaque for AO');

        // Air block
        world.setBlock(8, 50, 8, Blocks.BLOCKS.AIR);
        assert.strictEqual(world.isOpaqueForAO(8, 50, 8), false, 'Air is not opaque for AO');

        // Transparent block (e.g. Glass or Leaves)
        world.setBlock(8, 22, 8, Blocks.BLOCKS.GLASS);
        assert.strictEqual(world.isOpaqueForAO(8, 22, 8), false, 'Glass is transparent, not opaque for AO');

        world.setBlock(8, 23, 8, Blocks.BLOCKS.LEAVES);
        assert.strictEqual(world.isOpaqueForAO(8, 23, 8), false, 'Leaves are transparent, not opaque for AO');

        // Unloaded chunk returns false without creating chunk
        assert.strictEqual(world.isOpaqueForAO(1000, 20, 1000), false, 'Unloaded coordinate returns false');
        assert.strictEqual(world.chunks.has(world.getChunkKey(Math.floor(1000 / World.CHUNK_SIZE_X), Math.floor(1000 / World.CHUNK_SIZE_Z))), false, 'Unloaded chunk should not be created');
    });

    test('buildChunkMesh computes AO vertex colors and Glowstone lighting', () => {
        const world = new World.VoxelWorld(321);
        const chunk = world.getOrCreateChunk(0, 0);

        // Clear voxels in chunk
        chunk.voxels.fill(0);

        // Mock THREE
        const mockAttributes = {};
        const mockGeometry = {
            setAttribute(name, attr) {
                mockAttributes[name] = attr;
            },
            dispose() {}
        };
        const mockTHREE = {
            BufferGeometry: function() { return mockGeometry; },
            Float32BufferAttribute: function(array, itemSize) {
                return { array, itemSize, count: array.length / itemSize };
            },
            MeshLambertMaterial: function() { return { dispose() {} }; },
            Mesh: function(geometry, material) {
                this.geometry = geometry;
                this.material = material;
            }
        };

        // Place a stone block in center
        chunk.setBlock(8, 10, 8, Blocks.BLOCKS.STONE);

        // Build mesh without any surrounding occluders
        world.buildChunkMesh(chunk, mockTHREE, {});
        assert.ok(chunk.mesh, 'Solid mesh should be created');

        // Now place an occluding block adjacent to top face (+Y) corner
        chunk.setBlock(9, 11, 8, Blocks.BLOCKS.STONE); // +X neighbor on plane y=11
        world.buildChunkMesh(chunk, mockTHREE, {});
        const occludedColors = Array.from(mockAttributes['color'].array);
        // occludedColors should contain some darker values (< 1.0) due to AO
        const hasDarkerVertex = occludedColors.some(c => c < 1.0);
        assert.strictEqual(hasDarkerVertex, true, 'AO should darken vertices next to adjacent block');

        // Now test Glowstone self-lighting (ID 21 if defined)
        if (Blocks.BLOCKS.GLOWSTONE) {
            chunk.voxels.fill(0);
            chunk.setBlock(8, 10, 8, Blocks.BLOCKS.GLOWSTONE);
            world.buildChunkMesh(chunk, mockTHREE, {});
            const glowstoneColors = Array.from(mockAttributes['color'].array);
            // All vertices of Glowstone should have brightness 1.0
            const allBright = glowstoneColors.every(c => Math.abs(c - 1.0) < 0.001);
            assert.strictEqual(allBright, true, 'Glowstone emitting block should have full 1.0 vertex brightness');
        }
    });

    test('Biome terrain generation generates cactus in desert and pumpkin in plains/forest', () => {
        let foundCactus = false;
        let foundPumpkin = false;

        const cactusId = Blocks.BLOCKS.CACTUS || 23;
        const pumpkinId = Blocks.BLOCKS.PUMPKIN || 24;

        for (let s = 1; s <= 20; s++) {
            const world = new World.VoxelWorld(s * 100);
            for (let cx = -2; cx <= 2; cx++) {
                for (let cz = -2; cz <= 2; cz++) {
                    const chunk = world.getOrCreateChunk(cx, cz);
                    for (let lx = 0; lx < World.CHUNK_SIZE_X; lx++) {
                        for (let lz = 0; lz < World.CHUNK_SIZE_Z; lz++) {
                            for (let ly = 1; ly < World.CHUNK_HEIGHT; ly++) {
                                const b = chunk.getBlock(lx, ly, lz);
                                if (b === cactusId) foundCactus = true;
                                if (b === pumpkinId) foundPumpkin = true;
                            }
                        }
                    }
                }
            }
            if (foundCactus && foundPumpkin) break;
        }

        assert.strictEqual(foundCactus, true, 'Should find naturally generated Cactus in desert');
        assert.strictEqual(foundPumpkin, true, 'Should find naturally generated Pumpkin in plains/forest');
    });

    test('world.isLava correctly identifies lava blocks including float coordinates', () => {
        const world = new World.VoxelWorld(999);
        const lavaId = Blocks.BLOCKS.LAVA;

        world.setBlock(10, 5, 10, lavaId);
        assert.strictEqual(world.isLava(10, 5, 10), true, 'Direct coordinate should be lava');
        assert.strictEqual(world.isLava(10.2, 5.8, 10.9), true, 'Float coordinate inside block should be lava');

        world.setBlock(10, 6, 10, Blocks.BLOCKS.WATER);
        assert.strictEqual(world.isLava(10, 6, 10), false, 'Water is not lava');

        world.setBlock(10, 7, 10, Blocks.BLOCKS.STONE);
        assert.strictEqual(world.isLava(10, 7, 10), false, 'Stone is not lava');

        assert.strictEqual(world.isLava(10, 50, 10), false, 'Air is not lava');
        assert.strictEqual(world.isLava(10, -5, 10), false, 'Bedrock below world is not lava');
        assert.strictEqual(world.isLava(10, 100, 10), false, 'Above world height is not lava');
    });

    test('Natural terrain generation deterministically generates Birch trees, Gravel, and deep cave Lava', () => {
        const birchWoodId = Blocks.BLOCKS.BIRCH_WOOD;
        const birchLeavesId = Blocks.BLOCKS.BIRCH_LEAVES;
        const gravelId = Blocks.BLOCKS.GRAVEL;
        const lavaId = Blocks.BLOCKS.LAVA;

        let foundBirchWood = false;
        let foundBirchLeaves = false;
        let foundGravel = false;
        let foundLava = false;

        // Verify across seeds and chunks
        for (let s = 1; s <= 30; s++) {
            const seed = s * 73 + 42;
            const world = new World.VoxelWorld(seed);

            for (let cx = -2; cx <= 2; cx++) {
                for (let cz = -2; cz <= 2; cz++) {
                    const chunk = world.getOrCreateChunk(cx, cz);
                    for (let lx = 0; lx < World.CHUNK_SIZE_X; lx++) {
                        for (let lz = 0; lz < World.CHUNK_SIZE_Z; lz++) {
                            for (let ly = 1; ly < World.CHUNK_HEIGHT; ly++) {
                                const b = chunk.getBlock(lx, ly, lz);
                                if (b === birchWoodId) foundBirchWood = true;
                                if (b === birchLeavesId) foundBirchLeaves = true;
                                if (b === gravelId) foundGravel = true;
                                if (b === lavaId) {
                                    foundLava = true;
                                    assert.ok(ly <= 4, `Natural deep cave lava must generate at deep levels (y <= 4), got y=${ly}`);
                                }
                            }
                        }
                    }
                }
            }
            if (foundBirchWood && foundBirchLeaves && foundGravel && foundLava) break;
        }

        assert.strictEqual(foundBirchWood, true, 'Natural generation must produce BIRCH_WOOD logs');
        assert.strictEqual(foundBirchLeaves, true, 'Natural generation must produce BIRCH_LEAVES foliage');
        assert.strictEqual(foundGravel, true, 'Natural generation must produce GRAVEL on shorelines');
        assert.strictEqual(foundLava, true, 'Natural generation must produce LAVA in deep caves (y <= 4)');

        // Determinism check: Two worlds generated with the same seed produce identical chunks
        const seedD = 8844;
        const world1 = new World.VoxelWorld(seedD);
        const world2 = new World.VoxelWorld(seedD);

        for (let cx = -1; cx <= 1; cx++) {
            for (let cz = -1; cz <= 1; cz++) {
                const c1 = world1.getOrCreateChunk(cx, cz);
                const c2 = world2.getOrCreateChunk(cx, cz);
                assert.deepStrictEqual(c1.voxels, c2.voxels, `Chunk (${cx}, ${cz}) must match byte-for-byte in identical seeds`);
            }
        }
    });
});
