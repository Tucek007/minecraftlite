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
});
