"use strict";

// =====================================================================
//  SFONDO / AMBIENTAZIONE (backdrop a schermo intero)
// ---------------------------------------------------------------------
//  L'immagine di sfondo (assets/skybox/SilphUpscaled.png) è una SCENA
//  PIATTA (non una panoramica a 360°), quindi la usiamo come "fondale":
//  un quad che riempie lo schermo dietro Porygon e resta fisso.
//
//  Per non deformarla si usa un adattamento "cover" (riempi lo schermo
//  mantenendo le proporzioni, ritagliando l'eccedenza).
//
//  (Per caricare l'immagine serve un server locale, non file://.)
// =====================================================================

let skyboxProgram;          // shader del fondale
let skyboxQuadBuffer;       // posizioni del quad (clip space)
let skyboxUVBuffer;         // coordinate texture del quad
let skyboxTexture = null;   // immagine di sfondo
let skyboxReady = false;    // true quando l'immagine è caricata

const BACKDROP_URL = "assets/skybox/SilphUpscaled.png";
const BACKDROP_ASPECT = 2752 / 1536; // proporzioni dell'immagine (per il "cover")

// Prepara shader, quad e avvia il caricamento dell'immagine di sfondo.
function setupSkybox() {
    skyboxProgram = webglUtils.createProgramFromScripts(
        gl, ["backdrop-vertex-shader", "backdrop-fragment-shader"]);

    // Quad a schermo intero (2 triangoli) in coordinate clip [-1, 1].
    const quad = new Float32Array([
        -1, -1,   1, -1,   -1, 1,
        -1,  1,   1, -1,    1, 1,
    ]);
    skyboxQuadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyboxQuadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    // Coordinate texture corrispondenti (angoli dell'immagine).
    const uvs = new Float32Array([
        0, 0,   1, 0,   0, 1,
        0, 1,   1, 0,   1, 1,
    ]);
    skyboxUVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyboxUVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    // Texture: pixel neutro finché l'immagine non è caricata.
    skyboxTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, skyboxTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
        gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 30, 255]));

    const img = new Image();
    img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, skyboxTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // origine immagine in alto
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        // Immagine non potenza di 2: niente mipmap, filtri lineari + clamp.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        skyboxReady = true;
        console.log("Sfondo caricato.");
    };
    img.onerror = () => console.warn("Sfondo: immagine mancante ->", BACKDROP_URL);
    img.src = BACKDROP_URL;
}

// Disegna il fondale riempiendo lo schermo. I parametri projection/view non
// servono (il fondale è fisso), ma mantengo la firma comune agli altri draw.
function drawSkybox(projection, view) {
    gl.useProgram(skyboxProgram);

    const posLoc   = gl.getAttribLocation(skyboxProgram, "a_position");
    const uvLoc    = gl.getAttribLocation(skyboxProgram, "a_texcoord");
    const scaleLoc = gl.getUniformLocation(skyboxProgram, "u_uvScale");
    const texLoc   = gl.getUniformLocation(skyboxProgram, "u_backdrop");

    // Adattamento "cover": ridimensiono le UV per riempire lo schermo senza
    // deformare l'immagine (ritaglio il lato in eccesso).
    const canvasAspect = gl.canvas.width / gl.canvas.height;
    let sx = 1, sy = 1;
    if (canvasAspect > BACKDROP_ASPECT) sy = BACKDROP_ASPECT / canvasAspect; // ritaglio sopra/sotto
    else                                sx = canvasAspect / BACKDROP_ASPECT; // ritaglio ai lati
    gl.uniform2f(scaleLoc, sx, sy);

    gl.bindBuffer(gl.ARRAY_BUFFER, skyboxQuadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, skyboxUVBuffer);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, skyboxTexture);
    gl.uniform1i(texLoc, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
