/**
 * blocks.js - Block Registry and Procedural Texture Generator for Minecraft Lite.
 * Universal Module Definition (UMD) compatible with Browser and Node.js.
 */
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory();
    } else {
        root.Blocks = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    const BLOCKS = {
        AIR: 0,
        GRASS: 1,
        DIRT: 2,
        STONE: 3,
        COBBLESTONE: 4,
        WOOD: 5,
        LEAVES: 6,
        PLANKS: 7,
        BRICK: 8,
        SAND: 9,
        GLASS: 10,
        WATER: 11,
        COAL_ORE: 12,
        IRON_ORE: 13,
        BEDROCK: 14,
        TNT: 15,
        BOOKSHELF: 16,
        OBSIDIAN: 17,
        GOLD_ORE: 18,
        DIAMOND_ORE: 19,
        SNOW: 20,
        GLOWSTONE: 21,
        MOSSY_COBBLESTONE: 22,
        CACTUS: 23,
        PUMPKIN: 24,
        GRAVEL: 25,
        CRAFTING_TABLE: 26,
        JACK_O_LANTERN: 27,
        BIRCH_WOOD: 28,
        BIRCH_LEAVES: 29,
        LAVA: 30,
        TORCH: 31,
        BED: 32,
        LADDER: 33,
        FLOWER_RED: 34,
        FLOWER_YELLOW: 35,
        TALL_GRASS: 36,
        PICKAXE_DIAMOND: 37,
        SWORD_DIAMOND: 38
    };

    // Texture tile coordinates in 16x16 grid (index = tileY * 16 + tileX)
    const TILES = {
        EMPTY: 0,
        GRASS_TOP: 1,
        GRASS_SIDE: 2,
        DIRT: 3,
        STONE: 4,
        COBBLESTONE: 5,
        WOOD_SIDE: 6,
        WOOD_TOP: 7,
        LEAVES: 8,
        PLANKS: 9,
        BRICK: 10,
        SAND: 11,
        GLASS: 12,
        WATER: 13,
        COAL_ORE: 14,
        IRON_ORE: 15,
        BEDROCK: 16,
        TNT_SIDE: 17,
        TNT_TOP: 18,
        TNT_BOTTOM: 19,
        BOOKSHELF_SIDE: 20,
        OBSIDIAN: 21,
        GOLD_ORE: 22,
        DIAMOND_ORE: 23,
        SNOW_TOP: 24,
        SNOW_SIDE: 25,
        GLOWSTONE: 26,
        MOSSY_COBBLESTONE: 27,
        CACTUS_SIDE: 28,
        CACTUS_TOP: 29,
        PUMPKIN_TOP: 30,
        PUMPKIN_SIDE: 31,
        PUMPKIN_FRONT: 32,
        GRAVEL: 33,
        CRAFTING_TOP: 34,
        CRAFTING_SIDE: 35,
        CRAFTING_FRONT: 36,
        JACK_O_LANTERN_FRONT: 37,
        BIRCH_SIDE: 38,
        BIRCH_TOP: 39,
        BIRCH_LEAVES: 40,
        LAVA: 41,
        TORCH: 42,
        BED_TOP: 43,
        BED_SIDE: 44,
        LADDER: 45,
        FLOWER_RED: 46,
        FLOWER_YELLOW: 47,
        TALL_GRASS: 48,
        PICKAXE_DIAMOND: 49,
        SWORD_DIAMOND: 50,
        CRACK_0: 240,
        CRACK_1: 241,
        CRACK_2: 242,
        CRACK_3: 243,
        CRACK_4: 244,
        CRACK_5: 245,
        CRACK_6: 246,
        CRACK_7: 247,
        CRACK_8: 248,
        CRACK_9: 249
    };

    const BLOCK_DEFS = {
        [BLOCKS.AIR]: {
            id: BLOCKS.AIR,
            name: 'Air',
            solid: false,
            transparent: true,
            liquid: false,
            hardness: 0,
            sound: 'none'
        },
        [BLOCKS.GRASS]: {
            id: BLOCKS.GRASS,
            name: 'Grass Block',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.45,
            sound: 'grass',
            textures: {
                top: TILES.GRASS_TOP,
                bottom: TILES.DIRT,
                sides: TILES.GRASS_SIDE
            }
        },
        [BLOCKS.DIRT]: {
            id: BLOCKS.DIRT,
            name: 'Dirt',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.4,
            sound: 'grass',
            textures: {
                all: TILES.DIRT
            }
        },
        [BLOCKS.STONE]: {
            id: BLOCKS.STONE,
            name: 'Stone',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 1.1,
            sound: 'stone',
            textures: {
                all: TILES.STONE
            }
        },
        [BLOCKS.COBBLESTONE]: {
            id: BLOCKS.COBBLESTONE,
            name: 'Cobblestone',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 1.2,
            sound: 'stone',
            textures: {
                all: TILES.COBBLESTONE
            }
        },
        [BLOCKS.WOOD]: {
            id: BLOCKS.WOOD,
            name: 'Oak Wood Log',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.85,
            sound: 'wood',
            textures: {
                top: TILES.WOOD_TOP,
                bottom: TILES.WOOD_TOP,
                sides: TILES.WOOD_SIDE
            }
        },
        [BLOCKS.LEAVES]: {
            id: BLOCKS.LEAVES,
            name: 'Oak Leaves',
            solid: true,
            transparent: true,
            liquid: false,
            hardness: 0.2,
            sound: 'grass',
            textures: {
                all: TILES.LEAVES
            }
        },
        [BLOCKS.PLANKS]: {
            id: BLOCKS.PLANKS,
            name: 'Wooden Planks',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.8,
            sound: 'wood',
            textures: {
                all: TILES.PLANKS
            }
        },
        [BLOCKS.BRICK]: {
            id: BLOCKS.BRICK,
            name: 'Bricks',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 1.3,
            sound: 'stone',
            textures: {
                all: TILES.BRICK
            }
        },
        [BLOCKS.SAND]: {
            id: BLOCKS.SAND,
            name: 'Sand',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.4,
            gravity: true,
            sound: 'sand',
            textures: {
                all: TILES.SAND
            }
        },
        [BLOCKS.GLASS]: {
            id: BLOCKS.GLASS,
            name: 'Glass',
            solid: true,
            transparent: true,
            liquid: false,
            hardness: 0.25,
            sound: 'glass',
            textures: {
                all: TILES.GLASS
            }
        },
        [BLOCKS.WATER]: {
            id: BLOCKS.WATER,
            name: 'Water',
            solid: false,
            transparent: true,
            liquid: true,
            hardness: 0,
            sound: 'water',
            textures: {
                all: TILES.WATER
            }
        },
        [BLOCKS.COAL_ORE]: {
            id: BLOCKS.COAL_ORE,
            name: 'Coal Ore',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 1.4,
            sound: 'stone',
            textures: {
                all: TILES.COAL_ORE
            }
        },
        [BLOCKS.IRON_ORE]: {
            id: BLOCKS.IRON_ORE,
            name: 'Iron Ore',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 1.6,
            sound: 'stone',
            textures: {
                all: TILES.IRON_ORE
            }
        },
        [BLOCKS.BEDROCK]: {
            id: BLOCKS.BEDROCK,
            name: 'Bedrock',
            solid: true,
            transparent: false,
            liquid: false,
            unbreakable: true,
            hardness: Infinity,
            sound: 'stone',
            textures: {
                all: TILES.BEDROCK
            }
        },
        [BLOCKS.TNT]: {
            id: BLOCKS.TNT,
            name: 'TNT',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.25,
            sound: 'grass',
            textures: {
                top: TILES.TNT_TOP,
                bottom: TILES.TNT_BOTTOM,
                sides: TILES.TNT_SIDE
            }
        },
        [BLOCKS.BOOKSHELF]: {
            id: BLOCKS.BOOKSHELF,
            name: 'Bookshelf',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.75,
            sound: 'wood',
            textures: {
                top: TILES.PLANKS,
                bottom: TILES.PLANKS,
                sides: TILES.BOOKSHELF_SIDE
            }
        },
        [BLOCKS.OBSIDIAN]: {
            id: BLOCKS.OBSIDIAN,
            name: 'Obsidian',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 3.2,
            sound: 'stone',
            textures: {
                all: TILES.OBSIDIAN
            }
        },
        [BLOCKS.GOLD_ORE]: {
            id: BLOCKS.GOLD_ORE,
            name: 'Gold Ore',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 1.8,
            sound: 'stone',
            textures: {
                all: TILES.GOLD_ORE
            }
        },
        [BLOCKS.DIAMOND_ORE]: {
            id: BLOCKS.DIAMOND_ORE,
            name: 'Diamond Ore',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 2.0,
            sound: 'stone',
            textures: {
                all: TILES.DIAMOND_ORE
            }
        },
        [BLOCKS.SNOW]: {
            id: BLOCKS.SNOW,
            name: 'Snow Block',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.3,
            sound: 'grass',
            textures: {
                top: TILES.SNOW_TOP,
                bottom: TILES.DIRT,
                sides: TILES.SNOW_SIDE
            }
        },
        [BLOCKS.GLOWSTONE]: {
            id: BLOCKS.GLOWSTONE,
            name: 'Glowstone',
            solid: true,
            transparent: false,
            liquid: false,
            lightLevel: 15,
            hardness: 0.45,
            sound: 'glass',
            textures: {
                all: TILES.GLOWSTONE
            }
        },
        [BLOCKS.MOSSY_COBBLESTONE]: {
            id: BLOCKS.MOSSY_COBBLESTONE,
            name: 'Mossy Cobblestone',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 1.2,
            sound: 'stone',
            textures: {
                all: TILES.MOSSY_COBBLESTONE
            }
        },
        [BLOCKS.CACTUS]: {
            id: BLOCKS.CACTUS,
            name: 'Cactus',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.4,
            damageOnContact: true,
            sound: 'grass',
            textures: {
                top: TILES.CACTUS_TOP,
                bottom: TILES.CACTUS_TOP,
                sides: TILES.CACTUS_SIDE
            }
        },
        [BLOCKS.PUMPKIN]: {
            id: BLOCKS.PUMPKIN,
            name: 'Pumpkin',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.6,
            sound: 'wood',
            textures: {
                top: TILES.PUMPKIN_TOP,
                bottom: TILES.PUMPKIN_TOP,
                front: TILES.PUMPKIN_FRONT,
                sides: TILES.PUMPKIN_SIDE
            }
        },
        [BLOCKS.GRAVEL]: {
            id: BLOCKS.GRAVEL,
            name: 'Gravel',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.45,
            gravity: true,
            sound: 'sand',
            textures: {
                all: TILES.GRAVEL
            }
        },
        [BLOCKS.CRAFTING_TABLE]: {
            id: BLOCKS.CRAFTING_TABLE,
            name: 'Crafting Table',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.85,
            interactive: true,
            sound: 'wood',
            textures: {
                top: TILES.CRAFTING_TOP,
                bottom: TILES.PLANKS,
                front: TILES.CRAFTING_FRONT,
                sides: TILES.CRAFTING_SIDE
            }
        },
        [BLOCKS.JACK_O_LANTERN]: {
            id: BLOCKS.JACK_O_LANTERN,
            name: "Jack o'Lantern",
            solid: true,
            transparent: false,
            liquid: false,
            lightLevel: 15,
            hardness: 0.6,
            sound: 'wood',
            textures: {
                top: TILES.PUMPKIN_TOP,
                bottom: TILES.PUMPKIN_TOP,
                front: TILES.JACK_O_LANTERN_FRONT,
                sides: TILES.PUMPKIN_SIDE
            }
        },
        [BLOCKS.BIRCH_WOOD]: {
            id: BLOCKS.BIRCH_WOOD,
            name: 'Birch Wood Log',
            solid: true,
            transparent: false,
            liquid: false,
            hardness: 0.85,
            sound: 'wood',
            textures: {
                top: TILES.BIRCH_TOP,
                bottom: TILES.BIRCH_TOP,
                sides: TILES.BIRCH_SIDE
            }
        },
        [BLOCKS.BIRCH_LEAVES]: {
            id: BLOCKS.BIRCH_LEAVES,
            name: 'Birch Leaves',
            solid: true,
            transparent: true,
            liquid: false,
            hardness: 0.2,
            sound: 'grass',
            textures: {
                all: TILES.BIRCH_LEAVES
            }
        },
        [BLOCKS.LAVA]: {
            id: BLOCKS.LAVA,
            name: 'Lava',
            solid: true,
            transparent: false,
            liquid: true,
            lightLevel: 15,
            hardness: 0.5,
            damageOnContact: true,
            contactDamage: 3,
            sound: 'stone',
            textures: {
                all: TILES.LAVA
            }
        },
        [BLOCKS.TORCH]: {
            id: BLOCKS.TORCH,
            name: 'Torch',
            solid: false,
            transparent: true,
            liquid: false,
            targetable: true,
            crossMesh: true,
            lightLevel: 15,
            hardness: 0.1,
            sound: 'wood',
            textures: {
                all: TILES.TORCH
            }
        },
        [BLOCKS.BED]: {
            id: BLOCKS.BED,
            name: 'Bed',
            solid: true,
            transparent: false,
            liquid: false,
            interactive: true,
            hardness: 0.4,
            sound: 'wood',
            textures: {
                top: TILES.BED_TOP,
                bottom: TILES.PLANKS,
                sides: TILES.BED_SIDE
            }
        },
        [BLOCKS.LADDER]: {
            id: BLOCKS.LADDER,
            name: 'Ladder',
            solid: false,
            transparent: true,
            liquid: false,
            targetable: true,
            climbable: true,
            hardness: 0.4,
            sound: 'wood',
            textures: {
                all: TILES.LADDER
            }
        },
        [BLOCKS.FLOWER_RED]: {
            id: BLOCKS.FLOWER_RED,
            name: 'Poppy Flower',
            solid: false,
            transparent: true,
            liquid: false,
            targetable: true,
            crossMesh: true,
            hardness: 0.05,
            sound: 'grass',
            textures: {
                all: TILES.FLOWER_RED
            }
        },
        [BLOCKS.FLOWER_YELLOW]: {
            id: BLOCKS.FLOWER_YELLOW,
            name: 'Dandelion Flower',
            solid: false,
            transparent: true,
            liquid: false,
            targetable: true,
            crossMesh: true,
            hardness: 0.05,
            sound: 'grass',
            textures: {
                all: TILES.FLOWER_YELLOW
            }
        },
        [BLOCKS.TALL_GRASS]: {
            id: BLOCKS.TALL_GRASS,
            name: 'Tall Grass',
            solid: false,
            transparent: true,
            liquid: false,
            targetable: true,
            crossMesh: true,
            hardness: 0.05,
            sound: 'grass',
            textures: {
                all: TILES.TALL_GRASS
            }
        },
        [BLOCKS.PICKAXE_DIAMOND]: {
            id: BLOCKS.PICKAXE_DIAMOND,
            name: 'Diamond Pickaxe',
            solid: false,
            transparent: true,
            liquid: false,
            isTool: true,
            miningSpeedMultiplier: 3.5,
            hardness: 0.5,
            sound: 'stone',
            textures: {
                all: TILES.PICKAXE_DIAMOND
            }
        },
        [BLOCKS.SWORD_DIAMOND]: {
            id: BLOCKS.SWORD_DIAMOND,
            name: 'Diamond Sword',
            solid: false,
            transparent: true,
            liquid: false,
            isTool: true,
            attackDamage: 12,
            hardness: 0.5,
            sound: 'stone',
            textures: {
                all: TILES.SWORD_DIAMOND
            }
        }
    };

    // Helper to get texture index for a given face
    // Face: 0=+X (east), 1=-X (west), 2=+Y (top), 3=-Y (bottom), 4=+Z (south), 5=-Z (north)
    function getBlockFaceTexture(blockId, faceIndex) {
        const def = BLOCK_DEFS[blockId];
        if (!def || !def.textures) return TILES.EMPTY;
        if (def.textures.all !== undefined) return def.textures.all;
        if (faceIndex === 2) return def.textures.top !== undefined ? def.textures.top : def.textures.sides;
        if (faceIndex === 3) return def.textures.bottom !== undefined ? def.textures.bottom : def.textures.sides;
        if (faceIndex === 4 && def.textures.front !== undefined) return def.textures.front;
        return def.textures.sides;
    }

    // Convert tile index (0..255) to UV coordinates in a 16x16 grid
    function getTileUV(tileIndex) {
        const tileX = tileIndex % 16;
        const tileY = Math.floor(tileIndex / 16);
        const eps = 0.0001; // prevent texture bleeding
        const u0 = (tileX) / 16 + eps;
        const u1 = (tileX + 1) / 16 - eps;
        // In WebGL, v=0 is at bottom, v=1 is at top
        const v0 = 1 - (tileY + 1) / 16 + eps;
        const v1 = 1 - (tileY) / 16 - eps;
        return { u0, v0, u1, v1 };
    }

    /**
     * Procedural Pixel Art Texture Generator
     * Generates a canvas containing the 256x256 texture atlas (16x16 tiles of 16x16 pixels).
     */
    function createTextureAtlasCanvas() {
        if (typeof document === 'undefined') return null;

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Deterministic pseudo-random for noise in textures
        let seed = 42;
        function rnd() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        }

        function setPixel(tx, ty, px, py, r, g, b, a = 255) {
            ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a / 255})`;
            ctx.fillRect(tx * 16 + px, ty * 16 + py, 1, 1);
        }

        function fillTile(tileIdx, drawFn) {
            const tx = tileIdx % 16;
            const ty = Math.floor(tileIdx / 16);
            for (let py = 0; py < 16; py++) {
                for (let px = 0; px < 16; px++) {
                    drawFn(tx, ty, px, py);
                }
            }
        }

        // 1. GRASS_TOP
        fillTile(TILES.GRASS_TOP, (tx, ty, px, py) => {
            const n = rnd();
            const r = 90 + n * 30;
            const g = 145 + n * 45;
            const b = 35 + n * 20;
            setPixel(tx, ty, px, py, r, g, b);
        });

        // 2. GRASS_SIDE
        fillTile(TILES.GRASS_SIDE, (tx, ty, px, py) => {
            // Fringe depth varies between row 2 and 4
            const fringe = 3 + Math.floor(rnd() * 2);
            if (py <= fringe) {
                const n = rnd();
                setPixel(tx, ty, px, py, 90 + n * 30, 145 + n * 45, 35 + n * 20);
            } else {
                const n = rnd();
                setPixel(tx, ty, px, py, 115 + n * 25, 80 + n * 20, 50 + n * 15);
            }
        });

        // 3. DIRT
        fillTile(TILES.DIRT, (tx, ty, px, py) => {
            const n = rnd();
            setPixel(tx, ty, px, py, 115 + n * 30, 80 + n * 25, 50 + n * 20);
        });

        // 4. STONE
        fillTile(TILES.STONE, (tx, ty, px, py) => {
            const n = rnd();
            const shade = 115 + n * 35;
            setPixel(tx, ty, px, py, shade, shade, shade);
        });

        // 5. COBBLESTONE
        fillTile(TILES.COBBLESTONE, (tx, ty, px, py) => {
            const isBorder = (px === 0 || px === 7 || px === 8 || px === 15 || py === 0 || py === 7 || py === 8 || py === 15);
            const n = rnd();
            if (isBorder && rnd() > 0.4) {
                setPixel(tx, ty, px, py, 60 + n * 20, 60 + n * 20, 60 + n * 20);
            } else {
                const shade = 100 + n * 45;
                setPixel(tx, ty, px, py, shade, shade, shade);
            }
        });

        // 6. WOOD_SIDE (Tree trunk bark)
        fillTile(TILES.WOOD_SIDE, (tx, ty, px, py) => {
            const isBarkRidge = (px % 4 === 0) || (rnd() > 0.8);
            const n = rnd();
            if (isBarkRidge) {
                setPixel(tx, ty, px, py, 75 + n * 15, 55 + n * 10, 30 + n * 10);
            } else {
                setPixel(tx, ty, px, py, 105 + n * 25, 80 + n * 20, 50 + n * 15);
            }
        });

        // 7. WOOD_TOP (Rings)
        fillTile(TILES.WOOD_TOP, (tx, ty, px, py) => {
            const dx = px - 7.5;
            const dy = py - 7.5;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ring = Math.floor(dist) % 2 === 0;
            const n = rnd();
            if (dist > 7) {
                // Outer bark
                setPixel(tx, ty, px, py, 75 + n * 15, 55 + n * 10, 30 + n * 10);
            } else if (ring) {
                setPixel(tx, ty, px, py, 165 + n * 20, 135 + n * 15, 95 + n * 10);
            } else {
                setPixel(tx, ty, px, py, 185 + n * 20, 150 + n * 15, 105 + n * 10);
            }
        });

        // 8. LEAVES
        fillTile(TILES.LEAVES, (tx, ty, px, py) => {
            const n = rnd();
            if (rnd() > 0.85) {
                // Tiny leaf gaps
                setPixel(tx, ty, px, py, 0, 0, 0, 0);
            } else {
                setPixel(tx, ty, px, py, 45 + n * 30, 110 + n * 45, 25 + n * 20, 240);
            }
        });

        // 9. PLANKS
        fillTile(TILES.PLANKS, (tx, ty, px, py) => {
            const isSeam = (py % 4 === 0) || (py < 4 && px === 8) || (py >= 4 && py < 8 && px === 0) ||
                           (py >= 8 && py < 12 && px === 12) || (py >= 12 && px === 4);
            const n = rnd();
            if (isSeam) {
                setPixel(tx, ty, px, py, 130 + n * 15, 95 + n * 10, 55 + n * 10);
            } else {
                setPixel(tx, ty, px, py, 175 + n * 25, 135 + n * 20, 85 + n * 15);
            }
        });

        // 10. BRICK
        fillTile(TILES.BRICK, (tx, ty, px, py) => {
            const row = Math.floor(py / 4);
            const isMortarY = (py % 4 === 0);
            const isMortarX = (row % 2 === 0 ? (px % 8 === 0) : ((px + 4) % 8 === 0));
            const n = rnd();
            if (isMortarY || isMortarX) {
                setPixel(tx, ty, px, py, 200 + n * 20, 195 + n * 20, 190 + n * 20);
            } else {
                setPixel(tx, ty, px, py, 160 + n * 30, 65 + n * 20, 55 + n * 20);
            }
        });

        // 11. SAND
        fillTile(TILES.SAND, (tx, ty, px, py) => {
            const n = rnd();
            setPixel(tx, ty, px, py, 215 + n * 25, 205 + n * 20, 155 + n * 20);
        });

        // 12. GLASS
        fillTile(TILES.GLASS, (tx, ty, px, py) => {
            const isBorder = (px === 0 || px === 15 || py === 0 || py === 15);
            const isStreak = (px === py && px > 2 && px < 7) || (px === py + 4 && px > 8 && px < 13);
            if (isBorder) {
                setPixel(tx, ty, px, py, 220, 240, 255, 200);
            } else if (isStreak) {
                setPixel(tx, ty, px, py, 255, 255, 255, 160);
            } else {
                setPixel(tx, ty, px, py, 200, 230, 255, 30);
            }
        });

        // 13. WATER
        fillTile(TILES.WATER, (tx, ty, px, py) => {
            const n = rnd();
            setPixel(tx, ty, px, py, 40 + n * 20, 90 + n * 30, 210 + n * 35, 200);
        });

        // Helper for Ores
        function drawOre(tx, ty, px, py, rOre, gOre, bOre) {
            const isOreSpot = ((px === 4 && py === 5) || (px === 5 && py === 5) || (px === 4 && py === 6) ||
                               (px === 10 && py === 11) || (px === 11 && py === 11) || (px === 11 && py === 10) ||
                               (px === 8 && py === 4) || (px === 9 && py === 4) || (px === 3 && py === 12));
            const n = rnd();
            if (isOreSpot) {
                setPixel(tx, ty, px, py, rOre + n * 20, gOre + n * 20, bOre + n * 20);
            } else {
                const shade = 115 + n * 35;
                setPixel(tx, ty, px, py, shade, shade, shade);
            }
        }

        // 14. COAL_ORE
        fillTile(TILES.COAL_ORE, (tx, ty, px, py) => {
            drawOre(tx, ty, px, py, 25, 25, 25);
        });

        // 15. IRON_ORE
        fillTile(TILES.IRON_ORE, (tx, ty, px, py) => {
            drawOre(tx, ty, px, py, 215, 175, 145);
        });

        // 16. BEDROCK
        fillTile(TILES.BEDROCK, (tx, ty, px, py) => {
            const n = rnd();
            const shade = (n > 0.6) ? (70 + n * 30) : (20 + n * 25);
            setPixel(tx, ty, px, py, shade, shade, shade);
        });

        // 17. TNT_SIDE
        fillTile(TILES.TNT_SIDE, (tx, ty, px, py) => {
            const isBand = (py >= 6 && py <= 9);
            const n = rnd();
            if (isBand) {
                // White label band with "TNT" simulation
                if ((px >= 3 && px <= 5 && (py === 6 || px === 4)) || // T
                    (px >= 7 && px <= 9 && (px === 7 || px === 9 || px === py - 1)) || // N
                    (px >= 11 && px <= 13 && (py === 6 || px === 12))) { // T
                    setPixel(tx, ty, px, py, 20, 20, 20);
                } else {
                    setPixel(tx, ty, px, py, 240, 240, 240);
                }
            } else {
                setPixel(tx, ty, px, py, 190 + n * 30, 40 + n * 20, 30 + n * 20);
            }
        });

        // 18. TNT_TOP
        fillTile(TILES.TNT_TOP, (tx, ty, px, py) => {
            const isFuse = (px >= 7 && px <= 8 && py >= 7 && py <= 8);
            const n = rnd();
            if (isFuse) {
                setPixel(tx, ty, px, py, 30, 30, 30);
            } else {
                setPixel(tx, ty, px, py, 180 + n * 30, 40 + n * 20, 30 + n * 20);
            }
        });

        // 19. TNT_BOTTOM
        fillTile(TILES.TNT_BOTTOM, (tx, ty, px, py) => {
            const n = rnd();
            setPixel(tx, ty, px, py, 170 + n * 30, 40 + n * 20, 30 + n * 20);
        });

        // 20. BOOKSHELF_SIDE
        fillTile(TILES.BOOKSHELF_SIDE, (tx, ty, px, py) => {
            const isBorder = (py === 0 || py === 7 || py === 8 || py === 15);
            const n = rnd();
            if (isBorder) {
                setPixel(tx, ty, px, py, 160 + n * 20, 120 + n * 15, 75 + n * 10);
            } else {
                const bookCol = (px % 4);
                if (bookCol === 0) setPixel(tx, ty, px, py, 180, 50, 50);
                else if (bookCol === 1) setPixel(tx, ty, px, py, 50, 120, 180);
                else if (bookCol === 2) setPixel(tx, ty, px, py, 70, 160, 70);
                else setPixel(tx, ty, px, py, 200, 160, 60);
            }
        });

        // 21. OBSIDIAN
        fillTile(TILES.OBSIDIAN, (tx, ty, px, py) => {
            const n = rnd();
            const r = 20 + n * 15;
            const g = 15 + n * 10;
            const b = 35 + n * 25;
            setPixel(tx, ty, px, py, r, g, b);
        });

        // 22. GOLD_ORE
        fillTile(TILES.GOLD_ORE, (tx, ty, px, py) => {
            drawOre(tx, ty, px, py, 245, 215, 60);
        });

        // 23. DIAMOND_ORE
        fillTile(TILES.DIAMOND_ORE, (tx, ty, px, py) => {
            drawOre(tx, ty, px, py, 80, 240, 230);
        });

        // 24. SNOW_TOP
        fillTile(TILES.SNOW_TOP, (tx, ty, px, py) => {
            const n = rnd();
            const shade = 235 + n * 20;
            setPixel(tx, ty, px, py, shade, shade, shade);
        });

        // 25. SNOW_SIDE
        fillTile(TILES.SNOW_SIDE, (tx, ty, px, py) => {
            if (py <= 4) {
                const n = rnd();
                const shade = 235 + n * 20;
                setPixel(tx, ty, px, py, shade, shade, shade);
            } else {
                const n = rnd();
                setPixel(tx, ty, px, py, 115 + n * 30, 80 + n * 25, 50 + n * 20);
            }
        });

        // 26. GLOWSTONE
        fillTile(TILES.GLOWSTONE, (tx, ty, px, py) => {
            const n = rnd();
            if (n > 0.82) {
                // Bright yellow-white crystal highlight
                setPixel(tx, ty, px, py, 255, 250, 190 + Math.floor(rnd() * 50));
            } else if (n > 0.5) {
                // Golden amber
                setPixel(tx, ty, px, py, 235 + Math.floor(n * 20), 180 + Math.floor(n * 40), 50 + Math.floor(n * 30));
            } else if (n > 0.25) {
                // Rich amber
                setPixel(tx, ty, px, py, 210 + Math.floor(n * 25), 140 + Math.floor(n * 30), 30 + Math.floor(n * 20));
            } else {
                // Darker amber crevices
                setPixel(tx, ty, px, py, 160 + Math.floor(n * 30), 100 + Math.floor(n * 25), 20 + Math.floor(n * 15));
            }
        });

        // 27. MOSSY_COBBLESTONE
        fillTile(TILES.MOSSY_COBBLESTONE, (tx, ty, px, py) => {
            const isBorder = (px === 0 || px === 7 || px === 8 || px === 15 || py === 0 || py === 7 || py === 8 || py === 15);
            const n = rnd();
            const isMossy = (isBorder && rnd() > 0.35) || (rnd() > 0.78);
            if (isMossy) {
                // Green moss pixels along borders
                const mossG = 110 + n * 45;
                const mossR = 45 + n * 30;
                const mossB = 25 + n * 25;
                setPixel(tx, ty, px, py, mossR, mossG, mossB);
            } else if (isBorder && rnd() > 0.4) {
                setPixel(tx, ty, px, py, 60 + n * 20, 60 + n * 20, 60 + n * 20);
            } else {
                const shade = 100 + n * 45;
                setPixel(tx, ty, px, py, shade, shade, shade);
            }
        });

        // 28. CACTUS_SIDE
        fillTile(TILES.CACTUS_SIDE, (tx, ty, px, py) => {
            const isRib = (px % 4 === 0);
            const isPrickle = ((px === 2 || px === 6 || px === 10 || px === 14) && (py % 4 === 2)) ||
                              ((px === 0 || px === 4 || px === 8 || px === 12) && (py % 4 === 0));
            const n = rnd();
            if (isPrickle) {
                if (rnd() > 0.4) {
                    // Light prickle spike
                    setPixel(tx, ty, px, py, 220, 235, 200);
                } else {
                    // Dark prickle base
                    setPixel(tx, ty, px, py, 20, 45, 15);
                }
            } else if (isRib) {
                // Darker vertical rib groove
                setPixel(tx, ty, px, py, 28 + n * 15, 85 + n * 20, 18 + n * 10);
            } else {
                // Deep green cactus flesh
                setPixel(tx, ty, px, py, 45 + n * 20, 115 + n * 30, 30 + n * 15);
            }
        });

        // 29. CACTUS_TOP
        fillTile(TILES.CACTUS_TOP, (tx, ty, px, py) => {
            const dx = px - 7.5;
            const dy = py - 7.5;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const n = rnd();
            if (dist < 2.5) {
                // Center lighter core
                setPixel(tx, ty, px, py, 80 + n * 20, 145 + n * 25, 45 + n * 15);
            } else if (dist < 5.0) {
                // Darker concentric groove
                setPixel(tx, ty, px, py, 35 + n * 15, 95 + n * 20, 25 + n * 10);
            } else if (dist < 7.2) {
                // Green flesh ring
                setPixel(tx, ty, px, py, 55 + n * 20, 125 + n * 25, 35 + n * 15);
            } else {
                // Outer edge
                setPixel(tx, ty, px, py, 30 + n * 15, 85 + n * 20, 20 + n * 10);
            }
        });

        // 30. PUMPKIN_TOP
        fillTile(TILES.PUMPKIN_TOP, (tx, ty, px, py) => {
            const isStem = (px >= 7 && px <= 8 && py >= 7 && py <= 8);
            const isStemBorder = (px >= 6 && px <= 9 && py >= 6 && py <= 9);
            const isRib = (px === 3 || px === 12 || py === 3 || py === 12);
            const n = rnd();
            if (isStem) {
                // Central stem
                setPixel(tx, ty, px, py, 85 + n * 20, 95 + n * 20, 45 + n * 15);
            } else if (isStemBorder) {
                // Stem base depression
                setPixel(tx, ty, px, py, 140 + n * 20, 75 + n * 15, 15 + n * 10);
            } else if (isRib) {
                // Rib groove
                setPixel(tx, ty, px, py, 175 + n * 20, 95 + n * 15, 18 + n * 10);
            } else {
                // Orange ribbed flesh
                setPixel(tx, ty, px, py, 215 + n * 25, 125 + n * 25, 25 + n * 15);
            }
        });

        // 31. PUMPKIN_SIDE
        fillTile(TILES.PUMPKIN_SIDE, (tx, ty, px, py) => {
            const isGroove = (px % 4 === 0);
            const n = rnd();
            if (isGroove) {
                setPixel(tx, ty, px, py, 170 + n * 20, 90 + n * 15, 18 + n * 10);
            } else {
                setPixel(tx, ty, px, py, 215 + n * 25, 125 + n * 25, 25 + n * 15);
            }
        });

        // 32. PUMPKIN_FRONT
        fillTile(TILES.PUMPKIN_FRONT, (tx, ty, px, py) => {
            const isLeftEye = (py === 4 && (px === 3 || px === 4)) ||
                              (py === 5 && (px >= 3 && px <= 5)) ||
                              (py === 6 && px === 4);
            const isRightEye = (py === 4 && (px === 11 || px === 12)) ||
                               (py === 5 && (px >= 10 && px <= 12)) ||
                               (py === 6 && px === 11);
            const isNose = (py === 7 && (px === 7 || px === 8));
            const isMouth = (py === 9 && (px === 2 || px === 5 || px === 10 || px === 13)) ||
                            (py === 10 && ((px >= 2 && px <= 6) || (px >= 9 && px <= 13))) ||
                            (py === 11 && (px === 3 || px === 4 || (px >= 6 && px <= 9) || px === 11 || px === 12)) ||
                            (py === 12 && (px === 4 || px === 7 || px === 8 || px === 11));
            const isCarved = isLeftEye || isRightEye || isNose || isMouth;

            const n = rnd();
            if (isCarved) {
                // Carved dark/yellow eye and mouth pixels
                if (rnd() > 0.45) {
                    // Warm yellow glowing carving
                    setPixel(tx, ty, px, py, 235 + n * 20, 175 + n * 20, 30 + n * 15);
                } else {
                    // Deep carved dark shading
                    setPixel(tx, ty, px, py, 45 + n * 15, 25 + n * 10, 10 + n * 5);
                }
            } else {
                // Normal pumpkin side texture with vertical grooves
                const isGroove = (px % 4 === 0);
                if (isGroove) {
                    setPixel(tx, ty, px, py, 170 + n * 20, 90 + n * 15, 18 + n * 10);
                } else {
                    setPixel(tx, ty, px, py, 215 + n * 25, 125 + n * 25, 25 + n * 15);
                }
            }
        });

        // 33. GRAVEL (Pebbly grey/brown noise)
        fillTile(TILES.GRAVEL, (tx, ty, px, py) => {
            const n = rnd();
            const isPebble = ((px % 4 === 1 || px % 4 === 2) && (py % 4 === 1 || py % 4 === 2)) && rnd() > 0.45;
            if (isPebble) {
                const shade = 80 + Math.floor(n * 30);
                setPixel(tx, ty, px, py, shade + 10, shade + 3, shade - 5);
            } else if (n > 0.7) {
                const shade = 145 + Math.floor(n * 35);
                setPixel(tx, ty, px, py, shade + 8, shade + 2, shade - 6);
            } else {
                const shade = 110 + Math.floor(n * 30);
                setPixel(tx, ty, px, py, shade + 8, shade + 2, shade - 6);
            }
        });

        // 34. CRAFTING_TOP (3x3 crafting grid lines on wood/cloth top)
        fillTile(TILES.CRAFTING_TOP, (tx, ty, px, py) => {
            const n = rnd();
            const isOuter = (px <= 1 || px >= 14 || py <= 1 || py >= 14);
            const isCorner = ((px <= 2 || px >= 13) && (py <= 2 || py >= 13));
            const isInnerFrame = (px === 2 || px === 13 || py === 2 || py === 13);
            const isGrid = (px >= 3 && px <= 12 && py >= 3 && py <= 12) && (px === 6 || px === 9 || py === 6 || py === 9);

            if (isCorner) {
                // Dark corner bracket / nail
                setPixel(tx, ty, px, py, 95 + n * 15, 65 + n * 10, 35 + n * 10);
            } else if (isOuter) {
                // Outer wood frame
                setPixel(tx, ty, px, py, 160 + n * 20, 115 + n * 15, 70 + n * 10);
            } else if (isInnerFrame || isGrid) {
                // Dark grid lines
                setPixel(tx, ty, px, py, 110 + n * 15, 75 + n * 10, 40 + n * 10);
            } else {
                // Light workbench cloth / parchment surface
                setPixel(tx, ty, px, py, 215 + n * 20, 185 + n * 15, 135 + n * 15);
            }
        });

        // 35. CRAFTING_SIDE (Wood planks with dark top rim and tool silhouettes)
        fillTile(TILES.CRAFTING_SIDE, (tx, ty, px, py) => {
            const n = rnd();
            const isTopRim = (py <= 1);
            const isRimBottom = (py === 2);
            // Tool silhouette 1: hanging shears (px 3..5, py 4..12)
            const isTool1 = (px === 4 && py >= 4 && py <= 12) ||
                            (px === 3 && (py === 5 || py === 7 || py === 9 || py === 11)) ||
                            (px === 5 && (py === 4 || py === 12));
            // Tool silhouette 2: hanging wrench / hammer (px 11..13, py 4..11)
            const isTool2 = (px === 12 && py >= 5 && py <= 12) ||
                            (py === 5 && px >= 10 && px <= 13) ||
                            (py === 6 && (px === 10 || px === 13));

            if (isTopRim) {
                setPixel(tx, ty, px, py, 120 + n * 15, 85 + n * 10, 50 + n * 10);
            } else if (isRimBottom) {
                setPixel(tx, ty, px, py, 80 + n * 15, 55 + n * 10, 30 + n * 10);
            } else if (isTool1 || isTool2) {
                // Dark iron tool silhouette
                setPixel(tx, ty, px, py, 45 + n * 20, 45 + n * 20, 50 + n * 20);
            } else {
                // Planks background
                const isSeam = (py % 4 === 2) || (py < 6 && px === 8) || (py >= 6 && py < 10 && px === 2) || (py >= 10 && px === 10);
                if (isSeam) {
                    setPixel(tx, ty, px, py, 130 + n * 15, 95 + n * 10, 55 + n * 10);
                } else {
                    setPixel(tx, ty, px, py, 175 + n * 20, 135 + n * 15, 85 + n * 15);
                }
            }
        });

        // 36. CRAFTING_FRONT (Wood planks with saw/hammer grid details)
        fillTile(TILES.CRAFTING_FRONT, (tx, ty, px, py) => {
            const n = rnd();
            const isTopRim = (py <= 1);
            const isRimBottom = (py === 2);
            // Diagonal saw blade (px from 3 to 11, py from 5 to 11)
            const isSawBlade = (Math.abs((px - 3) - (py - 5)) <= 0 && px >= 3 && px <= 11);
            const isSawTeeth = (isSawBlade || ((px === py - 1) && px >= 4 && px <= 10 && px % 2 === 0));
            const isSawHandle = (px >= 11 && px <= 13 && py >= 11 && py <= 13);
            const isHammerHead = (py === 4 && px >= 8 && px <= 13) || (py === 5 && px >= 9 && px <= 12);
            const isHammerHandle = (px === 10 && py >= 6 && py <= 10);

            if (isTopRim) {
                setPixel(tx, ty, px, py, 120 + n * 15, 85 + n * 10, 50 + n * 10);
            } else if (isRimBottom) {
                setPixel(tx, ty, px, py, 80 + n * 15, 55 + n * 10, 30 + n * 10);
            } else if (isSawHandle) {
                setPixel(tx, ty, px, py, 135 + n * 15, 60 + n * 10, 30 + n * 10);
            } else if (isSawBlade || isSawTeeth || isHammerHead) {
                setPixel(tx, ty, px, py, 175 + n * 25, 180 + n * 25, 190 + n * 25);
            } else if (isHammerHandle) {
                setPixel(tx, ty, px, py, 105 + n * 15, 75 + n * 10, 45 + n * 10);
            } else {
                const isSeam = (py % 4 === 2) || (py < 6 && px === 7) || (py >= 6 && py < 10 && px === 14) || (py >= 10 && px === 3);
                if (isSeam) {
                    setPixel(tx, ty, px, py, 130 + n * 15, 95 + n * 10, 55 + n * 10);
                } else {
                    setPixel(tx, ty, px, py, 175 + n * 20, 135 + n * 15, 85 + n * 15);
                }
            }
        });

        // 37. JACK_O_LANTERN_FRONT (Glowing carved eyes and mouth)
        fillTile(TILES.JACK_O_LANTERN_FRONT, (tx, ty, px, py) => {
            const isLeftEye = (py === 4 && (px === 3 || px === 4)) ||
                              (py === 5 && (px >= 3 && px <= 5)) ||
                              (py === 6 && px === 4);
            const isRightEye = (py === 4 && (px === 11 || px === 12)) ||
                               (py === 5 && (px >= 10 && px <= 12)) ||
                               (py === 6 && px === 11);
            const isNose = (py === 7 && (px === 7 || px === 8));
            const isMouth = (py === 9 && (px === 2 || px === 5 || px === 10 || px === 13)) ||
                            (py === 10 && ((px >= 2 && px <= 6) || (px >= 9 && px <= 13))) ||
                            (py === 11 && (px === 3 || px === 4 || (px >= 6 && px <= 9) || px === 11 || px === 12)) ||
                            (py === 12 && (px === 4 || px === 7 || px === 8 || px === 11));
            const isCarved = isLeftEye || isRightEye || isNose || isMouth;

            const n = rnd();
            if (isCarved) {
                // Bright glowing yellow-white carved eyes/mouth
                if (rnd() > 0.4) {
                    setPixel(tx, ty, px, py, 255, 250 + Math.floor(n * 5), 180 + Math.floor(n * 40));
                } else {
                    setPixel(tx, ty, px, py, 255, 210 + Math.floor(n * 30), 70 + Math.floor(n * 30));
                }
            } else {
                const isGroove = (px % 4 === 0);
                if (isGroove) {
                    setPixel(tx, ty, px, py, 170 + n * 20, 90 + n * 15, 18 + n * 10);
                } else {
                    setPixel(tx, ty, px, py, 215 + n * 25, 125 + n * 25, 25 + n * 15);
                }
            }
        });

        // 38. BIRCH_SIDE (White/cream bark with dark horizontal black/grey birch spots)
        fillTile(TILES.BIRCH_SIDE, (tx, ty, px, py) => {
            const n = rnd();
            const isSpot = (py === 2 && px >= 4 && px <= 7) ||
                           (py === 5 && px >= 10 && px <= 14) ||
                           (py === 6 && px >= 11 && px <= 13) ||
                           (py === 8 && px >= 1 && px <= 4) ||
                           (py === 11 && px >= 7 && px <= 11) ||
                           (py === 14 && px >= 12 && px <= 15) ||
                           (py === 13 && px >= 2 && px <= 4);
            const isSpotBorder = (py === 2 && (px === 3 || px === 8)) ||
                                 (py === 5 && (px === 9 || px === 15)) ||
                                 (py === 8 && (px === 0 || px === 5)) ||
                                 (py === 11 && (px === 6 || px === 12));

            if (isSpot) {
                setPixel(tx, ty, px, py, 35 + n * 15, 35 + n * 15, 35 + n * 15);
            } else if (isSpotBorder && rnd() > 0.4) {
                setPixel(tx, ty, px, py, 120 + n * 20, 120 + n * 20, 115 + n * 20);
            } else {
                const shade = 220 + n * 25;
                setPixel(tx, ty, px, py, shade, shade - 3, shade - 10);
            }
        });

        // 39. BIRCH_TOP (Light cream concentric rings with white outer bark)
        fillTile(TILES.BIRCH_TOP, (tx, ty, px, py) => {
            const dx = px - 7.5;
            const dy = py - 7.5;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ring = Math.floor(dist) % 2 === 0;
            const n = rnd();
            if (dist > 7) {
                const shade = 220 + n * 25;
                setPixel(tx, ty, px, py, shade, shade - 3, shade - 10);
            } else if (ring) {
                setPixel(tx, ty, px, py, 205 + n * 20, 195 + n * 15, 160 + n * 10);
            } else {
                setPixel(tx, ty, px, py, 185 + n * 20, 175 + n * 15, 140 + n * 10);
            }
        });

        // 40. BIRCH_LEAVES (Lighter vibrant yellow-green leaves with transparent pixel gaps)
        fillTile(TILES.BIRCH_LEAVES, (tx, ty, px, py) => {
            const n = rnd();
            if (rnd() > 0.85) {
                setPixel(tx, ty, px, py, 0, 0, 0, 0);
            } else {
                setPixel(tx, ty, px, py, 80 + n * 35, 150 + n * 40, 35 + n * 25, 240);
            }
        });

        // 41. LAVA (Bright molten orange, red, and yellow glowing magma pattern)
        fillTile(TILES.LAVA, (tx, ty, px, py) => {
            const n = rnd();
            const wave = Math.sin(px * 0.6 + py * 0.4) * 0.5 + 0.5;
            const heat = (wave * 0.6 + n * 0.4);

            if (heat > 0.72) {
                setPixel(tx, ty, px, py, 255, 220 + Math.floor(n * 35), 40 + Math.floor(n * 40));
            } else if (heat > 0.42) {
                setPixel(tx, ty, px, py, 245 + Math.floor(n * 10), 125 + Math.floor(n * 40), 15 + Math.floor(n * 15));
            } else {
                setPixel(tx, ty, px, py, 190 + Math.floor(n * 25), 45 + Math.floor(n * 25), 10 + Math.floor(n * 10));
            }
        });

        // 42. TORCH (Wooden stick with glowing flame tip)
        fillTile(TILES.TORCH, (tx, ty, px, py) => {
            if (typeof ctx.clearRect === 'function' && px === 0 && py === 0) {
                ctx.clearRect(tx * 16, ty * 16, 16, 16);
            }
            const n = rnd();
            if (px >= 7 && px <= 8 && py >= 6 && py <= 15) {
                // Wooden handle
                setPixel(tx, ty, px, py, 145 + n * 25, 105 + n * 20, 55 + n * 15, 255);
            } else if (px >= 7 && px <= 8 && py >= 4 && py <= 5) {
                // Coal head
                setPixel(tx, ty, px, py, 40, 35, 35, 255);
            } else if (px >= 6 && px <= 9 && py >= 1 && py <= 4) {
                // Glowing flame
                const isCore = (px >= 7 && px <= 8 && py >= 2 && py <= 3);
                if (isCore) {
                    setPixel(tx, ty, px, py, 255, 250, 180, 255);
                } else {
                    setPixel(tx, ty, px, py, 255, 155 + n * 50, 25, 240);
                }
            }
        });

        // 43. BED_TOP (White pillow + crimson blanket)
        fillTile(TILES.BED_TOP, (tx, ty, px, py) => {
            const n = rnd();
            const isFrame = (px === 0 || px === 15 || py === 0 || py === 15);
            if (isFrame) {
                setPixel(tx, ty, px, py, 155 + n * 20, 115 + n * 15, 65 + n * 10);
            } else if (py <= 5) {
                // Pillow
                const shade = 230 + n * 20;
                setPixel(tx, ty, px, py, shade, shade, shade);
            } else {
                // Red wool blanket
                setPixel(tx, ty, px, py, 185 + n * 25, 35 + n * 15, 35 + n * 15);
            }
        });

        // 44. BED_SIDE (Red mattress + wood frame + legs)
        fillTile(TILES.BED_SIDE, (tx, ty, px, py) => {
            const n = rnd();
            if (py <= 6) {
                if (px <= 4) {
                    const shade = 230 + n * 20;
                    setPixel(tx, ty, px, py, shade, shade, shade);
                } else {
                    setPixel(tx, ty, px, py, 185 + n * 25, 35 + n * 15, 35 + n * 15);
                }
            } else if (py <= 11) {
                setPixel(tx, ty, px, py, 165 + n * 20, 125 + n * 15, 75 + n * 10);
            } else {
                if (px <= 2 || px >= 13) {
                    setPixel(tx, ty, px, py, 130 + n * 15, 95 + n * 10, 55 + n * 10);
                } else {
                    setPixel(tx, ty, px, py, 35, 35, 35);
                }
            }
        });

        // 45. LADDER (Wooden side rails and horizontal rungs)
        fillTile(TILES.LADDER, (tx, ty, px, py) => {
            if (typeof ctx.clearRect === 'function' && px === 0 && py === 0) {
                ctx.clearRect(tx * 16, ty * 16, 16, 16);
            }
            const n = rnd();
            const isRail = (px >= 2 && px <= 3) || (px >= 12 && px <= 13);
            const isRung = (px >= 2 && px <= 13) && (py === 2 || py === 3 || py === 6 || py === 7 || py === 10 || py === 11 || py === 14);
            if (isRail || isRung) {
                setPixel(tx, ty, px, py, 165 + n * 25, 125 + n * 20, 70 + n * 15, 255);
            }
        });

        // 46. FLOWER_RED (Crimson poppy on green stem)
        fillTile(TILES.FLOWER_RED, (tx, ty, px, py) => {
            if (typeof ctx.clearRect === 'function' && px === 0 && py === 0) {
                ctx.clearRect(tx * 16, ty * 16, 16, 16);
            }
            const n = rnd();
            const dx = px - 7.5;
            const dy = py - 5.5;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1.3) {
                setPixel(tx, ty, px, py, 40, 25, 15, 255);
            } else if (dist < 3.6) {
                setPixel(tx, ty, px, py, 220 + n * 35, 25 + n * 25, 25 + n * 20, 255);
            } else if (px >= 7 && px <= 8 && py >= 8 && py <= 15) {
                setPixel(tx, ty, px, py, 45 + n * 20, 135 + n * 30, 35 + n * 15, 255);
            } else if ((px === 6 && py === 12) || (px === 9 && py === 11)) {
                setPixel(tx, ty, px, py, 55 + n * 20, 145 + n * 30, 40 + n * 15, 255);
            }
        });

        // 47. FLOWER_YELLOW (Golden dandelion on green stem)
        fillTile(TILES.FLOWER_YELLOW, (tx, ty, px, py) => {
            if (typeof ctx.clearRect === 'function' && px === 0 && py === 0) {
                ctx.clearRect(tx * 16, ty * 16, 16, 16);
            }
            const n = rnd();
            const dx = px - 7.5;
            const dy = py - 5.5;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1.3) {
                setPixel(tx, ty, px, py, 240, 165, 15, 255);
            } else if (dist < 3.4) {
                setPixel(tx, ty, px, py, 250, 225 + n * 30, 35 + n * 25, 255);
            } else if (px >= 7 && px <= 8 && py >= 8 && py <= 15) {
                setPixel(tx, ty, px, py, 50 + n * 20, 140 + n * 30, 35 + n * 15, 255);
            } else if ((px === 6 && py === 13) || (px === 9 && py === 12)) {
                setPixel(tx, ty, px, py, 60 + n * 20, 150 + n * 30, 40 + n * 15, 255);
            }
        });

        // 48. TALL_GRASS (Lush swaying grass blades)
        fillTile(TILES.TALL_GRASS, (tx, ty, px, py) => {
            if (typeof ctx.clearRect === 'function' && px === 0 && py === 0) {
                ctx.clearRect(tx * 16, ty * 16, 16, 16);
            }
            const n = rnd();
            const bladeHeight = 4 + ((px * 7 + 3) % 9);
            const isBladeCol = (px % 2 === 1 && px >= 1 && px <= 14);
            if (isBladeCol && py >= bladeHeight) {
                setPixel(tx, ty, px, py, 60 + n * 35, 135 + n * 45, 30 + n * 20, 245);
            } else if (py >= 13 && px >= 2 && px <= 13 && rnd() > 0.35) {
                setPixel(tx, ty, px, py, 50 + n * 30, 120 + n * 35, 25 + n * 15, 245);
            }
        });

        // 49. PICKAXE_DIAMOND (Cyan diamond pickaxe head + wooden handle)
        fillTile(TILES.PICKAXE_DIAMOND, (tx, ty, px, py) => {
            if (typeof ctx.clearRect === 'function' && px === 0 && py === 0) {
                ctx.clearRect(tx * 16, ty * 16, 16, 16);
            }
            const n = rnd();
            const isHandle = (Math.abs((15 - py) - px) <= 1 && px >= 2 && px <= 11 && py >= 4 && py <= 13);
            const isHead = (py >= 2 && py <= 4 && px >= 7 && px <= 13) ||
                           (px >= 11 && px <= 13 && py >= 2 && py <= 8) ||
                           (px === 6 && py === 3) || (px === 12 && py === 9);
            if (isHead) {
                setPixel(tx, ty, px, py, 70 + n * 30, 235 + n * 20, 225 + n * 25, 255);
            } else if (isHandle) {
                setPixel(tx, ty, px, py, 145 + n * 20, 105 + n * 15, 55 + n * 10, 255);
            }
        });

        // 50. SWORD_DIAMOND (Gleaming diamond blade + guard + hilt)
        fillTile(TILES.SWORD_DIAMOND, (tx, ty, px, py) => {
            if (typeof ctx.clearRect === 'function' && px === 0 && py === 0) {
                ctx.clearRect(tx * 16, ty * 16, 16, 16);
            }
            const n = rnd();
            const diag = (15 - py) - px;
            const isBlade = (Math.abs(diag) <= 1 && px >= 5 && px <= 14 && py >= 1 && py <= 10);
            const isGuard = (px + py >= 13 && px + py <= 15 && px >= 3 && px <= 8 && py >= 7 && py <= 12);
            const isHilt = (Math.abs(diag) <= 1 && px >= 1 && px <= 4 && py >= 11 && py <= 14);
            if (isGuard) {
                setPixel(tx, ty, px, py, 45, 165, 160, 255);
            } else if (isBlade) {
                const isEdge = (Math.abs(diag) === 1);
                if (isEdge) {
                    setPixel(tx, ty, px, py, 55 + n * 20, 200 + n * 25, 195 + n * 25, 255);
                } else {
                    setPixel(tx, ty, px, py, 140 + n * 30, 250, 245, 255);
                }
            } else if (isHilt) {
                setPixel(tx, ty, px, py, 140 + n * 20, 95 + n * 15, 50 + n * 10, 255);
            }
        });

        // 240..249: CRACK_0 through CRACK_9 (mining overlay)
        // Progressive crack stages starting from center (8, 8) branching outward
        const crackStages = Array.from({ length: 16 }, () => new Array(16).fill(255));
        function markCrack(x, y, stage) {
            if (x >= 0 && x < 16 && y >= 0 && y < 16) {
                crackStages[y][x] = Math.min(crackStages[y][x], stage);
            }
        }

        // Center cluster (stage 0)
        markCrack(8, 8, 0);
        markCrack(8, 7, 0);
        markCrack(7, 8, 0);
        markCrack(9, 8, 0);
        markCrack(8, 9, 0);

        // Branch 1 (Up-Left)
        markCrack(7, 7, 1); markCrack(6, 7, 2); markCrack(6, 6, 3); markCrack(5, 5, 4);
        markCrack(4, 5, 5); markCrack(3, 4, 6); markCrack(3, 3, 7); markCrack(2, 2, 8);
        markCrack(1, 2, 9); markCrack(1, 1, 9);
        // Sub-branch 1
        markCrack(5, 6, 5); markCrack(4, 7, 6); markCrack(3, 7, 7); markCrack(2, 8, 8);
        markCrack(1, 8, 9); markCrack(0, 8, 9);

        // Branch 2 (Up)
        markCrack(8, 6, 1); markCrack(7, 5, 2); markCrack(8, 4, 3); markCrack(7, 4, 4);
        markCrack(7, 3, 5); markCrack(8, 2, 6); markCrack(7, 1, 7); markCrack(7, 0, 8);
        // Sub-branch 2
        markCrack(6, 3, 7); markCrack(5, 2, 8); markCrack(4, 1, 9); markCrack(3, 0, 9);

        // Branch 3 (Up-Right)
        markCrack(9, 7, 1); markCrack(9, 6, 2); markCrack(10, 6, 3); markCrack(11, 5, 4);
        markCrack(11, 4, 5); markCrack(12, 4, 6); markCrack(13, 3, 7); markCrack(13, 2, 8);
        markCrack(14, 2, 9); markCrack(15, 1, 9);
        // Sub-branches 3
        markCrack(10, 5, 5); markCrack(10, 4, 6); markCrack(9, 3, 7); markCrack(9, 2, 8);
        markCrack(8, 1, 9); markCrack(8, 0, 9);
        markCrack(12, 2, 7); markCrack(11, 1, 8); markCrack(12, 0, 9);

        // Branch 4 (Right)
        markCrack(10, 8, 1); markCrack(11, 8, 2); markCrack(11, 7, 3); markCrack(12, 7, 4);
        markCrack(13, 8, 5); markCrack(14, 7, 6); markCrack(15, 7, 7); markCrack(15, 6, 8);

        // Branch 5 (Down-Right)
        markCrack(9, 9, 1); markCrack(10, 9, 2); markCrack(10, 10, 3); markCrack(11, 11, 4);
        markCrack(12, 11, 5); markCrack(13, 12, 6); markCrack(13, 13, 7); markCrack(14, 13, 8);
        markCrack(14, 14, 9); markCrack(15, 15, 9);
        // Sub-branches 5
        markCrack(11, 10, 5); markCrack(12, 9, 6); markCrack(13, 9, 7); markCrack(14, 8, 8);
        markCrack(15, 8, 9);
        markCrack(12, 12, 6); markCrack(12, 13, 7); markCrack(13, 14, 8); markCrack(14, 15, 9);

        // Branch 6 (Down)
        markCrack(8, 10, 1); markCrack(9, 11, 2); markCrack(8, 12, 3); markCrack(9, 12, 4);
        markCrack(8, 13, 5); markCrack(9, 14, 6); markCrack(9, 15, 7);

        // Branch 7 (Down-Left)
        markCrack(7, 9, 1); markCrack(7, 10, 2); markCrack(6, 10, 3); markCrack(5, 11, 4);
        markCrack(5, 12, 5); markCrack(4, 12, 6); markCrack(3, 13, 7); markCrack(2, 13, 8);
        markCrack(2, 14, 9); markCrack(1, 15, 9);
        // Sub-branches 7
        markCrack(6, 11, 5); markCrack(7, 12, 6); markCrack(7, 13, 7); markCrack(8, 14, 8);
        markCrack(8, 15, 9);
        markCrack(4, 9, 6); markCrack(3, 10, 7); markCrack(2, 11, 8); markCrack(1, 11, 9);

        // Branch 8 (Left)
        markCrack(6, 8, 1); markCrack(5, 8, 2); markCrack(5, 7, 3); markCrack(4, 7, 4);
        markCrack(3, 8, 5); markCrack(2, 8, 6); markCrack(2, 7, 7); markCrack(1, 7, 8);
        markCrack(0, 7, 9);

        for (let s = 0; s <= 9; s++) {
            const crackTileIdx = TILES[`CRACK_${s}`];
            const tx = crackTileIdx % 16;
            const ty = Math.floor(crackTileIdx / 16);
            if (typeof ctx.clearRect === 'function') {
                ctx.clearRect(tx * 16, ty * 16, 16, 16);
            }
            for (let py = 0; py < 16; py++) {
                for (let px = 0; px < 16; px++) {
                    if (crackStages[py][px] <= s) {
                        setPixel(tx, ty, px, py, 15, 15, 15, 190);
                    }
                }
            }
        }

        return canvas;
    }

    /**
     * Animates the WATER and LAVA tiles in the texture atlas canvas over time.
     */
    function updateAnimatedTextures(canvas, timeSeconds = 0) {
        if (!canvas || typeof canvas.getContext !== 'function') return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        // 1. Animate WATER tile (index 13)
        const wTx = TILES.WATER % 16;
        const wTy = Math.floor(TILES.WATER / 16);
        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                const wave = Math.sin(px * 0.55 + timeSeconds * 3.0) * 0.5 + Math.cos(py * 0.65 - timeSeconds * 2.4) * 0.5;
                const crest = wave > 0.45 ? 18 : (wave < -0.45 ? -12 : 0);
                const r = Math.max(20, Math.min(95, 45 + crest));
                const g = Math.max(70, Math.min(165, 105 + crest * 1.4));
                const b = Math.max(180, Math.min(255, 225 + crest));
                ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},0.78)`;
                ctx.fillRect(wTx * 16 + px, wTy * 16 + py, 1, 1);
            }
        }

        // 2. Animate LAVA tile (index 41)
        const lTx = TILES.LAVA % 16;
        const lTy = Math.floor(TILES.LAVA / 16);
        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                const heat = (Math.sin(px * 0.6 + timeSeconds * 1.8) + Math.cos(py * 0.5 - timeSeconds * 1.5)) * 0.25 + 0.5;
                let r, g, b;
                if (heat > 0.68) {
                    r = 255; g = 230; b = 65;
                } else if (heat > 0.38) {
                    r = 248; g = 135; b = 20;
                } else {
                    r = 195; g = 50; b = 12;
                }
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(lTx * 16 + px, lTy * 16 + py, 1, 1);
            }
        }
        return true;
    }

    const CRAFTING_RECIPES = [
        {
            id: 'planks_oak',
            name: 'Wooden Planks (x4)',
            output: { id: BLOCKS.PLANKS, count: 4 },
            ingredients: [{ id: BLOCKS.WOOD, count: 1 }]
        },
        {
            id: 'planks_birch',
            name: 'Wooden Planks (x4)',
            output: { id: BLOCKS.PLANKS, count: 4 },
            ingredients: [{ id: BLOCKS.BIRCH_WOOD, count: 1 }]
        },
        {
            id: 'crafting_table',
            name: 'Crafting Table',
            output: { id: BLOCKS.CRAFTING_TABLE, count: 1 },
            ingredients: [{ id: BLOCKS.PLANKS, count: 4 }]
        },
        {
            id: 'torch',
            name: 'Torches (x4)',
            output: { id: BLOCKS.TORCH, count: 4 },
            ingredients: [{ id: BLOCKS.COAL_ORE, count: 1 }, { id: BLOCKS.PLANKS, count: 1 }]
        },
        {
            id: 'bed',
            name: 'Bed (Spánek & Spawn)',
            output: { id: BLOCKS.BED, count: 1 },
            ingredients: [{ id: BLOCKS.SNOW, count: 2 }, { id: BLOCKS.PLANKS, count: 2 }]
        },
        {
            id: 'ladder',
            name: 'Ladder (x3)',
            output: { id: BLOCKS.LADDER, count: 3 },
            ingredients: [{ id: BLOCKS.PLANKS, count: 2 }]
        },
        {
            id: 'pickaxe_diamond',
            name: 'Diamond Pickaxe (3.5x Těžba)',
            output: { id: BLOCKS.PICKAXE_DIAMOND, count: 1 },
            ingredients: [{ id: BLOCKS.DIAMOND_ORE, count: 2 }, { id: BLOCKS.PLANKS, count: 1 }]
        },
        {
            id: 'sword_diamond',
            name: 'Diamond Sword (12 DMG)',
            output: { id: BLOCKS.SWORD_DIAMOND, count: 1 },
            ingredients: [{ id: BLOCKS.DIAMOND_ORE, count: 1 }, { id: BLOCKS.PLANKS, count: 1 }]
        },
        {
            id: 'bookshelf',
            name: 'Bookshelf',
            output: { id: BLOCKS.BOOKSHELF, count: 1 },
            ingredients: [{ id: BLOCKS.PLANKS, count: 6 }]
        },
        {
            id: 'bricks',
            name: 'Bricks (x2)',
            output: { id: BLOCKS.BRICK, count: 2 },
            ingredients: [{ id: BLOCKS.STONE, count: 2 }, { id: BLOCKS.DIRT, count: 2 }]
        },
        {
            id: 'mossy_cobble',
            name: 'Mossy Cobblestone',
            output: { id: BLOCKS.MOSSY_COBBLESTONE, count: 1 },
            ingredients: [{ id: BLOCKS.COBBLESTONE, count: 1 }, { id: BLOCKS.LEAVES, count: 1 }]
        },
        {
            id: 'tnt',
            name: 'TNT',
            output: { id: BLOCKS.TNT, count: 1 },
            ingredients: [{ id: BLOCKS.SAND, count: 4 }, { id: BLOCKS.COAL_ORE, count: 1 }]
        },
        {
            id: 'jack_o_lantern',
            name: "Jack o'Lantern",
            output: { id: BLOCKS.JACK_O_LANTERN, count: 1 },
            ingredients: [{ id: BLOCKS.PUMPKIN, count: 1 }, { id: BLOCKS.COAL_ORE, count: 1 }]
        },
        {
            id: 'glowstone',
            name: 'Glowstone',
            output: { id: BLOCKS.GLOWSTONE, count: 1 },
            ingredients: [{ id: BLOCKS.SAND, count: 2 }, { id: BLOCKS.GOLD_ORE, count: 1 }]
        },
        {
            id: 'glass',
            name: 'Glass (x2)',
            output: { id: BLOCKS.GLASS, count: 2 },
            ingredients: [{ id: BLOCKS.SAND, count: 2 }, { id: BLOCKS.COAL_ORE, count: 1 }]
        }
    ];

    return {
        BLOCKS,
        TILES,
        BLOCK_DEFS,
        CRAFTING_RECIPES,
        getBlockFaceTexture,
        getTileUV,
        createTextureAtlasCanvas,
        updateAnimatedTextures
    };
}));
