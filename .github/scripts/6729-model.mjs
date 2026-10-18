import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.argv[2] ?? process.cwd();
const out = process.argv[3] ?? process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const test = fs.readFileSync(path.join(root, 'tests/e2e/ortho-depth-nudge.e2e.spec.ts'), 'utf8');
const geometry = fs.readFileSync(path.join(root, 'packages/renderer/src/scene-geometry.ts'), 'utf8');
function block(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (a < 0 || b < a) throw new Error(`Fixture generator anchor missing: ${start}`);
  return source.slice(a, b);
}
const colour = block(geometry, 'export function colorSaltByte(', '\n}\n') + '\n}';
const hash = block(test, 'function zHash(', '\n}\n') + '\n}';
const writer = block(test, 'class IfcScene {', '\nlet server:');
const code = ts.transpileModule(`${colour.replace('export ', '')}\n${hash}\n${writer}`, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const { IfcScene, zHash } = new Function(code + '\nreturn { IfcScene, zHash };')();
const scene = new IfcScene();
const blue = [0.1, 0.2, 0.9], red = [0.9, 0.1, 0.1];
const site = scene.product('IFCSLAB', '.BASESLAB.', [0, 10, -10], scene.rectangle(40, 40), 0.1, [0.6, 0.6, 0.6]);
const front = scene.product('IFCPLATE', '.NOTDEFINED.', [0, 0, 0], scene.rectangle(10, 10), 0.001, blue, h => h === 0, 'y');
const rear = scene.product('IFCPLATE', '.NOTDEFINED.', [0, 0.005, 0], scene.rectangle(10.4, 10.4), 0.001, red, h => h === 255, 'y');
let ifc = scene.toString();
for (const [id, name] of [[site, 'GREY SITE EXTENT - keep visible'], [front, 'BLUE FRONT - focus this plate'], [rear, 'RED REAR - hidden behind blue face']]) {
 const lines = ifc.split('\n'); const i = lines.findIndex(l => l.startsWith(`#${id}=`));
 if (i < 0) throw new Error(`Product ${id} missing`);
 lines[i] = lines[i].replace(/,\$,'IFC(?:SLAB|PLATE)'/, `,$,'${name}'`); ifc = lines.join('\n');
}
fs.mkdirSync(out, {recursive:true});
fs.writeFileSync(path.join(out, 'orthographic-4mm.ifc'), ifc);
fs.writeFileSync(path.join(out, 'model.json'), JSON.stringify({kind:'synthetic IFC4 visibility witness',site,front,rear,frontHash:zHash(front,blue),rearHash:zHash(rear,red),frontThicknessMetres:0.001,frontToRearMetres:0.005,clearanceMetres:0.004,source:'Existing #6729 IFC fixture writer; no reporter geometry'},null,2));
console.log(JSON.stringify({site,front,rear,frontHash:zHash(front,blue),rearHash:zHash(rear,red),bytes:Buffer.byteLength(ifc)}));
