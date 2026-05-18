"use strict";

let gl;
let program, gridProgram, colorProgram;
let renderables = []; 

// Buffer per la stanza cubo/grigliata
let gridBuffer, gridVertexCount;

// Buffer per Primitive Porygon 1
let p1CubePosBuffer, p1CubeNormBuffer, p1CubeCount;

// Macchina a stati generale
let gameState = 'INIT'; // INIT, ASSEMBLING, PORYGON1, PORYGON2
let evolutionProgress = 0.0;

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationX = 0;
let rotationY = 0;
let targetRotationX = 0;
let targetRotationY = 0;

// Variabili per il movimento della telecamera
let cameraPos = [0, 0, 4.5];
let keys = {};

async function main() {
    const canvas = document.getElementById("webgl-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) { alert("WebGL non supportato!"); return; }

    // Shader Porygon Form
    program = webglUtils.createProgramFromScripts(gl, ["vertex-shader", "fragment-shader"]);
    // Shader Stanza Cyberspazio
    gridProgram = webglUtils.createProgramFromScripts(gl, ["grid-vertex-shader", "grid-fragment-shader"]);
    // Shader Colore Basic per Porygon 1
    colorProgram = webglUtils.createProgramFromScripts(gl, ["color-vertex-shader", "color-fragment-shader"]);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Sfondo nero assoluto

    setupHUD();
    setupGUI();
    createGridRoom();
    initPorygon1Buffers();

    canvas.addEventListener('mousedown', (e) => { isDragging = true; previousMousePosition = { x: e.offsetX, y: e.offsetY }; });
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            targetRotationX += (e.offsetX - previousMousePosition.x) * 0.01;
            targetRotationY += (e.offsetY - previousMousePosition.y) * 0.01;
            previousMousePosition = { x: e.offsetX, y: e.offsetY };
        }
    });
    window.addEventListener('mouseup', () => { isDragging = false; });
    
    // Ascoltatori per il movimento da tastiera
    window.addEventListener('keydown', (e) => { keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    await loadPorygonModel();
    requestAnimationFrame(render);
}

function initPorygon1Buffers() {
    // Inseriamo il cubo base di Porygon 1 nel buffer WebGL
    p1CubeCount = porygon1Primitives.cubePositions.length / 3;
    
    p1CubePosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, p1CubePosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, porygon1Primitives.cubePositions, gl.STATIC_DRAW);
    
    p1CubeNormBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, p1CubeNormBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, porygon1Primitives.cubeNormals, gl.STATIC_DRAW);
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
}

function updateDialog(text) {
    document.getElementById("dialog-box").innerText = text;
}

function setupHUD() {
    const btnStart = document.getElementById("btn-startup");
    const btnAtk1 = document.getElementById("btn-azione1");
    const btnAtk2 = document.getElementById("btn-azione2");
    const btnEvo = document.getElementById("btn-evolve");

    btnStart.onclick = () => {
        btnStart.disabled = true;
        updateDialog("Inizializzazione cyberspazio... Assemblaggio Porygon in corso!");
        gameState = 'ASSEMBLING';
        
        // Simulo la fine dell'animazione dopo 3 sec:
        setTimeout(() => {
            gameState = 'PORYGON1';
            updateDialog("Porygon è pronto per la battaglia cyberspaziale!");
            btnAtk1.disabled = false;
            btnAtk2.disabled = false;
            btnEvo.disabled = false;
        }, 3000);
    };

    btnAtk1.onclick = () => updateDialog("Porygon usa TACKLE!");
    btnAtk2.onclick = () => updateDialog("Porygon usa CYBER-DASH!");
    
    btnEvo.onclick = () => {
        updateDialog("Che succede?! Porygon si sta evolvendo!");
        gameState = 'EVOLVE';
        btnEvo.disabled = true;
        
        // Simula termine evoluzione
        setTimeout(() => {
            gameState = 'PORYGON2';
            updateDialog("Porygon si è evoluto in Porygon2!");
        }, 2000);
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

async function loadPorygonModel() {
    try {
        const basePath = "assets/Porygon2/";
        let response = await fetch(basePath + "Porygon2.obj");
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

            for (let t = 0; t < material.triangles.length; t++) {
                const faceIndex = material.triangles[t];
                const face = mesh.face[faceIndex];
                for (let j = 0; j < 3; j++) {
                    const vIdx = face.vert[j]; const vert = mesh.vert[vIdx];
                    positions.push(vert.x, vert.y, vert.z);
                    const norm = mesh.facetnorms[faceIndex]; normals.push(norm.i, norm.j, norm.k);
                    const tIdx = face.textCoordsIndex[j];
                    if (tIdx && mesh.textCoords[tIdx]) {
                        const texC = mesh.textCoords[tIdx]; texcoords.push(texC.u, texC.v);
                    } else { texcoords.push(0, 0); }
                }
            }

            const pBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
            const nBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
            const tBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);

            let texture = null;
            let mapName = material.parameter.get("map_Kd");
            if (mapName) { texture = loadTexture(gl, basePath + mapName); }

            renderables.push({ positionBuffer: pBuffer, normalBuffer: nBuffer, texcoordBuffer: tBuffer, numVertices: positions.length / 3, texture: texture });
        }
    } catch(e) { console.error(e); }
}

// === GRAFO DI SCENA PORYGON 1 ===
function drawCube(projectionMatrix, viewMatrix, parentMatrix, localTransform, color) {
    let worldMatrix = m4.multiply(parentMatrix, localTransform);
    
    gl.useProgram(colorProgram);
    
    const posLoc = gl.getAttribLocation(colorProgram, "a_position");
    const normLoc = gl.getAttribLocation(colorProgram, "a_normal");
    const projLoc = gl.getUniformLocation(colorProgram, "u_projection");
    const viewLoc = gl.getUniformLocation(colorProgram, "u_view");
    const worldLoc = gl.getUniformLocation(colorProgram, "u_world");
    const colorLoc = gl.getUniformLocation(colorProgram, "u_color");
    const lightDirLoc = gl.getUniformLocation(colorProgram, "u_reverseLightDirection");

    // Setup uniformi
    gl.uniformMatrix4fv(projLoc, false, projectionMatrix);
    gl.uniformMatrix4fv(viewLoc, false, viewMatrix);
    gl.uniformMatrix4fv(worldLoc, false, worldMatrix);
    gl.uniform4fv(colorLoc, color);
    
    let lightDir = [0.5, 0.7, 1];
    let len = Math.sqrt(lightDir[0]*lightDir[0] + lightDir[1]*lightDir[1] + lightDir[2]*lightDir[2]);
    gl.uniform3fv(lightDirLoc, [lightDir[0]/len, lightDir[1]/len, lightDir[2]/len]);

    // Draw cube
    gl.bindBuffer(gl.ARRAY_BUFFER, p1CubePosBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, p1CubeNormBuffer);
    gl.enableVertexAttribArray(normLoc);
    gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, p1CubeCount);
}

function renderPorygon1(now, projectionMatrix, viewMatrix, worldMatrix) {
    const pink = [0.93, 0.6, 0.6, 1.0];
    const cyan = [0.4, 0.8, 0.8, 1.0];

    // Nodo radice Porygon1 (addossa ad un po' di fluttuazione Y)
    let p1Root = m4.translate(worldMatrix, 0, Math.sin(now * 0.003)*0.1, 0);

    // Corpo
    let bodyTransform = m4.scaling(0.6, 0.5, 0.6);
    drawCube(projectionMatrix, viewMatrix, p1Root, bodyTransform, pink);

    // Testa
    // Messa in alto, spostata in avanti (Z = positivo perchè lookAt usa -Z per depth?) 
    // La nostra camera è a z=4.5 guarda a z=0.
    let headTransform = m4.translation(0, 0.5, 0.35);
    headTransform = m4.multiply(headTransform, m4.scaling(0.4, 0.4, 0.4));
    drawCube(projectionMatrix, viewMatrix, p1Root, headTransform, pink);

    // Becco
    let beakTransform = m4.translation(0, 0.4, 0.65);
    beakTransform = m4.multiply(beakTransform, m4.scaling(0.2, 0.15, 0.3));
    drawCube(projectionMatrix, viewMatrix, p1Root, beakTransform, cyan);

    // Gamba SX
    let legLTransform = m4.translation(0.4, -0.3, 0);
    legLTransform = m4.multiply(legLTransform, m4.scaling(0.25, 0.3, 0.4));
    drawCube(projectionMatrix, viewMatrix, p1Root, legLTransform, cyan);

    // Gamba DX
    let legRTransform = m4.translation(-0.4, -0.3, 0);
    legRTransform = m4.multiply(legRTransform, m4.scaling(0.25, 0.3, 0.4));
    drawCube(projectionMatrix, viewMatrix, p1Root, legRTransform, cyan);

    // Coda
    let tailTransform = m4.translation(0, -0.1, -0.4);
    tailTransform = m4.multiply(tailTransform, m4.scaling(0.3, 0.2, 0.4));
    drawCube(projectionMatrix, viewMatrix, p1Root, tailTransform, cyan);
}

function render(now) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
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


    // 2. DISEGNO PORYGON 1
    if (gameState === 'PORYGON1' || gameState === 'ASSEMBLING') {
        renderPorygon1(now, projectionMatrix, viewMatrix, pokeWorldMatrix);
    }

    // 3. DISEGNO PORYGON 2 
    if (gameState === 'PORYGON2' || gameState === 'EVOLVE') {
        gl.useProgram(program);
        const posLoc = gl.getAttribLocation(program, "a_position");
        const normLoc = gl.getAttribLocation(program, "a_normal");
        const texLoc = gl.getAttribLocation(program, "a_texcoord");
        const projLoc = gl.getUniformLocation(program, "u_projection");
        const viewLoc = gl.getUniformLocation(program, "u_view");
        const worldLoc = gl.getUniformLocation(program, "u_world");
        const lightDirLoc = gl.getUniformLocation(program, "u_reverseLightDirection");
        const texUniformLoc = gl.getUniformLocation(program, "u_texture");

        let pokeWorld = m4.translate(pokeWorldMatrix, 0, 0, 0); 
        if(gameState === 'EVOLVE') { pokeWorld = m4.yRotate(pokeWorld, now * 0.015); }

        gl.uniformMatrix4fv(projLoc, false, projectionMatrix);
        gl.uniformMatrix4fv(viewLoc, false, viewMatrix);
        gl.uniformMatrix4fv(worldLoc, false, pokeWorld);
        
        let lightDir = [0.5, 0.7, 1];
        let len = Math.sqrt(lightDir[0]*lightDir[0] + lightDir[1]*lightDir[1] + lightDir[2]*lightDir[2]);
        gl.uniform3fv(lightDirLoc, [lightDir[0]/len, lightDir[1]/len, lightDir[2]/len]);

        for (let r of renderables) {
            gl.bindBuffer(gl.ARRAY_BUFFER, r.positionBuffer);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, r.normalBuffer);
            gl.enableVertexAttribArray(normLoc);
            gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, r.texcoordBuffer);
            gl.enableVertexAttribArray(texLoc);
            gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

            if (r.texture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, r.texture);
                gl.uniform1i(texUniformLoc, 0);
            }

            gl.drawArrays(gl.TRIANGLES, 0, r.numVertices);
        }
    }
    
    requestAnimationFrame(render);
}

function setupGUI() {
    const gui = new dat.GUI();
    const actions = { reset: () => { targetRotationX = 0; targetRotationY = 0; rotationX = 0; rotationY = 0; cameraPos=[0,0,4.5]; } };
    gui.add(actions, 'reset').name('Riavvia e Centra');
}
