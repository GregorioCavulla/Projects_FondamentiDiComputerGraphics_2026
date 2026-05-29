"use strict";

let gl;
let program, gridProgram, colorProgram;
let renderablesPorygon1 = [];
let renderablesPorygon2 = []; 

// Buffer per la stanza cubo/grigliata
let gridBuffer, gridVertexCount;
let beamVerticalBuffer, beamVerticalCount; // raggi verticali del cilindro
let beamRingBuffer, beamRingCount;         // singolo anello unitario riusabile

// Stati possibili della macchina a stati
const STATE = Object.freeze({
    INIT:       'INIT',
    ASSEMBLING: 'ASSEMBLING',
    PORYGON1:   'PORYGON1',
    EVOLVE_P1:  'EVOLVE_P1',
    EVOLVE_P2:  'EVOLVE_P2',
    PORYGON2:   'PORYGON2'
});
const VIEW = Object.freeze({ TEXTURE: 'TEXTURE', SOLID: 'SOLID', MESH: 'MESH' });

// Durata assemblaggio (ms): usata sia per la transizione di stato che per l'interpolazione tAssemble
const ASSEMBLE_DURATION = 3000;

// Macchina a stati generale
let gameState = STATE.INIT;
let viewMode = VIEW.MESH; // si parte in wireframe; passa a SOLID quando l'assemblaggio finisce
let assembleStartTime = 0;

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationX = 0;
let rotationY = 0;
let targetRotationX = 0;
let targetRotationY = 0;

// Variabili per il movimento della telecamera
let cameraPos = [0, 0, 4.5];
let keys = {};

let evolveStartTime = 0;
let evolveDuration1 = 1500; // Porygon1 spin 3 volte (1500ms)
let evolveDuration2 = 1000; // Porygon2 spin 2 volte (1000ms)

// Riferimenti ai bottoni HUD (popolati in setupHUD)
let btnAtk1, btnAtk2, btnEvo;

// Overlay debug: numerazione delle facce del corpo di Porygon1
let showFaceLabels = false;
let faceLabelContainer = null;
// Gruppi di etichette: ognuno copre una mesh (corpo, testa, …) con prefisso
// nel testo (es. "B12", "H7") così da poterli citare senza ambiguità.
let faceLabelGroups = []; // [{ centroids, els, prefix }]

// --- Animazioni "di personalità" del Porygon1 ----------------------------
// Punto di articolazione per ogni gruppo (calcolato a init dai vertici);
// usato come pivot per rotazioni locali (testa che tilta, coda che si
// alza, gambe che girano / si aprono).
let groupPivots = {};
// Animazione corrente: { kind: 'atk1'|'atk2', startTime, duration }.
let currentAnim = null;

function resizeCanvas() {
    const canvas = gl.canvas;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
    }
}

async function main() {
    const canvas = document.getElementById("webgl-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) { alert("WebGL non supportato!"); return; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    window.addEventListener('resize', resizeCanvas);

    // Shader Porygon Form
    program = webglUtils.createProgramFromScripts(gl, ["vertex-shader", "fragment-shader"]);
    // Shader Stanza Cyberspazio
    gridProgram = webglUtils.createProgramFromScripts(gl, ["grid-vertex-shader", "grid-fragment-shader"]);
    // Shader Colore Basic per Porygon 1
    colorProgram = webglUtils.createProgramFromScripts(gl, ["color-vertex-shader", "color-fragment-shader"]);

    gl.enable(gl.DEPTH_TEST);
    // LEQUAL: facce successive complanari (es. occhi sopra la testa)
    // possono vincere lo z-fighting essendo disegnate dopo.
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Sfondo nero assoluto

    setupHUD();
    setupGUI();
    createGridRoom();

    canvas.addEventListener('mousedown', (e) => {
        // Nello stato iniziale i pezzi sono fermi sul pavimento e non si
        // possono ruotare: l'utente deve prima premere STARTUP.
        if (gameState === STATE.INIT) return;
        isDragging = true; previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging && gameState !== STATE.INIT) {
            targetRotationX += (e.offsetX - previousMousePosition.x) * 0.01;
            targetRotationY += (e.offsetY - previousMousePosition.y) * 0.01;
            previousMousePosition = { x: e.offsetX, y: e.offsetY };
        }
    });
    window.addEventListener('mouseup', () => { isDragging = false; });
    
    // Ascoltatori per il movimento da tastiera
    window.addEventListener('keydown', (e) => {
        const wasDown = keys[e.code];
        keys[e.code] = true;
        // Tasto N: toggle numerazione facce del corpo. Lascio sempre attivo
        // così l'utente può attivare l'overlay anche prima dell'assemblaggio
        // o dopo l'evoluzione: la condizione di disegno effettiva è nel render.
        if (!wasDown && e.code === 'KeyN') {
            toggleFaceLabels();
        }
        // Tasti 1/2: lanciano le due animazioni di personalità (solo a
        // Porygon assemblato e fermo, niente overlap tra attacchi).
        if (!wasDown && (e.code === 'Digit1' || e.code === 'Numpad1')) {
            triggerAnim('atk1');
        }
        if (!wasDown && (e.code === 'Digit2' || e.code === 'Numpad2')) {
            triggerAnim('atk2');
        }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    await loadPorygonModel();
    initPorygon1Animation();
    initFaceLabels();
    requestAnimationFrame(render);
}

// --- Overlay numerazione facce del corpo ---------------------------------
// Per debug/discussione: con il tasto N si sovrappone al canvas un piccolo
// numero su ogni faccia del corpo di Porygon1. I numeri sono <span> HTML
// posizionati ad ogni frame proiettando il centroide della faccia
// (mvp * centroid -> NDC -> pixel).
function initFaceLabels() {
    faceLabelContainer = document.getElementById('face-labels');
    if (!faceLabelContainer) return;
    faceLabelContainer.innerHTML = '';
    faceLabelGroups = [];

    // Definizione dei gruppi da etichettare: per ognuno calcoliamo i centroidi
    // delle facce in object space e creiamo una <span> riutilizzabile.
    const groupDefs = [
        { verts: P1_BODY_VERTS, faces: P1_BODY_FACES, prefix: 'B', cls: 'face-label face-label-body' },
        { verts: P1_HEAD_VERTS, faces: P1_HEAD_FACES, prefix: 'H', cls: 'face-label face-label-head' },
    ];
    for (const g of groupDefs) {
        const centroids = g.faces.map(f => {
            const a = g.verts[f[0]], b = g.verts[f[1]], c = g.verts[f[2]];
            return [ (a[0]+b[0]+c[0])/3, (a[1]+b[1]+c[1])/3, (a[2]+b[2]+c[2])/3 ];
        });
        const els = centroids.map((_, i) => {
            const el = document.createElement('span');
            el.className = g.cls;
            el.textContent = g.prefix + (i + 1); // 1-based
            faceLabelContainer.appendChild(el);
            return el;
        });
        faceLabelGroups.push({ centroids, els, prefix: g.prefix });
    }
    faceLabelContainer.style.display = 'none';
}

function toggleFaceLabels() {
    showFaceLabels = !showFaceLabels;
    if (faceLabelContainer) {
        faceLabelContainer.style.display = showFaceLabels ? 'block' : 'none';
    }
}

// Trasforma un punto 3D per una matrice 4x4 column-major; ritorna [x,y,z,w]
function transformPoint(m, p) {
    const x = p[0], y = p[1], z = p[2];
    return [
        m[0]*x + m[4]*y + m[8]*z  + m[12],
        m[1]*x + m[5]*y + m[9]*z  + m[13],
        m[2]*x + m[6]*y + m[10]*z + m[14],
        m[3]*x + m[7]*y + m[11]*z + m[15],
    ];
}

// Aggiorna posizione di ogni <span> proiettando il centroide a schermo.
function updateFaceLabels(projectionMatrix, viewMatrix, worldMatrix) {
    if (!showFaceLabels || faceLabelGroups.length === 0) return;
    const w = gl.canvas.clientWidth;
    const h = gl.canvas.clientHeight;
    const vp = m4.multiply(projectionMatrix, viewMatrix);
    const mvp = m4.multiply(vp, worldMatrix);
    for (const g of faceLabelGroups) {
        for (let i = 0; i < g.centroids.length; i++) {
            const clip = transformPoint(mvp, g.centroids[i]);
            if (clip[3] <= 0) { g.els[i].style.display = 'none'; continue; }
            const ndcX = clip[0] / clip[3];
            const ndcY = clip[1] / clip[3];
            const sx = (ndcX * 0.5 + 0.5) * w;
            const sy = (1 - (ndcY * 0.5 + 0.5)) * h;
            g.els[i].style.display = 'block';
            g.els[i].style.transform =
                `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
        }
    }
}

// =============================================================================
// PORYGON 1 — Geometria hardcoded
// Tutte le mesh di Porygon1 sono poliedri definiti vertice per vertice
// direttamente nel codice (concept del progetto: P1 = vertici a mano, P2 = OBJ).
// Le primitive usate: ottaedro (testa/corpo), piramide a base quadrata
// (becco/zampe/coda), cubo (occhi). Da queste, posizionando/scalando/
// ruotando ogni parte, ricostruiamo la silhouette di Porygon.
// =============================================================================

// Costruisce buffer GL flat-shaded da una lista di vertici unici + triangoli.
// - verts: array di [x, y, z]
// - faces: array di [i0, i1, i2] (indici in verts)
// Produce: posizioni espanse (3 vertici per faccia), normali per-faccia
// (shading sfaccettato/low-poly) e gli spigoli unici per la wireframe.
function buildPolyhedron(verts, faces, vertUVs = null) {
    const positions = [];
    const normals = [];
    const texcoords = vertUVs ? [] : null;
    const edgeSet = new Set();

    for (const f of faces) {
        const p0 = verts[f[0]], p1 = verts[f[1]], p2 = verts[f[2]];
        positions.push(p0[0], p0[1], p0[2],
                       p1[0], p1[1], p1[2],
                       p2[0], p2[1], p2[2]);
        if (texcoords) {
            const u0 = vertUVs[f[0]], u1 = vertUVs[f[1]], u2 = vertUVs[f[2]];
            texcoords.push(u0[0], u0[1], u1[0], u1[1], u2[0], u2[1]);
        }
        // Normale di faccia (cross prodotto)
        const ux = p1[0]-p0[0], uy = p1[1]-p0[1], uz = p1[2]-p0[2];
        const vx = p2[0]-p0[0], vy = p2[1]-p0[1], vz = p2[2]-p0[2];
        let nx = uy*vz - uz*vy;
        let ny = uz*vx - ux*vz;
        let nz = ux*vy - uy*vx;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;
        normals.push(nx,ny,nz, nx,ny,nz, nx,ny,nz);
        // Spigoli unici (chiave ordinata per evitare duplicati)
        const addEdge = (a, b) => {
            const key = a < b ? a + '_' + b : b + '_' + a;
            edgeSet.add(key);
        };
        addEdge(f[0], f[1]); addEdge(f[1], f[2]); addEdge(f[2], f[0]);
    }

    const linePositions = [];
    for (const key of edgeSet) {
        const [a, b] = key.split('_').map(Number);
        linePositions.push(verts[a][0], verts[a][1], verts[a][2],
                           verts[b][0], verts[b][1], verts[b][2]);
    }

    const pBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions),     gl.STATIC_DRAW);
    const nBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals),       gl.STATIC_DRAW);
    const lBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(linePositions), gl.STATIC_DRAW);

    let tBuf = null;
    if (texcoords) {
        tBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);
    }

    return {
        positionBuffer: pBuf,
        normalBuffer:   nBuf,
        lineBuffer:     lBuf,
        texcoordBuffer: tBuf,
        numVertices:     positions.length / 3,
        numLineVertices: linePositions.length / 3
    };
}

// --- Geometria hardcoded di Porygon -----------------------------------------
// Tutti i vertici sotto sono coordinate assolute (relative al centro modello)
// estratte una sola volta dal file `assets/Porygon.obj` e poi incollate qui,
// gi\u00e0 deduplicate e normalizzate nel cubo [-1, +1]. Sei parti totali:
// corpo, testa (becco incluso), occhi, due zampe e coda.
// Il file OBJ resta nei sorgenti solo come riferimento: a runtime
// Porygon1 non lo carica mai (concept del progetto: P1 = vertici hardcoded,
// P2 = OBJ caricato).

// ---- CORPO (16 v, 28 f) ----
const P1_BODY_VERTS = [
    [-0.175, 0.134, 0.231],
    [-0.207, 0.054, 0.460],
    [ 0.207, 0.054, 0.460],
    [ 0.175, 0.134, 0.231],
    [ 0.280,-0.132,-0.340],
    [ 0.280,-0.132, 0.363],
    [ 0.333,-0.266, 0.567],
    [ 0.333,-0.266,-0.318],
    [-0.249,-0.547,-0.266],
    [-0.333,-0.266,-0.318],
    [ 0.249,-0.547,-0.266],
    [ 0.249,-0.547, 0.345],
    [-0.249,-0.547, 0.345],
    [-0.280,-0.132,-0.340],
    [-0.333,-0.266, 0.567],
    [-0.280,-0.132, 0.363],
];
const P1_BODY_FACES = [
    [ 0, 1, 2], [ 2, 3, 0], [ 4, 3, 2], [ 2, 5, 4], [ 6, 7, 4], [ 4, 5, 6],
    [ 8, 9, 7], [ 7,10, 8], [ 8,10,11], [11,12, 8], [13, 0, 3], [ 3, 4,13],
    [ 9,13, 4], [ 4, 7, 9], [14,12,11], [11, 6,14], [ 6, 2, 1], [ 1,14, 6],
    [13,15, 1], [ 1, 0,13], [14,15,13], [13, 9,14], [ 6,11,10], [10, 7, 6],
    [ 8,12,14], [14, 9, 8], [ 6, 5, 2], [14, 1,15],
];

// ---- TESTA + BECCO (30 v, 48 f) ----
const P1_HEAD_VERTS = [
    [-0.178, 0.429, 0.594], [ 0.178, 0.429, 0.594], [ 0.134, 0.526, 0.447],
    [-0.134, 0.526, 0.447], [ 0.157, 0.302, 0.774], [-0.157, 0.302, 0.774],
    [-0.185, 0.557, 0.315], [ 0.185, 0.557, 0.315], [ 0.135, 0.622, 0.035],
    [-0.135, 0.622, 0.035], [-0.113, 0.042, 0.979], [-0.214, 0.053, 0.661],
    [ 0.214, 0.053, 0.661], [ 0.113, 0.042, 0.979], [-0.097, 0.056, 1.000],
    [ 0.097, 0.056, 1.000], [-0.321, 0.413,-0.011], [ 0.321, 0.413,-0.011],
    [ 0.312, 0.207, 0.041], [-0.312, 0.207, 0.041], [-0.279, 0.061, 0.460],
    [ 0.279, 0.061, 0.460], [ 0.274, 0.281, 0.369], [ 0.270, 0.428, 0.260],
    [ 0.237, 0.323, 0.548], [ 0.207, 0.239, 0.721], [-0.274, 0.281, 0.369],
    [-0.270, 0.428, 0.260], [-0.237, 0.323, 0.548], [-0.207, 0.239, 0.721],
];
const P1_HEAD_FACES = [
    [ 0, 1, 2], [ 2, 3, 0], [ 4, 1, 0], [ 0, 5, 4], [ 6, 7, 8], [ 8, 9, 6],
    [ 3, 2, 7], [ 7, 6, 3], [10,11,12], [12,13,10], [14,10,13], [13,15,14],
    [ 5,14,15], [15, 4, 5], [16, 9, 8], [ 8,17,16], [17,18,19], [19,16,17],
    [11,20,21], [21,12,11], [20,19,18], [18,21,20], [22,18,23], [22,21,18],
    [22,24,21], [23,18,17], [25,12,21], [21,24,25], [26,27,19], [26,19,20],
    [26,20,28], [27,16,19], [29,28,20], [20,11,29], [15,13,25], [25, 4,15],
    [ 4,25,24], [24, 1, 4], [17, 8, 7], [ 7,23,17], [14, 5,29], [29,10,14],
    [ 5, 0,28], [28,29, 5], [16,27, 6], [ 6, 9,16], [12,25,13], [11,10,29],
];

// ---- OCCHI (12 v, 8 f) - triangoli complanari alla superficie della testa,
// estratti dall'OBJ originale. I primi 6 vertici sono l'occhio destro, gli
// altri 6 il sinistro. La forma resta quella canonica; per ottenere il
// "pallino nero su sfondo bianco" applichiamo una texture procedurale.
const P1_EYES_VERTS = [
    [ 0.178, 0.429, 0.594], [ 0.237, 0.323, 0.548], [ 0.270, 0.428, 0.260],
    [ 0.185, 0.557, 0.315], [ 0.134, 0.526, 0.447], [ 0.274, 0.281, 0.369],
    [-0.178, 0.429, 0.594], [-0.185, 0.557, 0.315], [-0.270, 0.428, 0.260],
    [-0.237, 0.323, 0.548], [-0.274, 0.281, 0.369], [-0.134, 0.526, 0.447],
];
const P1_EYES_FACES = [
    [0,1,2], [2,3,0], [3,4,0], [2,1,5],
    [6,7,8], [8,9,6], [9,8,10], [6,11,7],
];

// Texture procedurale per gli occhi: bianco con un pallino nero al centro.
// La generiamo su un <canvas> 2D e la carichiamo come texture WebGL.
function createEyeTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#0a0a12';
    ctx.beginPath();
    ctx.arc(64, 64, 12, 0, Math.PI * 2);
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

// Calcola UV per gli occhi proiettando ciascun cluster (occhio dx/sx) sul
// piano YZ e normalizzandolo nel proprio bounding box. Con un po' di pad
// il centro del cluster cade a UV (0.5, 0.5), dove sta il pallino nero.
function computeEyeUVs(verts) {
    const uvs = new Array(verts.length);
    const pad = 1.35;
    for (let cluster = 0; cluster < 2; cluster++) {
        const start = cluster * 6;
        let ymin =  Infinity, ymax = -Infinity;
        let zmin =  Infinity, zmax = -Infinity;
        for (let i = 0; i < 6; i++) {
            const v = verts[start + i];
            if (v[1] < ymin) ymin = v[1];
            if (v[1] > ymax) ymax = v[1];
            if (v[2] < zmin) zmin = v[2];
            if (v[2] > zmax) zmax = v[2];
        }
        const ymid = (ymin + ymax) / 2, ywid = (ymax - ymin) || 1;
        const zmid = (zmin + zmax) / 2, zwid = (zmax - zmin) || 1;
        for (let i = 0; i < 6; i++) {
            const v = verts[start + i];
            const u = 0.5 + (v[1] - ymid) / (ywid * pad);
            const w = 0.5 + (v[2] - zmid) / (zwid * pad);
            uvs[start + i] = [u, w];
        }
    }
    return uvs;
}

// Divide una lista di facce in "front" / "back" usando un predicato sul
// centroide (cx, cy, cz). Cos\u00ec possiamo isolare con precisione il becco
// (solo z alto sulla testa) e il petto (z avanti + y basso sul corpo).
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

// Forza alcune facce (indici 1-based nella lista originale) a finire nel
// gruppo "back" anche se il predicato le aveva messe in "front". Serve per
// rifinire a mano i colori dove l'euristica sbaglia (vedi etichette H./B.).
function forceFacesToBack(split, originalFaces, oneBasedIndices) {
    for (const oneBased of oneBasedIndices) {
        const face = originalFaces[oneBased - 1];
        if (!face) continue;
        const idx = split.front.indexOf(face);
        if (idx >= 0) {
            split.front.splice(idx, 1);
            split.back.push(face);
        }
    }
}

// ---- ZAMPA DESTRA (10 v, 16 f) ----
const P1_FOOT_R_VERTS = [
    [ 0.339,-0.422,-0.328], [ 0.339,-0.616,-0.328], [ 0.339,-0.616, 0.531],
    [ 0.339,-0.483, 0.531], [ 0.620,-0.531, 0.531], [ 0.620,-0.622, 0.531],
    [ 0.620,-0.622,-0.328], [ 0.620,-0.501,-0.328], [ 0.620,-0.339, 0.002],
    [ 0.339,-0.225, 0.002],
];
const P1_FOOT_R_FACES = [
    [0,1,2], [2,3,0], [4,5,6], [6,7,4], [1,6,5], [5,2,1], [3,2,5], [5,4,3],
    [0,7,6], [6,1,0], [8,9,3], [3,4,8], [8,7,0], [0,9,8], [0,3,9], [4,7,8],
];

// ---- ZAMPA SINISTRA (10 v, 16 f) ----
const P1_FOOT_L_VERTS = [
    [-0.339,-0.616, 0.531], [-0.339,-0.616,-0.328], [-0.339,-0.422,-0.328],
    [-0.339,-0.483, 0.531], [-0.620,-0.622,-0.328], [-0.620,-0.622, 0.531],
    [-0.620,-0.531, 0.531], [-0.620,-0.501,-0.328], [-0.339,-0.225, 0.002],
    [-0.620,-0.339, 0.002],
];
const P1_FOOT_L_FACES = [
    [0,1,2], [2,3,0], [4,5,6], [6,7,4], [5,4,1], [1,0,5], [5,0,3], [3,6,5],
    [4,7,2], [2,1,4], [3,8,9], [9,6,3], [2,7,9], [9,8,2], [2,8,3], [6,9,7],
];

// ---- CODA (10 v, 16 f) ----
const P1_TAIL_VERTS = [
    [ 0.190,-0.534,-0.406], [ 0.190,-0.534,-0.268], [-0.190,-0.534,-0.268],
    [-0.190,-0.534,-0.406], [ 0.116,-0.200,-0.329], [-0.116,-0.200,-0.329],
    [-0.028, 0.244,-0.951], [ 0.028, 0.244,-0.951], [-0.028, 0.201,-1.000],
    [ 0.028, 0.201,-1.000],
];
const P1_TAIL_FACES = [
    [0,1,2], [2,3,0], [1,4,5], [5,2,1], [6,5,4], [4,7,6], [8,9,0], [0,3,8],
    [8,6,7], [7,9,8], [5,3,2], [6,8,3], [3,5,6], [0,9,7], [7,4,0], [4,1,0],
];

// Costruisce Porygon1 montando le 6 parti hardcoded. Ogni parte ha gi\u00e0
// le coordinate al posto giusto rispetto al centro modello, quindi la
// targetMatrix \u00e8 l'identit\u00e0: durante l'assemblaggio le parti partono
// da una posizione random sul pavimento e si interpolano verso la propria
// posizione "naturale".
function initPorygon1Animation() {
    renderablesPorygon1 = [];

    // Colori canonici di Porygon
    const PINK  = [0.93, 0.55, 0.65, 1.0];
    const CYAN  = [0.38, 0.78, 0.83, 1.0];
    const WHITE = [0.98, 0.98, 0.98, 1.0];

    // Split testa: il becco (forte z, fronte basso/centrale) va in ciano,
    // il resto rosa. Soglia osservata sui vertici del becco (z >= ~0.66).
    const headSplit = splitFacesByPredicate(P1_HEAD_VERTS, P1_HEAD_FACES,
        (cx, cy, cz) => cz >= 0.65);
    // Split corpo: il "petto" \u00e8 davanti (z alto) e in basso (y negativo),
    // cos\u00ec da non colorare anche la zona di attacco con la testa.
    const bodySplit = splitFacesByPredicate(P1_BODY_VERTS, P1_BODY_FACES,
        (cx, cy, cz) => cz >= 0.20 && cy <= -0.05);
    // Override manuali (indici 1-based corrispondenti alle etichette H./B.):
    // facce che la regola euristica metterebbe in ciano ma che vogliamo rosa.
    // H3, H4, H37, H44 sulla testa; B23, B25, B27, B28 sul corpo.
    forceFacesToBack(headSplit, P1_HEAD_FACES, [3, 4, 37, 44]);
    forceFacesToBack(bodySplit, P1_BODY_FACES, [23, 25, 27, 28]);
    // Texture procedurale per gli occhi (bianco con pallino nero al centro)
    // e relative UV planari per cluster.
    const eyeTex = createEyeTexture();
    const eyeUVs = computeEyeUVs(P1_EYES_VERTS);

    const parts = [
        { verts: P1_BODY_VERTS,   faces: bodySplit.back,  color: PINK, group: 'body' },
        { verts: P1_BODY_VERTS,   faces: bodySplit.front, color: CYAN, group: 'body' }, // petto
        { verts: P1_HEAD_VERTS,   faces: headSplit.back,  color: PINK, group: 'head' },
        { verts: P1_HEAD_VERTS,   faces: headSplit.front, color: CYAN, group: 'head' }, // becco
        { verts: P1_EYES_VERTS,   faces: P1_EYES_FACES,   color: WHITE, texture: eyeTex, vertUVs: eyeUVs, group: 'head' },
        { verts: P1_FOOT_R_VERTS, faces: P1_FOOT_R_FACES, color: CYAN, group: 'footR' },
        { verts: P1_FOOT_L_VERTS, faces: P1_FOOT_L_FACES, color: CYAN, group: 'footL' },
        { verts: P1_TAIL_VERTS,   faces: P1_TAIL_FACES,   color: CYAN, group: 'tail' },
    ];

    // Layout iniziale deterministico dei gruppi sul pavimento (y = -2 del
    // gridroom). Ogni gruppo viene appoggiato in modo che il suo vertice
    // pi\u00f9 basso tocchi il piano, niente compenetrazioni n\u00e9 rotazioni:
    // questo evita anche deformazioni durante l'interpolazione di
    // assemblaggio (start -> identit\u00e0 \u00e8 una pura traslazione).
    const FLOOR_Y = -2.0;
    const groupLayoutXZ = {
        body:  [ 0.0,  0.0],
        head:  [ 0.0,  2.2],
        footR: [-2.2, -0.4],
        footL: [ 2.2, -0.4],
        tail:  [ 0.0, -2.4],
    };
    function groupMinY(name) {
        let minY = Infinity;
        for (const p of parts) {
            if (p.group !== name || !p.faces || p.faces.length === 0) continue;
            for (const v of p.verts) if (v[1] < minY) minY = v[1];
        }
        return minY === Infinity ? 0 : minY;
    }
    const groupStart = {};
    function startMatrixFor(group) {
        if (!groupStart[group]) {
            const xz = groupLayoutXZ[group] || [0, 0];
            const liftY = FLOOR_Y - groupMinY(group);
            // Solo traslazione: nessuna rotazione -> l'interpolazione lineare
            // verso l'identità resta una traslazione (no shear/scale).
            groupStart[group] = m4.translation(xz[0], liftY, xz[1]);
        }
        return groupStart[group];
    }

    parts.forEach(p => {
        if (!p.faces || p.faces.length === 0) return; // split vuoto: salta
        const mesh = buildPolyhedron(p.verts, p.faces, p.vertUVs || null);
        const start = startMatrixFor(p.group);

        renderablesPorygon1.push({
            group:           p.group,
            positionBuffer:  mesh.positionBuffer,
            normalBuffer:    mesh.normalBuffer,
            lineBuffer:      mesh.lineBuffer,
            texcoordBuffer:  mesh.texcoordBuffer,
            numVertices:     mesh.numVertices,
            numLineVertices: mesh.numLineVertices,
            startMatrix:  start,
            targetMatrix: m4.identity(),
            color:   p.color,
            texture: p.texture || null,
        });
    });

    // Calcola un pivot per ogni gruppo, basato sulla bounding box dei suoi
    // vertici. Sono i punti di articolazione attorno ai quali si fanno
    // ruotare testa / coda / gambe nelle animazioni.
    function bboxOf(name) {
        let mn = [ Infinity,  Infinity,  Infinity];
        let mx = [-Infinity, -Infinity, -Infinity];
        for (const p of parts) {
            if (p.group !== name || !p.faces || p.faces.length === 0) continue;
            for (const v of p.verts) {
                for (let i = 0; i < 3; i++) {
                    if (v[i] < mn[i]) mn[i] = v[i];
                    if (v[i] > mx[i]) mx[i] = v[i];
                }
            }
        }
        return { mn, mx };
    }
    const headBB = bboxOf('head');
    const tailBB = bboxOf('tail');
    const fRBB   = bboxOf('footR');
    const fLBB   = bboxOf('footL');
    groupPivots = {
        // base testa: centro in X/Z, Y più bassa (attacco col corpo).
        head:  [ (headBB.mn[0]+headBB.mx[0])*0.5, headBB.mn[1], (headBB.mn[2]+headBB.mx[2])*0.5 ],
        // attacco coda al corpo: estremo verso il corpo. Le coordinate del
        // tail si estendono dietro al modello, quindi il punto di giuntura
        // è il vertice con Z massima (più vicino al corpo).
        tail:  [ (tailBB.mn[0]+tailBB.mx[0])*0.5, (tailBB.mn[1]+tailBB.mx[1])*0.5, tailBB.mx[2] ],
        // hip joint: parte alta delle gambe (Y massima).
        footR: [ (fRBB.mn[0]+fRBB.mx[0])*0.5, fRBB.mx[1], (fRBB.mn[2]+fRBB.mx[2])*0.5 ],
        footL: [ (fLBB.mn[0]+fLBB.mx[0])*0.5, fLBB.mx[1], (fLBB.mn[2]+fLBB.mx[2])*0.5 ],
        body:  [0, 0, 0],
    };
}

// Lancia un'animazione di personalità: ammessa solo a Porygon1 assemblato
// e quando non ce n'è già una in corso (evita giunzioni brusche).
function triggerAnim(kind) {
    if (gameState !== STATE.PORYGON1) return;
    if (currentAnim) return;
    const duration = (kind === 'atk1') ? 1200 : 1500;
    currentAnim = { kind, startTime: performance.now(), duration };
    if (kind === 'atk1') updateDialog("Porygon usa SALTELLO! La testa si alza, le zampe scattano!");
    if (kind === 'atk2') updateDialog("Porygon assume la posa da attacco: zampe larghe e muso basso!");
}

// Costruisce la matrice di rotazione locale (in object space del gruppo)
// che realizza l'animazione corrente sul gruppo dato. Ritorna null se non
// c'è animazione attiva o il gruppo non è coinvolto.
function computeAnimLocalMatrix(group) {
    if (!currentAnim) return null;
    const t = Math.min(1, (performance.now() - currentAnim.startTime) / currentAnim.duration);
    const bell = Math.sin(Math.PI * t); // 0 -> 1 -> 0
    const pivot = groupPivots[group];
    if (!pivot) return null;

    let ax = 0, ay = 0, az = 0;
    if (currentAnim.kind === 'atk1') {
        // SALTELLO: testa su, coda su, gambe che ruotano (asse X = orizz.).
        if (group === 'head')  ax = -0.55 * bell;
        if (group === 'tail')  ax = -0.70 * bell;
        if (group === 'footR' || group === 'footL') ax = 2 * Math.PI * 3 * t; // 3 giri
    } else if (currentAnim.kind === 'atk2') {
        // POSA D'ATTACCO: testa giù, coda giù, gambe a V (asse Z).
        if (group === 'head')  ax = 0.45 * bell;
        if (group === 'tail')  ax = 0.55 * bell;
        // "Spazzaneve al contrario": zampe aperte verso l'esterno.
        if (group === 'footR') az = -0.55 * bell; // ruota verso +X (destra esterno)
        if (group === 'footL') az =  0.55 * bell; // ruota verso -X (sinistra esterno)
    }

    if (ax === 0 && ay === 0 && az === 0) return null;
    // M = T(p) * Rx * Ry * Rz * T(-p)
    let m = m4.translation(pivot[0], pivot[1], pivot[2]);
    if (ax !== 0) m = m4.xRotate(m, ax);
    if (ay !== 0) m = m4.yRotate(m, ay);
    if (az !== 0) m = m4.zRotate(m, az);
    m = m4.translate(m, -pivot[0], -pivot[1], -pivot[2]);
    return m;
}

// Trasformazioni applicate all'intero modello (bounce, leggera inclinazione)
// durante l'animazione corrente. Ritorna { translateY, pitchX }.
function computeAnimWorldExtras() {
    if (!currentAnim) return { translateY: 0, pitchX: 0 };
    const t = Math.min(1, (performance.now() - currentAnim.startTime) / currentAnim.duration);
    const bell = Math.sin(Math.PI * t);
    if (currentAnim.kind === 'atk1') {
        return { translateY: 0.55 * bell, pitchX: 0 };
    }
    if (currentAnim.kind === 'atk2') {
        return { translateY: 0, pitchX: 0.20 * bell };
    }
    return { translateY: 0, pitchX: 0 };
}




// Crea la griglia verde stile TRS/Cyberspazio
function createGridRoom() {
    const lines = [];
    const size = 10;
    const step = 1;
    for (let i = -size; i <= size; i += step) {
        lines.push(i, -2, -size, i, -2, size);
        lines.push(-size, -2, i, size, -2, i);
    }
    for(let y = -2; y <= size; y += step) {
       lines.push(-size, y, -size, size, y, -size);
       lines.push(-size, y, -size, -size, y, size);
       lines.push(size, y, -size, size, y, size);
    }
    for(let x = -size; x <= size; x+=step) lines.push(x, -2, -size, x, size, -size);
    for(let z = -size; z <= size; z+=step) {
        lines.push(-size, -2, z, -size, size, z);
        lines.push(size, -2, z, size, size, z);
    }
    gridVertexCount = lines.length / 3;
    gridBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);

    createAssemblyBeam();
}

// Cilindro di raggi bianchi + anelli orizzontali animati: si accende durante
// l'assemblaggio e dà il classico effetto "transporter/portale cyberspaziale".
// Geometria normalizzata: raggi verticali su cilindro unitario (raggio = 1)
// e un singolo anello unitario riusato a varie altezze. Raggio e altezza
// effettivi sono applicati a runtime via matrici scale/translate, così possiamo
// far crescere il cilindro da r=0 a r=MAX e far scorrere gli anelli lungo Y.
const BEAM_Y_BOT = -2.0;
const BEAM_Y_TOP =  3.0;
const BEAM_MAX_RADIUS = 1.2;

function createAssemblyBeam() {
    // Raggi verticali (molti): cilindro unitario in XZ.
    const N_BEAMS = 96;
    const vlines = [];
    for (let i = 0; i < N_BEAMS; i++) {
        const a = (i / N_BEAMS) * Math.PI * 2;
        const x = Math.cos(a), z = Math.sin(a);
        vlines.push(x, BEAM_Y_BOT, z, x, BEAM_Y_TOP, z);
    }
    beamVerticalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, beamVerticalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vlines), gl.STATIC_DRAW);
    beamVerticalCount = vlines.length / 3;

    // Anello unitario in XZ (y=0): lo trasliamo a runtime per le K copie.
    const RING_SEGS = 64;
    const rlines = [];
    for (let i = 0; i < RING_SEGS; i++) {
        const a1 = (i / RING_SEGS) * Math.PI * 2;
        const a2 = ((i + 1) / RING_SEGS) * Math.PI * 2;
        rlines.push(Math.cos(a1), 0, Math.sin(a1), Math.cos(a2), 0, Math.sin(a2));
    }
    beamRingBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, beamRingBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rlines), gl.STATIC_DRAW);
    beamRingCount = rlines.length / 3;
}

// Disegna i raggi verticali (scalati in raggio) + K anelli che scorrono lungo Y.
// `progress` è 0..1 sul tempo di assemblaggio: regola crescita raggio e alpha.
function drawAssemblyBeam(now, progress, projectionMatrix, viewMatrix) {
    gl.useProgram(gridProgram);
    const proj  = gl.getUniformLocation(gridProgram, "u_projection");
    const view  = gl.getUniformLocation(gridProgram, "u_view");
    const world = gl.getUniformLocation(gridProgram, "u_world");
    const col   = gl.getUniformLocation(gridProgram, "u_color");
    const pos   = gl.getAttribLocation(gridProgram, "a_position");
    gl.uniformMatrix4fv(proj, false, projectionMatrix);
    gl.uniformMatrix4fv(view, false, viewMatrix);

    // Raggio: cresce da 0 a MAX nel primo 55% dell'assemblaggio, ease-out cubico.
    const grow = Math.min(progress / 0.55, 1.0);
    const eased = 1 - Math.pow(1 - grow, 3);
    const radius = BEAM_MAX_RADIUS * eased;

    // Alpha: fade-in iniziale + fade-out finale, con leggera pulsazione.
    const fadeIn  = Math.min(progress / 0.10, 1.0);
    const fadeOut = (progress > 0.85) ? Math.max(0, (1 - progress) / 0.15) : 1.0;
    const pulse   = 0.65 + 0.35 * Math.sin(now * 0.012);
    const alpha   = 0.85 * fadeIn * fadeOut * pulse;

    // --- Raggi verticali ---
    let w = m4.yRotate(m4.identity(), now * 0.0015);
    w = m4.scale(w, radius, 1, radius);
    gl.uniformMatrix4fv(world, false, w);
    gl.uniform4fv(col, [1, 1, 1, alpha]);
    gl.bindBuffer(gl.ARRAY_BUFFER, beamVerticalBuffer);
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, beamVerticalCount);

    // --- Anelli scorrevoli lungo l'altezza ---
    gl.bindBuffer(gl.ARRAY_BUFFER, beamRingBuffer);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0);
    const K = 6;             // numero di anelli simultanei
    const periodMs = 1800;   // tempo per percorrere l'intera altezza
    const height = BEAM_Y_TOP - BEAM_Y_BOT;
    for (let k = 0; k < K; k++) {
        // Ognuno parte sfasato così sono distribuiti uniformemente.
        const t = ((now / periodMs) + k / K) % 1;
        const y = BEAM_Y_BOT + t * height;
        // Fade lieve agli estremi per evitare scatti di apparizione/sparizione.
        const ringFade = Math.min(1, 5 * Math.min(t, 1 - t));
        let rw = m4.translation(0, y, 0);
        rw = m4.scale(rw, radius, 1, radius);
        gl.uniformMatrix4fv(world, false, rw);
        gl.uniform4fv(col, [1, 1, 1, alpha * ringFade]);
        gl.drawArrays(gl.LINES, 0, beamRingCount);
    }
}

function updateDialog(text) {
    document.getElementById("dialog-box").innerText = text;
}

function setupHUD() {
    const btnStart = document.getElementById("btn-startup");
    btnAtk1 = document.getElementById("btn-azione1");
    btnAtk2 = document.getElementById("btn-azione2");
    btnEvo = document.getElementById("btn-evolve");

    btnStart.onclick = () => {
        btnStart.disabled = true;
        updateDialog("Inizializzazione cyberspazio... Assemblaggio Porygon in corso!");
        gameState = STATE.ASSEMBLING;
        assembleStartTime = performance.now();
        // La transizione ASSEMBLING -> PORYGON1 è ora gestita nel render loop (sync col tempo reale)
    };

    btnAtk1.onclick = () => {
        viewMode = VIEW.MESH;
        updateDialog("Visualizzazione impostata su: MESH (Wireframe)");
    };
    btnAtk2.onclick = () => {
        viewMode = VIEW.SOLID;
        updateDialog("Visualizzazione impostata su: SOLID (Senza texture)");
    };
    
    btnEvo.onclick = () => {
        if (gameState === STATE.PORYGON1) {
            updateDialog("Che succede?! Porygon si sta evolvendo!");
            gameState = STATE.EVOLVE_P1;
            evolveStartTime = performance.now();
            // Il bottone verrà trasformato in "TEXTURE VIEW" al termine dell'evoluzione
        } else if (gameState === STATE.PORYGON2) {
            viewMode = VIEW.TEXTURE;
            updateDialog("Visualizzazione impostata su: TEXTURE");
        }
    };
}

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 255, 255]));

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        function isPowerOf2(value) { return (value & (value - 1)) == 0; }
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) { gl.generateMipmap(gl.TEXTURE_2D); } 
        else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
    };
    image.src = url;
    return texture;
}

async function loadModel(basePath, objName, renderablesArray) {
    try {
        let response = await fetch(basePath + objName);
        let objText = await response.text();
        
        let mesh = new subd_mesh(); 
        let result = glmReadOBJ(objText, mesh);
        mesh = result.mesh; 

        if (result.fileMtl) {
            response = await fetch(basePath + result.fileMtl);
            let mtlText = await response.text();
            glmReadMTL(mtlText, mesh);
        }

        Unitize(mesh);
        FacetNormals(mesh);

        for (let m = 0; m < mesh.materials.length; m++) {
            const material = mesh.materials[m];
            if (material.triangles.length === 0) continue; 
            const positions = []; const normals = []; const texcoords = [];
            const linePositions = [];

            for (let t = 0; t < material.triangles.length; t++) {
                const faceIndex = material.triangles[t];
                const face = mesh.face[faceIndex];
                let triVerts = [];
                for (let j = 0; j < 3; j++) {
                    const vIdx = face.vert[j]; const vert = mesh.vert[vIdx];
                    positions.push(vert.x, vert.y, vert.z);
                    triVerts.push(vert);
                    const norm = mesh.facetnorms[faceIndex]; normals.push(norm.i, norm.j, norm.k);
                    const tIdx = face.textCoordsIndex[j];
                    if (tIdx && mesh.textCoords[tIdx]) {
                        const texC = mesh.textCoords[tIdx]; texcoords.push(texC.u, texC.v);
                    } else { texcoords.push(0, 0); }
                }
                linePositions.push(
                    triVerts[0].x, triVerts[0].y, triVerts[0].z, triVerts[1].x, triVerts[1].y, triVerts[1].z,
                    triVerts[1].x, triVerts[1].y, triVerts[1].z, triVerts[2].x, triVerts[2].y, triVerts[2].z,
                    triVerts[2].x, triVerts[2].y, triVerts[2].z, triVerts[0].x, triVerts[0].y, triVerts[0].z
                );
            }

            const pBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
            const lBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(linePositions), gl.STATIC_DRAW);
            const nBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
            const tBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);

            let texture = null;
            let mapName = material.parameter.get("map_Kd");
            if (mapName) { texture = loadTexture(gl, basePath + mapName); }

            renderablesArray.push({ positionBuffer: pBuffer, lineBuffer: lBuffer, normalBuffer: nBuffer, texcoordBuffer: tBuffer, numVertices: positions.length / 3, numLineVertices: linePositions.length / 3, texture: texture });
        }
    } catch(e) { console.error(e); }
}

async function loadPorygonModel() {
    await loadModel("assets/Porygon2/", "Porygon2.obj", renderablesPorygon2);
}

function renderModel(renderablesArray, now, projectionMatrix, viewMatrix, pokeWorldMatrix, isAssembling, programOverride = null) {
    let currentProgram;
    if (programOverride) {
        currentProgram = programOverride;
    } else {
        currentProgram = (viewMode === VIEW.SOLID || viewMode === VIEW.MESH) ? colorProgram : program;
        // Porygon1 (assembled from parts without texture) uses colorProgram always
        if (renderablesArray === renderablesPorygon1) currentProgram = colorProgram;
    }
    gl.useProgram(currentProgram);
    
    const posLoc = gl.getAttribLocation(currentProgram, "a_position");
    const normLoc = gl.getAttribLocation(currentProgram, "a_normal");
    const projLoc = gl.getUniformLocation(currentProgram, "u_projection");
    const viewLoc = gl.getUniformLocation(currentProgram, "u_view");
    const worldLoc = gl.getUniformLocation(currentProgram, "u_world");
    const lightDirLoc = gl.getUniformLocation(currentProgram, "u_reverseLightDirection");
    
    let texLoc = -1, texUniformLoc = null, colorLoc = null;
    if (currentProgram === program) {
        texLoc = gl.getAttribLocation(program, "a_texcoord");
        texUniformLoc = gl.getUniformLocation(program, "u_texture");
    } else {
        colorLoc = gl.getUniformLocation(colorProgram, "u_color");
    }

    let tAssemble = 1.0;
    if (isAssembling) {
        if (gameState === STATE.INIT) {
            tAssemble = 0.0;
        } else {
            tAssemble = Math.max(0, Math.min((now - assembleStartTime) / ASSEMBLE_DURATION, 1.0));
            // Ease out cubic
            tAssemble = 1 - Math.pow(1 - tAssemble, 3);
        }
    }

    // Applica l'effetto floating SOLO al Porygon finale / durante o post-assemblaggio in base alla tAssemble
    let floatOffset = 0;
    if (gameState !== STATE.INIT) {
        floatOffset = Math.sin(now * 0.003) * 0.1 * (isAssembling ? tAssemble : 1.0);
    }
    
    let baseWorld = m4.translate(pokeWorldMatrix, 0, floatOffset, 0);

    gl.uniformMatrix4fv(projLoc, false, projectionMatrix);
    gl.uniformMatrix4fv(viewLoc, false, viewMatrix);
    
    let lightDir = [0.5, 0.7, 1];
    let len = Math.sqrt(lightDir[0]*lightDir[0] + lightDir[1]*lightDir[1] + lightDir[2]*lightDir[2]);
    if (lightDirLoc) gl.uniform3fv(lightDirLoc, [lightDir[0]/len, lightDir[1]/len, lightDir[2]/len]);

    for (let r of renderablesArray) {

        // Trasformazione locale del pezzo: in assemblaggio interpola start->target,
        // a animazione finita applica direttamente targetMatrix (se presente).
        // Se c'è un'animazione di personalità attiva e il pezzo appartiene
        // a un gruppo coinvolto, la sua matrice di rotazione locale (pivot)
        // sostituisce la targetMatrix=identità.
        let localMatrix = null;
        if (r.targetMatrix && r.startMatrix && isAssembling) {
            localMatrix = new Float32Array(16);
            for (let i = 0; i < 16; i++) {
                localMatrix[i] = r.startMatrix[i] * (1 - tAssemble) + r.targetMatrix[i] * tAssemble;
            }
        } else if (!isAssembling && r.group) {
            const anim = computeAnimLocalMatrix(r.group);
            if (anim) localMatrix = anim;
            else if (r.targetMatrix) localMatrix = r.targetMatrix;
        } else if (r.targetMatrix) {
            localMatrix = r.targetMatrix;
        }

        let pokeWorld = localMatrix ? m4.multiply(baseWorld, localMatrix) : baseWorld;

        gl.uniformMatrix4fv(worldLoc, false, pokeWorld);

        if (viewMode === VIEW.MESH) {
            gl.bindBuffer(gl.ARRAY_BUFFER, r.lineBuffer);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

            if (normLoc >= 0) {
                gl.disableVertexAttribArray(normLoc);
                gl.vertexAttrib3f(normLoc, 0, 0, 1);
            }
            
            if (colorLoc !== null) {
                gl.uniform4fv(colorLoc, [0.0, 1.0, 0.0, 1.0]); // Verde per wireframe
            }

            gl.drawArrays(gl.LINES, 0, r.numLineVertices);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, r.positionBuffer);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

            if (normLoc >= 0) {
                gl.bindBuffer(gl.ARRAY_BUFFER, r.normalBuffer);
                gl.enableVertexAttribArray(normLoc);
                gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
            }

            if (currentProgram === program && texLoc >= 0) {
                gl.bindBuffer(gl.ARRAY_BUFFER, r.texcoordBuffer);
                gl.enableVertexAttribArray(texLoc);
                gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

                if (r.texture) {
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, r.texture);
                    gl.uniform1i(texUniformLoc, 0);
                }
            } else if (colorLoc !== null) {
                gl.uniform4fv(colorLoc, r.color ? r.color : [0.8, 0.8, 0.8, 1.0]);
            }

            gl.drawArrays(gl.TRIANGLES, 0, r.numVertices);
        }
    }
}

function render(now) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE); // Vogliamo vedere anche il retro dei poligoni durante l'assemblaggio/evoluzione

    // Transizione ASSEMBLING -> PORYGON1 sincronizzata col tempo reale
    if (gameState === STATE.ASSEMBLING && (now - assembleStartTime) >= ASSEMBLE_DURATION) {
        gameState = STATE.PORYGON1;
        // Una volta assemblato il modello, mostriamo i colori (richiesta utente).
        viewMode = VIEW.SOLID;
        updateDialog("Porygon è pronto per la battaglia cyberspaziale!");
        if (btnAtk1) btnAtk1.disabled = false;
        if (btnAtk2) btnAtk2.disabled = false;
        if (btnEvo)  btnEvo.disabled  = false;
    }

    // Aggiornamento posizione camera
    const speed = 0.1;
    // Destra / Sinistra sull'asse X
    if (keys['ArrowLeft'])  cameraPos[0] -= speed; 
    if (keys['ArrowRight']) cameraPos[0] += speed; 

    // Avanti / Indietro sull'asse Z
    if (keys['ArrowUp'])    cameraPos[2] -= speed; 
    if (keys['ArrowDown'])  cameraPos[2] += speed; 
    
    // Su / Giù sull'asse Y
    if (keys['Space'])      cameraPos[1] += speed; 
    if (keys['ShiftLeft'] || keys['ShiftRight']) cameraPos[1] -= speed; 
    
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = m4.perspective(60 * Math.PI / 180, aspect, 0.1, 100);
    
    // La camera punta sempre leggermente in basso rispetto alla sua posizione
    const cameraTarget = [cameraPos[0], cameraPos[1] - 0.5, cameraPos[2] - 4.5];
    const cameraMatrix = m4.lookAt(cameraPos, cameraTarget, [0, 1, 0]);
    const viewMatrix = m4.inverse(cameraMatrix);
    
    // Inerzia di rotazione: interpola morbidamente la rotazione attuale verso il target
    rotationX += (targetRotationX - rotationX) * 0.1;
    rotationY += (targetRotationY - rotationY) * 0.1;

    let pokeWorldMatrix = m4.identity();
    pokeWorldMatrix = m4.xRotate(pokeWorldMatrix, rotationY);
    pokeWorldMatrix = m4.yRotate(pokeWorldMatrix, rotationX);

    // Cleanup animazione di personalità a fine durata. Va fatto una sola
    // volta per frame, prima di calcolare extras o matrici locali, così da
    // permettere subito un nuovo trigger.
    if (currentAnim) {
        const tAnim = (performance.now() - currentAnim.startTime) / currentAnim.duration;
        if (tAnim >= 1) currentAnim = null;
    }

    // Trasformazioni "globali" dell'animazione di personalità (saltello,
    // leggera inclinazione in avanti). Si applicano prima delle rotazioni
    // locali per gruppo, così l'intero modello segue il movimento.
    if (gameState === STATE.PORYGON1 && currentAnim) {
        const extras = computeAnimWorldExtras();
        if (extras.translateY !== 0) {
            pokeWorldMatrix = m4.translate(pokeWorldMatrix, 0, extras.translateY, 0);
        }
        if (extras.pitchX !== 0) {
            pokeWorldMatrix = m4.xRotate(pokeWorldMatrix, extras.pitchX);
        }
    }

    // Gestione transizione evoluzione Porygon1 -> Porygon2
    let drawPorygon1 = (gameState === STATE.INIT || gameState === STATE.PORYGON1 || gameState === STATE.ASSEMBLING);
    let drawPorygon2 = (gameState === STATE.PORYGON2);
    
    if (gameState === STATE.EVOLVE_P1) {
        let elapsed = now - evolveStartTime;
        if (elapsed < evolveDuration1) {
            let t = elapsed / evolveDuration1;
            let spinAmount = t * Math.PI * 2 * 3; // Spin 3 volte
            pokeWorldMatrix = m4.yRotate(pokeWorldMatrix, spinAmount);
            drawPorygon1 = true;
        } else {
            gameState = STATE.EVOLVE_P2;
            evolveStartTime = now;
        }
    }
    
    if (gameState === STATE.EVOLVE_P2) {
        let elapsed = now - evolveStartTime;
        if (elapsed < evolveDuration2) {
            let t = elapsed / evolveDuration2;
            let spinAmount = t * Math.PI * 2 * 2; // Spin 2 volte
            pokeWorldMatrix = m4.yRotate(pokeWorldMatrix, spinAmount);
            drawPorygon2 = true;
        } else {
            gameState = STATE.PORYGON2;
            viewMode = VIEW.TEXTURE;
            updateDialog("Porygon si è evoluto in Porygon2! Visualizzazione: TEXTURE");
            if (btnEvo) btnEvo.innerText = "TEXTURE VIEW";
            drawPorygon2 = true;
        }
    }

    // 1. DISEGNO STANZA CYBERSPAZIALE
    gl.useProgram(gridProgram);
    const gProjLoc = gl.getUniformLocation(gridProgram, "u_projection");
    const gViewLoc = gl.getUniformLocation(gridProgram, "u_view");
    const gWorldLoc = gl.getUniformLocation(gridProgram, "u_world");
    const gColorLoc = gl.getUniformLocation(gridProgram, "u_color");
    const gPosLoc = gl.getAttribLocation(gridProgram, "a_position");

    gl.uniformMatrix4fv(gProjLoc, false, projectionMatrix);
    gl.uniformMatrix4fv(gViewLoc, false, viewMatrix);
    gl.uniformMatrix4fv(gWorldLoc, false, m4.identity()); // La griglia rimane ferma nel mondo!
    gl.uniform4fv(gColorLoc, [0.0, 0.8, 0.2, 0.3]); 

    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
    gl.enableVertexAttribArray(gPosLoc);
    gl.vertexAttribPointer(gPosLoc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, gridVertexCount);

    // 1b. CILINDRO DI RAGGI (solo durante l'assemblaggio)
    if (gameState === STATE.ASSEMBLING) {
        const progress = Math.min((now - assembleStartTime) / ASSEMBLE_DURATION, 1.0);
        drawAssemblyBeam(now, progress, projectionMatrix, viewMatrix);
    }


    // 2. DISEGNO PORYGON 1
    if (drawPorygon1) {
        const isAssembling1 = (gameState === STATE.INIT || gameState === STATE.ASSEMBLING);
        // Parti solide: rese sempre col color program (anche in TEXTURE mode).
        const solidParts = renderablesPorygon1.filter(r => !r.texture);
        // Parti con texture (occhi): in MESH si fa wireframe col color program,
        // altrimenti si usa il texture program.
        const texParts = renderablesPorygon1.filter(r => r.texture);
        if (solidParts.length) {
            renderModel(solidParts, now, projectionMatrix, viewMatrix, pokeWorldMatrix, isAssembling1, colorProgram);
        }
        if (texParts.length) {
            const prog = (viewMode === VIEW.MESH) ? colorProgram : program;
            renderModel(texParts, now, projectionMatrix, viewMatrix, pokeWorldMatrix, isAssembling1, prog);
        }
    }

    // 3. DISEGNO PORYGON 2 
    if (drawPorygon2) {
        renderModel(renderablesPorygon2, now, projectionMatrix, viewMatrix, pokeWorldMatrix, false);
    }

    // 4. OVERLAY: numerazione facce del corpo (solo Porygon1 assemblato).
    // Replica il calcolo di world fatto in renderModel (baseWorld con float offset).
    if (showFaceLabels && drawPorygon1 && gameState === STATE.PORYGON1) {
        const floatOffset = Math.sin(now * 0.003) * 0.1;
        const world = m4.translate(pokeWorldMatrix, 0, floatOffset, 0);
        updateFaceLabels(projectionMatrix, viewMatrix, world);
    }

    requestAnimationFrame(render);
}

function setupGUI() {
    const gui = new dat.GUI();
    const actions = {
        reset: () => { targetRotationX = 0; targetRotationY = 0; rotationX = 0; rotationY = 0; cameraPos=[0,0,4.5]; },
        atk1: () => triggerAnim('atk1'),
        atk2: () => triggerAnim('atk2'),
    };
    gui.add(actions, 'reset').name('Riavvia e Centra');
    gui.add(actions, 'atk1').name('Anim 1: Saltello [1]');
    gui.add(actions, 'atk2').name('Anim 2: Posa attacco [2]');
}
