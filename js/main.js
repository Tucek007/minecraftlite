/**
 * main.js - Main Game Loop, Scene Setup, Day/Night Cycle, and Block Interactions for Minecraft Lite.
 */
(function () {
    'use strict';

    let scene, camera, renderer;
    let world, player, audio, atlasTexture, atlasCanvas;
    let sunLight, ambientLight, sunMesh, moonMesh, starField;
    let blockOutline;
    let particles = [];
    let activeTNTs = [];
    let debrisMaterial = null;
    let clock;
    let isPaused = true;

    // Continuous mouse breaking / placing
    let isMouseDown = false;
    let activeMouseButton = -1; // 0: break, 2: place/interact
    let mouseActionCooldown = 0;
    const BREAK_COOLDOWN = 0.22;
    const PLACE_COOLDOWN = 0.25;

    // Day/night cycle variables
    let dayTime = 0.25; // 0..1 (0.25 = morning, 0.5 = noon, 0.75 = dusk, 0 = midnight)
    const DAY_DURATION_SECONDS = 300; // 5 minutes per full cycle

    const LOAD_RADIUS = 3; // Chunks around player (7x7 chunks = 112x112 blocks)
    const UNLOAD_RADIUS = 5; // Unload radius hysteresis

    function safeGetStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function safeSetStorage(key, val) {
        try {
            localStorage.setItem(key, val);
        } catch (e) {}
    }

    function safeRemoveStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {}
    }

    let initialized = false;
    function init() {
        if (initialized) return;
        initialized = true;
        // 1. Setup Scene & Camera
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x78a7ff);
        scene.fog = new THREE.FogExp2(0x78a7ff, 0.015);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        // 2. Setup WebGL Renderer
        renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = false; // voxel baking handles lighting fast
        document.getElementById('game-container').appendChild(renderer.domElement);

        clock = new THREE.Clock();

        // 3. Audio & Texture Atlas
        audio = new window.SoundFX();
        atlasCanvas = window.Blocks.createTextureAtlasCanvas();
        atlasTexture = new THREE.CanvasTexture(atlasCanvas);
        atlasTexture.magFilter = THREE.NearestFilter;
        atlasTexture.minFilter = THREE.NearestFilter;

        debrisMaterial = new THREE.MeshBasicMaterial({
            map: atlasTexture,
            color: 0xffffff
        });

        // 4. World setup (preserve seed 0 strictly)
        const storedSeed = safeGetStorage('minecraftlite_seed');
        let initialSeed;
        if (storedSeed !== null && !isNaN(parseInt(storedSeed, 10))) {
            initialSeed = parseInt(storedSeed, 10);
        } else {
            initialSeed = Math.floor(Math.random() * 100000);
        }
        world = new window.World.VoxelWorld(initialSeed);

        // Try restoring saved world modifications
        const savedWorld = safeGetStorage('minecraftlite_world');
        if (savedWorld) {
            world.loadFromJSON(savedWorld);
        }

        // 5. Player controller
        player = new window.PlayerController(camera, renderer.domElement, world, audio);

        // 6. UI Manager (initialize before loadPlayerState so hotbar canvas is ready)
        window.UI.init(player, world, atlasCanvas);

        // Try restoring saved player state, otherwise spawn safely
        const restoredPlayer = loadPlayerState();
        if (!restoredPlayer) {
            const spawn = player.getSafeSpawnPosition(8.5, 8.5);
            player.position.x = spawn.x;
            player.position.y = spawn.y;
            player.position.z = spawn.z;
            player.fallDistance = 0;
            player.onGround = true;
        }

        // 7. Lighting & Atmosphere
        setupLighting();

        // 8. Block selection wireframe outline
        setupSelectionOutline();

        // 9. Input & Pointer Lock Listeners
        setupGameInput();

        // 10. Initial Chunk Generation
        loadSurroundingChunks(true);

        // 11. Window Resize
        window.addEventListener('resize', onWindowResize);

        // 12. Start Loop
        requestAnimationFrame(animate);
    }

    function saveGameState(silent = false) {
        // 1. Save world voxels & seed
        const json = world.saveToJSON();
        safeSetStorage('minecraftlite_world', json);
        safeSetStorage('minecraftlite_seed', String(world.seed));

        // 2. Save player state, hotbar, and daytime
        const playerData = {
            position: { x: player.position.x, y: player.position.y, z: player.position.z },
            yaw: player.yaw,
            pitch: player.pitch,
            selectedSlot: player.selectedSlot,
            hotbarBlocks: window.UI ? window.UI.hotbarBlocks : undefined,
            health: player.health !== undefined ? player.health : 20,
            dayTime: dayTime,
            isFlying: player.isFlying
        };
        safeSetStorage('minecraftlite_player', JSON.stringify(playerData));
        if (!silent && window.UI) window.UI.showToast('World & Player Saved!');
    }

    function loadPlayerState() {
        const saved = safeGetStorage('minecraftlite_player');
        if (!saved) return false;
        try {
            const data = JSON.parse(saved);
            if (data.position && typeof data.position.x === 'number' && typeof data.position.y === 'number' && typeof data.position.z === 'number') {
                if (data.position.y > 0 && data.position.y < 128 && !isNaN(data.position.x) && !isNaN(data.position.y) && !isNaN(data.position.z)) {
                    player.position.x = data.position.x;
                    player.position.y = data.position.y;
                    player.position.z = data.position.z;
                }
            }
            if (typeof data.yaw === 'number' && !isNaN(data.yaw)) player.yaw = data.yaw;
            if (typeof data.pitch === 'number' && !isNaN(data.pitch)) player.pitch = data.pitch;
            if (typeof data.selectedSlot === 'number' && data.selectedSlot >= 0 && data.selectedSlot < 9) {
                player.selectedSlot = data.selectedSlot;
                if (window.UI) window.UI.updateActiveSlot(player.selectedSlot);
            }
            if (Array.isArray(data.hotbarBlocks) && data.hotbarBlocks.length === 9 && window.UI) {
                window.UI.hotbarBlocks = data.hotbarBlocks.slice();
                window.UI.buildHotbar();
            }
            if (typeof data.health === 'number' && !isNaN(data.health)) {
                player.health = Math.max(1, Math.min(20, data.health));
                if (window.UI) window.UI.updateHealth(player.health);
            }
            if (typeof data.dayTime === 'number' && !isNaN(data.dayTime)) {
                dayTime = data.dayTime;
            }
            if (typeof data.isFlying === 'boolean') {
                player.isFlying = data.isFlying;
            }
            return true;
        } catch (e) {
            console.error('Failed to parse saved player state', e);
            return false;
        }
    }

    function setupLighting() {
        ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xffffff, 0.85);
        sunLight.position.set(50, 100, 50);
        scene.add(sunLight);

        // Sun Billboard
        const sunGeo = new THREE.PlaneGeometry(16, 16);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffee, side: THREE.DoubleSide });
        sunMesh = new THREE.Mesh(sunGeo, sunMat);
        scene.add(sunMesh);

        // Moon Billboard
        const moonGeo = new THREE.PlaneGeometry(12, 12);
        const moonMat = new THREE.MeshBasicMaterial({ color: 0xddddff, side: THREE.DoubleSide });
        moonMesh = new THREE.Mesh(moonGeo, moonMat);
        scene.add(moonMesh);

        // Starfield
        const starGeo = new THREE.BufferGeometry();
        const starPositions = [];
        for (let i = 0; i < 400; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const r = 250;
            starPositions.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
        const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.0, transparent: true, opacity: 0 });
        starField = new THREE.Points(starGeo, starMat);
        scene.add(starField);
    }

    function setupSelectionOutline() {
        const boxGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
        const edges = new THREE.EdgesGeometry(boxGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2 });
        blockOutline = new THREE.LineSegments(edges, lineMat);
        blockOutline.visible = false;
        scene.add(blockOutline);
    }

    function setupGameInput() {
        const blocker = document.getElementById('pause-menu');
        const resumeBtn = document.getElementById('btn-resume');
        const saveBtn = document.getElementById('btn-save');
        const loadBtn = document.getElementById('btn-load');
        const resetBtn = document.getElementById('btn-reset');

        function lockPointer() {
            audio.init();
            player.lock();
        }

        function resumeGame() {
            isPaused = false;
            if (blocker) blocker.style.display = 'none';
            if (window.UI && window.UI.isInventoryOpen) window.UI.closeInventory();
            lockPointer();
        }

        function pauseGame() {
            isPaused = true;
            player.unlock();
            if (blocker) blocker.style.display = 'flex';
        }

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === renderer.domElement) {
                isPaused = false;
                if (blocker) blocker.style.display = 'none';
                if (window.UI && window.UI.isInventoryOpen) window.UI.closeInventory();
            } else {
                isMouseDown = false;
                activeMouseButton = -1;
                if (window.UI && window.UI.isInventoryOpen) {
                    isPaused = true;
                    if (blocker) blocker.style.display = 'none';
                } else {
                    isPaused = true;
                    if (blocker) blocker.style.display = 'flex';
                }
            }
        });

        document.addEventListener('pointerlockerror', () => {
            console.warn('Pointer lock request was denied or interrupted.');
        });

        window.addEventListener('beforeunload', () => {
            saveGameState(true);
        });

        if (resumeBtn) {
            resumeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resumeGame();
            });
        }

        if (blocker) {
            blocker.addEventListener('click', (e) => {
                if (e.target === blocker) {
                    resumeGame();
                }
            });
        }

        if (renderer && renderer.domElement) {
            renderer.domElement.addEventListener('click', () => {
                if (isPaused) {
                    resumeGame();
                } else if (!player.isLocked && (!window.UI || !window.UI.isInventoryOpen)) {
                    lockPointer();
                }
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (window.UI && window.UI.isInventoryOpen) {
                    window.UI.closeInventory();
                } else if (!isPaused) {
                    pauseGame();
                }
            }
        });

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                saveGameState();
            });
        }

        function clearActiveEntities() {
            for (const tnt of activeTNTs) {
                scene.remove(tnt.mesh);
                if (tnt.mesh.geometry) tnt.mesh.geometry.dispose();
                if (tnt.mesh.material) tnt.mesh.material.dispose();
            }
            activeTNTs = [];

            for (const p of particles) {
                scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material && p.mesh.material !== debrisMaterial) {
                    p.mesh.material.dispose();
                }
            }
            particles = [];
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                const json = safeGetStorage('minecraftlite_world');
                if (json) {
                    clearActiveEntities();

                    // Remove current chunk meshes and free GPU geometry
                    for (const chunk of world.chunks.values()) {
                        if (chunk.mesh) {
                            scene.remove(chunk.mesh);
                            if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
                            chunk.mesh = null;
                        }
                        if (chunk.waterMesh) {
                            scene.remove(chunk.waterMesh);
                            if (chunk.waterMesh.geometry) chunk.waterMesh.geometry.dispose();
                            chunk.waterMesh = null;
                        }
                    }
                    world.loadFromJSON(json);
                    loadPlayerState();
                    player.world = world;
                    if (window.UI) {
                        window.UI.world = world;
                    }
                    loadSurroundingChunks(true);
                    window.UI.showToast('World & Player Loaded Successfully!');
                    resumeGame();
                } else {
                    window.UI.showToast('No saved world found.');
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Generate a brand new world?')) {
                    safeRemoveStorage('minecraftlite_world');
                    safeRemoveStorage('minecraftlite_player');
                    const newSeed = Math.floor(Math.random() * 100000);
                    safeSetStorage('minecraftlite_seed', String(newSeed));

                    clearActiveEntities();

                    for (const chunk of world.chunks.values()) {
                        if (chunk.mesh) {
                            scene.remove(chunk.mesh);
                            if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
                            chunk.mesh = null;
                        }
                        if (chunk.waterMesh) {
                            scene.remove(chunk.waterMesh);
                            if (chunk.waterMesh.geometry) chunk.waterMesh.geometry.dispose();
                            chunk.waterMesh = null;
                        }
                    }

                    if (typeof world.disposeMaterials === 'function') {
                        world.disposeMaterials();
                    }

                    world = new window.World.VoxelWorld(newSeed);
                    player.world = world;
                    if (window.UI) {
                        window.UI.world = world;
                        window.UI.updateHealth(20);
                    }
                    player.health = 20;
                    const spawn = player.getSafeSpawnPosition(8.5, 8.5);
                    player.position.x = spawn.x;
                    player.position.y = spawn.y;
                    player.position.z = spawn.z;
                    player.velocity.x = 0;
                    player.velocity.y = 0;
                    player.velocity.z = 0;
                    player.fallDistance = 0;
                    player.onGround = true;
                    dayTime = 0.25;
                    loadSurroundingChunks(true);
                    window.UI.showToast('Generated New World!');
                    resumeGame();
                }
            });
        }

        // Mouse click and hold for continuous mining and placing
        window.addEventListener('mousedown', (e) => {
            if (isPaused || !player.isLocked) return;

            isMouseDown = true;
            activeMouseButton = e.button;

            if (e.button === 0) {
                // Left Click: Break block
                onBreakBlock();
                mouseActionCooldown = 0.35;
            } else if (e.button === 2) {
                // Right Click: Place or interact (e.g. ignite TNT)
                onPlaceOrInteract();
                mouseActionCooldown = 0.35;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === activeMouseButton) {
                isMouseDown = false;
                activeMouseButton = -1;
            }
        });

        window.addEventListener('blur', () => {
            isMouseDown = false;
            activeMouseButton = -1;
        });

        // Prevent context menu on right-click in game
        window.addEventListener('contextmenu', (e) => {
            if (player.isLocked) e.preventDefault();
        });
    }

    function onBreakBlock() {
        if (!player.targetBlock || !player.targetBlock.hit) return;

        const pos = player.targetBlock.blockPos;
        const blockId = world.getBlock(pos.x, pos.y, pos.z);
        const bDef = window.Blocks.BLOCK_DEFS[blockId];

        if (bDef && bDef.unbreakable) {
            window.UI.showToast('Bedrock is indestructible!');
            return;
        }

        if (blockId !== 0) {
            audio.playBreak(bDef ? bDef.sound : 'stone');
            spawnDebris(pos.x, pos.y, pos.z, blockId);

            world.setBlock(pos.x, pos.y, pos.z, window.Blocks.BLOCKS.AIR);
            updateAffectedChunks(pos.x, pos.z);
            player.updateRaycast();
            updateBlockOutline();
        }
    }

    function onPlaceOrInteract() {
        if (!player.targetBlock || !player.targetBlock.hit) return;

        const hitPos = player.targetBlock.blockPos;
        const hitBlockId = world.getBlock(hitPos.x, hitPos.y, hitPos.z);

        // Right-clicking TNT ignites it!
        if (hitBlockId === window.Blocks.BLOCKS.TNT) {
            igniteTNT(hitPos.x, hitPos.y, hitPos.z);
            isMouseDown = false;
            activeMouseButton = -1;
            return;
        }

        onPlaceBlock();
    }

    function onPlaceBlock() {
        if (!player.targetBlock || !player.targetBlock.hit) return;

        const placePos = player.targetBlock.placePos;
        if (!player.canPlaceBlockAt(placePos.x, placePos.y, placePos.z)) {
            return; // Can't place inside player
        }

        const selectedBlockId = window.UI.getSelectedBlockId();
        const bDef = window.Blocks.BLOCK_DEFS[selectedBlockId];

        world.setBlock(placePos.x, placePos.y, placePos.z, selectedBlockId);
        audio.playPlace(bDef ? bDef.sound : 'stone');
        updateAffectedChunks(placePos.x, placePos.z);
        player.updateRaycast();
        updateBlockOutline();
    }

    function igniteTNT(bx, by, bz, fuse = 3.0) {
        bx = Math.floor(bx);
        by = Math.floor(by);
        bz = Math.floor(bz);

        const currentBlock = world.getBlock(bx, by, bz);
        if (currentBlock !== window.Blocks.BLOCKS.TNT) return;

        world.setBlock(bx, by, bz, window.Blocks.BLOCKS.AIR);
        updateAffectedChunks(bx, bz);
        player.updateRaycast();
        updateBlockOutline();

        const tntGeo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
        const topUV = window.Blocks.getTileUV(window.Blocks.TILES.TNT_TOP);
        const sideUV = window.Blocks.getTileUV(window.Blocks.TILES.TNT_SIDE);
        const botUV = window.Blocks.getTileUV(window.Blocks.TILES.TNT_BOTTOM);

        const uvAttr = tntGeo.attributes.uv;
        if (uvAttr) {
            const uvs = uvAttr.array;
            const faceUVs = [sideUV, sideUV, topUV, botUV, sideUV, sideUV];
            for (let f = 0; f < 6; f++) {
                const { u0, v0, u1, v1 } = faceUVs[f];
                const offset = f * 8;
                uvs[offset]     = u0; uvs[offset + 1] = v1;
                uvs[offset + 2] = u1; uvs[offset + 3] = v1;
                uvs[offset + 4] = u0; uvs[offset + 5] = v0;
                uvs[offset + 6] = u1; uvs[offset + 7] = v0;
            }
            uvAttr.needsUpdate = true;
        }

        const tntMat = new THREE.MeshLambertMaterial({
            map: atlasTexture,
            color: 0xffffff
        });

        const tntMesh = new THREE.Mesh(tntGeo, tntMat);
        tntMesh.position.set(bx + 0.5, by + 0.5, bz + 0.5);
        scene.add(tntMesh);

        if (audio && typeof audio.playFuse === 'function') {
            audio.playFuse();
        }

        activeTNTs.push({
            mesh: tntMesh,
            fuse: fuse,
            velY: 2.5,
            fuseAudioTimer: 0
        });

        if (window.UI) {
            window.UI.showToast('TNT Ignited!');
        }
    }

    function updateTNTs(dt) {
        for (let i = activeTNTs.length - 1; i >= 0; i--) {
            const tnt = activeTNTs[i];
            tnt.fuse -= dt;
            tnt.fuseAudioTimer += dt;

            if (tnt.fuseAudioTimer > 0.45 && tnt.fuse > 0.4) {
                tnt.fuseAudioTimer = 0;
                if (audio && typeof audio.playFuse === 'function') {
                    audio.playFuse();
                }
            }

            // Flashing white effect and scale pulse
            const flash = Math.floor(tnt.fuse * 8) % 2 === 0;
            if (tnt.mesh.material) {
                tnt.mesh.material.color.setHex(flash ? 0xffffff : 0xcccccc);
                if (tnt.mesh.material.emissive) {
                    tnt.mesh.material.emissive.setHex(flash ? 0x888888 : 0x000000);
                }
            }
            const s = 1.0 + Math.sin(tnt.fuse * 12) * 0.05;
            tnt.mesh.scale.set(s, s, s);

            // Slight physics gravity if in air
            tnt.velY -= 12.0 * dt;
            tnt.mesh.position.y += tnt.velY * dt;
            const floorY = Math.floor(tnt.mesh.position.y - 0.49);
            const fx = Math.floor(tnt.mesh.position.x);
            const fz = Math.floor(tnt.mesh.position.z);
            if (world.isSolid(fx, floorY, fz)) {
                tnt.mesh.position.y = floorY + 1.0 + 0.49;
                tnt.velY = 0;
            }

            if (tnt.fuse <= 0) {
                explodeTNT(tnt);
                scene.remove(tnt.mesh);
                if (tnt.mesh.geometry) tnt.mesh.geometry.dispose();
                if (tnt.mesh.material) tnt.mesh.material.dispose();
                activeTNTs.splice(i, 1);
            }
        }
    }

    function explodeTNT(tnt) {
        const tPos = tnt.mesh.position;
        if (audio && typeof audio.playExplode === 'function') {
            audio.playExplode();
        }

        spawnExplosionParticles(tPos.x, tPos.y, tPos.z);

        const radius = 3.5;
        const tx = Math.floor(tPos.x);
        const ty = Math.floor(tPos.y);
        const tz = Math.floor(tPos.z);

        const minX = tx - Math.ceil(radius);
        const maxX = tx + Math.ceil(radius);
        const minY = Math.max(1, ty - Math.ceil(radius));
        const maxY = Math.min(window.World.CHUNK_HEIGHT - 1, ty + Math.ceil(radius));
        const minZ = tz - Math.ceil(radius);
        const maxZ = tz + Math.ceil(radius);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const dx = x + 0.5 - tPos.x;
                    const dy = y + 0.5 - tPos.y;
                    const dz = z + 0.5 - tPos.z;
                    if (dx * dx + dy * dy + dz * dz <= radius * radius) {
                        const blockId = world.getBlock(x, y, z);
                        if (blockId !== 0 && blockId !== window.Blocks.BLOCKS.BEDROCK && blockId !== window.Blocks.BLOCKS.OBSIDIAN) {
                            if (blockId === window.Blocks.BLOCKS.TNT) {
                                igniteTNT(x, y, z, 0.4 + Math.random() * 0.4);
                            } else {
                                world.setBlock(x, y, z, window.Blocks.BLOCKS.AIR);
                                if (Math.random() < 0.25) {
                                    spawnDebris(x, y, z, blockId);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Update affected chunk meshes
        for (let ox = -Math.ceil(radius / 16) - 1; ox <= Math.ceil(radius / 16) + 1; ox++) {
            for (let oz = -Math.ceil(radius / 16) - 1; oz <= Math.ceil(radius / 16) + 1; oz++) {
                const cx = Math.floor(tx / window.World.CHUNK_SIZE_X) + ox;
                const cz = Math.floor(tz / window.World.CHUNK_SIZE_Z) + oz;
                const chunk = world.getChunk(cx, cz);
                if (chunk) {
                    rebuildChunkMesh(chunk);
                }
            }
        }

        // Knockback and damage on player
        const pVec = {
            x: player.position.x - tPos.x,
            y: (player.position.y + 0.9) - tPos.y,
            z: player.position.z - tPos.z
        };
        const dist = Math.sqrt(pVec.x * pVec.x + pVec.y * pVec.y + pVec.z * pVec.z);
        if (dist < 8.0) {
            const normX = pVec.x / Math.max(0.01, dist);
            const normZ = pVec.z / Math.max(0.01, dist);
            const force = (1.0 - dist / 8.0) * 24.0;
            player.velocity.x += normX * force;
            player.velocity.y += Math.max(6.0, force * 0.7);
            player.velocity.z += normZ * force;

            if (!player.isFlying && typeof player.takeDamage === 'function') {
                const dmg = Math.round((1.0 - dist / 8.0) * 14);
                if (dmg > 0) player.takeDamage(dmg);
            }
        }

        player.updateRaycast();
        updateBlockOutline();
    }

    function spawnExplosionParticles(x, y, z) {
        for (let i = 0; i < 28; i++) {
            const size = 0.2 + Math.random() * 0.25;
            const geo = new THREE.BoxGeometry(size, size, size);
            const isFire = Math.random() > 0.4;
            const color = isFire ? (Math.random() > 0.5 ? 0xff4400 : 0xffaa00) : 0x555555;
            const mat = new THREE.MeshBasicMaterial({ color });
            const pMesh = new THREE.Mesh(geo, mat);
            pMesh.position.set(x, y, z);
            scene.add(pMesh);

            const angle = Math.random() * Math.PI * 2;
            const speed = 4.0 + Math.random() * 8.0;
            particles.push({
                mesh: pMesh,
                vel: {
                    x: Math.cos(angle) * speed,
                    y: 3.0 + Math.random() * 7.0,
                    z: Math.sin(angle) * speed
                },
                life: 0.8 + Math.random() * 0.4
            });
        }
    }

    function spawnDebris(x, y, z, blockId) {
        const count = 8;
        const bDef = window.Blocks.BLOCK_DEFS[blockId];
        const tileIdx = bDef ? window.Blocks.getBlockFaceTexture(blockId, 0) : 1;
        const { u0, v0, u1, v1 } = window.Blocks.getTileUV(tileIdx);

        for (let i = 0; i < count; i++) {
            const size = 0.12 + Math.random() * 0.08;
            const geo = new THREE.BoxGeometry(size, size, size);
            const uvAttr = geo.attributes.uv;
            if (uvAttr) {
                const uvs = uvAttr.array;
                for (let v = 0; v < uvs.length; v += 8) {
                    uvs[v]     = u0; uvs[v + 1] = v1;
                    uvs[v + 2] = u1; uvs[v + 3] = v1;
                    uvs[v + 4] = u0; uvs[v + 5] = v0;
                    uvs[v + 6] = u1; uvs[v + 7] = v0;
                }
                uvAttr.needsUpdate = true;
            }

            const mat = debrisMaterial || new THREE.MeshBasicMaterial({
                map: atlasTexture,
                color: 0xffffff
            });
            const pMesh = new THREE.Mesh(geo, mat);
            pMesh.position.set(
                x + 0.5 + (Math.random() - 0.5) * 0.5,
                y + 0.5 + (Math.random() - 0.5) * 0.5,
                z + 0.5 + (Math.random() - 0.5) * 0.5
            );

            scene.add(pMesh);
            particles.push({
                mesh: pMesh,
                vel: {
                    x: (Math.random() - 0.5) * 4,
                    y: 2.5 + Math.random() * 3,
                    z: (Math.random() - 0.5) * 4
                },
                life: 1.0
            });
        }
    }

    function updateAffectedChunks(worldX, worldZ) {
        const cx = Math.floor(worldX / window.World.CHUNK_SIZE_X);
        const cz = Math.floor(worldZ / window.World.CHUNK_SIZE_Z);

        for (let ox = -1; ox <= 1; ox++) {
            for (let oz = -1; oz <= 1; oz++) {
                const chunk = world.getChunk(cx + ox, cz + oz);
                if (chunk && chunk.dirty) {
                    rebuildChunkMesh(chunk);
                }
            }
        }
    }

    function rebuildChunkMesh(chunk) {
        world.buildChunkMesh(chunk, THREE, atlasTexture);
        if (chunk.mesh && !chunk.mesh.parent) {
            scene.add(chunk.mesh);
        }
        if (chunk.waterMesh && !chunk.waterMesh.parent) {
            scene.add(chunk.waterMesh);
        }
    }

    function loadSurroundingChunks(forceSync = false) {
        const pCx = Math.floor(player.position.x / window.World.CHUNK_SIZE_X);
        const pCz = Math.floor(player.position.z / window.World.CHUNK_SIZE_Z);

        // 1. First ensure all chunks in radius exist in memory
        const chunksToMesh = [];
        for (let rx = -LOAD_RADIUS; rx <= LOAD_RADIUS; rx++) {
            for (let rz = -LOAD_RADIUS; rz <= LOAD_RADIUS; rz++) {
                const cx = pCx + rx;
                const cz = pCz + rz;
                const chunk = world.getOrCreateChunk(cx, cz);
                if (chunk.dirty) {
                    chunksToMesh.push(chunk);
                }
            }
        }

        // 2. Mesh any dirty chunks (all neighbors are now in memory, eliminating seam faces)
        for (const chunk of chunksToMesh) {
            rebuildChunkMesh(chunk);
        }

        // 3. Unload distant chunks beyond UNLOAD_RADIUS (hysteresis prevents thrashing)
        for (const [key, chunk] of world.chunks.entries()) {
            const dist = Math.max(Math.abs(chunk.chunkX - pCx), Math.abs(chunk.chunkZ - pCz));
            if (dist > UNLOAD_RADIUS) {
                if (chunk.mesh) {
                    scene.remove(chunk.mesh);
                    if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
                    chunk.mesh = null;
                }
                if (chunk.waterMesh) {
                    scene.remove(chunk.waterMesh);
                    if (chunk.waterMesh.geometry) chunk.waterMesh.geometry.dispose();
                    chunk.waterMesh = null;
                }

                if (!chunk.hasModifications) {
                    world.chunks.delete(key);
                } else {
                    chunk.dirty = true;
                }
            }
        }
    }

    function updateDayNightCycle(dt) {
        dayTime += dt / DAY_DURATION_SECONDS;
        if (dayTime > 1.0) dayTime -= 1.0;

        const angle = dayTime * Math.PI * 2 - (Math.PI / 2); // 0 at dawn, PI/2 at noon
        const sunDist = 180;

        const sunX = Math.cos(angle) * sunDist + player.position.x;
        const sunY = Math.sin(angle) * sunDist;
        const sunZ = player.position.z + 40;

        sunLight.position.set(sunX, sunY, sunZ);

        // Sun Mesh billboard
        sunMesh.position.set(sunX, sunY, sunZ);
        sunMesh.lookAt(player.position.x, player.position.y, player.position.z);

        // Moon opposite to Sun
        const moonX = -Math.cos(angle) * sunDist + player.position.x;
        const moonY = -Math.sin(angle) * sunDist;
        const moonZ = player.position.z - 40;
        moonMesh.position.set(moonX, moonY, moonZ);
        moonMesh.lookAt(player.position.x, player.position.y, player.position.z);

        // Starfield follows player
        starField.position.copy(camera.position);

        // Day vs Night atmospheric colors
        const sunHeight = Math.sin(angle);
        if (sunHeight > 0.1) {
            // Daytime
            const t = Math.min(1.0, (sunHeight - 0.1) / 0.4);
            const skyColor = new THREE.Color(0x78a7ff).lerp(new THREE.Color(0xa5c4ff), t);
            scene.background.copy(skyColor);
            scene.fog.color.copy(skyColor);

            ambientLight.color.setHex(0xffffff);
            ambientLight.intensity = 0.5 + 0.3 * t;
            sunLight.intensity = 0.8 * t;
            starField.material.opacity = 0;
        } else if (sunHeight > -0.1) {
            // Sunset / Sunrise transition
            const t = (sunHeight + 0.1) / 0.2;
            const sunsetColor = new THREE.Color(0xee6e33).lerp(new THREE.Color(0x78a7ff), t);
            scene.background.copy(sunsetColor);
            scene.fog.color.copy(sunsetColor);

            ambientLight.color.setHex(0xffaa77);
            ambientLight.intensity = 0.35;
            sunLight.intensity = 0.3 * t;
            starField.material.opacity = (1 - t) * 0.7;
        } else {
            // Nighttime
            const nightColor = new THREE.Color(0x060914);
            scene.background.copy(nightColor);
            scene.fog.color.copy(nightColor);

            ambientLight.color.setHex(0x3a4b7c);
            ambientLight.intensity = 0.18;
            sunLight.intensity = 0.05;
            starField.material.opacity = 0.95;
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt * 2.5;

            p.vel.y -= 15.0 * dt; // gravity
            p.mesh.position.x += p.vel.x * dt;
            p.mesh.position.y += p.vel.y * dt;
            p.mesh.position.z += p.vel.z * dt;

            p.mesh.scale.setScalar(Math.max(0.01, p.life));

            if (p.life <= 0) {
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                if (p.mesh.material && p.mesh.material !== debrisMaterial) {
                    p.mesh.material.dispose();
                }
                particles.splice(i, 1);
            }
        }
    }

    function updateBlockOutline() {
        if (player.targetBlock && player.targetBlock.hit && !isPaused) {
            const pos = player.targetBlock.blockPos;
            blockOutline.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
            blockOutline.visible = true;
        } else {
            blockOutline.visible = false;
        }
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    let chunkCheckTimer = 0;

    function animate() {
        requestAnimationFrame(animate);

        const dt = Math.min(0.1, clock.getDelta());

        if (!isPaused) {
            player.update(dt);

            // Handle continuous mouse breaking / placing
            if (player.isLocked && isMouseDown) {
                mouseActionCooldown -= dt;
                if (mouseActionCooldown <= 0) {
                    if (activeMouseButton === 0) {
                        onBreakBlock();
                        mouseActionCooldown = BREAK_COOLDOWN;
                    } else if (activeMouseButton === 2) {
                        onPlaceBlock();
                        mouseActionCooldown = PLACE_COOLDOWN;
                    }
                }
            }
        }

        updateTNTs(dt);
        updateDayNightCycle(dt);
        updateParticles(dt);
        updateBlockOutline();

        // Check chunk streaming every 0.5s
        chunkCheckTimer += dt;
        if (chunkCheckTimer > 0.5) {
            chunkCheckTimer = 0;
            loadSurroundingChunks();
        }

        window.UI.update(dt);
        renderer.render(scene, camera);
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
