/**
 * ui.js - HUD, Hotbar, F3 Debug Overlay, Modal Menus, Crafting System, and Notifications.
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

    function getDefaultRecipes(b) {
        const B = (b && b.BLOCKS) ? b.BLOCKS : {
            WOOD: 5, PLANKS: 7, STONE: 3, COBBLESTONE: 4,
            DIRT: 2, BRICK: 8, SAND: 9, GLASS: 10,
            BOOKSHELF: 16, TNT: 15, COAL_ORE: 12,
            GLOWSTONE: 21, GOLD_ORE: 18, MOSSY_COBBLESTONE: 22, LEAVES: 6
        };
        return [
            {
                name: 'Dřevěná prkna (Planks x4)',
                output: { id: B.PLANKS || 7, count: 4 },
                ingredients: [{ id: B.WOOD || 5, count: 1 }]
            },
            {
                name: 'Kámen (Stone x4)',
                output: { id: B.STONE || 3, count: 4 },
                ingredients: [{ id: B.COBBLESTONE || 4, count: 4 }]
            },
            {
                name: 'Cihly (Brick x4)',
                output: { id: B.BRICK || 8, count: 4 },
                ingredients: [{ id: B.DIRT || 2, count: 2 }, { id: B.STONE || 3, count: 2 }]
            },
            {
                name: 'Sklo (Glass x2)',
                output: { id: B.GLASS || 10, count: 2 },
                ingredients: [{ id: B.SAND || 9, count: 2 }]
            },
            {
                name: 'Knihovna (Bookshelf x1)',
                output: { id: B.BOOKSHELF || 16, count: 1 },
                ingredients: [{ id: B.PLANKS || 7, count: 3 }]
            },
            {
                name: 'TNT (Výbušnina x1)',
                output: { id: B.TNT || 15, count: 1 },
                ingredients: [{ id: B.SAND || 9, count: 2 }, { id: B.COAL_ORE || 12, count: 2 }]
            },
            {
                name: 'Glowstone (Svítící blok x1)',
                output: { id: B.GLOWSTONE || 21, count: 1 },
                ingredients: [{ id: B.GOLD_ORE || 18, count: 1 }, { id: B.GLASS || 10, count: 1 }]
            },
            {
                name: 'Zarostlý kámen (Mossy Cobble x2)',
                output: { id: B.MOSSY_COBBLESTONE || 22, count: 2 },
                ingredients: [{ id: B.COBBLESTONE || 4, count: 2 }, { id: B.LEAVES || 6, count: 2 }]
            }
        ];
    }

    class UIManager {
        constructor() {
            this.debugVisible = false;
            this.isInventoryOpen = false;
            this.hoveredBlockId = null;
            this.toastTimer = null;
            this.fpsHistory = [];
            this.lastFrameTime = performance.now();

            this.inventoryCounts = {};
            this.gameMode = 'survival';

            this.settings = {
                fov: 75,
                sensitivity: 0.0022,
                renderDistance: 3
            };

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

            // Load saved settings if available
            try {
                if (typeof localStorage !== 'undefined') {
                    const saved = localStorage.getItem('minecraftlite_settings');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed && typeof parsed === 'object') {
                            if (typeof parsed.fov === 'number') this.settings.fov = parsed.fov;
                            if (typeof parsed.sensitivity === 'number') this.settings.sensitivity = parsed.sensitivity;
                            if (typeof parsed.renderDistance === 'number') this.settings.renderDistance = parsed.renderDistance;
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to load settings:', e);
            }

            if (this.player) {
                this.player.baseFov = this.settings.fov;
                this.player.sensitivity = this.settings.sensitivity;
                if (this.player.currentFov !== undefined) {
                    this.player.currentFov = this.settings.fov;
                }
            }

            if (typeof document === 'undefined') return;

            this.underwaterEl = document.getElementById('underwater-overlay');
            this.hotbarEl = document.getElementById('hotbar');
            this.debugEl = document.getElementById('debug-info');
            this.toastEl = document.getElementById('toast');
            this.blockPromptEl = document.getElementById('block-prompt');
            this.inventoryOverlayEl = document.getElementById('inventory-overlay');
            this.heartsBarEl = document.getElementById('hearts-bar');

            this.bubblesBarEl = document.getElementById('bubbles-bar');
            this.modeIndicatorEl = document.getElementById('mode-indicator');
            this.craftingGridEl = document.getElementById('crafting-grid');
            this.gameModeBtn = document.getElementById('btn-gamemode');
            this.invGameModeBtn = document.getElementById('btn-inv-gamemode');

            const handleModeCycle = () => {
                if (this.player && typeof this.player.cycleGameMode === 'function') {
                    const newMode = this.player.cycleGameMode();
                    if (newMode) {
                        this.updateGameMode(newMode);
                    } else if (this.player.gameMode) {
                        this.updateGameMode(this.player.gameMode);
                    }
                }
            };
            if (this.gameModeBtn) {
                this.gameModeBtn.addEventListener('click', handleModeCycle);
            }
            if (this.invGameModeBtn) {
                this.invGameModeBtn.addEventListener('click', handleModeCycle);
            }

            this.initSettingsUI();

            this.buildHotbar();
            this.buildInventoryGrid();
            this.buildCraftingGrid();
            this.updateGameMode(this.player && this.player.gameMode ? this.player.gameMode : 'survival');

            if (this.player && this.player.selectedSlot !== undefined) {
                this.updateActiveSlot(this.player.selectedSlot);
            }
            if (this.player) {
                this.updateHealth(this.player.health !== undefined ? this.player.health : 20);
            }

            const closeBtn = document.getElementById('btn-inventory-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeInventory());
            }

            if (typeof window !== 'undefined') {
                window.addEventListener('keydown', (e) => {
                    if (!this.isInventoryOpen) return;
                    if (e.code === 'Escape') {
                        if (typeof e.preventDefault === 'function') e.preventDefault();
                        this.closeInventory();
                        return;
                    }
                    if (e.code.startsWith('Digit') && e.code.length === 6) {
                        const num = parseInt(e.code[5], 10);
                        if (num >= 1 && num <= 9) {
                            let blockId = this.hoveredBlockId;
                            if (!blockId && typeof document !== 'undefined' && document.querySelector) {
                                const hovered = document.querySelector('.inventory-slot:hover');
                                if (hovered && hovered.dataset && hovered.dataset.blockId) {
                                    blockId = parseInt(hovered.dataset.blockId, 10);
                                } else if (hovered && typeof hovered.getAttribute === 'function') {
                                    const attr = hovered.getAttribute('data-block-id');
                                    if (attr) blockId = parseInt(attr, 10);
                                }
                            }
                            if (blockId) {
                                this.setHotbarBlock(num - 1, blockId);
                                const bDef = Blocks && Blocks.BLOCK_DEFS && Blocks.BLOCK_DEFS[blockId];
                                this.showToast(`${bDef ? bDef.name : 'Block'} assigned to slot ${num}`);
                            }
                        }
                    }
                });
            }
        }

        initSettingsUI() {
            if (typeof document === 'undefined') return;

            const fovSlider = document.getElementById('setting-fov');
            const sensSlider = document.getElementById('setting-sens');
            const distSlider = document.getElementById('setting-dist');
            const fovValEl = document.getElementById('val-fov');
            const sensValEl = document.getElementById('val-sens');
            const distValEl = document.getElementById('val-dist');

            const saveSettings = () => {
                try {
                    if (typeof localStorage !== 'undefined') {
                        localStorage.setItem('minecraftlite_settings', JSON.stringify(this.settings));
                    }
                } catch (e) {}
            };

            if (fovSlider) {
                fovSlider.value = this.settings.fov;
                if (fovValEl) fovValEl.innerText = `${this.settings.fov}°`;
                fovSlider.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value, 10);
                    this.settings.fov = val;
                    if (fovValEl) fovValEl.innerText = `${val}°`;
                    if (this.player) {
                        this.player.baseFov = val;
                    }
                    saveSettings();
                });
            }

            if (sensSlider) {
                const sliderVal = Math.round(this.settings.sensitivity * 10000);
                sensSlider.value = sliderVal;
                if (sensValEl) sensValEl.innerText = `${Math.round((sliderVal / 22) * 100)}%`;
                sensSlider.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value, 10);
                    const sens = val * 0.0001;
                    this.settings.sensitivity = sens;
                    if (sensValEl) sensValEl.innerText = `${Math.round((val / 22) * 100)}%`;
                    if (this.player) {
                        this.player.sensitivity = sens;
                    }
                    saveSettings();
                });
            }

            if (distSlider) {
                distSlider.value = this.settings.renderDistance;
                if (distValEl) distValEl.innerText = `${this.settings.renderDistance} chunks`;
                distSlider.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value, 10);
                    this.settings.renderDistance = val;
                    if (distValEl) distValEl.innerText = `${val} chunks`;
                    if (typeof window !== 'undefined' && window.RENDER_DISTANCE !== undefined) {
                        window.RENDER_DISTANCE = val;
                    }
                    saveSettings();
                });
            }
        }

        getItemCount(blockId) {
            return this.inventoryCounts[blockId] || 0;
        }

        addCollectedItem(blockId, count = 1) {
            if (!blockId || blockId <= 0) return;
            this.inventoryCounts[blockId] = (this.inventoryCounts[blockId] || 0) + count;
            this.buildHotbar();
            if (this.player && this.player.selectedSlot !== undefined) {
                this.updateActiveSlot(this.player.selectedSlot);
            }
            if (this.isInventoryOpen) {
                this.buildCraftingGrid();
                this.buildInventoryGrid();
            }
        }

        isFreeCraftingMode() {
            return Boolean(
                this.gameMode === 'peaceful' ||
                this.gameMode === 'creative' ||
                (this.player && (this.player.gameMode === 'peaceful' || this.player.gameMode === 'creative' || this.player.isFlying))
            );
        }

        canCraftRecipe(recipe) {
            if (!recipe || !Array.isArray(recipe.ingredients)) return false;
            if (this.isFreeCraftingMode()) return true;
            return recipe.ingredients.every(ing => this.getItemCount(ing.id) >= ing.count);
        }

        craftRecipe(recipe) {
            if (!recipe || !this.canCraftRecipe(recipe)) {
                this.showToast('Nedostatek surovin pro výrobu! (Přepni do Klidného režimu G pro volný crafting)');
                return false;
            }

            if (!this.isFreeCraftingMode()) {
                for (const ing of recipe.ingredients) {
                    this.inventoryCounts[ing.id] = Math.max(0, (this.inventoryCounts[ing.id] || 0) - ing.count);
                }
            }

            const outCount = (recipe.output && recipe.output.count) || 1;
            const outId = recipe.output ? recipe.output.id : 1;
            this.inventoryCounts[outId] = (this.inventoryCounts[outId] || 0) + outCount;

            const slot = this.player ? this.player.selectedSlot : 0;
            this.setHotbarBlock(slot, outId);

            if (this.player && this.player.audio && typeof this.player.audio.playCraft === 'function') {
                this.player.audio.playCraft();
            }

            this.showToast(`Vyrobeno: ${recipe.name}!`);
            this.buildCraftingGrid();
            this.buildInventoryGrid();
            return true;
        }

        buildCraftingGrid() {
            if (typeof document === 'undefined') return;
            const gridEl = document.getElementById('crafting-grid');
            if (!gridEl) return;

            gridEl.innerHTML = '';
            const recipes = (Blocks && Blocks.CRAFTING_RECIPES && Blocks.CRAFTING_RECIPES.length)
                ? Blocks.CRAFTING_RECIPES
                : getDefaultRecipes(Blocks);

            const isFree = this.isFreeCraftingMode();

            for (const recipe of recipes) {
                if (!recipe || !recipe.output) continue;

                const canCraft = this.canCraftRecipe(recipe);
                const card = document.createElement('div');
                card.className = `crafting-recipe ${canCraft ? 'craftable' : 'locked'}`;
                card.title = canCraft ? `Vyrobit ${recipe.name}` : `Nedostatek surovin pro: ${recipe.name}`;

                // 32x32 Canvas Icon
                const iconCanvas = document.createElement('canvas');
                iconCanvas.width = 32;
                iconCanvas.height = 32;
                const ictx = typeof iconCanvas.getContext === 'function' ? iconCanvas.getContext('2d') : null;
                if (ictx && this.atlasCanvas && Blocks) {
                    ictx.imageSmoothingEnabled = false;
                    const tileIdx = typeof Blocks.getBlockFaceTexture === 'function'
                        ? Blocks.getBlockFaceTexture(recipe.output.id, 0)
                        : 0;
                    const tx = (tileIdx % 16) * 16;
                    const ty = Math.floor(tileIdx / 16) * 16;
                    ictx.drawImage(this.atlasCanvas, tx, ty, 16, 16, 0, 0, 32, 32);
                }

                // Info container
                const infoDiv = document.createElement('div');
                infoDiv.className = 'crafting-recipe-info';

                const titleDiv = document.createElement('div');
                titleDiv.className = 'crafting-recipe-title';
                titleDiv.innerText = recipe.name;

                const ingDiv = document.createElement('div');
                ingDiv.className = 'crafting-recipe-ingredients';
                if (isFree) {
                    ingDiv.innerText = 'Zdarma (Crafting mód)';
                    ingDiv.style.color = '#88ff88';
                } else {
                    const ingList = (recipe.ingredients || []).map(ing => {
                        const bDef = Blocks && Blocks.BLOCK_DEFS ? Blocks.BLOCK_DEFS[ing.id] : null;
                        const name = bDef ? bDef.name : `Item #${ing.id}`;
                        const current = this.getItemCount(ing.id);
                        return `${name}: ${current}/${ing.count}`;
                    });
                    ingDiv.innerText = ingList.join(', ');
                }

                infoDiv.appendChild(titleDiv);
                infoDiv.appendChild(ingDiv);

                card.appendChild(iconCanvas);
                card.appendChild(infoDiv);

                card.addEventListener('click', () => {
                    this.craftRecipe(recipe);
                });

                gridEl.appendChild(card);
            }
        }

        buildHotbar() {
            if (!this.hotbarEl || !this.atlasCanvas || !Blocks) return;

            this.hotbarEl.innerHTML = '';
            for (let i = 0; i < 9; i++) {
                const blockId = this.hotbarBlocks[i];
                const bDef = Blocks.BLOCK_DEFS ? Blocks.BLOCK_DEFS[blockId] : null;

                const slot = document.createElement('div');
                slot.className = 'hotbar-slot';
                slot.id = `slot-${i}`;
                slot.title = bDef ? bDef.name : '';

                // Draw 2D texture icon
                const iconCanvas = document.createElement('canvas');
                iconCanvas.width = 36;
                iconCanvas.height = 36;
                const ictx = typeof iconCanvas.getContext === 'function' ? iconCanvas.getContext('2d') : null;
                if (ictx) {
                    ictx.imageSmoothingEnabled = false;

                    const tileIdx = typeof Blocks.getBlockFaceTexture === 'function' ? Blocks.getBlockFaceTexture(blockId, 0) : 0;
                    const tx = (tileIdx % 16) * 16;
                    const ty = Math.floor(tileIdx / 16) * 16;

                    ictx.drawImage(this.atlasCanvas, tx, ty, 16, 16, 0, 0, 36, 36);
                }

                const num = document.createElement('span');
                num.className = 'slot-num';
                num.innerText = `${i + 1}`;

                slot.appendChild(iconCanvas);
                slot.appendChild(num);

                // Count badge
                const count = this.getItemCount(blockId);
                if (count > 0) {
                    const countEl = document.createElement('span');
                    countEl.className = 'slot-count';
                    countEl.innerText = `${count}`;
                    slot.appendChild(countEl);
                }

                const selectSlot = (e) => {
                    if (e && e.type === 'touchstart') {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (this.player) {
                        this.player.selectedSlot = i;
                        this.updateActiveSlot(i);
                    }
                };
                slot.addEventListener('click', selectSlot);
                slot.addEventListener('touchstart', selectSlot, { passive: false });

                this.hotbarEl.appendChild(slot);
            }
        }

        buildInventoryGrid() {
            if (typeof document === 'undefined') return;
            const gridEl = document.getElementById('inventory-grid');
            if (!gridEl || !this.atlasCanvas || !Blocks || !Blocks.BLOCKS) return;

            gridEl.innerHTML = '';

            // Iterate dynamically over all block IDs in Blocks.BLOCKS where blockId > 0 (sorted ascending by blockId)
            const blockIds = Object.values(Blocks.BLOCKS)
                .filter(id => typeof id === 'number' && id > 0)
                .filter((id, index, self) => self.indexOf(id) === index)
                .sort((a, b) => a - b);

            for (const blockId of blockIds) {
                const bDef = Blocks.BLOCK_DEFS ? Blocks.BLOCK_DEFS[blockId] : null;
                if (!bDef) continue;

                const slot = document.createElement('div');
                slot.className = 'inventory-slot';
                slot.title = `${bDef.name} (Click to set in active hotbar slot, or hover & press 1-9)`;
                try {
                    if (slot.dataset) {
                        slot.dataset.blockId = blockId;
                    }
                } catch (e) {}
                if (typeof slot.setAttribute === 'function') {
                    slot.setAttribute('data-block-id', blockId);
                }

                const iconCanvas = document.createElement('canvas');
                iconCanvas.width = 36;
                iconCanvas.height = 36;
                const ictx = typeof iconCanvas.getContext === 'function' ? iconCanvas.getContext('2d') : null;
                if (ictx) {
                    ictx.imageSmoothingEnabled = false;
                    const tileIdx = typeof Blocks.getBlockFaceTexture === 'function' ? Blocks.getBlockFaceTexture(blockId, 0) : 0;
                    const tx = (tileIdx % 16) * 16;
                    const ty = Math.floor(tileIdx / 16) * 16;
                    ictx.drawImage(this.atlasCanvas, tx, ty, 16, 16, 0, 0, 36, 36);
                }

                const label = document.createElement('div');
                label.className = 'inventory-slot-name';
                label.innerText = bDef.name;

                slot.appendChild(iconCanvas);
                slot.appendChild(label);

                const count = this.getItemCount(blockId);
                if (count > 0) {
                    const countEl = document.createElement('span');
                    countEl.className = 'slot-count';
                    countEl.innerText = `${count}`;
                    slot.appendChild(countEl);
                }

                slot.addEventListener('mouseenter', () => {
                    this.hoveredBlockId = blockId;
                });

                slot.addEventListener('mouseleave', () => {
                    if (this.hoveredBlockId === blockId) {
                        this.hoveredBlockId = null;
                    }
                });

                slot.addEventListener('click', () => {
                    const targetSlot = this.player ? this.player.selectedSlot : 0;
                    this.setHotbarBlock(targetSlot, blockId);
                    this.showToast(`${bDef.name} placed in slot ${targetSlot + 1}`);
                });

                gridEl.appendChild(slot);
            }
        }

        setHotbarBlock(slotIndex, blockId) {
            if (slotIndex < 0 || slotIndex >= 9) return;
            this.hotbarBlocks[slotIndex] = blockId;
            this.buildHotbar();
            if (this.player && this.player.selectedSlot !== undefined) {
                this.updateActiveSlot(this.player.selectedSlot);
            }
        }

        toggleInventory() {
            if (this.isInventoryOpen) {
                this.closeInventory();
            } else {
                this.openInventory();
            }
        }

        openInventory() {
            this.isInventoryOpen = true;
            if (this.inventoryOverlayEl) {
                this.inventoryOverlayEl.style.display = 'flex';
            }
            this.buildCraftingGrid();
            this.buildInventoryGrid();
            if (this.player && typeof this.player.unlock === 'function') {
                this.player.unlock();
            }
        }

        closeInventory() {
            this.isInventoryOpen = false;
            if (this.inventoryOverlayEl) {
                this.inventoryOverlayEl.style.display = 'none';
            }
            if (this.player && typeof this.player.lock === 'function') {
                this.player.lock();
            }
        }

        updateOxygen(oxygen, maxOxygen = 15) {
            if (!this.bubblesBarEl) {
                this.bubblesBarEl = document.getElementById('bubbles-bar');
            }
            if (!this.bubblesBarEl) return;

            const eyeY = this.player ? this.player.position.y + (this.player.currentEyeHeight || 1.62) : 0;
            const headInWater = !!(this.player && this.world && typeof this.world.isWater === 'function' && this.world.isWater(this.player.position.x, eyeY, this.player.position.z));

            if (oxygen < maxOxygen || headInWater) {
                this.bubblesBarEl.style.display = 'flex';
            } else {
                this.bubblesBarEl.style.display = 'none';
            }

            const bubbles = this.bubblesBarEl.querySelectorAll ? this.bubblesBarEl.querySelectorAll('.bubble') : [];
            const count = bubbles.length || 10;
            const step = maxOxygen / count;
            if (bubbles.forEach) {
                bubbles.forEach((b, idx) => {
                    const fullVal = (idx + 1) * step;
                    const halfVal = (idx + 0.5) * step;
                    if (oxygen >= fullVal - 0.001) {
                        b.className = 'bubble';
                    } else if (oxygen >= halfVal - 0.001) {
                        b.className = 'bubble half';
                    } else {
                        b.className = 'bubble empty';
                    }
                });
            }
        }

        updateGameMode(mode) {
            this.gameMode = mode || 'survival';

            if (!this.modeIndicatorEl) this.modeIndicatorEl = document.getElementById('mode-indicator');
            if (!this.gameModeBtn) this.gameModeBtn = document.getElementById('btn-gamemode');
            if (!this.invGameModeBtn) this.invGameModeBtn = document.getElementById('btn-inv-gamemode');

            let indicatorText = 'SURVIVAL';
            let btnText = 'Režim hry: Survival';
            let invBtnText = 'Režim: Survival';

            if (this.gameMode === 'peaceful') {
                indicatorText = 'KLIDNÝ (BEZ BOJE)';
                btnText = 'Režim hry: Klidný (Crafting / Bez boje)';
                invBtnText = 'Režim: Klidný (Crafting / Bez boje)';
            } else if (this.gameMode === 'creative') {
                indicatorText = 'KREATIVNÍ';
                btnText = 'Režim hry: Kreativní';
                invBtnText = 'Režim: Kreativní';
            } else {
                indicatorText = 'SURVIVAL';
                btnText = 'Režim hry: Survival';
                invBtnText = 'Režim: Survival';
            }

            if (this.modeIndicatorEl) {
                this.modeIndicatorEl.innerText = indicatorText;
            }
            if (this.gameModeBtn) {
                this.gameModeBtn.innerText = btnText;
            }
            if (this.invGameModeBtn) {
                this.invGameModeBtn.innerText = invBtnText;
            }

            const hintEl = document.getElementById('crafting-mode-hint');
            if (hintEl) {
                if (this.isFreeCraftingMode()) {
                    hintEl.innerText = 'V Klidném/Kreativním režimu lze kraftit zdarma bez surovin!';
                    hintEl.style.color = '#88ff88';
                } else {
                    hintEl.innerText = 'V Režimu Survival vyžaduje crafting nasbírané suroviny.';
                    hintEl.style.color = '#ffcc66';
                }
            }

            this.buildCraftingGrid();
            this.buildHotbar();
            this.buildInventoryGrid();
        }

        updateHealth(health) {
            if (!this.heartsBarEl) {
                this.heartsBarEl = document.getElementById('hearts-bar');
            }
            if (!this.heartsBarEl) return;
            const hearts = this.heartsBarEl.querySelectorAll ? this.heartsBarEl.querySelectorAll('.heart') : [];
            if (hearts && hearts.forEach) {
                hearts.forEach((heart, idx) => {
                    const heartHp = (idx + 1) * 2;
                    if (health >= heartHp) {
                        heart.className = 'heart';
                    } else if (health === heartHp - 1) {
                        heart.className = 'heart half';
                    } else {
                        heart.className = 'heart empty';
                    }
                });
            }
        }

        updateActiveSlot(index) {
            if (typeof document === 'undefined') return;
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
                const bDef = Blocks.BLOCK_DEFS ? Blocks.BLOCK_DEFS[bId] : null;
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

        triggerDamageFlash() {
            if (typeof document === 'undefined') return;
            const el = this.damageVignetteEl || document.getElementById('damage-vignette');
            if (!el) return;
            this.damageVignetteEl = el;
            if (el.classList) el.classList.add('active');
            clearTimeout(this.damageFlashTimer);
            this.damageFlashTimer = setTimeout(() => {
                if (el.classList) el.classList.remove('active');
            }, 320);
        }

        triggerSleepFade() {
            if (typeof document === 'undefined') return;
            const el = this.sleepOverlayEl || document.getElementById('sleep-overlay');
            if (!el) return;
            this.sleepOverlayEl = el;
            if (el.classList) el.classList.add('active');
            clearTimeout(this.sleepFadeTimer);
            this.sleepFadeTimer = setTimeout(() => {
                if (el.classList) el.classList.remove('active');
            }, 900);
        }

        updateWeatherUI(weatherState) {
            this.weatherState = weatherState || 'clear';
            if (typeof document === 'undefined') return;
            const weatherBtn = document.getElementById('btn-weather');
            const minimapWeather = document.getElementById('minimap-weather');
            let label = 'Jasno ☀️';
            let icon = '☀️';
            if (this.weatherState === 'rain') {
                label = 'Déšť / Sníh 🌧️';
                icon = '🌧️';
            } else if (this.weatherState === 'thunder') {
                label = 'Bouřka ⛈️';
                icon = '⛈️';
            }
            if (weatherBtn) weatherBtn.innerText = `Počasí: ${label}`;
            if (minimapWeather) minimapWeather.innerText = icon;
        }

        updateMusicUI(musicEnabled) {
            if (typeof document === 'undefined') return;
            const musicBtn = document.getElementById('btn-music');
            if (musicBtn) {
                musicBtn.innerText = `Ambientní hudba: ${musicEnabled ? 'ZAP 🎵' : 'VYP 🔇'}`;
            }
        }

        updateMinimap(dayTime = 0.25, weatherState = 'clear', mobs = null) {
            if (typeof document === 'undefined' || !this.player || !this.world) return;

            const timeEl = this.minimapTimeEl || document.getElementById('minimap-time');
            const weatherEl = this.minimapWeatherEl || document.getElementById('minimap-weather');
            const footerEl = this.minimapFooterEl || document.getElementById('minimap-footer');
            const canvas = this.minimapCanvasEl || document.getElementById('minimap-canvas');

            if (timeEl) {
                this.minimapTimeEl = timeEl;
                // Convert dayTime (0=dawn 06:00, 0.25=noon 12:00, 0.5=dusk 18:00, 0.75=midnight 00:00)
                const totalHours = (((dayTime + 0.25) % 1) * 24);
                const hh = String(Math.floor(totalHours)).padStart(2, '0');
                const mm = String(Math.floor((totalHours % 1) * 60)).padStart(2, '0');
                const isDay = Math.sin(dayTime * Math.PI * 2) >= -0.05;
                timeEl.innerText = `${isDay ? '☀️' : '🌙'} ${hh}:${mm}`;
            }

            if (weatherEl) {
                this.minimapWeatherEl = weatherEl;
                let wIcon = '☀️';
                if (weatherState === 'rain') wIcon = '🌧️';
                else if (weatherState === 'thunder') wIcon = '⛈️';
                weatherEl.innerText = wIcon;
            }

            const px = Math.floor(this.player.position.x);
            const pz = Math.floor(this.player.position.z);
            const biome = typeof this.world.getBiome === 'function' ? this.world.getBiome(px, pz) : 'plains';

            if (footerEl) {
                this.minimapFooterEl = footerEl;
                const biomeLabels = {
                    plains: 'Pláně',
                    forest: 'Les',
                    desert: 'Poušť',
                    mountains: 'Hory'
                };
                const bName = biomeLabels[biome] || String(biome);
                footerEl.innerText = `${bName} (${px}, ${pz})`;
            }

            if (!canvas || typeof canvas.getContext !== 'function') return;
            this.minimapCanvasEl = canvas;

            // Throttle pixel rendering slightly (~12 FPS) for crisp performance
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (this.lastMinimapDraw && now - this.lastMinimapDraw < 80) return;
            this.lastMinimapDraw = now;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const w = canvas.width || 96;
            const h = canvas.height || 96;
            const radius = 24; // 48x48 blocks area
            const cellSize = w / (radius * 2);

            ctx.fillStyle = '#101824';
            ctx.fillRect(0, 0, w, h);

            const B = Blocks && Blocks.BLOCKS ? Blocks.BLOCKS : {};
            for (let dz = -radius; dz < radius; dz++) {
                for (let dx = -radius; dx < radius; dx++) {
                    const wx = px + dx;
                    const wz = pz + dz;
                    let topY = typeof this.world.getHighestBlockY === 'function' ? this.world.getHighestBlockY(wx, wz) : 12;
                    let bId = typeof this.world.getBlock === 'function' ? this.world.getBlock(wx, topY, wz) : 1;

                    // Descend through non-solid flora/air to color terrain underneath unless flower/torch
                    if ((bId === 0 || bId === B.TALL_GRASS) && topY > 1) {
                        bId = this.world.getBlock(wx, topY - 1, wz);
                    }

                    let r = 88, gCol = 158, bCol = 62;
                    if (bId === B.WATER || bId === 11) { r = 38; gCol = 98; bCol = 210; }
                    else if (bId === B.SAND || bId === 9 || bId === B.SANDSTONE || bId === 24) { r = 222; gCol = 204; bCol = 132; }
                    else if (bId === B.SNOW || bId === 13 || bId === B.ICE || bId === 20) { r = 235; gCol = 245; bCol = 255; }
                    else if (bId === B.LEAVES || bId === 6 || bId === B.CACTUS || bId === 19) { r = 42; gCol = 112; bCol = 36; }
                    else if (bId === B.STONE || bId === 3 || bId === B.COBBLESTONE || bId === 4 || bId === B.GRAVEL || bId === 17) { r = 128; gCol = 128; bCol = 132; }
                    else if (bId === B.LAVA || bId === 27) { r = 255; gCol = 92; bCol = 20; }
                    else if (bId === B.FLOWER_RED || bId === 34) { r = 235; gCol = 48; bCol = 48; }
                    else if (bId === B.FLOWER_YELLOW || bId === 35 || bId === B.TORCH || bId === 31) { r = 255; gCol = 225; bCol = 55; }
                    else if (bId === B.WOOD || bId === 5 || bId === B.PLANKS || bId === 7) { r = 148; gCol = 108; bCol = 62; }
                    else if (bId === B.BRICK || bId === 8 || bId === B.TNT || bId === 15 || bId === B.BED || bId === 32) { r = 190; gCol = 64; bCol = 54; }

                    // Subtle height shading
                    const shade = Math.max(0.65, Math.min(1.25, 0.8 + (topY - 12) * 0.018));
                    const fr = Math.min(255, Math.floor(r * shade));
                    const fg = Math.min(255, Math.floor(gCol * shade));
                    const fb = Math.min(255, Math.floor(bCol * shade));

                    ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
                    ctx.fillRect((dx + radius) * cellSize, (dz + radius) * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
                }
            }

            // Draw nearby mobs
            if (Array.isArray(mobs)) {
                for (let i = 0; i < mobs.length; i++) {
                    const m = mobs[i];
                    if (!m || !m.position || m.dead) continue;
                    const mdx = m.position.x - this.player.position.x;
                    const mdz = m.position.z - this.player.position.z;
                    if (Math.abs(mdx) < radius && Math.abs(mdz) < radius) {
                        const mx = (mdx + radius) * cellSize;
                        const mz = (mdz + radius) * cellSize;
                        ctx.fillStyle = m.hostile ? '#ff3333' : '#55ff55';
                        ctx.fillRect(mx - 1.5, mz - 1.5, 3, 3);
                    }
                }
            }

            // Draw player arrow in center
            const cx = w / 2;
            const cy = h / 2;
            if (typeof ctx.save === 'function') {
                ctx.save();
                if (typeof ctx.translate === 'function') ctx.translate(cx, cy);
                if (typeof ctx.rotate === 'function') ctx.rotate(-this.player.yaw || 0);
                ctx.fillStyle = '#ffffff';
                if (typeof ctx.beginPath === 'function') {
                    ctx.beginPath();
                    ctx.moveTo(0, -4.5);
                    ctx.lineTo(3.5, 3.5);
                    ctx.lineTo(0, 1.8);
                    ctx.lineTo(-3.5, 3.5);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillRect(-2, -2, 4, 4);
                }
                if (typeof ctx.restore === 'function') ctx.restore();
            }
        }

        update(dt, dayTime = 0.25, weatherState = 'clear', mobs = null) {
            const now = performance.now();
            const frameFps = 1 / Math.max(0.001, dt);
            this.fpsHistory.push(frameFps);
            if (this.fpsHistory.length > 30) this.fpsHistory.shift();

            // Underwater Overlay & Oxygen
            if (this.player) {
                const eyeY = this.player.position.y + (this.player.currentEyeHeight || 1.62);
                const headInWater = !!(this.world && typeof this.world.isWater === 'function' && this.world.isWater(this.player.position.x, eyeY, this.player.position.z));
                if (this.underwaterEl) {
                    this.underwaterEl.style.display = headInWater ? 'block' : 'none';
                }
                const currentOxygen = (this.player.oxygen !== undefined) ? this.player.oxygen : 15;
                const maxOxygen = (this.player.maxOxygen !== undefined) ? this.player.maxOxygen : 15;
                this.updateOxygen(currentOxygen, maxOxygen);

                if (this.player.gameMode && this.player.gameMode !== this.gameMode) {
                    this.updateGameMode(this.player.gameMode);
                }
            }

            this.updateMinimap(dayTime, weatherState, mobs);

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

            const biome = typeof this.world.getBiome === 'function' ? this.world.getBiome(bx, bz) : 'Plains';

            let targetText = 'None';
            if (this.player.targetBlock && this.player.targetBlock.hit) {
                const tb = this.player.targetBlock.blockPos;
                const bId = this.world.getBlock(tb.x, tb.y, tb.z);
                const bDef = Blocks && Blocks.BLOCK_DEFS && Blocks.BLOCK_DEFS[bId];
                targetText = `${bDef ? bDef.name : 'Block'} at [${tb.x}, ${tb.y}, ${tb.z}]`;
            }

            const cameraStr = (this.player.cameraMode === 1) ? '3RD PERSON' : '1ST PERSON';
            const oxygenPct = Math.round(((this.player.oxygen ?? 15) / (this.player.maxOxygen || 15)) * 100);

            this.debugEl.innerHTML = `
                <div><strong>Minecraft Lite</strong> (v1.0.0)</div>
                <div>FPS: ${avgFps}</div>
                <div>XYZ: ${pos.x.toFixed(3)} / ${pos.y.toFixed(3)} / ${pos.z.toFixed(3)}</div>
                <div>Block: ${bx} ${by} ${bz}</div>
                <div>Chunk: ${cx}, ${cz} in (16x16x64)</div>
                <div>Facing: ${facing} (Yaw: ${yawDeg.toFixed(1)}°, Pitch: ${(-this.player.pitch * 180 / Math.PI).toFixed(1)}°)</div>
                <div>Biome: ${String(biome).toUpperCase()}</div>
                <div>Weather: ${String(weatherState).toUpperCase()}</div>
                <div>Mode: ${this.gameMode.toUpperCase()}</div>
                <div>Camera: ${cameraStr}</div>
                <div>Oxygen: ${oxygenPct}%</div>
                <div>Target: ${targetText}</div>
                <div>Chunks Loaded: ${this.world.chunks ? this.world.chunks.size : 0}</div>
            `;
        }
    }

    return new UIManager();
}));
