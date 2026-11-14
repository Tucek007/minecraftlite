/**
 * world.js - Voxel World, Chunks, Procedural Generation, and Mesh Builder for Minecraft Lite.
 * Universal Module Definition (UMD) compatible with Browser and Node.js.
 */
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory(require('./noise'), require('./blocks'));
    } else {
        root.World = factory(root.PerlinNoise, root.Blocks);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (PerlinNoiseModule, BlocksModule) {
    'use strict';

    // Dependencies (passed via factory or retrieved from global / require)
    const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
    const PerlinNoise = PerlinNoiseModule || (g && g.PerlinNoise) || (typeof require !== 'undefined' ? require('./noise') : null);
    const Blocks = BlocksModule || (g && g.Blocks) || (typeof require !== 'undefined' ? require('./blocks') : null);

    const CHUNK_SIZE_X = 16;
    const CHUNK_SIZE_Z = 16;
    const CHUNK_HEIGHT = 64;
    const SEA_LEVEL = 18;

    class Chunk {
        constructor(chunkX, chunkZ) {
            this.chunkX = chunkX;
            this.chunkZ = chunkZ;
            this.voxels = new Uint8Array(CHUNK_SIZE_X * CHUNK_HEIGHT * CHUNK_SIZE_Z);
            this.dirty = true;
            this.hasModifications = false;
            this.mesh = null;
            this.waterMesh = null;
        }

        getIndex(lx, ly, lz) {
            return (lx * CHUNK_HEIGHT + ly) * CHUNK_SIZE_Z + lz;
        }

        getBlock(lx, ly, lz) {
            lx = Math.floor(lx);
            ly = Math.floor(ly);
            lz = Math.floor(lz);
            if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE_Z) {
                return 0; // AIR
            }
            return this.voxels[this.getIndex(lx, ly, lz)];
        }

        setBlock(lx, ly, lz, blockId) {
            lx = Math.floor(lx);
            ly = Math.floor(ly);
            lz = Math.floor(lz);
            if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE_Z) {
                return false;
            }
            this.voxels[this.getIndex(lx, ly, lz)] = blockId;
            this.dirty = true;
            return true;
        }
    }

    class VoxelWorld {
        constructor(seed = 4289) {
            this.seed = seed;
            this.noise = new PerlinNoise(seed);
            this.biomeNoise = new PerlinNoise(seed + 1013);
            this.caveNoise = new PerlinNoise(seed + 2039);
            this.chunks = new Map();
            this.modifiedBlocks = new Map(); // key "x,y,z" => blockId for save/load persistence
            this.chunkModifications = new Map(); // key "cx,cz" => Map<number, blockId> (chunk index => blockId)
            this.villages = [];
            this.openDoors = new Set();
            this.sharedOpaqueMaterial = null;
            this.sharedWaterMaterial = null;
        }

        getChunkKey(cx, cz) {
            return `${cx},${cz}`;
        }

        _recordModification(x, y, z, blockId) {
            x = Math.floor(x);
            y = Math.floor(y);
            z = Math.floor(z);
            this.modifiedBlocks.set(`${x},${y},${z}`, blockId);

            const cx = Math.floor(x / CHUNK_SIZE_X);
            const cz = Math.floor(z / CHUNK_SIZE_Z);
            const chunkKey = this.getChunkKey(cx, cz);
            let chunkMap = this.chunkModifications.get(chunkKey);
            if (!chunkMap) {
                chunkMap = new Map();
                this.chunkModifications.set(chunkKey, chunkMap);
            }
            const lx = (x % CHUNK_SIZE_X + CHUNK_SIZE_X) % CHUNK_SIZE_X;
            const lz = (z % CHUNK_SIZE_Z + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
            const idx = (lx * CHUNK_HEIGHT + y) * CHUNK_SIZE_Z + lz;
            chunkMap.set(idx, blockId);
        }

        getChunk(cx, cz) {
            return this.chunks.get(this.getChunkKey(cx, cz));
        }

        getOrCreateChunk(cx, cz) {
            const key = this.getChunkKey(cx, cz);
            let chunk = this.chunks.get(key);
            if (!chunk) {
                chunk = new Chunk(cx, cz);
                this.generateChunkTerrain(chunk);
                this.chunks.set(key, chunk);

                // Seamless chunk borders: mark loaded neighbors with mesh dirty
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        if (dx === 0 && dz === 0) continue;
                        const neighbor = this.getChunk(cx + dx, cz + dz);
                        if (neighbor && neighbor.mesh !== null) {
                            neighbor.dirty = true;
                        }
                    }
                }
            }
            return chunk;
        }

        getBlock(x, y, z, createIfMissing = true) {
            x = Math.floor(x);
            y = Math.floor(y);
            z = Math.floor(z);

            if (y < 0) return (Blocks && Blocks.BLOCKS) ? Blocks.BLOCKS.BEDROCK : 14;
            if (y >= CHUNK_HEIGHT) return 0; // AIR

            const cx = Math.floor(x / CHUNK_SIZE_X);
            const cz = Math.floor(z / CHUNK_SIZE_Z);
            const chunk = createIfMissing ? this.getOrCreateChunk(cx, cz) : this.getChunk(cx, cz);
            if (!chunk) return 0;

            const lx = (x % CHUNK_SIZE_X + CHUNK_SIZE_X) % CHUNK_SIZE_X;
            const lz = (z % CHUNK_SIZE_Z + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
            return chunk.getBlock(lx, y, lz);
        }

        setBlock(x, y, z, blockId) {
            x = Math.floor(x);
            y = Math.floor(y);
            z = Math.floor(z);

            if (y < 0 || y >= CHUNK_HEIGHT) return false;

            const cx = Math.floor(x / CHUNK_SIZE_X);
            const cz = Math.floor(z / CHUNK_SIZE_Z);
            const chunk = this.getOrCreateChunk(cx, cz);

            const lx = (x % CHUNK_SIZE_X + CHUNK_SIZE_X) % CHUNK_SIZE_X;
            const lz = (z % CHUNK_SIZE_Z + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
            const res = chunk.setBlock(lx, y, lz, blockId);
            chunk.hasModifications = true;

            // Record modification for save/load
            this._recordModification(x, y, z, blockId);

            // Mark neighbor chunks dirty if block is on the edge
            if (lx === 0) {
                const neighbor = this.getChunk(cx - 1, cz);
                if (neighbor) neighbor.dirty = true;
            } else if (lx === CHUNK_SIZE_X - 1) {
                const neighbor = this.getChunk(cx + 1, cz);
                if (neighbor) neighbor.dirty = true;
            }

            if (lz === 0) {
                const neighbor = this.getChunk(cx, cz - 1);
                if (neighbor) neighbor.dirty = true;
            } else if (lz === CHUNK_SIZE_Z - 1) {
                const neighbor = this.getChunk(cx, cz + 1);
                if (neighbor) neighbor.dirty = true;
            }

            if ((lx === 0 || lx === CHUNK_SIZE_X - 1) && (lz === 0 || lz === CHUNK_SIZE_Z - 1)) {
                const dx = (lx === 0) ? -1 : 1;
                const dz = (lz === 0) ? -1 : 1;
                const diagNeighbor = this.getChunk(cx + dx, cz + dz);
                if (diagNeighbor) diagNeighbor.dirty = true;
            }

            return res;
        }

        getBlockKey(x, y, z) {
            return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
        }

        isDoorOpen(x, y, z) {
            return this.openDoors.has(this.getBlockKey(x, y, z));
        }

        toggleDoor(x, y, z) {
            const bx = Math.floor(x);
            const by = Math.floor(y);
            const bz = Math.floor(z);
            const blockId = this.getBlock(bx, by, bz, false);
            if (!Blocks || !Blocks.BLOCKS || blockId !== Blocks.BLOCKS.DOOR_OAK) return false;
            const key = this.getBlockKey(bx, by, bz);
            const nextOpen = !this.openDoors.has(key);
            const applyState = (tx, ty, tz) => {
                const k = this.getBlockKey(tx, ty, tz);
                if (nextOpen) this.openDoors.add(k);
                else this.openDoors.delete(k);
                const ch = this.getChunk(Math.floor(tx / CHUNK_SIZE_X), Math.floor(tz / CHUNK_SIZE_Z), false);
                if (ch) ch.dirty = true;
            };
            applyState(bx, by, bz);
            for (const dy of [-1, 1]) {
                if (this.getBlock(bx, by + dy, bz, false) === Blocks.BLOCKS.DOOR_OAK) {
                    applyState(bx, by + dy, bz);
                }
            }
            return true;
        }

        getHighestBlockY(x, z) {
            const bx = Math.floor(x);
            const bz = Math.floor(z);
            const cx = Math.floor(bx / CHUNK_SIZE_X);
            const cz = Math.floor(bz / CHUNK_SIZE_Z);
            const chunk = this.getChunk(cx, cz, false);
            if (!chunk) return 12;
            const lx = ((bx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
            const lz = ((bz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
            for (let ly = CHUNK_HEIGHT - 1; ly >= 0; ly--) {
                const id = chunk.getBlock(lx, ly, lz);
                if (id !== 0) return ly;
            }
            return 0;
        }

        isSolid(x, y, z) {
            const blockId = this.getBlock(x, y, z);
            if (!blockId || !Blocks || !Blocks.BLOCK_DEFS[blockId]) return false;
            if (Blocks.BLOCKS && blockId === Blocks.BLOCKS.DOOR_OAK && this.isDoorOpen(x, y, z)) {
                return false;
            }
            return Blocks.BLOCK_DEFS[blockId].solid;
        }

        isTargetable(x, y, z) {
            const blockId = this.getBlock(x, y, z);
            if (!blockId || !Blocks || !Blocks.BLOCK_DEFS[blockId]) return false;
            const def = Blocks.BLOCK_DEFS[blockId];
            return Boolean(def.solid || def.targetable);
        }

        isClimbable(x, y, z) {
            const blockId = this.getBlock(x, y, z);
            if (!blockId || !Blocks || !Blocks.BLOCK_DEFS[blockId]) return false;
            return Boolean(Blocks.BLOCK_DEFS[blockId].climbable);
        }

        isTransparent(x, y, z) {
            const blockId = this.getBlock(x, y, z);
            if (!blockId) return true;
            if (!Blocks || !Blocks.BLOCK_DEFS[blockId]) return false;
            return Blocks.BLOCK_DEFS[blockId].transparent;
        }

        isWater(x, y, z) {
            const blockId = this.getBlock(x, y, z);
            return (Blocks && Blocks.BLOCKS) ? (blockId === Blocks.BLOCKS.WATER) : (blockId === 11);
        }

        isLava(x, y, z) {
            const blockId = this.getBlock(x, y, z);
            return (Blocks && Blocks.BLOCKS && Blocks.BLOCKS.LAVA !== undefined) ? (blockId === Blocks.BLOCKS.LAVA) : (blockId === 30);
        }

        isOpaqueForAO(wx, wy, wz) {
            if (wy < 0 || wy >= CHUNK_HEIGHT) return false;
            const blockId = this.getBlock(wx, wy, wz, false);
            if (!blockId || !Blocks || !Blocks.BLOCK_DEFS || !Blocks.BLOCK_DEFS[blockId]) return false;
            const def = Blocks.BLOCK_DEFS[blockId];
            return Boolean(def && def.solid && !def.transparent);
        }

        getVertexAO(s1, s2, corner) {
            if (s1 && s2) return 0;
            return 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (corner ? 1 : 0));
        }

        getBiome(worldX, worldZ) {
            const b = this.biomeNoise.fbm2D(worldX * 0.005, worldZ * 0.005, 2, 0.5, 2.0);
            if (b < -0.2) return 'desert';
            if (b > 0.3) return 'mountains';
            if (b > 0.05) return 'forest';
            return 'plains';
        }

        generateChunkTerrain(chunk) {
            const B = (Blocks && Blocks.BLOCKS) ? Blocks.BLOCKS : {
                AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLESTONE: 4, WOOD: 5,
                LEAVES: 6, PLANKS: 7, BRICK: 8, SAND: 9, GLASS: 10, WATER: 11,
                COAL_ORE: 12, IRON_ORE: 13, BEDROCK: 14, GOLD_ORE: 18, DIAMOND_ORE: 19, SNOW: 20,
                GRAVEL: 25, CRAFTING_TABLE: 26, JACK_O_LANTERN: 27, BIRCH_WOOD: 28, BIRCH_LEAVES: 29, LAVA: 30,
                TORCH: 31, BED: 32, LADDER: 33, FLOWER_RED: 34, FLOWER_YELLOW: 35, TALL_GRASS: 36
            };

            const treesToPlant = [];
            const heightMap = new Int32Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
            const biomeMap = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);

            for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
                const wx = chunk.chunkX * CHUNK_SIZE_X + lx;
                for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
                    const wz = chunk.chunkZ * CHUNK_SIZE_Z + lz;

                    const biome = this.getBiome(wx, wz);

                    // Height determination based on biome and multi-octave noise
                    let height = 20;
                    if (biome === 'mountains') {
                        const mNoise = this.noise.fbm2D(wx * 0.02, wz * 0.02, 4, 0.55, 2.0);
                        height = Math.floor(26 + Math.pow(Math.max(0, mNoise + 0.3), 1.5) * 26);
                    } else if (biome === 'desert') {
                        const dNoise = this.noise.fbm2D(wx * 0.015, wz * 0.015, 3, 0.5, 2.0);
                        height = Math.floor(18 + dNoise * 6);
                    } else if (biome === 'forest') {
                        const fNoise = this.noise.fbm2D(wx * 0.02, wz * 0.02, 3, 0.5, 2.0);
                        height = Math.floor(20 + fNoise * 8);
                    } else {
                        // Plains
                        const pNoise = this.noise.fbm2D(wx * 0.02, wz * 0.02, 3, 0.45, 2.0);
                        height = Math.floor(19 + pNoise * 6);
                    }

                    height = Math.max(2, Math.min(CHUNK_HEIGHT - 10, height));

                    const colIdx = lx * CHUNK_SIZE_Z + lz;
                    heightMap[colIdx] = height;
                    biomeMap[colIdx] = biome;

                    // Deterministic gravel patches (~25% of underwater/shoreline columns)
                    const isShoreOrUnderwater = (height <= SEA_LEVEL && biome !== 'desert');
                    const gravelHash = Math.sin(this.seed * 7.13 + wx * 43.19 + wz * 83.47) * 43758.5453;
                    const isGravel = isShoreOrUnderwater && ((gravelHash - Math.floor(gravelHash)) < 0.25) && (B.GRAVEL !== undefined);
                    const shoreBlock = isGravel ? B.GRAVEL : B.SAND;

                    // Layering
                    chunk.setBlock(lx, 0, lz, B.BEDROCK);

                    for (let y = 1; y <= height; y++) {
                        // 3D Cave generation (Swiss cheese caves)
                        const caveVal = this.caveNoise.fbm3D(wx * 0.05, y * 0.08, wz * 0.05, 2);
                        if (y < height - 3 && caveVal > 0.55) {
                            if (y <= 4 && B.LAVA !== undefined) {
                                chunk.setBlock(lx, y, lz, B.LAVA);
                            } else {
                                chunk.setBlock(lx, y, lz, B.AIR);
                            }
                            continue;
                        }

                        if (y < height - 4) {
                            // Stone layer with ores
                            let blockType = B.STONE;
                            const oreHash = Math.sin(wx * 12.9898 + y * 78.233 + wz * 37.719) * 43758.5453;
                            const oreRand = oreHash - Math.floor(oreHash);

                            if (B.EMERALD_ORE !== undefined && biome === 'mountains' && y >= 8 && y < 34 && oreRand > 0.985) {
                                blockType = B.EMERALD_ORE;
                            } else if (y < 12 && oreRand < 0.015) {
                                blockType = B.DIAMOND_ORE;
                            } else if (y < 20 && oreRand < 0.035) {
                                blockType = B.GOLD_ORE;
                            } else if (y < 35 && oreRand < 0.08) {
                                blockType = B.IRON_ORE;
                            } else if (oreRand < 0.14) {
                                blockType = B.COAL_ORE;
                            }

                            chunk.setBlock(lx, y, lz, blockType);
                        } else if (y < height) {
                            // Sub-surface layer
                            if (biome === 'desert') {
                                chunk.setBlock(lx, y, lz, B.SAND);
                            } else if (height <= SEA_LEVEL + 1) {
                                chunk.setBlock(lx, y, lz, shoreBlock);
                            } else {
                                chunk.setBlock(lx, y, lz, B.DIRT);
                            }
                        } else {
                            // Top surface block
                            if (biome === 'desert') {
                                chunk.setBlock(lx, y, lz, B.SAND);
                            } else if (height <= SEA_LEVEL + 1) {
                                chunk.setBlock(lx, y, lz, shoreBlock);
                            } else if (biome === 'mountains' && height >= 38) {
                                chunk.setBlock(lx, y, lz, B.SNOW);
                            } else {
                                chunk.setBlock(lx, y, lz, B.GRASS);

                                // Tree candidate check
                                const treeRand = Math.sin(wx * 91.34 + wz * 43.12) * 10000;
                                const tr = treeRand - Math.floor(treeRand);
                                const treeChance = (biome === 'forest') ? 0.08 : 0.015;
                                if (tr < treeChance && lx >= 2 && lx <= CHUNK_SIZE_X - 3 && lz >= 2 && lz <= CHUNK_SIZE_Z - 3) {
                                    treesToPlant.push({ lx, y: height + 1, lz });
                                }
                            }
                        }
                    }

                    // Fill water body
                    if (height < SEA_LEVEL) {
                        for (let y = height + 1; y <= SEA_LEVEL; y++) {
                            chunk.setBlock(lx, y, lz, B.WATER);
                        }
                    }
                }
            }

            // Plant trees safely within chunk bounds
            for (const t of treesToPlant) {
                const twx = chunk.chunkX * CHUNK_SIZE_X + t.lx;
                const twz = chunk.chunkZ * CHUNK_SIZE_Z + t.lz;
                const trunkHeight = 4 + Math.floor((Math.sin(this.seed * 1.7 + twx * 7.3 + twz * 13.1) * 0.5 + 0.5) * 2);

                const birchHash = Math.sin(this.seed * 2.3 + twx * 19.7 + twz * 29.3) * 43758.5453;
                const isBirch = (birchHash - Math.floor(birchHash)) < 0.30;
                const trunkBlock = (isBirch && B.BIRCH_WOOD !== undefined) ? B.BIRCH_WOOD : B.WOOD;
                const leavesBlock = (isBirch && B.BIRCH_LEAVES !== undefined) ? B.BIRCH_LEAVES : B.LEAVES;

                // Trunk
                for (let ty = 0; ty < trunkHeight; ty++) {
                    if (t.y + ty < CHUNK_HEIGHT) {
                        chunk.setBlock(t.lx, t.y + ty, t.lz, trunkBlock);
                    }
                }

                // Foliage canopy
                const leafTop = t.y + trunkHeight;
                for (let dy = -2; dy <= 1; dy++) {
                    const radius = (dy >= 0) ? 1 : 2;
                    for (let ox = -radius; ox <= radius; ox++) {
                        for (let oz = -radius; oz <= radius; oz++) {
                            if (ox === 0 && oz === 0 && dy < 0) continue; // trunk inside

                            const fx = t.lx + ox;
                            const fy = leafTop + dy;
                            const fz = t.lz + oz;

                            if (Math.abs(ox) === radius && Math.abs(oz) === radius) {
                                if (dy === 1) continue;
                                const wfx = chunk.chunkX * CHUNK_SIZE_X + fx;
                                const wfz = chunk.chunkZ * CHUNK_SIZE_Z + fz;
                                const leafHash = Math.sin(this.seed * 11.13 + wfx * 12.9898 + fy * 78.233 + wfz * 37.719) * 43758.5453;
                                const leafRand = leafHash - Math.floor(leafHash);
                                if (leafRand > 0.5) continue;
                            }

                            if (fx >= 0 && fx < CHUNK_SIZE_X && fz >= 0 && fz < CHUNK_SIZE_Z && fy < CHUNK_HEIGHT) {
                                if (chunk.getBlock(fx, fy, fz) === B.AIR) {
                                    chunk.setBlock(fx, fy, fz, leavesBlock);
                                }
                            }
                        }
                    }
                }
            }

            // Biome decorations (Cactus & Pumpkin)
            const cactusBlock = (B && B.CACTUS) ? B.CACTUS : (Blocks && (Blocks.BLOCKS && Blocks.BLOCKS.CACTUS ? Blocks.BLOCKS.CACTUS : (Blocks.BLOCK_DEFS && Blocks.BLOCK_DEFS[23] ? 23 : null)));
            const pumpkinBlock = (B && B.PUMPKIN) ? B.PUMPKIN : (Blocks && (Blocks.BLOCKS && Blocks.BLOCKS.PUMPKIN ? Blocks.BLOCKS.PUMPKIN : (Blocks.BLOCK_DEFS && Blocks.BLOCK_DEFS[24] ? 24 : null)));

            for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
                const wx = chunk.chunkX * CHUNK_SIZE_X + lx;
                for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
                    const wz = chunk.chunkZ * CHUNK_SIZE_Z + lz;
                    const colIdx = lx * CHUNK_SIZE_Z + lz;
                    const height = heightMap[colIdx];
                    const biome = biomeMap[colIdx];

                    // Cactus: desert, height > SEA_LEVEL + 1, lx 1..14, lz 1..14
                    if (cactusBlock && biome === 'desert' && height > SEA_LEVEL + 1 && lx >= 1 && lx <= CHUNK_SIZE_X - 2 && lz >= 1 && lz <= CHUNK_SIZE_Z - 2) {
                        const cactusHash = Math.sin(this.seed * 3.71 + wx * 67.31 + wz * 89.17) * 43758.5453;
                        const cactusRand = cactusHash - Math.floor(cactusHash);
                        if (cactusRand < 0.015) {
                            // Check no adjacent solid block at height + 1
                            const isAdjSolid = (bx, bz) => {
                                const id = chunk.getBlock(bx, height + 1, bz);
                                return !!(id !== 0 && Blocks && Blocks.BLOCK_DEFS && Blocks.BLOCK_DEFS[id] && Blocks.BLOCK_DEFS[id].solid);
                            };
                            if (!isAdjSolid(lx - 1, lz) && !isAdjSolid(lx + 1, lz) && !isAdjSolid(lx, lz - 1) && !isAdjSolid(lx, lz + 1) && chunk.getBlock(lx, height + 1, lz) === 0) {
                                const cactusHeight = (cactusRand < 0.0075) ? 3 : 2;
                                for (let cy = 1; cy <= cactusHeight; cy++) {
                                    if (height + cy < CHUNK_HEIGHT) {
                                        chunk.setBlock(lx, height + cy, lz, cactusBlock);
                                    }
                                }
                            }
                        }
                    }

                    // Pumpkin & Flora: plains or forest, height > SEA_LEVEL + 2
                    if ((biome === 'plains' || biome === 'forest') && height > SEA_LEVEL + 2) {
                        if (pumpkinBlock) {
                            const pumpkinHash = Math.sin(this.seed * 5.19 + wx * 31.41 + wz * 59.26) * 43758.5453;
                            const pumpkinRand = pumpkinHash - Math.floor(pumpkinHash);
                            if (pumpkinRand < 0.002) {
                                if (chunk.getBlock(lx, height, lz) === B.GRASS && chunk.getBlock(lx, height + 1, lz) === 0 && height + 1 < CHUNK_HEIGHT) {
                                    chunk.setBlock(lx, height + 1, lz, pumpkinBlock);
                                }
                            }
                        }

                        // Lush Meadow Flora (Tall Grass, Red Poppy, Yellow Dandelion)
                        if (chunk.getBlock(lx, height, lz) === B.GRASS && chunk.getBlock(lx, height + 1, lz) === 0 && height + 1 < CHUNK_HEIGHT) {
                            const floraHash = Math.sin(this.seed * 9.37 + wx * 53.71 + wz * 97.13) * 43758.5453;
                            const floraRand = floraHash - Math.floor(floraHash);
                            if (B.FLOWER_RED && floraRand < 0.012) {
                                chunk.setBlock(lx, height + 1, lz, B.FLOWER_RED);
                            } else if (B.FLOWER_YELLOW && floraRand >= 0.012 && floraRand < 0.024) {
                                chunk.setBlock(lx, height + 1, lz, B.FLOWER_YELLOW);
                            } else if (B.TALL_GRASS && floraRand >= 0.024 && floraRand < 0.095) {
                                chunk.setBlock(lx, height + 1, lz, B.TALL_GRASS);
                            }
                        }
                    }
                }
            }

            // Deterministic Village Generation in flat plains/forest chunks
            this.generateVillageInChunk(chunk, heightMap, biomeMap);

            // Apply saved modifications if any exist for this chunk
            const chunkMods = this.chunkModifications.get(this.getChunkKey(chunk.chunkX, chunk.chunkZ));
            if (chunkMods && chunkMods.size > 0) {
                for (const [idx, blockId] of chunkMods.entries()) {
                    chunk.voxels[idx] = blockId;
                }
                chunk.hasModifications = true;
            }

            chunk.dirty = true;
        }

        /**
         * Procedurally generates a self-contained deterministic 16x16 village with
         * central well, paths, houses, blacksmith/enchanting hall, farm, and street lanterns.
         */
        generateVillageInChunk(chunk, heightMap, biomeMap) {
            const B = Blocks && Blocks.BLOCKS ? Blocks.BLOCKS : null;
            if (!B) return;

            const cx = chunk.chunkX;
            const cz = chunk.chunkZ;
            if (cx === 0 && cz === 0) return; // Keep spawn chunk terrain classic

            const seedMix = Math.abs(((cx * 73856093) ^ (cz * 19349663) ^ ((this.seed | 0) * 83492791)) | 0);
            const isGuaranteedNearCandidate = ((cx === 1 && cz === 1) || (cx === -1 && cz === 1));
            if (!isGuaranteedNearCandidate && (seedMix % 11 !== 0)) return;

            const centerCol = 8 * CHUNK_SIZE_Z + 8;
            const centerBiome = biomeMap[centerCol];
            if (centerBiome !== 'plains' && centerBiome !== 'forest') return;

            const baseY = heightMap[centerCol];
            if (baseY < SEA_LEVEL + 2 || baseY > SEA_LEVEL + 16 || baseY + 8 >= CHUNK_HEIGHT) return;

            let minH = CHUNK_HEIGHT;
            let maxH = 0;
            for (let lx = 1; lx <= 14; lx++) {
                for (let lz = 1; lz <= 14; lz++) {
                    const h = heightMap[lx * CHUNK_SIZE_Z + lz];
                    if (h < minH) minH = h;
                    if (h > maxH) maxH = h;
                }
            }
            if (maxH - minH > 6) return;

            const setSafe = (lx, y, lz, blockId) => {
                if (blockId === undefined || blockId === null) return;
                if (lx < 0 || lx >= CHUNK_SIZE_X || lz < 0 || lz >= CHUNK_SIZE_Z) return;
                if (y < 1 || y >= CHUNK_HEIGHT) return;
                chunk.setBlock(lx, y, lz, blockId);
            };

            // Terrace plaza cleanly (1..14) and clear headroom (including trees)
            for (let lx = 1; lx <= 14; lx++) {
                for (let lz = 1; lz <= 14; lz++) {
                    for (let y = Math.max(1, baseY - 3); y < baseY; y++) {
                        setSafe(lx, y, lz, B.DIRT);
                    }
                    setSafe(lx, baseY, lz, B.GRASS);
                    for (let y = baseY + 1; y <= Math.min(CHUNK_HEIGHT - 1, baseY + 12); y++) {
                        setSafe(lx, y, lz, B.AIR);
                    }
                }
            }

            // Crossroads paths (GRAVEL + STONE_BRICKS accent)
            const brickOrCobble = B.STONE_BRICKS !== undefined ? B.STONE_BRICKS : B.COBBLESTONE;
            for (let i = 1; i <= 14; i++) {
                setSafe(7, baseY, i, (i % 3 === 0) ? brickOrCobble : B.GRAVEL);
                setSafe(8, baseY, i, (i % 4 === 0) ? brickOrCobble : B.GRAVEL);
                setSafe(i, baseY, 7, (i % 3 === 0) ? brickOrCobble : B.GRAVEL);
                setSafe(i, baseY, 8, (i % 4 === 0) ? brickOrCobble : B.GRAVEL);
            }

            // 1. Central Village Well (lx=6..8, lz=6..8)
            for (let lx = 6; lx <= 8; lx++) {
                for (let lz = 6; lz <= 8; lz++) {
                    const isRim = (lx === 6 || lx === 8 || lz === 6 || lz === 8);
                    setSafe(lx, baseY - 1, lz, B.COBBLESTONE);
                    if (isRim) {
                        setSafe(lx, baseY, lz, B.COBBLESTONE);
                        setSafe(lx, baseY + 1, lz, ((lx + lz) % 2 === 0 && B.MOSSY_COBBLESTONE) ? B.MOSSY_COBBLESTONE : B.COBBLESTONE);
                    } else {
                        setSafe(lx, baseY, lz, B.WATER);
                    }
                    setSafe(lx, baseY + 4, lz, B.PLANKS);
                }
            }
            for (const [px, pz] of [[6, 6], [8, 6], [6, 8], [8, 8]]) {
                setSafe(px, baseY + 2, pz, B.WOOD);
                setSafe(px, baseY + 3, pz, B.WOOD);
            }
            setSafe(7, baseY + 3, 7, B.LANTERN !== undefined ? B.LANTERN : B.TORCH);

            // Helper to build a 5x5 cottage/structure
            const buildStructure = (x0, z0, wallMat, cornerMat, roofMat, doorX, doorZ) => {
                for (let lx = x0; lx <= x0 + 4; lx++) {
                    for (let lz = z0; lz <= z0 + 4; lz++) {
                        const isEdge = (lx === x0 || lx === x0 + 4 || lz === z0 || lz === z0 + 4);
                        const isCorner = ((lx === x0 || lx === x0 + 4) && (lz === z0 || lz === z0 + 4));
                        setSafe(lx, baseY, lz, isEdge ? B.COBBLESTONE : wallMat);
                        if (isEdge) {
                            for (let dy = 1; dy <= 3; dy++) {
                                setSafe(lx, baseY + dy, lz, isCorner ? cornerMat : wallMat);
                            }
                        }
                        setSafe(lx, baseY + 4, lz, roofMat);
                    }
                }
                // Carve 2-high entrance door
                setSafe(doorX, baseY + 1, doorZ, B.DOOR_OAK !== undefined ? B.DOOR_OAK : B.AIR);
                setSafe(doorX, baseY + 2, doorZ, B.DOOR_OAK !== undefined ? B.DOOR_OAK : B.AIR);
            };

            // 2. Villager Cottage (NE: x=10..14, z=1..5)
            buildStructure(10, 1, B.PLANKS, B.WOOD, B.PLANKS, 10, 3);
            setSafe(12, baseY + 2, 1, B.GLASS);
            setSafe(12, baseY + 2, 5, B.GLASS);
            setSafe(14, baseY + 2, 3, B.GLASS);
            for (let lx = 11; lx <= 13; lx++) {
                for (let lz = 2; lz <= 4; lz++) {
                    setSafe(lx, baseY + 5, lz, B.WOOD);
                }
            }
            setSafe(13, baseY + 1, 2, B.BED);
            setSafe(11, baseY + 1, 2, B.BOOKSHELF);
            setSafe(11, baseY + 1, 4, B.CRAFTING_TABLE);
            setSafe(13, baseY + 1, 4, B.CHEST !== undefined ? B.CHEST : B.PLANKS);
            setSafe(12, baseY + 3, 3, B.TORCH);

            // 3. Blacksmith & Enchanting Hall (NW: x=1..5, z=1..5)
            buildStructure(1, 1, brickOrCobble, B.COBBLESTONE, brickOrCobble, 5, 3);
            setSafe(3, baseY + 2, 1, B.GLASS);
            setSafe(1, baseY + 2, 3, B.GLASS);
            setSafe(3, baseY + 2, 5, B.GLASS);
            setSafe(2, baseY + 1, 2, B.FURNACE !== undefined ? B.FURNACE : B.COBBLESTONE);
            setSafe(2, baseY + 1, 3, B.ENCHANTING_TABLE !== undefined ? B.ENCHANTING_TABLE : B.CRAFTING_TABLE);
            setSafe(2, baseY + 1, 4, B.BOOKSHELF);
            setSafe(4, baseY + 1, 2, B.CHEST !== undefined ? B.CHEST : B.PLANKS);
            setSafe(3, baseY + 3, 3, B.LANTERN !== undefined ? B.LANTERN : B.TORCH);

            // 4. Scholar Library Cottage (SE: x=10..14, z=10..14)
            buildStructure(10, 10, B.PLANKS, B.WOOD, B.PLANKS, 10, 12);
            setSafe(12, baseY + 2, 14, B.GLASS);
            setSafe(14, baseY + 2, 12, B.GLASS);
            setSafe(13, baseY + 1, 11, B.BOOKSHELF);
            setSafe(13, baseY + 2, 11, B.BOOKSHELF);
            setSafe(13, baseY + 1, 12, B.BOOKSHELF);
            setSafe(13, baseY + 1, 13, B.BOOKSHELF);
            setSafe(11, baseY + 1, 13, B.BED);
            setSafe(12, baseY + 3, 12, B.TORCH);
            setSafe(9, baseY + 3, 12, B.LANTERN !== undefined ? B.LANTERN : B.TORCH);

            // 5. Irrigated Wheat Farm (SW: x=1..5, z=10..14)
            for (let lx = 1; lx <= 5; lx++) {
                for (let lz = 10; lz <= 14; lz++) {
                    const isCurb = (lx === 1 || lx === 5 || lz === 10 || lz === 14);
                    if (isCurb) {
                        setSafe(lx, baseY, lz, B.WOOD);
                    } else if (lx === 3) {
                        setSafe(lx, baseY - 1, lz, B.DIRT);
                        setSafe(lx, baseY, lz, B.WATER);
                    } else {
                        setSafe(lx, baseY, lz, B.FARMLAND !== undefined ? B.FARMLAND : B.DIRT);
                        setSafe(lx, baseY + 1, lz, B.WHEAT !== undefined ? B.WHEAT : B.TALL_GRASS);
                    }
                }
            }

            // 6. Street Lantern Posts
            for (const [px, pz] of [[6, 10], [9, 5]]) {
                setSafe(px, baseY + 1, pz, B.WOOD);
                setSafe(px, baseY + 2, pz, B.WOOD);
                setSafe(px, baseY + 3, pz, B.LANTERN !== undefined ? B.LANTERN : B.TORCH);
            }

            const key = this.getChunkKey(cx, cz);
            if (!this.villages.some(v => v.key === key)) {
                this.villages.push({
                    key,
                    cx,
                    cz,
                    x: cx * CHUNK_SIZE_X + 7.5,
                    y: baseY + 1,
                    z: cz * CHUNK_SIZE_Z + 7.5,
                    populated: false
                });
            }
        }

        buildChunkMesh(chunk, THREE, atlasTexture) {
            if (!THREE || !atlasTexture) return;

            const positions = [];
            const normals = [];
            const uvs = [];
            const colors = [];

            // Water positions for separate translucent mesh
            const waterPositions = [];
            const waterNormals = [];
            const waterUvs = [];
            const waterColors = [];

            const cxWorld = chunk.chunkX * CHUNK_SIZE_X;
            const czWorld = chunk.chunkZ * CHUNK_SIZE_Z;

            const faceShades = [0.7, 0.7, 1.0, 0.5, 0.8, 0.8]; // +X, -X, +Y, -Y, +Z, -Z
            const aoTable = [0.5, 0.68, 0.84, 1.0];

            // Gather nearby light emitters for smooth colored vertex lighting
            const lightSources = [];
            const BLOCK_DEFS = Blocks && Blocks.BLOCK_DEFS ? Blocks.BLOCK_DEFS : {};
            const BLOCKS_REF = Blocks && Blocks.BLOCKS ? Blocks.BLOCKS : {};
            for (let sx = -4; sx < CHUNK_SIZE_X + 4; sx++) {
                const swx = cxWorld + sx;
                const inChunkX = (sx >= 0 && sx < CHUNK_SIZE_X);
                for (let sz = -4; sz < CHUNK_SIZE_Z + 4; sz++) {
                    const swz = czWorld + sz;
                    const inChunk = inChunkX && (sz >= 0 && sz < CHUNK_SIZE_Z);
                    for (let sy = 0; sy < CHUNK_HEIGHT; sy++) {
                        const bId = inChunk ? chunk.getBlock(sx, sy, sz) : this.getBlock(swx, sy, swz, false);
                        if (!bId) continue;
                        const def = BLOCK_DEFS[bId];
                        if (def && def.lightLevel > 0) {
                            let lr = 1.0, lg = 0.78, lb = 0.42;
                            if (bId === BLOCKS_REF.ENCHANTING_TABLE) {
                                lr = 0.45; lg = 0.72; lb = 1.0;
                            } else if (bId === BLOCKS_REF.LAVA) {
                                lr = 1.0; lg = 0.44; lb = 0.12;
                            } else if (bId === BLOCKS_REF.LANTERN) {
                                lr = 1.0; lg = 0.82; lb = 0.46;
                            }
                            lightSources.push({ x: swx, y: sy, z: swz, level: def.lightLevel, r: lr, g: lg, b: lb });
                        }
                    }
                }
            }

            const computeVertexColor = (vx, vy, vz, baseShade, tintR = 1.0, tintG = 1.0, tintB = 1.0) => {
                if (lightSources.length === 0 && tintR === 1.0 && tintG === 1.0 && tintB === 1.0) {
                    return [baseShade, baseShade, baseShade];
                }
                let r = baseShade * tintR;
                let g = baseShade * tintG;
                let b = baseShade * tintB;
                if (lightSources.length > 0) {
                    let addR = 0, addG = 0, addB = 0;
                    for (let i = 0; i < lightSources.length; i++) {
                        const src = lightSources[i];
                        const dx = vx - (src.x + 0.5);
                        const dy = vy - (src.y + 0.5);
                        const dz = vz - (src.z + 0.5);
                        const d2 = dx * dx + dy * dy + dz * dz;
                        if (d2 >= 36.0) continue;
                        const dist = Math.sqrt(d2);
                        const falloff = (1.0 - dist / 6.0) * (src.level / 15.0);
                        const cr = falloff * src.r * 0.55;
                        const cg = falloff * src.g * 0.42;
                        const cb = falloff * src.b * 0.30;
                        if (cr > addR) addR = cr;
                        if (cg > addG) addG = cg;
                        if (cb > addB) addB = cb;
                    }
                    r = Math.min(1.0, r + addR);
                    g = Math.min(1.0, g + addG);
                    b = Math.min(1.0, b + addB);
                }
                return [r, g, b];
            };

            for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
                const wx = cxWorld + lx;
                for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
                    for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
                        const blockId = chunk.getBlock(lx, ly, lz);
                        if (!blockId || blockId === Blocks.BLOCKS.AIR) continue;

                        const isWater = (blockId === Blocks.BLOCKS.WATER);
                        const targetPos = isWater ? waterPositions : positions;
                        const targetNorm = isWater ? waterNormals : normals;
                        const targetUvs = isWater ? waterUvs : uvs;
                        const targetColors = isWater ? waterColors : colors;

                        const wz = czWorld + lz;
                        const selfDef = (Blocks && Blocks.BLOCK_DEFS) ? Blocks.BLOCK_DEFS[blockId] : null;
                        const selfEmits = !!(selfDef && selfDef.lightLevel > 0);

                        // Thin 3D interactive Oak Door panel (rotates open when clicked)
                        if (BLOCKS_REF.DOOR_OAK !== undefined && blockId === BLOCKS_REF.DOOR_OAK) {
                            const doorOpen = this.isDoorOpen(wx, ly, wz);
                            const wallAlongX = this.isSolid(wx - 1, ly, wz) || this.isSolid(wx + 1, ly, wz);
                            let x0 = wx, x1 = wx + 1, z0 = wz, z1 = wz + 1;
                            if (wallAlongX) {
                                if (!doorOpen) { z0 = wz + 0.42; z1 = wz + 0.58; }
                                else { x0 = wx + 0.02; x1 = wx + 0.18; }
                            } else {
                                if (!doorOpen) { x0 = wx + 0.42; x1 = wx + 0.58; }
                                else { z0 = wz + 0.02; z1 = wz + 0.18; }
                            }
                            const y0 = ly, y1 = ly + 1;
                            const tileIdx = Blocks.getBlockFaceTexture(blockId, 0);
                            const { u0, v0, u1, v1 } = Blocks.getTileUV(tileIdx);
                            const doorFaces = [
                                [x1, y0, z1,  x1, y0, z0,  x1, y1, z0,  x1, y1, z1,   1, 0, 0, faceShades[0]],
                                [x0, y0, z0,  x0, y0, z1,  x0, y1, z1,  x0, y1, z0,  -1, 0, 0, faceShades[1]],
                                [x0, y1, z1,  x1, y1, z1,  x1, y1, z0,  x0, y1, z0,   0, 1, 0, faceShades[2]],
                                [x0, y0, z0,  x1, y0, z0,  x1, y0, z1,  x0, y0, z1,   0,-1, 0, faceShades[3]],
                                [x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1,   0, 0, 1, faceShades[4]],
                                [x1, y0, z0,  x0, y0, z0,  x0, y1, z0,  x1, y1, z0,   0, 0,-1, faceShades[5]]
                            ];
                            for (const df of doorFaces) {
                                const c = computeVertexColor(wx + 0.5, ly + 0.5, wz + 0.5, df[15]);
                                targetPos.push(df[0], df[1], df[2], df[3], df[4], df[5], df[6], df[7], df[8], df[0], df[1], df[2], df[6], df[7], df[8], df[9], df[10], df[11]);
                                targetUvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
                                for (let k = 0; k < 6; k++) {
                                    targetNorm.push(df[12], df[13], df[14]);
                                    targetColors.push(c[0], c[1], c[2]);
                                }
                            }
                            continue;
                        }

                        // X-Mesh crossed diagonal billboards for flowers, tall grass, wheat, lanterns, and torches
                        if (selfDef && selfDef.crossMesh) {
                            const tileIdx = Blocks.getBlockFaceTexture(blockId, 0);
                            const { u0, v0, u1, v1 } = Blocks.getTileUV(tileIdx);
                            const cShade = selfEmits ? 1.0 : 0.92;
                            const cCol = selfEmits ? [1.0, 1.0, 1.0] : computeVertexColor(wx + 0.5, ly + 0.5, wz + 0.5, cShade);
                            const x0 = wx + 0.15, x1 = wx + 0.85;
                            const y0 = ly,        y1 = ly + 0.90;
                            const z0 = wz + 0.15, z1 = wz + 0.85;

                            const crossQuads = [
                                [x0, y0, z0,  x1, y0, z1,  x1, y1, z1,  x0, y1, z0,   0.707, 0, -0.707],
                                [x1, y0, z1,  x0, y0, z0,  x0, y1, z0,  x1, y1, z1,  -0.707, 0,  0.707],
                                [x0, y0, z1,  x1, y0, z0,  x1, y1, z0,  x0, y1, z1,   0.707, 0,  0.707],
                                [x1, y0, z0,  x0, y0, z1,  x0, y1, z1,  x1, y1, z0,  -0.707, 0, -0.707]
                            ];

                            for (const q of crossQuads) {
                                targetPos.push(
                                    q[0], q[1], q[2],
                                    q[3], q[4], q[5],
                                    q[6], q[7], q[8],
                                    q[0], q[1], q[2],
                                    q[6], q[7], q[8],
                                    q[9], q[10], q[11]
                                );
                                targetUvs.push(
                                    u0, v0, u1, v0, u1, v1,
                                    u0, v0, u1, v1, u0, v1
                                );
                                for (let k = 0; k < 6; k++) {
                                    targetNorm.push(q[12], q[13], q[14]);
                                    targetColors.push(cCol[0], cCol[1], cCol[2]);
                                }
                            }
                            continue;
                        }

                        // Check 6 adjacent neighbors (pass false to avoid cascading chunk creation)
                        // 0: +X, 1: -X, 2: +Y, 3: -Y, 4: +Z, 5: -Z
                        const neighbors = [
                            this.getBlock(wx + 1, ly, wz, false),
                            this.getBlock(wx - 1, ly, wz, false),
                            this.getBlock(wx, ly + 1, wz, false),
                            this.getBlock(wx, ly - 1, wz, false),
                            this.getBlock(wx, ly, wz + 1, false),
                            this.getBlock(wx, ly, wz - 1, false)
                        ];

                        for (let f = 0; f < 6; f++) {
                            const nBlock = neighbors[f];
                            const nDef = (nBlock && Blocks && Blocks.BLOCK_DEFS) ? Blocks.BLOCK_DEFS[nBlock] : null;
                            const nTransparent = (nBlock === 0) || (nDef && nDef.transparent);

                            // Water faces: only show if neighbor is NOT water and is transparent/air
                            if (isWater) {
                                if (nBlock === Blocks.BLOCKS.WATER) continue;
                                if (!nTransparent) continue;
                            } else {
                                // Solid faces: show if neighbor is transparent or air
                                if (nBlock !== 0 && !nTransparent) {
                                    continue;
                                }
                            }

                            // Build face geometry
                            const tileIdx = Blocks.getBlockFaceTexture(blockId, f);
                            const { u0, v0, u1, v1 } = Blocks.getTileUV(tileIdx);
                            const neighborEmits = !!(nDef && nDef.lightLevel > 0);
                            let shade = faceShades[f];
                            if (neighborEmits) {
                                shade = Math.min(1.0, shade * 1.32);
                            }

                            // Vertex coordinates for 6 faces (lower surface for non-submerged water)
                            const topY = (isWater && neighbors[2] !== Blocks.BLOCKS.WATER) ? ly + 0.88 : ly + 1;
                            let p = [];
                            let norm = [];
                            if (f === 0) { // +X
                                p = [
                                    wx + 1, ly, wz + 1,
                                    wx + 1, ly, wz,
                                    wx + 1, topY, wz,
                                    wx + 1, topY, wz + 1
                                ];
                                norm = [1, 0, 0];
                            } else if (f === 1) { // -X
                                p = [
                                    wx, ly, wz,
                                    wx, ly, wz + 1,
                                    wx, topY, wz + 1,
                                    wx, topY, wz
                                ];
                                norm = [-1, 0, 0];
                            } else if (f === 2) { // +Y
                                p = [
                                    wx, topY, wz + 1,
                                    wx + 1, topY, wz + 1,
                                    wx + 1, topY, wz,
                                    wx, topY, wz
                                ];
                                norm = [0, 1, 0];
                            } else if (f === 3) { // -Y
                                p = [
                                    wx, ly, wz,
                                    wx + 1, ly, wz,
                                    wx + 1, ly, wz + 1,
                                    wx, ly, wz + 1
                                ];
                                norm = [0, -1, 0];
                            } else if (f === 4) { // +Z
                                p = [
                                    wx, ly, wz + 1,
                                    wx + 1, ly, wz + 1,
                                    wx + 1, topY, wz + 1,
                                    wx, topY, wz + 1
                                ];
                                norm = [0, 0, 1];
                            } else if (f === 5) { // -Z
                                p = [
                                    wx + 1, ly, wz,
                                    wx, ly, wz,
                                    wx, topY, wz,
                                    wx + 1, topY, wz
                                ];
                                norm = [0, 0, -1];
                            }

                            if (isWater) {
                                const wCol = computeVertexColor(wx + 0.5, topY, wz + 0.5, shade, 0.90, 0.96, 1.0);
                                // 2 Triangles (indices 0, 1, 2 and 0, 2, 3)
                                // Triangle 1
                                targetPos.push(
                                    p[0], p[1], p[2],
                                    p[3], p[4], p[5],
                                    p[6], p[7], p[8]
                                );
                                targetUvs.push(
                                    u0, v0,
                                    u1, v0,
                                    u1, v1
                                );
                                // Triangle 2
                                targetPos.push(
                                    p[0], p[1], p[2],
                                    p[6], p[7], p[8],
                                    p[9], p[10], p[11]
                                );
                                targetUvs.push(
                                    u0, v0,
                                    u1, v1,
                                    u0, v1
                                );

                                for (let k = 0; k < 6; k++) {
                                    targetNorm.push(norm[0], norm[1], norm[2]);
                                    targetColors.push(wCol[0], wCol[1], wCol[2]);
                                }
                            } else {
                                // Compute AO for 4 vertices
                                const nx = norm[0];
                                const ny = norm[1];
                                const nz = norm[2];
                                const bx = wx + nx;
                                const by = ly + ny;
                                const bz = wz + nz;

                                let ao0, ao1, ao2, ao3;
                                if (selfEmits) {
                                    ao0 = 3; ao1 = 3; ao2 = 3; ao3 = 3;
                                } else {
                                    const aos = [];
                                    for (let v = 0; v < 4; v++) {
                                        const vx = p[v * 3];
                                        const vy = p[v * 3 + 1];
                                        const vz = p[v * 3 + 2];
                                        const sx = (vx === wx + 1) ? 1 : -1;
                                        const sy = (vy === ly + 1) ? 1 : -1;
                                        const sz = (vz === wz + 1) ? 1 : -1;

                                        let s1 = false, s2 = false, corner = false;
                                        if (nx !== 0) {
                                            s1 = this.isOpaqueForAO(bx, ly + sy, wz);
                                            s2 = this.isOpaqueForAO(bx, ly, wz + sz);
                                            corner = this.isOpaqueForAO(bx, ly + sy, wz + sz);
                                        } else if (ny !== 0) {
                                            s1 = this.isOpaqueForAO(wx + sx, by, wz);
                                            s2 = this.isOpaqueForAO(wx, by, wz + sz);
                                            corner = this.isOpaqueForAO(wx + sx, by, wz + sz);
                                        } else if (nz !== 0) {
                                            s1 = this.isOpaqueForAO(wx + sx, ly, bz);
                                            s2 = this.isOpaqueForAO(wx, ly + sy, bz);
                                            corner = this.isOpaqueForAO(wx + sx, ly + sy, bz);
                                        }
                                        aos.push(this.getVertexAO(s1, s2, corner));
                                    }
                                    ao0 = aos[0];
                                    ao1 = aos[1];
                                    ao2 = aos[2];
                                    ao3 = aos[3];
                                }

                                const s0 = selfEmits ? 1.0 : shade * aoTable[ao0];
                                const s1 = selfEmits ? 1.0 : shade * aoTable[ao1];
                                const s2 = selfEmits ? 1.0 : shade * aoTable[ao2];
                                const s3 = selfEmits ? 1.0 : shade * aoTable[ao3];

                                const c0 = selfEmits ? [1.0, 1.0, 1.0] : computeVertexColor(p[0], p[1], p[2], s0);
                                const c1 = selfEmits ? [1.0, 1.0, 1.0] : computeVertexColor(p[3], p[4], p[5], s1);
                                const c2 = selfEmits ? [1.0, 1.0, 1.0] : computeVertexColor(p[6], p[7], p[8], s2);
                                const c3 = selfEmits ? [1.0, 1.0, 1.0] : computeVertexColor(p[9], p[10], p[11], s3);

                                const flip = (ao0 + ao2 < ao1 + ao3);
                                if (!flip) {
                                    // Triangle 1: (0, 1, 2)
                                    targetPos.push(
                                        p[0], p[1], p[2],
                                        p[3], p[4], p[5],
                                        p[6], p[7], p[8]
                                    );
                                    targetUvs.push(
                                        u0, v0,
                                        u1, v0,
                                        u1, v1
                                    );
                                    targetColors.push(
                                        c0[0], c0[1], c0[2],
                                        c1[0], c1[1], c1[2],
                                        c2[0], c2[1], c2[2]
                                    );

                                    // Triangle 2: (0, 2, 3)
                                    targetPos.push(
                                        p[0], p[1], p[2],
                                        p[6], p[7], p[8],
                                        p[9], p[10], p[11]
                                    );
                                    targetUvs.push(
                                        u0, v0,
                                        u1, v1,
                                        u0, v1
                                    );
                                    targetColors.push(
                                        c0[0], c0[1], c0[2],
                                        c2[0], c2[1], c2[2],
                                        c3[0], c3[1], c3[2]
                                    );
                                } else {
                                    // Flipped diagonal: (0, 1, 3) and (1, 2, 3)
                                    // Triangle 1: (0, 1, 3)
                                    targetPos.push(
                                        p[0], p[1], p[2],
                                        p[3], p[4], p[5],
                                        p[9], p[10], p[11]
                                    );
                                    targetUvs.push(
                                        u0, v0,
                                        u1, v0,
                                        u0, v1
                                    );
                                    targetColors.push(
                                        c0[0], c0[1], c0[2],
                                        c1[0], c1[1], c1[2],
                                        c3[0], c3[1], c3[2]
                                    );

                                    // Triangle 2: (1, 2, 3)
                                    targetPos.push(
                                        p[3], p[4], p[5],
                                        p[6], p[7], p[8],
                                        p[9], p[10], p[11]
                                    );
                                    targetUvs.push(
                                        u1, v0,
                                        u1, v1,
                                        u0, v1
                                    );
                                    targetColors.push(
                                        c1[0], c1[1], c1[2],
                                        c2[0], c2[1], c2[2],
                                        c3[0], c3[1], c3[2]
                                    );
                                }

                                for (let k = 0; k < 6; k++) {
                                    targetNorm.push(norm[0], norm[1], norm[2]);
                                }
                            }
                        }
                    }
                }
            }

            // Create or update solid mesh
            if (positions.length > 0) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

                if (!this.sharedOpaqueMaterial) {
                    this.sharedOpaqueMaterial = new THREE.MeshLambertMaterial({
                        map: atlasTexture,
                        vertexColors: true,
                        transparent: false,
                        alphaTest: 0.2
                    });
                }

                if (!chunk.mesh) {
                    chunk.mesh = new THREE.Mesh(geometry, this.sharedOpaqueMaterial);
                } else {
                    chunk.mesh.geometry.dispose();
                    chunk.mesh.geometry = geometry;
                }
            } else if (chunk.mesh) {
                if (chunk.mesh.parent) chunk.mesh.parent.remove(chunk.mesh);
                chunk.mesh.geometry.dispose();
                chunk.mesh = null;
            }

            // Create or update water mesh
            if (waterPositions.length > 0) {
                const waterGeometry = new THREE.BufferGeometry();
                waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
                waterGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(waterNormals, 3));
                waterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
                waterGeometry.setAttribute('color', new THREE.Float32BufferAttribute(waterColors, 3));

                if (!this.sharedWaterMaterial) {
                    this.sharedWaterMaterial = new THREE.MeshLambertMaterial({
                        map: atlasTexture,
                        vertexColors: true,
                        transparent: true,
                        opacity: 0.65,
                        depthWrite: false
                    });
                }

                if (!chunk.waterMesh) {
                    chunk.waterMesh = new THREE.Mesh(waterGeometry, this.sharedWaterMaterial);
                } else {
                    chunk.waterMesh.geometry.dispose();
                    chunk.waterMesh.geometry = waterGeometry;
                }
            } else if (chunk.waterMesh) {
                if (chunk.waterMesh.parent) chunk.waterMesh.parent.remove(chunk.waterMesh);
                chunk.waterMesh.geometry.dispose();
                chunk.waterMesh = null;
            }

            chunk.dirty = false;
        }

        disposeMaterials() {
            if (this.sharedOpaqueMaterial) {
                this.sharedOpaqueMaterial.dispose();
                this.sharedOpaqueMaterial = null;
            }
            if (this.sharedWaterMaterial) {
                this.sharedWaterMaterial.dispose();
                this.sharedWaterMaterial = null;
            }
        }

        saveToJSON() {
            const data = {
                seed: this.seed,
                modifications: Array.from(this.modifiedBlocks.entries()),
                openDoors: Array.from(this.openDoors)
            };
            return JSON.stringify(data);
        }

        loadFromJSON(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                if (data.seed !== undefined && data.seed !== null && !isNaN(Number(data.seed))) {
                    this.seed = Number(data.seed);
                }
                this.noise = new PerlinNoise(this.seed);
                this.biomeNoise = new PerlinNoise(this.seed + 1013);
                this.caveNoise = new PerlinNoise(this.seed + 2039);
                this.modifiedBlocks.clear();
                this.chunkModifications.clear();
                this.villages = [];
                this.openDoors.clear();
                if (data.modifications) {
                    for (const [key, id] of data.modifications) {
                        const parts = key.split(',');
                        const mx = parseInt(parts[0], 10);
                        const my = parseInt(parts[1], 10);
                        const mz = parseInt(parts[2], 10);
                        this._recordModification(mx, my, mz, id);
                    }
                }
                if (Array.isArray(data.openDoors)) {
                    for (const dk of data.openDoors) {
                        this.openDoors.add(dk);
                    }
                }
                // Clear and regenerate loaded chunks
                this.chunks.clear();
                return true;
            } catch (err) {
                console.error('Failed to load world data', err);
                return false;
            }
        }
    }

    return {
        CHUNK_SIZE_X,
        CHUNK_SIZE_Z,
        CHUNK_HEIGHT,
        SEA_LEVEL,
        Chunk,
        VoxelWorld
    };
}));
