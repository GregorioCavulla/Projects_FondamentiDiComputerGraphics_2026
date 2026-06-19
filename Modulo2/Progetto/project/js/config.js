// =============================================================================
// config.js — Costanti di gioco centralizzate.
// Tutto ciò che è "regolabile" (bilanciamento, estetica, telecamera) sta qui,
// così i moduli di gioco restano leggibili e i tuning si fanno in un punto solo.
// =============================================================================

export const ARENA = {
    HALF: 32,          // semi-lato dell'arena quadrata (in unità mondo)
    WALL_HEIGHT: 8,    // altezza delle pareti-griglia di confine
    GRID_COLOR: 0x00ff66,
    FOG_COLOR: 0x02100a,
    FOG_NEAR: 28,
    FOG_FAR: 78,
};

export const CAMERA = {
    FOV: 62,
    NEAR: 0.1,
    FAR: 500,
    DISTANCE: 9.5,     // quanto la camera sta dietro a Porygon-Z
    HEIGHT: 5.0,       // altezza della camera sopra il giocatore
    LOOK_HEIGHT: 1.4,  // punto guardato sopra il giocatore
    PITCH_MIN: -0.5,
    PITCH_MAX: 0.6,
    SENS: 0.0022,      // sensibilità mouse (pointer lock)
};

export const PLAYER = {
    HEIGHT: 2.2,       // altezza target del modello normalizzato
    SPEED: 11,         // unità/secondo
    RADIUS: 0.9,       // raggio di collisione
    MAX_HP: 100,
    MUZZLE_HEIGHT: 1.2,// altezza da cui parte il raggio
    MUZZLE_FWD: 1.1,   // offset in avanti del punto di sparo
    MODEL_YAW_OFFSET: 0, // orientamento "fronte" del GLB rispetto a +Z
};

export const BEAM = {
    COLOR: 0x66f0ff,         // ciano elettrico (estetica cyberspazio)
    CORE_COLOR: 0xffffff,
    RANGE: 60,               // portata massima del raggio
    DAMAGE: 34,              // danno per colpo
    COOLDOWN: 0.16,          // secondi tra un colpo e l'altro
    LIFETIME: 0.12,          // durata visiva del raggio (s)
    RADIUS: 0.12,            // spessore del raggio
    LIGHT_INTENSITY: 9,      // intensità del lampo di luce emesso
    LIGHT_DISTANCE: 22,      // raggio d'azione della luce del colpo
};

// Statistiche per specie. height = scala visiva, hp, speed, danno da contatto,
// punti dati alla morte, raggio collisione/hit.
export const ENEMY_TYPES = {
    gible: {
        file: 'assets/gible.glb',
        height: 1.3, hp: 34, speed: 4.6, contactDamage: 8,
        score: 100, radius: 0.9, color: 0x3da5ff,
    },
    gabite: {
        file: 'assets/gabite.glb',
        height: 1.9, hp: 80, speed: 5.4, contactDamage: 14,
        score: 250, radius: 1.1, color: 0x2f7fd6,
    },
    garchomp: {
        file: 'assets/garchomp.glb',
        height: 2.8, hp: 240, speed: 6.2, contactDamage: 24,
        score: 1000, radius: 1.6, color: 0x1f5fa8,
    },
};

// Ondate: ogni voce è una lista di gruppi { type, count }. L'ultima è il boss.
export const WAVES = [
    { name: 'ONDATA 1 — Sciame di Gible', groups: [{ type: 'gible', count: 6 }] },
    { name: 'ONDATA 2 — Gible & Gabite',  groups: [{ type: 'gible', count: 6 }, { type: 'gabite', count: 2 }] },
    { name: 'ONDATA 3 — Gabite in branco', groups: [{ type: 'gabite', count: 4 }, { type: 'gible', count: 4 }] },
    { name: 'BOSS — Garchomp',            groups: [{ type: 'garchomp', count: 1 }, { type: 'gabite', count: 2 }] },
];

export const SPAWN = {
    MAX_ALIVE: 10,     // nemici contemporanei massimi a schermo
    INTERVAL: 1.1,     // secondi tra spawn successivi
    MARGIN: 4,         // distanza dal bordo arena per lo spawn
};
