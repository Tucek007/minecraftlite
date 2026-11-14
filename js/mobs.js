/**
 * mobs.js - Hostile and Passive Mobs (Pig, Sheep, Zombie, Creeper) for Minecraft Lite.
 * AI, collision physics, health, limb animation, and spawning system.
 * Universal Module Definition (UMD) compatible with Browser and Node.js.
 */
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory(require('./physics'), require('./blocks'));
    } else {
        root.Mobs = factory(root.Physics, root.Blocks);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (PhysicsModule, BlocksModule) {
    'use strict';

    const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
    const Physics = PhysicsModule || (g && g.Physics) || (typeof require !== 'undefined' ? require('./physics') : null);
    const Blocks = BlocksModule || (g && g.Blocks) || (typeof require !== 'undefined' ? require('./blocks') : null);

    const MOB_TYPES = {
        pig: {
            type: 'pig',
            name: 'Pig',
            hostile: false,
            maxHealth: 10,
            width: 0.7,
            height: 0.9,
            speed: 1.8,
            dropBlockId: 2, // Dirt / item drop
            color: 0xf0a5a0
        },
        sheep: {
            type: 'sheep',
            name: 'Sheep',
            hostile: false,
            maxHealth: 10,
            width: 0.7,
            height: 1.0,
            speed: 1.7,
            dropBlockId: 20, // Snow / Wool block
            color: 0xeeeeee
        },
        zombie: {
            type: 'zombie',
            name: 'Zombie',
            hostile: true,
            maxHealth: 20,
            width: 0.6,
            height: 1.8,
            speed: 2.6,
            attackDamage: 2,
            dropBlockId: 22, // Mossy cobblestone / rotten flesh
            color: 0x4b7f42
        },
        creeper: {
            type: 'creeper',
            name: 'Creeper',
            hostile: true,
            maxHealth: 20,
            width: 0.6,
            height: 1.7,
            speed: 2.5,
            explosive: true,
            fuseTime: 1.5,
            dropBlockId: 15, // TNT
            color: 0x389c38
        },
        villager: {
            type: 'villager',
            name: 'Vesničan',
            hostile: false,
            maxHealth: 20,
            width: 0.6,
            height: 1.8,
            speed: 2.0,
            dropBlockId: 39, // Emerald
            color: 0x8b5a2b
        },
        iron_golem: {
            type: 'iron_golem',
            name: 'Iron Golem',
            hostile: false,
            defender: true,
            maxHealth: 50,
            width: 0.9,
            height: 2.4,
            speed: 2.4,
            attackDamage: 12,
            dropBlockId: 13, // Iron Ore
            color: 0xd8d8d2
        },
        skeleton: {
            type: 'skeleton',
            name: 'Skeleton',
            hostile: true,
            maxHealth: 20,
            width: 0.6,
            height: 1.8,
            speed: 2.3,
            attackDamage: 3,
            ranged: true,
            dropBlockId: 51, // Bow
            color: 0xd5d5ce
        },
        enderman: {
            type: 'enderman',
            name: 'Enderman',
            hostile: true,
            maxHealth: 30,
            width: 0.6,
            height: 2.6,
            speed: 3.4,
            attackDamage: 5,
            teleports: true,
            dropBlockId: 39, // Emerald
            color: 0x16161d
        }
    };

    const VILLAGER_PROFESSIONS = {
        farmer: {
            id: 'farmer',
            title: 'Farmář',
            robeColor: 0x7c532e,
            accentColor: 0xd9b856,
            trades: [
                { name: '4x Obilí → 1x Smaragd', costId: 45, costCount: 4, giveId: 39, giveCount: 1, xp: 4, minLevel: 1 },
                { name: '1x Smaragd → 3x Chléb', costId: 39, costCount: 1, giveId: 49, giveCount: 3, xp: 4, minLevel: 1 },
                { name: '5x Smaragd → 1x Zlaté jablko', costId: 39, costCount: 5, giveId: 50, giveCount: 1, xp: 8, minLevel: 2 }
            ]
        },
        librarian: {
            id: 'librarian',
            title: 'Knihovník',
            robeColor: 0xe6e0d4,
            accentColor: 0xa82828,
            trades: [
                { name: '2x Smaragd → 2x Knihovna', costId: 39, costCount: 2, giveId: 26, giveCount: 2, xp: 5, minLevel: 1 },
                { name: '1x Smaragd → 4x Lucerna', costId: 39, costCount: 1, giveId: 47, giveCount: 4, xp: 5, minLevel: 1 },
                { name: '8x Smaragd → 1x Očarovávací stůl', costId: 39, costCount: 8, giveId: 42, giveCount: 1, xp: 12, minLevel: 2 }
            ]
        },
        blacksmith: {
            id: 'blacksmith',
            title: 'Kovář',
            robeColor: 0x3b3d42,
            accentColor: 0x767a82,
            trades: [
                { name: '4x Železná ruda → 1x Smaragd', costId: 13, costCount: 4, giveId: 39, giveCount: 1, xp: 5, minLevel: 1 },
                { name: '2x Smaragd → 1x Luk', costId: 39, costCount: 2, giveId: 51, giveCount: 1, xp: 6, minLevel: 1 },
                { name: '4x Smaragd → 1x Diamantový krumpáč', costId: 39, costCount: 4, giveId: 37, giveCount: 1, xp: 10, minLevel: 2 },
                { name: '5x Smaragd → 1x Diamantový meč', costId: 39, costCount: 5, giveId: 38, giveCount: 1, xp: 12, minLevel: 3 }
            ]
        },
        cleric: {
            id: 'cleric',
            title: 'Alchymista',
            robeColor: 0x6b2c91,
            accentColor: 0xd46ae8,
            trades: [
                { name: '3x Zlatá ruda → 2x Smaragd', costId: 14, costCount: 3, giveId: 39, giveCount: 2, xp: 6, minLevel: 1 },
                { name: '2x Smaragd → 3x Svítivec (Glowstone)', costId: 39, costCount: 2, giveId: 25, giveCount: 3, xp: 6, minLevel: 1 },
                { name: '6x Smaragd → 1x Zlaté jablko', costId: 39, costCount: 6, giveId: 50, giveCount: 1, xp: 10, minLevel: 2 }
            ]
        }
    };

    const PROFESSION_KEYS = Object.keys(VILLAGER_PROFESSIONS);

    class Mob {
        constructor(type, x, y, z, id = 1, options = {}) {
            this.id = id;
            this.type = type;
            this.def = MOB_TYPES[type] || MOB_TYPES.pig;

            this.position = { x, y, z };
            this.velocity = { x: 0, y: 0, z: 0 };
            this.yaw = 0;

            this.health = this.def.maxHealth;
            this.maxHealth = this.def.maxHealth;
            this.hostile = this.def.hostile;
            this.width = this.def.width;
            this.height = this.def.height;
            this.speed = this.def.speed;

            this.onGround = false;
            this.hurtTimer = 0;
            this.attackCooldown = 0;
            this.walkCycle = 0;
            this.aiTimer = 0;
            this.moveDir = { x: 0, z: 0 };
            this.panicTimer = 0;
            this.fuseTimer = 0;
            this.isIgnited = false;
            this.dead = false;
            this.homePos = { x, y, z };

            // Specialized mob properties
            this.shootTimer = 1.6;
            this.teleportCooldown = 0;

            if (this.type === 'villager') {
                const profKey = options.profession && VILLAGER_PROFESSIONS[options.profession]
                    ? options.profession
                    : PROFESSION_KEYS[Math.abs(id | 0) % PROFESSION_KEYS.length];
                this.profession = profKey;
                this.professionDef = VILLAGER_PROFESSIONS[profKey];
                this.tradeLevel = 1;
                this.tradeXP = 0;
                this.trades = this.professionDef.trades.map(t => ({ ...t }));
                this.villagerName = `${this.professionDef.title} #${id}`;
            }

            this.mesh = null;
        }

        getAABB() {
            const Phys = Physics || (g && g.Physics) || (typeof require !== 'undefined' ? require('./physics') : null);
            const halfW = this.width / 2;
            if (Phys && typeof Phys.AABB === 'function') {
                return new Phys.AABB(
                    this.position.x - halfW,
                    this.position.y,
                    this.position.z - halfW,
                    this.position.x + halfW,
                    this.position.y + this.height,
                    this.position.z + halfW
                );
            }
            return {
                minX: this.position.x - halfW,
                minY: this.position.y,
                minZ: this.position.z - halfW,
                maxX: this.position.x + halfW,
                maxY: this.position.y + this.height,
                maxZ: this.position.z + halfW
            };
        }

        update(dt, world, player, dayTime = 0.5, callbacks = {}) {
            const delta = Math.min(0.1, dt);

            if (this.hurtTimer > 0) this.hurtTimer -= delta;
            if (this.attackCooldown > 0) this.attackCooldown -= delta;
            if (this.panicTimer > 0) this.panicTimer -= delta;
            if (this.teleportCooldown > 0) this.teleportCooldown -= delta;

            // In peaceful mode, immediately despawn hostile mobs
            if (this.hostile && player && player.gameMode === 'peaceful') {
                this.dead = true;
                return;
            }

            // AI Decision logic
            if (this.type === 'iron_golem') {
                const hostiles = (callbacks && typeof callbacks.getHostileMobs === 'function')
                    ? callbacks.getHostileMobs()
                    : [];
                let target = null;
                let bestDist = 16.0;
                for (let i = 0; i < hostiles.length; i++) {
                    const h = hostiles[i];
                    if (!h || h.dead) continue;
                    const d = Math.hypot(h.position.x - this.position.x, h.position.z - this.position.z);
                    if (d < bestDist) {
                        bestDist = d;
                        target = h;
                    }
                }
                if (target && bestDist > 0.05) {
                    const dx = target.position.x - this.position.x;
                    const dz = target.position.z - this.position.z;
                    this.moveDir = { x: dx / bestDist, z: dz / bestDist };
                    this.yaw = Math.atan2(-this.moveDir.x, -this.moveDir.z);
                    if (bestDist < 2.0 && this.attackCooldown <= 0) {
                        this.attackCooldown = 1.1;
                        target.health -= (this.def.attackDamage || 12);
                        target.hurtTimer = 0.4;
                        target.velocity.y = 10.5;
                        target.onGround = false;
                        if (target.health <= 0) target.dead = true;
                    }
                } else {
                    // Patrol near village home
                    const hdx = this.homePos.x - this.position.x;
                    const hdz = this.homePos.z - this.position.z;
                    const hDist = Math.hypot(hdx, hdz);
                    if (hDist > 14.0) {
                        this.moveDir = { x: hdx / hDist, z: hdz / hDist };
                        this.yaw = Math.atan2(-this.moveDir.x, -this.moveDir.z);
                    } else {
                        this.aiTimer -= delta;
                        if (this.aiTimer <= 0) {
                            this.aiTimer = 2.0 + Math.random() * 2.5;
                            if (Math.random() < 0.55) {
                                const a = Math.random() * Math.PI * 2;
                                this.moveDir = { x: -Math.sin(a), z: -Math.cos(a) };
                                this.yaw = a;
                            } else {
                                this.moveDir = { x: 0, z: 0 };
                            }
                        }
                    }
                }
            } else if (this.type === 'villager') {
                const hostiles = (callbacks && typeof callbacks.getHostileMobs === 'function')
                    ? callbacks.getHostileMobs()
                    : [];
                let nearestDanger = null;
                let dangerDist = 8.0;
                for (let i = 0; i < hostiles.length; i++) {
                    const h = hostiles[i];
                    if (!h || h.dead) continue;
                    const d = Math.hypot(h.position.x - this.position.x, h.position.z - this.position.z);
                    if (d < dangerDist) {
                        dangerDist = d;
                        nearestDanger = h;
                    }
                }

                if (nearestDanger && dangerDist > 0.05) {
                    // Flee away from zombies/skeletons
                    this.panicTimer = 1.4;
                    this.moveDir = {
                        x: (this.position.x - nearestDanger.position.x) / dangerDist,
                        z: (this.position.z - nearestDanger.position.z) / dangerDist
                    };
                    this.yaw = Math.atan2(-this.moveDir.x, -this.moveDir.z);
                } else if (player && Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) < 4.2) {
                    // Greet & face player when close
                    const pdx = player.position.x - this.position.x;
                    const pdz = player.position.z - this.position.z;
                    const pdist = Math.hypot(pdx, pdz);
                    this.moveDir = { x: 0, z: 0 };
                    if (pdist > 0.1) {
                        this.yaw = Math.atan2(-(pdx / pdist), -(pdz / pdist));
                    }
                } else {
                    const hdx = this.homePos.x - this.position.x;
                    const hdz = this.homePos.z - this.position.z;
                    const hDist = Math.hypot(hdx, hdz);
                    if (hDist > 12.0) {
                        this.moveDir = { x: hdx / hDist, z: hdz / hDist };
                        this.yaw = Math.atan2(-this.moveDir.x, -this.moveDir.z);
                    } else {
                        this.aiTimer -= delta;
                        if (this.aiTimer <= 0) {
                            this.aiTimer = 1.8 + Math.random() * 2.5;
                            if (Math.random() < 0.55) {
                                const a = Math.random() * Math.PI * 2;
                                this.moveDir = { x: -Math.sin(a), z: -Math.cos(a) };
                                this.yaw = a;
                            } else {
                                this.moveDir = { x: 0, z: 0 };
                            }
                        }
                    }
                }
            } else if (this.hostile && player && player.gameMode === 'survival' && !player.isFlying) {
                const dx = player.position.x - this.position.x;
                const dz = player.position.z - this.position.z;
                const dist = Math.hypot(dx, dz);

                if (this.type === 'enderman' && this.hurtTimer > 0 && this.teleportCooldown <= 0) {
                    this.teleportCooldown = 2.5;
                    const prevPos = { ...this.position };
                    for (let attempt = 0; attempt < 6; attempt++) {
                        const ang = Math.random() * Math.PI * 2;
                        const rad = 3.5 + Math.random() * 3.0;
                        const tx = this.position.x + Math.cos(ang) * rad;
                        const tz = this.position.z + Math.sin(ang) * rad;
                        const ty = Math.floor(this.position.y);
                        if (!world || typeof world.isSolid !== 'function' ||
                            (!world.isSolid(tx, ty, tz) && !world.isSolid(tx, ty + 1, tz) && !world.isSolid(tx, ty + 2, tz))) {
                            this.position.x = tx;
                            this.position.z = tz;
                            break;
                        }
                    }
                    if (callbacks && typeof callbacks.onEndermanTeleport === 'function') {
                        callbacks.onEndermanTeleport(this, prevPos);
                    }
                }

                if (this.type === 'creeper') {
                    if (dist < 2.8) {
                        this.isIgnited = true;
                    }

                    if (this.isIgnited) {
                        if (dist < 3.8) {
                            this.fuseTimer += delta;
                            this.moveDir = { x: 0, z: 0 };
                        } else {
                            this.fuseTimer = Math.max(0, this.fuseTimer - delta);
                            if (this.fuseTimer === 0) {
                                this.isIgnited = false;
                            }
                        }

                        if (this.fuseTimer >= (this.def.fuseTime || 1.5)) {
                            this.dead = true;
                            if (callbacks && typeof callbacks.onCreeperExplode === 'function') {
                                callbacks.onCreeperExplode(this);
                            }
                            return;
                        }
                    }
                }

                if (this.type === 'skeleton') {
                    if (dist < 16.0 && dist > 0.05) {
                        const dirX = dx / dist;
                        const dirZ = dz / dist;
                        this.yaw = Math.atan2(-dirX, -dirZ);
                        if (dist > 10.5) {
                            this.moveDir = { x: dirX, z: dirZ };
                        } else if (dist < 5.5) {
                            this.moveDir = { x: -dirX, z: -dirZ };
                        } else {
                            this.moveDir = { x: 0, z: 0 };
                        }
                        this.shootTimer -= delta;
                        if (this.shootTimer <= 0) {
                            this.shootTimer = 2.2;
                            if (callbacks && typeof callbacks.onSkeletonShoot === 'function') {
                                callbacks.onSkeletonShoot(this, player);
                            }
                        }
                    } else {
                        this.moveDir = { x: 0, z: 0 };
                    }
                } else if (!this.isIgnited && dist < 15.0 && dist > 0.05) {
                    this.moveDir = { x: dx / dist, z: dz / dist };
                    this.yaw = Math.atan2(-this.moveDir.x, -this.moveDir.z);

                    if ((this.type === 'zombie' || this.type === 'enderman') && dist < 1.35 && this.attackCooldown <= 0) {
                        this.attackCooldown = 1.0;
                        if (typeof player.takeDamage === 'function') {
                            player.takeDamage(this.def.attackDamage || 2);
                        }
                    }
                } else if (!this.isIgnited) {
                    // Out of range hostile wanders casually
                    this.aiTimer -= delta;
                    if (this.aiTimer <= 0) {
                        this.aiTimer = 1.5 + Math.random() * 2.5;
                        if (Math.random() < 0.45) {
                            const a = Math.random() * Math.PI * 2;
                            this.moveDir = { x: -Math.sin(a), z: -Math.cos(a) };
                            this.yaw = a;
                        } else {
                            this.moveDir = { x: 0, z: 0 };
                        }
                    }
                }
            } else {
                // Passive mob or non-hunting hostile
                this.aiTimer -= delta;
                if (this.aiTimer <= 0) {
                    this.aiTimer = 1.5 + Math.random() * 2.5;
                    if (this.panicTimer > 0 || Math.random() < 0.65) {
                        const a = Math.random() * Math.PI * 2;
                        this.moveDir = { x: -Math.sin(a), z: -Math.cos(a) };
                        this.yaw = a;
                    } else {
                        this.moveDir = { x: 0, z: 0 };
                    }
                }
            }

            // Movement & Physics
            const spd = (this.panicTimer > 0) ? this.speed * 1.75 : this.speed;
            this.velocity.x = this.moveDir.x * spd;
            this.velocity.z = this.moveDir.z * spd;

            this.velocity.y -= 28.0 * delta;
            if (this.velocity.y < -40) this.velocity.y = -40;

            const prevX = this.position.x;
            const prevZ = this.position.z;

            const Phys = Physics || (g && g.Physics) || (typeof require !== 'undefined' ? require('./physics') : null);
            if (Phys && world && typeof Phys.moveWithCollision === 'function') {
                const res = Phys.moveWithCollision(
                    this.position,
                    { x: this.velocity.x * delta, y: this.velocity.y * delta, z: this.velocity.z * delta },
                    this.width,
                    this.height,
                    (x, y, z) => world.isSolid(x, y, z),
                    false,
                    this.onGround
                );
                this.onGround = res.onGround;
                if (this.onGround && this.velocity.y < 0) {
                    this.velocity.y = 0;
                }
            } else {
                this.position.x += this.velocity.x * delta;
                this.position.y += this.velocity.y * delta;
                this.position.z += this.velocity.z * delta;
            }

            // Auto-jump over 1-block obstacles when walking into a wall
            if (this.onGround && (Math.abs(this.moveDir.x) > 0.01 || Math.abs(this.moveDir.z) > 0.01)) {
                const movedDist = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
                const wantedDist = Math.hypot(this.velocity.x * delta, this.velocity.z * delta);
                if (wantedDist > 0.001 && movedDist < wantedDist * 0.4) {
                    this.velocity.y = 8.0;
                    this.onGround = false;
                }
            }

            // Accumulate walk cycle for limb animation
            this.walkCycle += Math.hypot(this.position.x - prevX, this.position.z - prevZ) * 6.0;
        }
    }

    class MobManager {
        constructor(world, scene = null, THREE = null, audio = null) {
            this.world = world;
            this.scene = scene;
            this.THREE = THREE || (typeof window !== 'undefined' ? window.THREE : null);
            this.audio = audio;
            this.mobs = [];
            this.nextId = 1;
            this.spawnTimer = 0;
        }

        spawnMob(type, x, y, z, options = {}) {
            const mob = new Mob(type, x, y, z, this.nextId++, options);
            if (this.THREE && this.scene) {
                this.createMobMesh(mob);
            }
            this.mobs.push(mob);
            return mob;
        }

        removeMob(mob) {
            if (!mob) return;
            if (mob.mesh) {
                if (this.scene && typeof this.scene.remove === 'function') {
                    this.scene.remove(mob.mesh);
                }
                if (typeof mob.mesh.traverse === 'function') {
                    mob.mesh.traverse((child) => {
                        if (child.geometry && typeof child.geometry.dispose === 'function') {
                            child.geometry.dispose();
                        }
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach((m) => m && typeof m.dispose === 'function' && m.dispose());
                            } else if (typeof child.material.dispose === 'function') {
                                child.material.dispose();
                            }
                        }
                    });
                }
                mob.mesh = null;
            }
            const idx = this.mobs.indexOf(mob);
            if (idx !== -1) {
                this.mobs.splice(idx, 1);
            }
        }

        clear() {
            while (this.mobs.length > 0) {
                this.removeMob(this.mobs[this.mobs.length - 1]);
            }
        }

        raycastMob(origin, direction, maxDist = 4.0) {
            let closestMob = null;
            let closestDist = maxDist;

            const ox = origin.x, oy = origin.y, oz = origin.z;
            const dx = direction.x, dy = direction.y, dz = direction.z;

            for (let i = 0; i < this.mobs.length; i++) {
                const mob = this.mobs[i];
                if (mob.dead) continue;

                const aabb = mob.getAABB();

                let tmin = 0;
                let tmax = closestDist;

                // X slab
                if (Math.abs(dx) < 1e-8) {
                    if (ox < aabb.minX || ox > aabb.maxX) continue;
                } else {
                    const invD = 1.0 / dx;
                    let t1 = (aabb.minX - ox) * invD;
                    let t2 = (aabb.maxX - ox) * invD;
                    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                    tmin = Math.max(tmin, t1);
                    tmax = Math.min(tmax, t2);
                    if (tmin > tmax) continue;
                }

                // Y slab
                if (Math.abs(dy) < 1e-8) {
                    if (oy < aabb.minY || oy > aabb.maxY) continue;
                } else {
                    const invD = 1.0 / dy;
                    let t1 = (aabb.minY - oy) * invD;
                    let t2 = (aabb.maxY - oy) * invD;
                    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                    tmin = Math.max(tmin, t1);
                    tmax = Math.min(tmax, t2);
                    if (tmin > tmax) continue;
                }

                // Z slab
                if (Math.abs(dz) < 1e-8) {
                    if (oz < aabb.minZ || oz > aabb.maxZ) continue;
                } else {
                    const invD = 1.0 / dz;
                    let t1 = (aabb.minZ - oz) * invD;
                    let t2 = (aabb.maxZ - oz) * invD;
                    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                    tmin = Math.max(tmin, t1);
                    tmax = Math.min(tmax, t2);
                    if (tmin > tmax) continue;
                }

                if (tmin < closestDist) {
                    closestDist = tmin;
                    closestMob = mob;
                }
            }

            if (closestMob) {
                return { hit: true, mob: closestMob, distance: closestDist };
            }
            return { hit: false };
        }

        hitMob(mob, damage, attackerPos, callbacks = {}) {
            if (!mob || mob.dead) return;

            mob.health = Math.max(0, mob.health - damage);
            mob.hurtTimer = 0.3;
            mob.panicTimer = 3.5;

            if (attackerPos) {
                const kdx = mob.position.x - attackerPos.x;
                const kdz = mob.position.z - attackerPos.z;
                const kLen = Math.hypot(kdx, kdz) || 1;
                mob.velocity.x = (kdx / kLen) * 6.0;
                mob.velocity.z = (kdz / kLen) * 6.0;
            }
            mob.velocity.y = 5.5;
            mob.onGround = false;

            if (this.audio) {
                if (typeof this.audio.playMobHurt === 'function') {
                    this.audio.playMobHurt(mob.type);
                } else if (typeof this.audio.playHurt === 'function') {
                    this.audio.playHurt();
                }
            }

            if (mob.health <= 0) {
                mob.dead = true;
                if (callbacks && typeof callbacks.onMobKilled === 'function') {
                    callbacks.onMobKilled(mob);
                }
                this.removeMob(mob);
            }
        }

        update(dt, player, dayTime = 0.5, callbacks = {}) {
            // Populate nearby unpopulated procedural villages with 4 villagers & 1 Iron Golem
            if (player && this.world && Array.isArray(this.world.villages)) {
                for (let vi = 0; vi < this.world.villages.length; vi++) {
                    const village = this.world.villages[vi];
                    if (village.populated) continue;
                    const vDistSq = (village.x - player.position.x) ** 2 + (village.z - player.position.z) ** 2;
                    if (vDistSq <= 54 * 54) {
                        village.populated = true;
                        const spawns = [
                            [-1.5, -1.5, 'farmer'],
                            [1.5, -1.5, 'librarian'],
                            [-1.5, 1.5, 'blacksmith'],
                            [1.5, 1.5, 'cleric']
                        ];
                        for (let si = 0; si < spawns.length; si++) {
                            const [ox, oz, prof] = spawns[si];
                            this.spawnMob('villager', village.x + ox, village.y + 0.1, village.z + oz, { profession: prof });
                        }
                        this.spawnMob('iron_golem', village.x + 2.5, village.y + 0.1, village.z + 2.5);
                    }
                }
            }

            // Periodic spawning check
            this.spawnTimer += dt;
            if (this.spawnTimer >= 2.5) {
                this.spawnTimer = 0;

                let passiveCount = 0;
                let hostileCount = 0;
                for (let i = 0; i < this.mobs.length; i++) {
                    const m = this.mobs[i];
                    if (m.hostile) hostileCount++;
                    else if (m.type !== 'villager' && m.type !== 'iron_golem') passiveCount++;
                }

                if (player && this.world) {
                    const isNight = (dayTime < 0.22 || dayTime > 0.78);

                    if (!isNight && passiveCount < 6) {
                        const chosenType = Math.random() < 0.5 ? 'pig' : 'sheep';
                        this.trySpawnAroundPlayer(player, chosenType);
                    } else if (isNight && player.gameMode === 'survival' && hostileCount < 5) {
                        const r = Math.random();
                        const chosenType = r < 0.30 ? 'zombie' : (r < 0.58 ? 'creeper' : (r < 0.85 ? 'skeleton' : 'enderman'));
                        this.trySpawnAroundPlayer(player, chosenType);
                    }
                }
            }

            // Callbacks wrapper (explosions, hostile scan for golems, ranged shots, teleports)
            const mobCallbacks = {
                getHostileMobs: () => this.mobs.filter(m => m.hostile && !m.dead),
                onCreeperExplode: (creeper) => {
                    if (callbacks && typeof callbacks.onCreeperExplode === 'function') {
                        callbacks.onCreeperExplode(creeper);
                    } else {
                        if (this.audio && typeof this.audio.playExplode === 'function') {
                            this.audio.playExplode();
                        }
                        if (player && player.gameMode === 'survival' && typeof player.takeDamage === 'function') {
                            const dist = Math.hypot(
                                creeper.position.x - player.position.x,
                                creeper.position.y - player.position.y,
                                creeper.position.z - player.position.z
                            );
                            if (dist < 4.5) {
                                const dmg = Math.max(1, Math.round((1 - dist / 4.5) * 12));
                                player.takeDamage(dmg);
                            }
                        }
                    }
                },
                ...callbacks
            };

            // Update all active mobs
            for (let i = this.mobs.length - 1; i >= 0; i--) {
                const mob = this.mobs[i];

                if (mob.dead) {
                    this.removeMob(mob);
                    continue;
                }

                if (player) {
                    const maxRange = (mob.type === 'villager' || mob.type === 'iron_golem') ? 72 : 52;
                    const distSq = (mob.position.x - player.position.x) ** 2 + (mob.position.z - player.position.z) ** 2;
                    if (distSq > maxRange * maxRange) {
                        this.removeMob(mob);
                        continue;
                    }
                }

                mob.update(dt, this.world, player, dayTime, mobCallbacks);

                if (mob.dead) {
                    this.removeMob(mob);
                    continue;
                }

                this.updateMobMesh(mob, dt);
            }
        }

        trySpawnAroundPlayer(player, type) {
            if (!this.world || typeof this.world.isSolid !== 'function') return false;

            const angle = Math.random() * Math.PI * 2;
            const dist = 14 + Math.random() * 12;
            const sx = Math.floor(player.position.x + Math.cos(angle) * dist);
            const sz = Math.floor(player.position.z + Math.sin(angle) * dist);

            const startY = Math.min(63, Math.max(1, Math.floor(player.position.y + 8)));
            const minY = Math.max(1, Math.floor(player.position.y - 12));

            for (let y = startY; y >= minY; y--) {
                if (this.world.isSolid(sx, y, sz) &&
                    !this.world.isSolid(sx, y + 1, sz) &&
                    !this.world.isSolid(sx, y + 2, sz)) {

                    const isWater = (typeof this.world.isWater === 'function' && this.world.isWater(sx, y, sz)) ||
                        (typeof this.world.getBlock === 'function' && this.world.getBlock(sx, y, sz) === 11);

                    if (!isWater) {
                        this.spawnMob(type, sx + 0.5, y + 1, sz + 0.5);
                        return true;
                    }
                }
            }
            return false;
        }

        createMobMesh(mob) {
            const THREE = this.THREE;
            if (!THREE || !this.scene) return null;

            const group = new THREE.Group();
            const materialList = [];

            const createMat = (colorHex) => {
                const mat = new THREE.MeshLambertMaterial ?
                    new THREE.MeshLambertMaterial({ color: colorHex }) :
                    new THREE.MeshBasicMaterial({ color: colorHex });
                materialList.push({ mat, origColor: colorHex });
                return mat;
            };

            const type = mob.type;

            if (type === 'pig') {
                const bodyMat = createMat(0xf0a5a0);
                const snoutMat = createMat(0xdf847e);
                const eyeMat = createMat(0x222222);

                // Body
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.8), bodyMat);
                body.position.set(0, 0.45, 0);
                group.add(body);

                // Head
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), bodyMat);
                head.position.set(0, 0.55, -0.48);
                group.add(head);

                // Snout
                const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.1), snoutMat);
                snout.position.set(0, 0.48, -0.7);
                group.add(snout);

                // Eyes
                const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), eyeMat);
                eyeL.position.set(-0.205, 0.6, -0.6);
                group.add(eyeL);
                const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), eyeMat);
                eyeR.position.set(0.205, 0.6, -0.6);
                group.add(eyeR);

                // 4 Legs with hips as pivots
                const makeLegPivot = (px, pz) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 0.35, pz);
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.18), bodyMat);
                    leg.position.set(0, -0.175, 0);
                    pivot.add(leg);
                    group.add(pivot);
                    return pivot;
                };

                group.userData = {
                    legFL: makeLegPivot(-0.2, -0.25),
                    legFR: makeLegPivot(0.2, -0.25),
                    legBL: makeLegPivot(-0.2, 0.25),
                    legBR: makeLegPivot(0.2, 0.25),
                    materialList
                };
            } else if (type === 'sheep') {
                const woolMat = createMat(0xeeeeee);
                const skinMat = createMat(0xd7bfa8);

                // Wool Body
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.55, 0.88), woolMat);
                body.position.set(0, 0.55, 0);
                group.add(body);

                // Head
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat);
                head.position.set(0, 0.65, -0.52);
                group.add(head);

                // Legs
                const makeLegPivot = (px, pz) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 0.45, pz);
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.16), skinMat);
                    leg.position.set(0, -0.225, 0);
                    pivot.add(leg);
                    group.add(pivot);
                    return pivot;
                };

                group.userData = {
                    legFL: makeLegPivot(-0.2, -0.28),
                    legFR: makeLegPivot(0.2, -0.28),
                    legBL: makeLegPivot(-0.2, 0.28),
                    legBR: makeLegPivot(0.2, 0.28),
                    materialList
                };
            } else if (type === 'zombie') {
                const skinMat = createMat(0x4b7f42);
                const shirtMat = createMat(0x26859e);
                const pantsMat = createMat(0x2a3875);

                // Head
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
                head.position.set(0, 1.6, 0);
                group.add(head);

                // Torso
                const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.25), shirtMat);
                torso.position.set(0, 1.05, 0);
                group.add(torso);

                // Arms (classic outstretched zombie pose)
                const makeArmPivot = (px) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 1.3, 0);
                    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), skinMat);
                    arm.position.set(0, -0.3, 0);
                    pivot.add(arm);
                    pivot.rotation.x = -Math.PI / 2; // arms forward
                    group.add(pivot);
                    return pivot;
                };

                // Legs
                const makeLegPivot = (px) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 0.7, 0);
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), pantsMat);
                    leg.position.set(0, -0.35, 0);
                    pivot.add(leg);
                    group.add(pivot);
                    return pivot;
                };

                group.userData = {
                    armL: makeArmPivot(-0.31),
                    armR: makeArmPivot(0.31),
                    legL: makeLegPivot(-0.11),
                    legR: makeLegPivot(0.11),
                    isBiped: true,
                    materialList
                };
            } else if (type === 'creeper') {
                const creeperMat = createMat(0x389c38);
                const eyeMat = createMat(0x111111);

                // Head
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), creeperMat);
                head.position.set(0, 1.45, 0);
                group.add(head);

                // Creeper Face details
                const face = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.02), eyeMat);
                face.position.set(0, 1.42, -0.23);
                group.add(face);

                // Torso
                const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.65, 0.24), creeperMat);
                torso.position.set(0, 0.9, 0);
                group.add(torso);

                // 4 short legs
                const makeLegPivot = (px, pz) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 0.35, pz);
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.18), creeperMat);
                    leg.position.set(0, -0.175, 0);
                    pivot.add(leg);
                    group.add(pivot);
                    return pivot;
                };

                group.userData = {
                    legFL: makeLegPivot(-0.14, -0.14),
                    legFR: makeLegPivot(0.14, -0.14),
                    legBL: makeLegPivot(-0.14, 0.14),
                    legBR: makeLegPivot(0.14, 0.14),
                    materialList
                };
            } else if (type === 'villager') {
                const skinMat = createMat(0xcfa07e);
                const prof = mob.professionDef || VILLAGER_PROFESSIONS.farmer;
                const robeMat = createMat(prof.robeColor);
                const accentMat = createMat(prof.accentColor);
                const eyeMat = createMat(0x1f7a34);

                // Tall villager head
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), skinMat);
                head.position.set(0, 1.65, 0);
                group.add(head);

                // Signature 3D prominent nose
                const nose = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.14), skinMat);
                nose.position.set(0, 1.56, -0.25);
                group.add(nose);

                // Brow ridge & emerald eyes
                const brow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.04), createMat(0x4a3020));
                brow.position.set(0, 1.72, -0.205);
                group.add(brow);
                const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), eyeMat);
                eyeL.position.set(-0.09, 1.66, -0.205);
                group.add(eyeL);
                const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), eyeMat);
                eyeR.position.set(0.09, 1.66, -0.205);
                group.add(eyeR);

                // Profession hat / hood accent
                if (mob.profession === 'farmer') {
                    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), accentMat);
                    brim.position.set(0, 1.88, 0);
                    group.add(brim);
                    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), accentMat);
                    crown.position.set(0, 1.95, 0);
                    group.add(crown);
                } else {
                    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.1, 0.43), accentMat);
                    cap.position.set(0, 1.88, 0);
                    group.add(cap);
                }

                // Robed Torso
                const robe = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.30), robeMat);
                robe.position.set(0, 1.04, 0);
                group.add(robe);

                // Crossed Villager Arms in front
                const crossedArms = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.18), robeMat);
                crossedArms.position.set(0, 1.12, -0.18);
                group.add(crossedArms);

                const makeLegPivot = (px) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 0.68, 0);
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.68, 0.22), robeMat);
                    leg.position.set(0, -0.34, 0);
                    pivot.add(leg);
                    group.add(pivot);
                    return pivot;
                };

                group.userData = {
                    isVillager: true,
                    legL: makeLegPivot(-0.12),
                    legR: makeLegPivot(0.12),
                    head,
                    materialList
                };
            } else if (type === 'iron_golem') {
                const ironMat = createMat(0xdcdcd4);
                const darkIronMat = createMat(0x9a9a92);
                const mossMat = createMat(0x4c8a36);
                const eyeMat = createMat(0xd62828);

                // Head with villager nose & glowing red eyes
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.44), ironMat);
                head.position.set(0, 2.22, -0.05);
                group.add(head);
                const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.20, 0.14), ironMat);
                nose.position.set(0, 2.10, -0.30);
                group.add(nose);
                const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), eyeMat);
                eyeL.position.set(-0.11, 2.24, -0.275);
                group.add(eyeL);
                const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), eyeMat);
                eyeR.position.set(0.11, 2.24, -0.275);
                group.add(eyeR);

                // Broad heavy torso & waist + vine moss patch
                const chest = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 0.52), ironMat);
                chest.position.set(0, 1.62, 0);
                group.add(chest);
                const waist = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.35, 0.36), darkIronMat);
                waist.position.set(0, 1.08, 0);
                group.add(waist);
                const moss = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.54), mossMat);
                moss.position.set(0.25, 1.68, 0);
                group.add(moss);

                const makeArmPivot = (px) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 1.92, 0);
                    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.18, 0.26), ironMat);
                    arm.position.set(0, -0.59, 0);
                    pivot.add(arm);
                    group.add(pivot);
                    return pivot;
                };
                const makeLegPivot = (px) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 0.90, 0);
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.90, 0.30), darkIronMat);
                    leg.position.set(0, -0.45, 0);
                    pivot.add(leg);
                    group.add(pivot);
                    return pivot;
                };

                group.userData = {
                    isWalkingBiped: true,
                    armL: makeArmPivot(-0.62),
                    armR: makeArmPivot(0.62),
                    legL: makeLegPivot(-0.22),
                    legR: makeLegPivot(0.22),
                    materialList
                };
            } else if (type === 'skeleton') {
                const boneMat = createMat(0xe2e2da);
                const darkMat = createMat(0x2a2a2e);
                const bowMat = createMat(0x7c4a1e);

                const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), boneMat);
                head.position.set(0, 1.6, 0);
                group.add(head);
                const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), darkMat);
                eyeL.position.set(-0.08, 1.62, -0.195);
                group.add(eyeL);
                const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), darkMat);
                eyeR.position.set(0.08, 1.62, -0.195);
                group.add(eyeR);

                const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.62, 0.18), boneMat);
                torso.position.set(0, 1.05, 0);
                group.add(torso);

                const makeArmPivot = (px, withBow) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 1.30, 0);
                    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.58, 0.11), boneMat);
                    arm.position.set(0, -0.29, 0);
                    pivot.add(arm);
                    if (withBow) {
                        const bowStave = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.12), bowMat);
                        bowStave.position.set(0, -0.58, -0.14);
                        pivot.add(bowStave);
                        pivot.rotation.x = -Math.PI / 2.2;
                    }
                    group.add(pivot);
                    return pivot;
                };
                const makeLegPivot = (px) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 0.72, 0);
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.72, 0.11), boneMat);
                    leg.position.set(0, -0.36, 0);
                    pivot.add(leg);
                    group.add(pivot);
                    return pivot;
                };

                group.userData = {
                    isSkeleton: true,
                    armL: makeArmPivot(-0.26, false),
                    armR: makeArmPivot(0.26, true),
                    legL: makeLegPivot(-0.11),
                    legR: makeLegPivot(0.11),
                    materialList
                };
            } else if (type === 'enderman') {
                const bodyMat = createMat(0x14141c);
                const eyeMat = new THREE.MeshBasicMaterial({ color: 0xcc66ff });

                const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), bodyMat);
                head.position.set(0, 2.38, 0);
                group.add(head);
                const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.05, 0.02), eyeMat);
                eyeL.position.set(-0.10, 2.38, -0.215);
                group.add(eyeL);
                const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.05, 0.02), eyeMat);
                eyeR.position.set(0.10, 2.38, -0.215);
                group.add(eyeR);

                const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.78, 0.22), bodyMat);
                torso.position.set(0, 1.76, 0);
                group.add(torso);

                const makeArmPivot = (px) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 2.12, 0);
                    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.15, 0.11), bodyMat);
                    arm.position.set(0, -0.575, 0);
                    pivot.add(arm);
                    group.add(pivot);
                    return pivot;
                };
                const makeLegPivot = (px) => {
                    const pivot = new THREE.Group();
                    pivot.position.set(px, 1.38, 0);
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.38, 0.11), bodyMat);
                    leg.position.set(0, -0.69, 0);
                    pivot.add(leg);
                    group.add(pivot);
                    return pivot;
                };

                group.userData = {
                    isWalkingBiped: true,
                    armL: makeArmPivot(-0.28),
                    armR: makeArmPivot(0.28),
                    legL: makeLegPivot(-0.11),
                    legR: makeLegPivot(0.11),
                    materialList
                };
            }

            group.position.set(mob.position.x, mob.position.y, mob.position.z);
            this.scene.add(group);
            mob.mesh = group;
            return group;
        }

        updateMobMesh(mob, dt) {
            if (!mob.mesh) return;

            mob.mesh.position.set(mob.position.x, mob.position.y, mob.position.z);
            mob.mesh.rotation.y = mob.yaw;

            const uData = mob.mesh.userData;
            if (!uData) return;

            // Limb animation
            if (uData.isBiped) {
                const swing = Math.sin(mob.walkCycle) * 0.6;
                if (uData.legL) uData.legL.rotation.x = swing;
                if (uData.legR) uData.legR.rotation.x = -swing;
                if (uData.armL) uData.armL.rotation.x = -Math.PI / 2 + Math.sin(mob.walkCycle) * 0.12;
                if (uData.armR) uData.armR.rotation.x = -Math.PI / 2 - Math.sin(mob.walkCycle) * 0.12;
            } else if (uData.isSkeleton) {
                const swing = Math.sin(mob.walkCycle) * 0.6;
                if (uData.legL) uData.legL.rotation.x = swing;
                if (uData.legR) uData.legR.rotation.x = -swing;
                if (uData.armL) uData.armL.rotation.x = -swing * 0.5;
            } else if (uData.isWalkingBiped) {
                const swing = Math.sin(mob.walkCycle) * 0.65;
                if (uData.legL) uData.legL.rotation.x = swing;
                if (uData.legR) uData.legR.rotation.x = -swing;
                if (uData.armL) uData.armL.rotation.x = -swing * 0.8;
                if (uData.armR) uData.armR.rotation.x = swing * 0.8;
            } else if (uData.isVillager) {
                const swing = Math.sin(mob.walkCycle) * 0.55;
                if (uData.legL) uData.legL.rotation.x = swing;
                if (uData.legR) uData.legR.rotation.x = -swing;
            } else if (uData.legFL) {
                const swing = Math.sin(mob.walkCycle) * 0.55;
                if (uData.legFL) uData.legFL.rotation.x = swing;
                if (uData.legBR) uData.legBR.rotation.x = swing;
                if (uData.legFR) uData.legFR.rotation.x = -swing;
                if (uData.legBL) uData.legBL.rotation.x = -swing;
            }

            // Material visual feedback (Hurt flash or Creeper fuse flash)
            if (uData.materialList && uData.materialList.length > 0) {
                if (mob.hurtTimer > 0) {
                    for (let i = 0; i < uData.materialList.length; i++) {
                        uData.materialList[i].mat.color.setHex(0xff3333);
                    }
                } else if (mob.isIgnited) {
                    const isWhite = Math.sin(mob.fuseTimer * 24) > 0;
                    for (let i = 0; i < uData.materialList.length; i++) {
                        uData.materialList[i].mat.color.setHex(isWhite ? 0xffffff : uData.materialList[i].origColor);
                    }
                    const sc = 1.0 + (mob.fuseTimer / (mob.def.fuseTime || 1.5)) * 0.22;
                    mob.mesh.scale.set(sc, sc, sc);
                } else {
                    for (let i = 0; i < uData.materialList.length; i++) {
                        uData.materialList[i].mat.color.setHex(uData.materialList[i].origColor);
                    }
                    mob.mesh.scale.set(1, 1, 1);
                }
            }
        }
    }

    return {
        MOB_TYPES,
        VILLAGER_PROFESSIONS,
        Mob,
        MobManager
    };
}));
