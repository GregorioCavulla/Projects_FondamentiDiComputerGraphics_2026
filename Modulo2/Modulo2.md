# Riassunto Modulo 2: Grafica 3D Real-Time e Three.js

Il Modulo 2 del corso introduce allo sviluppo di applicazioni grafiche 3D interattive e in tempo reale sul web. Durante il corso vengono affiancate lezioni teoriche (slide) ad applicazioni pratiche in JavaScript, arrivando fino alla gestione della Realtà Virtuale e alle tecniche di Scansione 3D.

---

## 1. Fondamenti di Three.js e Architettura 3D (Teoria)
*(Basato su: introduction.pdf, introduction_3js.pdf, learning_3js.pdf, running-threejs-examples.pdf)*

**Three.js** è una potente libreria JavaScript che astrae la complessità nativa di WebGL. 
Per disegnare una scena 3D, l'architettura base richiede:
- **Scene**: Il contenitore (Scene Graph) di tutti gli oggetti 3D, luci e telecamere.
- **Camera**: Il punto di vista (es. `PerspectiveCamera`), definisce cosa viene visto e con quale campo visivo (FOV).
- **Renderer**: Il motore (`WebGLRenderer`) che calcola l'immagine finale e la disegna in un elemento `<canvas>` HTML.
- **Mesh**: L'entità visibile, che è composta dall'unione di una **Geometry** (la struttura o forma, i vertici) e un **Material** (l'aspetto visivo di superficie, come i colori o le texture).
- **Ambiente Locale**: Per via dei blocchi di sicurezza dei browser (CORS) durante il caricamento di risorse esterne come texture, le applicazioni Three.js richiedono l'avvio attraverso un server locale (`run_threejs_examples`).

---

## 2. Rendering, Illuminazione e Materiali (Esempio Pratico: "Forest")
Il controllo dell'illuminazione rende le scene tridimensionali credibili e definisce il comportamento dei materiali complessi.

Nel laboratorio **"Forest under a moving sun"**, viene mostrato l'uso di:
- **AmbientLight**: Illumina omogeneamente la scena (il cielo/luce ambientale base).
- **DirectionalLight**: Simula il sole, proiettando raggi paralleli.
- **MeshStandardMaterial**: Un materiale Physically Based Rendering (PBR) che reagisce realisticamente alla luce. 

**Esempio di Gestione delle Ombre:**
Le ombre richiedono due passaggi di rendering da parte della GPU (Shadow Map). Per abilitarle occorrono tre passaggi chiave affrontati nell'esercizio:
```javascript
// 1. Abilitare la mappa delle ombre nel Renderer 
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Produce bordi sfumati (soft shadows)

// 2. Dire al "Sole" di proiettare l'ombra e configurare l'area (Frustum)
const sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048; // Alta risoluzione dell'ombra
sun.shadow.bias = -0.001; // Evita artefatti visivi detti "shadow acne"

// 3. Imporre ai singoli oggetti (Mesh) se devono proiettare o ricevere ombra
trunk.castShadow = true;
trunk.receiveShadow = true;
ground.receiveShadow = true; // Il piano erboso riceve le ombre dagli alberi
```

---

## 3. Ottimizzazione delle Performance (Draw Calls)
Una problematica cruciale nel 3D real-time affrontata nel laboratorio è gestire colli di bottiglia e abbassamento dei frame al secondo (FPS). Nel disegnare un'enorme foresta di 5000 alberi (10.000 geometrie tra tronchi e chiome), l'**implementazione Naive** inefficace causa ben 20.000 **Draw Calls** per istruzione (poiché è attivo il castShadow), sovraccaricando la CPU.

Il modulo spiega come ottimizzare il processo tramite due pattern:

### A. Geometry Merging
Invece di mandare alla GPU 10.000 Mesh singole, calcoliamo le posizioni nel mondo e uniamo in un unico mega buffer tutti i tronchi insieme, e tutte le chiome insieme. 
- **Vantaggio**: Si passa ad **appena 2 Draw Calls**.
- **Svantaggio**: Costoso aggiornare posizioni (ad es. per oggetti in movimento), si deve ricostruire il buffer.
```javascript
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// I colori vengono spennellati direttamente sui vertici delle mega geometrie
const trunkMesh = new THREE.Mesh(
    mergeGeometries(trunkGeos),
    new THREE.MeshStandardMaterial({ vertexColors: true })
);
```

### B. Instancing / InstancedMesh (Approccio Ideale)
Si sfrutta la GPU passandole **una singola geometria** (es. `CylinderGeometry`) e fornendole un array istanziato contenente solo le trasformazioni (Matrici e Colori) delle 5000 repliche degli alberi.
```javascript
// Viene creata UNA istanza di InstancedMesh in grado di ripetersi 5000 volte
const trunkIM = new THREE.InstancedMesh(baseTrunkGeo, trunkMat, 5000);
const dummy = new THREE.Object3D();

for (let i = 0; i < 5000; i++) {
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    
    // Si aggiorna solo la matrice 3D e il colore dell'i-esimo albero
    trunkIM.setMatrixAt(i, dummy.matrix);
    trunkIM.setColorAt(i, new THREE.Color( /* marrone random */ ));
}

// Necessario per notificare alla GPU l'aggiornamento!
trunkIM.instanceMatrix.needsUpdate = true;
trunkIM.instanceColor.needsUpdate = true;
```

---

## 4. Nuove interfacce e Pipeline (VR & 3D Scanning)
*(Basato su: IntroVR.pdf, pres_3DSCAN_2026.pdf)*

A completamento dell'infrastruttura 3D di Three.js, il modulo fornisce le proiezioni esterne per la Realtà Virtuale e per l'acquisizione di asset dal vero:

- **Realtà Virtuale (IntroVR)**: Con WebXR è possibile renderizzare scene 3D in dispositivi immersivi nei browser. La computazione base richiede il *rendering stereoscopico* della view (rendering sdoppiato e sfalsato per occhio destro e sinistro) per cogliere la profondità, con la possibilità di integrare hand-controllers (tracker spaziali).
- **Scansione 3D**: Procedure di acquisizione (come fotogrammetria o tecniche laser LiDAR e Structured Light) utilizzate per esportare elementi del mondo reale sotto forma di intere Point Cloud (Nuvole di Punti) o Mesh dense texturizzate, in ottica di utilizzarle all'interno di mondi customizzati WebGL.