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

            // FOV settings and dynamic sprint/fly interpolation
            this.baseFov = 75;
            this.currentFov = 75;

            this.onGround = false;
            this.isSneaking = false;
            this.isFlying = false;
            this.isSprinting = false;

            // Game modes: 'survival', 'peaceful', 'creative'
            this.gameMode = 'survival';

            // Double-tap Space detection for flying
            this.lastSpacePressTime = 0;

            // Third-person camera (0: 1st person, 1: 3rd person back, 2: 3rd person front)
            this.cameraMode = 0;
            this.eyePosition = { x: this.position.x, y: this.position.y + this.normalEyeHeight, z: this.position.z };

            // Health, fall distance, and contact hazards
            this.maxHealth = 20;
            this.health = 20;
            this.fallDistance = 0;
            this.contactDamageCooldown = 0;

            // Underwater oxygen, drowning, and health regeneration
            this.maxOxygen = 15.0;
            this.oxygen = 15.0;
            this.drownTimer = 0;
            this.timeSinceLastDamage = 0;
            this.regenTimer = 0;

            this.reachDistance = 5.5;
            this.targetBlock = null;

            // Head bobbing & footstep accumulator
            this.bobCycle = 0;
            this.stepDistance = 0;
            this.wasInWater = false;

            // Custom Bed Spawnpoint, Ladder climbing & Screen Shake
            this.spawnPoint = null;
            this.onLadder = false;
            this.shakeTimer = 0;
            this.shakeIntensity = 0;

            // Input state
            this.keys = {};
            this.isLocked = false;

            this.selectedSlot = 0; // 0..8

            this.setupEventListeners();
        }

        addScreenShake(intensity = 0.15, duration = 0.25) {
            this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
            this.shakeTimer = Math.max(this.shakeTimer, duration);
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
                const UI = (g && g.UI) || (typeof window !== 'undefined' ? window.UI : null);
                if (UI && typeof UI.updateActiveSlot === 'function') UI.updateActiveSlot(this.selectedSlot);
            }, { passive: true });

            // Middle mouse click: Pick block
            window.addEventListener('mousedown', (e) => {
                if (e.button === 1 && this.isLocked) {
                    if (typeof e.preventDefault === 'function') e.preventDefault();
                    this.pickBlock();
                }
            });
        }

        lock() {
            if (this.domElement && typeof this.domElement.requestPointerLock === 'function') {
                try {
                    const promise = this.domElement.requestPointerLock();
                    if (promise && typeof promise.catch === 'function') {
                        promise.catch(() => {});
                    }
                } catch (e) {
                    console.warn('Pointer lock request failed:', e);
                }
            }
        }

        unlock() {
            if (typeof document !== 'undefined' && typeof document.exitPointerLock === 'function') {
                try {
                    document.exitPointerLock();
                } catch (e) {}
            }
        }

        setGameMode(mode) {
            if (!['survival', 'peaceful', 'creative'].includes(mode)) return;
            this.gameMode = mode;

            if (mode === 'creative') {
                this.isFlying = true;
                this.velocity.y = 0;
                this.health = this.maxHealth;
                this.oxygen = this.maxOxygen;
            } else if (mode === 'survival') {
                this.isFlying = false;
            } else if (mode === 'peaceful') {
                this.health = this.maxHealth;
                this.oxygen = this.maxOxygen;
            }

            const UI = (g && g.UI) || (typeof window !== 'undefined' ? window.UI : null);
            if (UI) {
                if (typeof UI.updateGameMode === 'function') {
                    UI.updateGameMode(this.gameMode);
                }
                if (typeof UI.updateHealth === 'function') {
                    UI.updateHealth(this.health);
                }
                if (typeof UI.updateOxygen === 'function') {
                    UI.updateOxygen(this.oxygen, this.maxOxygen);
                }
                if (typeof UI.showToast === 'function') {
                    let toast = 'Režim: Survival';
                    if (mode === 'peaceful') toast = 'Režim: Klidný (Crafting / Bez boje)';
                    else if (mode === 'creative') toast = 'Režim: Kreativní';
                    UI.showToast(toast);
                }
            }
        }

        cycleGameMode() {
            const modes = ['survival', 'peaceful', 'creative'];
            const idx = modes.indexOf(this.gameMode);
            const nextMode = modes[(idx + 1) % modes.length];
            this.setGameMode(nextMode);
        }

        onKeyDown(e) {
            this.keys[e.code] = true;
            const UI = (g && g.UI) || (typeof window !== 'undefined' ? window.UI : null);

            // Double-tap Space detection to toggle flying
            if (e.code === 'Space' && !e.repeat) {
                const now = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
                if (now - this.lastSpacePressTime > 20 && now - this.lastSpacePressTime < 320) {
                    this.isFlying = !this.isFlying;
                    this.velocity.y = 0;
                    if (UI && typeof UI.showToast === 'function') {
                        UI.showToast(this.isFlying ? 'Creative Flying: ON' : 'Flying: OFF');
                    }
                    this.lastSpacePressTime = 0;
                } else {
                    this.lastSpacePressTime = now;
                }
            }

            // Switch game modes: 'G' key
            if (e.code === 'KeyG') {
                this.cycleGameMode();
            }

            // Third-person camera view toggle: F5
            if (e.code === 'F5') {
                if (typeof e.preventDefault === 'function') e.preventDefault();
                this.cameraMode = (this.cameraMode + 1) % 3;
                let toast = 'Pohled: 1. osoba';
                if (this.cameraMode === 1) toast = 'Pohled: 3. osoba (zezadu)';
                else if (this.cameraMode === 2) toast = 'Pohled: 3. osoba (zepředu)';
                if (UI && typeof UI.showToast === 'function') {
                    UI.showToast(toast);
                }
            }

            // Hotbar keys 1-9
            if (e.code.startsWith('Digit') && e.code.length === 6) {
                const num = parseInt(e.code[5], 10);
                if (num >= 1 && num <= 9) {
                    this.selectedSlot = num - 1;
                    if (UI && typeof UI.updateActiveSlot === 'function') UI.updateActiveSlot(this.selectedSlot);
                }
            }

            // Fly mode toggle: 'F' key
            if (e.code === 'KeyF') {
                this.isFlying = !this.isFlying;
                this.velocity.y = 0;
                if (UI && typeof UI.showToast === 'function') UI.showToast(this.isFlying ? 'Creative Flying: ON' : 'Survival Mode: ON');
            }

            // Debug screen toggle: F3
            if (e.code === 'F3') {
                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (UI && typeof UI.toggleDebug === 'function') UI.toggleDebug();
            }

            // Creative inventory overlay toggle: 'E'
            if (e.code === 'KeyE') {
                if (UI && typeof UI.toggleInventory === 'function') {
                    if (typeof e.preventDefault === 'function') e.preventDefault();
                    UI.toggleInventory();
                }
            }
        }

        onKeyUp(e) {
            this.keys[e.code] = false;
        }

        addLookDelta(dx, dy) {
            this.yaw -= dx * this.sensitivity;
            this.pitch -= dy * this.sensitivity;

            // Clamp pitch to avoid gimbal flipping (-89 to +89 degrees)
            const maxPitch = (Math.PI / 2) - 0.01;
            this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
        }

        onMouseMove(e) {
            if (!this.isLocked) return;
            this.addLookDelta(e.movementX || 0, e.movementY || 0);
        }

        update(dt) {
            // Cap delta time to prevent physics tunneling on lag spikes
            const delta = Math.min(0.1, dt);

            if (this.contactDamageCooldown > 0) {
                this.contactDamageCooldown -= delta;
            }

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

            if (inWater && !this.wasInWater && this.audio && typeof this.audio.playSplash === 'function' && !this.isFlying) {
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

            // Dynamic FOV interpolation (Sprint & Fly FOV boost)
            const hSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
            let fovBoost = 0;
            if (this.isFlying) fovBoost += 6;
            if (this.isSprinting && hSpeed > 1.0) fovBoost += 8;
            this.currentFov += ((this.baseFov + fovBoost) - this.currentFov) * Math.min(1.0, delta * 10);
            if (this.camera && typeof this.camera.updateProjectionMatrix === 'function') {
                if (this.camera.fov === undefined || Math.abs(this.camera.fov - this.currentFov) > 0.05) {
                    this.camera.fov = this.currentFov;
                    this.camera.updateProjectionMatrix();
                }
            }

            // Ladder climbing check
            const onLadder = Boolean(this.world && typeof this.world.isClimbable === 'function' && (
                this.world.isClimbable(this.position.x, this.position.y + 0.15, this.position.z) ||
                this.world.isClimbable(this.position.x, this.position.y + 1.0, this.position.z)
            ));
            this.onLadder = onLadder;

            // Vertical movement
            if (this.isFlying) {
                let targetVy = 0;
                if (this.keys['Space']) targetVy += moveSpeed;
                if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) targetVy -= moveSpeed;
                this.velocity.y += (targetVy - this.velocity.y) * Math.min(1.0, 15.0 * delta);
            } else if (onLadder) {
                this.fallDistance = 0;
                if (this.keys['Space'] || this.keys['KeyW']) {
                    this.velocity.y = 4.2;
                } else if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
                    this.velocity.y = 0;
                } else {
                    this.velocity.y = Math.max(this.velocity.y - 12.0 * delta, -2.2);
                }
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
                    if (this.audio && typeof this.audio.playJump === 'function') this.audio.playJump();
                }
            }

            // Physics step with collision
            const displacement = {
                x: this.velocity.x * delta,
                y: this.velocity.y * delta,
                z: this.velocity.z * delta
            };

            // Fall distance tracking
            if (!this.onGround && !this.isFlying && !inWater && !onLadder) {
                if (this.velocity.y < 0) {
                    this.fallDistance += Math.abs(displacement.y);
                }
            } else {
                this.fallDistance = 0;
            }

            const wasGroundedBefore = this.onGround;

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

                // Check landing for fall damage
                if (!wasGroundedBefore && this.onGround && !this.isFlying && !inWater && !onLadder && this.gameMode !== 'creative') {
                    if (this.fallDistance > 3.0) {
                        const damage = Math.floor(this.fallDistance - 3.0);
                        if (damage > 0) {
                            this.takeDamage(damage);
                        }
                    }
                    this.fallDistance = 0;
                }

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

            // Contact damage check (e.g. Cactus hazard)
            if (!this.isFlying && this.gameMode !== 'creative' && this.contactDamageCooldown <= 0 && this.world) {
                const halfW = this.width / 2 + 0.05;
                const minBx = Math.floor(this.position.x - halfW);
                const maxBx = Math.floor(this.position.x + halfW);
                const minBz = Math.floor(this.position.z - halfW);
                const maxBz = Math.floor(this.position.z + halfW);
                const y0 = Math.floor(this.position.y);
                const y1 = Math.floor(this.position.y + 0.9);
                const yLevels = (y0 === y1) ? [y0] : [y0, y1];

                const B = Blocks || (g && g.Blocks);
                let contactedHazard = false;
                let hazardDamage = 1;

                for (let bx = minBx; bx <= maxBx && !contactedHazard; bx++) {
                    for (let bz = minBz; bz <= maxBz && !contactedHazard; bz++) {
                        for (const by of yLevels) {
                            const bId = this.world.getBlock(bx, by, bz);
                            if (bId) {
                                const bDef = B && B.BLOCK_DEFS && B.BLOCK_DEFS[bId];
                                if ((bDef && bDef.damageOnContact) || bId === 23) {
                                    contactedHazard = true;
                                    hazardDamage = (bDef && typeof bDef.contactDamage === 'number') ? bDef.contactDamage : 1;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (contactedHazard) {
                    this.takeDamage(hazardDamage);
                    this.contactDamageCooldown = 0.6;
                }
            }

            // Underwater oxygen and drowning
            const headY = this.position.y + this.currentEyeHeight;
            const headInWater = Boolean(this.world && (
                typeof this.world.isWater === 'function' ?
                    this.world.isWater(this.position.x, headY, this.position.z) :
                    (typeof this.world.getBlock === 'function' && this.world.getBlock(Math.floor(this.position.x), Math.floor(headY), Math.floor(this.position.z)) === 11)
            ));

            if (headInWater && !this.isFlying && this.gameMode !== 'creative') {
                this.oxygen = Math.max(0, this.oxygen - delta);
                if (this.oxygen <= 0) {
                    this.drownTimer += delta;
                    if (this.drownTimer >= 1.0) {
                        this.drownTimer -= 1.0;
                        if (this.gameMode !== 'peaceful') {
                            this.takeDamage(2);
                        }
                    }
                }
            } else {
                this.oxygen = Math.min(this.maxOxygen, this.oxygen + delta * 5.0);
                this.drownTimer = 0;
            }

            const UI = (g && g.UI) || (typeof window !== 'undefined' ? window.UI : null);
            if (UI && typeof UI.updateOxygen === 'function') {
                UI.updateOxygen(this.oxygen, this.maxOxygen);
            }

            // Health regeneration
            this.timeSinceLastDamage += delta;
            if (this.health > 0 && this.health < this.maxHealth) {
                const delayReq = (this.gameMode === 'peaceful') ? 1.5 : 4.0;
                const intervalReq = (this.gameMode === 'peaceful') ? 1.0 : 2.5;
                if (this.timeSinceLastDamage >= delayReq) {
                    this.regenTimer += delta;
                    if (this.regenTimer >= intervalReq) {
                        this.regenTimer = 0;
                        this.health = Math.min(this.maxHealth, this.health + 1);
                        if (UI && typeof UI.updateHealth === 'function') {
                            UI.updateHealth(this.health);
                        }
                    }
                }
            }

            // Void recovery
            if (this.position.y < -10) {
                const targetX = (this.spawnPoint && typeof this.spawnPoint.x === 'number') ? this.spawnPoint.x : 8.5;
                const targetZ = (this.spawnPoint && typeof this.spawnPoint.z === 'number') ? this.spawnPoint.z : 8.5;
                const spawn = this.getSafeSpawnPosition(targetX, targetZ);
                this.position.x = spawn.x;
                this.position.y = spawn.y;
                this.position.z = spawn.z;
                this.velocity.x = 0;
                this.velocity.y = 0;
                this.velocity.z = 0;
                this.fallDistance = 0;
                this.onGround = true;
                if (UI && typeof UI.showToast === 'function') {
                    UI.showToast('Respawned above surface!');
                }
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
                    if (this.audio && typeof this.audio.playStep === 'function' && this.world) {
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

            // Screen shake offset calculation
            let shakeX = 0, shakeY = 0, shakeRoll = 0;
            if (this.shakeTimer > 0) {
                this.shakeTimer = Math.max(0, this.shakeTimer - delta);
                const s = this.shakeIntensity * (this.shakeTimer / 0.25);
                shakeX = (Math.random() - 0.5) * s;
                shakeY = (Math.random() - 0.5) * s;
                shakeRoll = (Math.random() - 0.5) * s * 0.25;
                if (this.shakeTimer <= 0) {
                    this.shakeIntensity = 0;
                }
            }

            // Eye position calculation
            const eyeX = this.position.x;
            const eyeY = this.position.y + this.currentEyeHeight + bobY;
            const eyeZ = this.position.z;
            this.eyePosition = { x: eyeX, y: eyeY, z: eyeZ };

            // Sync camera position and rotation
            if (this.camera && this.camera.position) {
                if (this.cameraMode === 0) {
                    this.camera.position.x = eyeX + shakeX;
                    this.camera.position.y = eyeY + shakeY;
                    this.camera.position.z = eyeZ;

                    if (this.camera.rotation) {
                        this.camera.rotation.order = 'YXZ';
                        this.camera.rotation.x = this.pitch;
                        this.camera.rotation.y = this.yaw;
                        this.camera.rotation.z = shakeRoll;
                    }
                } else {
                    const lookDir = this.getLookDirection();
                    const dirSign = (this.cameraMode === 1) ? -1 : 1;
                    let dist = 3.6;

                    if (Phys && typeof Phys.raycastVoxel === 'function' && this.world) {
                        const camRayDir = {
                            x: lookDir.x * dirSign,
                            y: lookDir.y * dirSign,
                            z: lookDir.z * dirSign
                        };
                        const hit = Phys.raycastVoxel(
                            { x: eyeX, y: eyeY, z: eyeZ },
                            camRayDir,
                            3.6,
                            (x, y, z) => this.world.isSolid(x, y, z)
                        );
                        if (hit && hit.hit) {
                            dist = Math.max(0.4, hit.distance - 0.3);
                        }
                    }

                    this.camera.position.x = eyeX + lookDir.x * dirSign * dist + shakeX;
                    this.camera.position.y = eyeY + lookDir.y * dirSign * dist + shakeY;
                    this.camera.position.z = eyeZ + lookDir.z * dirSign * dist;

                    if (this.camera.rotation) {
                        this.camera.rotation.order = 'YXZ';
                        if (this.cameraMode === 1) {
                            this.camera.rotation.x = this.pitch;
                            this.camera.rotation.y = this.yaw;
                            this.camera.rotation.z = shakeRoll;
                        } else {
                            this.camera.rotation.x = -this.pitch;
                            this.camera.rotation.y = this.yaw + Math.PI;
                            this.camera.rotation.z = shakeRoll;
                        }
                    }
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

            let eyePos;
            if (this.cameraMode === 0) {
                eyePos = {
                    x: (this.camera && this.camera.position && this.camera.position.x !== undefined) ? this.camera.position.x : this.position.x,
                    y: (this.camera && this.camera.position && this.camera.position.y !== undefined) ? this.camera.position.y : (this.position.y + this.currentEyeHeight),
                    z: (this.camera && this.camera.position && this.camera.position.z !== undefined) ? this.camera.position.z : this.position.z
                };
            } else {
                eyePos = this.eyePosition || {
                    x: this.position.x,
                    y: this.position.y + this.currentEyeHeight,
                    z: this.position.z
                };
            }
            const lookDir = this.getLookDirection();

            this.targetBlock = Phys.raycastVoxel(
                eyePos,
                lookDir,
                this.reachDistance,
                (x, y, z) => (typeof this.world.isTargetable === 'function' ? this.world.isTargetable(x, y, z) : this.world.isSolid(x, y, z))
            );
        }

        /**
         * Pick block under crosshair and set into active hotbar slot (or switch to it)
         */
        pickBlock() {
            if (!this.targetBlock || !this.targetBlock.hit || !this.world) return false;

            const pos = this.targetBlock.blockPos;
            const blockId = this.world.getBlock(pos.x, pos.y, pos.z);

            // Ignore AIR (0), WATER (11), and BEDROCK (14)
            if (blockId === 0 || blockId === 11 || blockId === 14) return false;

            const UI = (g && g.UI) || (typeof window !== 'undefined' ? window.UI : null);
            if (UI) {
                if (Array.isArray(UI.hotbarBlocks)) {
                    const existingIdx = UI.hotbarBlocks.indexOf(blockId);
                    if (existingIdx >= 0) {
                        this.selectedSlot = existingIdx;
                        if (typeof UI.updateActiveSlot === 'function') {
                            UI.updateActiveSlot(this.selectedSlot);
                        }
                        return true;
                    }
                }
                if (typeof UI.setHotbarBlock === 'function') {
                    UI.setHotbarBlock(this.selectedSlot, blockId);
                    return true;
                }
            }
            return true;
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

        takeDamage(amount) {
            if (this.isFlying || this.gameMode === 'creative') return;
            this.timeSinceLastDamage = 0;
            this.regenTimer = 0;
            this.health = Math.max(0, this.health - amount);
            this.addScreenShake(0.18, 0.25);
            if (this.audio && typeof this.audio.playHurt === 'function') {
                this.audio.playHurt();
            }
            const UI = (g && g.UI) || (typeof window !== 'undefined' ? window.UI : null);
            if (UI) {
                if (typeof UI.updateHealth === 'function') {
                    UI.updateHealth(this.health);
                }
                if (typeof UI.triggerDamageFlash === 'function') {
                    UI.triggerDamageFlash();
                }
            }
            if (this.health <= 0) {
                this.die();
            }
        }

        die() {
            const UI = (g && g.UI) || (typeof window !== 'undefined' ? window.UI : null);
            if (UI && typeof UI.showToast === 'function') {
                UI.showToast('You died! Respawning...');
            }
            this.respawn();
        }

        getSafeSpawnPosition(spawnX = 8.5, spawnZ = 8.5) {
            let groundY = 25;
            if (this.world) {
                if (typeof this.world.getOrCreateChunk === 'function') {
                    const cx = Math.floor(spawnX / 16);
                    const cz = Math.floor(spawnZ / 16);
                    this.world.getOrCreateChunk(cx, cz);
                }
                const maxHeight = (typeof window !== 'undefined' && window.World && window.World.CHUNK_HEIGHT) ? window.World.CHUNK_HEIGHT : 64;
                for (let y = maxHeight - 1; y >= 0; y--) {
                    if (this.world.isSolid(Math.floor(spawnX), y, Math.floor(spawnZ))) {
                        groundY = y + 1;
                        break;
                    }
                }
            }
            return { x: spawnX, y: groundY + 0.1, z: spawnZ };
        }

        respawn() {
            this.health = this.maxHealth;
            this.oxygen = this.maxOxygen;
            this.drownTimer = 0;
            this.timeSinceLastDamage = 0;
            this.regenTimer = 0;
            const targetX = (this.spawnPoint && typeof this.spawnPoint.x === 'number') ? this.spawnPoint.x : 8.5;
            const targetZ = (this.spawnPoint && typeof this.spawnPoint.z === 'number') ? this.spawnPoint.z : 8.5;
            const spawn = this.getSafeSpawnPosition(targetX, targetZ);
            if (
                this.spawnPoint &&
                typeof this.spawnPoint.y === 'number' &&
                (!this.world || !this.world.isSolid(Math.floor(targetX), Math.floor(this.spawnPoint.y), Math.floor(targetZ)))
            ) {
                spawn.y = this.spawnPoint.y;
            }
            this.position.x = spawn.x;
            this.position.y = spawn.y;
            this.position.z = spawn.z;
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.velocity.z = 0;
            this.fallDistance = 0;
            this.onGround = true;
            const UI = (g && g.UI) || (typeof window !== 'undefined' ? window.UI : null);
            if (UI && typeof UI.updateHealth === 'function') {
                UI.updateHealth(this.health);
            }
            if (UI && typeof UI.updateOxygen === 'function') {
                UI.updateOxygen(this.oxygen, this.maxOxygen);
            }
        }
    }

    return PlayerController;
}));
