const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const Blocks = require('../js/blocks');
const World = require('../js/world');
const session = require('../js/world-session');

function meshStub(parent) {
    const mesh = {
        parent,
        geometry: { disposed: false, dispose() { this.disposed = true; } },
        material: { disposed: false, dispose() { this.disposed = true; } }
    };
    parent.children.push(mesh);
    return mesh;
}

function sceneStub() {
    return {
        children: [],
        remove(mesh) {
            this.children = this.children.filter((child) => child !== mesh);
            if (mesh.parent === this) mesh.parent = null;
        }
    };
}

function cameraStub() {
    return {
        position: { x: -1, y: -1, z: -1 },
        rotation: { x: 1, y: 1, z: 1, order: 'XYZ' }
    };
}

describe('world session lifecycle', () => {
    test('disposeChunk removes and disposes both opaque and water meshes', () => {
        const parent = sceneStub();
        const chunk = new World.Chunk(0, 0);
        chunk.mesh = meshStub(parent);
        chunk.waterMesh = meshStub(parent);

        const meshes = [chunk.mesh, chunk.waterMesh];
        session.disposeChunk(chunk);
        for (const mesh of meshes) {
            assert.equal(mesh.geometry.disposed, true);
            assert.equal(mesh.material.disposed, true);
        }

        assert.equal(parent.children.length, 0);
        assert.equal(chunk.mesh, null);
        assert.equal(chunk.waterMesh, null);
    });

    test('unloadFarChunks evicts by Chebyshev radius and restores modified blocks', () => {
        const world = new World.VoxelWorld(123);
        const near = world.getOrCreateChunk(0, 1);
        const far = world.getOrCreateChunk(2, 0);
        const parent = sceneStub();
        near.mesh = meshStub(parent);
        far.mesh = meshStub(parent);
        const edited = Blocks.BLOCKS.DIAMOND_ORE;
        world.setBlock(34, 60, 1, edited);

        session.unloadFarChunks(world, 0, 0, 1);

        assert.equal(world.getChunk(0, 1), near);
        assert.equal(world.getChunk(2, 0), undefined);
        assert.equal(world.modifiedBlocks.get('34,60,1'), edited);
        assert.equal(far.mesh, null);
        assert.equal(world.getOrCreateChunk(2, 0).getBlock(2, 60, 1), edited);
    });

    test('resetPlayer places above highest solid or water block and resets state/camera', () => {
        const world = new World.VoxelWorld(456);
        world.setBlock(8, 50, 8, Blocks.BLOCKS.STONE);
        world.setBlock(8, 58, 8, Blocks.BLOCKS.WATER);
        const camera = cameraStub();
        const player = {
            camera,
            position: { x: -10, y: -10, z: -10 },
            velocity: { x: 9, y: 8, z: 7 },
            keys: { KeyW: true },
            targetBlock: { hit: true },
            onGround: true,
            wasInWater: true,
            yaw: 2,
            pitch: -1,
            isFlying: true,
            normalEyeHeight: 1.62,
            currentEyeHeight: 1.62
        };

        session.resetPlayer(player, world);

        assert.equal(player.world, world);
        assert.equal(player.position.x, 8.5);
        assert.equal(player.position.z, 8.5);
        assert.ok(player.position.y > 58);
        assert.deepEqual(player.velocity, { x: 0, y: 0, z: 0 });
        assert.deepEqual(player.keys, {});
        assert.equal(player.targetBlock, null);
        assert.equal(player.onGround, false);
        assert.equal(player.wasInWater, false);
        assert.equal(player.isFlying, false);
        assert.equal(player.yaw, 0);
        assert.equal(player.pitch, 0);
        assert.equal(camera.position.x, player.position.x);
        assert.equal(camera.position.z, player.position.z);
        assert.ok(camera.position.y > 58);
        assert.equal(camera.rotation.x, 0);
        assert.equal(camera.rotation.y, 0);
        assert.equal(camera.rotation.z, 0);
    });

    test('replaceWorld disposes old chunks, clears map, updates UI, and safely places player', () => {
        const oldWorld = new World.VoxelWorld(1);
        const newWorld = new World.VoxelWorld(2);
        const parent = sceneStub();
        const oldChunk = oldWorld.getOrCreateChunk(0, 0);
        oldChunk.mesh = meshStub(parent);
        oldChunk.waterMesh = meshStub(parent);
        const camera = cameraStub();
        const player = {
            camera,
            position: { x: 100, y: -20, z: 100 },
            velocity: { x: 1, y: 2, z: 3 },
            keys: { KeyA: true },
            targetBlock: { hit: true },
            onGround: true,
            wasInWater: true,
            yaw: 1,
            pitch: 1,
            isFlying: true,
            normalEyeHeight: 1.62,
            currentEyeHeight: 1.62,
            world: oldWorld
        };
        const ui = { world: oldWorld };
        newWorld.setBlock(8, 52, 8, Blocks.BLOCKS.STONE);
        newWorld.setBlock(8, 59, 8, Blocks.BLOCKS.WATER);

        session.replaceWorld(oldWorld, newWorld, player, ui);

        assert.equal(oldWorld.chunks.size, 0);
        assert.equal(oldChunk.mesh, null);
        assert.equal(oldChunk.waterMesh, null);
        assert.equal(player.world, newWorld);
        assert.equal(ui.world, newWorld);
        assert.equal(player.position.x, 8.5);
        assert.equal(player.position.z, 8.5);
        assert.ok(player.position.y > 59);
        assert.equal(camera.position.x, player.position.x);
        assert.equal(camera.position.z, player.position.z);
    });
});
