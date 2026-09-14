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
        SNOW: 20
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
        SNOW_SIDE: 25
    };

    const BLOCK_DEFS = {
        [BLOCKS.AIR]: {
            id: BLOCKS.AIR,
            name: 'Air',
            solid: false,
            transparent: true,
            liquid: false,
            sound: 'none'
        },
        [BLOCKS.GRASS]: {
            id: BLOCKS.GRASS,
            name: 'Grass Block',
            solid: true,
            transparent: false,
            liquid: false,
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
            sound: 'grass',
            textures: {
                top: TILES.SNOW_TOP,
                bottom: TILES.DIRT,
                sides: TILES.SNOW_SIDE
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

        return canvas;
    }

    return {
        BLOCKS,
        TILES,
        BLOCK_DEFS,
        getBlockFaceTexture,
        getTileUV,
        createTextureAtlasCanvas
    };
}));
