const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Mock browser globals for Node test environment
global.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
};
global.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag) => {
        return {
            tagName: tag.toUpperCase(),
            style: {},
            classList: {
                add: () => {},
                remove: () => {},
                toggle: () => {}
            },
            addEventListener: () => {},
            appendChild: () => {},
            getContext: () => ({
                drawImage: () => {},
                fillRect: () => {},
                clearRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {}
            })
        };
    },
    getElementById: () => null
};

const PlayerController = require('../js/player.js');

describe('Mobile Touch Controls & Responsive Engine Tests', () => {
    test('PlayerController.addLookDelta adjusts yaw and clamps pitch', () => {
        const mockCamera = {
            position: { set: () => {}, copy: () => {} },
            rotation: { set: () => {}, order: 'YXZ' }
        };
        const mockDom = {
            requestPointerLock: () => Promise.resolve()
        };
        const mockWorld = {
            isSolid: () => false,
            isWater: () => false,
            isLava: () => false
        };
        const player = new PlayerController(mockCamera, mockDom, mockWorld, null);

        const initialYaw = player.yaw;
        const initialPitch = player.pitch;

        // Swipe right (dx > 0) and down (dy > 0)
        player.addLookDelta(50, 30);
        assert.ok(player.yaw < initialYaw, 'Yaw should decrease on right swipe');
        assert.ok(player.pitch < initialPitch, 'Pitch should decrease on downward swipe');

        // Extreme upward look
        player.addLookDelta(0, -10000);
        const maxPitch = (Math.PI / 2) - 0.01;
        assert.ok(player.pitch <= maxPitch, 'Pitch must be clamped to upper limit');

        // Extreme downward look
        player.addLookDelta(0, 10000);
        assert.ok(player.pitch >= -maxPitch, 'Pitch must be clamped to lower limit');
    });

    test('D-pad directional keys activate player movement physics', () => {
        const mockCamera = {
            position: { set: () => {}, copy: () => {} },
            rotation: { set: () => {}, order: 'YXZ' }
        };
        const mockDom = {};
        const mockWorld = {
            isSolid: () => false,
            isWater: () => false,
            isLava: () => false
        };
        const player = new PlayerController(mockCamera, mockDom, mockWorld, null);
        player.isFlying = true; // Test horizontal velocity without ground friction halt

        // Simulate virtual D-Pad pressing forward (W)
        player.keys['KeyW'] = true;
        player.update(0.05);
        assert.ok(
            Math.abs(player.velocity.z) > 0 || Math.abs(player.velocity.x) > 0,
            'Moving forward with virtual D-Pad sets velocity'
        );

        player.keys['KeyW'] = false;
        player.keys['KeyD'] = true; // Right
        player.update(0.05);
        assert.ok(
            Math.abs(player.velocity.x) > 0 || Math.abs(player.velocity.z) > 0,
            'Virtual D-pad right sets lateral velocity'
        );
    });

    test('index.html contains complete mobile controls overlay structure', () => {
        const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
        assert.ok(html.includes('id="mobile-controls"'), 'Contains #mobile-controls overlay');
        assert.ok(html.includes('id="mobile-top-bar"'), 'Contains top bar for quick actions');
        assert.ok(html.includes('id="mobile-dpad"'), 'Contains #mobile-dpad container');
        assert.ok(html.includes('id="btn-dpad-up"'), 'Contains up D-pad button');
        assert.ok(html.includes('id="btn-dpad-down"'), 'Contains down D-pad button');
        assert.ok(html.includes('id="btn-dpad-left"'), 'Contains left D-pad button');
        assert.ok(html.includes('id="btn-dpad-right"'), 'Contains right D-pad button');
        assert.ok(html.includes('id="btn-dpad-center"'), 'Contains sneak center D-pad button');
        assert.ok(html.includes('id="mobile-actions"'), 'Contains #mobile-actions container');
        assert.ok(html.includes('id="btn-mobile-jump"'), 'Contains jump action button');
        assert.ok(html.includes('id="btn-mobile-break"'), 'Contains break/attack action button');
        assert.ok(html.includes('id="btn-mobile-place"'), 'Contains place/interact action button');
    });

    test('css/style.css defines responsive touch controls rules', () => {
        const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
        assert.ok(css.includes('#mobile-controls'), 'Defines #mobile-controls styling');
        assert.ok(css.includes('body.touch-active #mobile-controls'), 'Defines touch-active visibility');
        assert.ok(css.includes('@media (max-width: 768px)'), 'Defines responsive mobile breakpoint');
        assert.ok(css.includes('.action-btn.jump'), 'Defines jump button styling');
    });
});
