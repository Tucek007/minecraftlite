/**
 * audio.js - Web Audio API Procedural Sound Synthesizer for Minecraft Lite.
 * Zero external audio assets required.
 */
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory();
    } else {
        root.SoundFX = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    class SoundFX {
        constructor() {
            this.ctx = null;
            this.enabled = true;
        }

        init() {
            if (this.ctx) return;
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }

        resume() {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        /**
         * Procedural white noise buffer generator
         */
        createNoiseBuffer(duration = 0.2) {
            if (!this.ctx) return null;
            const bufferSize = Math.floor(this.ctx.sampleRate * duration);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            return buffer;
        }

        /**
         * Block break / dig crunch sound
         */
        playBreak(type = 'stone') {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(0.15);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';

            let baseFreq = 800;
            if (type === 'grass' || type === 'leaves') baseFreq = 1200;
            else if (type === 'wood') baseFreq = 600;
            else if (type === 'sand') baseFreq = 1400;

            filter.frequency.setValueAtTime(baseFreq, t);
            filter.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, t + 0.12);
            filter.Q.setValueAtTime(3.0, t);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start(t);
            noise.stop(t + 0.15);
        }

        /**
         * Block place sound (satisfying pop / thump)
         */
        playPlace(type = 'stone') {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            let startFreq = 240;
            if (type === 'wood') startFreq = 180;
            else if (type === 'grass') startFreq = 300;
            else if (type === 'sand') startFreq = 200;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(startFreq, t);
            osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);

            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.09);

            // Add short noise click
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(0.04);
            const nFilter = this.ctx.createBiquadFilter();
            nFilter.type = 'highpass';
            nFilter.frequency.setValueAtTime(1000, t);
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.15, t);
            nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

            noise.connect(nFilter);
            nFilter.connect(nGain);
            nGain.connect(this.ctx.destination);

            noise.start(t);
            noise.stop(t + 0.04);
        }

        /**
         * Footstep sound
         */
        playStep(type = 'grass') {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(0.08);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            const freq = (type === 'sand' || type === 'grass') ? 800 : 500;
            filter.frequency.setValueAtTime(freq, t);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.09 + Math.random() * 0.04, t);
            gain.gain.exponentialRampToValueAtTime(0.005, t + 0.07);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start(t);
            noise.stop(t + 0.08);
        }

        /**
         * Jump whoosh sound
         */
        playJump() {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, t);
            osc.frequency.exponentialRampToValueAtTime(280, t + 0.12);

            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.13);
        }

        /**
         * Water splash sound
         */
        playSplash() {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(0.25);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(600, t);
            filter.frequency.exponentialRampToValueAtTime(300, t + 0.22);
            filter.Q.setValueAtTime(2.0, t);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.24);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start(t);
            noise.stop(t + 0.25);
        }

        /**
         * TNT fuse hiss / sizzle
         */
        playFuse() {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(0.2);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(3000, t);
            filter.frequency.exponentialRampToValueAtTime(1500, t + 0.18);
            filter.Q.setValueAtTime(3.5, t);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.19);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start(t);
            noise.stop(t + 0.2);
        }

        /**
         * TNT explosion sound (low rumble oscillator + noise blast)
         */
        playExplode() {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;

            // Deep rumble oscillator
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(130, t);
            osc.frequency.exponentialRampToValueAtTime(25, t + 0.5);

            const oscGain = this.ctx.createGain();
            oscGain.gain.setValueAtTime(0.5, t);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.55);

            osc.connect(oscGain);
            oscGain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.6);

            // Explosive blast noise
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(0.7);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1200, t);
            filter.frequency.exponentialRampToValueAtTime(60, t + 0.65);

            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.65, t);
            nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.68);

            noise.connect(filter);
            filter.connect(nGain);
            nGain.connect(this.ctx.destination);

            noise.start(t);
            noise.stop(t + 0.7);
        }

        /**
         * Player hurt sound (classic Minecraft oof)
         */
        playHurt() {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(190, t);
            osc.frequency.exponentialRampToValueAtTime(75, t + 0.16);

            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.17);
        }

        /**
         * Item pickup sound (short, cheerful pop)
         */
        playPickup() {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(420, t);
            osc.frequency.exponentialRampToValueAtTime(920, t + 0.07);

            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.075);
        }

        /**
         * Crafting sound (pleasant two-tone chime)
         */
        playCraft() {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(330, t);
            osc.frequency.setValueAtTime(495, t + 0.07);

            gain.gain.setValueAtTime(0.25, t);
            gain.gain.setValueAtTime(0.25, t + 0.07);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.15);
        }

        /**
         * Procedural mob hurt sound
         */
        playMobHurt(mobType = 'pig') {
            if (!this.ctx || !this.enabled) return;
            this.resume();

            const t = this.ctx.currentTime;
            const type = (mobType || 'pig').toLowerCase();

            if (type === 'creeper') {
                const noise = this.ctx.createBufferSource();
                noise.buffer = this.createNoiseBuffer(0.18);
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(2800, t);
                filter.frequency.exponentialRampToValueAtTime(1400, t + 0.16);
                filter.Q.setValueAtTime(3.0, t);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.35, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.17);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                noise.start(t);
                noise.stop(t + 0.18);
                return;
            }

            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();

            let oscType = 'triangle';
            let startFreq = 220;
            let endFreq = 110;
            let duration = 0.16;
            let noiseFreq = 800;
            let noiseGainLevel = 0.18;

            if (type === 'pig') {
                oscType = 'sawtooth';
                startFreq = 480;
                endFreq = 620;
                duration = 0.14;
                noiseFreq = 1600;
                noiseGainLevel = 0.2;
            } else if (type === 'sheep') {
                oscType = 'sawtooth';
                startFreq = 280;
                endFreq = 180;
                duration = 0.18;
                noiseFreq = 900;
                noiseGainLevel = 0.15;
            } else if (type === 'zombie') {
                oscType = 'sawtooth';
                startFreq = 115;
                endFreq = 55;
                duration = 0.24;
                noiseFreq = 350;
                noiseGainLevel = 0.25;
            }

            osc.type = oscType;
            osc.frequency.setValueAtTime(startFreq, t);
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);

            oscGain.gain.setValueAtTime(0.32, t);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

            osc.connect(oscGain);
            oscGain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + duration + 0.01);

            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(duration);

            const nFilter = this.ctx.createBiquadFilter();
            nFilter.type = 'bandpass';
            nFilter.frequency.setValueAtTime(noiseFreq, t);
            nFilter.frequency.exponentialRampToValueAtTime(Math.max(60, noiseFreq * 0.5), t + duration);
            nFilter.Q.setValueAtTime(2.0, t);

            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(noiseGainLevel, t);
            nGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

            noise.connect(nFilter);
            nFilter.connect(nGain);
            nGain.connect(this.ctx.destination);

            noise.start(t);
            noise.stop(t + duration);
        }
    }

    return SoundFX;
}));
