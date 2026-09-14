/**
 * noise.js - Simplex / Perlin Noise implementation for Minecraft Lite.
 * Supports seeded 2D/3D noise and multi-octave Fractal Brownian Motion (FBM).
 * Universal Module Definition (UMD) compatible with Browser and Node.js.
 */
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory();
    } else {
        root.PerlinNoise = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    // Linear congruential generator for reproducible seeds
    function createPRNG(seed) {
        let s = (seed ? Math.abs(seed) : 1337) % 2147483647;
        if (s <= 0) s += 2147483646;
        return function () {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    class PerlinNoise {
        constructor(seed = 12345) {
            this.p = new Uint8Array(256);
            this.perm = new Uint8Array(512);
            this.reseed(seed);
        }

        reseed(seed) {
            this.seedValue = seed;
            const random = createPRNG(seed);
            for (let i = 0; i < 256; i++) {
                this.p[i] = i;
            }
            // Shuffle
            for (let i = 255; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                const temp = this.p[i];
                this.p[i] = this.p[j];
                this.p[j] = temp;
            }
            for (let i = 0; i < 512; i++) {
                this.perm[i] = this.p[i & 255];
            }
        }

        fade(t) {
            return t * t * t * (t * (t * 6 - 15) + 10);
        }

        lerp(t, a, b) {
            return a + t * (b - a);
        }

        grad2D(hash, x, y) {
            const h = hash & 7;
            const u = h < 4 ? x : y;
            const v = h < 4 ? y : x;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        }

        grad3D(hash, x, y, z) {
            const h = hash & 15;
            const u = h < 8 ? x : y;
            const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        }

        /**
         * 2D Perlin Noise in range [-1, 1]
         */
        noise2D(x, y) {
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;

            const xf = x - Math.floor(x);
            const yf = y - Math.floor(y);

            const u = this.fade(xf);
            const v = this.fade(yf);

            const p = this.perm;
            const aa = p[p[X] + Y];
            const ab = p[p[X] + Y + 1];
            const ba = p[p[X + 1] + Y];
            const bb = p[p[X + 1] + Y + 1];

            const x1 = this.lerp(u, this.grad2D(aa, xf, yf), this.grad2D(ba, xf - 1, yf));
            const x2 = this.lerp(u, this.grad2D(ab, xf, yf - 1), this.grad2D(bb, xf - 1, yf - 1));

            return this.lerp(v, x1, x2);
        }

        /**
         * 3D Perlin Noise in range [-1, 1]
         */
        noise3D(x, y, z) {
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;
            const Z = Math.floor(z) & 255;

            const xf = x - Math.floor(x);
            const yf = y - Math.floor(y);
            const zf = z - Math.floor(z);

            const u = this.fade(xf);
            const v = this.fade(yf);
            const w = this.fade(zf);

            const p = this.perm;
            const a = p[X] + Y;
            const aa = p[a] + Z;
            const ab = p[a + 1] + Z;
            const b = p[X + 1] + Y;
            const ba = p[b] + Z;
            const bb = p[b + 1] + Z;

            const res = this.lerp(w,
                this.lerp(v,
                    this.lerp(u, this.grad3D(p[aa], xf, yf, zf), this.grad3D(p[ba], xf - 1, yf, zf)),
                    this.lerp(u, this.grad3D(p[ab], xf, yf - 1, zf), this.grad3D(p[bb], xf - 1, yf - 1, zf))
                ),
                this.lerp(v,
                    this.lerp(u, this.grad3D(p[aa + 1], xf, yf, zf - 1), this.grad3D(p[ba + 1], xf - 1, yf, zf - 1)),
                    this.lerp(u, this.grad3D(p[ab + 1], xf, yf - 1, zf - 1), this.grad3D(p[bb + 1], xf - 1, yf - 1, zf - 1))
                )
            );
            return res;
        }

        /**
         * Fractal Brownian Motion (FBM) combining multiple octaves.
         * Returns value roughly between -1 and 1.
         */
        fbm2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
            let total = 0;
            let frequency = 1;
            let amplitude = 1;
            let maxValue = 0;

            for (let i = 0; i < octaves; i++) {
                total += this.noise2D(x * frequency, y * frequency) * amplitude;
                maxValue += amplitude;
                amplitude *= persistence;
                frequency *= lacunarity;
            }

            return total / maxValue;
        }

        /**
         * 3D FBM for caves / 3D overhangs
         */
        fbm3D(x, y, z, octaves = 3, persistence = 0.5, lacunarity = 2.0) {
            let total = 0;
            let frequency = 1;
            let amplitude = 1;
            let maxValue = 0;

            for (let i = 0; i < octaves; i++) {
                total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
                maxValue += amplitude;
                amplitude *= persistence;
                frequency *= lacunarity;
            }

            return total / maxValue;
        }
    }

    return PerlinNoise;
}));
