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
        assert.strictEqual(player.baseFov, 75);
        assert.strictEqual(player.currentFov, 75);
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

    test('Dynamic FOV increases when sprinting or flying', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        let matrixUpdated = 0;
        camera.updateProjectionMatrix = () => { matrixUpdated++; };
        camera.fov = 75;

        const player = new PlayerController(camera, domElement, world, audio);
        assert.strictEqual(player.baseFov, 75);
        assert.strictEqual(player.currentFov, 75);

        // Update when standing still
        player.update(0.016);
        assert.strictEqual(player.currentFov, 75, 'FOV remains base when idle');

        // Flying mode: target FOV is 75 + 6 = 81
        player.isFlying = true;
        for (let i = 0; i < 20; i++) {
            player.update(0.05);
        }
        assert.ok(player.currentFov > 79.5 && player.currentFov <= 81, `FOV should increase toward 81 when flying, got ${player.currentFov}`);
        assert.ok(camera.fov > 79.5, `Camera FOV should be updated, got ${camera.fov}`);
        assert.ok(matrixUpdated > 0, 'Camera projection matrix should be updated');

        // Sprinting mode with horizontal speed: target FOV is 75 + 8 = 83
        player.isFlying = false;
        player.keys['ControlLeft'] = true;
        player.keys['KeyW'] = true;
        for (let i = 0; i < 25; i++) {
            player.update(0.05);
        }
        assert.ok(player.currentFov > 81.5 && player.currentFov <= 83, `FOV should increase toward 83 when sprinting, got ${player.currentFov}`);
    });

    test('pickBlock selects existing hotbar slot or sets new block', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        // Mock UI
        const mockUI = {
            hotbarBlocks: [1, 2, 3, 4, 7, 5, 8, 10, 15],
            activeSlot: 0,
            setSlotCalled: null,
            updateActiveSlot: function(slot) { this.activeSlot = slot; },
            setHotbarBlock: function(slot, id) { this.setSlotCalled = { slot, id }; this.hotbarBlocks[slot] = id; }
        };
        global.UI = mockUI;

        // No target block
        player.targetBlock = null;
        assert.strictEqual(player.pickBlock(), false);

        // Target hit is false
        player.targetBlock = { hit: false };
        assert.strictEqual(player.pickBlock(), false);

        // Target is Air (0)
        world.getBlock = () => 0;
        player.targetBlock = { hit: true, blockPos: { x: 1, y: 1, z: 1 } };
        assert.strictEqual(player.pickBlock(), false);

        // Target is Water (11)
        world.getBlock = () => 11;
        assert.strictEqual(player.pickBlock(), false);

        // Target is Bedrock (14)
        world.getBlock = () => 14;
        assert.strictEqual(player.pickBlock(), false);

        // Target is Stone (ID 3, which is at slot index 2 in mockUI.hotbarBlocks)
        world.getBlock = () => 3;
        player.selectedSlot = 0;
        const res1 = player.pickBlock();
        assert.strictEqual(res1, true);
        assert.strictEqual(player.selectedSlot, 2, 'Should switch active slot to 2 for Stone');
        assert.strictEqual(mockUI.activeSlot, 2);

        // Target is Obsidian (ID 17, not in hotbarBlocks)
        world.getBlock = () => 17;
        player.selectedSlot = 1;
        const res2 = player.pickBlock();
        assert.strictEqual(res2, true);
        assert.deepStrictEqual(mockUI.setSlotCalled, { slot: 1, id: 17 }, 'Should set Obsidian in current slot 1');

        delete global.UI;
    });

    test('Cactus contact damage inflicts 1 damage with cooldown', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        // Cactus at (1, 1, 1)
        world.getBlock = (x, y, z) => (x === 1 && y === 1 && z === 1 ? 23 : 0);
        world.isSolid = (x, y, z) => (y === 0);

        const player = new PlayerController(camera, domElement, world, audio);
        // Player standing at (0.9, 1.0, 1.0) - body overlaps / touches cactus at x=1
        player.position = { x: 0.9, y: 1.0, z: 1.0 };
        player.health = 20;
        player.contactDamageCooldown = 0;
        player.onGround = true;

        player.update(0.016);
        assert.strictEqual(player.health, 19, 'Player should take 1 contact damage');
        assert.ok(player.contactDamageCooldown > 0.5, 'Cooldown should be set to ~0.6s');

        // Immediate next update should not deal damage due to cooldown
        player.update(0.016);
        assert.strictEqual(player.health, 19, 'Player should not take damage during cooldown');
    });

    test('Switchable game modes (setGameMode, cycleGameMode, KeyG event)', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        assert.strictEqual(player.gameMode, 'survival', 'Default mode should be survival');

        // setGameMode('peaceful')
        player.health = 10;
        player.oxygen = 5;
        player.setGameMode('peaceful');
        assert.strictEqual(player.gameMode, 'peaceful');
        assert.strictEqual(player.health, player.maxHealth, 'Peaceful mode restores health to max');
        assert.strictEqual(player.oxygen, player.maxOxygen, 'Peaceful mode restores oxygen to max');

        // setGameMode('creative')
        player.setGameMode('creative');
        assert.strictEqual(player.gameMode, 'creative');
        assert.strictEqual(player.isFlying, true, 'Creative mode enables flying automatically');
        assert.strictEqual(player.velocity.y, 0);

        // setGameMode('survival')
        player.setGameMode('survival');
        assert.strictEqual(player.gameMode, 'survival');
        assert.strictEqual(player.isFlying, false, 'Switching back to survival turns off flying');

        // Invalid mode is ignored
        player.setGameMode('hardcore');
        assert.strictEqual(player.gameMode, 'survival', 'Invalid mode should be ignored');

        // cycleGameMode: survival -> peaceful -> creative -> survival
        player.cycleGameMode();
        assert.strictEqual(player.gameMode, 'peaceful');
        player.cycleGameMode();
        assert.strictEqual(player.gameMode, 'creative');
        player.cycleGameMode();
        assert.strictEqual(player.gameMode, 'survival');

        // KeyG event triggers cycleGameMode
        player.onKeyDown({ code: 'KeyG' });
        assert.strictEqual(player.gameMode, 'peaceful', 'KeyG key event should cycle game mode');
    });

    test('Double-tap Space toggles flight mode', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        assert.strictEqual(player.isFlying, false);

        const now = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();

        // First Space press sets lastSpacePressTime
        player.lastSpacePressTime = now - 150; // simulated previous press 150ms ago (within 20..320ms window)
        player.onKeyDown({ code: 'Space', repeat: false });

        assert.strictEqual(player.isFlying, true, 'Double tap space within 320ms should toggle flight on');
        assert.strictEqual(player.velocity.y, 0);

        // Another double tap Space toggles flight off
        player.lastSpacePressTime = ((typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now()) - 150;
        player.onKeyDown({ code: 'Space', repeat: false });
        assert.strictEqual(player.isFlying, false, 'Double tap space within 320ms should toggle flight off');
    });

    test('Third-person Camera mode (F5 cycles cameraMode 0 -> 1 -> 2 -> 0 and offsets camera position)', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        assert.strictEqual(player.cameraMode, 0, 'Initial camera mode should be 0 (1st person)');

        // Press F5: 0 -> 1 (3rd person back)
        player.onKeyDown({ code: 'F5', preventDefault: () => {} });
        assert.strictEqual(player.cameraMode, 1);

        // Press F5: 1 -> 2 (3rd person front)
        player.onKeyDown({ code: 'F5', preventDefault: () => {} });
        assert.strictEqual(player.cameraMode, 2);

        // Press F5: 2 -> 0 (1st person)
        player.onKeyDown({ code: 'F5', preventDefault: () => {} });
        assert.strictEqual(player.cameraMode, 0);

        // Update in 1st person mode sets camera position directly to eye position
        player.position = { x: 10, y: 5, z: 10 };
        player.pitch = 0;
        player.yaw = 0;
        player.update(0.016);
        assert.strictEqual(camera.position.x, 10);
        assert.strictEqual(camera.position.z, 10);

        // Switch to 3rd person back (cameraMode = 1)
        player.cameraMode = 1;
        player.update(0.016);
        // In 3rd person back, camera is offset along -lookDir. With yaw=0, pitch=0, lookDir is (0, 0, -1).
        // Camera offset dirSign = -1, dist = 3.6 -> camera.position.z = eyeZ + (-1) * (-1) * 3.6 = eyeZ + 3.6
        assert.ok(Math.abs(camera.position.z - (10 + 3.6)) < 0.1, `Camera in 3rd person back should be behind eye, got z=${camera.position.z}`);
        assert.ok(camera.position.z > player.position.z, 'Camera position should be offset behind player');
    });

    test('Underwater Oxygen depletion, drowning damage in survival, immunity in peaceful/creative, and replenishment', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);

        // Position head in water
        world.isWater = (x, y, z) => true; // whole world is water
        player.position = { x: 5, y: 5, z: 5 };
        player.gameMode = 'survival';
        player.oxygen = 15.0;
        player.health = 20;

        // In survival, submerged head depletes oxygen
        for (let i = 0; i < 20; i++) {
            player.update(0.1);
        }
        assert.ok(player.oxygen < 14.0, `Oxygen should deplete underwater, got ${player.oxygen}`);

        // Deplete oxygen completely
        player.oxygen = 0;
        player.drownTimer = 0.95;
        player.update(0.1); // drownTimer becomes >= 1.0 -> deal 2 drowning damage
        assert.strictEqual(player.health, 18, 'Player should take 2 drowning damage when out of oxygen in survival');

        // In peaceful mode, no drowning damage even when oxygen is 0
        player.gameMode = 'peaceful';
        player.health = 20;
        player.oxygen = 0;
        player.drownTimer = 0.95;
        player.update(0.1);
        assert.strictEqual(player.health, 20, 'Player in peaceful mode must NOT take drowning damage');

        // In creative mode, oxygen does not deplete underwater
        player.gameMode = 'creative';
        player.oxygen = 15.0;
        for (let i = 0; i < 10; i++) {
            player.update(0.1);
        }
        assert.strictEqual(player.oxygen, 15.0, 'Player in creative mode should not lose oxygen');

        // Oxygen replenishes when above water
        player.gameMode = 'survival';
        world.isWater = (x, y, z) => false; // out of water
        player.oxygen = 5.0;
        player.update(0.1);
        assert.ok(player.oxygen > 5.0, `Oxygen should replenish above water, got ${player.oxygen}`);
        for (let i = 0; i < 30; i++) {
            player.update(0.1);
        }
        assert.strictEqual(player.oxygen, player.maxOxygen, 'Oxygen should fully replenish to maxOxygen');
    });

    test('Natural health regeneration in survival and peaceful modes', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        const player = new PlayerController(camera, domElement, world, audio);
        player.position = { x: 5.0, y: 1.0, z: 5.0 };
        player.onGround = true;

        // Survival mode regeneration: starts after 4.0s of taking no damage, regens 1 HP every 2.5s
        player.gameMode = 'survival';
        player.health = 15;
        player.timeSinceLastDamage = 0;
        player.regenTimer = 0;

        // Advance 3.5s (before 4.0s delay requirement)
        for (let i = 0; i < 35; i++) {
            player.update(0.1);
        }
        assert.strictEqual(player.health, 15, 'Health should not regenerate before 4.0s delay in survival');

        // Advance past 4.0s delay + 2.5s interval (= 6.5s total)
        for (let i = 0; i < 35; i++) { // additional 3.5s -> total 7.0s
            player.update(0.1);
        }
        assert.strictEqual(player.health, 16, 'Health should regenerate by 1 HP in survival mode');

        // Peaceful mode regeneration: starts after 1.5s, regens 1 HP every 1.0s
        player.gameMode = 'peaceful';
        player.health = 15;
        player.timeSinceLastDamage = 0;
        player.regenTimer = 0;

        // Advance 1.4s (before 1.5s delay)
        for (let i = 0; i < 14; i++) {
            player.update(0.1);
        }
        assert.strictEqual(player.health, 15, 'Health should not regenerate before 1.5s delay in peaceful');

        // Advance 1.5s delay + 1.0s interval (= 2.5s total -> 12 more 0.1s steps)
        for (let i = 0; i < 12; i++) {
            player.update(0.1);
        }
        assert.strictEqual(player.health, 16, 'Health should regenerate by 1 HP faster in peaceful mode');
    });

    test('Lava contact damage inflicts 3 HP damage with cooldown', () => {
        const { camera, domElement, world, audio } = createMockSetup();
        // Lava at (1, 1, 1)
        world.getBlock = (x, y, z) => (x === 1 && y === 1 && z === 1 ? 30 : 0);
        world.isSolid = (x, y, z) => (y === 0);

        const player = new PlayerController(camera, domElement, world, audio);
        player.position = { x: 0.9, y: 1.0, z: 1.0 }; // touching lava block at x=1
        player.health = 20;
        player.contactDamageCooldown = 0;
        player.onGround = true;

        player.update(0.016);
        assert.strictEqual(player.health, 17, 'Player should take 3 contact damage from Lava');
        assert.ok(player.contactDamageCooldown > 0.5, 'Cooldown should be set to ~0.6s');

        // Cooldown prevents immediate re-damage
        player.update(0.016);
        assert.strictEqual(player.health, 17, 'Player should not take damage during cooldown');
    });
});
