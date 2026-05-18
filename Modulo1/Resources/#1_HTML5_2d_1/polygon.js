    var radius=200, n;
    var canvas, canvas_context;

    function init() {
     canvas = document.getElementById('mycanvas'); 
     canvas_context = canvas.getContext("2d");
    }

    function myFunction() {
     var x = document.getElementById("myNumber").value;
     n = Number(x);
    }

    function drawOnCanvas() {
       var xp=[],yp=[];
       var alfa,step;
       step=2*Math.PI/n;
       var cx=canvas.width/2, cy=canvas.height/2;
        for (var j=0; j<n; j++){
          alfa=j*step;
          xp[j]=Math.round(radius*Math.cos(alfa)+cx);
          yp[j]=Math.round(radius*Math.sin(alfa)+cy);
        }
      xp[n]=xp[0];
      yp[n]=yp[0];

      canvas_context.strokeStyle = 'rgb(0,0,255)';
      canvas_context.beginPath();
      canvas_context.arc(200, 200, radius, 0, 2 * Math.PI, false);
      canvas_context.stroke();
//      canvas_context.closePath();
       canvas_context.beginPath();
       canvas_context.strokeStyle = 'rgb(255,0,0)';
       for(var i=0; i<n; i++){
         for(var j=i+1; j<=n; j++){
           canvas_context.moveTo(xp[i], yp[i]);
           canvas_context.lineTo(xp[j], yp[j]);
         }
       }
       canvas_context.stroke();
//       console.log("stampa di debug");
//       console.log(radius);
    }

    function cancelCanvas() {
      canvas_context.clearRect(0,0,400,400);
    }
    
    init();