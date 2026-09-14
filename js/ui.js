/**
 * ui.js - HUD, Hotbar, F3 Debug Overlay, Modal Menus, and Notifications.
 */
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory(require('./blocks'));
    } else {
        root.UI = factory(root.Blocks);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (BlocksModule) {
    'use strict';

    const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
    const Blocks = BlocksModule || (g && g.Blocks) || (typeof require !== 'undefined' ? require('./blocks') : null);

    class UIManager {
        constructor() {
            this.debugVisible = false;
            this.toastTimer = null;
            this.fpsHistory = [];
            this.lastFrameTime = performance.now();

            this.hotbarBlocks = [
                1,  // Grass
                2,  // Dirt
                3,  // Stone
                4,  // Cobblestone
                7,  // Planks
                5,  // Wood
                8,  // Brick
                10, // Glass
                15  // TNT
            ];
        }

        init(player, world, atlasCanvas) {
            this.player = player;
            this.world = world;
            this.atlasCanvas = atlasCanvas;

            this.hotbarEl = document.getElementById('hotbar');
            this.debugEl = document.getElementById('debug-info');
            this.toastEl = document.getElementById('toast');
            this.blockPromptEl = document.getElementById('block-prompt');

            this.buildHotbar();
            this.updateActiveSlot(player.selectedSlot);
        }

        buildHotbar() {
            if (!this.hotbarEl || !this.atlasCanvas || !Blocks) return;

            this.hotbarEl.innerHTML = '';
            for (let i = 0; i < 9; i++) {
                const blockId = this.hotbarBlocks[i];
                const bDef = Blocks.BLOCK_DEFS[blockId];

                const slot = document.createElement('div');
                slot.className = 'hotbar-slot';
                slot.id = `slot-${i}`;
                slot.title = bDef ? bDef.name : '';

                // Draw 2D texture icon
                const iconCanvas = document.createElement('canvas');
                iconCanvas.width = 36;
                iconCanvas.height = 36;
                const ictx = iconCanvas.getContext('2d');
                ictx.imageSmoothingEnabled = false;

                const tileIdx = Blocks.getBlockFaceTexture(blockId, 2); // top face
                const tx = (tileIdx % 16) * 16;
                const ty = Math.floor(tileIdx / 16) * 16;

                ictx.drawImage(this.atlasCanvas, tx, ty, 16, 16, 0, 0, 36, 36);

                const num = document.createElement('span');
                num.className = 'slot-num';
                num.innerText = `${i + 1}`;

                slot.appendChild(iconCanvas);
                slot.appendChild(num);

                slot.addEventListener('click', () => {
                    this.player.selectedSlot = i;
                    this.updateActiveSlot(i);
                });

                this.hotbarEl.appendChild(slot);
            }
        }

        updateActiveSlot(index) {
            const slots = document.querySelectorAll('.hotbar-slot');
            slots.forEach((s, idx) => {
                if (idx === index) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });

            // Update current block name prompt
            if (this.blockPromptEl && Blocks) {
                const bId = this.hotbarBlocks[index];
                const bDef = Blocks.BLOCK_DEFS[bId];
                if (bDef) {
                    this.blockPromptEl.innerText = bDef.name;
                    this.blockPromptEl.style.opacity = '1';
                    clearTimeout(this.promptTimer);
                    this.promptTimer = setTimeout(() => {
                        this.blockPromptEl.style.opacity = '0';
                    }, 2000);
                }
            }
        }

        getSelectedBlockId() {
            if (!this.player) return 1;
            return this.hotbarBlocks[this.player.selectedSlot] || 1;
        }

        toggleDebug() {
            this.debugVisible = !this.debugVisible;
            if (this.debugEl) {
                this.debugEl.style.display = this.debugVisible ? 'block' : 'none';
            }
        }

        showToast(message, duration = 2500) {
            if (!this.toastEl) return;
            this.toastEl.innerText = message;
            this.toastEl.classList.add('visible');
            clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => {
                this.toastEl.classList.remove('visible');
            }, duration);
        }

        update(dt) {
            const now = performance.now();
            const frameFps = 1 / Math.max(0.001, dt);
            this.fpsHistory.push(frameFps);
            if (this.fpsHistory.length > 30) this.fpsHistory.shift();

            if (!this.debugVisible || !this.debugEl || !this.player || !this.world) return;

            const avgFps = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
            const pos = this.player.position;
            const bx = Math.floor(pos.x);
            const by = Math.floor(pos.y);
            const bz = Math.floor(pos.z);
            const cx = Math.floor(pos.x / 16);
            const cz = Math.floor(pos.z / 16);

            // Facing direction
            let yawDeg = (-this.player.yaw * 180 / Math.PI) % 360;
            if (yawDeg < 0) yawDeg += 360;
            let facing = 'North';
            if (yawDeg >= 45 && yawDeg < 135) facing = 'East';
            else if (yawDeg >= 135 && yawDeg < 225) facing = 'South';
            else if (yawDeg >= 225 && yawDeg < 315) facing = 'West';

            const biome = this.world.getBiome(bx, bz);

            let targetText = 'None';
            if (this.player.targetBlock && this.player.targetBlock.hit) {
                const tb = this.player.targetBlock.blockPos;
                const bId = this.world.getBlock(tb.x, tb.y, tb.z);
                const bDef = Blocks && Blocks.BLOCK_DEFS[bId];
                targetText = `${bDef ? bDef.name : 'Block'} at [${tb.x}, ${tb.y}, ${tb.z}]`;
            }

            this.debugEl.innerHTML = `
                <div><strong>Minecraft Lite</strong> (v1.0.0)</div>
                <div>FPS: ${avgFps}</div>
                <div>XYZ: ${pos.x.toFixed(3)} / ${pos.y.toFixed(3)} / ${pos.z.toFixed(3)}</div>
                <div>Block: ${bx} ${by} ${bz}</div>
                <div>Chunk: ${cx}, ${cz} in (16x16x64)</div>
                <div>Facing: ${facing} (Yaw: ${yawDeg.toFixed(1)}°, Pitch: ${(-this.player.pitch * 180 / Math.PI).toFixed(1)}°)</div>
                <div>Biome: ${biome.toUpperCase()}</div>
                <div>Mode: ${this.player.isFlying ? 'CREATIVE FLYING' : 'SURVIVAL'}</div>
                <div>Target: ${targetText}</div>
                <div>Chunks Loaded: ${this.world.chunks.size}</div>
            `;
        }
    }

    return new UIManager();
}));
