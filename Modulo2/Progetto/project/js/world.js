// =============================================================================
// world.js — Scene, Renderer, Camera, luci, ombre e arena cyberspazio.
// Copre i fondamentali del Modulo 2: architettura Scene/Camera/Renderer,
// AmbientLight + DirectionalLight con shadow map, MeshStandardMaterial e
// InstancedMesh per i decori (ottimizzazione draw-call vista a lezione).
// =============================================================================

import * as THREE from 'three';
import { ARENA, CAMERA } from './config.js';

// Genera una texture-griglia su <canvas> (stile TRON, coerente col Modulo 1).
function makeGridTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#04130b';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(0,255,102,0.55)';
    ctx.lineWidth = 2;
    const step = 64;
    for (let i = 0; i <= 512; i += step) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    // glow ai nodi
    ctx.fillStyle = 'rgba(102,240,255,0.6)';
    for (let x = 0; x <= 512; x += step) {
        for (let y = 0; y <= 512; y += step) {
            ctx.fillRect(x - 2, y - 2, 4, 4);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(ARENA.HALF, ARENA.HALF);
    tex.anisotropy = 4;
    return tex;
}

export function createWorld(renderer) {
    // --- Scene + nebbia (profondità atmosferica) ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ARENA.FOG_COLOR);
    scene.fog = new THREE.Fog(ARENA.FOG_COLOR, ARENA.FOG_NEAR, ARENA.FOG_FAR);

    // --- Camera prospettica (terza persona) ---
    const camera = new THREE.PerspectiveCamera(
        CAMERA.FOV, window.innerWidth / window.innerHeight, CAMERA.NEAR, CAMERA.FAR
    );
    camera.position.set(0, 8, -10);

    // --- Luci: ambientale + direzionale (il "sole" che proietta le ombre) ---
    const ambient = new THREE.AmbientLight(0x88ffcc, 0.62);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xeafff2, 2.2);
    sun.position.set(16, 36, -18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    const s = ARENA.HALF + 6;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    scene.add(sun.target);

    // Tocco "neon" dal basso per staccare i modelli dal pavimento scuro.
    const rim = new THREE.HemisphereLight(0x0a3a22, 0x000000, 0.5);
    scene.add(rim);

    // --- Pavimento a griglia ---
    const groundMat = new THREE.MeshStandardMaterial({
        map: makeGridTexture(),
        color: 0x335544,
        roughness: 0.85,
        metalness: 0.2,
        emissive: 0x031a0e,
        emissiveIntensity: 0.6,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.HALF * 2, ARENA.HALF * 2), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- Pareti di confine (wireframe luminoso) ---
    addBoundaryWalls(scene);

    // --- Decori: cristalli/pilastri istanziati lungo il perimetro ---
    // Dimostra InstancedMesh: un'unica draw-call per decine di pilastri.
    addInstancedPillars(scene);

    // Riposiziona il target della shadow camera sul centro (segue il player a runtime)
    return {
        scene, camera, sun, ambient, ground,
        // Aggiorna l'area ombra perché segua il giocatore (ombre nitide ovunque).
        focusShadow(target) {
            sun.position.set(target.x + 16, 36, target.z - 18);
            sun.target.position.set(target.x, 0, target.z);
        },
    };
}

function addBoundaryWalls(scene) {
    const h = ARENA.WALL_HEIGHT;
    const half = ARENA.HALF;
    const mat = new THREE.LineBasicMaterial({ color: ARENA.GRID_COLOR, transparent: true, opacity: 0.5 });
    const pts = [];
    const step = 4;
    // Linee verticali + orizzontali sui 4 lati
    for (let i = -half; i <= half; i += step) {
        // lati lungo Z (x = ±half)
        pts.push(-half, 0, i, -half, h, i);
        pts.push(half, 0, i, half, h, i);
        // lati lungo X (z = ±half)
        pts.push(i, 0, -half, i, h, -half);
        pts.push(i, 0, half, i, h, half);
    }
    for (let y = 0; y <= h; y += 2) {
        pts.push(-half, y, -half, half, y, -half);
        pts.push(-half, y, half, half, y, half);
        pts.push(-half, y, -half, -half, y, half);
        pts.push(half, y, -half, half, y, half);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(geo, mat));
}

function addInstancedPillars(scene) {
    const COUNT = 48;
    const geo = new THREE.ConeGeometry(0.6, 4.5, 6);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x0c8c4a, emissive: 0x00ff66, emissiveIntensity: 0.35,
        roughness: 0.4, metalness: 0.6, flatShading: true,
    });
    const im = new THREE.InstancedMesh(geo, mat, COUNT);
    im.castShadow = true;
    const dummy = new THREE.Object3D();
    const half = ARENA.HALF - 1.5;
    for (let i = 0; i < COUNT; i++) {
        // distribuiti sul perimetro, alternando i quattro lati
        const side = i % 4;
        const t = (Math.floor(i / 4) / (COUNT / 4)) * 2 - 1; // -1..1
        let x = 0, z = 0;
        if (side === 0) { x = -half; z = t * half; }
        if (side === 1) { x = half;  z = t * half; }
        if (side === 2) { x = t * half; z = -half; }
        if (side === 3) { x = t * half; z = half; }
        dummy.position.set(x, 2.25, z);
        const sc = 0.7 + Math.random() * 0.8;
        dummy.scale.set(sc, sc, sc);
        dummy.rotation.y = Math.random() * Math.PI;
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
}
