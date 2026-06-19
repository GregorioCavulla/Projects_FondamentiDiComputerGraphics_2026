// =============================================================================
// loaders.js — Caricamento dei modelli GLB e normalizzazione.
// I .glb non contengono clip di animazione: l'animazione sarà procedurale
// (coerente con l'approccio del Modulo 1). Qui normalizziamo scala e pivot
// così ogni modello ha i "piedi" a y=0 e un'altezza nota.
// =============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER, ENEMY_TYPES } from './config.js';

const loader = new GLTFLoader();

const _v = new THREE.Vector3();

// Bounding box "reale" del modello tenendo conto dello skinning: per le
// SkinnedMesh la box di geometria (bind pose) può non rispecchiare il render
// perché l'armatura scala/sposta i vertici. Qui applichiamo le trasformazioni
// delle ossa vertice per vertice → dimensioni corrette anche con rig scalati.
function computeRenderBounds(object) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3();
    object.traverse((o) => {
        if (o.isSkinnedMesh && o.skeleton && o.geometry?.attributes?.position) {
            const pos = o.geometry.attributes.position;
            const fn = o.applyBoneTransform ? 'applyBoneTransform' : 'boneTransform';
            for (let i = 0; i < pos.count; i++) {
                _v.fromBufferAttribute(pos, i);
                o[fn](i, _v);
                o.localToWorld(_v);
                box.expandByPoint(_v);
            }
        } else if (o.isMesh && o.geometry) {
            o.updateWorldMatrix(true, false);
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            const gb = o.geometry.boundingBox;
            for (let xi = 0; xi < 2; xi++)
                for (let yi = 0; yi < 2; yi++)
                    for (let zi = 0; zi < 2; zi++) {
                        _v.set(xi ? gb.max.x : gb.min.x, yi ? gb.max.y : gb.min.y, zi ? gb.max.z : gb.min.z);
                        o.localToWorld(_v);
                        box.expandByPoint(_v);
                    }
        }
    });
    return box;
}

function loadGLB(url) {
    return new Promise((resolve, reject) => {
        loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
}

// Ridimensiona e ricentra il modello: lo racchiude in un gruppo con i piedi
// a y=0 e centrato su X/Z, scalato all'altezza target. Abilita ombre.
export function normalizeModel(object, targetHeight) {
    const box = computeRenderBounds(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const scale = targetHeight / (size.y || 1);
    const wrap = new THREE.Group();
    object.scale.setScalar(scale);
    // centra su X/Z e porta il fondo (min.y) a 0
    object.position.x = -center.x * scale;
    object.position.z = -center.z * scale;
    object.position.y = -box.min.y * scale;

    object.traverse((n) => {
        if (n.isMesh) {
            n.castShadow = true;
            n.receiveShadow = true;
            if (n.material) n.material.envMapIntensity = 0.6;
        }
    });
    wrap.add(object);
    return wrap;
}

// Carica player + tutti i prototipi nemici. onProgress(0..1) per la UI.
export async function loadAllAssets(onProgress) {
    const tasks = [
        { key: 'player', url: 'assets/porygon-z.glb' },
        ...Object.entries(ENEMY_TYPES).map(([key, t]) => ({ key, url: t.file })),
    ];
    const total = tasks.length;
    let done = 0;
    const out = {};
    for (const task of tasks) {
        out[task.key] = await loadGLB(task.url);
        done++;
        if (onProgress) onProgress(done / total);
    }
    return out; // { player: Scene, gible: Scene, gabite: Scene, garchomp: Scene }
}
