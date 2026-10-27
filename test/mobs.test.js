const { test, describe } = require('node:test');
const assert = require('node:assert');
const Mobs = require('../js/mobs.js');
const Physics = require('../js/physics.js');
const Blocks = require('../js/blocks.js');

describe('Mobs and AI Entity System tests', () => {

    function createMockWorld() {
        return {
            isSolid: (x, y, z) => (y <= 0),
            getBlock: (x, y, z) => (y <= 0 ? 3 : 0),
            isWater: (x, y, z) => false
        };
    }

    test('Mobs.MOB_TYPES definitions (pig, sheep, zombie, creeper)', () => {
        assert.ok(Mobs.MOB_TYPES, 'MOB_TYPES must be defined');

        // Pig definition
        const pig = Mobs.MOB_TYPES.pig;
        assert.ok(pig, 'pig type must exist');
        assert.strictEqual(pig.type, 'pig');
        assert.strictEqual(pig.name, 'Pig');
        assert.strictEqual(pig.hostile, false);
        assert.strictEqual(pig.maxHealth, 10);
        assert.strictEqual(pig.width, 0.7);
        assert.strictEqual(pig.height, 0.9);
        assert.strictEqual(pig.speed, 1.8);
        assert.strictEqual(pig.dropBlockId, Blocks.BLOCKS.DIRT);
        assert.strictEqual(pig.color, 0xf0a5a0);

        // Sheep definition
        const sheep = Mobs.MOB_TYPES.sheep;
        assert.ok(sheep, 'sheep type must exist');
        assert.strictEqual(sheep.type, 'sheep');
        assert.strictEqual(sheep.name, 'Sheep');
        assert.strictEqual(sheep.hostile, false);
        assert.strictEqual(sheep.maxHealth, 10);
        assert.strictEqual(sheep.width, 0.7);
        assert.strictEqual(sheep.height, 1.0);
        assert.strictEqual(sheep.speed, 1.7);
        assert.strictEqual(sheep.dropBlockId, Blocks.BLOCKS.SNOW);
        assert.strictEqual(sheep.color, 0xeeeeee);

        // Zombie definition
        const zombie = Mobs.MOB_TYPES.zombie;
        assert.ok(zombie, 'zombie type must exist');
        assert.strictEqual(zombie.type, 'zombie');
        assert.strictEqual(zombie.name, 'Zombie');
        assert.strictEqual(zombie.hostile, true);
        assert.strictEqual(zombie.maxHealth, 20);
        assert.strictEqual(zombie.width, 0.6);
        assert.strictEqual(zombie.height, 1.8);
        assert.strictEqual(zombie.speed, 2.6);
        assert.strictEqual(zombie.attackDamage, 2);
        assert.strictEqual(zombie.dropBlockId, Blocks.BLOCKS.MOSSY_COBBLESTONE);
        assert.strictEqual(zombie.color, 0x4b7f42);

        // Creeper definition
        const creeper = Mobs.MOB_TYPES.creeper;
        assert.ok(creeper, 'creeper type must exist');
        assert.strictEqual(creeper.type, 'creeper');
        assert.strictEqual(creeper.name, 'Creeper');
        assert.strictEqual(creeper.hostile, true);
        assert.strictEqual(creeper.maxHealth, 20);
        assert.strictEqual(creeper.width, 0.6);
        assert.strictEqual(creeper.height, 1.7);
        assert.strictEqual(creeper.speed, 2.5);
        assert.strictEqual(creeper.explosive, true);
        assert.strictEqual(creeper.fuseTime, 1.5);
        assert.strictEqual(creeper.dropBlockId, Blocks.BLOCKS.TNT);
        assert.strictEqual(creeper.color, 0x389c38);
    });

    test('MobManager.spawnMob, Mob.getAABB, and MobManager.clear', () => {
        const world = createMockWorld();
        const manager = new Mobs.MobManager(world);

        assert.strictEqual(manager.mobs.length, 0);

        const pig = manager.spawnMob('pig', 10, 5, 10);
        assert.strictEqual(manager.mobs.length, 1);
        assert.strictEqual(pig.type, 'pig');
        assert.strictEqual(pig.position.x, 10);
        assert.strictEqual(pig.position.y, 5);
        assert.strictEqual(pig.position.z, 10);
        assert.strictEqual(pig.health, 10);
        assert.strictEqual(pig.maxHealth, 10);
        assert.strictEqual(pig.hostile, false);

        // AABB check
        const aabb = pig.getAABB();
        assert.ok(aabb, 'Mob getAABB must return an AABB');
        const halfW = pig.width / 2; // 0.35
        assert.ok(Math.abs(aabb.minX - (10 - halfW)) < 1e-4);
        assert.ok(Math.abs(aabb.maxX - (10 + halfW)) < 1e-4);
        assert.strictEqual(aabb.minY, 5);
        assert.ok(Math.abs(aabb.maxY - (5 + pig.height)) < 1e-4);
        assert.ok(Math.abs(aabb.minZ - (10 - halfW)) < 1e-4);
        assert.ok(Math.abs(aabb.maxZ - (10 + halfW)) < 1e-4);

        // Spawn another mob
        manager.spawnMob('sheep', 20, 5, 20);
        assert.strictEqual(manager.mobs.length, 2);

        // Clear all mobs
        manager.clear();
        assert.strictEqual(manager.mobs.length, 0);
    });

    test('Passive wandering decision updates direction and movement', () => {
        const world = createMockWorld();
        const player = { position: { x: 100, y: 1, z: 100 }, gameMode: 'survival' };
        const mob = new Mobs.Mob('pig', 10, 1, 10);
        mob.onGround = true;
        mob.aiTimer = 0; // Trigger immediate AI decision

        mob.update(0.1, world, player);

        assert.ok(mob.aiTimer > 0, 'aiTimer should be reset to a positive value');
        assert.ok(typeof mob.yaw === 'number', 'Mob yaw should be numeric angle');
        assert.ok(mob.walkCycle >= 0, 'Mob walkCycle should be non-negative');
    });

    test('Obstacle auto-jump over 1-block wall when blocked horizontally', () => {
        // Wall placed at x=11 (solid at x >= 11 for y=1)
        const world = {
            isSolid: (x, y, z) => (y <= 0 || (x >= 11 && y === 1))
        };
        const player = { position: { x: 50, y: 1, z: 50 }, gameMode: 'survival' };

        const mob = new Mobs.Mob('pig', 10.65, 1.0, 10.0);
        mob.onGround = true;
        mob.velocity.y = 0;
        mob.aiTimer = 5.0; // Prevent random AI direction overwrite during test step
        // Walking directly into wall towards +X
        mob.moveDir = { x: 1.0, z: 0.0 };

        // Update physics step
        mob.update(0.1, world, player);

        assert.strictEqual(mob.velocity.y, 8.0, 'Auto-jump should set vertical impulse velocity.y to 8.0');
        assert.strictEqual(mob.onGround, false, 'Mob should be airborne after auto-jumping');
    });

    test('Zombie chasing and melee attack in survival mode', () => {
        const world = createMockWorld();
        let damageInflicted = 0;
        const player = {
            position: { x: 15.0, y: 1.0, z: 10.0 },
            gameMode: 'survival',
            isFlying: false,
            takeDamage: (amount) => {
                damageInflicted += amount;
            }
        };

        // Zombie at distance 5 blocks (within 15 block detection range)
        const zombie = new Mobs.Mob('zombie', 10.0, 1.0, 10.0);
        zombie.onGround = true;

        zombie.update(0.1, world, player);

        // Zombie should target player along +X
        assert.ok(zombie.moveDir.x > 0.9, `Zombie moveDir.x should point towards player, got ${zombie.moveDir.x}`);
        assert.ok(Math.abs(zombie.moveDir.z) < 0.1, 'Zombie moveDir.z should be close to 0');
        assert.ok(zombie.velocity.x > 2.0, 'Zombie velocity should be positive towards player');

        // Close proximity melee attack (dist < 1.3)
        player.position.x = 10.8; // dist = 0.8 blocks
        zombie.attackCooldown = 0;

        zombie.update(0.1, world, player);

        assert.strictEqual(damageInflicted, 2, 'Zombie should deal 2 attack damage on player in melee range');
        assert.strictEqual(zombie.attackCooldown, 1.0, 'Zombie attack cooldown should be set to 1.0s');

        // Immediate next update should not deal damage due to cooldown
        zombie.update(0.1, world, player);
        assert.strictEqual(damageInflicted, 2, 'No additional damage during attack cooldown');
    });

    test('Hostile mobs automatically despawn in peaceful mode while passive mobs remain', () => {
        const world = createMockWorld();
        const manager = new Mobs.MobManager(world);

        const zombie = manager.spawnMob('zombie', 10, 1, 10);
        const creeper = manager.spawnMob('creeper', 12, 1, 10);
        const pig = manager.spawnMob('pig', 15, 1, 10);
        const sheep = manager.spawnMob('sheep', 18, 1, 10);

        assert.strictEqual(manager.mobs.length, 4);

        const peacefulPlayer = {
            position: { x: 10, y: 1, z: 10 },
            gameMode: 'peaceful',
            isFlying: false
        };

        // Update mob manager in peaceful mode
        manager.update(0.1, peacefulPlayer);

        assert.strictEqual(zombie.dead, true, 'Zombie must be marked dead in peaceful mode');
        assert.strictEqual(creeper.dead, true, 'Creeper must be marked dead in peaceful mode');
        assert.strictEqual(pig.dead, false, 'Pig should remain alive in peaceful mode');
        assert.strictEqual(sheep.dead, false, 'Sheep should remain alive in peaceful mode');

        assert.strictEqual(manager.mobs.includes(zombie), false, 'Zombie must be removed from manager in peaceful mode');
        assert.strictEqual(manager.mobs.includes(creeper), false, 'Creeper must be removed from manager in peaceful mode');
        assert.strictEqual(manager.mobs.includes(pig), true, 'Pig must remain in manager');
        assert.strictEqual(manager.mobs.includes(sheep), true, 'Sheep must remain in manager');
        assert.strictEqual(manager.mobs.length, 2);
    });

    test('Creeper ignition, countdown, and onCreeperExplode callback when close to player', () => {
        const world = createMockWorld();
        const player = {
            position: { x: 12.0, y: 1.0, z: 10.0 }, // distance = 2.0 blocks (within 2.8 ignition range)
            gameMode: 'survival',
            isFlying: false,
            takeDamage: () => {}
        };

        const creeper = new Mobs.Mob('creeper', 10.0, 1.0, 10.0);
        creeper.onGround = true;

        assert.strictEqual(creeper.isIgnited, false);
        assert.strictEqual(creeper.fuseTimer, 0);

        // Update triggers ignition
        creeper.update(0.1, world, player);
        assert.strictEqual(creeper.isIgnited, true, 'Creeper should ignite when player is within 2.8 blocks');
        assert.ok(creeper.fuseTimer > 0, 'Creeper fuseTimer should start ticking up');

        // While ignited, creeper stops moving to detonate
        assert.strictEqual(creeper.moveDir.x, 0);
        assert.strictEqual(creeper.moveDir.z, 0);

        // Test explosion event at fuseTime (1.5s)
        let explosionTriggered = false;
        let explodedCreeper = null;
        creeper.fuseTimer = 1.45; // close to 1.5s fuse

        creeper.update(0.1, world, player, 0.5, {
            onCreeperExplode: (c) => {
                explosionTriggered = true;
                explodedCreeper = c;
            }
        });

        assert.strictEqual(explosionTriggered, true, 'onCreeperExplode callback should be invoked');
        assert.strictEqual(explodedCreeper, creeper);
        assert.strictEqual(creeper.dead, true, 'Creeper should be dead after exploding');
    });

    test('MobManager.raycastMob accurately detects hit and misses', () => {
        const world = createMockWorld();
        const manager = new Mobs.MobManager(world);

        // Spawn a zombie at (10, 1, 10)
        const zombie = manager.spawnMob('zombie', 10.0, 1.0, 10.0);

        // Ray looking along +X towards zombie from (5, 1.5, 10)
        const origin = { x: 5.0, y: 1.5, z: 10.0 };
        const dirForward = { x: 1.0, y: 0.0, z: 0.0 };

        const hit = manager.raycastMob(origin, dirForward, 10.0);
        assert.strictEqual(hit.hit, true, 'Ray should hit zombie bounding box');
        assert.strictEqual(hit.mob, zombie);
        assert.ok(hit.distance > 4.5 && hit.distance < 5.0, `Hit distance should be ~4.7, got ${hit.distance}`);

        // Ray looking opposite direction (-X) should miss
        const dirBackward = { x: -1.0, y: 0.0, z: 0.0 };
        const missDir = manager.raycastMob(origin, dirBackward, 10.0);
        assert.strictEqual(missDir.hit, false, 'Ray in opposite direction should not hit');

        // Ray out of reach (maxDist = 2.0 when zombie is ~4.7 blocks away)
        const missDist = manager.raycastMob(origin, dirForward, 2.0);
        assert.strictEqual(missDist.hit, false, 'Ray beyond max distance should not hit');
    });

    test('MobManager.hitMob applies damage, knockback, audio, and onMobKilled death callback', () => {
        const world = createMockWorld();
        let playedSoundType = null;
        const mockAudio = {
            playMobHurt: (type) => { playedSoundType = type; },
            playHurt: () => {}
        };
        const manager = new Mobs.MobManager(world, null, null, mockAudio);

        const pig = manager.spawnMob('pig', 10.0, 1.0, 10.0);
        assert.strictEqual(pig.health, 10);

        const attackerPos = { x: 7.0, y: 1.0, z: 10.0 }; // Attacker at -X

        // Hit mob for 4 damage
        manager.hitMob(pig, 4, attackerPos);

        assert.strictEqual(pig.health, 6, 'Mob health should decrease by 4');
        assert.strictEqual(pig.hurtTimer, 0.3, 'hurtTimer should be set to 0.3');
        assert.strictEqual(pig.panicTimer, 3.5, 'panicTimer should be set to 3.5');
        assert.strictEqual(playedSoundType, 'pig', 'Mob hurt sound should be played for pig');

        // Knockback checks: pushed away from attacker (+X) and upwards
        assert.ok(pig.velocity.x > 5.0, `Mob should be knocked back along +X, got ${pig.velocity.x}`);
        assert.strictEqual(pig.velocity.y, 5.5, 'Mob should receive vertical knockback impulse of 5.5');
        assert.strictEqual(pig.onGround, false, 'Mob should be airborne from knockback');

        // Lethal hit
        let killedReported = null;
        manager.hitMob(pig, 10, attackerPos, {
            onMobKilled: (m) => { killedReported = m; }
        });

        assert.strictEqual(pig.health, 0);
        assert.strictEqual(pig.dead, true, 'Mob should be marked dead after lethal damage');
        assert.strictEqual(killedReported, pig, 'onMobKilled callback must be invoked with dead mob');
        assert.strictEqual(manager.mobs.includes(pig), false, 'Dead mob must be removed from manager');
        assert.strictEqual(manager.mobs.length, 0);
    });
});
