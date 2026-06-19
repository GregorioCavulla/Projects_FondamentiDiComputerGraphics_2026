// =============================================================================
// beam.js — Raggio di energia con LUCE EMESSA.
// Ogni colpo crea: un nucleo bianco + un alone ciano (materiali additivi che
// "brillano"), una PointLight che lampeggia lungo il raggio (la luce vera che
// illumina la scena), un muzzle flash all'uscita e un flash d'impatto.
// =============================================================================

import * as THREE from 'three';
import { BEAM } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();

export class WeaponFX {
    constructor(scene) {
        this.scene = scene;
        this.active = [];   // raggi vivi
        this.impacts = [];  // flash d'impatto

        // Geometria condivisa: cilindro unitario lungo Y (lo scaliamo a runtime).
        this._coreGeo = new THREE.CylinderGeometry(BEAM.RADIUS * 0.4, BEAM.RADIUS * 0.4, 1, 8);
        this._glowGeo = new THREE.CylinderGeometry(BEAM.RADIUS, BEAM.RADIUS * 0.6, 1, 10);
        this._flashGeo = new THREE.SphereGeometry(0.28, 12, 12);
    }

    // Crea un raggio visivo da `start` a `end` con la sua luce.
    spawnBeam(start, end) {
        _dir.subVectors(end, start);
        const len = _dir.length();
        if (len < 0.001) return;
        _dir.normalize();
        _quat.setFromUnitVectors(UP, _dir);
        _mid.copy(start).addScaledVector(_dir, len * 0.5);

        const group = new THREE.Group();

        const glowMat = new THREE.MeshBasicMaterial({
            color: BEAM.COLOR, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const coreMat = new THREE.MeshBasicMaterial({
            color: BEAM.CORE_COLOR, transparent: true, opacity: 0.95,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const glow = new THREE.Mesh(this._glowGeo, glowMat);
        const core = new THREE.Mesh(this._coreGeo, coreMat);
        for (const m of [glow, core]) {
            m.position.copy(_mid);
            m.quaternion.copy(_quat);
            m.scale.set(1, len, 1);
            group.add(m);
        }

        // LUCE EMESSA: una point light a metà raggio + una all'uscita.
        const light = new THREE.PointLight(BEAM.COLOR, BEAM.LIGHT_INTENSITY, BEAM.LIGHT_DISTANCE, 2);
        light.position.copy(_mid);
        group.add(light);

        const muzzle = new THREE.PointLight(BEAM.CORE_COLOR, BEAM.LIGHT_INTENSITY * 0.8, 10, 2);
        muzzle.position.copy(start);
        group.add(muzzle);

        // Muzzle flash visivo
        const flash = new THREE.Mesh(this._flashGeo, new THREE.MeshBasicMaterial({
            color: BEAM.COLOR, transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        flash.position.copy(start);
        group.add(flash);

        this.scene.add(group);
        this.active.push({ group, light, muzzle, glowMat, coreMat, flash, t: 0 });
    }

    // Flash espandente nel punto d'impatto (quando il raggio colpisce un nemico).
    spawnImpact(point, color = BEAM.COLOR) {
        const mat = new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 1,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const mesh = new THREE.Mesh(this._flashGeo, mat);
        mesh.position.copy(point);
        const light = new THREE.PointLight(color, 6, 14, 2);
        light.position.copy(point);
        const group = new THREE.Group();
        group.add(mesh); group.add(light);
        this.scene.add(group);
        this.impacts.push({ group, mesh, light, mat, t: 0 });
    }

    update(dt) {
        // Raggi: fade-out rapido entro BEAM.LIFETIME
        for (let i = this.active.length - 1; i >= 0; i--) {
            const b = this.active[i];
            b.t += dt;
            const k = b.t / BEAM.LIFETIME; // 0..1
            if (k >= 1) {
                this.scene.remove(b.group);
                b.glowMat.dispose(); b.coreMat.dispose();
                b.flash.material.dispose();
                this.active.splice(i, 1);
                continue;
            }
            const fade = 1 - k;
            b.glowMat.opacity = 0.6 * fade;
            b.coreMat.opacity = 0.95 * fade;
            b.light.intensity = BEAM.LIGHT_INTENSITY * fade;
            b.muzzle.intensity = BEAM.LIGHT_INTENSITY * 0.8 * fade;
            const fs = 1 + k * 3;
            b.flash.scale.setScalar(fs);
            b.flash.material.opacity = 0.9 * fade;
        }
        // Impatti: anello che si espande e svanisce
        for (let i = this.impacts.length - 1; i >= 0; i--) {
            const im = this.impacts[i];
            im.t += dt;
            const k = im.t / 0.28;
            if (k >= 1) {
                this.scene.remove(im.group);
                im.mat.dispose();
                this.impacts.splice(i, 1);
                continue;
            }
            im.mesh.scale.setScalar(0.5 + k * 4);
            im.mat.opacity = 1 - k;
            im.light.intensity = 6 * (1 - k);
        }
    }
}
