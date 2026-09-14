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
    let clock;
    let isPaused = true;

    // Day/night cycle variables
    let dayTime = 0.25; // 0..1 (0.25 = morning, 0.5 = noon, 0.75 = dusk, 0 = midnight)
    const DAY_DURATION_SECONDS = 300; // 5 minutes per full cycle

    const RENDER_RADIUS = 3; // Chunks around player (7x7 chunks = 112x112 blocks)

    function init() {
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

        // 4. World setup
        const savedSeed = parseInt(localStorage.getItem('minecraftlite_seed'), 10) || Math.floor(Math.random() * 100000);
        world = new window.World.VoxelWorld(savedSeed);

        // Try restoring saved world modifications
        const savedWorld = localStorage.getItem('minecraftlite_world');
        if (savedWorld) {
            world.loadFromJSON(savedWorld);
        }

        // 5. Player controller
        player = new window.PlayerController(camera, renderer.domElement, world, audio);

        // Find safe spawn altitude
        const spawnX = 8.5;
        const spawnZ = 8.5;
        let groundY = 25;
        // Pre-load spawn chunk to find surface
        world.getOrCreateChunk(0, 0);
        for (let y = window.World.CHUNK_HEIGHT - 1; y >= 0; y--) {
            if (world.isSolid(Math.floor(spawnX), y, Math.floor(spawnZ))) {
                groundY = y + 1;
                break;
            }
        }
        player.position.x = spawnX;
        player.position.y = groundY + 1.0;
        player.position.z = spawnZ;

        // 6. UI Manager
        window.UI.init(player, world, atlasCanvas);

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

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === renderer.domElement) {
                isPaused = false;
                if (blocker) blocker.style.display = 'none';
            } else {
                isPaused = true;
                if (blocker) blocker.style.display = 'flex';
            }
        });

        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => lockPointer());
        }

        if (renderer && renderer.domElement) {
            renderer.domElement.addEventListener('click', () => {
                if (!player.isLocked) lockPointer();
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const json = world.saveToJSON();
                localStorage.setItem('minecraftlite_world', json);
                localStorage.setItem('minecraftlite_seed', world.seed);
                window.UI.showToast('World Saved to LocalStorage!');
            });
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                const json = localStorage.getItem('minecraftlite_world');
                if (json) {
                    // Remove current chunk meshes and free GPU memory
                    for (const chunk of world.chunks.values()) {
                        if (chunk.mesh) {
                            scene.remove(chunk.mesh);
                            if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
                            if (chunk.mesh.material) chunk.mesh.material.dispose();
                        }
                        if (chunk.waterMesh) {
                            scene.remove(chunk.waterMesh);
                            if (chunk.waterMesh.geometry) chunk.waterMesh.geometry.dispose();
                            if (chunk.waterMesh.material) chunk.waterMesh.material.dispose();
                        }
                    }
                    world.loadFromJSON(json);
                    loadSurroundingChunks(true);
                    window.UI.showToast('World Loaded Successfully!');
                } else {
                    window.UI.showToast('No saved world found.');
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Generate a brand new world?')) {
                    localStorage.removeItem('minecraftlite_world');
                    const newSeed = Math.floor(Math.random() * 100000);
                    localStorage.setItem('minecraftlite_seed', newSeed);

                    for (const chunk of world.chunks.values()) {
                        if (chunk.mesh) {
                            scene.remove(chunk.mesh);
                            if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
                            if (chunk.mesh.material) chunk.mesh.material.dispose();
                        }
                        if (chunk.waterMesh) {
                            scene.remove(chunk.waterMesh);
                            if (chunk.waterMesh.geometry) chunk.waterMesh.geometry.dispose();
                            if (chunk.waterMesh.material) chunk.waterMesh.material.dispose();
                        }
                    }
                    world = new window.World.VoxelWorld(newSeed);
                    player.world = world;
                    player.position.y = 35;
                    loadSurroundingChunks(true);
                    window.UI.showToast('Generated New World!');
                    lockPointer();
                }
            });
        }

        // Mouse click for mining and placing blocks
        window.addEventListener('mousedown', (e) => {
            if (isPaused || !player.isLocked) return;

            if (e.button === 0) {
                // Left Click: Break block
                onBreakBlock();
            } else if (e.button === 2) {
                // Right Click: Place block
                onPlaceBlock();
            }
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

    function spawnDebris(x, y, z, blockId) {
        const count = 8;
        const bDef = window.Blocks.BLOCK_DEFS[blockId];
        const tileIdx = bDef ? window.Blocks.getBlockFaceTexture(blockId, 2) : 1;
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

            const mat = new THREE.MeshBasicMaterial({
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

        for (let rx = -RENDER_RADIUS; rx <= RENDER_RADIUS; rx++) {
            for (let rz = -RENDER_RADIUS; rz <= RENDER_RADIUS; rz++) {
                const cx = pCx + rx;
                const cz = pCz + rz;
                const chunk = world.getOrCreateChunk(cx, cz);
                if (chunk.dirty) {
                    rebuildChunkMesh(chunk);
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
                p.mesh.material.dispose();
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
        }

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

    window.addEventListener('DOMContentLoaded', init);
})();
