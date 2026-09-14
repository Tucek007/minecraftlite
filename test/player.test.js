const { test, describe } = require('node:test');
const assert = require('node:assert');
const PlayerController = require('../js/player.js');

describe('PlayerController tests', () => {
    function createMockSetup() {
        const camera = {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, order: 'YXZ' }
        };
        const domElement = {
            requestPointerLock: () => {}
        };
        const world = {
            isSolid: (x, y, z) => (y <= 0), // ground at y=0 and below
            getBlock: (x, y, z) => (y <= 0 ? 3 : 0),
            isWater: (x, y, z) => false
        };
        const audio = {
            playJump: () => {},
            playStep: () => {},
            playSplash: () => {}
        };
        return { camera, domElement, world, audio };
    }

    test('Player initialization defaults', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        assert.strictEqual(player.width, 0.6);
        assert.strictEqual(player.height, 1.8);
        assert.strictEqual(player.selectedSlot, 0);
        assert.strictEqual(player.isFlying, false);
        assert.strictEqual(player.isSneaking, false);
    });

    test('Hotbar selection via key event simulation', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        player.onKeyDown({ code: 'Digit4' });
        assert.strictEqual(player.selectedSlot, 3, 'Slot 4 should correspond to index 3');

        player.onKeyDown({ code: 'Digit9' });
        assert.strictEqual(player.selectedSlot, 8, 'Slot 9 should correspond to index 8');
    });

    test('Creative fly mode toggling with F key', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        assert.strictEqual(player.isFlying, false);
        player.onKeyDown({ code: 'KeyF' });
        assert.strictEqual(player.isFlying, true);
        player.onKeyDown({ code: 'KeyF' });
        assert.strictEqual(player.isFlying, false);
    });

    test('Gravity pulls player down and player lands on ground', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        player.position = { x: 5.0, y: 10.0, z: 5.0 };
        player.velocity = { x: 0, y: 0, z: 0 };
        player.onGround = false;

        // Run physics steps
        for (let i = 0; i < 60; i++) {
            player.update(0.016);
        }

        assert.strictEqual(player.onGround, true, 'Player should have landed on ground');
        assert.strictEqual(player.position.y, 1.0, 'Player feet should rest at y=1.0 (top of block y=0)');
        assert.strictEqual(player.velocity.y, 0, 'Vertical velocity should be zero after landing');
    });

    test('Water swimming physics: Space swims upward in water', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        // Water pool between y=1 and y=5
        world.isWater = (x, y, z) => (y >= 1 && y <= 5);
        world.isSolid = (x, y, z) => (y === 0);

        const player = new PlayerController(camera, domElement, world, audio);
        player.position = { x: 5.0, y: 2.0, z: 5.0 };
        player.velocity = { x: 0, y: 0, z: 0 };
        player.keys['Space'] = true;

        // Update several frames with space held
        for (let i = 0; i < 10; i++) {
            player.update(0.016);
        }

        assert.ok(player.velocity.y > 0, `Velocity should be positive when swimming up, got ${player.velocity.y}`);
        assert.ok(player.position.y > 2.0, `Player should have moved up in water, got ${player.position.y}`);
    });

    test('Creative flight: ascends with Space without falling under gravity', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        player.position = { x: 5.0, y: 10.0, z: 5.0 };
        player.isFlying = true;
        player.keys['Space'] = true;

        for (let i = 0; i < 15; i++) {
            player.update(0.016);
        }

        assert.ok(player.position.y > 10.0, 'Player should ascend while flying');
        assert.ok(player.velocity.y > 0, 'Player vertical velocity should remain positive');
    });

    test('canPlaceBlockAt prevents placing block inside player body', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        // Player is at (0.5, 1.0, 0.5) with width 0.6 (x: 0.2..0.8, z: 0.2..0.8, y: 1.0..2.8)
        player.position = { x: 0.5, y: 1.0, z: 0.5 };

        // Block at (0, 1, 0) occupies [0, 1]x[1, 2]x[0, 1] -> collides with player!
        assert.strictEqual(player.canPlaceBlockAt(0, 1, 0), false, 'Should not allow placing inside player feet');

        // Block at (0, 2, 0) occupies [0, 1]x[2, 3]x[0, 1] -> collides with player torso!
        assert.strictEqual(player.canPlaceBlockAt(0, 2, 0), false, 'Should not allow placing inside player torso');

        // Block adjacent at (2, 1, 0) does not collide with player
        assert.strictEqual(player.canPlaceBlockAt(2, 1, 0), true, 'Should allow placing at safe distance');
    });

    test('Look direction matches spherical angles', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        // Looking straight ahead (pitch=0, yaw=0 -> -Z direction)
        player.pitch = 0;
        player.yaw = 0;
        let dir = player.getLookDirection();
        assert.ok(Math.abs(dir.x) < 0.001);
        assert.ok(Math.abs(dir.y) < 0.001);
        assert.ok(Math.abs(dir.z - (-1)) < 0.001, 'Default look direction should be along -Z');

        // Looking straight up (pitch = PI/2)
        player.pitch = Math.PI / 2;
        dir = player.getLookDirection();
        assert.ok(Math.abs(dir.y - 1.0) < 0.001, 'Looking straight up should have y = 1');
    });
});
