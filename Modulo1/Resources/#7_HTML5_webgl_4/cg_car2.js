// cg_car2.js
// implementazione dei metodi

  // STATO DELLA MACCHINA
  // (DoStep fa evolvere queste variabili nel tempo)
  var px,py,pz,facing; // posizione e orientamento
  var mozzoA, mozzoP, sterzo; // stato interno
  var vx,vy,vz; // velocita' attuale
 
  // queste di solito rimangono costanti
  var velSterzo, velRitornoSterzo, accMax, attrito,
        raggioRuotaA, raggioRuotaP, grip,
        attritoX, attritoY, attritoZ; // attriti
  var key;

// da invocare quando e' stato premuto/rilasciato il tasto numero "keycode"
function EatKey(keycode, keymap, pressed_or_released)
{
  for (var i=0; i<4; i++){
    if (keycode==keymap[i]) key[i]=pressed_or_released;
  }
}

// DoStep: facciamo un passo di fisica (a delta-t costante)
//
// Indipendente dal rendering.
//
// ricordiamoci che possiamo LEGGERE ma mai SCRIVERE
// la struttura controller da DoStep
function CarDoStep(){
  // computiamo l'evolversi della macchina
 
  var vxm, vym, vzm; // velocita' in spazio macchina
 
  // da vel frame mondo a vel frame macchina
  var cosf = Math.cos(facing*Math.PI/180.0);
  var sinf = Math.sin(facing*Math.PI/180.0);
  vxm = +cosf*vx - sinf*vz;
  vym = vy;
  vzm = +sinf*vx + cosf*vz;
 
  // gestione dello sterzo
  if (key[1]) sterzo+=velSterzo;
  if (key[3]) sterzo-=velSterzo;
  sterzo*=velRitornoSterzo; // ritorno a volante fermo
 
  if (key[0]) vzm-=accMax; // accelerazione in avanti
  if (key[2]) vzm+=accMax; // accelerazione indietro
 
  // attriti (semplificando)
  vxm*=attritoX; 
  vym*=attritoY;
  vzm*=attritoZ;

  // l'orientamento della macchina segue quello dello sterzo
  // (a seconda della velocita' sulla z)
  facing = facing - (vzm*grip)*sterzo;
 
  // rotazione mozzo ruote (a seconda della velocita' sulla z)
  var da ; //delta angolo
  da=(180.0*vzm)/(Math.PI*raggioRuotaA);
  mozzoA+=da;
  da=(180.0*vzm)/(Math.PI*raggioRuotaP);
  mozzoP+=da;
 
  // ritorno a vel coord mondo
  vx = +cosf*vxm + sinf*vzm;
  vy = vym;
  vz = -sinf*vxm + cosf*vzm;
 
  // posizione = posizione + velocita * delta t (ma e' delta t costante)
  px+=vx;
  py+=vy;
  pz+=vz;
}

//function drawCube(); // questa e' definita altrove (quick hack)
//void drawAxis(); // anche questa

// // disegna una ruota come due cubi intersecati a 45 gradi
 function drawWheel(){
  mo_matrix1=m4.scale(mo_matrix1,1, 1.0/Math.sqrt(2.0),  1.0/Math.sqrt(2.0));
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
  drawCube();

  mo_matrix1=m4.xRotate(mo_matrix1, degToRad(45));
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
  drawCube();
 }

function CarInit(){
  // inizializzo lo stato della macchina
  px=py=pz=facing=0; // posizione e orientamento
  mozzoA=mozzoP=sterzo=0;   // stato
  vx=vy=vz=0;      // velocita' attuale
  // inizializzo la struttura di controllo
  key=[false,false,false,false];
 
  velSterzo=3.4;         // A
//  velSterzo=2.26;       // A
  velRitornoSterzo=0.93; // B, sterzo massimo = A*B / (1-B)
 
  accMax = 0.0011;
  //accMax = 0.0055;
 
  // attriti: percentuale di velocita' che viene mantenuta
  // 1 = no attrito
  // <<1 = attrito grande
  attritoZ = 0.991;  // piccolo attrito sulla Z (nel senso di rotolamento delle ruote)
  attritoX = 0.8;  // grande attrito sulla X (per non fare slittare la macchina)
  attritoY = 1.0;  // attrito sulla y nullo

  // Nota: vel max = accMax*attritoZ / (1-attritoZ)
 
  raggioRuotaA = 0.25;
  raggioRuotaP = 0.30;

  grip = 0.45; // quanto il facing macchina si adegua velocemente allo sterzo
}

// disegna carlinga composta da 1 cubo traslato e scalato
function drawCarlinga(model_matrix){
  // vado al frame pezzo_A
  mo_matrix1=m4.scale(model_matrix, 0.25 , 0.14 , 1);
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
  drawCube();
 
// // disegna altri 3 cubi traslati escalati per carlinga
// // scommentare
//   // vado frame pezzo_B
//   mo_matrix1=m4.translate(mo_matrix,0,-0.11,-0.95);
//   mo_matrix1=m4.scale(mo_matrix1,0.6, 0.05, 0.15);
//   gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
//   drawCube();

//   // vado frame pezzo_C
//   mo_matrix1=m4.translate(mo_matrix,0,-0.11,0);
//   mo_matrix1=m4.scale(mo_matrix1,0.6, 0.05, 0.3);
//   gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
//   drawCube();

//   // vado frame pezzo_D
//   mo_matrix1=m4.xRotate(mo_matrix, degToRad(-5));
//   mo_matrix1=m4.translate(mo_matrix1,0,+0.2,+0.95);
//   mo_matrix1=m4.scale(mo_matrix1,0.6, 0.05, 0.3);
//   gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
//   drawCube();
}

// disegna Car
function CarRender() {
// sono nello spazio mondo
 
//  drawAxis(); // disegno assi spazio mondo
//  glPushMatrix();
 
  mo_matrix=m4.translate(mo_matrix,px,py,pz);
  mo_matrix=m4.yRotate(mo_matrix, degToRad(facing));

  // sono nello spazio MACCHINA
  //drawAxis(); // disegno assi spazio macchina

  drawCarlinga(mo_matrix);
 
  // ruota posteriore D
  mo_matrix1=m4.copy(mo_matrix);
  mo_matrix1=m4.translate(mo_matrix1,0.58,+raggioRuotaP-0.28,+0.8);
  mo_matrix1=m4.xRotate(mo_matrix1, degToRad(mozzoP));
  mo_matrix1=m4.scale(mo_matrix1,0.1, raggioRuotaP, raggioRuotaP);
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
//  drawCube();
  drawWheel();

  // ruota posteriore S
  mo_matrix1=m4.copy(mo_matrix);
  mo_matrix1=m4.translate(mo_matrix1,-0.58,+raggioRuotaP-0.28,+0.8);
  mo_matrix1=m4.xRotate(mo_matrix1,degToRad(mozzoP));
  mo_matrix1=m4.scale(mo_matrix1,0.1, raggioRuotaP, raggioRuotaP);
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
//  drawCube();
  drawWheel();

  // ruota anteriore D
  mo_matrix1=m4.copy(mo_matrix);
  mo_matrix1=m4.translate(mo_matrix1,0.58,+raggioRuotaA-0.28,-0.55);
  mo_matrix1=m4.yRotate(mo_matrix1,degToRad(sterzo));
  mo_matrix1=m4.xRotate(mo_matrix1,degToRad(mozzoA));
  mo_matrix1=m4.scale(mo_matrix1,0.08, raggioRuotaA, raggioRuotaA);
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
//  drawCube();
  drawWheel();

  // ruota anteriore S
  mo_matrix1=m4.copy(mo_matrix);
  mo_matrix1=m4.translate(mo_matrix1,-0.58,+raggioRuotaA-0.28,-0.55);
  mo_matrix1=m4.yRotate(mo_matrix1,degToRad(sterzo));
  mo_matrix1=m4.xRotate(mo_matrix1,degToRad(mozzoA));
  mo_matrix1=m4.scale(mo_matrix1,0.08, raggioRuotaA, raggioRuotaA);
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
//  drawCube();
  drawWheel();
}

// disegna un cubo a facce triangolari
function drawCubeFill()
{
gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
gl.vertexAttribPointer(_position, 3, gl.FLOAT, false,0,0); 
gl.enableVertexAttribArray(_position);

gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
gl.vertexAttribPointer(_color, 3, gl.FLOAT, false,0,0) ; 
gl.enableVertexAttribArray(_color);

gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
}

// disegna un cubo in wireframe
function drawCubeWire()
{
gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer2);
gl.vertexAttribPointer(_position, 3, gl.FLOAT, false,0,0); 
gl.enableVertexAttribArray(_position);

gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer2);
gl.vertexAttribPointer(_color, 3, gl.FLOAT, false,0,0) ; 
gl.enableVertexAttribArray(_color);

gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer2);
gl.drawElements(gl.LINES, indices2.length, gl.UNSIGNED_SHORT, 0);
}

function drawCube()
{
  drawCubeFill();
  drawCubeWire();
}

function drawFloor()
{
gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer3);
gl.vertexAttribPointer(_position, 3, gl.FLOAT, false,0,0); 
gl.enableVertexAttribArray(_position);

gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer3);
gl.vertexAttribPointer(_color, 3, gl.FLOAT, false,0,0) ; 
gl.enableVertexAttribArray(_color);

gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer3);
gl.drawElements(gl.TRIANGLES, indices3.length, gl.UNSIGNED_SHORT, 0);
}

var mo_matrix, mo_matrix1;
/*============= Creating a canvas ======================*/ 
var canvas = document.getElementById('my_Canvas');
gl = canvas.getContext('webgl');

/*========== Defining and storing the geometry ==========*/
var vertices=[
-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, 
-1,-1,1, 1,-1,1, 1,1,1, -1,1,1, 
-1,-1,-1, -1,1,-1, -1,1,1, -1,-1,1,
1,-1,-1, 1,1,-1, 1,1,1, 1,-1,1, 
-1,-1,-1, -1,-1,1, 1,-1,1, 1,-1,-1, 
-1,1,-1, -1,1,1, 1,1,1, 1,1,-1,];

var colors=[
   0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,
   0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,
   0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,
   0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,
   0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,
   0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9,  0.9,0.9,0.9, 
   ];
var indices = [
0,1,2, 0,2,3, 4,5,6, 4,6,7, 8,9,10, 8,10,11, 12,13,14, 
12,14,15, 16,17,18, 16,18,19, 20,21,22, 20,22,23 ];

var vertices2=[
-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,];
var colors2=[
   0,0,0,  0,0,0,  0,0,0,  0,0,0,
   0,0,0,  0,0,0,  0,0,0,  0,0,0];
var indices2 = [
 0,1, 1,2, 2,3, 3,0, 4,5, 5,6, 6,7, 7,4, 1,5, 2,6, 3,7, 0,4]; 

const S=3; // size
const H=-0.14; // altezza
var vertices3=[-S,H,-S, S,H,-S, S,H,S, -S,H,S,];
var colors3=[0.7,0.7,0.7,  0.7,0.7,0.7,  0.7,0.7,0.7,  0.7,0.7,0.7];
var indices3 = [0,1,2, 0,2,3,]; 

// Create and store data into vertex buffer 
var vertex_buffer = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); 
gl.bufferData(gl.ARRAY_BUFFER,
new Float32Array(vertices), gl.STATIC_DRAW);
// Create and store data into color buffer 
var color_buffer = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer); 
gl.bufferData(gl.ARRAY_BUFFER,
new Float32Array(colors), gl.STATIC_DRAW);
// Create and store data into index buffer
var index_buffer= gl.createBuffer (); 
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer); 
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW); 

var vertex_buffer2 = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer2); 
gl.bufferData(gl.ARRAY_BUFFER,
new Float32Array(vertices2), gl.STATIC_DRAW);
// Create and store data into color buffer 
var color_buffer2 = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer2); 
gl.bufferData(gl.ARRAY_BUFFER,
new Float32Array(colors2), gl.STATIC_DRAW);
// Create and store data into index buffer
var index_buffer2= gl.createBuffer (); 
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer2); 
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices2), gl.STATIC_DRAW); 

var vertex_buffer3 = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer3); 
gl.bufferData(gl.ARRAY_BUFFER,
new Float32Array(vertices3), gl.STATIC_DRAW);
// Create and store data into color buffer 
var color_buffer3 = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer3); 
gl.bufferData(gl.ARRAY_BUFFER,
new Float32Array(colors3), gl.STATIC_DRAW);
// Create and store data into index buffer
var index_buffer3= gl.createBuffer (); 
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer3); 
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices3), gl.STATIC_DRAW); 

//usa libreria webgl-utilis.js
var shaderprogram = webglUtils.createProgramFromScripts(gl, 
   ["vertex-shader", "fragment-shader"]);

/*======== Associating attributes to vertex shader =====*/
var _Pmatrix = gl.getUniformLocation(shaderprogram, "Pmatrix"); 
var _Vmatrix = gl.getUniformLocation(shaderprogram, "Vmatrix"); 
var _Mmatrix = gl.getUniformLocation(shaderprogram, "Mmatrix");
var _position = gl.getAttribLocation(shaderprogram, "position"); 
var _color = gl.getAttribLocation(shaderprogram, "color"); 

gl.useProgram(shaderprogram);   

function degToRad(d) {
   return d * Math.PI / 180;
}

//definizione parametri iniziali
var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
var zmin = 1;
var zmax = 100;
var fov = 40;

var THETA=degToRad(50), PHI=degToRad(30);
var D = 7;

var target = [0, 0, 0];
var up = [0, 1, 0];

var drag;

//var mozzo_step=degToRad(15);
//var mozzo = 0;

/*================= Mouse events ======================*/
var mouseDown=function(e) {
    drag=true;
    old_x=e.pageX, old_y=e.pageY;
    e.preventDefault();
    return false;
};

var mouseUp=function(e){
   drag=false;
};

var mouseMove=function(e) {
if (!drag) return false; 
dX=-(e.pageX-old_x)*2*Math.PI/canvas.width; 
dY=-(e.pageY-old_y)*2*Math.PI/canvas.height; 
//console.log('stampa',dX,dY);
THETA+=dX;
PHI+=dY;
old_x=e.pageX, old_y=e.pageY; 
e.preventDefault();
render();
};

var mouseWheel=function(e){
  if (e.deltaY < 0)
    D += 0.2;
 else if (e.deltaY > 0)
    D -= 0.2;
}
//da usarsi senza animazione
// document.getElementById("Button1").onclick = function(){D *= 1.1; render()};
// document.getElementById("Button2").onclick = function(){D *= 0.9; render()};
// document.getElementById("Button3").onclick = function(){zmin  *= 1.1; zmax *= 1.1; render()};
// document.getElementById("Button4").onclick = function(){zmin *= 0.9; zmax *= 0.9; render()};
// document.getElementById("Button5").onclick = function(){fov  *= 1.1; fov *= 1.1; render()};
// document.getElementById("Button6").onclick = function(){fov *= 0.9; fov *= 0.9; render()};

document.getElementById("Button1").onclick = function(){D *= 1.1};
document.getElementById("Button2").onclick = function(){D *= 0.9};
document.getElementById("Button3").onclick = function(){zmin  *= 1.1; zmax *= 1.1};
document.getElementById("Button4").onclick = function(){zmin *= 0.9; zmax *= 0.9};
document.getElementById("Button5").onclick = function(){fov  *= 1.1; fov *= 1.1};
document.getElementById("Button6").onclick = function(){fov *= 0.9; fov *= 0.9};

canvas.onmousedown=mouseDown;
canvas.onmouseup=mouseUp;
canvas.mouseout=mouseUp;
canvas.onmousemove=mouseMove;
canvas.onmousewheel=mouseWheel;
window.addEventListener('keydown', doKeyDown, true);
window.addEventListener('keyup', doKeyUp, true);
/*=================== Drawing =================== */
function doKeyDown(e){
         //====================
         // THE W KEY
         //====================
         if (e.keyCode == 87) key[0]=true;
         //====================
         // THE S KEY
         //====================
         if (e.keyCode == 83) key[2]=true;
         //====================
         // THE A KEY
         //====================
         if (e.keyCode == 65) key[1]=true;
         //====================
         // THE D KEY
         //====================
         if (e.keyCode == 68) key[3]=true;
}
function doKeyUp(e){
         //====================
         // THE W KEY
         //====================
         if (e.keyCode == 87) key[0]=false;
         //====================
         // THE S KEY
         //====================
         if (e.keyCode == 83) key[2]=false;
         //====================
         // THE A KEY
         //====================
         if (e.keyCode == 65) key[1]=false;
         //====================
         // THE D KEY
         //====================
         if (e.keyCode == 68) key[3]=false;
}

var render=function() {
//set projection matrix
var proj_matrix = m4.perspective(degToRad(fov), aspect, zmin, zmax);
//set view matrix
var camera = [D*Math.sin(PHI)*Math.cos(THETA),
              D*Math.sin(PHI)*Math.sin(THETA),
              D*Math.cos(PHI)];
var view_matrix = m4.inverse(m4.lookAt(camera, target, up));
     
gl.enable(gl.DEPTH_TEST);
// gl.depthFunc(gl.LEQUAL); 
gl.clearColor(1.0, 1.0, 1.0, 1); 

gl.clearDepth(1.0);
gl.viewport(0.0, 0.0, canvas.width, canvas.height); 
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
gl.uniformMatrix4fv(_Pmatrix, false, proj_matrix); 
gl.uniformMatrix4fv(_Vmatrix, false, view_matrix);
//set model matrix to I4
mo_matrix=m4.identity(); 
gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix);

  //drawAxis(); // disegna assi frame OGGETTO
  //disegna il cubo base anziche' la macchina
  //drawCubeWire();

//  if (!drag)
//    mozzo-=mozzo_step;

  mo_matrix=m4.scale(mo_matrix,0.5,0.5,0.5);
  drawFloor(); // disegna il suolo
//  drawCar(mozzo); 
  CarRender();

// window.requestAnimationFrame(render); 
}
// render();

//Per fare una prova di animazione senza andare a tempo, scommentare le
//due righe di codice
//window.requestAnimationFrame(render);
//e
//render()
//poco sopra, e commentare quanto segue

// // Metodo basato sui Frame Per Secondo
// const FRAMES_PER_SECOND = 30;  // Valid values are 60,30,20,15,10...
// // set the mim time to render the next frame
// const FRAME_MIN_TIME = (1000/60) * (60 / FRAMES_PER_SECOND) - (1000/60) * 0.5;
// var lastFrameTime = 0;  // the last frame time
// function update(time){
//     if(time-lastFrameTime < FRAME_MIN_TIME){ //skip the frame if the call is too early
//         CarDoStep();
//         window.requestAnimationFrame(update);
//         return; // return as there is nothing to do
//     }
//     lastFrameTime = time; // remember the time of the rendered frame
//     // render the frame
//     render();
//     window.requestAnimationFrame(update); // get next frame
// }

//metodo basato ul tempo della fisica
let lastTime = 0;
let accumulator = 0;
const deltaTimeFisica = 1/60; // 60 aggiornamenti al secondo

function update(currentTime) {
    currentTime *= 0.001;
    let frameTime = currentTime - lastTime;
    lastTime = currentTime;

    accumulator += frameTime;

    let fisicaAggiornata = false; 

    // Esegui la fisica a passi fissi
    while (accumulator >= deltaTimeFisica) {
        CarDoStep();
        accumulator -= deltaTimeFisica;
        fisicaAggiornata = true; // Segnaliamo che la posizione è cambiata
    }

    // Ridisegna solo se la fisica ha effettivamente spostato l'auto
    if (fisicaAggiornata) {
        render();
    }

    requestAnimationFrame(update);
}


CarInit();
//update(0); // start animation
window.requestAnimationFrame(update); 

