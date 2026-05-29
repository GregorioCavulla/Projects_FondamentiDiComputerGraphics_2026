const fs = require('fs');
let code = fs.readFileSync('Modulo1/Progetto/project/porygon_data.js','utf8');
code = code.replace(/const porygonSolids/g, 'global.porygonSolids');
eval(code);
global.porygonSolids.forEach((s, idx) => {
    let minX=100, maxX=-100, minY=100, maxY=-100, minZ=100, maxZ=-100;
    for(let i=0; i<s.vertices.length; i+=3) {
        if(s.vertices[i] < minX) minX = s.vertices[i];
        if(s.vertices[i] > maxX) maxX = s.vertices[i];
        if(s.vertices[i+1] < minY) minY = s.vertices[i+1];
        if(s.vertices[i+1] > maxY) maxY = s.vertices[i+1];
        if(s.vertices[i+2] < minZ) minZ = s.vertices[i+2];
        if(s.vertices[i+2] > maxZ) maxZ = s.vertices[i+2];
    }
    console.log(`Part ${idx}: X(${minX.toFixed(2)}, ${maxX.toFixed(2)}) Y(${minY.toFixed(2)}, ${maxY.toFixed(2)}) Z(${minZ.toFixed(2)}, ${maxZ.toFixed(2)}) verts:${s.vertices.length/3}`);
});
