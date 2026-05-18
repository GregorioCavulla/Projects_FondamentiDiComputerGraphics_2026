/***********************************************************************
draw_line: Funzione di disegno di una linea su canvas pixel per pixel;
*Algoritmo di Linea di Bresenham*
Input:
-(arg.1) puntatore alla struttura ImageData in cui si vuole disegnare;;
-(arg.2-3) coordinate primo estremo del linea;
-(arg.4-5) coordinate secondo estremo della linea;
-(arg.6-9) colore di disegno.
************************************************************************/
function draw_line(id, x0, y0, x1, y1, r, g, b, a)
{
  // absolute values of dx and dy, so as to not screw up calculation
  var dx=Math.abs(x1-x0);
  var dy=Math.abs(y1-y0);
  var x=x0;
  var y=y0;
  // when true, the loop will iterate through y instead of x
  var  reverse=dy>dx;  
  var d,incrE,incrNE;
  // these record which direction the line should go
  var xdir=incdir(x0,x1);
  var ydir=incdir(y0,y1);

  // swap dx and dy if reversed, so as to not dubar equation
  if(reverse) {
    dx = [dy, dy=dx][0];
  }

  // initialize.  If
  d=(dy*2)-dx;
  incrE=dy*2;
  incrNE=(dy-dx)*2;
  // draw first pixel
  setPixel(id,x,y,r,g,b,a);
  if(reverse)
    while(y!=y1) // iterate through y
    {
      y+=ydir;
      if(d<=0)
        d+=incrE;
      else
      {
        x+=xdir;
        d+=incrNE;
      }
      // draw next pixel
      setPixel(id,x,y,r,g,b,a);
    }
      else
    while(x!=x1) // iterate through x
    {
      x+=xdir;
      if(d<=0)
        d+=incrE;
      else
      {
        y+=ydir;
        d+=incrNE;
      }
      // draw pixel
      setPixel(id,x,y,r,g,b,a);
    }
}

function setPixel(imageData, x, y, r, g, b, a) {
    var index = (x + y * imageData.width) * 4;
    imageData.data[index+0] = r;
    imageData.data[index+1] = g;
    imageData.data[index+2] = b;
    imageData.data[index+3] = a;
  }

function incdir(a, b)
{
  if(a>b) 
    return -1;
  else 
    return 1;
}