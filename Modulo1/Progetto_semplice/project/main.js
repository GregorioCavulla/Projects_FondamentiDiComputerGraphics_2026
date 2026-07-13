"use strict";

// =====================================================================
//  PORYGON - Progetto Modulo 1  (SCHELETRO)
// ---------------------------------------------------------------------
//  Flusso previsto (macchina a stati):
//    1. DISASSEMBLED : i pezzi di Porygon1 sono smontati/sparsi
//    2. ASSEMBLING   : animazione di assemblaggio dei pezzi
//    3. IDLE         : Porygon1 assemblato (+ eventuali animazioni)
//    4. EVOLVING     : animazione di evoluzione Porygon1 -> Porygon2
//    5. PORYGON2     : forma finale Porygon2
//
//  Ogni fase ha una funzione update*() e draw*() da riempire man mano.
// =====================================================================


// ---------------------------------------------------------------------
//  Variabili globali
// ---------------------------------------------------------------------
let gl;

// Programmi shader (compilati in main)
let colorProgram;   // Porygon1 - colore solido con luce
let textureProgram; // Porygon2 - texture con luce
let gridProgram;    // sfondo - colore piatto

// Mesh caricate (liste di "renderable": buffer + info per il disegno)
let renderablesPorygon1 = [];
let renderablesPorygon2 = [];

// Macchina a stati
const STATE = Object.freeze({
    DISASSEMBLED: 'DISASSEMBLED',
    ASSEMBLING:   'ASSEMBLING',
    IDLE:         'IDLE',
    EVOLVING:     'EVOLVING',
    PORYGON2:     'PORYGON2'
});
let gameState = STATE.DISASSEMBLED;

// Modalità di visualizzazione: solido (facce piene) o wireframe (solo spigoli).
const VIEW = Object.freeze({ SOLID: 'SOLID', WIREFRAME: 'WIREFRAME' });
let viewMode = VIEW.SOLID;

// Sfondo: nero pieno oppure skybox (cubemap).
const BG = Object.freeze({ BLACK: 'BLACK', SKYBOX: 'SKYBOX' });
let bgMode = BG.BLACK;

// Animazioni di "personalità" di Porygon1.
let groupPivots = {};   // punto di articolazione per gruppo (pivot delle rotazioni)
let currentAnim = null; // { kind, startTime, duration } oppure null se nessuna

// Direzione della luce, definita in SPAZIO CAMERA (punta verso la luce):
// dall'alto a sinistra dello schermo. Restando ancorata alla camera, la luce
// non si sposta quando si orbita il modello (come lo sfondo, fisso a schermo).
const LIGHT_DIR = [-0.6, 0.7, 0.5];

// Tempi per le animazioni (ms)
const ASSEMBLE_DURATION = 3000;
const EVOLVE_DURATION   = 2000;
let phaseStartTime = 0; // istante in cui è iniziata la fase animata corrente

// Riferimenti ai bottoni HUD
let btnStart, btnEvolve;


// ---------------------------------------------------------------------
//  main() - punto di ingresso (chiamato da onload nel body)
// ---------------------------------------------------------------------
async function main() {
    const canvas = document.getElementById("webgl-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) { alert("WebGL non supportato!"); return; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    window.addEventListener('resize', resizeCanvas);

    // Compilazione dei programmi shader definiti in index.html
    colorProgram   = webglUtils.createProgramFromScripts(gl, ["color-vertex-shader", "color-fragment-shader"]);
    textureProgram = webglUtils.createProgramFromScripts(gl, ["vertex-shader", "fragment-shader"]);
    gridProgram    = webglUtils.createProgramFromScripts(gl, ["grid-vertex-shader", "grid-fragment-shader"]);

    gl.enable(gl.DEPTH_TEST);
    // LEQUAL: gli occhi sono complanari alla superficie della testa; disegnati
    // DOPO la testa, con LEQUAL vincono lo z-test invece di sparire (z uguale).
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Collego il controllo camera (orbita col mouse, zoom con la rotellina).
    setupCamera(canvas);
    setupHUD();
    setupSkybox();

    // Click su Porygon (click "secco", non trascinamento) -> animazione.
    let downPos = null;
    canvas.addEventListener('mousedown', (e) => {
        downPos = { x: e.offsetX, y: e.offsetY };
    });
    canvas.addEventListener('mouseup', (e) => {
        if (!downPos) return;
        const moved = Math.hypot(e.offsetX - downPos.x, e.offsetY - downPos.y);
        downPos = null;
        // Se il mouse si è spostato molto era un'orbita, non un click.
        if (moved > 6) return;
        if (gameState === STATE.IDLE) triggerAnim();
    });

    // FASE 1: costruzione di Porygon1 da geometria hard-coded (parti nominate).
    buildPorygon1();

    // Calcolo le posizioni "smontate" (esplose) iniziali dei pezzi.
    initDisassembly();

    setGameState(STATE.DISASSEMBLED);
    requestAnimationFrame(render);

    // Carico Porygon2 in background dall'.obj (serve un server locale; fallisce
    // in modo silenzioso su file://, senza bloccare l'avvio dell'app).
    loadPorygon2();
}


// ---------------------------------------------------------------------
//  Utility di base
// ---------------------------------------------------------------------
function resizeCanvas() {
    const canvas = gl.canvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

function updateDialog(text) {
    document.getElementById("dialog-box").innerHTML = text;
}

// Cambio di stato centralizzato: aggiorna dialog, bottoni e timer di fase.
function setGameState(s) {
    gameState = s;
    phaseStartTime = performance.now();
    applyHUDForState(s);
}



// ---------------------------------------------------------------------
//  HUD (pulsanti di avanzamento del flusso)
// ---------------------------------------------------------------------
function setupHUD() {
    btnStart  = document.getElementById("btn-start");
    btnEvolve = document.getElementById("btn-evolve");

    // AVVIA: passa da pezzi smontati all'animazione di assemblaggio
    btnStart.addEventListener('click', () => {
        if (gameState === STATE.DISASSEMBLED) setGameState(STATE.ASSEMBLING);
    });

    // EVOLVI: passa da Porygon1 idle all'animazione di evoluzione
    btnEvolve.addEventListener('click', () => {
        if (gameState !== STATE.IDLE) return;
        currentAnim = null; // interrompo un eventuale saltello in corso
        setGameState(STATE.EVOLVING);
    });

    // WIREFRAME: alterna vista solida / a fil di ferro (sempre disponibile).
    const btnWire = document.getElementById("btn-wire");
    btnWire.addEventListener('click', () => {
        viewMode = (viewMode === VIEW.SOLID) ? VIEW.WIREFRAME : VIEW.SOLID;
        btnWire.textContent = (viewMode === VIEW.WIREFRAME) ? "SOLIDO" : "WIREFRAME";
    });

    // SFONDO: alterna nero pieno / skybox.
    const btnBg = document.getElementById("btn-bg");
    btnBg.addEventListener('click', () => {
        bgMode = (bgMode === BG.BLACK) ? BG.SKYBOX : BG.BLACK;
        btnBg.textContent = (bgMode === BG.SKYBOX) ? "NERO" : "SFONDO";
    });
}

// Mostra/nasconde i bottoni e aggiorna il testo in base allo stato.
function applyHUDForState(state) {
    switch (state) {
        case STATE.DISASSEMBLED:
            updateDialog("Premi AVVIA per assemblare Porygon.");
            btnStart.classList.remove("hidden");
            btnEvolve.classList.add("hidden");
            break;
        case STATE.ASSEMBLING:
            updateDialog("Assemblaggio in corso...");
            btnStart.classList.add("hidden");
            btnEvolve.classList.add("hidden");
            break;
        case STATE.IDLE:
            updateDialog("Porygon1 pronto. Clicca su Porygon per animarlo, EVOLVI per evolvere.");
            btnStart.classList.add("hidden");
            btnEvolve.classList.remove("hidden");
            break;
        case STATE.EVOLVING:
            updateDialog("Evoluzione in corso...");
            btnStart.classList.add("hidden");
            btnEvolve.classList.add("hidden");
            break;
        case STATE.PORYGON2:
            updateDialog("Porygon2!");
            btnStart.classList.add("hidden");
            btnEvolve.classList.add("hidden");
            break;
    }
}


// ---------------------------------------------------------------------
//  FASE 1 - Costruzione di Porygon1 (geometria hard-coded)
// ---------------------------------------------------------------------
//  A differenza di Porygon2 (che verrà caricato da file .obj), Porygon1 è
//  costruito direttamente da vertici scritti nel codice, divisi in PARTI
//  nominate: corpo, testa (con becco), occhi, zampa dx/sx, coda.
//
//  Perché hard-coded e diviso in parti?
//   - Colori accurati: ogni parte ha il suo colore (rosa/ciano/bianco)
//     senza dover indovinare dai materiali dell'.obj (tutti grigi).
//   - Assemblaggio: le parti si possono muovere singolarmente.
//   - Occhi legati alla testa: mettendoli nel gruppo 'head' si assemblano
//     e si muovono SEMPRE insieme alla testa (mai come pezzo staccato).
//
//  I vertici sono coordinate assolute (rispetto al centro del modello),
//  estratte una volta dal file Porygon.obj e normalizzate nel cubo [-1,1].
//
//  NB: i DATI (vertici e facce di ogni parte) stanno nel file separato
//      porygon1_data.js (caricato prima di main.js in index.html), così
//      qui resta solo la LOGICA. Le costanti P1_*_VERTS / P1_*_FACES sono
//      globali e vengono usate direttamente da buildPorygon1().
// ---------------------------------------------------------------------

// Costruisce i buffer WebGL di una parte a partire da vertici + facce.
// Calcola le normali di faccia (flat shading) e, se forniti, i texcoord.
// Ritorna anche il centroide (media delle posizioni) usato per l'esplosione.
function buildPolyhedron(verts, faces, vertUVs = null) {
    const positions = [];
    const normals   = [];
    const texcoords = vertUVs ? [] : null;
    let cx = 0, cy = 0, cz = 0;

    // Insieme degli spigoli unici (per la vista wireframe). La chiave ordinata
    // "a_b" evita di ripetere lo stesso spigolo condiviso tra due triangoli.
    const edgeSet = new Set();
    const addEdge = (a, b) => edgeSet.add(a < b ? a + '_' + b : b + '_' + a);

    for (const f of faces) {
        const p0 = verts[f[0]], p1 = verts[f[1]], p2 = verts[f[2]];
        positions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
        cx += p0[0] + p1[0] + p2[0];
        cy += p0[1] + p1[1] + p2[1];
        cz += p0[2] + p1[2] + p2[2];

        // I tre lati del triangolo diventano spigoli del wireframe.
        addEdge(f[0], f[1]); addEdge(f[1], f[2]); addEdge(f[2], f[0]);

        if (texcoords) {
            const u0 = vertUVs[f[0]], u1 = vertUVs[f[1]], u2 = vertUVs[f[2]];
            texcoords.push(u0[0], u0[1], u1[0], u1[1], u2[0], u2[1]);
        }

        // Normale della faccia = prodotto vettoriale di due lati, normalizzato.
        const ux = p1[0]-p0[0], uy = p1[1]-p0[1], uz = p1[2]-p0[2];
        const vx = p2[0]-p0[0], vy = p2[1]-p0[1], vz = p2[2]-p0[2];
        let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        normals.push(nx,ny,nz, nx,ny,nz, nx,ny,nz);
    }

    const numVertices = positions.length / 3;
    const centroid = [cx / numVertices, cy / numVertices, cz / numVertices];

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    let texcoordBuffer = null;
    if (texcoords) {
        texcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);
    }

    // Buffer degli spigoli: per ogni spigolo unico due vertici (una linea).
    const linePositions = [];
    for (const key of edgeSet) {
        const [a, b] = key.split('_').map(Number);
        linePositions.push(verts[a][0], verts[a][1], verts[a][2],
                           verts[b][0], verts[b][1], verts[b][2]);
    }
    const lineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(linePositions), gl.STATIC_DRAW);

    return {
        positionBuffer, normalBuffer, texcoordBuffer, numVertices, centroid,
        lineBuffer, numLineVertices: linePositions.length / 3
    };
}

// Divide le facce in "front"/"back" secondo un predicato sul centroide della
// faccia. Serve per colorare in ciano solo alcune zone (becco, petto).
function splitFacesByPredicate(verts, faces, predicate) {
    const front = [], back = [];
    for (const f of faces) {
        const cx = (verts[f[0]][0] + verts[f[1]][0] + verts[f[2]][0]) / 3;
        const cy = (verts[f[0]][1] + verts[f[1]][1] + verts[f[2]][1]) / 3;
        const cz = (verts[f[0]][2] + verts[f[1]][2] + verts[f[2]][2]) / 3;
        if (predicate(cx, cy, cz)) front.push(f);
        else back.push(f);
    }
    return { front, back };
}

// Texture procedurale per gli occhi: sfondo bianco con un pallino nero al
// centro. La disegno su un <canvas> 2D e la carico come texture WebGL.
function createEyeTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f8f8f8';               // bianco (sclera)
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#0a0a12';               // nero (pupilla)
    ctx.beginPath();
    ctx.arc(64, 64, 14, 0, Math.PI * 2);     // cerchio al centro
    ctx.fill();

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
}

// Calcola le UV degli occhi: proietto ogni occhio (cluster di 6 vertici) sul
// piano YZ e lo normalizzo nel suo bounding box, così il centro del cluster
// cade a UV (0.5, 0.5) -> dove sta il pallino nero della texture.
function computeEyeUVs(verts) {
    const uvs = new Array(verts.length);
    const pad = 1.35; // margine: rimpicciolisce un po' il pallino sull'occhio
    for (let cluster = 0; cluster < 2; cluster++) {
        const start = cluster * 6;
        let ymin = Infinity, ymax = -Infinity, zmin = Infinity, zmax = -Infinity;
        for (let i = 0; i < 6; i++) {
            const v = verts[start + i];
            ymin = Math.min(ymin, v[1]); ymax = Math.max(ymax, v[1]);
            zmin = Math.min(zmin, v[2]); zmax = Math.max(zmax, v[2]);
        }
        const ymid = (ymin + ymax) / 2, ywid = (ymax - ymin) || 1;
        const zmid = (zmin + zmax) / 2, zwid = (zmax - zmin) || 1;
        for (let i = 0; i < 6; i++) {
            const v = verts[start + i];
            uvs[start + i] = [
                0.5 + (v[1] - ymid) / (ywid * pad),
                0.5 + (v[2] - zmid) / (zwid * pad)
            ];
        }
    }
    return uvs;
}

// Assembla Porygon1 dalle sue parti, ciascuna con colore e gruppo.
function buildPorygon1() {
    renderablesPorygon1 = [];

    // Colori canonici di Porygon (dal progetto originale).
    const PINK  = [0.93, 0.55, 0.65, 1.0];
    const CYAN  = [0.38, 0.78, 0.83, 1.0];
    const WHITE = [0.98, 0.98, 0.98, 1.0];

    // Becco = la PUNTA della testa: molto avanti (z alto) e in basso (y basso).
    // Il vincolo su y evita di colorare anche le facce alte del muso (occhi/fronte).
    const headSplit = splitFacesByPredicate(P1_HEAD_VERTS, P1_HEAD_FACES,
        (cx, cy, cz) => cz >= 0.65 && cy <= 0.25);
    // Petto = zona CENTRALE-bassa davanti: avanti (z alto), in basso (y negativo)
    // e vicino al centro (|x| piccolo), così non tinge anche i fianchi/spalle.
    const bodySplit = splitFacesByPredicate(P1_BODY_VERTS, P1_BODY_FACES,
        (cx, cy, cz) => cz >= 0.35 && cy <= -0.05 && Math.abs(cx) <= 0.20);

    // Occhi: texture procedurale (bianco + pallino nero) e relative UV.
    const eyeTex = createEyeTexture();
    const eyeUVs = computeEyeUVs(P1_EYES_VERTS);

    // Elenco delle parti. Il campo "group" serve all'assemblaggio: tutte le
    // parti dello stesso gruppo si muovono INSIEME. Gli occhi sono nel gruppo
    // 'head' -> restano SEMPRE attaccati alla testa.
    const parts = [
        { verts: P1_BODY_VERTS,   faces: bodySplit.back,  color: PINK,  group: 'body' },
        { verts: P1_BODY_VERTS,   faces: bodySplit.front, color: CYAN,  group: 'body' },  // petto
        { verts: P1_HEAD_VERTS,   faces: headSplit.back,  color: PINK,  group: 'head' },
        { verts: P1_HEAD_VERTS,   faces: headSplit.front, color: CYAN,  group: 'head' },  // becco
        { verts: P1_EYES_VERTS,   faces: P1_EYES_FACES,   color: WHITE, group: 'head', texture: eyeTex, vertUVs: eyeUVs }, // occhi
        { verts: P1_FOOT_R_VERTS, faces: P1_FOOT_R_FACES, color: CYAN,  group: 'footR' },
        { verts: P1_FOOT_L_VERTS, faces: P1_FOOT_L_FACES, color: CYAN,  group: 'footL' },
        { verts: P1_TAIL_VERTS,   faces: P1_TAIL_FACES,   color: CYAN,  group: 'tail' },
    ];

    for (const p of parts) {
        const geom = buildPolyhedron(p.verts, p.faces, p.vertUVs || null);
        renderablesPorygon1.push({
            positionBuffer: geom.positionBuffer,
            normalBuffer:   geom.normalBuffer,
            texcoordBuffer: geom.texcoordBuffer,
            numVertices:    geom.numVertices,
            lineBuffer:     geom.lineBuffer,
            numLineVertices: geom.numLineVertices,
            centroid:       geom.centroid,
            color:          p.color,
            texture:        p.texture || null,
            group:          p.group,
            offset:      [0, 0, 0], // spostamento corrente (0 = in posizione)
            startOffset: [0, 0, 0]  // spostamento da "smontato" (calcolato dopo)
        });
    }

    // Pivot di articolazione per gruppo (testa, coda, zampe): servono alle
    // animazioni di personalità per ruotare ogni parte attorno al suo "attacco".
    computeGroupPivots(parts);

    console.log(`Porygon1 costruito: ${renderablesPorygon1.length} parti.`);
}

// Calcola il punto di articolazione (pivot) di ogni gruppo dal bounding box
// delle sue parti: la testa ruota dalla base, la coda dalla giuntura col
// corpo, le zampe dall'anca.
function computeGroupPivots(parts) {
    function bboxOf(name) {
        let mn = [ Infinity,  Infinity,  Infinity];
        let mx = [-Infinity, -Infinity, -Infinity];
        for (const p of parts) {
            if (p.group !== name) continue;
            for (const v of p.verts) {
                for (let i = 0; i < 3; i++) {
                    if (v[i] < mn[i]) mn[i] = v[i];
                    if (v[i] > mx[i]) mx[i] = v[i];
                }
            }
        }
        return { mn, mx };
    }
    const h = bboxOf('head'), t = bboxOf('tail');
    const fR = bboxOf('footR'), fL = bboxOf('footL');
    groupPivots = {
        head:  [ (h.mn[0]+h.mx[0])*0.5, h.mn[1], (h.mn[2]+h.mx[2])*0.5 ],   // base testa
        tail:  [ (t.mn[0]+t.mx[0])*0.5, (t.mn[1]+t.mx[1])*0.5, t.mx[2] ],    // giuntura coda
        footR: [ (fR.mn[0]+fR.mx[0])*0.5, fR.mx[1], (fR.mn[2]+fR.mx[2])*0.5 ], // anca dx
        footL: [ (fL.mn[0]+fL.mx[0])*0.5, fL.mx[1], (fL.mn[2]+fL.mx[2])*0.5 ], // anca sx
        body:  [0, 0, 0],
    };
}


// ---------------------------------------------------------------------
//  Caricamento di Porygon2 (da file .obj + texture)
// ---------------------------------------------------------------------
//  A differenza di Porygon1 (hard-coded), Porygon2 viene letto dal file
//  assets/Porygon2/Porygon2.obj con il suo materiale e le sue texture.
//  NB: richiede un server locale (il fetch dell'.obj non funziona da file://).

// Carica un'immagine come texture WebGL (con pixel segnaposto nel frattempo).
function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
        gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 255, 255]));

    const image = new Image();
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        const isPOT = (v) => (v & (v - 1)) === 0;
        if (isPOT(image.width) && isPOT(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    image.onerror = () => console.warn("Texture mancante:", url);
    image.src = url;
    return texture;
}

async function loadPorygon2() {
    const basePath = "assets/Porygon2/";
    try {
        // 1) Leggo e parso l'.obj (vertici, facce, coordinate texture).
        let response = await fetch(basePath + "Porygon2.obj");
        let mesh = new subd_mesh();
        const result = glmReadOBJ(await response.text(), mesh);
        mesh = result.mesh;

        // 2) Carico il materiale (.mtl) referenziato dall'.obj.
        if (result.fileMtl) {
            response = await fetch(basePath + result.fileMtl);
            glmReadMTL(await response.text(), mesh);
        }

        // 3) Centro/scalo la mesh e calcolo le normali di faccia.
        Unitize(mesh);
        FacetNormals(mesh);

        // Piccolo helper per creare un buffer da un array di numeri.
        const makeBuffer = (data) => {
            const b = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, b);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
            return b;
        };

        // 4) Un renderable per materiale (ognuno con la sua texture).
        for (let m = 0; m < mesh.materials.length; m++) {
            const material = mesh.materials[m];
            if (material.triangles.length === 0) continue;

            const positions = [], normals = [], texcoords = [], linePositions = [];
            for (let t = 0; t < material.triangles.length; t++) {
                const faceIndex = material.triangles[t];
                const face = mesh.face[faceIndex];
                const norm = mesh.facetnorms[faceIndex];
                const tri = [];
                for (let j = 0; j < 3; j++) {
                    const vert = mesh.vert[face.vert[j]];
                    positions.push(vert.x, vert.y, vert.z);
                    normals.push(norm.i, norm.j, norm.k);
                    const tIdx = face.textCoordsIndex[j];
                    if (tIdx && mesh.textCoords[tIdx]) {
                        const tc = mesh.textCoords[tIdx];
                        texcoords.push(tc.u, tc.v);
                    } else {
                        texcoords.push(0, 0);
                    }
                    tri.push(vert);
                }
                // Spigoli (wireframe): i 3 lati del triangolo.
                linePositions.push(
                    tri[0].x, tri[0].y, tri[0].z, tri[1].x, tri[1].y, tri[1].z,
                    tri[1].x, tri[1].y, tri[1].z, tri[2].x, tri[2].y, tri[2].z,
                    tri[2].x, tri[2].y, tri[2].z, tri[0].x, tri[0].y, tri[0].z);
            }

            // Texture del materiale (map_Kd nel .mtl).
            let texture = null;
            const mapName = material.parameter.get("map_Kd");
            if (mapName) texture = loadTexture(gl, basePath + mapName);

            renderablesPorygon2.push({
                positionBuffer:  makeBuffer(positions),
                normalBuffer:    makeBuffer(normals),
                texcoordBuffer:  makeBuffer(texcoords),
                lineBuffer:      makeBuffer(linePositions),
                numVertices:     positions.length / 3,
                numLineVertices: linePositions.length / 3,
                texture,
                color: [0.8, 0.8, 0.8, 1.0], // usato solo in wireframe
                offset: [0, 0, 0]
            });
        }
        console.log(`Porygon2 caricato: ${renderablesPorygon2.length} parti.`);
    } catch (e) {
        console.warn("Porygon2 non caricato (serve un server locale).", e);
    }
}


// =====================================================================
//  FASI DEL FLUSSO
//  Ogni fase ha update (logica/animazione) e draw (disegno).
// =====================================================================

// --- Fase 1: DISASSEMBLED (pezzi smontati) ---------------------------
function initDisassembly() {
    const EXPLODE = 2.5; // quanto lontano partono i gruppi

    // Raggruppo i pezzi per "group": le parti dello stesso gruppo (es. testa,
    // becco e occhi) devono esplodere e riassemblarsi INSIEME, con lo stesso
    // offset. Così gli occhi restano sempre attaccati alla testa.
    const groups = {};
    for (const r of renderablesPorygon1) {
        (groups[r.group] || (groups[r.group] = [])).push(r);
    }

    for (const name in groups) {
        const members = groups[name];

        // Centroide del gruppo = media dei centroidi dei suoi pezzi.
        let gx = 0, gy = 0, gz = 0;
        for (const r of members) {
            gx += r.centroid[0]; gy += r.centroid[1]; gz += r.centroid[2];
        }
        gx /= members.length; gy /= members.length; gz /= members.length;

        // Direzione dal centro del modello (origine) verso il gruppo.
        let len = Math.hypot(gx, gy, gz);
        const dir = (len < 1e-4) ? [0, 1, 0] : [gx / len, gy / len, gz / len];
        const startOffset = [dir[0] * EXPLODE, dir[1] * EXPLODE, dir[2] * EXPLODE];

        // Stesso offset di partenza per tutti i pezzi del gruppo.
        for (const r of members) {
            r.startOffset = startOffset.slice();
            r.offset = startOffset.slice();
        }
    }
}

function drawDisassembled(projection, view) {
    // I pezzi sono già fermi nelle loro posizioni esplose (offset = startOffset).
    renderModel(renderablesPorygon1, projection, view, getWorldMatrix());
}


// --- Fase 2: ASSEMBLING (animazione di assemblaggio) -----------------
function updateAssembling(now) {
    // t va da 0 (inizio) a 1 (fine) in ASSEMBLE_DURATION millisecondi.
    let t = Math.min((now - phaseStartTime) / ASSEMBLE_DURATION, 1.0);
    // Easing "ease-out cubic": parte veloce e rallenta alla fine (più naturale).
    const eased = 1 - Math.pow(1 - t, 3);

    // Interpolo l'offset di ogni pezzo da startOffset (esploso) a 0 (montato).
    for (const r of renderablesPorygon1) {
        r.offset = [
            r.startOffset[0] * (1 - eased),
            r.startOffset[1] * (1 - eased),
            r.startOffset[2] * (1 - eased)
        ];
    }

    // Quando finisce, azzero gli offset e passo allo stato IDLE.
    if (t >= 1.0) {
        for (const r of renderablesPorygon1) r.offset = [0, 0, 0];
        setGameState(STATE.IDLE);
    }
    return t;
}

function drawAssembling(projection, view, t) {
    // Gli offset sono già aggiornati da updateAssembling: disegno e basta.
    renderModel(renderablesPorygon1, projection, view, getWorldMatrix());
}


// --- Fase 3: IDLE (Porygon1 assemblato + animazione) -----------------

// Lancia l'animazione "SALTELLO": solo a Porygon1 assemblato (IDLE) e se non
// ce n'è già una in corso (evita transizioni brusche).
function triggerAnim() {
    if (gameState !== STATE.IDLE) return;
    if (currentAnim) return;
    currentAnim = { startTime: performance.now(), duration: 1200 };
    updateDialog("Porygon fa un SALTELLO!");
}

// Matrice di rotazione locale (attorno al pivot del gruppo) che realizza
// l'animazione sul gruppo dato. null se il gruppo non è coinvolto.
function computeAnimLocalMatrix(group) {
    if (!currentAnim) return null;
    const t = Math.min(1, (performance.now() - currentAnim.startTime) / currentAnim.duration);
    const bell = Math.sin(Math.PI * t); // 0 -> 1 -> 0 (parte e torna a riposo)
    const pivot = groupPivots[group];
    if (!pivot) return null;

    // SALTELLO: testa su, coda su, zampe che girano.
    let ax = 0;
    if (group === 'head') ax = -0.55 * bell;
    if (group === 'tail') ax =  0.70 * bell;
    if (group === 'footR' || group === 'footL') ax = 2 * Math.PI * 3 * t; // 3 giri

    if (ax === 0) return null;
    // M = T(pivot) * R * T(-pivot): ruota tenendo fermo il punto di giuntura.
    let m = m4.translation(pivot[0], pivot[1], pivot[2]);
    m = m4.xRotate(m, ax);
    m = m4.translate(m, -pivot[0], -pivot[1], -pivot[2]);
    return m;
}

// Rimbalzo dell'INTERO modello durante il saltello.
function computeAnimWorldExtras() {
    if (!currentAnim) return { translateY: 0 };
    const t = Math.min(1, (performance.now() - currentAnim.startTime) / currentAnim.duration);
    const bell = Math.sin(Math.PI * t);
    return { translateY: 0.35 * bell };
}

function updateIdle(now) {
    // Chiudo l'animazione quando è finita.
    if (currentAnim && (now - currentAnim.startTime) >= currentAnim.duration) {
        currentAnim = null;
        updateDialog("Porygon1 pronto. Clicca su Porygon per animarlo, EVOLVI per evolvere.");
    }
}

function drawPorygon1(projection, view) {
    const now = performance.now();
    // Dondolio "idle": il modello galleggia dolcemente su e giù.
    const bob = Math.sin(now * 0.003) * 0.06;
    // Rimbalzo extra durante il saltello.
    const extras = computeAnimWorldExtras();

    const world = m4.translation(0, bob + extras.translateY, 0);

    // Le rotazioni per-gruppo (testa/coda/zampe) le applica renderModel,
    // leggendo l'animazione corrente tramite computeAnimLocalMatrix().
    renderModel(renderablesPorygon1, projection, view, world);
}


// --- Fase 4: EVOLVING (transizione Porygon1 -> Porygon2) -------------
function updateEvolving(now) {
    const t = Math.min((now - phaseStartTime) / EVOLVE_DURATION, 1.0);
    if (t >= 1.0) setGameState(STATE.PORYGON2);
    return t;
}

function drawEvolving(projection, view, t) {
    // Spin veloce durante tutta la trasformazione (~6 giri).
    const angle = t * Math.PI * 2 * 6;
    // Prima metà: Porygon1 rimpicciolisce fino a sparire.
    // Seconda metà: Porygon2 cresce da zero. Sembra un "morph".
    if (t < 0.5) {
        const s = 1 - t / 0.5;                 // 1 -> 0
        let world = m4.yRotation(angle);
        world = m4.scale(world, s, s, s);
        renderModel(renderablesPorygon1, projection, view, world);
    } else {
        const s = (t - 0.5) / 0.5;             // 0 -> 1
        let world = m4.yRotation(angle);
        world = m4.scale(world, s, s, s);
        renderModel(renderablesPorygon2, projection, view, world);
    }
}


// --- Fase 5: PORYGON2 (forma finale) ---------------------------------
function drawPorygon2(projection, view) {
    // Stesso dondolio "idle" di Porygon1.
    const bob = Math.sin(performance.now() * 0.003) * 0.06;
    const world = m4.translation(0, bob, 0);
    renderModel(renderablesPorygon2, projection, view, world);
}


// =====================================================================
//  Disegno di supporto
// =====================================================================
function drawBackground(projection, view) {
    // Se lo skybox è attivo ed è pronto, lo disegno; altrimenti resta il nero
    // del clear iniziale.
    if (bgMode === BG.SKYBOX && skyboxReady) {
        drawSkybox(projection, view);
    }
}

// Disegna una lista di renderable. Ogni pezzo sceglie da solo lo shader:
//  - con texture (occhi, Porygon2) -> textureProgram
//  - solo colore (corpo, testa...) -> colorProgram
// In modalità wireframe disegna gli spigoli (linee) col colore del pezzo.
function renderModel(renderables, projection, view, world) {
    const wireframe = (viewMode === VIEW.WIREFRAME);

    // Direzione della luce (comune a tutti i pezzi), normalizzata.
    // Direzione della luce FISSA rispetto alla camera (quindi allo schermo):
    // LIGHT_DIR è in spazio camera; la ruoto nello spazio mondo con
    // l'orientazione della camera, così resta "in alto a sinistra" mentre orbiti.
    const cam = m4.inverse(view); // orientazione della camera nel mondo
    const lx = cam[0]*LIGHT_DIR[0] + cam[4]*LIGHT_DIR[1] + cam[8]*LIGHT_DIR[2];
    const ly = cam[1]*LIGHT_DIR[0] + cam[5]*LIGHT_DIR[1] + cam[9]*LIGHT_DIR[2];
    const lz = cam[2]*LIGHT_DIR[0] + cam[6]*LIGHT_DIR[1] + cam[10]*LIGHT_DIR[2];
    const ll = Math.hypot(lx, ly, lz) || 1;
    const light = [lx / ll, ly / ll, lz / ll];

    for (const r of renderables) {
        // In wireframe usiamo sempre lo shader colore (niente texture).
        const useTexture = r.texture && !wireframe;
        const program = useTexture ? textureProgram : colorProgram;
        gl.useProgram(program);

        // Location di attributi e uniform per QUESTO programma.
        const posLoc   = gl.getAttribLocation(program, "a_position");
        const normLoc  = gl.getAttribLocation(program, "a_normal");
        const projLoc  = gl.getUniformLocation(program, "u_projection");
        const viewLoc  = gl.getUniformLocation(program, "u_view");
        const worldLoc = gl.getUniformLocation(program, "u_world");
        const lightLoc = gl.getUniformLocation(program, "u_reverseLightDirection");

        // Matrici e luce.
        gl.uniformMatrix4fv(projLoc, false, projection);
        gl.uniformMatrix4fv(viewLoc, false, view);
        if (lightLoc) gl.uniform3fv(lightLoc, light);

        // Matrice world del pezzo = world globale + offset (per l'assemblaggio).
        const off = r.offset || [0, 0, 0];
        let pieceWorld = m4.translate(world, off[0], off[1], off[2]);
        // Animazione di personalità: rotazione locale del gruppo (se attiva).
        const animLocal = computeAnimLocalMatrix(r.group);
        if (animLocal) pieceWorld = m4.multiply(pieceWorld, animLocal);
        gl.uniformMatrix4fv(worldLoc, false, pieceWorld);

        // Attributo posizioni: buffer dei triangoli (solido) o degli spigoli (wireframe).
        gl.bindBuffer(gl.ARRAY_BUFFER, wireframe ? r.lineBuffer : r.positionBuffer);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

        // Attributo normali: solo in modalità solida. In wireframe uso una
        // normale costante (le linee non hanno bisogno di ombreggiatura).
        if (normLoc >= 0) {
            if (wireframe) {
                gl.disableVertexAttribArray(normLoc);
                gl.vertexAttrib3f(normLoc, 0, 0, 1);
            } else {
                gl.bindBuffer(gl.ARRAY_BUFFER, r.normalBuffer);
                gl.enableVertexAttribArray(normLoc);
                gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
            }
        }

        // Colore piatto OPPURE texture, a seconda del pezzo/modalità.
        if (useTexture) {
            const texLoc = gl.getAttribLocation(program, "a_texcoord");
            gl.bindBuffer(gl.ARRAY_BUFFER, r.texcoordBuffer);
            gl.enableVertexAttribArray(texLoc);
            gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, r.texture);
            gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
        } else {
            const colorLoc = gl.getUniformLocation(program, "u_color");
            gl.uniform4fv(colorLoc, r.color || [0.8, 0.8, 0.8, 1.0]);
        }

        // Disegno: linee (wireframe) o triangoli (solido).
        if (wireframe) {
            gl.drawArrays(gl.LINES, 0, r.numLineVertices);
        } else {
            gl.drawArrays(gl.TRIANGLES, 0, r.numVertices);
        }
    }
}


// =====================================================================
//  Matrici camera/proiezione
// =====================================================================
function getProjectionMatrix() {
    const aspect = gl.canvas.width / gl.canvas.height;
    return m4.perspective(Math.PI / 4, aspect, 0.1, 100);
}

// La matrice di vista (getViewMatrix) è gestita dal controllo camera
// nel file camera.js.

// Matrice "world" del modello: per ora identità (Porygon resta al centro,
// è la camera a orbitare). Qui potremo aggiungere animazioni del modello.
function getWorldMatrix() {
    return m4.identity();
}


// =====================================================================
//  Ciclo di rendering
// =====================================================================
function render(now) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const projection = getProjectionMatrix();
    const view = getViewMatrix();

    drawBackground(projection, view);

    // Dispatch in base allo stato corrente
    switch (gameState) {
        case STATE.DISASSEMBLED:
            drawDisassembled(projection, view);
            break;
        case STATE.ASSEMBLING: {
            const t = updateAssembling(now);
            drawAssembling(projection, view, t);
            break;
        }
        case STATE.IDLE:
            updateIdle(now);
            drawPorygon1(projection, view);
            break;
        case STATE.EVOLVING: {
            const t = updateEvolving(now);
            drawEvolving(projection, view, t);
            break;
        }
        case STATE.PORYGON2:
            drawPorygon2(projection, view);
            break;
    }

    requestAnimationFrame(render);
}
