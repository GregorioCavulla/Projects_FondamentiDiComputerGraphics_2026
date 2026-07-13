"use strict";

// =====================================================================
//  CONTROLLO CAMERA (orbitale, molto semplice)
// ---------------------------------------------------------------------
//  La camera gira ATTORNO al modello (che resta fermo al centro).
//   - Trascina il mouse : orbita attorno a Porygon
//   - Rotellina         : avvicina / allontana (zoom)
//
//  Lo stato è descritto in coordinate sferiche attorno a un punto "target":
//   - yaw      : angolo orizzontale (giro attorno al modello)
//   - pitch    : angolo verticale (sopra/sotto)
//   - distance : quanto è lontana la camera dal target
// =====================================================================

const camera = {
    target:   [0, 0, 0], // punto guardato (centro del modello)
    yaw:      0,         // rotazione orizzontale (radianti)
    pitch:    0,         // rotazione verticale (radianti)
    distance: 4.5,       // distanza dal target
};

// Collega gli eventi del mouse al canvas per orbitare e zoomare.
function setupCamera(canvas) {
    let dragging = false;
    let last = { x: 0, y: 0 };

    canvas.addEventListener('mousedown', (e) => {
        dragging = true;
        last = { x: e.offsetX, y: e.offsetY };
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        // Lo spostamento del mouse cambia gli angoli della camera.
        // Orizzontale con segno negativo = movimento "naturale" (la vista
        // segue il mouse); verticale con segno positivo per non invertirlo.
        camera.yaw   -= (e.offsetX - last.x) * 0.01;
        camera.pitch += (e.offsetY - last.y) * 0.01;
        // Limito il pitch per non "ribaltarsi" sopra/sotto il modello.
        const limit = Math.PI / 2 - 0.05;
        camera.pitch = Math.max(-limit, Math.min(limit, camera.pitch));
        last = { x: e.offsetX, y: e.offsetY };
    });

    window.addEventListener('mouseup', () => { dragging = false; });

    // Zoom con la rotellina (limitato tra una distanza minima e massima).
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        camera.distance += e.deltaY * 0.01;
        camera.distance = Math.max(2.0, Math.min(12.0, camera.distance));
    }, { passive: false });
}

// Matrice di vista: calcola la posizione della camera su una sfera attorno
// al target (dagli angoli yaw/pitch e dalla distanza) e guarda il target.
function getViewMatrix() {
    const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    const cy = Math.cos(camera.yaw),   sy = Math.sin(camera.yaw);

    const eye = [
        camera.target[0] + camera.distance * cp * sy,
        camera.target[1] + camera.distance * sp,
        camera.target[2] + camera.distance * cp * cy,
    ];

    // lookAt costruisce la matrice della camera; la vista è la sua inversa.
    const cameraMatrix = m4.lookAt(eye, camera.target, [0, 1, 0]);
    return m4.inverse(cameraMatrix);
}
