var canvas;
var gl;

var NumVertices  = 36;

var pointsArray = [];
var normalsArray = [];
var colorsArray = [];

var vertices = [
    [ 1.0, -1.0, -1.0, 1.0,],
    [ 1.0, -1.0,  1.0, 1.0,],
    [ 1.0,  1.0,  1.0, 1.0,],
    [ 1.0,  1.0, -1.0, 1.0,],
    [-1.0, -1.0, -1.0, 1.0,],
    [-1.0, -1.0,  1.0, 1.0,],
    [-1.0,  1.0,  1.0, 1.0,],
    [-1.0,  1.0, -1.0, 1.0,] ];

var vertexColors = [
    [0.0, 0.0, 0.0, 1.0,],  // black
    [1.0, 0.0, 0.0, 1.0,],  // red
    [1.0, 1.0, 0.0, 1.0,],  // yellow
    [0.0, 1.0, 0.0, 1.0,],  // green
    [0.0, 0.0, 1.0, 1.0,],  // blue
    [1.0, 0.0, 1.0, 1.0,],  // magenta
    [0.0, 1.0, 1.0, 1.0,],  // cyan
    [1.0, 1.0, 1.0, 1.0,]  // white
];
var lightPosition = [2.0, 2.0, 2.0, 0.0 ];
var lightAmbient =  [1.0, 1.0, 1.0, 1.0 ];
var lightDiffuse =  [1.0, 1.0, 1.0, 1.0 ];
var lightSpecular = [1.0, 1.0, 1.0, 1.0 ];

var materialAmbient = [0.25, 0.25, 0.25, 1.0];
var materialDiffuse = [1.0, 1.0, 1.0, 1.0];
var materialSpecular = [1.0, 0.2, 0.0, 1.0];
var materialShininess = 10.0;

var ambientColor, diffuseColor, specularColor;
var view, model, projection;
var theta =[0, 0, 0];
var xAxis, yAxis, zAxis;

var program;

var  controls = {
    near : 1,
    far : 100,
    D : 5.0,
    theta : 0.78,
    phi  : 0.78,
    fovy : 40.0,  // Field-of-view in Y direction angle (in degrees)
    rotationAxis: 0,
    rotation : false
   }

var dr = 5.0 * Math.PI/180.0;

var  aspect;       // Viewport aspect ratio

var vMatrix, cameraMatrix, mMatrix=m4.identity(), pMatrix;
var eye;
var at = [0, 0, 0];
var up = [0, 0, 1];

function quad(a, b, c, d) {
     var t1 = m4.subtractVectors(vertices[b], vertices[a]);
     var t2 = m4.subtractVectors(vertices[c], vertices[b]);
     var normal=[];
     normal = m4.cross(t1, t2, normal);

     pointsArray.push(vertices[a]);
     normalsArray.push(normal); 
     colorsArray.push(vertexColors[a]); 
     pointsArray.push(vertices[b]);
     normalsArray.push(normal); 
     colorsArray.push(vertexColors[a]); 
     pointsArray.push(vertices[c]); 
     normalsArray.push(normal);
     colorsArray.push(vertexColors[a]);     
     pointsArray.push(vertices[a]); 
     normalsArray.push(normal);
     colorsArray.push(vertexColors[a]); 
     pointsArray.push(vertices[c]); 
     normalsArray.push(normal);
     colorsArray.push(vertexColors[a]); 
     pointsArray.push(vertices[d]);
     normalsArray.push(normal);
     colorsArray.push(vertexColors[a]); 
}

function colorCube(){
    quad( 1, 0, 3, 2 );
    quad( 2, 3, 7, 6 );
    quad( 3, 0, 4, 7 );
    quad( 6, 5, 1, 2 );
    quad( 4, 5, 6, 7 );
    quad( 5, 4, 0, 1 );
}

function define_gui(){
var gui = new dat.GUI();

    gui.add(controls,"near").min(1).max(10).step(1);
    gui.add(controls,"far").min(1).max(100).step(1);
    gui.add(controls,"D").min(0).max(10).step(1);
    gui.add(controls,"theta").min(0).max(6.28).step(dr);
    gui.add(controls,"phi").min(0).max(3.14).step(dr);
    gui.add(controls,"fovy").min(10).max(120).step(5);
    gui.add(controls,"rotationAxis", [0, 1, 2]);
    gui.add(controls,"rotation");
}

window.onload = function init() {

    define_gui();
    
    canvas = document.getElementById( "mycanvas" );
 
    gl = canvas.getContext("webgl");
    if (!gl) {
      alert( "WebGL isn't available" );
      return;
    } 

    gl.viewport( 0, 0, canvas.width, canvas.height );
    
    aspect =  canvas.width/canvas.height;
    
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
    
    //gl.enable(gl.CULL_FACE,null);
    gl.enable(gl.DEPTH_TEST);

    //  Load shaders and initialize attribute buffers
    //
    // setup GLSL program
    var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader", "fragment-shader"]);
    gl.useProgram( program );
    
    colorCube();

    pointsArray=m4.flatten(pointsArray);
    normalsArray=m4.flatten(normalsArray);
    colorsArray=m4.flatten(colorsArray);

    var nBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, normalsArray, gl.STATIC_DRAW );
    
    var vNormal = gl.getAttribLocation( program, "vNormal" );
    gl.vertexAttribPointer( vNormal, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNormal );

    var cBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, colorsArray, gl.STATIC_DRAW );
    
    var vColor = gl.getAttribLocation( program, "vColor" );
    gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vColor);

    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, pointsArray, gl.STATIC_DRAW );
    
    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );
 
    view = gl.getUniformLocation( program, "viewMatrix" );
    projection = gl.getUniformLocation( program, "projectionMatrix" );
    model = gl.getUniformLocation(program, "modelMatrix");

    ambientProduct = m4.mvec4(lightAmbient, materialAmbient);
    diffuseProduct = m4.mvec4(lightDiffuse, materialDiffuse);
    specularProduct = m4.mvec4(lightSpecular, materialSpecular);
 
    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct" ), ambientProduct);
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct" ), diffuseProduct );
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"), specularProduct );	
    gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"  ), lightPosition );
       
    gl.uniform1f(gl.getUniformLocation(program, "shininess"), materialShininess);

    render(); 
}

function degToRad(d) {
   return d * Math.PI / 180;
}

function radToDeg(r) {
    return r * 180 / Math.PI;
 }

var render = function(){

    // Tell WebGL how to convert from clip space to pixels
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 

    eye = [controls.D*Math.sin(controls.phi)*Math.cos(controls.theta), 
           controls.D*Math.sin(controls.phi)*Math.sin(controls.theta),
           controls.D*Math.cos(controls.phi)];
    // Compute the camera's matrix
    var cameraMatrix = m4.lookAt(eye, at, up);
    
   // Make a view matrix from the camera matrix.
    var vMatrix = m4.inverse(cameraMatrix);

    // Compute the projection matrix
    var pMatrix = m4.perspective(degToRad(controls.fovy), aspect, controls.near, controls.far);
    
    if(controls.rotation) {
        theta[controls.rotationAxis] += 1.0;  
        mMatrix = m4.identity();
        mMatrix = m4.xRotate(mMatrix,degToRad(theta[0]));
        mMatrix = m4.yRotate(mMatrix,degToRad(theta[1]));
        mMatrix = m4.zRotate(mMatrix,degToRad(theta[2]));
    }

    gl.uniformMatrix4fv( view, false, vMatrix );
    gl.uniformMatrix4fv( projection, false, pMatrix );
    gl.uniformMatrix4fv( model, false, mMatrix );
            
    gl.drawArrays( gl.TRIANGLES, 0, NumVertices );
    window.requestAnimationFrame(render);
}
