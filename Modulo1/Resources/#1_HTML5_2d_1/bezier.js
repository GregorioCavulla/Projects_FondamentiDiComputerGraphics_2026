var canvas;
var ctx;
var WIDTH = 400;
var HEIGHT = 400;
var C=10;
var dragok = false;

var loc, bbox;
var point=[]; 
var xt=[], yt=[];
const n=4;
var np=0, flag=0;

function init() {
    canvas = document.getElementById('mycanvas');
    ctx = canvas.getContext("2d");
    canvas.setAttribute('width', WIDTH);
    canvas.setAttribute('height', HEIGHT);
    //setInterval(draw, 10);
 }

function restart(){
    np=0;
    flag=0;
    clear();
}

function draw_rect(x,y,w,h,col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.rect(x,y,w,h);
    ctx.closePath();
    ctx.fill();
}

function clear() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
}

function windowToCanvas(canvas, x, y) {
    var bbox = canvas.getBoundingClientRect();
    return { x: Math.round(x - bbox.left * (canvas.width  / bbox.width)),
             y: Math.round(y - bbox.top  * (canvas.height / bbox.height))
           };
}

function draw() {
   if (flag==1){
      clear();
      draw_rect(0,0,WIDTH,HEIGHT,"#FAF7F8");

      draw_line(xt[0], yt[0], xt[1], yt[1], "red")
      draw_line(xt[2], yt[2], xt[3], yt[3], "red")

      draw_circ(xt[0],yt[0],C,"red");
      draw_circ(xt[3],yt[3],C,"red");
      draw_rect(xt[1]-C,yt[1]-C,2*C,2*C,"#000000");
      draw_rect(xt[2]-C,yt[2]-C,2*C,2*C,"#000000");

      compute_bezier();
   }
}

function compute_bezier(){
    ctx.strokeStyle ="#000000";
    ctx.beginPath();
    ctx.moveTo(xt[0],yt[0]);
    ctx.bezierCurveTo(xt[1],yt[1],xt[2],yt[2],xt[3],yt[3]);
    ctx.stroke();
  }

function draw_circ(pAx, pAy, r, col){
    ctx.strokeStyle =col;
    ctx.beginPath();
    ctx.fillStyle = col;
    ctx.arc(pAx, pAy, r, 0, Math.PI*2, true); 
    ctx.fill();
}

function draw_line(pAx, pAy, pBx, pBy, col){
    //  ctx.strokeStyle = "#0095cd";
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(pAx,pAy);
    ctx.lineTo(pBx,pBy);
    ctx.stroke();
}

function myMove(e){
 if (dragok){
   for (i=0; i<n; i++)
     if (point[i]){
       loc = windowToCanvas(canvas,e.pageX,e.pageY);
       xt[i]=loc.x;
       yt[i]=loc.y;
     }
   //window.requestAnimationFrame(draw);
   draw();
 }

}

function myUp(){
    dragok = false;
//    canvas.onmousemove = null;
}

function myDown(e){ 
    if (np==0){
        flag=0;
        clear();
    }
    if (np<n && flag==0) {  
       loc = windowToCanvas(canvas,e.pageX,e.pageY);
       xt[np]=loc.x;
       yt[np]=loc.y;
       if (np==1 || np==3)
          draw_line(xt[np-1],yt[np-1],xt[np],yt[np]);
       // disegna punto selezionato
       if (np==0 || np==3)
          draw_circ(xt[np],yt[np],C,"red");
       else
          draw_rect(xt[np]-C,yt[np]-C,2*C,2*C,"#000000");
       np++;
   
       if(np==n)   {
          // disegna poligonale
          flag=1;
          //window.requestAnimationFrame(draw);
          draw();
       }
    }
    else{
        point=[];
        loc = windowToCanvas(canvas,e.pageX,e.pageY);
        for (var i=0; i<n; i++)
            if (loc.x < xt[i] + C && loc.x > xt[i] - C &&
              loc.y < yt[i] + C && loc.y > yt[i] - C){
              point[i] = true;
              dragok=true;
//              canvas.onmousemove = myMove;
            }
    }

}

init();
canvas.onmousedown = myDown;
canvas.onmouseup = myUp;
canvas.onmousemove = myMove;
