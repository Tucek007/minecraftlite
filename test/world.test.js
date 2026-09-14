const { test, describe } = require('node:test');
const assert = require('node:assert');
const Blocks = require('../js/blocks.js');
const World = require('../js/world.js');

describe('World and Chunk tests', () => {
    test('Chunk get/set block within bounds', () => {
        const chunk = new World.Chunk(0, 0);
        assert.strictEqual(chunk.getBlock(5, 10, 5), 0, 'Initial block should be AIR (0)');

        chunk.setBlock(5, 10, 5, Blocks.BLOCKS.STONE);
        assert.strictEqual(chunk.getBlock(5, 10, 5), Blocks.BLOCKS.STONE);
        assert.strictEqual(chunk.dirty, true, 'Setting block should mark chunk dirty');
    });

    test('Chunk bounds protection', () => {
        const chunk = new World.Chunk(0, 0);
        assert.strictEqual(chunk.getBlock(-1, 0, 0), 0);
        assert.strictEqual(chunk.getBlock(0, 100, 0), 0);
        assert.strictEqual(chunk.setBlock(-1, 0, 0, 1), false);
        assert.strictEqual(chunk.setBlock(0, World.CHUNK_HEIGHT + 5, 0, 1), false);
    });

    test('VoxelWorld on-demand chunk generation and bounds', () => {
        const world = new World.VoxelWorld(777);

        // Bedrock check at y=0
        const b0 = world.getBlock(0, 0, 0);
        assert.strictEqual(b0, Blocks.BLOCKS.BEDROCK, 'Block at y=0 must be BEDROCK');

        // Negative y returns bedrock
        assert.strictEqual(world.getBlock(0, -5, 0), Blocks.BLOCKS.BEDROCK);

        // Above max height returns AIR
        assert.strictEqual(world.getBlock(0, World.CHUNK_HEIGHT + 1, 0), 0);
    });

    test('VoxelWorld block modifications and serialization', () => {
        const world = new World.VoxelWorld(42);

        // Set arbitrary blocks
        world.setBlock(10, 25, 10, Blocks.BLOCKS.DIAMOND_ORE);
        world.setBlock(10, 26, 10, Blocks.BLOCKS.GOLD_ORE);

        assert.strictEqual(world.getBlock(10, 25, 10), Blocks.BLOCKS.DIAMOND_ORE);
        assert.strictEqual(world.getBlock(10, 26, 10), Blocks.BLOCKS.GOLD_ORE);

        // Serialize
        const json = world.saveToJSON();
        assert.ok(typeof json === 'string');

        // Create new world and deserialize
        const newWorld = new World.VoxelWorld(999);
        newWorld.loadFromJSON(json);

        assert.strictEqual(newWorld.seed, 42, 'Seed should be restored');
        assert.strictEqual(newWorld.getBlock(10, 25, 10), Blocks.BLOCKS.DIAMOND_ORE);
        assert.strictEqual(newWorld.getBlock(10, 26, 10), Blocks.BLOCKS.GOLD_ORE);
    });

    test('Biome distribution returns expected types', () => {
        const world = new World.VoxelWorld(1234);
        const validBiomes = new Set(['plains', 'forest', 'desert', 'mountains']);

        for (let x = -200; x <= 200; x += 50) {
            for (let z = -200; z <= 200; z += 50) {
                const biome = world.getBiome(x, z);
                assert.ok(validBiomes.has(biome), `Biome "${biome}" is valid`);
            }
        }
    });
});
