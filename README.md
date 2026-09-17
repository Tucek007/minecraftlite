# Minecraft Lite (3D Voxel Sandbox)

Kompletní, lehký a rychlý klon hry Minecraft běžící v prohlížeči přes WebGL (Three.js) bez nutnosti instalovat těžké nativní knihovny. Všechny textury a zvuky jsou generovány procedurálně za běhu, takže hra funguje 100% offline bez jakýchkoliv externích závislostí.

---

## 🎮 Jak spustit hru

V kořenové složce projektu spusťte:

```bash
npm start
```
nebo přímo přes Node.js:
```bash
node server.js
```

Otevřete prohlížeč na adrese: **[http://localhost:8080/](http://localhost:8080/)**

---

## 🕹 Ovládání (Controls)

| Klávesa / Myš | Akce |
| :--- | :--- |
| **W, A, S, D** | Pohyb hráče (Dopředu, Dozadu, Vlevo, Vpravo) |
| **Pohyb myší** | Rozhlížení (Pointer Lock) |
| **Mezerník (Space)** | Skok / V letovém módu stoupání nahoru |
| **Shift** | Plížení (zpomalení a ochrana před pádem z okraje) / Klesání v letu |
| **F** | Přepnutí mezi módem **Survival** a **Creative Flying** (Létání) |
| **E** | Otevření Creative inventáře všech 20 bloků (přiřazení do hotbaru) |
| **Levé tlačítko myši** | Těžení / Zničení zaměřeného bloku (lze držet pro plynulé těžení) |
| **Pravé tlačítko myši** | Položení vybraného bloku na stěnu / Zapálení položeného TNT |
| **1 – 9 / Kolečko myši** | Výběr aktivního bloku v dolním Hotbaru |
| **F3** | Přepnutí Minecraft Debug obrazovky (FPS, XYZ souřadnice, biom, směr) |
| **Esc** | Odemknutí myši a otevření Pauza menu (Uložení/Načtení/Nový svět) |

---

## 🏗 Klíčové vlastnosti a architektura

1. **Procedurální generování světa (`js/noise.js`, `js/world.js`)**:
   - Využívá víceoktávový Perlin / Fractal Brownian Motion (FBM) šum s nastavitelným semínkem (seed).
   - Dynamické biomy:
     - **Plains**: zvlněné louky s květinami a stromy
     - **Forest**: husté lesy s duby a břízami
     - **Mountains**: vysoké skalnaté hory s vrcholy pokrytými sněhem
     - **Desert**: písečné duny
   - Vrstvy hornin: nezničitelný Bedrock na dně (`y=0`), kámen s rudami (uhlí, železo, zlato, diamanty), hlína/písek a travnatý povrch.
   - 3D jeskyně generované pomocí 3D šumu.
   - Vodní hladina (`Sea Level = 18`) s poloprůhlednou vodou.

2. **Optimalizace vykreslování (Hidden Face Culling)**:
   - Svět je rozdělen do chunků `16x16x64`.
   - Vykreslují se pouze ty stěny krychlí, které sousedí se vzduchem nebo průhledným blokem.
   - Dva samostatné optimalizované buffery: neprůhledné bloky a poloprůhledné bloky (voda/sklo).
   - Vyhlazování a stínování podle orientace stěn (směrový ambient occlusion).

3. **Procedurální Pixel-Art textury (`js/blocks.js`)**:
   - Automaticky generovaný 256x256 Texture Atlas složený z 16x16 pixelových dlaždic vykreslených na HTML5 Canvas.
   - Využívá `THREE.NearestFilter` pro autentický retro pixelovaný vzhled Minecraftu bez rozmazávání.
   - Bloky: Tráva, Hlína, Kámen, Cobblestone, Dřevo, Listí, Prkna, Cihly, Písek, Sklo, Voda, Uhelná ruda, Železná ruda, Zlatá ruda, Diamantová ruda, Bedrock, TNT, Knihovna, Obsidián, Sníh.

4. **Fyzika a kolize (`js/physics.js`, `js/player.js`)**:
   - Voxel raycasting pomocí rychlého 3D DDA algoritmu (Amanatides & Woo Fast Voxel Traversal) pro přesné zaměřování stěn a pokládání bloků.
   - AABB (Axis-Aligned Bounding Box) kolize hráče se světem: zabraňuje propadávání, umožňuje klouzání podél stěn.
   - Autostep a sneak clifftop protection (při plížení hráč nespadne z útesu).
   - Ochrana proti položení bloku do těla hráče.

5. **Procedurální syntezátor zvuku (`js/audio.js`)**:
   - Žádné stahování audio souborů! Využívá nativní **Web Audio API**.
   - Procedurální generování zvuku těžení (crunch/crackle), pokládání bloků (punchy thump), kroků (footsteps), skoků (whoosh) a šplouchnutí vody.

6. **Střídání dne a noci (Day / Night Cycle)**:
   - Pohybující se Slunce a Měsíc na nebeské klenbě.
   - Plynulé přechody barev oblohy (modrý den, oranžový západ slunce, hluboká noční obloha s hvězdami).
   - Noční generátor hvězd.

7. **Ukládání a načítání světa a hráče (Persistence)**:
   - Provedené změny (vytěžené i položené bloky) se ukládají do `localStorage`.
   - Ukládá se také kompletní stav hráče: přesná pozice (XYZ), rotace kamery (yaw/pitch), vybraný slot v hotbaru a denní doba (dayTime).
   - Automatické ukládání při opuštění stránky (`beforeunload`).

8. **Herní mechaniky (TNT, Inventář, Životy)**:
   - **TNT exploze**: Kliknutí pravým tlačítkem na položené TNT spustí odpočet s blikáním, syčením a explozí s rázovou vlnou, která odmrští hráče a zničí bloky v okruhu (kromě Bedrocku a Obsidiánu).
   - **Creative inventář (`E`)**: Kompletní přehled všech 20 typů bloků s možností přiřazení do kteréhokoliv slotu hotbaru.
   - **Životy a poškození pádem**: Funkční indikátor 10 srdíček (20 HP), poškození při pádu z výšky nad 3 bloky se zvukem zranění a bezpečný respawn na povrchu.

---

## 🧪 Automatizované testy

Projekt obsahuje sadu 52 jednotkových a integračních testů běžících přímo v Node.js:

```bash
npm test
```

Testované oblasti:
- Deterministický výpočet Perlinova šumu a deterministické koruny stromů.
- Správnost registru všech 20 bloků, textury a UV mapování.
- Sdílené GPU materiály (Shared Materials) eliminující rekompilaci shaderů.
- Detekce AABB kolizí, DDA raycasting bez chyb s nulovými vektory a ochrana před pádem ze srázu (sneak).
- Životy, výpočet poškození z pádu, respawn na pevném povrchu a ochrana před smrtící smyčkou ve voidu.
- Mechanika výbuchu TNT a odolnost materiálů.
- Práce se souřadnicemi chunků, generování na vyžádání a kompletní serializace světa i hráče.
