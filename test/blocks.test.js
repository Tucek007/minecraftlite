const { test, describe } = require('node:test');
const assert = require('node:assert');
const Blocks = require('../js/blocks.js');

describe('Blocks module tests', () => {
    test('Block IDs are unique positive integers or zero', () => {
        const ids = Object.values(Blocks.BLOCKS);
        const uniqueIds = new Set(ids);
        assert.strictEqual(ids.length, uniqueIds.size, 'All block IDs must be distinct');

        for (const id of ids) {
            assert.ok(Number.isInteger(id) && id >= 0, `ID ${id} must be non-negative integer`);
        }
    });

    test('All block definitions have required properties', () => {
        for (const [key, id] of Object.entries(Blocks.BLOCKS)) {
            const def = Blocks.BLOCK_DEFS[id];
            assert.ok(def, `Missing definition for block ${key} (id: ${id})`);
            assert.strictEqual(def.id, id, `Block ID mismatch in definition for ${key}`);
            assert.ok(typeof def.name === 'string', `Block ${key} must have name string`);
            assert.ok(typeof def.solid === 'boolean', `Block ${key} must have solid boolean`);
            assert.ok(typeof def.transparent === 'boolean', `Block ${key} must have transparent boolean`);
        }
    });

    test('Special block definitions', () => {
        // Air should not be solid and should be transparent
        assert.strictEqual(Blocks.BLOCK_DEFS[Blocks.BLOCKS.AIR].solid, false);
        assert.strictEqual(Blocks.BLOCK_DEFS[Blocks.BLOCKS.AIR].transparent, true);

        // Bedrock should be solid, non-transparent, and unbreakable
        assert.strictEqual(Blocks.BLOCK_DEFS[Blocks.BLOCKS.BEDROCK].solid, true);
        assert.strictEqual(Blocks.BLOCK_DEFS[Blocks.BLOCKS.BEDROCK].unbreakable, true);

        // Water should be liquid and non-solid
        assert.strictEqual(Blocks.BLOCK_DEFS[Blocks.BLOCKS.WATER].liquid, true);
        assert.strictEqual(Blocks.BLOCK_DEFS[Blocks.BLOCKS.WATER].solid, false);
    });

    test('Texture face mapping for multi-textured blocks (Grass)', () => {
        const grassId = Blocks.BLOCKS.GRASS;
        const topTexture = Blocks.getBlockFaceTexture(grassId, 2); // face 2 is +Y (top)
        const bottomTexture = Blocks.getBlockFaceTexture(grassId, 3); // face 3 is -Y (bottom)
        const sideTexture = Blocks.getBlockFaceTexture(grassId, 0); // face 0 is +X (side)

        assert.strictEqual(topTexture, Blocks.TILES.GRASS_TOP);
        assert.strictEqual(bottomTexture, Blocks.TILES.DIRT);
        assert.strictEqual(sideTexture, Blocks.TILES.GRASS_SIDE);
    });

    test('UV coordinate mapping calculations', () => {
        for (let tileIdx = 0; tileIdx < 30; tileIdx++) {
            const uv = Blocks.getTileUV(tileIdx);
            assert.ok(uv.u0 >= 0 && uv.u0 <= 1, `u0 (${uv.u0}) must be in [0, 1]`);
            assert.ok(uv.u1 >= 0 && uv.u1 <= 1, `u1 (${uv.u1}) must be in [0, 1]`);
            assert.ok(uv.v0 >= 0 && uv.v0 <= 1, `v0 (${uv.v0}) must be in [0, 1]`);
            assert.ok(uv.v1 >= 0 && uv.v1 <= 1, `v1 (${uv.v1}) must be in [0, 1]`);
            assert.ok(uv.u1 > uv.u0, 'u1 must be greater than u0');
            assert.ok(uv.v1 > uv.v0, 'v1 must be greater than v0');
        }
    });

    test('Registry contains all 39 blocks (Air + 38 blocks, flora, and tools)', () => {
        const expectedBlocks = [
            'AIR', 'GRASS', 'DIRT', 'STONE', 'COBBLESTONE',
            'WOOD', 'LEAVES', 'PLANKS', 'BRICK', 'SAND',
            'GLASS', 'WATER', 'COAL_ORE', 'IRON_ORE', 'BEDROCK',
            'TNT', 'BOOKSHELF', 'OBSIDIAN', 'GOLD_ORE', 'DIAMOND_ORE',
            'SNOW', 'GLOWSTONE', 'MOSSY_COBBLESTONE', 'CACTUS', 'PUMPKIN',
            'GRAVEL', 'CRAFTING_TABLE', 'JACK_O_LANTERN', 'BIRCH_WOOD', 'BIRCH_LEAVES', 'LAVA',
            'TORCH', 'BED', 'LADDER', 'FLOWER_RED', 'FLOWER_YELLOW', 'TALL_GRASS',
            'PICKAXE_DIAMOND', 'SWORD_DIAMOND'
        ];
        assert.strictEqual(Object.keys(Blocks.BLOCKS).length, 39);
        for (const name of expectedBlocks) {
            assert.ok(name in Blocks.BLOCKS, `Missing block key ${name}`);
            const id = Blocks.BLOCKS[name];
            assert.ok(Blocks.BLOCK_DEFS[id], `Missing block def for ${name}`);
        }
        assert.strictEqual(Blocks.BLOCKS.GLOWSTONE, 21);
        assert.strictEqual(Blocks.BLOCKS.MOSSY_COBBLESTONE, 22);
        assert.strictEqual(Blocks.BLOCKS.CACTUS, 23);
        assert.strictEqual(Blocks.BLOCKS.PUMPKIN, 24);
        assert.strictEqual(Blocks.BLOCKS.GRAVEL, 25);
        assert.strictEqual(Blocks.BLOCKS.CRAFTING_TABLE, 26);
        assert.strictEqual(Blocks.BLOCKS.JACK_O_LANTERN, 27);
        assert.strictEqual(Blocks.BLOCKS.BIRCH_WOOD, 28);
        assert.strictEqual(Blocks.BLOCKS.BIRCH_LEAVES, 29);
        assert.strictEqual(Blocks.BLOCKS.LAVA, 30);
        assert.strictEqual(Blocks.BLOCKS.TORCH, 31);
        assert.strictEqual(Blocks.BLOCKS.BED, 32);
        assert.strictEqual(Blocks.BLOCKS.LADDER, 33);
        assert.strictEqual(Blocks.BLOCKS.FLOWER_RED, 34);
        assert.strictEqual(Blocks.BLOCKS.FLOWER_YELLOW, 35);
        assert.strictEqual(Blocks.BLOCKS.TALL_GRASS, 36);
        assert.strictEqual(Blocks.BLOCKS.PICKAXE_DIAMOND, 37);
        assert.strictEqual(Blocks.BLOCKS.SWORD_DIAMOND, 38);
    });

    test('All block definitions have valid hardness values', () => {
        const expectedHardness = {
            AIR: 0,
            GRASS: 0.45,
            DIRT: 0.4,
            STONE: 1.1,
            COBBLESTONE: 1.2,
            WOOD: 0.85,
            LEAVES: 0.2,
            PLANKS: 0.8,
            BRICK: 1.3,
            SAND: 0.4,
            GLASS: 0.25,
            WATER: 0,
            COAL_ORE: 1.4,
            IRON_ORE: 1.6,
            BEDROCK: Infinity,
            TNT: 0.25,
            BOOKSHELF: 0.75,
            OBSIDIAN: 3.2,
            GOLD_ORE: 1.8,
            DIAMOND_ORE: 2.0,
            SNOW: 0.3,
            GLOWSTONE: 0.45,
            MOSSY_COBBLESTONE: 1.2,
            CACTUS: 0.4,
            PUMPKIN: 0.6,
            GRAVEL: 0.45,
            CRAFTING_TABLE: 0.85,
            JACK_O_LANTERN: 0.6,
            BIRCH_WOOD: 0.85,
            BIRCH_LEAVES: 0.2,
            LAVA: 0.5,
            TORCH: 0.1,
            BED: 0.4,
            LADDER: 0.4,
            FLOWER_RED: 0.05,
            FLOWER_YELLOW: 0.05,
            TALL_GRASS: 0.05,
            PICKAXE_DIAMOND: 0.5,
            SWORD_DIAMOND: 0.5
        };

        for (const [name, expected] of Object.entries(expectedHardness)) {
            const id = Blocks.BLOCKS[name];
            const def = Blocks.BLOCK_DEFS[id];
            assert.ok(def, `Missing def for ${name}`);
            assert.strictEqual(typeof def.hardness, 'number', `${name} hardness must be number`);
            assert.strictEqual(def.hardness, expected, `${name} hardness mismatch: expected ${expected}, got ${def.hardness}`);
        }
    });

    test('Special properties for blocks (gravity, lightLevel, damageOnContact, interactive)', () => {
        const glowstone = Blocks.BLOCK_DEFS[Blocks.BLOCKS.GLOWSTONE];
        assert.strictEqual(glowstone.lightLevel, 15, 'Glowstone must have lightLevel 15');
        assert.strictEqual(glowstone.sound, 'glass');

        const cactus = Blocks.BLOCK_DEFS[Blocks.BLOCKS.CACTUS];
        assert.strictEqual(cactus.damageOnContact, true, 'Cactus must have damageOnContact true');
        assert.strictEqual(cactus.sound, 'grass');

        const mossy = Blocks.BLOCK_DEFS[Blocks.BLOCKS.MOSSY_COBBLESTONE];
        assert.strictEqual(mossy.sound, 'stone');

        const pumpkin = Blocks.BLOCK_DEFS[Blocks.BLOCKS.PUMPKIN];
        assert.strictEqual(pumpkin.sound, 'wood');

        // Gravity on SAND and GRAVEL
        assert.strictEqual(Blocks.BLOCK_DEFS[Blocks.BLOCKS.SAND].gravity, true, 'Sand must have gravity: true');
        assert.strictEqual(Blocks.BLOCK_DEFS[Blocks.BLOCKS.GRAVEL].gravity, true, 'Gravel must have gravity: true');

        // Light level 15 on GLOWSTONE, JACK_O_LANTERN, and LAVA
        const jackOLantern = Blocks.BLOCK_DEFS[Blocks.BLOCKS.JACK_O_LANTERN];
        assert.strictEqual(jackOLantern.lightLevel, 15, "Jack o'Lantern must have lightLevel 15");

        const lava = Blocks.BLOCK_DEFS[Blocks.BLOCKS.LAVA];
        assert.strictEqual(lava.lightLevel, 15, 'Lava must have lightLevel 15');
        assert.strictEqual(lava.damageOnContact, true, 'Lava must have damageOnContact: true');
        assert.strictEqual(lava.contactDamage, 3, 'Lava must have contactDamage: 3');
        assert.strictEqual(lava.liquid, true, 'Lava must be liquid');

        // Interactive on CRAFTING_TABLE
        const craftingTable = Blocks.BLOCK_DEFS[Blocks.BLOCKS.CRAFTING_TABLE];
        assert.strictEqual(craftingTable.interactive, true, 'Crafting table must have interactive: true');
    });

    test('Texture face mapping for Pumpkin (front face on faceIndex 4)', () => {
        const pumpkinId = Blocks.BLOCKS.PUMPKIN;
        // Face 4 (+Z / south) should show PUMPKIN_FRONT
        assert.strictEqual(Blocks.getBlockFaceTexture(pumpkinId, 4), Blocks.TILES.PUMPKIN_FRONT);
        // Face 2 (+Y / top) should show PUMPKIN_TOP
        assert.strictEqual(Blocks.getBlockFaceTexture(pumpkinId, 2), Blocks.TILES.PUMPKIN_TOP);
        // Face 3 (-Y / bottom) should show PUMPKIN_TOP
        assert.strictEqual(Blocks.getBlockFaceTexture(pumpkinId, 3), Blocks.TILES.PUMPKIN_TOP);
        // Side faces (0, 1, 5) should show PUMPKIN_SIDE
        assert.strictEqual(Blocks.getBlockFaceTexture(pumpkinId, 0), Blocks.TILES.PUMPKIN_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(pumpkinId, 1), Blocks.TILES.PUMPKIN_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(pumpkinId, 5), Blocks.TILES.PUMPKIN_SIDE);
    });

    test('Texture face mapping for Cactus, Glowstone, and Mossy Cobblestone', () => {
        const cactusId = Blocks.BLOCKS.CACTUS;
        assert.strictEqual(Blocks.getBlockFaceTexture(cactusId, 2), Blocks.TILES.CACTUS_TOP);
        assert.strictEqual(Blocks.getBlockFaceTexture(cactusId, 3), Blocks.TILES.CACTUS_TOP);
        assert.strictEqual(Blocks.getBlockFaceTexture(cactusId, 0), Blocks.TILES.CACTUS_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(cactusId, 1), Blocks.TILES.CACTUS_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(cactusId, 4), Blocks.TILES.CACTUS_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(cactusId, 5), Blocks.TILES.CACTUS_SIDE);

        for (let face = 0; face < 6; face++) {
            assert.strictEqual(Blocks.getBlockFaceTexture(Blocks.BLOCKS.GLOWSTONE, face), Blocks.TILES.GLOWSTONE);
            assert.strictEqual(Blocks.getBlockFaceTexture(Blocks.BLOCKS.MOSSY_COBBLESTONE, face), Blocks.TILES.MOSSY_COBBLESTONE);
        }
    });

    test('Texture face mapping for CRAFTING_TABLE, JACK_O_LANTERN, BIRCH_WOOD, BIRCH_LEAVES, GRAVEL, and LAVA', () => {
        const ctId = Blocks.BLOCKS.CRAFTING_TABLE;
        assert.strictEqual(Blocks.getBlockFaceTexture(ctId, 2), Blocks.TILES.CRAFTING_TOP);
        assert.strictEqual(Blocks.getBlockFaceTexture(ctId, 3), Blocks.TILES.PLANKS);
        assert.strictEqual(Blocks.getBlockFaceTexture(ctId, 4), Blocks.TILES.CRAFTING_FRONT);
        assert.strictEqual(Blocks.getBlockFaceTexture(ctId, 0), Blocks.TILES.CRAFTING_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(ctId, 1), Blocks.TILES.CRAFTING_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(ctId, 5), Blocks.TILES.CRAFTING_SIDE);

        const jolId = Blocks.BLOCKS.JACK_O_LANTERN;
        assert.strictEqual(Blocks.getBlockFaceTexture(jolId, 2), Blocks.TILES.PUMPKIN_TOP);
        assert.strictEqual(Blocks.getBlockFaceTexture(jolId, 3), Blocks.TILES.PUMPKIN_TOP);
        assert.strictEqual(Blocks.getBlockFaceTexture(jolId, 4), Blocks.TILES.JACK_O_LANTERN_FRONT);
        assert.strictEqual(Blocks.getBlockFaceTexture(jolId, 0), Blocks.TILES.PUMPKIN_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(jolId, 1), Blocks.TILES.PUMPKIN_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(jolId, 5), Blocks.TILES.PUMPKIN_SIDE);

        const birchWoodId = Blocks.BLOCKS.BIRCH_WOOD;
        assert.strictEqual(Blocks.getBlockFaceTexture(birchWoodId, 2), Blocks.TILES.BIRCH_TOP);
        assert.strictEqual(Blocks.getBlockFaceTexture(birchWoodId, 3), Blocks.TILES.BIRCH_TOP);
        assert.strictEqual(Blocks.getBlockFaceTexture(birchWoodId, 0), Blocks.TILES.BIRCH_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(birchWoodId, 1), Blocks.TILES.BIRCH_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(birchWoodId, 4), Blocks.TILES.BIRCH_SIDE);
        assert.strictEqual(Blocks.getBlockFaceTexture(birchWoodId, 5), Blocks.TILES.BIRCH_SIDE);

        const birchLeavesId = Blocks.BLOCKS.BIRCH_LEAVES;
        for (let face = 0; face < 6; face++) {
            assert.strictEqual(Blocks.getBlockFaceTexture(birchLeavesId, face), Blocks.TILES.BIRCH_LEAVES);
            assert.strictEqual(Blocks.getBlockFaceTexture(Blocks.BLOCKS.GRAVEL, face), Blocks.TILES.GRAVEL);
            assert.strictEqual(Blocks.getBlockFaceTexture(Blocks.BLOCKS.LAVA, face), Blocks.TILES.LAVA);
        }
    });

    test('Blocks.CRAFTING_RECIPES structure and validity', () => {
        assert.ok(Array.isArray(Blocks.CRAFTING_RECIPES), 'CRAFTING_RECIPES must be an array');
        assert.ok(Blocks.CRAFTING_RECIPES.length >= 10, 'Expected at least 10 crafting recipes');

        const recipeIds = new Set();
        for (const recipe of Blocks.CRAFTING_RECIPES) {
            assert.ok(typeof recipe.id === 'string' && recipe.id.length > 0, 'Recipe must have non-empty id');
            assert.ok(!recipeIds.has(recipe.id), `Duplicate recipe id: ${recipe.id}`);
            recipeIds.add(recipe.id);

            assert.ok(typeof recipe.name === 'string' && recipe.name.length > 0, 'Recipe must have non-empty name');

            // Output validation
            assert.ok(recipe.output && typeof recipe.output === 'object', 'Recipe must have output object');
            assert.ok(Number.isInteger(recipe.output.id) && recipe.output.id > 0, 'Output ID must be positive integer');
            assert.ok(recipe.output.count >= 1, 'Output count must be >= 1');
            assert.ok(Blocks.BLOCK_DEFS[recipe.output.id], `Output block ${recipe.output.id} must exist in BLOCK_DEFS`);

            // Ingredients validation
            assert.ok(Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0, 'Recipe ingredients must be non-empty array');
            for (const ing of recipe.ingredients) {
                assert.ok(Number.isInteger(ing.id) && ing.id > 0, 'Ingredient ID must be positive integer');
                assert.ok(ing.count >= 1, 'Ingredient count must be >= 1');
                assert.ok(Blocks.BLOCK_DEFS[ing.id], `Ingredient block ${ing.id} must exist in BLOCK_DEFS`);
            }
        }
    });

    test('UV bounds and indices for CRACK_0 through CRACK_9 overlay tiles', () => {
        for (let s = 0; s <= 9; s++) {
            const crackKey = `CRACK_${s}`;
            const expectedIndex = 240 + s;
            assert.strictEqual(Blocks.TILES[crackKey], expectedIndex, `${crackKey} tile index should be ${expectedIndex}`);

            const uv = Blocks.getTileUV(expectedIndex);
            assert.ok(uv.u0 >= 0 && uv.u0 <= 1, `${crackKey} u0 (${uv.u0}) must be within [0, 1]`);
            assert.ok(uv.u1 >= 0 && uv.u1 <= 1, `${crackKey} u1 (${uv.u1}) must be within [0, 1]`);
            assert.ok(uv.v0 >= 0 && uv.v0 <= 1, `${crackKey} v0 (${uv.v0}) must be within [0, 1]`);
            assert.ok(uv.v1 >= 0 && uv.v1 <= 1, `${crackKey} v1 (${uv.v1}) must be within [0, 1]`);
            assert.ok(uv.u1 > uv.u0, `${crackKey} u1 must be greater than u0`);
            assert.ok(uv.v1 > uv.v0, `${crackKey} v1 must be greater than v0`);

            // Tile is on row 15: v coordinate should correspond to row 15
            const tileX = s;
            const tileY = 15;
            const eps = 0.0001;
            assert.ok(Math.abs(uv.u0 - (tileX / 16 + eps)) < 1e-6);
            assert.ok(Math.abs(uv.u1 - ((tileX + 1) / 16 - eps)) < 1e-6);
            assert.ok(Math.abs(uv.v0 - (1 - (tileY + 1) / 16 + eps)) < 1e-6);
            assert.ok(Math.abs(uv.v1 - (1 - tileY / 16 - eps)) < 1e-6);
        }
    });
});
