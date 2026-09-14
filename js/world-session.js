(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./world'));
    } else {
        root.WorldSession = factory(root.World);
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (World) {
    'use strict';

    function disposeChunk(chunk) {
        for (const key of ['mesh', 'waterMesh']) {
            const mesh = chunk[key];
            if (!mesh) continue;
            if (mesh.parent) mesh.parent.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const material of materials) {
                if (material) material.dispose();
            }
            chunk[key] = null;
        }
    }

    function unloadFarChunks(world, cx, cz, radius) {
        for (const [key, chunk] of world.chunks) {
            if (Math.abs(chunk.chunkX - cx) > radius || Math.abs(chunk.chunkZ - cz) > radius) {
                disposeChunk(chunk);
                world.chunks.delete(key);
            }
        }
    }

    function resetPlayer(player, world) {
        player.world = world;
        const x = 8.5, z = 8.5;
        let y = 1;
        // Include water and player-built towers when finding a clear spawn.
        for (let by = World.CHUNK_HEIGHT - 1; by >= 0; by--) {
            if (world.getBlock(Math.floor(x), by, Math.floor(z)) !== 0) {
                y = by + 1;
                break;
            }
        }
        Object.assign(player.position, { x, y, z });
        Object.assign(player.velocity, { x: 0, y: 0, z: 0 });
        player.keys = {};
        player.targetBlock = null;
        player.onGround = false;
        player.wasInWater = false;
        player.isSneaking = false;
        player.isSprinting = false;
        player.isFlying = false;
        player.yaw = 0;
        player.pitch = 0;
        player.bobCycle = 0;
        player.stepDistance = 0;
        player.currentEyeHeight = player.normalEyeHeight;
        if (player.camera) {
            Object.assign(player.camera.position, { x, y: y + player.currentEyeHeight, z });
            if (player.camera.rotation) {
                player.camera.rotation.order = 'YXZ';
                player.camera.rotation.x = 0;
                player.camera.rotation.y = 0;
                player.camera.rotation.z = 0;
            }
        }
    }

    function replaceWorld(oldWorld, newWorld, player, ui) {
        for (const chunk of oldWorld.chunks.values()) disposeChunk(chunk);
        oldWorld.chunks.clear();
        resetPlayer(player, newWorld);
        ui.world = newWorld;
    }

    return { disposeChunk, unloadFarChunks, resetPlayer, replaceWorld };
}));
