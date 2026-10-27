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

        isSolid(x, y, z) {
            const blockId = this.getBlock(x, y, z);
            if (!blockId || !Blocks || !Blocks.BLOCK_DEFS[blockId]) return false;
            return Blocks.BLOCK_DEFS[blockId].solid;
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
                GRAVEL: 25, CRAFTING_TABLE: 26, JACK_O_LANTERN: 27, BIRCH_WOOD: 28, BIRCH_LEAVES: 29, LAVA: 30
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

                            if (y < 12 && oreRand < 0.015) {
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

                    // Pumpkin: plains or forest, height > SEA_LEVEL + 2
                    if (pumpkinBlock && (biome === 'plains' || biome === 'forest') && height > SEA_LEVEL + 2) {
                        const pumpkinHash = Math.sin(this.seed * 5.19 + wx * 31.41 + wz * 59.26) * 43758.5453;
                        const pumpkinRand = pumpkinHash - Math.floor(pumpkinHash);
                        if (pumpkinRand < 0.002) {
                            if (chunk.getBlock(lx, height, lz) === B.GRASS && chunk.getBlock(lx, height + 1, lz) === 0 && height + 1 < CHUNK_HEIGHT) {
                                chunk.setBlock(lx, height + 1, lz, pumpkinBlock);
                            }
                        }
                    }
                }
            }

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

                        const selfDef = (Blocks && Blocks.BLOCK_DEFS) ? Blocks.BLOCK_DEFS[blockId] : null;
                        const selfEmits = !!(selfDef && selfDef.lightLevel > 0);

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
                                shade = Math.min(1.0, shade * 1.25);
                            }

                            // Vertex coordinates for 6 faces
                            let p = [];
                            let norm = [];
                            if (f === 0) { // +X
                                p = [
                                    wx + 1, ly, wz + 1,
                                    wx + 1, ly, wz,
                                    wx + 1, ly + 1, wz,
                                    wx + 1, ly + 1, wz + 1
                                ];
                                norm = [1, 0, 0];
                            } else if (f === 1) { // -X
                                p = [
                                    wx, ly, wz,
                                    wx, ly, wz + 1,
                                    wx, ly + 1, wz + 1,
                                    wx, ly + 1, wz
                                ];
                                norm = [-1, 0, 0];
                            } else if (f === 2) { // +Y
                                p = [
                                    wx, ly + 1, wz + 1,
                                    wx + 1, ly + 1, wz + 1,
                                    wx + 1, ly + 1, wz,
                                    wx, ly + 1, wz
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
                                    wx + 1, ly + 1, wz + 1,
                                    wx, ly + 1, wz + 1
                                ];
                                norm = [0, 0, 1];
                            } else if (f === 5) { // -Z
                                p = [
                                    wx + 1, ly, wz,
                                    wx, ly, wz,
                                    wx, ly + 1, wz,
                                    wx + 1, ly + 1, wz
                                ];
                                norm = [0, 0, -1];
                            }

                            if (isWater) {
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
                                    targetColors.push(shade, shade, shade);
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

                                let s0, s1, s2, s3;
                                if (selfEmits) {
                                    s0 = 1.0;
                                    s1 = 1.0;
                                    s2 = 1.0;
                                    s3 = 1.0;
                                } else {
                                    s0 = shade * aoTable[ao0];
                                    s1 = shade * aoTable[ao1];
                                    s2 = shade * aoTable[ao2];
                                    s3 = shade * aoTable[ao3];
                                }

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
                                        s0, s0, s0,
                                        s1, s1, s1,
                                        s2, s2, s2
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
                                        s0, s0, s0,
                                        s2, s2, s2,
                                        s3, s3, s3
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
                                        s0, s0, s0,
                                        s1, s1, s1,
                                        s3, s3, s3
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
                                        s1, s1, s1,
                                        s2, s2, s2,
                                        s3, s3, s3
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
                modifications: Array.from(this.modifiedBlocks.entries())
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
                if (data.modifications) {
                    for (const [key, id] of data.modifications) {
                        const parts = key.split(',');
                        const mx = parseInt(parts[0], 10);
                        const my = parseInt(parts[1], 10);
                        const mz = parseInt(parts[2], 10);
                        this._recordModification(mx, my, mz, id);
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
