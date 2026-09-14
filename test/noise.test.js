const { test, describe } = require('node:test');
const assert = require('node:assert');
const PerlinNoise = require('../js/noise.js');

describe('PerlinNoise tests', () => {
    test('Determinism: same seed produces identical results', () => {
        const n1 = new PerlinNoise(12345);
        const n2 = new PerlinNoise(12345);

        for (let i = 0; i < 20; i++) {
            const x = i * 0.37;
            const y = i * 0.91;
            const z = i * 0.13;
            assert.strictEqual(n1.noise2D(x, y), n2.noise2D(x, y));
            assert.strictEqual(n1.noise3D(x, y, z), n2.noise3D(x, y, z));
            assert.strictEqual(n1.fbm2D(x, y), n2.fbm2D(x, y));
        }
    });

    test('Different seeds produce different results', () => {
        const n1 = new PerlinNoise(111);
        const n2 = new PerlinNoise(999);

        let matches = 0;
        for (let i = 1; i <= 10; i++) {
            if (n1.noise2D(i * 0.37 + 0.1, i * 0.73 + 0.2) === n2.noise2D(i * 0.37 + 0.1, i * 0.73 + 0.2)) {
                matches++;
            }
        }
        assert.ok(matches < 2, 'Different seeds should produce mostly different values');
    });

    test('Output bounds: noise values are within [-1, 1] and never NaN', () => {
        const noise = new PerlinNoise(42);

        for (let i = -50; i < 50; i += 5) {
            for (let j = -50; j < 50; j += 5) {
                const val2D = noise.noise2D(i * 0.1, j * 0.1);
                assert.ok(!Number.isNaN(val2D), 'noise2D should not be NaN');
                assert.ok(val2D >= -1.05 && val2D <= 1.05, `noise2D (${val2D}) out of range [-1, 1]`);

                const val3D = noise.noise3D(i * 0.1, j * 0.1, (i + j) * 0.05);
                assert.ok(!Number.isNaN(val3D), 'noise3D should not be NaN');
                assert.ok(val3D >= -1.05 && val3D <= 1.05, `noise3D (${val3D}) out of range [-1, 1]`);

                const fbm = noise.fbm2D(i * 0.05, j * 0.05);
                assert.ok(!Number.isNaN(fbm), 'fbm2D should not be NaN');
                assert.ok(fbm >= -1.2 && fbm <= 1.2, `fbm2D (${fbm}) out of range`);
            }
        }
    });

    test('Smoothness / Continuity: nearby coordinates have nearby values', () => {
        const noise = new PerlinNoise(9999);
        const x = 12.34;
        const y = 56.78;
        const v1 = noise.noise2D(x, y);
        const v2 = noise.noise2D(x + 0.001, y + 0.001);

        const diff = Math.abs(v1 - v2);
        assert.ok(diff < 0.01, `Expected smooth transition, got diff: ${diff}`);
    });
});
