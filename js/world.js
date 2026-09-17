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
            this.sharedOpaqueMaterial = null;
            this.sharedWaterMaterial = null;
        }

        getChunkKey(cx, cz) {
            return `${cx},${cz}`;
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
            this.modifiedBlocks.set(`${x},${y},${z}`, blockId);

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
                COAL_ORE: 12, IRON_ORE: 13, BEDROCK: 14, GOLD_ORE: 18, DIAMOND_ORE: 19, SNOW: 20
            };

            const treesToPlant = [];

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

                    // Layering
                    chunk.setBlock(lx, 0, lz, B.BEDROCK);

                    for (let y = 1; y <= height; y++) {
                        // 3D Cave generation (Swiss cheese caves)
                        const caveVal = this.caveNoise.fbm3D(wx * 0.05, y * 0.08, wz * 0.05, 2);
                        if (y < height - 3 && caveVal > 0.55) {
                            chunk.setBlock(lx, y, lz, B.AIR);
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
                            if (biome === 'desert' || height <= SEA_LEVEL + 1) {
                                chunk.setBlock(lx, y, lz, B.SAND);
                            } else {
                                chunk.setBlock(lx, y, lz, B.DIRT);
                            }
                        } else {
                            // Top surface block
                            if (biome === 'desert') {
                                chunk.setBlock(lx, y, lz, B.SAND);
                            } else if (height <= SEA_LEVEL + 1) {
                                chunk.setBlock(lx, y, lz, B.SAND);
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

                // Trunk
                for (let ty = 0; ty < trunkHeight; ty++) {
                    if (t.y + ty < CHUNK_HEIGHT) {
                        chunk.setBlock(t.lx, t.y + ty, t.lz, B.WOOD);
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
                                    chunk.setBlock(fx, fy, fz, B.LEAVES);
                                }
                            }
                        }
                    }
                }
            }

            // Apply saved modifications if any exist for this chunk
            for (const [key, blockId] of this.modifiedBlocks.entries()) {
                const parts = key.split(',');
                const mx = parseInt(parts[0], 10);
                const my = parseInt(parts[1], 10);
                const mz = parseInt(parts[2], 10);
                const mcx = Math.floor(mx / CHUNK_SIZE_X);
                const mcz = Math.floor(mz / CHUNK_SIZE_Z);
                if (mcx === chunk.chunkX && mcz === chunk.chunkZ) {
                    const lx = (mx % CHUNK_SIZE_X + CHUNK_SIZE_X) % CHUNK_SIZE_X;
                    const lz = (mz % CHUNK_SIZE_Z + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
                    chunk.setBlock(lx, my, lz, blockId);
                    chunk.hasModifications = true;
                }
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

                        for (let f = 0; f < 6; f++) {
                            const nBlock = neighbors[f];
                            const nTransparent = (nBlock === 0) || (Blocks && Blocks.BLOCK_DEFS[nBlock] && Blocks.BLOCK_DEFS[nBlock].transparent);

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
                            const shade = faceShades[f];

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
                if (data.modifications) {
                    for (const [key, id] of data.modifications) {
                        this.modifiedBlocks.set(key, id);
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
