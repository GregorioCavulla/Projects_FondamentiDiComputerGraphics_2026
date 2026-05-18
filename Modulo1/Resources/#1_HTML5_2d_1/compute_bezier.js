// var fxt=[], fyt=[]; //lista cp in coord. floating point
// var vxp=[], vyp=[]; //lista punti curva in coord. floating point
// var n=5;
// var m=100; //per disegnare m+1 punti

//algoritmo di de Casteljau per valutazione
//curva di Bézier di grado generico n in coordinate floating point
function compute_bezier(){
// input
// fxt, fyt: array di ascisse e ordinate dei punti di controllo
// n: grado della curva
// m: numero punti di valutazione - 1 (m+1)
// output
// vxp, vyp: array di ascisse e ordinate dei punti della curva

    var h=1/m;
    var fxp=[], fyp=[]; //copia dei cp per de Casteljau
    var t,d1,d2; 

//primo punto della curva
    vxp[0]=fxt[0];
    vyp[0]=fyt[0];
//calcola gli m-1 punti interni
    for (var k=1; k<m; k++){
        fxp=Array.from(fxt);
        fyp=Array.from(fyt);
        t=k*h;
        d1=t;
        d2=1.0-t;
        for (var j=1; j<n; j++)
           for (var i=0; i<n-j; i++){
              fxp[i]=d1*fxp[i+1]+d2*fxp[i];
              fyp[i]=d1*fyp[i+1]+d2*fyp[i]; 
        }
        vxp[k]=fxp[0];
        vyp[k]=fyp[0];
    }
//ultimo punto della curva
   vxp[m]=fxt[n];
   vyp[m]=fyt[n];
   win_view_convert();
}