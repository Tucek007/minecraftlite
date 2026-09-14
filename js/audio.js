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
    }

    return SoundFX;
}));
