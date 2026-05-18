    var radius=1.0, n=7;
    var canvas, canvas_context;
    var view = {
      xmin: 0,
      xmax: 0,
      ymin: 0,
      ymax: 0 }
    var win = {
      xmin: -1.0,
      xmax: 1.0,
      ymin: -1.0,
      ymax: 1.0 }
    var scx, scy;
    
    function init() {
     canvas = document.getElementById('mycanvas'); 
     canvas_context = canvas.getContext("2d");
     
     view.xmin=0;
     view.xmax=canvas.width;
     view.ymin=0;
     view.ymax=canvas.height;
    
     win.xmin=-1.0;
     win.xmax=1.0;
     win.ymin=-1.0;
     win.ymax=1.0;

     scx=(view.xmax-view.xmin)/(win.xmax-win.xmin);
     scy=(view.ymax-view.ymin)/(win.ymax-win.ymin);
    }

    function myFunction() {
     var x = document.getElementById("myNumber").value;
     n = Number(x);
    }

    function win_view(px,py,scx,scy,view,win) {
      ixp = Math.round(scx * (px - win.xmin) + view.xmin);
      iyp = Math.round(scy * (win.ymin - py) + view.ymax);
      return {ixp: ixp,iyp: iyp};
    }

    function drawOnCanvas() {
       var fxp=[],fyp=[];
       var alfa,step;
       var ixp=[], iyp=[];
       step=6.28/n;
       for(var j=0; j<n; j++){
          alfa=j*step;
          fxp[j]=radius*Math.cos(alfa);
          fyp[j]=radius*Math.sin(alfa);
        }
      fxp[n]=fxp[0];
      fyp[n]=fyp[0];
      for(var j=0; j<=n; j++){
        ip=win_view(fxp[j],fyp[j],scx,scy,view,win);
        ixp[j]=ip.ixp;
        iyp[j]=ip.iyp;
      }
      canvas_context.beginPath();
      canvas_context.strokeStyle = 'rgb(255,0,0)';
       for(var i=0; i<n; i++){
         for(var j=i+1; j<=n; j++){
           canvas_context.moveTo(ixp[i], iyp[i]);
           canvas_context.lineTo(ixp[j], iyp[j]);
         }
       }
       canvas_context.stroke();
//       console.log("stampa di debug");
//       console.log(radius);
    }

    function cancelCanvas() {
      canvas_context.clearRect(0,0,canvas.width,canvas.height);
    }

    init();