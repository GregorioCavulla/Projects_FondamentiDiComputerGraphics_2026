    var radius=200, n;
    var canvas, ctx;
    var id;

    function init() {
     canvas = document.getElementById('mycanvas');
     ctx = canvas.getContext('2d');
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    function myFunction() {
     var x = document.getElementById("myNumber").value;
     n = Number(x);
    }

    function drawOnCanvas() {
       var ixp=[],iyp=[];
       var alfa,step;
       step=6.28/n;
       var cx=200, cy=200;
       for(var j=0; j<n; j++){
          alfa=j*step;
          ixp[j]=Math.round(radius*Math.cos(alfa)+cx);
          iyp[j]=Math.round(radius*Math.sin(alfa)+cy);
       }
       ixp[n]=ixp[0];
       iyp[n]=iyp[0];

       for(var i=0; i<n; i++){
         for(var j=i+1; j<=n; j++){
           draw_line(id,ixp[i],iyp[i],ixp[j],iyp[j],255,0,0,255);
         }
       }
      ctx.putImageData(id, 0, 0);
    }

    function cancelCanvas() {
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     id = ctx.getImageData(0, 0, canvas.width, canvas.height);
//     ctx.putImageData(id, 0, 0);
    }

    init();