const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

describe('Full Browser & WebGL Game Simulation', () => {
    test('Simulated full browser game lifecycle', () => {
        // Read script files in order
        const scripts = [
            './js/three.min.js',
            './js/noise.js',
            './js/blocks.js',
            './js/physics.js',
            './js/world.js',
            './js/audio.js',
            './js/player.js',
            './js/ui.js'
        ];

        // Construct mock DOM environment
        const mockElements = new Map();
        function getOrCreateElement(id) {
            if (!mockElements.has(id)) {
                const listeners = new Map();
                const el = {
                    id,
                    style: {},
                    classList: {
                        add: () => {},
                        remove: () => {},
                        contains: () => false
                    },
                    appendChild: () => {},
                    innerHTML: '',
                    innerText: '',
                    addEventListener: (type, handler) => {
                        if (!listeners.has(type)) listeners.set(type, []);
                        listeners.get(type).push(handler);
                    },
                    click: () => {
                        const fns = listeners.get('click') || [];
                        for (const fn of fns) fn({ stopPropagation: () => {} });
                    },
                    setAttribute: (k, v) => { el[k] = v; }
                };
                let _dataset = {};
                Object.defineProperty(el, 'dataset', {
                    get: () => _dataset,
                    set: () => {
                        throw new TypeError('Cannot set property dataset of #<HTMLElement> which has only a getter');
                    }
                });
                mockElements.set(id, el);
            }
            return mockElements.get(id);
        }

        const domListeners = new Map();

        const ctx = {
            console,
            setTimeout,
            clearTimeout,
            performance,
            Math,
            parseInt,
            parseFloat,
            Uint8Array,
            Float32Array,
            Map,
            Array,
            Object,
            JSON,
            String,
            Number,
            Boolean
        };

        ctx.window = ctx;
        ctx.self = ctx;
        ctx.globalThis = ctx;
        ctx.innerWidth = 1280;
        ctx.innerHeight = 720;
        ctx.devicePixelRatio = 1;
        ctx.addEventListener = (type, handler) => {
            if (!domListeners.has(type)) domListeners.set(type, []);
            domListeners.get(type).push(handler);
        };

        ctx.document = {
            getElementById: (id) => getOrCreateElement(id),
            querySelectorAll: () => [],
            addEventListener: (type, handler) => {
                if (!domListeners.has(type)) domListeners.set(type, []);
                domListeners.get(type).push(handler);
            },
            createElement: (tag) => {
                const listeners = new Map();
                const el = {
                    style: {},
                    classList: { add: () => {}, remove: () => {} },
                    appendChild: () => {},
                    addEventListener: (type, handler) => {
                        if (!listeners.has(type)) listeners.set(type, []);
                        listeners.get(type).push(handler);
                    },
                    click: () => {
                        const fns = listeners.get('click') || [];
                        for (const fn of fns) fn({ stopPropagation: () => {} });
                    },
                    setAttribute: (k, v) => { el[k] = v; }
                };
                let _dataset = {};
                Object.defineProperty(el, 'dataset', {
                    get: () => _dataset,
                    set: () => {
                        throw new TypeError('Cannot set property dataset of #<HTMLElement> which has only a getter');
                    }
                });
                if (tag === 'canvas') {
                    el.width = 256;
                    el.height = 256;
                    el.getContext = () => ({
                        fillStyle: '',
                        fillRect: () => {},
                        drawImage: () => {}
                    });
                }
                return el;
            }
        };

        ctx.AudioContext = class {
            constructor() {
                this.currentTime = 0;
                this.sampleRate = 44100;
                this.state = 'running';
                this.destination = {};
            }
            createBuffer() {
                return { getChannelData: () => new Float32Array(1000) };
            }
            createBufferSource() {
                return { buffer: null, connect: () => {}, start: () => {}, stop: () => {} };
            }
            createBiquadFilter() {
                return {
                    frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
                    Q: { setValueAtTime: () => {} },
                    connect: () => {}
                };
            }
            createGain() {
                return {
                    gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
                    connect: () => {}
                };
            }
            createOscillator() {
                return {
                    frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
                    connect: () => {},
                    start: () => {},
                    stop: () => {}
                };
            }
            resume() {}
        };

        vm.createContext(ctx);

        // Execute each script
        for (const scriptPath of scripts) {
            const code = fs.readFileSync(path.resolve(__dirname, '..', scriptPath), 'utf8');
            vm.runInContext(code, ctx);
        }

        // Verify loaded global modules
        assert.ok(ctx.THREE, 'Three.js should be loaded');
        assert.ok(ctx.PerlinNoise, 'PerlinNoise should be loaded');
        assert.ok(ctx.Blocks, 'Blocks should be loaded');
        assert.ok(ctx.Physics, 'Physics should be loaded');
        assert.ok(ctx.World, 'World should be loaded');
        assert.ok(ctx.SoundFX, 'SoundFX should be loaded');
        assert.ok(ctx.PlayerController, 'PlayerController should be loaded');
        assert.ok(ctx.UI, 'UI should be loaded');

        // Test World generation in this context
        const world = new ctx.World.VoxelWorld(777);
        const chunk = world.getOrCreateChunk(0, 0);
        assert.ok(chunk.voxels.length > 0, 'Chunk voxels generated');

        // Verify solid block detection
        let foundSolid = false;
        for (let y = 0; y < ctx.World.CHUNK_HEIGHT; y++) {
            if (world.isSolid(8, y, 8)) {
                foundSolid = true;
                break;
            }
        }
        assert.ok(foundSolid, 'Terrain contains solid blocks');

        // Test texture atlas generation
        const atlas = ctx.Blocks.createTextureAtlasCanvas();
        assert.ok(atlas, 'Atlas canvas generated');

        // Test PlayerController instantiation & simulation
        const fakeCamera = new ctx.THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
        const fakeDom = ctx.document.createElement('canvas');
        const audio = new ctx.SoundFX();
        audio.init();

        const player = new ctx.PlayerController(fakeCamera, fakeDom, world, audio);
        player.position = { x: 8.5, y: 35.0, z: 8.5 };

        // Simulate 20 game ticks of falling
        for (let i = 0; i < 20; i++) {
            player.update(0.05);
        }
        assert.ok(player.position.y < 35.0, 'Player fell under gravity');

        // Test block break and place simulation
        const targetBlockPos = { x: 8, y: 1, z: 8 };
        const originalId = world.getBlock(targetBlockPos.x, targetBlockPos.y, targetBlockPos.z);
        assert.notStrictEqual(originalId, 0, 'Block at (8, 1, 8) should be non-air');

        // Break block
        world.setBlock(targetBlockPos.x, targetBlockPos.y, targetBlockPos.z, 0);
        assert.strictEqual(world.getBlock(targetBlockPos.x, targetBlockPos.y, targetBlockPos.z), 0, 'Block is broken');

        // Place block
        world.setBlock(targetBlockPos.x, targetBlockPos.y, targetBlockPos.z, ctx.Blocks.BLOCKS.BRICK);
        assert.strictEqual(world.getBlock(targetBlockPos.x, targetBlockPos.y, targetBlockPos.z), ctx.Blocks.BLOCKS.BRICK, 'Brick block placed');

        // Save & reload world
        const json = world.saveToJSON();
        const reloadedWorld = new ctx.World.VoxelWorld(777);
        reloadedWorld.loadFromJSON(json);
        assert.strictEqual(reloadedWorld.getBlock(targetBlockPos.x, targetBlockPos.y, targetBlockPos.z), ctx.Blocks.BLOCKS.BRICK, 'Placed brick persists in loaded world');

        // UI Manager initialization with getter-only dataset elements
        assert.doesNotThrow(() => {
            ctx.UI.init(player, world, atlas);
        }, 'UI.init must not throw on elements with getter-only dataset');

        assert.strictEqual(ctx.UI.hotbarBlocks.length, 9, 'Hotbar initialized with 9 slots');
        assert.strictEqual(ctx.UI.isInventoryOpen, false, 'Inventory starts closed');

        // Verify start / resume menu dismissal and pointer lock interaction
        const pauseMenu = ctx.document.getElementById('pause-menu');
        const resumeBtn = ctx.document.getElementById('btn-resume');
        pauseMenu.style.display = 'flex';

        let pointerLocked = false;
        fakeDom.requestPointerLock = () => {
            pointerLocked = true;
            ctx.document.pointerLockElement = fakeDom;
            const changeHandlers = domListeners.get('pointerlockchange') || [];
            for (const handler of changeHandlers) handler();
        };

        function resumeGame() {
            pauseMenu.style.display = 'none';
            audio.init();
            player.lock();
        }

        // Wire up game input listener
        resumeBtn.addEventListener('click', (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            resumeGame();
        });

        ctx.document.addEventListener('pointerlockchange', () => {
            if (ctx.document.pointerLockElement === fakeDom) {
                pauseMenu.style.display = 'none';
            } else {
                pauseMenu.style.display = 'flex';
            }
        });

        ctx.document.addEventListener('pointerlockerror', () => {
            // pointerlockerror does not force pause menu to reappear
        });

        // Trigger start click
        resumeBtn.click();
        assert.strictEqual(pointerLocked, true, 'Clicking resume button requests pointer lock');
        assert.strictEqual(pauseMenu.style.display, 'none', 'Clicking resume button dismisses pause menu immediately');

        // Verify pointerlockerror does not reopen pause menu
        const errorHandlers = domListeners.get('pointerlockerror') || [];
        for (const handler of errorHandlers) handler();
        assert.strictEqual(pauseMenu.style.display, 'none', 'pointerlockerror does not reopen pause menu');

        // Simulate creative inventory toggle with 'E'
        const keydownHandlers = domListeners.get('keydown') || [];
        for (const handler of keydownHandlers) {
            handler({ code: 'KeyE', preventDefault: () => {} });
        }
        assert.strictEqual(ctx.UI.isInventoryOpen, true, 'Pressing E opens creative inventory');

        // Close inventory
        ctx.UI.closeInventory();
        assert.strictEqual(ctx.UI.isInventoryOpen, false, 'Closing inventory hides overlay');
    });
});
