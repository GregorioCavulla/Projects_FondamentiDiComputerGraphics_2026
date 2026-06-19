// =============================================================================
// main.js — Bootstrap, game loop, macchina a stati, input e HUD.
// Coerente con il Modulo 1: una FSM coordina menu → gioco → game over/vittoria.
// =============================================================================

import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

import { createWorld } from './world.js';
import { loadAllAssets, normalizeModel } from './loaders.js';
import { Player } from './player.js';
import { EnemyManager } from './enemies.js';
import { WeaponFX } from './beam.js';
import { PLAYER, BEAM, CAMERA, WAVES } from './config.js';

// --- Stati di gioco ---
const STATE = Object.freeze({
    LOADING: 'LOADING', MENU: 'MENU', PLAYING: 'PLAYING',
    GAMEOVER: 'GAMEOVER', VICTORY: 'VICTORY',
});

// --- Riferimenti DOM (HUD) ---
const $ = (id) => document.getElementById(id);
const dom = {
    loading: $('screen-loading'), loadbar: $('loadbar-fill'),
    menu: $('screen-menu'), gameover: $('screen-gameover'), victory: $('screen-victory'),
    valWave: $('val-wave'), valEnemies: $('val-enemies'), valScore: $('val-score'),
    hpFill: $('healthbar-fill'),
    msg: $('message-center'), msgMain: $('message-main'), msgSub: $('message-sub'),
    finalScore: $('final-score'), finalScoreWin: $('final-score-win'),
};

// --- Stato runtime ---
let renderer, world, scene, camera;
let player, enemyMgr, weaponFX;
let clock;
let gameState = STATE.LOADING;
let score = 0;
let waveIndex = -1;
let waveActive = false;
let waveClearedTimer = 0;
let fireCooldown = 0;
const baseSens = CAMERA.SENS;

// --- Input ---
const input = {
    keys: new Set(), locked: false, firing: false, _dx: 0, _dy: 0,
    consumeMouseDelta() { const d = { dx: this._dx, dy: this._dy }; this._dx = 0; this._dy = 0; return d; },
};

// =============================================================================
// INIT
// =============================================================================
async function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    Object.assign(renderer.domElement.style, { position: 'fixed', top: '0', left: '0', zIndex: '0' });
    document.body.appendChild(renderer.domElement);

    world = createWorld(renderer);
    scene = world.scene;
    camera = world.camera;
    weaponFX = new WeaponFX(scene);
    clock = new THREE.Clock();

    setupInput();
    setupGUI();
    window.addEventListener('resize', onResize);

    // Caricamento asset con barra di avanzamento
    const assets = await loadAllAssets((p) => { dom.loadbar.style.width = `${Math.round(p * 100)}%`; });

    // Player
    const playerWrap = normalizeModel(assets.player, PLAYER.HEIGHT);
    player = new Player(playerWrap, camera);
    scene.add(player.object);

    // Nemici
    enemyMgr = new EnemyManager(scene, player, assets, weaponFX, {
        onKill: (pts) => { score += pts; updateHUD(); },
        onContact: (dmg) => {
            player.takeDamage(dmg);
            if (!player.alive) gameOver();
        },
    });

    // Hook di diagnostica opzionale: attivo solo con ?debug nell'URL.
    if (new URLSearchParams(location.search).has('debug')) {
        window.__game = { player, enemyMgr, camera, scene, THREE, fire };
    }

    // Pronto: vai al menu
    setState(STATE.MENU);
    animate();
}

// =============================================================================
// MACCHINA A STATI
// =============================================================================
function setState(s) {
    gameState = s;
    dom.menu.classList.toggle('hidden', s !== STATE.MENU);
    dom.gameover.classList.toggle('hidden', s !== STATE.GAMEOVER);
    dom.victory.classList.toggle('hidden', s !== STATE.VICTORY);
    dom.loading.classList.toggle('hidden', s !== STATE.LOADING);
}

function startGame() {
    score = 0;
    waveIndex = -1;
    waveActive = false;
    waveClearedTimer = 0;
    fireCooldown = 0;
    enemyMgr.clearAll();
    player.reset();
    updateHUD();
    setState(STATE.PLAYING);
    renderer.domElement.requestPointerLock();
    startNextWave();
}

function startNextWave() {
    waveIndex++;
    if (waveIndex >= WAVES.length) { victory(); return; }
    const wave = WAVES[waveIndex];
    enemyMgr.startWave(wave);
    waveActive = true;
    showMessage(`ONDATA ${waveIndex + 1}/${WAVES.length}`, wave.name, 2.6);
    updateHUD();
}

function gameOver() {
    setState(STATE.GAMEOVER);
    document.exitPointerLock();
    dom.finalScore.textContent = score;
}

function victory() {
    setState(STATE.VICTORY);
    document.exitPointerLock();
    dom.finalScoreWin.textContent = score;
}

// =============================================================================
// SPARO
// =============================================================================
function fire() {
    const muzzle = player.getMuzzle().clone();
    const dir = player.getAimDir().clone().normalize();
    const hit = enemyMgr.fireRay(muzzle, dir, BEAM.DAMAGE, BEAM.RANGE);
    const end = hit
        ? hit.point
        : muzzle.clone().addScaledVector(dir, BEAM.RANGE);
    weaponFX.spawnBeam(muzzle, end);
    if (hit) updateHUD();
}

// =============================================================================
// HUD
// =============================================================================
function updateHUD() {
    dom.valWave.textContent = `${Math.max(1, waveIndex + 1)}/${WAVES.length}`;
    dom.valEnemies.textContent = enemyMgr ? enemyMgr.remaining : 0;
    dom.valScore.textContent = score;
    const pct = player ? (player.hp / PLAYER.MAX_HP) * 100 : 100;
    dom.hpFill.style.width = `${pct}%`;
    if (pct > 50) dom.hpFill.style.background = 'linear-gradient(90deg,#00ff66,#66f0ff)';
    else if (pct > 25) dom.hpFill.style.background = 'linear-gradient(90deg,#ffe066,#ffaa33)';
    else dom.hpFill.style.background = 'linear-gradient(90deg,#ff4060,#ff7050)';
}

let msgTimer = null;
function showMessage(main, sub = '', dur = 2) {
    dom.msgMain.textContent = main;
    dom.msgSub.textContent = sub;
    dom.msg.classList.add('show');
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => dom.msg.classList.remove('show'), dur * 1000);
}

// =============================================================================
// INPUT (tastiera + mouse con pointer lock)
// =============================================================================
function setupInput() {
    addEventListener('keydown', (e) => input.keys.add(e.code));
    addEventListener('keyup', (e) => input.keys.delete(e.code));

    const canvas = renderer.domElement;
    document.addEventListener('pointerlockchange', () => {
        input.locked = document.pointerLockElement === canvas;
        if (!input.locked) input.firing = false;
    });
    addEventListener('mousemove', (e) => {
        if (input.locked) { input._dx += e.movementX; input._dy += e.movementY; }
    });
    addEventListener('mousedown', (e) => {
        if (gameState !== STATE.PLAYING || e.button !== 0) return;
        if (!input.locked) canvas.requestPointerLock();
        else input.firing = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) input.firing = false; });

    $('btn-start').addEventListener('click', startGame);
    $('btn-retry').addEventListener('click', startGame);
    $('btn-again').addEventListener('click', startGame);
}

function setupGUI() {
    const gui = new GUI({ title: 'Impostazioni' });
    const settings = { ombre: true, sensibilita: 1.0, esposizione: 1.05 };
    gui.add(settings, 'ombre').name('Ombre').onChange((v) => {
        renderer.shadowMap.enabled = v;
        scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    });
    gui.add(settings, 'sensibilita', 0.3, 2.5, 0.1).name('Sensibilità mira')
        .onChange((v) => { CAMERA.SENS = baseSens * v; });
    gui.add(settings, 'esposizione', 0.5, 2.0, 0.05).name('Esposizione')
        .onChange((v) => { renderer.toneMappingExposure = v; });
    gui.close();
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// =============================================================================
// LOOP
// =============================================================================
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (gameState === STATE.PLAYING) {
        player.update(dt, input);
        world.focusShadow(player.pos);
        enemyMgr.update(dt);

        // Sparo con cooldown
        fireCooldown -= dt;
        if (input.firing && fireCooldown <= 0) {
            fire();
            fireCooldown = BEAM.COOLDOWN;
        }

        // Avanzamento ondate
        if (waveActive && enemyMgr.remaining === 0) {
            waveActive = false;
            waveClearedTimer = 2.2;
            showMessage('ONDATA RIPULITA', 'Preparati alla prossima…', 2.2);
        }
        if (!waveActive && waveClearedTimer > 0) {
            waveClearedTimer -= dt;
            if (waveClearedTimer <= 0) startNextWave();
        }

        updateHUD();
    }

    weaponFX.update(dt);
    renderer.render(scene, camera);
}

init();
