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
    let fallingBlocks = [];
    let droppedItems = [];
    let mobManager = null;
    let cloudGroup = null;
    let playerModel = null;
    let playerParts = {
        head: null,
        body: null,
        leftArm: null,
        rightArm: null,
        leftLeg: null,
        rightLeg: null
    };
    let debrisMaterial = null;
    let clock;
    let isPaused = true;

    // Continuous mouse breaking / placing
    let isMouseDown = false;
    let activeMouseButton = -1; // 0: break, 2: place/interact
    let mouseActionCooldown = 0;
    const BREAK_COOLDOWN = 0.22;
    const PLACE_COOLDOWN = 0.25;

    // Progressive Survival Mining & Crack Overlay
    let crackMesh = null;
    let miningTargetKey = null;
    let miningProgress = 0;
    let miningHitTimer = 0;

    // 3D First-Person Held Block in Hand
    let heldBlockMesh = null;
    let lastHeldBlockId = -1;
    let handSwingTimer = 0;
    const HAND_SWING_DURATION = 0.22;
    let handPointLight = null;

    // Weather & Atmosphere
    let weatherState = 'clear'; // 'clear' | 'rain' | 'thunder'
    let weatherGroup = null;
    let lightningFlashTimer = 0;
    let rainSoundTimer = 0;
    let textureAnimTimer = 0;
    let totalElapsedTime = 0;
    let lavaSparkTimer = 0;

    // Dynamic Water Flow
    let waterFlowQueue = [];
    let waterFlowCount = 0;

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

        // 5b. Mobs Manager
        mobManager = window.Mobs ? new window.Mobs.MobManager(world, scene, THREE, audio) : null;

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

        // 8b. Setup 3D First-Person Held Block in Hand
        setupHeldBlock();

        // 8c. Setup 3D Sky Clouds & Weather
        setupClouds();
        setupWeather();

        // 8d. Setup 3D Third-Person Steve Player Model
        setupPlayerModel();

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
            inventoryCounts: window.UI ? window.UI.inventoryCounts : undefined,
            health: player.health !== undefined ? player.health : 20,
            oxygen: player.oxygen !== undefined ? player.oxygen : 15.0,
            gameMode: player.gameMode || 'survival',
            dayTime: dayTime,
            weatherState: weatherState,
            spawnPoint: player.spawnPoint || null,
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
            if (data.inventoryCounts && typeof data.inventoryCounts === 'object' && window.UI) {
                window.UI.inventoryCounts = Object.assign({}, data.inventoryCounts);
                if (window.UI.buildHotbar) window.UI.buildHotbar();
            }
            if (typeof data.health === 'number' && !isNaN(data.health)) {
                player.health = Math.max(1, Math.min(20, data.health));
                if (window.UI) window.UI.updateHealth(player.health);
            }
            if (typeof data.oxygen === 'number' && !isNaN(data.oxygen)) {
                player.oxygen = Math.max(0, Math.min(player.maxOxygen || 15.0, data.oxygen));
                if (window.UI && typeof window.UI.updateOxygen === 'function') {
                    window.UI.updateOxygen(player.oxygen, player.maxOxygen || 15.0);
                }
            }
            if (data.gameMode && typeof player.setGameMode === 'function') {
                player.setGameMode(data.gameMode);
            } else if (data.gameMode) {
                player.gameMode = data.gameMode;
                if (window.UI && typeof window.UI.updateGameMode === 'function') {
                    window.UI.updateGameMode(data.gameMode);
                }
            }
            if (typeof data.dayTime === 'number' && !isNaN(data.dayTime)) {
                dayTime = data.dayTime;
            }
            if (typeof data.weatherState === 'string') {
                weatherState = data.weatherState;
                if (window.UI && typeof window.UI.updateWeatherUI === 'function') {
                    window.UI.updateWeatherUI(weatherState);
                }
            }
            if (data.spawnPoint && typeof data.spawnPoint.x === 'number') {
                player.spawnPoint = {
                    x: data.spawnPoint.x,
                    y: data.spawnPoint.y,
                    z: data.spawnPoint.z
                };
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

        handPointLight = new THREE.PointLight(0xffaa44, 0, 14, 1.5);
        scene.add(handPointLight);

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

        const crackGeo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
        const crackMat = new THREE.MeshBasicMaterial({
            map: atlasTexture,
            transparent: true,
            opacity: 0.85,
            alphaTest: 0.05,
            depthWrite: false
        });
        crackMesh = new THREE.Mesh(crackGeo, crackMat);
        crackMesh.visible = false;
        scene.add(crackMesh);
    }

    function setCrackStage(stage) {
        stage = Math.max(0, Math.min(9, Math.floor(stage)));
        if (!crackMesh || !crackMesh.geometry) return;
        const tileIdx = (window.Blocks.TILES && window.Blocks.TILES.CRACK_0 !== undefined)
            ? (window.Blocks.TILES.CRACK_0 + stage)
            : (240 + stage);
        const { u0, v0, u1, v1 } = window.Blocks.getTileUV(tileIdx);
        const uvAttr = crackMesh.geometry.attributes.uv;
        if (uvAttr) {
            const uvs = uvAttr.array;
            for (let f = 0; f < 6; f++) {
                const offset = f * 8;
                uvs[offset]     = u0; uvs[offset + 1] = v1;
                uvs[offset + 2] = u1; uvs[offset + 3] = v1;
                uvs[offset + 4] = u0; uvs[offset + 5] = v0;
                uvs[offset + 6] = u1; uvs[offset + 7] = v0;
            }
            uvAttr.needsUpdate = true;
        }
    }

    function setupHeldBlock() {
        if (!scene || !camera || !atlasTexture) return;
        scene.add(camera);
        const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
        const mat = new THREE.MeshLambertMaterial({
            map: atlasTexture,
            transparent: true,
            alphaTest: 0.1
        });
        heldBlockMesh = new THREE.Mesh(geo, mat);
        heldBlockMesh.position.set(0.42, -0.32, -0.58);
        heldBlockMesh.rotation.set(0.15, -0.65, 0.05);
        camera.add(heldBlockMesh);
    }

    function updateHeldBlockUVs(blockId) {
        if (!heldBlockMesh || !heldBlockMesh.geometry) return;
        if (!blockId || blockId <= 0 || !window.Blocks.BLOCK_DEFS[blockId]) {
            heldBlockMesh.visible = false;
            return;
        }
        heldBlockMesh.visible = true;
        const uvAttr = heldBlockMesh.geometry.attributes.uv;
        if (!uvAttr) return;
        const uvs = uvAttr.array;
        for (let f = 0; f < 6; f++) {
            const tileIdx = window.Blocks.getBlockFaceTexture(blockId, f);
            const { u0, v0, u1, v1 } = window.Blocks.getTileUV(tileIdx);
            const offset = f * 8;
            uvs[offset]     = u0; uvs[offset + 1] = v1;
            uvs[offset + 2] = u1; uvs[offset + 3] = v1;
            uvs[offset + 4] = u0; uvs[offset + 5] = v0;
            uvs[offset + 6] = u1; uvs[offset + 7] = v0;
        }
        uvAttr.needsUpdate = true;
    }

    function triggerHandSwing() {
        handSwingTimer = HAND_SWING_DURATION;
    }

    function updateHeldBlock(dt) {
        if (!heldBlockMesh) return;
        const currentId = (window.UI && typeof window.UI.getSelectedBlockId === 'function')
            ? window.UI.getSelectedBlockId()
            : 1;

        // Dynamic handheld point light when holding Torch, Glowstone, Jack o'Lantern, or Lava
        if (handPointLight && player) {
            const bDef = window.Blocks && window.Blocks.BLOCK_DEFS ? window.Blocks.BLOCK_DEFS[currentId] : null;
            const isLightItem = Boolean(
                (bDef && bDef.light) ||
                currentId === 31 || // TORCH
                currentId === 21 || // GLOWSTONE
                currentId === 25 || // JACK_O_LANTERN
                currentId === 27    // LAVA
            );
            if (isLightItem) {
                handPointLight.intensity = 1.2 + Math.sin(totalElapsedTime * 11.0) * 0.14;
                handPointLight.position.set(
                    player.position.x,
                    player.position.y + 1.35,
                    player.position.z
                );
            } else {
                handPointLight.intensity = 0;
            }
        }

        if (player && player.cameraMode > 0) {
            heldBlockMesh.visible = false;
            return;
        }

        if (currentId !== lastHeldBlockId) {
            lastHeldBlockId = currentId;
            updateHeldBlockUVs(currentId);
        }

        const bobCycle = (player && typeof player.bobCycle === 'number') ? player.bobCycle : 0;
        const bobX = Math.cos(bobCycle * 0.5) * 0.02;
        const bobY = Math.abs(Math.sin(bobCycle)) * 0.025;

        let swing = 0;
        if (handSwingTimer > 0) {
            handSwingTimer = Math.max(0, handSwingTimer - dt);
            const p = 1.0 - (handSwingTimer / HAND_SWING_DURATION);
            swing = Math.sin(p * Math.PI);
        }

        heldBlockMesh.position.set(
            0.42 + bobX - swing * 0.12,
            -0.32 + bobY - swing * 0.08,
            -0.58 - swing * 0.15
        );
        heldBlockMesh.rotation.set(
            0.15 - swing * 0.6,
            -0.65 + swing * 0.3,
            0.05 + swing * 0.2
        );
    }

    function setupClouds() {
        cloudGroup = new THREE.Group();
        cloudGroup.position.y = 56;

        const cloudMat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.78,
            depthWrite: false
        });

        for (let i = 0; i < 22; i++) {
            const w = 8 + Math.random() * 8; // 8..16
            const d = 6 + Math.random() * 6; // 6..12
            const geo = new THREE.BoxGeometry(w, 1.5, d);
            const mesh = new THREE.Mesh(geo, cloudMat);
            mesh.position.set(
                (Math.random() - 0.5) * 240,
                0,
                (Math.random() - 0.5) * 240
            );
            cloudGroup.add(mesh);
        }

        scene.add(cloudGroup);
    }

    function updateClouds(dt) {
        if (!cloudGroup || !player) return;
        const speed = 0.8 * dt;
        const px = player.position.x;
        const pz = player.position.z;

        for (let i = 0; i < cloudGroup.children.length; i++) {
            const cloud = cloudGroup.children[i];
            cloud.position.x += speed;

            while (cloud.position.x - px > 120) {
                cloud.position.x -= 240;
            }
            while (cloud.position.x - px < -120) {
                cloud.position.x += 240;
            }
            while (cloud.position.z - pz > 120) {
                cloud.position.z -= 240;
            }
            while (cloud.position.z - pz < -120) {
                cloud.position.z += 240;
            }
        }
    }

    function setupWeather() {
        weatherGroup = new THREE.Group();
        const dropGeo = new THREE.BoxGeometry(0.05, 0.55, 0.05);
        const dropMat = new THREE.MeshBasicMaterial({
            color: 0x77aaff,
            transparent: true,
            opacity: 0.68,
            depthWrite: false
        });

        for (let i = 0; i < 160; i++) {
            const drop = new THREE.Mesh(dropGeo, dropMat);
            drop.position.set(
                (Math.random() - 0.5) * 38,
                Math.random() * 24,
                (Math.random() - 0.5) * 38
            );
            weatherGroup.add(drop);
        }
        weatherGroup.visible = false;
        scene.add(weatherGroup);
    }

    function cycleWeather() {
        if (weatherState === 'clear') weatherState = 'rain';
        else if (weatherState === 'rain') weatherState = 'thunder';
        else weatherState = 'clear';

        if (window.UI) {
            if (typeof window.UI.updateWeatherUI === 'function') {
                window.UI.updateWeatherUI(weatherState);
            }
            const names = {
                clear: 'Počasí: Jasno ☀️',
                rain: 'Počasí: Déšť / Sněžení 🌧️',
                thunder: 'Počasí: Bouřka s blesky ⛈️'
            };
            window.UI.showToast(names[weatherState] || 'Počasí změněno');
        }
    }

    function advanceTimeOfDay() {
        // Snap to next major quarter of day: 0 (Dawn), 0.25 (Noon), 0.5 (Dusk), 0.75 (Midnight)
        const quarters = [0.0, 0.25, 0.5, 0.75];
        let nextQ = 0.25;
        for (let i = 0; i < quarters.length; i++) {
            if (dayTime < quarters[i] - 0.02) {
                nextQ = quarters[i];
                break;
            }
            if (i === quarters.length - 1) {
                nextQ = 0.0;
            }
        }
        dayTime = nextQ;
        const labels = {
            0: 'Čas: Svítání (06:00) 🌅',
            0.25: 'Čas: Poledne (12:00) ☀️',
            0.5: 'Čas: Západ slunce (18:00) 🌇',
            0.75: 'Čas: Půlnoc (00:00) 🌙'
        };
        if (window.UI) {
            window.UI.showToast(labels[dayTime] || 'Čas posunut');
        }
    }

    function updateWeather(dt) {
        if (!weatherGroup || !player) return;

        if (lightningFlashTimer > 0) {
            lightningFlashTimer = Math.max(0, lightningFlashTimer - dt);
        }

        if (weatherState === 'clear') {
            weatherGroup.visible = false;
            return;
        }

        const biome = (world && typeof world.getBiome === 'function')
            ? world.getBiome(Math.floor(player.position.x), Math.floor(player.position.z))
            : 'plains';

        if (biome === 'desert') {
            // Desert remains dry even during storms
            weatherGroup.visible = false;
            return;
        }

        weatherGroup.visible = true;
        const isSnow = biome === 'mountains';
        const fallSpeed = isSnow ? 5.2 : 22.0;

        const firstChild = weatherGroup.children[0];
        if (firstChild && firstChild.material) {
            firstChild.material.color.setHex(isSnow ? 0xffffff : 0x77aaff);
        }

        const px = player.position.x;
        const py = player.position.y;
        const pz = player.position.z;

        for (let i = 0; i < weatherGroup.children.length; i++) {
            const drop = weatherGroup.children[i];
            drop.scale.y = isSnow ? 0.25 : 1.0;
            drop.scale.x = isSnow ? 2.2 : 1.0;
            drop.scale.z = isSnow ? 2.2 : 1.0;

            drop.position.y -= fallSpeed * dt;
            if (isSnow) {
                drop.position.x += Math.sin(totalElapsedTime * 2.0 + i) * 0.8 * dt;
            }

            if (drop.position.y < py - 6) {
                drop.position.y = py + 14 + Math.random() * 6;
                drop.position.x = px + (Math.random() - 0.5) * 34;
                drop.position.z = pz + (Math.random() - 0.5) * 34;
            }
        }

        if (!isPaused && !isSnow) {
            rainSoundTimer -= dt;
            if (rainSoundTimer <= 0) {
                rainSoundTimer = 0.22 + Math.random() * 0.15;
                if (audio && typeof audio.playRainTick === 'function') {
                    audio.playRainTick();
                }
            }
        }

        if (!isPaused && weatherState === 'thunder') {
            if (Math.random() < dt * 0.08) {
                lightningFlashTimer = 0.22;
                if (audio && typeof audio.playThunder === 'function') {
                    audio.playThunder();
                }
                if (typeof player.addScreenShake === 'function') {
                    player.addScreenShake(0.16, 0.35);
                }
            }
        }
    }

    function setupPlayerModel() {
        playerModel = new THREE.Group();

        const skinMat = new THREE.MeshLambertMaterial({ color: 0xd49b7a });
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x00a8a8 });
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2b388f });
        const hairMat = new THREE.MeshLambertMaterial({ color: 0x4a2c11 });

        // Head: 0.48, 0.48, 0.48 at y = 1.5
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.5, 0);

        const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skinMat);
        headGroup.add(headMesh);

        const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.16, 0.50), hairMat);
        hairMesh.position.set(0, 0.18, 0);
        headGroup.add(hairMesh);

        playerModel.add(headGroup);
        playerParts.head = headGroup;

        // Body: 0.48, 0.72, 0.24 at y = 0.90
        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.24), shirtMat);
        bodyMesh.position.set(0, 0.90, 0);
        playerModel.add(bodyMesh);
        playerParts.body = bodyMesh;

        // Right Arm: 0.22, 0.70, 0.22
        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(0.35, 1.15, 0);
        const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.70, 0.22), skinMat);
        rArmMesh.position.set(0, -0.32, 0);
        rightArmGroup.add(rArmMesh);
        const rSleeveMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), shirtMat);
        rSleeveMesh.position.set(0, -0.10, 0);
        rightArmGroup.add(rSleeveMesh);
        playerModel.add(rightArmGroup);
        playerParts.rightArm = rightArmGroup;

        // Left Arm: 0.22, 0.70, 0.22
        const leftArmGroup = new THREE.Group();
        leftArmGroup.position.set(-0.35, 1.15, 0);
        const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.70, 0.22), skinMat);
        lArmMesh.position.set(0, -0.32, 0);
        leftArmGroup.add(lArmMesh);
        const lSleeveMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), shirtMat);
        lSleeveMesh.position.set(0, -0.10, 0);
        leftArmGroup.add(lSleeveMesh);
        playerModel.add(leftArmGroup);
        playerParts.leftArm = leftArmGroup;

        // Right Leg: 0.22, 0.66, 0.22
        const rightLegGroup = new THREE.Group();
        rightLegGroup.position.set(0.13, 0.66, 0);
        const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.22), pantsMat);
        rLegMesh.position.set(0, -0.33, 0);
        rightLegGroup.add(rLegMesh);
        playerModel.add(rightLegGroup);
        playerParts.rightLeg = rightLegGroup;

        // Left Leg: 0.22, 0.66, 0.22
        const leftLegGroup = new THREE.Group();
        leftLegGroup.position.set(-0.13, 0.66, 0);
        const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.22), pantsMat);
        lLegMesh.position.set(0, -0.33, 0);
        leftLegGroup.add(lLegMesh);
        playerModel.add(leftLegGroup);
        playerParts.leftLeg = leftLegGroup;

        playerModel.visible = false;
        scene.add(playerModel);
    }

    function updatePlayerModel(dt) {
        if (!playerModel || !player) return;

        const isThirdPerson = Boolean(player.cameraMode > 0);
        playerModel.visible = isThirdPerson;

        if (heldBlockMesh && isThirdPerson) {
            heldBlockMesh.visible = false;
        }

        if (!isThirdPerson) return;

        playerModel.position.set(player.position.x, player.position.y, player.position.z);
        playerModel.rotation.y = player.yaw;

        const bob = (typeof player.bobCycle === 'number') ? player.bobCycle : 0;
        const walkSwing = Math.sin(bob) * 0.65;

        if (playerParts.leftLeg) playerParts.leftLeg.rotation.x = walkSwing;
        if (playerParts.rightLeg) playerParts.rightLeg.rotation.x = -walkSwing;
        if (playerParts.leftArm) playerParts.leftArm.rotation.x = -walkSwing;

        let rArmSwing = walkSwing;
        if (handSwingTimer > 0) {
            const p = 1.0 - (handSwingTimer / HAND_SWING_DURATION);
            rArmSwing -= Math.sin(p * Math.PI) * 1.2;
        }
        if (playerParts.rightArm) {
            playerParts.rightArm.rotation.x = rArmSwing;
        }

        if (playerParts.head) {
            playerParts.head.rotation.x = player.pitch;
        }
    }

    function setupGameInput() {
        const blocker = document.getElementById('pause-menu');
        const resumeBtn = document.getElementById('btn-resume');
        const saveBtn = document.getElementById('btn-save');
        const loadBtn = document.getElementById('btn-load');
        const resetBtn = document.getElementById('btn-reset');
        const weatherBtn = document.getElementById('btn-weather');
        const musicBtn = document.getElementById('btn-music');

        if (weatherBtn) {
            weatherBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                cycleWeather();
            });
        }

        if (musicBtn) {
            musicBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (audio) {
                    audio.musicEnabled = !audio.musicEnabled;
                    if (window.UI && typeof window.UI.updateMusicUI === 'function') {
                        window.UI.updateMusicUI(audio.musicEnabled);
                    }
                    if (window.UI) {
                        window.UI.showToast(audio.musicEnabled ? 'Ambientní hudba zapnuta 🎵' : 'Ambientní hudba vypnuta 🔇');
                    }
                }
            });
        }

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
                miningProgress = 0;
                miningTargetKey = null;
                if (crackMesh) crackMesh.visible = false;
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
            } else if (!isPaused && (!window.UI || !window.UI.isInventoryOpen)) {
                if (e.code === 'KeyR') {
                    cycleWeather();
                } else if (e.code === 'KeyT') {
                    advanceTimeOfDay();
                }
            }
        });

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                saveGameState();
            });
        }

        function clearActiveEntities() {
            waterFlowQueue = [];
            waterFlowCount = 0;
            miningProgress = 0;
            miningTargetKey = null;
            if (crackMesh) crackMesh.visible = false;
            for (const tnt of activeTNTs) {
                scene.remove(tnt.mesh);
                if (tnt.mesh.geometry) tnt.mesh.geometry.dispose();
                if (tnt.mesh.material) tnt.mesh.material.dispose();
            }
            activeTNTs = [];

            for (const fb of fallingBlocks) {
                scene.remove(fb.mesh);
                if (fb.mesh.geometry) fb.mesh.geometry.dispose();
                if (fb.mesh.material) fb.mesh.material.dispose();
            }
            fallingBlocks = [];

            for (const item of droppedItems) {
                scene.remove(item.mesh);
                if (item.mesh.geometry) item.mesh.geometry.dispose();
                if (item.mesh.material) item.mesh.material.dispose();
            }
            droppedItems = [];

            if (mobManager && typeof mobManager.clear === 'function') {
                mobManager.clear();
            }

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
                    if (mobManager) mobManager.world = world;
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
                    player.spawnPoint = null;
                    if (mobManager) mobManager.world = world;
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
                    weatherState = 'clear';
                    if (window.UI && typeof window.UI.updateWeatherUI === 'function') {
                        window.UI.updateWeatherUI(weatherState);
                    }
                    loadSurroundingChunks(true);
                    window.UI.showToast('Generated New World!');
                    resumeGame();
                }
            });
        }

        // Mouse click and hold for continuous mining, combat, and placing
        window.addEventListener('mousedown', (e) => {
            if (isPaused || !player.isLocked) return;

            isMouseDown = true;
            activeMouseButton = e.button;

            if (e.button === 0) {
                // Left Click: Combat or progressive mining
                triggerHandSwing();

                const heldId = (window.UI && typeof window.UI.getSelectedBlockId === 'function')
                    ? window.UI.getSelectedBlockId()
                    : 1;
                const heldDef = window.Blocks && window.Blocks.BLOCK_DEFS ? window.Blocks.BLOCK_DEFS[heldId] : null;
                if (heldDef && heldDef.isTool && audio && typeof audio.playSwordSwing === 'function') {
                    audio.playSwordSwing();
                }

                // Check mob melee hit within 4.0 blocks
                const eyePos = player.eyePosition || {
                    x: player.position.x,
                    y: player.position.y + (player.currentEyeHeight || 1.62),
                    z: player.position.z
                };
                const lookDir = typeof player.getLookDirection === 'function' ? player.getLookDirection() : { x: 0, y: 0, z: -1 };

                if (mobManager) {
                    const mobHit = mobManager.raycastMob(eyePos, lookDir, 4.0);
                    if (mobHit && mobHit.hit && (!player.targetBlock || !player.targetBlock.hit || mobHit.distance <= player.targetBlock.distance)) {
                        const baseDmg = (heldDef && typeof heldDef.attackDamage === 'number') ? heldDef.attackDamage : 5;
                        const dmg = (player.isFlying || player.gameMode === 'creative') ? 25 : baseDmg;
                        mobManager.hitMob(mobHit.mob, dmg, player.position, {
                            onMobKilled: (m) => {
                                spawnExplosionParticles(m.position.x, m.position.y + 0.5, m.position.z);
                                if (m.def && m.def.dropBlockId) {
                                    spawnItemDrop(Math.floor(m.position.x), Math.floor(m.position.y), Math.floor(m.position.z), m.def.dropBlockId);
                                }
                            }
                        });
                        mouseActionCooldown = BREAK_COOLDOWN;
                        return; // Hit mob instead of mining block behind it!
                    }
                }

                if (player.isFlying || player.gameMode === 'creative') {
                    onBreakBlock();
                    mouseActionCooldown = BREAK_COOLDOWN;
                } else {
                    miningHitTimer = 0;
                }
            } else if (e.button === 2) {
                // Right Click: Place or interact (e.g. ignite TNT, crafting table, bed)
                onPlaceOrInteract();
                mouseActionCooldown = PLACE_COOLDOWN;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === activeMouseButton) {
                isMouseDown = false;
                activeMouseButton = -1;
                miningProgress = 0;
                miningTargetKey = null;
                if (crackMesh) crackMesh.visible = false;
            }
        });

        window.addEventListener('blur', () => {
            isMouseDown = false;
            activeMouseButton = -1;
            miningProgress = 0;
            miningTargetKey = null;
            if (crackMesh) crackMesh.visible = false;
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
            if (window.UI) window.UI.showToast('Bedrock is indestructible!');
            return;
        }

        if (blockId !== 0) {
            triggerHandSwing();
            audio.playBreak(bDef ? bDef.sound : 'stone');
            spawnDebris(pos.x, pos.y, pos.z, blockId);
            spawnItemDrop(pos.x, pos.y, pos.z, blockId);

            world.setBlock(pos.x, pos.y, pos.z, window.Blocks.BLOCKS.AIR);
            updateAffectedChunks(pos.x, pos.z);
            waterFlowCount = 0;
            scheduleWaterFlowAround(pos.x, pos.y, pos.z);
            scheduleGravityCheckAround(pos.x, pos.y + 1, pos.z);
            player.updateRaycast();
            updateBlockOutline();
        }
    }

    function onPlaceOrInteract() {
        if (!player.targetBlock || !player.targetBlock.hit) return;

        const hitPos = player.targetBlock.blockPos;
        const hitBlockId = world.getBlock(hitPos.x, hitPos.y, hitPos.z);

        // Right-clicking Crafting Table opens crafting inventory!
        const craftingTableId = (window.Blocks && window.Blocks.BLOCKS && window.Blocks.BLOCKS.CRAFTING_TABLE !== undefined)
            ? window.Blocks.BLOCKS.CRAFTING_TABLE
            : 26;
        if (hitBlockId === craftingTableId && !player.isSneaking) {
            if (window.UI && typeof window.UI.openInventory === 'function') {
                window.UI.openInventory();
            }
            isMouseDown = false;
            activeMouseButton = -1;
            return;
        }

        // Right-clicking Bed sets spawnpoint, heals player, and skips night/storm!
        const bedId = (window.Blocks && window.Blocks.BLOCKS && window.Blocks.BLOCKS.BED !== undefined)
            ? window.Blocks.BLOCKS.BED
            : 32;
        if (hitBlockId === bedId && !player.isSneaking) {
            player.spawnPoint = {
                x: hitPos.x + 0.5,
                y: hitPos.y + 1.1,
                z: hitPos.z + 0.5
            };
            player.health = 20;
            if (window.UI && typeof window.UI.updateHealth === 'function') {
                window.UI.updateHealth(20);
            }
            if (audio && typeof audio.playSleep === 'function') {
                audio.playSleep();
            }
            if (window.UI && typeof window.UI.triggerSleepFade === 'function') {
                window.UI.triggerSleepFade();
            }
            dayTime = 0.25; // Morning
            if (weatherState !== 'clear') {
                weatherState = 'clear';
                if (window.UI && typeof window.UI.updateWeatherUI === 'function') {
                    window.UI.updateWeatherUI(weatherState);
                }
            }
            if (window.UI) {
                window.UI.showToast('Uloženo lůžko (Spawnpoint)! Dobré ráno! 🛏️');
            }
            isMouseDown = false;
            activeMouseButton = -1;
            return;
        }

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

        const selectedBlockId = window.UI.getSelectedBlockId();
        const bDef = window.Blocks.BLOCK_DEFS[selectedBlockId];

        // Tools (Pickaxe, Sword) cannot be placed as blocks in the world
        if (bDef && bDef.isTool) {
            triggerHandSwing();
            if (audio && typeof audio.playSwordSwing === 'function') {
                audio.playSwordSwing();
            }
            return;
        }

        const placePos = player.targetBlock.placePos;
        if (!player.canPlaceBlockAt(placePos.x, placePos.y, placePos.z)) {
            return; // Can't place inside player
        }

        triggerHandSwing();
        world.setBlock(placePos.x, placePos.y, placePos.z, selectedBlockId);
        audio.playPlace(bDef ? bDef.sound : 'stone');
        updateAffectedChunks(placePos.x, placePos.z);

        if (selectedBlockId === window.Blocks.BLOCKS.WATER) {
            waterFlowCount = 0;
            scheduleWaterFlowAround(placePos.x, placePos.y, placePos.z);
        }

        checkLavaWaterInteraction(placePos.x, placePos.y, placePos.z);
        scheduleGravityCheckAround(placePos.x, placePos.y, placePos.z);

        player.updateRaycast();
        updateBlockOutline();
    }

    function scheduleGravityCheckAround(bx, by, bz) {
        if (!world || !window.Blocks) return;
        const airId = window.Blocks.BLOCKS.AIR || 0;
        const waterId = window.Blocks.BLOCKS.WATER || 11;

        const cols = [
            { x: bx, z: bz },
            { x: bx + 1, z: bz },
            { x: bx - 1, z: bz },
            { x: bx, z: bz + 1 },
            { x: bx, z: bz - 1 }
        ];

        const minY = Math.max(2, Math.floor(by));
        const maxY = Math.min((window.World ? window.World.CHUNK_HEIGHT : 64) - 1, Math.floor(by) + 16);

        let anySpawned = false;

        for (const col of cols) {
            for (let y = minY; y <= maxY; y++) {
                const blockId = world.getBlock(col.x, y, col.z);
                if (!blockId) continue;
                const bDef = window.Blocks.BLOCK_DEFS[blockId];
                if (bDef && bDef.gravity) {
                    const belowId = world.getBlock(col.x, y - 1, col.z);
                    if (belowId === airId || belowId === waterId) {
                        const alreadyFalling = fallingBlocks.some(fb =>
                            Math.floor(fb.x) === col.x && Math.floor(fb.z) === col.z && Math.abs(fb.y - (y + 0.5)) < 0.8
                        );
                        if (alreadyFalling) continue;

                        world.setBlock(col.x, y, col.z, airId);
                        updateAffectedChunks(col.x, col.z);

                        const geo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
                        const uvAttr = geo.attributes.uv;
                        if (uvAttr) {
                            const uvs = uvAttr.array;
                            for (let f = 0; f < 6; f++) {
                                const tileIdx = window.Blocks.getBlockFaceTexture(blockId, f);
                                const { u0, v0, u1, v1 } = window.Blocks.getTileUV(tileIdx);
                                const offset = f * 8;
                                uvs[offset]     = u0; uvs[offset + 1] = v1;
                                uvs[offset + 2] = u1; uvs[offset + 3] = v1;
                                uvs[offset + 4] = u0; uvs[offset + 5] = v0;
                                uvs[offset + 6] = u1; uvs[offset + 7] = v0;
                            }
                            uvAttr.needsUpdate = true;
                        }

                        const mat = new THREE.MeshLambertMaterial({
                            map: atlasTexture
                        });
                        const mesh = new THREE.Mesh(geo, mat);
                        mesh.position.set(col.x + 0.5, y + 0.5, col.z + 0.5);
                        scene.add(mesh);

                        fallingBlocks.push({
                            mesh,
                            blockId,
                            x: col.x,
                            z: col.z,
                            y: y + 0.5,
                            velY: 0
                        });

                        anySpawned = true;
                    }
                }
            }
        }

        if (anySpawned) {
            player.updateRaycast();
            updateBlockOutline();
        }
    }

    function updateFallingBlocks(dt) {
        if (!world) return;
        for (let i = fallingBlocks.length - 1; i >= 0; i--) {
            const fb = fallingBlocks[i];
            fb.velY -= 24.0 * dt;
            fb.y += fb.velY * dt;
            fb.mesh.position.y = fb.y;

            const floorY = Math.floor(fb.y - 0.49);
            const fx = Math.floor(fb.x);
            const fz = Math.floor(fb.z);

            if (world.isSolid(fx, floorY, fz) || floorY <= 0) {
                const targetY = floorY + 1;
                world.setBlock(fx, targetY, fz, fb.blockId);
                if (audio && typeof audio.playPlace === 'function') {
                    audio.playPlace('sand');
                }
                updateAffectedChunks(fx, fz);

                scene.remove(fb.mesh);
                if (fb.mesh.geometry) fb.mesh.geometry.dispose();
                if (fb.mesh.material) fb.mesh.material.dispose();
                fallingBlocks.splice(i, 1);

                scheduleGravityCheckAround(fx, targetY + 1, fz);
            } else if (fb.y < -10) {
                scene.remove(fb.mesh);
                if (fb.mesh.geometry) fb.mesh.geometry.dispose();
                if (fb.mesh.material) fb.mesh.material.dispose();
                fallingBlocks.splice(i, 1);
            }
        }
    }

    function spawnItemDrop(bx, by, bz, blockId) {
        if (!blockId || blockId <= 0 || !window.Blocks) return;
        if (
            blockId === window.Blocks.BLOCKS.AIR ||
            blockId === window.Blocks.BLOCKS.WATER ||
            blockId === window.Blocks.BLOCKS.BEDROCK ||
            (window.Blocks.BLOCKS.LAVA !== undefined && blockId === window.Blocks.BLOCKS.LAVA)
        ) {
            return;
        }

        const geo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
        const uvAttr = geo.attributes.uv;
        if (uvAttr) {
            const uvs = uvAttr.array;
            for (let f = 0; f < 6; f++) {
                const tileIdx = window.Blocks.getBlockFaceTexture(blockId, f);
                const { u0, v0, u1, v1 } = window.Blocks.getTileUV(tileIdx);
                const offset = f * 8;
                uvs[offset]     = u0; uvs[offset + 1] = v1;
                uvs[offset + 2] = u1; uvs[offset + 3] = v1;
                uvs[offset + 4] = u0; uvs[offset + 5] = v0;
                uvs[offset + 6] = u1; uvs[offset + 7] = v0;
            }
            uvAttr.needsUpdate = true;
        }

        const mat = new THREE.MeshLambertMaterial({
            map: atlasTexture,
            transparent: true,
            alphaTest: 0.1
        });

        const mesh = new THREE.Mesh(geo, mat);
        const startX = bx + 0.5;
        const startY = by + 0.35;
        const startZ = bz + 0.5;
        mesh.position.set(startX, startY, startZ);
        scene.add(mesh);

        droppedItems.push({
            mesh,
            blockId,
            pos: { x: startX, y: startY, z: startZ },
            vel: {
                x: (Math.random() - 0.5) * 2.0,
                y: 3.2,
                z: (Math.random() - 0.5) * 2.0
            },
            age: 0
        });
    }

    function updateDroppedItems(dt) {
        for (let i = droppedItems.length - 1; i >= 0; i--) {
            const item = droppedItems[i];
            item.age += dt;

            if (item.age > 60.0) {
                scene.remove(item.mesh);
                if (item.mesh.geometry) item.mesh.geometry.dispose();
                if (item.mesh.material) item.mesh.material.dispose();
                droppedItems.splice(i, 1);
                continue;
            }

            item.mesh.rotation.y += 2.2 * dt;

            // Apply gravity and velocity
            item.vel.y -= 16.0 * dt;
            item.pos.x += item.vel.x * dt;
            item.pos.y += item.vel.y * dt;
            item.pos.z += item.vel.z * dt;

            // Air friction
            item.vel.x *= Math.pow(0.5, dt * 4.0);
            item.vel.z *= Math.pow(0.5, dt * 4.0);

            // Ground landing collision
            const floorY = Math.floor(item.pos.y - 0.12);
            const fx = Math.floor(item.pos.x);
            const fz = Math.floor(item.pos.z);
            if (world && world.isSolid(fx, floorY, fz)) {
                item.pos.y = floorY + 1.0 + 0.12;
                item.vel.y = 0;
                item.vel.x = 0;
                item.vel.z = 0;
            }

            // Bobbing offset
            const bob = Math.sin(item.age * 4.0) * 0.05;
            item.mesh.position.set(item.pos.x, item.pos.y + bob, item.pos.z);

            // Check distance to player
            if (item.age > 0.35 && player) {
                const pEyeX = player.position.x;
                const pEyeY = player.position.y + 0.8;
                const pEyeZ = player.position.z;
                const dx = pEyeX - item.pos.x;
                const dy = pEyeY - item.pos.y;
                const dz = pEyeZ - item.pos.z;
                const dist = Math.hypot(dx, dy, dz);

                if (dist < 2.2) {
                    const pull = Math.min(1.0, 5.5 * dt);
                    item.pos.x += dx * pull;
                    item.pos.y += dy * pull;
                    item.pos.z += dz * pull;
                }

                if (dist < 1.1) {
                    if (audio && typeof audio.playPickup === 'function') {
                        audio.playPickup();
                    }
                    if (window.UI && typeof window.UI.addCollectedItem === 'function') {
                        window.UI.addCollectedItem(item.blockId, 1);
                    }
                    scene.remove(item.mesh);
                    if (item.mesh.geometry) item.mesh.geometry.dispose();
                    if (item.mesh.material) item.mesh.material.dispose();
                    droppedItems.splice(i, 1);
                }
            }
        }
    }

    function checkLavaWaterInteraction(bx, by, bz) {
        if (!world || !window.Blocks || !window.Blocks.BLOCKS) return;
        const lavaId = window.Blocks.BLOCKS.LAVA !== undefined ? window.Blocks.BLOCKS.LAVA : 30;
        const waterId = window.Blocks.BLOCKS.WATER !== undefined ? window.Blocks.BLOCKS.WATER : 11;
        const obsidianId = window.Blocks.BLOCKS.OBSIDIAN !== undefined ? window.Blocks.BLOCKS.OBSIDIAN : 17;

        const targets = [
            { x: bx, y: by, z: bz },
            { x: bx + 1, y: by, z: bz },
            { x: bx - 1, y: by, z: bz },
            { x: bx, y: by + 1, z: bz },
            { x: bx, y: by - 1, z: bz },
            { x: bx, y: by, z: bz + 1 },
            { x: bx, y: by, z: bz - 1 }
        ];

        for (const t of targets) {
            if (world.getBlock(t.x, t.y, t.z) === lavaId) {
                const hasWaterNeighbor = (
                    world.getBlock(t.x + 1, t.y, t.z) === waterId ||
                    world.getBlock(t.x - 1, t.y, t.z) === waterId ||
                    world.getBlock(t.x, t.y + 1, t.z) === waterId ||
                    world.getBlock(t.x, t.y - 1, t.z) === waterId ||
                    world.getBlock(t.x, t.y, t.z + 1) === waterId ||
                    world.getBlock(t.x, t.y, t.z - 1) === waterId
                );

                if (hasWaterNeighbor) {
                    world.setBlock(t.x, t.y, t.z, obsidianId);
                    if (audio && typeof audio.playFuse === 'function') {
                        audio.playFuse();
                    }
                    spawnSmokeParticles(t.x + 0.5, t.y + 0.5, t.z + 0.5);
                    updateAffectedChunks(t.x, t.z);
                }
            }
        }
    }

    function spawnSmokeParticles(x, y, z, count = 10) {
        for (let i = 0; i < count; i++) {
            const size = 0.15 + Math.random() * 0.15;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.8 });
            const pMesh = new THREE.Mesh(geo, mat);
            pMesh.position.set(
                x + (Math.random() - 0.5) * 0.6,
                y + (Math.random() - 0.5) * 0.6,
                z + (Math.random() - 0.5) * 0.6
            );
            scene.add(pMesh);
            particles.push({
                mesh: pMesh,
                vel: {
                    x: (Math.random() - 0.5) * 1.5,
                    y: 1.5 + Math.random() * 2.0,
                    z: (Math.random() - 0.5) * 1.5
                },
                life: 0.6 + Math.random() * 0.4
            });
        }
    }

    function igniteTNT(bx, by, bz, fuse = 3.0) {
        bx = Math.floor(bx);
        by = Math.floor(by);
        bz = Math.floor(bz);

        const currentBlock = world.getBlock(bx, by, bz);
        if (currentBlock !== window.Blocks.BLOCKS.TNT) return;

        triggerHandSwing();

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
                                if (Math.random() < 0.35) {
                                    spawnItemDrop(x, y, z, blockId);
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

        // Gravity check around crater
        scheduleGravityCheckAround(tx, ty, tz);

        // Knockback and damage on player
        const pVec = {
            x: player.position.x - tPos.x,
            y: (player.position.y + 0.9) - tPos.y,
            z: player.position.z - tPos.z
        };
        const dist = Math.sqrt(pVec.x * pVec.x + pVec.y * pVec.y + pVec.z * pVec.z);
        if (dist < 14.0 && typeof player.addScreenShake === 'function') {
            player.addScreenShake((1.0 - dist / 14.0) * 0.35, 0.4);
        }
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

    function updateMining(dt) {
        if (!player.isLocked || !isMouseDown || activeMouseButton !== 0) {
            miningProgress = 0;
            miningTargetKey = null;
            if (crackMesh) crackMesh.visible = false;
            return;
        }

        if (player.isFlying || player.gameMode === 'creative') {
            if (crackMesh) crackMesh.visible = false;
            mouseActionCooldown -= dt;
            if (mouseActionCooldown <= 0) {
                onBreakBlock();
                mouseActionCooldown = BREAK_COOLDOWN;
            }
            return;
        }

        if (!player.targetBlock || !player.targetBlock.hit) {
            miningProgress = 0;
            miningTargetKey = null;
            if (crackMesh) crackMesh.visible = false;
            return;
        }

        const pos = player.targetBlock.blockPos;
        const blockId = world.getBlock(pos.x, pos.y, pos.z);
        const bDef = window.Blocks.BLOCK_DEFS[blockId];

        if (!blockId || blockId === 0) {
            miningProgress = 0;
            miningTargetKey = null;
            if (crackMesh) crackMesh.visible = false;
            return;
        }

        if (bDef && bDef.unbreakable) {
            if (miningHitTimer <= 0) {
                if (window.UI) window.UI.showToast('Bedrock is indestructible!');
                miningHitTimer = 1.0;
            } else {
                miningHitTimer -= dt;
            }
            miningProgress = 0;
            if (crackMesh) crackMesh.visible = false;
            return;
        }

        const key = `${pos.x},${pos.y},${pos.z}`;
        if (key !== miningTargetKey) {
            miningTargetKey = key;
            miningProgress = 0;
        }

        const hardness = (bDef && typeof bDef.hardness === 'number' && bDef.hardness > 0) ? bDef.hardness : 0.5;
        const heldId = (window.UI && typeof window.UI.getSelectedBlockId === 'function')
            ? window.UI.getSelectedBlockId()
            : 1;
        const heldDef = window.Blocks && window.Blocks.BLOCK_DEFS ? window.Blocks.BLOCK_DEFS[heldId] : null;
        const toolMult = (heldDef && typeof heldDef.miningSpeedMultiplier === 'number') ? heldDef.miningSpeedMultiplier : 1.0;

        miningProgress += (dt * toolMult) / hardness;
        miningHitTimer -= dt;

        if (miningHitTimer <= 0) {
            miningHitTimer = 0.22;
            if (audio && typeof audio.playStep === 'function') {
                audio.playStep(bDef ? bDef.sound : 'stone');
            }
            triggerHandSwing();
        }

        if (crackMesh) {
            crackMesh.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
            crackMesh.visible = true;
            setCrackStage(Math.min(9, Math.floor(miningProgress * 10)));
        }

        if (miningProgress >= 1.0) {
            onBreakBlock();
            miningProgress = 0;
            miningTargetKey = null;
            if (crackMesh) crackMesh.visible = false;
        }
    }

    function scheduleWaterFlowAround(bx, by, bz) {
        const seaLevel = (window.World && window.World.SEA_LEVEL !== undefined) ? window.World.SEA_LEVEL : 18;
        const waterId = (window.Blocks && window.Blocks.BLOCKS && window.Blocks.BLOCKS.WATER !== undefined) ? window.Blocks.BLOCKS.WATER : 11;

        const candidates = [
            { x: bx, y: by, z: bz },
            { x: bx + 1, y: by, z: bz },
            { x: bx - 1, y: by, z: bz },
            { x: bx, y: by, z: bz + 1 },
            { x: bx, y: by, z: bz - 1 },
            { x: bx, y: by - 1, z: bz }
        ];

        for (const c of candidates) {
            const tx = c.x;
            const ty = c.y;
            const tz = c.z;
            if (ty < 1 || ty > seaLevel) continue;
            if (world.getBlock(tx, ty, tz, false) !== 0) continue;

            const hasAdjacentWater = (
                world.getBlock(tx + 1, ty, tz, false) === waterId ||
                world.getBlock(tx - 1, ty, tz, false) === waterId ||
                world.getBlock(tx, ty, tz + 1, false) === waterId ||
                world.getBlock(tx, ty, tz - 1, false) === waterId ||
                world.getBlock(tx, ty + 1, tz, false) === waterId
            );

            if (hasAdjacentWater) {
                const alreadyQueued = waterFlowQueue.some(item => item.x === tx && item.y === ty && item.z === tz);
                if (!alreadyQueued) {
                    waterFlowQueue.push({ x: tx, y: ty, z: tz, delay: 0.18 });
                }
            }
        }
    }

    function updateWaterFlow(dt) {
        if (!world || waterFlowQueue.length === 0) return;
        const waterId = (window.Blocks && window.Blocks.BLOCKS && window.Blocks.BLOCKS.WATER !== undefined) ? window.Blocks.BLOCKS.WATER : 11;

        for (let i = waterFlowQueue.length - 1; i >= 0; i--) {
            const item = waterFlowQueue[i];
            item.delay -= dt;
            if (item.delay <= 0) {
                waterFlowQueue.splice(i, 1);
                if (waterFlowCount < 48) {
                    if (world.getBlock(item.x, item.y, item.z, false) === 0) {
                        world.setBlock(item.x, item.y, item.z, waterId);
                        waterFlowCount++;
                        updateAffectedChunks(item.x, item.z);
                        checkLavaWaterInteraction(item.x, item.y, item.z);
                        scheduleWaterFlowAround(item.x, item.y, item.z);
                    }
                }
            }
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
        const loadRadius = (window.UI && window.UI.settings && window.UI.settings.renderDistance)
            ? window.UI.settings.renderDistance
            : LOAD_RADIUS;
        const unloadRadius = loadRadius + 2;

        if (scene && scene.fog) {
            scene.fog.density = 0.045 / Math.max(2, loadRadius);
        }

        const pCx = Math.floor(player.position.x / window.World.CHUNK_SIZE_X);
        const pCz = Math.floor(player.position.z / window.World.CHUNK_SIZE_Z);

        // 1. First ensure all chunks in radius exist in memory
        const chunksToMesh = [];
        for (let rx = -loadRadius; rx <= loadRadius; rx++) {
            for (let rz = -loadRadius; rz <= loadRadius; rz++) {
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

        // 3. Unload distant chunks beyond unloadRadius (hysteresis prevents thrashing)
        for (const [key, chunk] of world.chunks.entries()) {
            const dist = Math.max(Math.abs(chunk.chunkX - pCx), Math.abs(chunk.chunkZ - pCz));
            if (dist > unloadRadius) {
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

        // Weather & Lightning atmospheric overrides
        if (weatherState !== 'clear') {
            const stormColor = new THREE.Color(weatherState === 'thunder' ? 0x1b2230 : 0x3b485e);
            scene.background.lerp(stormColor, weatherState === 'thunder' ? 0.72 : 0.48);
            scene.fog.color.copy(scene.background);
            sunLight.intensity *= (weatherState === 'thunder' ? 0.35 : 0.55);
            ambientLight.intensity *= 0.75;
        }
        if (lightningFlashTimer > 0) {
            const flashColor = new THREE.Color(0xddeeff);
            scene.background.lerp(flashColor, 0.8);
            scene.fog.color.copy(scene.background);
            ambientLight.intensity = 1.4;
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
        totalElapsedTime += dt;

        // Animated water & lava textures
        textureAnimTimer += dt;
        if (textureAnimTimer > 0.12) {
            textureAnimTimer = 0;
            if (window.Blocks && typeof window.Blocks.updateAnimatedTextures === 'function' && atlasCanvas && atlasTexture) {
                window.Blocks.updateAnimatedTextures(atlasCanvas, totalElapsedTime);
                atlasTexture.needsUpdate = true;
            }
        }

        // Occasional lava sparks near player
        lavaSparkTimer += dt;
        if (lavaSparkTimer > 0.35 && player && world && window.Blocks && window.Blocks.BLOCKS) {
            lavaSparkTimer = 0;
            const lavaId = window.Blocks.BLOCKS.LAVA || 27;
            const rx = Math.floor(player.position.x + (Math.random() - 0.5) * 14);
            const ry = Math.max(1, Math.floor(player.position.y + (Math.random() - 0.5) * 8));
            const rz = Math.floor(player.position.z + (Math.random() - 0.5) * 14);
            if (world.getBlock(rx, ry, rz) === lavaId) {
                const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
                const mat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xffaa00 : 0xff4400 });
                const pMesh = new THREE.Mesh(geo, mat);
                pMesh.position.set(rx + Math.random(), ry + 1.0, rz + Math.random());
                scene.add(pMesh);
                particles.push({
                    mesh: pMesh,
                    vel: { x: (Math.random() - 0.5) * 2.2, y: 3.5 + Math.random() * 2.5, z: (Math.random() - 0.5) * 2.2 },
                    life: 0.55
                });
            }
        }

        if (!isPaused) {
            player.update(dt);
            updateMining(dt);
            if (audio && typeof audio.updateMusic === 'function') {
                audio.updateMusic(dt);
            }

            // Handle continuous mouse placing
            if (player.isLocked && isMouseDown && activeMouseButton === 2) {
                mouseActionCooldown -= dt;
                if (mouseActionCooldown <= 0) {
                    onPlaceBlock();
                    mouseActionCooldown = PLACE_COOLDOWN;
                }
            }
        }

        updateFallingBlocks(dt);
        updateDroppedItems(dt);
        updateHeldBlock(dt);
        updateClouds(dt);
        updateWeather(dt);
        updatePlayerModel(dt);

        if (mobManager && !isPaused) {
            mobManager.update(dt, player, dayTime, {
                onCreeperExplode: (m) => {
                    explodeTNT({
                        mesh: {
                            position: {
                                x: m.position.x,
                                y: m.position.y + 0.5,
                                z: m.position.z
                            }
                        }
                    });
                },
                onMobKilled: (m) => {
                    if (m.def && m.def.dropBlockId) {
                        spawnItemDrop(Math.floor(m.position.x), Math.floor(m.position.y), Math.floor(m.position.z), m.def.dropBlockId);
                    }
                }
            });
        }

        updateWaterFlow(dt);
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

        window.UI.update(dt, dayTime, weatherState, mobManager ? mobManager.mobs : null);
        renderer.render(scene, camera);
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
