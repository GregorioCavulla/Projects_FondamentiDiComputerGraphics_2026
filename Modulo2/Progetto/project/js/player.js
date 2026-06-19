// =============================================================================
// player.js — Porygon-Z: controllo in terza persona + telecamera al seguito.
// Gestisce movimento (WASD relativo allo yaw), mira (mouse in pointer lock),
// hover/bob procedurale e il posizionamento orbitale della camera dietro al
// modello. Espone muzzle e direzione di mira per l'arma.
// =============================================================================

import * as THREE from 'three';
import { PLAYER, CAMERA, ARENA } from './config.js';

export class Player {
    constructor(modelWrap, camera) {
        this.camera = camera;
        this.yaw = 0;
        this.pitch = 0.05;
        this.hp = PLAYER.MAX_HP;
        this.alive = true;
        this.pos = new THREE.Vector3(0, 0, 0);
        this.hover = 0.35;
        this._t = 0;
        this._moving = false;

        // Gerarchia: object (rig, ruota con lo yaw) → inner (hover/bob) → modello.
        this.object = new THREE.Group();
        this.inner = new THREE.Group();
        modelWrap.rotation.y = PLAYER.MODEL_YAW_OFFSET; // orienta il "fronte" del GLB
        this.inner.add(modelWrap);
        this.object.add(this.inner);

        // vettori riusabili (no allocazioni nel loop)
        this._fwd = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._move = new THREE.Vector3();
        this._aim = new THREE.Vector3();
        this._muzzle = new THREE.Vector3();
    }

    reset() {
        this.hp = PLAYER.MAX_HP;
        this.alive = true;
        this.yaw = 0; this.pitch = 0.1;
        this.pos.set(0, 0, 0);
        this.object.position.set(0, 0, 0);
    }

    // Direzione "avanti" sul piano XZ a partire dallo yaw.
    forward(out) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

    update(dt, input) {
        // --- Mira: il mouse (pointer lock) muove yaw e pitch ---
        const md = input.consumeMouseDelta();
        this.yaw -= md.dx * CAMERA.SENS;
        this.pitch -= md.dy * CAMERA.SENS;
        this.pitch = Math.max(CAMERA.PITCH_MIN, Math.min(CAMERA.PITCH_MAX, this.pitch));

        // --- Movimento relativo allo yaw ---
        this.forward(this._fwd);
        this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); // perpendicolare a fwd
        this._move.set(0, 0, 0);
        if (input.keys.has('KeyW')) this._move.add(this._fwd);
        if (input.keys.has('KeyS')) this._move.sub(this._fwd);
        if (input.keys.has('KeyD')) this._move.sub(this._right);
        if (input.keys.has('KeyA')) this._move.add(this._right);

        this._moving = this._move.lengthSq() > 0.0001;
        if (this._moving) {
            this._move.normalize();
            const sprint = (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')) ? 1.7 : 1;
            this.pos.addScaledVector(this._move, PLAYER.SPEED * sprint * dt);
            // confini arena
            const lim = ARENA.HALF - PLAYER.RADIUS;
            this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
            this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
        }

        // --- Hover + bob procedurale (Porygon-Z fluttua) ---
        this._t += dt;
        const bob = Math.sin(this._t * 4) * (this._moving ? 0.14 : 0.07);
        this.inner.position.y = this.hover + bob;
        this.inner.rotation.z = Math.sin(this._t * 2.2) * 0.05; // lieve rollio

        // --- Applica trasformazioni al rig ---
        this.object.position.copy(this.pos);
        this.object.rotation.y = this.yaw;

        this.updateCamera();
    }

    // Telecamera orbitale dietro al giocatore, con pitch.
    updateCamera() {
        this.forward(this._fwd);
        const horiz = Math.cos(this.pitch) * CAMERA.DISTANCE;
        const vert = CAMERA.HEIGHT + Math.sin(this.pitch) * CAMERA.DISTANCE;
        this.camera.position.set(
            this.pos.x - this._fwd.x * horiz,
            this.pos.y + vert,
            this.pos.z - this._fwd.z * horiz
        );
        this.camera.lookAt(this.pos.x, this.pos.y + CAMERA.LOOK_HEIGHT, this.pos.z);
    }

    // Punto di uscita del raggio (davanti e in alto rispetto al corpo).
    getMuzzle() {
        this.forward(this._fwd);
        return this._muzzle.set(
            this.pos.x + this._fwd.x * PLAYER.MUZZLE_FWD,
            this.pos.y + PLAYER.MUZZLE_HEIGHT,
            this.pos.z + this._fwd.z * PLAYER.MUZZLE_FWD
        );
    }

    // Direzione di mira: orizzontale nel verso in cui guarda Porygon-Z (lo
    // sparo segue il muso, non l'inclinazione della telecamera → colpisce in
    // modo affidabile i nemici a terra). Leggera pendenza verso il basso.
    getAimDir() {
        this.forward(this._fwd);
        return this._aim.set(this._fwd.x, -0.06, this._fwd.z).normalize();
    }

    takeDamage(amount) {
        if (!this.alive) return;
        this.hp -= amount;
        if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    }
}
