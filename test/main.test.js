const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createMainContext() {
    const elements = new Map();
    const listeners = new Map();

    function listen(target, type, handler) {
        if (!target._listeners.has(type)) target._listeners.set(type, []);
        target._listeners.get(type).push(handler);
    }

    function emit(target, type, event = {}) {
        for (const handler of target._listeners.get(type) || []) handler.call(target, event);
    }

    function makeElement(id = '') {
        const element = {
            id,
            style: {},
            className: '',
            classList: {
                _values: new Set(),
                add(value) { this._values.add(value); },
                remove(value) { this._values.delete(value); },
                contains(value) { return this._values.has(value); }
            },
            children: [],
            innerHTML: '',
            innerText: '',
            title: '',
            _listeners: new Map(),
            appendChild(child) { this.children.push(child); child.parentNode = this; },
            addEventListener(type, handler) { listen(this, type, handler); },
            dispatchEvent(event) { emit(this, event.type, event); },
            click() { emit(this, 'click', { type: 'click', target: this }); }
        };
        return element;
    }

    function getElement(id) {
        if (!elements.has(id)) elements.set(id, makeElement(id));
        return elements.get(id);
    }

    const document = {
        pointerLockElement: null,
        _listeners: listeners,
        getElementById: getElement,
        addEventListener(type, handler) { listen(this, type, handler); },
        dispatchEvent(event) { emit(this, event.type, event); },
        querySelectorAll(selector) {
            if (selector === '.hotbar-slot') {
                return getElement('hotbar').children.filter((child) => child.className === 'hotbar-slot');
            }
            return [];
        },
        createElement(tag) {
            if (tag === 'canvas') {
                return {
                    width: 256,
                    height: 256,
                    style: {},
                    _listeners: new Map(),
                    getContext() {
                        return {
                            imageSmoothingEnabled: false,
                            fillStyle: '',
                            fillRect() {},
                            drawImage() {}
                        };
                    },
                    addEventListener(type, handler) { listen(this, type, handler); }
                };
            }
            return makeElement();
        }
    };

    const storage = new Map();
    const localStorage = {
        getItem(key) { return storage.has(key) ? storage.get(key) : null; },
        setItem(key, value) { storage.set(key, String(value)); },
        removeItem(key) { storage.delete(key); },
        clear() { storage.clear(); }
    };

    let timeoutId = 0;
    const fakeSetTimeout = () => ++timeoutId;
    const fakeClearTimeout = () => {};

    const ctx = {
        console: { ...console, error() {} },
        Math,
        JSON,
        Map,
        Set,
        Array,
        Object,
        String,
        Number,
        Boolean,
        parseInt,
        parseFloat,
        Uint8Array,
        Uint16Array,
        Uint32Array,
        Float32Array,
        Int32Array,
        Date,
        Error,
        performance,
        setTimeout: fakeSetTimeout,
        clearTimeout: fakeClearTimeout,
        document,
        localStorage,
        confirm: () => true,
        requestAnimationFrame: () => 0,
        cancelAnimationFrame: () => {},
        innerWidth: 1280,
        innerHeight: 720,
        devicePixelRatio: 1
    };
    ctx.window = ctx;
    ctx.self = ctx;
    ctx.globalThis = ctx;
    ctx._listeners = new Map();
    ctx.addEventListener = (type, handler) => listen(ctx, type, handler);
    ctx.dispatchEvent = (event) => emit(ctx, event.type, event);

    ctx.AudioContext = class {
        constructor() {
            this.currentTime = 0;
            this.sampleRate = 44100;
            this.state = 'running';
            this.destination = {};
        }
        createBuffer() { return { getChannelData: () => new Float32Array(32) }; }
        createBufferSource() { return { connect() {}, start() {}, stop() {} }; }
        createBiquadFilter() { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { setValueAtTime() {} }, connect() {} }; }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
        createOscillator() { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
        resume() {}
    };

    vm.createContext(ctx);
    const scripts = [
        'js/three.min.js',
        'js/noise.js',
        'js/blocks.js',
        'js/physics.js',
        'js/world.js',
        'js/audio.js',
        'js/player.js',
        'js/ui.js',
        'js/world-session.js',
        'js/main.js'
    ];
    for (const script of scripts) {
        vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', script), 'utf8'), ctx, { filename: script });
    }

    class StubRenderer {
        constructor() {
            this.domElement = document.createElement('canvas');
            this.shadowMap = {};
        }
        setSize() {}
        setPixelRatio() {}
        render() {}
    }
    ctx.THREE.WebGLRenderer = StubRenderer;

    return { ctx, elements, document, localStorage };
}

test('main initializes and safely switches worlds through reset and load handlers', () => {
    const { ctx, elements, document, localStorage } = createMainContext();

    localStorage.setItem('minecraftlite_seed', '0');
    ctx.dispatchEvent({ type: 'DOMContentLoaded' });

    const gameContainer = elements.get('game-container');
    assert.ok(gameContainer.children.length > 0, 'DOMContentLoaded should initialize the renderer');
    assert.ok(ctx.UI.world, 'UI should receive the initialized world');
    assert.equal(ctx.UI.world.seed, 0, 'startup should preserve the valid seed zero');
    assert.equal(ctx.UI.player.world, ctx.UI.world, 'player should reference the initialized world');
    assert.ok(ctx.UI.world.chunks.size <= 81, 'initial chunk loading should stay within the render radius');

    const initialWorld = ctx.UI.world;
    const initialPlayer = ctx.UI.player;
    const spawn = initialPlayer.position;
    assert.ok(Number.isFinite(spawn.x) && Number.isFinite(spawn.y) && Number.isFinite(spawn.z), 'spawn coordinates should be finite');
    assert.equal(initialWorld.getBlock(Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(spawn.z)), 0, 'spawn space should be clear');
    assert.notEqual(initialWorld.getBlock(Math.floor(spawn.x), Math.floor(spawn.y - 1), Math.floor(spawn.z)), 0, 'spawn should be above solid terrain');

    localStorage.setItem('minecraftlite_world', '{bad json');
    elements.get('btn-load').click();
    assert.equal(ctx.UI.world, initialWorld, 'invalid saved JSON should preserve the current world');
    assert.equal(ctx.UI.player.world, initialWorld, 'invalid saved JSON should preserve the player world reference');

    elements.get('btn-reset').click();
    const resetWorld = ctx.UI.world;
    assert.notEqual(resetWorld, initialWorld, 'reset should create a new world');
    assert.equal(ctx.UI.player.world, resetWorld, 'reset should reconnect player.world');
    assert.equal(ctx.UI.world, resetWorld, 'reset should reconnect UI.world');
    assert.equal(resetWorld.getBlock(Math.floor(ctx.UI.player.position.x), Math.floor(ctx.UI.player.position.y), Math.floor(ctx.UI.player.position.z)), 0, 'reset spawn space should be clear');

    localStorage.setItem('minecraftlite_world', resetWorld.saveToJSON());
    elements.get('btn-load').click();
    assert.notEqual(ctx.UI.world, resetWorld, 'load should replace the world instance');
    assert.equal(ctx.UI.player.world, ctx.UI.world, 'load should reconnect player.world to the loaded world');
    assert.ok(Number.isFinite(ctx.UI.player.position.y), 'loaded world should retain a safe finite spawn');
});
