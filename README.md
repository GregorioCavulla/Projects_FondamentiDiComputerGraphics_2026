# Projects · Fondamenti di Computer Graphics 2025/2026

Repository dei progetti del corso di **Fondamenti di Computer Graphics** (A.A. 2025/2026), suddivisi in due moduli.

> 🌐 [**Versione online:**](https://gregoriocavulla.github.io/Projects_FondamentiDiComputerGraphics_2026/)
## 📂 Struttura

```
.
├── index.html              · Hub di selezione modulo (landing page tema cyberspazio)
├── .nojekyll               · Disabilita Jekyll su GitHub Pages
├── Modulo1/
│   ├── Labs/               · Esercizi di laboratorio
│   ├── Resources/          · Materiali del docente
│   └── Progetto/
│       ├── doc/index.html  · Relazione tecnica del progetto
│       └── project/        · Codice sorgente WebGL del progetto
└── Modulo2/
    ├── Labs/
    ├── Resources/
    └── Progetto/           · (in sviluppo)
```

## 🟢 Modulo 1 — Porygon Cyberspace

Scena interattiva in **WebGL 1** ispirata al cyberspazio di *Pokémon*: una stanza-griglia stile *TRON* in cui Porygon viene assemblato a partire dai suoi pezzi sparsi sul pavimento, eseguito in animazioni di "personalità", e infine evoluto in **Porygon2** caricato da file `.obj`.

**Highlights tecnici:**
- Modello Porygon1 costruito da **6 mesh poliedriche** hardcoded (vertici + facce) con generazione runtime di normali flat ed edge list per il wireframe
- **Macchina a stati** (`INIT → ASSEMBLING → PORYGON1 → EVOLVE_P1/P2 → PORYGON2`) e tre modalità di visualizzazione (`MESH`, `SOLID`, `TEXTURE`)
- **Tre programmi GLSL** convivono nello stesso shader pipeline (grid, color con luce direzionale, texture con alpha discard)
- **Animazione di assemblaggio** con interpolazione delle parti e cilindro di beam animato (96 raggi verticali + 6 anelli scorrevoli)
- **Animazioni articolate** (`atk1` saltello, `atk2` posa d'attacco) con rotazioni attorno a pivot calcolati automaticamente dalla bbox di ogni gruppo
- Texture procedurale per gli occhi generata su `<canvas>`, caricamento OBJ+MTL per Porygon2
- Camera orbitale con inerzia, controlli da tastiera, GUI `dat.GUI`

📄 **Documentazione completa:** [Modulo1/Progetto/doc/index.html](Modulo1/Progetto/doc/index.html)
🚀 **Demo:** [Modulo1/Progetto/project/index.html](Modulo1/Progetto/project/index.html)

## 🔵 Modulo 2

*In sviluppo.*

## 🛠️ Come eseguire in locale

WebGL ha bisogno di essere servito via HTTP per caricare assets, texture e file `.obj`. Dalla root del repo:

```bash
python3 -m http.server 8080
# poi apri http://localhost:8080/
```

Da lì, la hub permette di entrare nei singoli progetti.

## 📚 Librerie utilizzate (Modulo 1)

Solo librerie consentite dal corso, tutte locali in `Modulo1/Progetto/project/lib/`:

| Libreria | Ruolo |
|---|---|
| `m4.js` | Algebra di matrici 4×4 column-major |
| `mesh_utils.js` | Parsing di file OBJ/MTL |
| `webgl-utils.js` | Compilazione e linking di programmi GLSL |
| `dat.gui.js` | Pannello di controllo runtime |

La telecamera è gestita interamente con eventi nativi del canvas, senza ricorrere a librerie di trackball esterne.

## 🎮 Controlli rapidi (Modulo 1)

| Input | Azione |
|---|---|
| `STARTUP` (HUD) | Avvia l'assemblaggio di Porygon |
| `MESH` / `SOLID` (HUD) | Cambia modalità di visualizzazione |
| `EVOLUZIONE!` (HUD) | Innesca l'evoluzione → Porygon2 (TEXTURE) |
| `1` / `2` | Anim 1 (saltello) · Anim 2 (posa d'attacco) |
| `N` | Toggle overlay numerazione facce |
| Mouse drag | Rotazione orbitale (con inerzia) |
| `← → ↑ ↓` | Traslazione camera in XZ |
| `Space` / `Shift` | Camera su / giù |
