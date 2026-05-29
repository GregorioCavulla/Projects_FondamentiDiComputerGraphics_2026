const fs = require('fs');
let code = fs.readFileSync('Modulo1/Progetto/project/porygon_data.js','utf8');
code = code.replace(/const porygonSolids/g, 'global.porygonSolids');
eval(code);
console.log('Total indices array length:', porygonIndices.length);
let sum = porygonParts.reduce((acc, p) => acc + p.indexCount, 0);
console.log('Sum of parts indices:', sum);
