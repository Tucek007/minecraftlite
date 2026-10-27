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
| **Pohyb myší** | Rozhlížení z pohledu kamery (Pointer Lock) |
| **Mezerník (Space)** | Skok / V letovém módu stoupání nahoru / Ve vodě plavání nahoru |
| **2x Mezerník (Double-Jump)** | Rychlé přepnutí letového módu (Creative Flying ON/OFF) |
| **Shift** | Plížení (zpomalení a ochrana před pádem z okraje) / Klesání v letovém módu |
| **Ctrl** | Sprint (zrychlený běh s dynamickým rozšířením zorného pole FOV) |
| **G** | **Přepínání herních režimů**: Survival ➔ Klidný (Peaceful) ➔ Kreativní (Creative) |
| **F** | Přepnutí mezi módem **Survival** a **Creative Flying** (Létání) |
| **F5** | **Přepínání pohledu kamery**: 1. osoba ➔ 3. osoba zezadu ➔ 3. osoba zepředu (3D model Steva) |
| **E** | **Inventář a Crafting**: Otevření inventáře všech 30 bloků a výrobního stolu |
| **Levé tlačítko myši** | **Boj / Těžení**: Útok na zaměřeného moba (dosah 4 bloky) / Progresivní těžení se zobrazením 3D prasklin (v Survivalu) / Okamžité ničení bloků (v Creative módu) |
| **Pravé tlačítko myši** | **Položení / Interakce**: Položení vybraného bloku na stěnu / Otevření Crafting Table / Zapálení položeného TNT |
| **Stisknutí kolečka myši (Middle Click)** | **Pick Block**: Okamžitý výběr zaměřeného bloku ze světa do aktivního slotu hotbaru |
| **1 – 9 / Kolečko myši** | Výběr aktivního slotu v dolním Hotbaru |
| **F3** | Přepnutí Minecraft Debug obrazovky (FPS, XYZ souřadnice, chunk, biom, rotace) |
| **Esc** | Odemknutí myši a otevření Pauza menu (Uložení/Načtení/Nový svět, Nastavení FOV, Citlivosti a Render Distance) |

---

## 🏗 Klíčové vlastnosti a architektura

### 1. Herní režimy (Game Modes - klávesa `G`)
- **Survival (Přežití)**:
  - Plnohodnotný zážitek s těžením závisejícím na tvrdosti bloku, zdravím (10 srdíček), kyslíkem při potápění (10 bublin), zraněním od monster, pádů, kaktusů a lávy.
  - Výroba předmětů v craftingu vyžaduje skutečné suroviny nasbírané ve světě.
- **Klidný (Peaceful / Bez boje & volný crafting)**:
  - Nepřátelští mobové se nespawnují (nebo okamžitě zmizí).
  - Zdraví a kyslík se automaticky doplňují na maximum.
  - V craftingu lze vyrábět všechny recepty zdarma bez spotřeby surovin.
- **Kreativní (Creative)**:
  - Okamžité ničení bloků jedním kliknutím.
  - Neomezený volný crafting a možnost volně létat po světě.
  - Hráč je imunní vůči všem formám zranění.

### 2. Třetí osoba a 3D model hráče ("Steve" - klávesa `F5`)
- Stisknutím **F5** lze plynule přepínat mezi:
  1. Pohled z první osoby (klasický pohled očima hráče s 3D drženým blokem v ruce)
  2. Pohled ze třetí osoby zezadu s inteligentní kamerou, která detekuje kolize se stěnami
  3. Pohled ze třetí osoby zepředu (selfie kamera)
- **Kompletní 3D model postavy Steva**:
  - Hlava s vlasy, trup s tyrkysovým tričkem, modré kalhoty, paže a nohy.
  - Plynulá animace končetin při chůzi (limb swing) synchronizovaná s rychlostí pohybu.
  - Dynamické švihnutí pravé paže při úderu nebo těžení.
  - Naklánění hlavy nahoru a dolů přesně podle úhlu pohledu hráče (`pitch`).

### 3. Ekosystém mobů a bojový systém (`js/mobs.js`)
- **Pasivní zvířata**:
  - **Prase (Pig)**: pobíhá po loukách a lesích, při zasažení zpanikaří a utíká.
  - **Ovce (Sheep)**: mírumilovné zvíře s vlnou, generuje se na travnatém povrchu.
- **Nepřátelská monstra**:
  - **Zombie**: v noci vyhledává hráče v okruhu 15 bloků a útočí zblízka.
  - **Creeper**: tichý predátor. Jakmile se přiblíží k hráči na méně než 2.8 bloku, začne syčet, nafukovat se a po uplynutí zápalné doby detonuje se silou TNT!
- **Bojová mechanika (Melee Combat)**:
  - Kliknutí levým tlačítkem na moba v dosahu 4 bloků provede úder se zraněním a zpětným rázem (knockback).
  - Procedurální zvuk zásahu pro každý typ moba (`playMobHurt`).
  - Při usmrcení moba vznikne kouřový efekt a vypadne surovina jako 3D rotující drop (např. TNT z creepera, vlna z ovce).

### 4. Gravitace sypkých bloků (Falling Sand & Gravel)
- Bloky **Písek (Sand)** a **Štěrk (Gravel)** reagují na zemskou přitažlivost.
- Pokud se pod blokem písku nebo štěrku nachází vzduch nebo voda, blok se uvolní, promění se v plynule padající 3D fyzikální entitu s realistickým zrychlením a po dopadu na pevnou zem se opět usadí jako pevný blok.
- Gravitace funguje i kaskádovitě pro celé sloupce písku a štěrku (např. při odpálení dutiny pod dunou).

### 5. Interakce lávy a vody (Lava + Water ➔ Obsidian)
- Žhavá **Láva (Lava)** je nebezpečná tekutina způsobující vysoké kontaktní poškození a vyzařující světlo (`lightLevel = 15`).
- Při kontaktu proudící vody s blokem lávy dojde k okamžitému zchlazení – blok lávy ztuhne v nezničitelný **Obsidián (Obsidian)** za doprovodu syčení a hustého kouře.

### 6. 3D Dropped Items (Vypadlé předměty a magnetické sbírání)
- Zničené bloky ve světě nevytvářejí pouhé vizuální částice, ale spawnují skutečné **3D rotující předměty** odpovídající danému typu bloku.
- Předměty mají fyziku dopadu na terén a vznášejí se s autentickým pohupováním nahoru a dolů.
- Když se hráč přiblíží na vzdálenost menší než 2.2 bloku, předmět je magneticky přitažen k hráči.
- Ve vzdálenosti pod 1.1 bloku hráč předmět sebere, přehraje se zvuk sebrání (`playPickup`) a surovina se přičte do inventáře pro další crafting.

### 7. Dynamické 3D mraky (Volumetric Clouds)
- Oblohu ve výšce `y = 56` brázdí procedurální bloková pole polo-průhledných bílých mraků.
- Mraky se plynule pohybují s větrem podél osy X a inteligentně se obalují kolem pozice hráče, takže vytvářejí dojem nekonečné živé oblohy.

### 8. Kompletní systém Craftingu a Crafting Table
- Otevřením inventáře klávesou **E** nebo **kliknutím pravým tlačítkem myši na blok Crafting Table** ve světě se otevře přehledná výrobní nabídka.
- **Dostupné recepty**:
  - Dřevěná prkna (1x Dřevo ➔ 4x Prkna)
  - Kámen (4x Cobblestone ➔ 4x Kámen)
  - Cihly (2x Hlína + 2x Kámen ➔ 4x Cihly)
  - Sklo (2x Písek ➔ 2x Sklo)
  - Knihovna (3x Prkna ➔ 1x Knihovna)
  - TNT (2x Písek + 2x Uhelná ruda ➔ 1x TNT)
  - Glowstone (1x Zlatá ruda + 1x Sklo ➔ 1x Glowstone)
  - Zarostlý kámen (2x Cobblestone + 2x Listí ➔ 2x Mossy Cobblestone)
  - Jack o'Lantern (1x Dýně + 1x Glowstone ➔ 1x Jack o'Lantern)
- V režimu Survival se kontrolují skutečně nasbírané suroviny; v Klidném a Kreativním režimu lze craftit volně bez omezení.

### 9. Registr všech 30 typů bloků (`js/blocks.js`)
1. **Grass Block** (Travnatý blok s biomovým zabarvením)
2. **Dirt** (Hlína)
3. **Stone** (Hladký kámen)
4. **Cobblestone** (Dlažební kostky)
5. **Oak Wood Log** (Dubové dřevo s letokruhy)
6. **Oak Leaves** (Dubové listí s poloprůhledností)
7. **Wooden Planks** (Dřevěná prkna)
8. **Bricks** (Pálené cihly)
9. **Sand** (Písek s gravitací)
10. **Glass** (Průhledné sklo)
11. **Water** (Tekoucí voda s průhledností a plaváním)
12. **Coal Ore** (Uhelná ruda)
13. **Iron Ore** (Železná ruda)
14. **Bedrock** (Nezničitelné podloží)
15. **TNT** (Zápalná výbušnina)
16. **Bookshelf** (Knihovna plná knih)
17. **Obsidian** (Extrémně tvrdý černofialový vulkanický kámen)
18. **Gold Ore** (Zlatá ruda)
19. **Diamond Ore** (Diamantová ruda)
20. **Snow Block** (Sněhový blok z horských vrcholů)
21. **Glowstone** (Svítící kámen, vyzařuje světlo)
22. **Mossy Cobblestone** (Mechem obrostlý kámen z lesů)
23. **Cactus** (Pouštní kaktus s kontaktním zraněním)
24. **Pumpkin** (Dýně s vyřezaným obličejem)
25. **Gravel** (Štěrk s gravitací)
26. **Crafting Table** (Pracovní stůl s nářadím pro výrobu)
27. **Jack o'Lantern** (Rozsvícená dýně vyzařující světlo)
28. **Birch Wood Log** (Bříza s charakteristickou bílo-černou kůrou)
29. **Birch Leaves** (Březové listí se světlým odstínem)
30. **Lava** (Žhavá tekoucí láva s poškozením a světlem)

### 10. Kyslík, potápění a zranění (`js/player.js`, `js/ui.js`)
- Při ponoření hlavy pod hladinu vody se zobrazí 10 bublin kyslíku.
- Kyslík postupně ubývá (15 sekund ponoru). Po vyčerpání začne hráč utonutím ztrácet 2 body zdraví za sekundu.
- Při vynoření se bubliny doplňují a po 4 sekundách bez zranění se zdraví regeneruje.
- Kaktusy i láva udělují kontaktní poškození při dotyku.

### 11. Perzistence (Ukládání a načítání světa i hráče)
- Tlačítko **Save World** i zavření okna prohlížeče automaticky ukládá:
  - Všechny provedené úpravy voxelového světa a seed.
  - Pozici, rotaci kamery a aktivní slot hráče.
  - Sestavu hotbaru i přesné počty nasbíraných surovin v inventáři.
  - Aktuální zdraví, zásobu kyslíku, herní režim a fázi dne/noci.

---

## 🧪 Automatizované testy

Projekt obsahuje sadu jednotkových a integračních testů běžících v Node.js:

```bash
npm test
```

Testované oblasti:
- Deterministický výpočet Perlinova šumu a procedurálních biomů.
- Registr všech 30 bloků, tvrdost, odolnost, gravitace, světelné úrovně a UV mapování včetně fází prasklin (CRACK_0..9).
- AABB kolize, DDA raycasting, plížení, skoky a plavání.
- Zdraví, kyslík, regenerace, kontaktní poškození a pád z výšky.
- Výbuch TNT, tlaková vlna, knockback a gravitace sypkých bloků.
- Mob AI logika, kolize mobů, poškození a bojový raycast.
- Inventář, crafting recepty a perzistence do localStorage.
