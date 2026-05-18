// cg_car1.js
// implementazione dei metodi

// disegna gli assi nel sistema di riferimento
function drawAxis(){
  gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer3);
  gl.vertexAttribPointer(_color, 3, gl.FLOAT, false,0,0); 
  gl.enableVertexAttribArray(_color);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer3);
  gl.vertexAttribPointer(_position, 3, gl.FLOAT, false,0,0); 
  gl.enableVertexAttribArray(_position);
  gl.drawArrays(gl.LINES, 0, 6); 
  
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer4);
  gl.vertexAttribPointer(_position, 3, gl.FLOAT, false,0,0); 
  gl.enableVertexAttribArray(_position);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer4);
  gl.vertexAttribPointer(_color, 3, gl.FLOAT, false,0,0) ; 
  gl.enableVertexAttribArray(_color);
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer4);
  gl.drawElements(gl.TRIANGLES, indices4.length, gl.UNSIGNED_SHORT, 0); 
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

// disegna carlinga composta da 1 cubo traslato e scalato
function drawCarlinga(model_matrix){
  // vado al frame pezzo_A
  mo_matrix1=m4.scale(model_matrix, 0.25 , 0.14 , 1);
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
  drawCube();
 
// // disegna altri 3 cubi traslati escalati per carlinga
// // scommentare/commentare
//   // vado frame pezzo_B
//   mo_matrix1=m4.translate(model_matrix,0,-0.11,-0.95);
//   mo_matrix1=m4.scale(mo_matrix1,0.6, 0.05, 0.15);
//   gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
//   drawCube();

//   // vado frame pezzo_C
//   mo_matrix1=m4.translate(model_matrix,0,-0.11,0);
//   mo_matrix1=m4.scale(mo_matrix1,0.6, 0.05, 0.3);
//   gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
//   drawCube();

//   // vado frame pezzo_D
//   mo_matrix1=m4.xRotate(model_matrix, degToRad(-5));
//   mo_matrix1=m4.translate(mo_matrix1,0,+0.2,+0.95);
//   mo_matrix1=m4.scale(mo_matrix1,0.6, 0.05, 0.3);
//   gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
//   drawCube();
}

// disegna  macchina con le ruote
function drawCar(mozzo){
  // disegna corpo macchina
  drawCarlinga(mo_matrix);
  // drawAxis(); // disegna assi frame OGGETTO

  //mo_matrix1=m4.copy(mo_matrix);
  // // ruota posteriore D
  mo_matrix1=m4.translate(mo_matrix,0.58,-0.05,0.8);
  mo_matrix1=m4.xRotate(mo_matrix1, mozzo);
  mo_matrix1=m4.scale(mo_matrix1, 0.1, 0.20, 0.20);
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
  drawCube();
  // drawAxis(); // disegna assi frame ruota posteriore D

  //mo_matrix1=m4.copy(mo_matrix);
  // // ruota posteriore S
  mo_matrix1=m4.translate(mo_matrix,-0.58,-0.05,+0.8);
  mo_matrix1=m4.xRotate(mo_matrix1,mozzo);
  mo_matrix1=m4.scale(mo_matrix1,0.1, 0.20, 0.20);
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
  drawCube();
  // drawAxis(); // disegna assi frame ruota posteriore S

  //mo_matrix1=m4.copy(mo_matrix);
  // ruota anteriore D
  mo_matrix1=m4.translate(mo_matrix,0.58,-0.05,-0.55);
  mo_matrix1=m4.xRotate(mo_matrix1,mozzo);
  mo_matrix1=m4.scale(mo_matrix1,0.08, 0.15, 0.15);
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
  drawCube();
  // drawAxis(); // disegna assi frame ruota anteriore D
 
  //mo_matrix1=m4.copy(mo_matrix);
  // ruota anteriore S
  mo_matrix1=m4.translate(mo_matrix,-0.58,-0.05,-0.55);
  mo_matrix1=m4.xRotate(mo_matrix1,mozzo);
  mo_matrix1=m4.scale(mo_matrix1,0.08, 0.15, 0.15);
  gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix1);
  drawCube();
  // drawAxis(); // disegna assi frame ruota anteriore S
}


/*============= Creating a canvas ======================*/ 
var canvas = document.getElementById('my_Canvas');
gl = canvas.getContext('webgl');
//to manage text on canvas and webgl
// look up the text canvas.
var textCanvas = document.getElementById("text");
// make a 2D context for it
var ctx = textCanvas.getContext("2d");

/*========== Defining and storing the geometry ==========*/
//cubo a 6 facce triangolate
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

//cubo 8 vertici a linee
var vertices2=[
-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,];
var colors2=[
   0,0,0,  0,0,0,  0,0,0,  0,0,0,
   0,0,0,  0,0,0,  0,0,0,  0,0,0];
var indices2 = [
 0,1, 1,2, 2,3, 3,0, 4,5, 5,6, 6,7, 7,4, 1,5, 2,6, 3,7, 0,4]; 

//Axis
var l=3;
var vertices3=[0,0,0, l,0,0, 0,0,0, 0,l,0, 0,0,0, 0,0,l];
var colors3=[1,0,0, 1,0,0, 0,1,0, 0,1,0, 0,0,1, 0,0,1];
//Arrows
const K=0.125;
var vertices4=[0,l,0, K,l-K,0, -K,l-K,0, l,0,0, l-K,K,0, l-K,-K,0, 0,0,l, 0,K,l-K, 0,-K,l-K];
var colors4=[0,1,0, 0,1,0, 0,1,0, 1,0,0, 1,0,0, 1,0,0, 0,0,1, 0,0,1, 0,0,1];
var indices4 = [0,1,2, 3,4,5, 6,7,8]; 

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
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices2), gl.STATIC_DRAW);
// Create and store data into color buffer 
var color_buffer2 = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer2); 
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors2), gl.STATIC_DRAW);
// Create and store data into index buffer
var index_buffer2= gl.createBuffer (); 
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer2); 
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices2), gl.STATIC_DRAW); 

// Create and store data into color buffer
var vertex_buffer3 = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer3); 
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices3), gl.STATIC_DRAW);

// Create and store data into color buffer 
var color_buffer3 = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer3); 
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors3), gl.STATIC_DRAW);

// Create and store data into color buffer
var vertex_buffer4 = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer4); 
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices4), gl.STATIC_DRAW);

// Create and store data into color buffer 
var color_buffer4 = gl.createBuffer (); 
gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer4); 
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors4), gl.STATIC_DRAW);

// Create and store data into index buffer
var index_buffer4= gl.createBuffer (); 
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer4); 
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices4), gl.STATIC_DRAW);

//usa libreria webgl-utilis.js
var shaderprogram = webglUtils.createProgramFromScripts(gl,["vertex-shader", "fragment-shader"]);

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
var mo_matrix, mo_matrix1;

var mozzo_step=degToRad(5);
var mozzo = 0;

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
//render();
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

/*=================== Drawing =================== */
var render=function() {
//set projection matrix
var proj_matrix = m4.perspective(degToRad(fov), aspect, zmin, zmax);
//set view matrix
var camera = [D*Math.sin(PHI)*Math.cos(THETA),
              D*Math.sin(PHI)*Math.sin(THETA),
              D*Math.cos(PHI)];
var view_matrix = m4.inverse(m4.lookAt(camera, target, up));
//set model matrix to I4
        
gl.enable(gl.DEPTH_TEST);
// gl.depthFunc(gl.LEQUAL); 
gl.clearColor(1.0, 1.0, 1.0, 1); 
/*to manage text on canvas and webgl */
// Clear the 2D canvas
ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

gl.clearDepth(1.0);
gl.viewport(0.0, 0.0, canvas.width, canvas.height); 
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
gl.uniformMatrix4fv(_Pmatrix, false, proj_matrix); 
gl.uniformMatrix4fv(_Vmatrix, false, view_matrix); 
mo_matrix=m4.identity();
//gl.uniformMatrix4fv(_Mmatrix, false, mo_matrix);

//disegna il cubo base anziche' la macchina
//drawCubeWire();
if (!drag)
    mozzo -= mozzo_step;

  drawCar(mozzo); 

//to manage text on canvas and webgl
  ctx.font = '18pt Calibri';
  ctx.fillStyle = 'green'; 
  ctx.fillText('Welcome to CAR Project', 40, 50);

window.requestAnimationFrame(render); 
}
render();