/**
 * player.js - First-person player controller, input handling, physics integration.
 * Universal Module Definition (UMD) compatible with Browser and Node.js.
 */
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory(require('./physics'), require('./blocks'));
    } else {
        root.PlayerController = factory(root.Physics, root.Blocks);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (PhysicsModule, BlocksModule) {
    'use strict';

    const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
    const Physics = PhysicsModule || (g && g.Physics) || (typeof require !== 'undefined' ? require('./physics') : null);
    const Blocks = BlocksModule || (g && g.Blocks) || (typeof require !== 'undefined' ? require('./blocks') : null);

    class PlayerController {
        constructor(camera, domElement, world, audio) {
            this.camera = camera;
            this.domElement = domElement;
            this.world = world;
            this.audio = audio;

            // Player state
            this.position = { x: 8.5, y: 35.0, z: 8.5 };
            this.velocity = { x: 0, y: 0, z: 0 };
            this.width = 0.6;
            this.height = 1.8;
            this.normalEyeHeight = 1.62;
            this.sneakEyeHeight = 1.35;
            this.currentEyeHeight = 1.62;

            this.pitch = 0;
            this.yaw = 0;
            this.sensitivity = 0.0022;

            this.onGround = false;
            this.isSneaking = false;
            this.isFlying = false;
            this.isSprinting = false;

            this.reachDistance = 5.5;
            this.targetBlock = null;

            // Head bobbing & footstep accumulator
            this.bobCycle = 0;
            this.stepDistance = 0;
            this.wasInWater = false;

            // Input state
            this.keys = {};
            this.isLocked = false;

            this.selectedSlot = 0; // 0..8

            this.setupEventListeners();
        }

        setupEventListeners() {
            if (typeof window === 'undefined') return;

            document.addEventListener('keydown', (e) => this.onKeyDown(e));
            document.addEventListener('keyup', (e) => this.onKeyUp(e));
            document.addEventListener('mousemove', (e) => this.onMouseMove(e));

            document.addEventListener('pointerlockchange', () => {
                this.isLocked = (document.pointerLockElement === this.domElement);
            });

            // Wheel for hotbar cycling
            window.addEventListener('wheel', (e) => {
                if (!this.isLocked) return;
                if (e.deltaY > 0) {
                    this.selectedSlot = (this.selectedSlot + 1) % 9;
                } else if (e.deltaY < 0) {
                    this.selectedSlot = (this.selectedSlot - 1 + 9) % 9;
                }
                if (window.UI) window.UI.updateActiveSlot(this.selectedSlot);
            }, { passive: true });
        }

        lock() {
            if (this.domElement && this.domElement.requestPointerLock) {
                this.domElement.requestPointerLock();
            }
        }

        unlock() {
            if (document.exitPointerLock) {
                document.exitPointerLock();
            }
        }

        onKeyDown(e) {
            this.keys[e.code] = true;
            const UI = (g && g.UI) || (typeof window !== 'undefined' ? window.UI : null);

            // Hotbar keys 1-9
            if (e.code.startsWith('Digit') && e.code.length === 6) {
                const num = parseInt(e.code[5], 10);
                if (num >= 1 && num <= 9) {
                    this.selectedSlot = num - 1;
                    if (UI) UI.updateActiveSlot(this.selectedSlot);
                }
            }

            // Fly mode toggle: 'F' key
            if (e.code === 'KeyF') {
                this.isFlying = !this.isFlying;
                this.velocity.y = 0;
                if (UI) UI.showToast(this.isFlying ? 'Creative Flying: ON' : 'Survival Mode: ON');
            }

            // Debug screen toggle: F3
            if (e.code === 'F3') {
                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (UI) UI.toggleDebug();
            }
        }

        onKeyUp(e) {
            this.keys[e.code] = false;
        }

        onMouseMove(e) {
            if (!this.isLocked) return;

            const movementX = e.movementX || 0;
            const movementY = e.movementY || 0;

            this.yaw -= movementX * this.sensitivity;
            this.pitch -= movementY * this.sensitivity;

            // Clamp pitch to avoid gimbal flipping (-89 to +89 degrees)
            const maxPitch = (Math.PI / 2) - 0.01;
            this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
        }

        update(dt) {
            // Cap delta time to prevent physics tunneling on lag spikes
            const delta = Math.min(0.1, dt);

            this.isSneaking = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
            this.isSprinting = !!(this.keys['ControlLeft'] || this.keys['ControlRight']);

            // Target eye height transition
            const targetEye = this.isSneaking ? this.sneakEyeHeight : this.normalEyeHeight;
            this.currentEyeHeight += (targetEye - this.currentEyeHeight) * Math.min(1.0, delta * 15);

            // Compute movement forward/strafe directions based on yaw
            const forwardX = -Math.sin(this.yaw);
            const forwardZ = -Math.cos(this.yaw);
            const rightX = Math.cos(this.yaw);
            const rightZ = -Math.sin(this.yaw);

            let moveX = 0;
            let moveZ = 0;

            if (this.keys['KeyW']) { moveX += forwardX; moveZ += forwardZ; }
            if (this.keys['KeyS']) { moveX -= forwardX; moveZ -= forwardZ; }
            if (this.keys['KeyA']) { moveX -= rightX; moveZ -= rightZ; }
            if (this.keys['KeyD']) { moveX += rightX; moveZ += rightZ; }

            // Normalize movement vector
            const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
            if (moveLen > 0.001) {
                moveX /= moveLen;
                moveZ /= moveLen;
            }

            // Water immersion check (around waist / legs)
            const inWater = this.world && (typeof this.world.isWater === 'function' ?
                this.world.isWater(this.position.x, this.position.y + 0.6, this.position.z) :
                (typeof this.world.getBlock === 'function' && this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.6), Math.floor(this.position.z)) === 11));

            if (inWater && !this.wasInWater && this.audio && !this.isFlying) {
                this.audio.playSplash();
            }
            this.wasInWater = inWater;

            // Speed calculation
            let moveSpeed = 4.3; // standard walking speed
            if (this.isFlying) {
                moveSpeed = 12.0;
            } else if (this.isSprinting) {
                moveSpeed = 6.2;
            } else if (this.isSneaking) {
                moveSpeed = 1.9;
            }

            if (inWater && !this.isFlying) {
                moveSpeed *= 0.65; // water resistance
            }

            // Acceleration & friction
            const accel = this.onGround ? 28.0 : (this.isFlying ? 25.0 : 8.0);
            const targetVx = moveX * moveSpeed;
            const targetVz = moveZ * moveSpeed;

            this.velocity.x += (targetVx - this.velocity.x) * Math.min(1.0, accel * delta);
            this.velocity.z += (targetVz - this.velocity.z) * Math.min(1.0, accel * delta);

            // Vertical movement
            if (this.isFlying) {
                let targetVy = 0;
                if (this.keys['Space']) targetVy += moveSpeed;
                if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) targetVy -= moveSpeed;
                this.velocity.y += (targetVy - this.velocity.y) * Math.min(1.0, 15.0 * delta);
            } else if (inWater) {
                // Buoyancy and swimming in water
                let targetVy = -1.5; // gentle sinking in water
                if (this.keys['Space']) {
                    targetVy = 3.5; // swim upwards
                } else if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
                    targetVy = -4.0; // swim downwards
                }
                this.velocity.y += (targetVy - this.velocity.y) * Math.min(1.0, 8.0 * delta);
            } else {
                // Gravity
                const gravity = -28.0;
                this.velocity.y += gravity * delta;

                // Terminal fall velocity
                if (this.velocity.y < -40.0) this.velocity.y = -40.0;

                // Jump
                if (this.keys['Space'] && this.onGround) {
                    this.velocity.y = 8.6; // Jump impulse (~1.25 blocks height)
                    this.onGround = false;
                    if (this.audio) this.audio.playJump();
                }
            }

            // Physics step with collision
            const displacement = {
                x: this.velocity.x * delta,
                y: this.velocity.y * delta,
                z: this.velocity.z * delta
            };

            const Phys = Physics || (g && g.Physics) || (typeof require !== 'undefined' ? require('./physics') : null);
            if (Phys && this.world) {
                const result = Phys.moveWithCollision(
                    this.position,
                    displacement,
                    this.width,
                    this.height,
                    (x, y, z) => this.world.isSolid(x, y, z),
                    this.isSneaking,
                    this.onGround
                );

                this.onGround = result.onGround;
                if (this.onGround && this.velocity.y < 0) {
                    this.velocity.y = 0;
                }
                if (result.hitCeiling && this.velocity.y > 0) {
                    this.velocity.y = 0;
                }
            } else {
                this.position.x += displacement.x;
                this.position.y += displacement.y;
                this.position.z += displacement.z;
            }

            // Void recovery
            if (this.position.y < -10) {
                this.position.y = 45;
                this.position.x = 8.5;
                this.position.z = 8.5;
                this.velocity.x = 0;
                this.velocity.y = 0;
                this.velocity.z = 0;
                const UI = (g && g.UI) || (typeof window !== 'undefined' ? window.UI : null);
                if (UI) UI.showToast('Respawned above surface!');
            }

            // Footstep audio and head bobbing
            const hDist = Math.sqrt(displacement.x * displacement.x + displacement.z * displacement.z);
            let bobY = 0;
            if (this.onGround && hDist > 0.001 && !this.isFlying) {
                this.bobCycle += hDist * 6.0;
                bobY = Math.sin(this.bobCycle) * 0.04;

                this.stepDistance += hDist;
                if (this.stepDistance >= 1.8) {
                    this.stepDistance = 0;
                    if (this.audio && this.world) {
                        const underBlock = this.world.getBlock(
                            Math.floor(this.position.x),
                            Math.floor(this.position.y - 0.2),
                            Math.floor(this.position.z)
                        );
                        const B = Blocks || (g && g.Blocks);
                        const bDef = B && B.BLOCK_DEFS && B.BLOCK_DEFS[underBlock];
                        this.audio.playStep(bDef ? bDef.sound : 'grass');
                    }
                }
            }

            // Sync camera position and rotation
            if (this.camera && this.camera.position) {
                this.camera.position.x = this.position.x;
                this.camera.position.y = this.position.y + this.currentEyeHeight + bobY;
                this.camera.position.z = this.position.z;

                if (this.camera.rotation) {
                    this.camera.rotation.order = 'YXZ';
                    this.camera.rotation.x = this.pitch;
                    this.camera.rotation.y = this.yaw;
                    this.camera.rotation.z = 0;
                }
            }

            // Update voxel raycast
            this.updateRaycast();
        }

        getLookDirection() {
            const cosPitch = Math.cos(this.pitch);
            const sinPitch = Math.sin(this.pitch);
            const sinYaw = Math.sin(this.yaw);
            const cosYaw = Math.cos(this.yaw);

            return {
                x: -sinYaw * cosPitch,
                y: sinPitch,
                z: -cosYaw * cosPitch
            };
        }

        updateRaycast() {
            const Phys = Physics || (g && g.Physics) || (typeof require !== 'undefined' ? require('./physics') : null);
            if (!Phys || !this.world) return;

            const eyePos = {
                x: (this.camera && this.camera.position && this.camera.position.x !== undefined) ? this.camera.position.x : this.position.x,
                y: (this.camera && this.camera.position && this.camera.position.y !== undefined) ? this.camera.position.y : (this.position.y + this.currentEyeHeight),
                z: (this.camera && this.camera.position && this.camera.position.z !== undefined) ? this.camera.position.z : this.position.z
            };
            const lookDir = this.getLookDirection();

            this.targetBlock = Phys.raycastVoxel(
                eyePos,
                lookDir,
                this.reachDistance,
                (x, y, z) => this.world.isSolid(x, y, z)
            );
        }

        /**
         * Checks if placing a block at (bx, by, bz) collides with player's bounding box
         */
        canPlaceBlockAt(bx, by, bz) {
            const halfW = this.width / 2;
            const pxMin = this.position.x - halfW;
            const pxMax = this.position.x + halfW;
            const pyMin = this.position.y;
            const pyMax = this.position.y + this.height;
            const pzMin = this.position.z - halfW;
            const pzMax = this.position.z + halfW;

            // Block AABB [bx, by, bz] to [bx+1, by+1, bz+1]
            const collides = (
                pxMin < bx + 1 && pxMax > bx &&
                pyMin < by + 1 && pyMax > by &&
                pzMin < bz + 1 && pzMax > bz
            );
            return !collides;
        }
    }

    return PlayerController;
}));
