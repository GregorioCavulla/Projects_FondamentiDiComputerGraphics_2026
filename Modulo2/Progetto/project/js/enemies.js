// =============================================================================
// enemies.js — Gible / Gabite / Garchomp: spawn, inseguimento, ondate, danni.
// I modelli sono riggati (skinned): per clonarli serve SkeletonUtils.clone.
// L'hit-test del raggio usa un'intersezione raggio-sfera analitica (niente
// raycast su mesh skinnate: più veloce e robusto).
// =============================================================================

import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { normalizeModel } from './loaders.js';
import { ENEMY_TYPES, SPAWN, ARENA } from './config.js';

const _d = new THREE.Vector3();
const _oc = new THREE.Vector3();
const _hit = new THREE.Vector3();

// Intersezione raggio-sfera. Ritorna t>=0 del primo impatto, o -1.
function raySphere(origin, dir, center, radius) {
    _oc.subVectors(origin, center);
    const b = _oc.dot(dir);
    const c = _oc.dot(_oc) - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return -1;
    const sq = Math.sqrt(disc);
    let t = -b - sq;
    if (t < 0) t = -b + sq;
    return t >= 0 ? t : -1;
}

export class EnemyManager {
    constructor(scene, player, rawModels, weaponFX, callbacks) {
        this.scene = scene;
        this.player = player;
        this.weaponFX = weaponFX;
        this.cb = callbacks || {};
        this.enemies = [];
        this.queue = [];        // tipi ancora da spawnare nell'ondata
        this.spawnTimer = 0;

        // Prototipi normalizzati (uno per specie), clonati a ogni spawn.
        this.prototypes = {};
        for (const [key, cfg] of Object.entries(ENEMY_TYPES)) {
            this.prototypes[key] = normalizeModel(rawModels[key], cfg.height);
        }
    }

    get aliveCount() { return this.enemies.length; }
    get pendingCount() { return this.queue.length; }
    get remaining() { return this.enemies.length + this.queue.length; }

    // Prepara la coda di spawn per un'ondata.
    startWave(waveDef) {
        this.queue = [];
        for (const g of waveDef.groups) {
            for (let i = 0; i < g.count; i++) this.queue.push(g.type);
        }
        // mischia per varietà
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
        this.spawnTimer = 0;
    }

    clearAll() {
        for (const e of this.enemies) this.scene.remove(e.root);
        this.enemies.length = 0;
        this.queue.length = 0;
    }

    _spawnOne(type) {
        const cfg = ENEMY_TYPES[type];
        const root = skeletonClone(this.prototypes[type]);
        // posizione random sul bordo arena
        const edge = ARENA.HALF - SPAWN.MARGIN;
        const side = Math.floor(Math.random() * 4);
        let x = 0, z = 0;
        const r = (Math.random() * 2 - 1) * edge;
        if (side === 0) { x = -edge; z = r; }
        else if (side === 1) { x = edge; z = r; }
        else if (side === 2) { x = r; z = -edge; }
        else { x = r; z = edge; }
        root.position.set(x, 0, z);
        root.scale.setScalar(0.01); // parte piccolo → scale-in
        this.scene.add(root);

        this.enemies.push({
            type, cfg, root,
            hp: cfg.hp, maxHp: cfg.hp,
            radius: cfg.radius, speed: cfg.speed,
            alive: true, spawnT: 0, bobT: Math.random() * 6,
        });
    }

    // Spara: testa il raggio contro tutti i nemici, applica danno al più vicino.
    // Ritorna { point, color } se colpisce, altrimenti null.
    fireRay(origin, dir, damage, range) {
        let best = null, bestT = range;
        for (const e of this.enemies) {
            if (!e.alive) continue;
            // centro sfera all'altezza media del modello
            _hit.copy(e.root.position); _hit.y += e.cfg.height * 0.5;
            const t = raySphere(origin, dir, _hit, e.radius);
            if (t >= 0 && t < bestT) { bestT = t; best = e; }
        }
        if (!best) return null;
        const point = new THREE.Vector3().copy(origin).addScaledVector(dir, bestT);
        this._damage(best, damage, point);
        return { point, color: best.cfg.color };
    }

    _damage(e, amount, point) {
        e.hp -= amount;
        // piccolo flash d'impatto
        this.weaponFX.spawnImpact(point, e.cfg.color);
        if (e.hp <= 0 && e.alive) {
            e.alive = false;
            if (this.cb.onKill) this.cb.onKill(e.cfg.score, e.type);
        }
    }

    update(dt) {
        // --- Spawn progressivo ---
        if (this.queue.length > 0 && this.enemies.length < SPAWN.MAX_ALIVE) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this._spawnOne(this.queue.pop());
                this.spawnTimer = SPAWN.INTERVAL;
            }
        }

        const p = this.player.pos;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.spawnT += dt;
            e.bobT += dt;

            // scale-in d'apparizione
            if (e.spawnT < 0.35) {
                const k = e.spawnT / 0.35;
                e.root.scale.setScalar(k);
            } else {
                e.root.scale.setScalar(1);
            }

            // morte: rimozione immediata con flash (già emesso in _damage)
            if (!e.alive) {
                this.weaponFX.spawnImpact(
                    _hit.copy(e.root.position).setY(e.cfg.height * 0.5), e.cfg.color
                );
                this.scene.remove(e.root);
                this.enemies.splice(i, 1);
                continue;
            }

            // inseguimento sul piano XZ
            _d.set(p.x - e.root.position.x, 0, p.z - e.root.position.z);
            const dist = _d.length();
            if (dist > 0.001) {
                _d.divideScalar(dist);
                const contactDist = e.radius + 1.0;
                if (dist > contactDist) {
                    e.root.position.addScaledVector(_d, e.speed * dt);
                } else if (this.cb.onContact) {
                    // a contatto: danno continuo al giocatore
                    this.cb.onContact(e.cfg.contactDamage * dt);
                }
                // orienta verso il giocatore
                e.root.rotation.y = Math.atan2(_d.x, _d.z);
            }

            // bob verticale
            e.root.position.y = Math.abs(Math.sin(e.bobT * 3)) * 0.18;
        }
    }
}
