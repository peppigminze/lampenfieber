// Bundles all ES modules, JSON data and CSS into ONE self-contained dist/index.html.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from './data-node.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*['"](.+?)['"];?\s*$/;
const EXPORT_RE = /^export\s+(?:async\s+)?(function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/;

const mods = new Map();
const order = [];
function load(rel) {
  rel = normalize(rel).replace(/\\/g, '/');
  if (mods.has(rel)) return;
  const src = readFileSync(join(root, rel), 'utf8');
  const deps = [], exports = [], out = [];
  for (const line of src.split('\n')) {
    const im = line.match(IMPORT_RE);
    if (im) {
      const dep = normalize(join(dirname(rel), im[2])).replace(/\\/g, '/');
      deps.push(dep);
      const names = im[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
      out.push(`const { ${names.join(', ')} } = __m[${JSON.stringify(dep)}];`);
      continue;
    }
    if (/^\s*import\s/.test(line)) throw new Error(`Unsupported import in ${rel}: ${line}`);
    const ex = line.match(EXPORT_RE);
    if (ex) { exports.push(ex[2]); out.push(line.replace(/^export\s+/, '')); continue; }
    if (/^export\s/.test(line)) throw new Error(`Unsupported export in ${rel}: ${line}`);
    if (/^\s*\/\/[^\n]*$/.test(line)) continue; // drop comment-only lines
    out.push(line);
  }
  mods.set(rel, { deps, exports, code: out.join('\n') });
  for (const d of deps) load(d);
  order.push(rel);
}
load('main.js');

let js = 'const __m = Object.create(null);\n';
for (const rel of order) {
  const m = mods.get(rel);
  js += `// ---- ${rel}\n__m[${JSON.stringify(rel)}] = (() => {\n${m.code}\nreturn { ${m.exports.join(', ')} };\n})();\n`;
}
js = js.replace(/<\/script/gi, '<\\/script');
const data = JSON.stringify(loadData()).replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}</style>`);
html = html.replace('<script type="module" src="main.js"></script>', () => `<script>window.__GAME_DATA__ = ${data};</script>\n<script type="module">\n${js}</script>`);
if (html.includes('src="main.js"') || html.includes('href="css/')) throw new Error('bundle replacement failed');
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), html);
console.log(`dist/index.html: ${(html.length / 1024).toFixed(1)} KB, ${order.length} modules: ${order.map((r) => relative('.', r)).join(', ')}`);
