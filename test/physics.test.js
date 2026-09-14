const { test, describe } = require('node:test');
const assert = require('node:assert');
const Physics = require('../js/physics.js');

describe('Physics & Collision tests', () => {
    test('AABB intersection logic', () => {
        const box1 = new Physics.AABB(0, 0, 0, 1, 1, 1);
        const box2 = new Physics.AABB(0.5, 0.5, 0.5, 1.5, 1.5, 1.5);
        const box3 = new Physics.AABB(2, 2, 2, 3, 3, 3);

        assert.strictEqual(box1.intersects(box2), true, 'Overlapping boxes should intersect');
        assert.strictEqual(box1.intersects(box3), false, 'Non-overlapping boxes should not intersect');
    });

    test('AABB containsPoint', () => {
        const box = new Physics.AABB(10, 20, 30, 15, 25, 35);
        assert.strictEqual(box.containsPoint(12, 22, 32), true);
        assert.strictEqual(box.containsPoint(5, 22, 32), false);
        assert.strictEqual(box.containsPoint(10, 20, 30), true, 'Boundary points should be contained');
    });

    test('RaycastVoxel hits target solid block accurately', () => {
        // Mock world with a single solid block at (5, 0, 0)
        const isSolid = (x, y, z) => (x === 5 && y === 0 && z === 0);

        const origin = { x: 0.5, y: 0.5, z: 0.5 };
        const direction = { x: 1, y: 0, z: 0 }; // Looking along +X

        const hit = Physics.raycastVoxel(origin, direction, 10, isSolid);
        assert.strictEqual(hit.hit, true, 'Ray should hit solid block');
        assert.deepStrictEqual(hit.blockPos, { x: 5, y: 0, z: 0 });
        assert.deepStrictEqual(hit.faceNormal, { x: -1, y: 0, z: 0 }, 'Face normal should point back towards origin');
        assert.deepStrictEqual(hit.placePos, { x: 4, y: 0, z: 0 }, 'Place pos should be block adjacent to hit face');
    });

    test('RaycastVoxel returns hit: false when out of reach', () => {
        const isSolid = (x, y, z) => (x === 10 && y === 0 && z === 0);
        const origin = { x: 0, y: 0, z: 0 };
        const direction = { x: 1, y: 0, z: 0 };

        const hit = Physics.raycastVoxel(origin, direction, 5, isSolid); // Reach 5, block at 10
        assert.strictEqual(hit.hit, false, 'Target beyond reach should not hit');
    });

    test('Collision resolution: Falling stops on ground and sets onGround', () => {
        // Ground is at y = 0
        const isSolid = (x, y, z) => (y === 0);

        const pos = { x: 0.5, y: 1.5, z: 0.5 };
        const vel = { x: 0, y: -2.0, z: 0 }; // falling down
        const width = 0.6;
        const height = 1.8;

        const res = Physics.moveWithCollision(pos, vel, width, height, isSolid, false);

        assert.strictEqual(res.onGround, true, 'Player should land on ground');
        assert.strictEqual(res.y, 1.0, 'Player feet should be exactly on top of block y=0 (y=1.0)');
    });

    test('Collision resolution: Walking into a wall halts horizontal penetration', () => {
        // Wall at x = 2
        const isSolid = (x, y, z) => (x === 2 && y >= 1 && y <= 2);

        const pos = { x: 1.0, y: 1.0, z: 0.5 };
        const vel = { x: 1.5, y: 0, z: 0 }; // moving toward wall
        const width = 0.6; // half width = 0.3
        const height = 1.8;

        const res = Physics.moveWithCollision(pos, vel, width, height, isSolid, false);

        // Player's maxX = pos.x + 0.3. Wall minX = 2.0.
        // pos.x should stop at 2.0 - 0.3 = 1.7
        assert.ok(Math.abs(res.x - 1.7) < 0.001, `Player should stop at wall boundary, got ${res.x}`);
    });

    test('RaycastVoxel on integer boundary with 0-component does not produce NaN', () => {
        // Looking along +X with origin.y = 5.0 (integer boundary, dy = 0)
        const isSolid = (x, y, z) => (x === 4 && y === 5 && z === 2);
        const origin = { x: 1.5, y: 5.0, z: 2.5 };
        const direction = { x: 1, y: 0, z: 0 };

        const hit = Physics.raycastVoxel(origin, direction, 5, isSolid);
        assert.strictEqual(hit.hit, true, 'Ray must hit block at x=4 without NaN failure');
        assert.deepStrictEqual(hit.blockPos, { x: 4, y: 5, z: 2 });
        assert.deepStrictEqual(hit.faceNormal, { x: -1, y: 0, z: 0 });
    });

    test('Collision resolution: Fast fall through multiple floors stops at upper floor', () => {
        // Two floors: y=8 and y=5
        const isSolid = (x, y, z) => (y === 8 || y === 5);
        const pos = { x: 0.5, y: 10.0, z: 0.5 };
        const vel = { x: 0, y: -5.0, z: 0 }; // falling fast towards y=5

        const res = Physics.moveWithCollision(pos, vel, 0.6, 1.8, isSolid, false, false);
        assert.strictEqual(res.onGround, true, 'Player should land on upper floor');
        assert.strictEqual(res.y, 9.0, 'Player feet should land on y=9.0 (top of block y=8)');
    });

    test('Sneak cliff edge protection clamps movement at block boundary', () => {
        // Single block at (0, 0, 0)
        const isSolid = (x, y, z) => (x === 0 && y === 0 && z === 0);
        const pos = { x: 0.5, y: 1.0, z: 0.5 };
        const vel = { x: 1.5, y: 0, z: 0 }; // trying to walk off edge

        const res = Physics.moveWithCollision(pos, vel, 0.6, 1.8, isSolid, true, true);
        // Half width = 0.3. Block bounds are [0, 1]. Player should not exceed edge where support is lost.
        assert.ok(res.x <= 1.3, `Player should be clamped at edge, got x=${res.x}`);
        assert.ok(Physics.hasGroundSupport(res.x, res.y, res.z, 0.3, isSolid), 'Player must remain supported by ground');
    });
});
