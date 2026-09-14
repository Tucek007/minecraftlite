/**
 * physics.js - Voxel Raycasting (DDA) and AABB Collision Detection for Minecraft Lite.
 * Universal Module Definition (UMD) compatible with Browser and Node.js.
 */
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory();
    } else {
        root.Physics = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    class AABB {
        constructor(minX, minY, minZ, maxX, maxY, maxZ) {
            this.minX = minX;
            this.minY = minY;
            this.minZ = minZ;
            this.maxX = maxX;
            this.maxY = maxY;
            this.maxZ = maxZ;
        }

        intersects(other) {
            return (
                this.minX < other.maxX &&
                this.maxX > other.minX &&
                this.minY < other.maxY &&
                this.maxY > other.minY &&
                this.minZ < other.maxZ &&
                this.maxZ > other.minZ
            );
        }

        containsPoint(x, y, z) {
            return (
                x >= this.minX && x <= this.maxX &&
                y >= this.minY && y <= this.maxY &&
                z >= this.minZ && z <= this.maxZ
            );
        }

        clone() {
            return new AABB(this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ);
        }

        offset(dx, dy, dz) {
            return new AABB(
                this.minX + dx, this.minY + dy, this.minZ + dz,
                this.maxX + dx, this.maxY + dy, this.maxZ + dz
            );
        }
    }

    /**
     * Fast Voxel Traversal Algorithm (Amanatides & Woo) for 3D Raycasting.
     * @param {Object} origin - {x, y, z}
     * @param {Object} direction - normalized {x, y, z}
     * @param {number} maxDistance - maximum reach distance
     * @param {Function} isSolidFn - function(x, y, z) returning boolean
     */
    function raycastVoxel(origin, direction, maxDistance, isSolidFn) {
        let x = Math.floor(origin.x);
        let y = Math.floor(origin.y);
        let z = Math.floor(origin.z);

        const dx = direction.x;
        const dy = direction.y;
        const dz = direction.z;

        const stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
        const stepY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
        const stepZ = dz > 0 ? 1 : (dz < 0 ? -1 : 0);

        const deltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
        const deltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
        const deltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;

        let maxX = stepX > 0 ? (x + 1 - origin.x) * deltaX : (stepX < 0 ? (origin.x - x) * deltaX : Infinity);
        let maxY = stepY > 0 ? (y + 1 - origin.y) * deltaY : (stepY < 0 ? (origin.y - y) * deltaY : Infinity);
        let maxZ = stepZ > 0 ? (z + 1 - origin.z) * deltaZ : (stepZ < 0 ? (origin.z - z) * deltaZ : Infinity);

        let normalX = 0;
        let normalY = 0;
        let normalZ = 0;

        let distance = 0;

        while (distance <= maxDistance) {
            if (isSolidFn(x, y, z)) {
                return {
                    hit: true,
                    blockPos: { x, y, z },
                    faceNormal: { x: normalX, y: normalY, z: normalZ },
                    placePos: { x: x + normalX, y: y + normalY, z: z + normalZ },
                    distance: distance
                };
            }

            if (maxX < maxY) {
                if (maxX < maxZ) {
                    x += stepX;
                    distance = maxX;
                    maxX += deltaX;
                    normalX = -stepX;
                    normalY = 0;
                    normalZ = 0;
                } else {
                    z += stepZ;
                    distance = maxZ;
                    maxZ += deltaZ;
                    normalX = 0;
                    normalY = 0;
                    normalZ = -stepZ;
                }
            } else {
                if (maxY < maxZ) {
                    y += stepY;
                    distance = maxY;
                    maxY += deltaY;
                    normalX = 0;
                    normalY = -stepY;
                    normalZ = 0;
                } else {
                    z += stepZ;
                    distance = maxZ;
                    maxZ += deltaZ;
                    normalX = 0;
                    normalY = 0;
                    normalZ = -stepZ;
                }
            }
        }

        return { hit: false };
    }

    const EPS = 1e-5;

    /**
     * Checks if there is solid ground beneath the player's feet box.
     */
    function hasGroundSupport(x, y, z, halfW, isSolidFn) {
        const footY = Math.floor(y - 0.05);
        const minX = Math.floor(x - halfW + EPS);
        const maxX = Math.floor(x + halfW - EPS);
        const minZ = Math.floor(z - halfW + EPS);
        const maxZ = Math.floor(z + halfW - EPS);

        for (let bx = minX; bx <= maxX; bx++) {
            for (let bz = minZ; bz <= maxZ; bz++) {
                if (isSolidFn(bx, footY, bz)) return true;
            }
        }
        return false;
    }

    /**
     * Binary search clamping along an axis for sneak cliff edge protection.
     */
    function clampSneakAxis(startX, startY, startZ, delta, isZ, halfW, isSolidFn) {
        if (delta === 0) return 0;
        const testSupport = (d) => isZ ?
            hasGroundSupport(startX, startY, startZ + d, halfW, isSolidFn) :
            hasGroundSupport(startX + d, startY, startZ, halfW, isSolidFn);

        if (testSupport(delta)) return delta;

        let lo = 0;
        let hi = delta;
        for (let i = 0; i < 15; i++) {
            const mid = (lo + hi) / 2;
            if (testSupport(mid)) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    /**
     * Get surrounding solid block AABBs for collision resolution.
     */
    function getSurroundingBlockBoxes(playerAABB, isSolidFn) {
        const boxes = [];
        const minX = Math.floor(playerAABB.minX - 0.5);
        const maxX = Math.ceil(playerAABB.maxX + 0.5);
        const minY = Math.floor(playerAABB.minY - 1.0);
        const maxY = Math.ceil(playerAABB.maxY + 1.0);
        const minZ = Math.floor(playerAABB.minZ - 0.5);
        const maxZ = Math.ceil(playerAABB.maxZ + 0.5);

        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                for (let x = minX; x <= maxX; x++) {
                    if (isSolidFn(x, y, z)) {
                        boxes.push(new AABB(x, y, z, x + 1, y + 1, z + 1));
                    }
                }
            }
        }
        return boxes;
    }

    /**
     * Collide and slide physics step for player using swept AABB and axis clipping.
     * @param {Object} pos - current {x, y, z} position (base of player feet)
     * @param {Object} vel - velocity {x, y, z}
     * @param {number} width - player width (e.g. 0.6)
     * @param {number} height - player height (e.g. 1.8)
     * @param {Function} isSolidFn - function(x, y, z)
     * @param {boolean} sneak - whether sneaking is active
     * @param {boolean} wasOnGround - whether player was grounded at start of step
     */
    function moveWithCollision(pos, vel, width, height, isSolidFn, sneak = false, wasOnGround = false) {
        const halfW = width / 2;
        let dx = vel.x;
        let dy = vel.y;
        let dz = vel.z;

        const isGrounded = wasOnGround || !!pos.onGround;

        // Sneak cliff edge protection: clamp horizontal movement if grounded
        if (sneak && isGrounded && hasGroundSupport(pos.x, pos.y, pos.z, halfW, isSolidFn)) {
            dx = clampSneakAxis(pos.x, pos.y, pos.z, dx, false, halfW, isSolidFn);
            dz = clampSneakAxis(pos.x + dx, pos.y, pos.z, dz, true, halfW, isSolidFn);
        }

        // Current bounding box
        let pBox = new AABB(
            pos.x - halfW, pos.y, pos.z - halfW,
            pos.x + halfW, pos.y + height, pos.z + halfW
        );

        // Gather candidate solid blocks in the swept bounding volume
        const sMinX = Math.floor(Math.min(pBox.minX, pBox.minX + dx) - 0.1);
        const sMaxX = Math.ceil(Math.max(pBox.maxX, pBox.maxX + dx) + 0.1);
        const sMinY = Math.floor(Math.min(pBox.minY, pBox.minY + dy) - 0.1);
        const sMaxY = Math.ceil(Math.max(pBox.maxY, pBox.maxY + dy) + 0.1);
        const sMinZ = Math.floor(Math.min(pBox.minZ, pBox.minZ + dz) - 0.1);
        const sMaxZ = Math.ceil(Math.max(pBox.maxZ, pBox.maxZ + dz) + 0.1);

        const blocks = [];
        for (let y = sMinY; y <= sMaxY; y++) {
            for (let z = sMinZ; z <= sMaxZ; z++) {
                for (let x = sMinX; x <= sMaxX; x++) {
                    if (isSolidFn(x, y, z)) {
                        blocks.push(new AABB(x, y, z, x + 1, y + 1, z + 1));
                    }
                }
            }
        }

        // 1. Move and resolve along Y
        const origDy = dy;
        for (const b of blocks) {
            if (pBox.maxX > b.minX + EPS && pBox.minX < b.maxX - EPS &&
                pBox.maxZ > b.minZ + EPS && pBox.minZ < b.maxZ - EPS) {
                if (dy > 0 && pBox.maxY <= b.minY + EPS) {
                    dy = Math.min(dy, b.minY - pBox.maxY);
                } else if (dy < 0 && pBox.minY >= b.maxY - EPS) {
                    dy = Math.max(dy, b.maxY - pBox.minY);
                }
            }
        }
        pos.y += dy;
        pBox.minY += dy;
        pBox.maxY += dy;

        const onGround = (origDy < 0 && dy > origDy);
        const hitCeiling = (origDy > 0 && dy < origDy);

        // 2. Move and resolve along X
        for (const b of blocks) {
            if (pBox.maxY > b.minY + EPS && pBox.minY < b.maxY - EPS &&
                pBox.maxZ > b.minZ + EPS && pBox.minZ < b.maxZ - EPS) {
                if (dx > 0 && pBox.maxX <= b.minX + EPS) {
                    dx = Math.min(dx, b.minX - pBox.maxX);
                } else if (dx < 0 && pBox.minX >= b.maxX - EPS) {
                    dx = Math.max(dx, b.maxX - pBox.minX);
                }
            }
        }
        pos.x += dx;
        pBox.minX += dx;
        pBox.maxX += dx;

        // 3. Move and resolve along Z
        for (const b of blocks) {
            if (pBox.maxX > b.minX + EPS && pBox.minX < b.maxX - EPS &&
                pBox.maxY > b.minY + EPS && pBox.minY < b.maxY - EPS) {
                if (dz > 0 && pBox.maxZ <= b.minZ + EPS) {
                    dz = Math.min(dz, b.minZ - pBox.maxZ);
                } else if (dz < 0 && pBox.minZ >= b.maxZ - EPS) {
                    dz = Math.max(dz, b.maxZ - pBox.minZ);
                }
            }
        }
        pos.z += dz;
        pBox.minZ += dz;
        pBox.maxZ += dz;

        pos.onGround = onGround;

        return {
            x: pos.x,
            y: pos.y,
            z: pos.z,
            onGround: onGround,
            hitCeiling: hitCeiling
        };
    }

    return {
        AABB,
        raycastVoxel,
        moveWithCollision,
        getSurroundingBlockBoxes,
        hasGroundSupport
    };
}));
