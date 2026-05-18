"use strict";

var mesh = new Array();
var positions = [];
var normals = [];
var texcoords = [];
var numVertices;
var ambient;   //Ka
var diffuse;   //Kd
var specular;  //Ks
var emissive;  //Ke
var shininess; //Ns
var opacity;   //Ni

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.getElementById("canvas");
  var gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }
  mesh.sourceMesh='resources/data/cube/cube.obj';
  //mesh.sourceMesh='resources/data/chair/chair.obj';
  //mesh.sourceMesh='resources/data/boeing/boeing_3.obj';
  //mesh.sourceMesh='resources/data/soccerball/soccerball.obj';
  //mesh.sourceMesh='resources/data/ruota/ruota_davanti_origine.obj';
  //mesh.sourceMesh='resources/data/ruota/ruota_davanti_gomma.obj';
  //carica mesh oggetto cubo bucato
  //mesh.sourceMesh='resources/data/cubo2_lev3/cubo3_lev3.obj';

  (async () => {

    await LoadMesh(gl,mesh);

    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Put the positions in the buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER mormalsBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
    // Put the normals in the buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER texcoordBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    // Set Texcoords
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);

    var ambientLight=[0.2,0.2,0.2];
    var colorLight=[1.0,1.0,1.0];

    gl.uniform3fv(gl.getUniformLocation(program, "diffuse" ), diffuse );
    gl.uniform3fv(gl.getUniformLocation(program, "ambient" ), ambient); 
    gl.uniform3fv(gl.getUniformLocation(program, "specular"), specular );	
    gl.uniform3fv(gl.getUniformLocation(program, "emissive"), emissive );
    //gl.uniform3fv(gl.getUniformLocation(program, "u_lightDirection" ), xxx );
    gl.uniform3fv(gl.getUniformLocation(program, "u_ambientLight" ), ambientLight );
    gl.uniform3fv(gl.getUniformLocation(program, "u_colorLight" ), colorLight );

    gl.uniform1f(gl.getUniformLocation(program, "shininess"), shininess);
    gl.uniform1f(gl.getUniformLocation(program, "opacity"), opacity);

    gl.uniform1i(textureLocation, 0);

    requestAnimationFrame(animate);

  })();

  // setup GLSL program
  var program = webglUtils.createProgramFromScripts(gl, ["3d-vertex-shader", "3d-fragment-shader"]);
  // Tell it to use our program (pair of shaders)
  gl.useProgram(program);

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, "a_position");
  var normalLocation = gl.getAttribLocation(program, "a_normal");
  var texcoordLocation = gl.getAttribLocation(program, "a_texcoord");

  // Create a buffer for positions
  var positionBuffer = gl.createBuffer();

  // Create a buffer for normals
  var normalsBuffer = gl.createBuffer();

  // provide texture coordinates
  var texcoordBuffer = gl.createBuffer();

  // Turn on the position attribute
  gl.enableVertexAttribArray(positionLocation);
  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  var size = 3;          // 3 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(positionLocation, size, type, normalize, stride, offset);

  // Turn on the normal attribute
  gl.enableVertexAttribArray(normalLocation);
  // Bind the normal buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
  gl.vertexAttribPointer(normalLocation, size, type, normalize, stride, offset);

  // Turn on the texcord attribute
  gl.enableVertexAttribArray(texcoordLocation);
  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  size = 2;          // 2 components per iteration
  gl.vertexAttribPointer(texcoordLocation, size, type, normalize, stride, offset);

  var fieldOfViewRadians = degToRad(30);
  var modelXRotationRadians = degToRad(0);
  var modelYRotationRadians = degToRad(0);

  // Compute the projection matrix
  var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  //  zmin=0.125;
  var zmin=0.1;
  var projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, zmin, 200);

  var cameraPosition = [4.5, 4.5, 2];
  var up = [0, 0, 1];
  var target = [0, 0, 0];

  // Compute the camera's matrix using look at.
  var cameraMatrix = m4.lookAt(cameraPosition, target, up);

  // Make a view matrix from the camera matrix.
  var viewMatrix = m4.inverse(cameraMatrix);

  var matrixLocation = gl.getUniformLocation(program, "u_world");
  var textureLocation = gl.getUniformLocation(program, "diffuseMap");
  var viewMatrixLocation = gl.getUniformLocation(program, "u_view");
  var projectionMatrixLocation = gl.getUniformLocation(program, "u_projection");
  var lightWorldDirectionLocation = gl.getUniformLocation(program, "u_lightDirection");
  var viewWorldPositionLocation = gl.getUniformLocation(program, "u_viewWorldPosition");

  gl.uniformMatrix4fv(viewMatrixLocation, false, viewMatrix);
  gl.uniformMatrix4fv(projectionMatrixLocation, false, projectionMatrix);
        
  // set the light position
  gl.uniform3fv(lightWorldDirectionLocation, m4.normalize([-1, 3, 5]));

  // set the camera/view position
  gl.uniform3fv(viewWorldPositionLocation, cameraPosition);

  var AMORTIZATION=0.98;
  var drag=false;
  var old_x, old_y;
  var dX=0, dY=0;
  var THETA0=0.005, PHI0=0.003;
  var THETA=THETA0, PHI=PHI0;

  canvas.addEventListener("mousedown", mouseDown, false); 
  canvas.addEventListener("mouseup", mouseUp, false); 
  canvas.addEventListener("mouseout", mouseUp, false); 
  canvas.addEventListener("mousemove", mouseMove, false);

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var mouseDown=function(e) {
    drag=true;
    old_x=e.pageX, old_y=e.pageY;
    THETA=0;
    PHI=0;
    e.preventDefault();
    return false;
  };

  var mouseUp=function(e){
    drag=false;
  };

  var mouseMove=function(e) {
   if (!drag) return false; 
   dX=(e.pageX-old_x)*2*Math.PI/canvas.width, 
   dY=(e.pageY-old_y)*2*Math.PI/canvas.height; 
   THETA+=0.125*dX;
   PHI+=0.125*dY;
   //console.log(dX,dY);
   old_x=e.pageX, old_y=e.pageY; 
   e.preventDefault();
  };

  // Draw the scene.
  function animate(time) {
    if (!drag) {
         dX*=AMORTIZATION, dY*=AMORTIZATION;
         THETA=THETA0+dX, PHI=PHI0+dY;
    }
    // Animate the rotation
    modelYRotationRadians += THETA;
    modelXRotationRadians += PHI;

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    //gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Clear the canvas AND the depth buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var matrix = m4.identity();
    matrix = m4.xRotate(matrix, modelXRotationRadians);
    matrix = m4.yRotate(matrix, modelYRotationRadians);

    // Set the matrix.
    gl.uniformMatrix4fv(matrixLocation, false, matrix);

    // Draw the geometry.
    gl.drawArrays(gl.TRIANGLES, 0, numVertices);

    requestAnimationFrame(animate);
  }

}

main();