  var canvas = document.getElementById('mycanvas');
  var ctx = canvas.getContext('2d');
  var canvasWidth = canvas.width;
  var canvasHeight = canvas.height;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  var id = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

    //var x = Math.floor(Math.random() * canvasWidth);
    //var y = Math.floor(Math.random() * canvasHeight);

    // var x = 10;
    // var y = 10;
    // var r = Math.floor(Math.random() * 256);
    // var g = Math.floor(Math.random() * 256);
    // var b = Math.floor(Math.random() * 256);
    // var a = 255;
    // setPixel(id, x,y, r,g,b,a);
    // x=x+100;
    // y=y+50;
    // setPixel(id, x,y, r,g,b,a);

    var n=31,alfa,radius=200,step,x,y;
    step=2*Math.PI/n;
    var cx=canvas.width/2, cy=canvas.height/2;
    for (var j=0; j<n; j++){
      alfa=j*step;
      x=Math.round(radius*Math.cos(alfa)+cx);
      y=Math.round(radius*Math.sin(alfa)+cy);
      setPixel(id, x,y, 0,0,0,255);
    }

    ctx.putImageData(id, 0, 0);

//    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
//    var id = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
//    ctx.putImageData(id, 0, 0);

  function setPixel(imageData, x, y, r, g, b, a) {
    var index = (x + y * imageData.width) * 4;
    imageData.data[index+0] = r;
    imageData.data[index+1] = g;
    imageData.data[index+2] = b;
    imageData.data[index+3] = a;
  }