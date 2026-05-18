# Modulo 1: Riassunto dei Laboratori (Modulo1/Resources)

Questo documento contiene un riassunto dei laboratori presenti nella cartella `Modulo1/Resources` e una lista delle librerie esterne utilizzate negli esempi.

## Riassunto dei contenuti
Di seguito i focus dei vari laboratori e demo presenti:

- **#1_HTML5_2d_1:** Introduzione al rendering 2D usando l'elemento `<canvas>` di HTML5. Include esempi su come disegnare linee, curve di Bezier, poligoni, immagini e testo interattivo. Viene affrontata anche la gestione di base degli eventi del mouse e della tastiera.
- **#2_HTML5_webgl_1:** Introduzione a WebGL. Mostra come impostare un contesto, compilare gli shader di base e disegnare primitive (triangoli, quadrati) utilizzando sia buffer lineari (array) sia buffer indicizzati (elements). Comprende l'applicazione di trasformazioni 2D/3D (rotazione, scala, traslazione) e interpolazioni di colore / line drawing.
- **#3_HTML5_webgl_2:** Approfondimento sul WebGL con interazione avanzata, modelli 3D (cubi) gestiti sia in wireframe che con colore pieno/interpolato (compresi cubemap e texture di base). Mostra l'applicazione delle trasformazioni, l'interazione via mouse per ruotare i modelli, l'uso delle proiezioni ortografiche e prospettiche.
- **#4_HTML5_webgl_3:** *(Ulteriori approfondimenti su WebGL - modelli complessi o gerarchie)*
- **#5_gouraud_phong_demo:** Demo specifica per mostrare e confrontare gli shading model di Gouraud e Phong in WebGL, applicando il calcolo dell'illuminazione realistica ai modelli.
- **#6_bumpmap_demo:** Applicazione avanzata delle texture in WebGL. Dimostra come usare le Bump Map per simulare dettagli e rugosità della superficie calcolando le normali a livello di pixel.
- **#7_HTML5_webgl_4:** Tecniche avanzate (WebGL 2). Include esempi focalizzati principalmente su grafi di scena e architetture strutturate (Classi/Program, Scene, Camera), gestendo aspetti come le trasparenze (alpha blending).

## Librerie utilizzate
Nelle varie cartelle dei laboratori e demo sono utilizzate le seguenti librerie (interne o di terze parti) per semplificare lo sviluppo:

- **m4.js**: Libreria per l'algebra lineare e le operazioni delle matrici 4x4 (trasformazioni, proiezioni).
- **webgl-utils.js**: Utilità helper per semplificare l'inizializzazione del contesto WebGL e la compilazione degli shader.
- **glm_utils.js**: Wrapper/utility usata per semplificare operazioni con matrici e vettori negli script (presente nei lab di WebGL 3).
- **mesh_utils.js**: Utilità per il caricamento e la gestione semplificata delle mesh e dei modelli 3D (presente nei lab di WebGL 3).
- **gl-matrix.js**: Famosa libreria matematica altamente ottimizzata per le operazioni con matrici e vettori, ampiamente utilizzata nel mondo WebGL.
- **dat.gui.js**: Libreria usata per creare rapidamente interfacce grafiche a schermo (pannelli di controllo) al fine di modificare parametri in tempo reale.
- **trackball-rotator.js**: Un controller interattivo che implementa il movimento di una "trackball" per poter ispezionare agilmente gli oggetti 3D con il mouse.
