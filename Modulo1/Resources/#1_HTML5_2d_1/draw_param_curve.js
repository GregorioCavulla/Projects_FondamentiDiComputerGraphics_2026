    var n=100;
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
 
//alcune curve  in forma parametrica di esempio
//circonferenza
//var a=0; b=2*Math.PI;
// var radius=1.0;
// fx=radius*Math.cos(t);
// fy=radius*Math.sin(t);

//folium of Descartes
//var a=0; b=2*Math.PI;
// fx=3*aa*t/(1+Math.pow(t,3));
// fy=3*aa*Math.pow(t,2)/(1+Math.pow(t,3));

//cardiode
//var a=0; b=2*Math.PI;
// fx = 2*Math.cos(t)-Math.cos(2*t);
// fy = 2*Math.sin(t)-Math.sin(2*t);

//astroid
var a=0; b=2*Math.PI;
// var bb=1.0, aa=(6-1)*bb;
// fx = aa*Math.pow(Math.cos(t),3);
// fy = aa*Math.pow(Math.sin(t),3);

//epicicloide
//var a=0; b=2*Math.PI;
// var bb=1.0, aa=(6-1)*bb;
// fx = (aa+bb)*Math.cos(t)-bb*Math.cos((aa/bb+1.0)*t);
// fy = (aa+bb)*Math.sin(t)-bb*Math.sin((aa/bb+1.0)*t);

    function param_curv(t){
    var fx,fy;
    var bb=1.0, aa=(6-1)*bb;
    fx = aa*Math.pow(Math.cos(t),3);
    fy = aa*Math.pow(Math.sin(t),3);
    return{x: fx, y: fy};
    }
     
    function init() {
     canvas = document.getElementById('mycanvas'); 
     canvas_context = canvas.getContext("2d");
     
     view.xmin=0;
     view.xmax=canvas.width;
     view.ymin=0;
     view.ymax=canvas.height;
    
     win.xmin=-3.0;
     win.xmax=3.0;
     win.ymin=-3.0;
     win.ymax=3.0;

     scx=(view.xmax-view.xmin)/(win.xmax-win.xmin);
     scy=(view.ymax-view.ymin)/(win.ymax-win.ymin);
    }

    function myFunction() {
     var x = document.getElementById("myNumber").value;
     n = Number(x);
    }

    function set_square_win(xp,yp){
    var dx,dy,diff;
      win.xmin=xp[0];
      win.xmax=xp[0];
      for (var i=0; i<=xp.length; i++){
        if (xp[i] > win.xmax)
          win.xmax=xp[i];
        else
          if (xp[i] < win.xmin)
            win.xmin=xp[i];
      }

      win.ymin=yp[0];
      win.ymax=yp[0];
      for (var i=0; i<=yp.length; i++){
        if (yp[i] > win.ymax)
          win.ymax=yp[i];
        else
          if (yp[i] < win.ymin)
            win.ymin=yp[i];
      }

      dx=win.xmax-win.xmin;
      dy=win.ymax-win.ymin;
      if (dy > dx){
         diff=(dy-dx)/2;
         win.xmin=win.xmin-diff;
         win.xmax=win.xmax+diff;
      }
      else {
         diff=(dx-dy)/2;
         win.ymin=win.ymin-diff;
         win.ymax=win.ymax+diff;        
      }
      scx=(view.xmax-view.xmin)/(win.xmax-win.xmin);
      scy=(view.ymax-view.ymin)/(win.ymax-win.ymin);
    }

    function win_view(px,py,scx,scy,view,win) {
      ixp = scx * (px - win.xmin) + view.xmin;
      iyp = scy * (win.ymin - py) + view.ymax;
      return {ixp: ixp,iyp: iyp};
    }

    function drawOnCanvas() {
       var fxp=[],fyp=[];
       var h,t,ff;
       var ixp=[], iyp=[];

       h=(b-a)/n;
       for(var j=0; j<=n; j++){
          t = a + j*h;
          ff=param_curv(t);
          fxp[j]=ff.x;
          fyp[j]=ff.y;
       }
       set_square_win(fxp,fyp);
       for(var j=0; j<=n; j++){
        ip=win_view(fxp[j],fyp[j],scx,scy,view,win);
        ixp[j]=ip.ixp;
        iyp[j]=ip.iyp;
      }
      canvas_context.beginPath();
      canvas_context.strokeStyle = 'rgb(0,0,255)';
      canvas_context.moveTo(ixp[0], iyp[0]);
      for(var i=1; i<=n; i++){
           canvas_context.lineTo(ixp[i], iyp[i]);
      }
      canvas_context.stroke();
    }

    function cancelCanvas() {
      canvas_context.clearRect(0,0,canvas.width,canvas.height);
    }

    init();