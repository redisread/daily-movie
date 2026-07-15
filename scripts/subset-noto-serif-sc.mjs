import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const sourcePath = path.join(
  root,
  'node_modules/@fontsource/noto-serif-sc/files/noto-serif-sc-chinese-simplified-400-normal.woff2'
);
const outDir = path.join(root, 'public/fonts');
const outPath = path.join(outDir, 'NotoSerifSC-Regular.subset.woff2');

const scanDirs = ['src', 'public'];
const exts = new Set(['.astro', '.ts', '.tsx', '.yaml', '.json', '.md', '.css']);
const skip = new Set(['node_modules', 'dist', '.claude', '.astro']);

function isCjk(char) {
  const cp = char.codePointAt(0);
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0xff00 && cp <= 0xffef)
  );
}

function walk(dir, callback) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (skip.has(ent.name)) continue;
      walk(p, callback);
    } else if (exts.has(path.extname(ent.name))) {
      callback(p);
    }
  }
}

const chars = new Set();
for (const dir of scanDirs) {
  walk(path.join(root, dir), (p) => {
    const text = fs.readFileSync(p, 'utf8');
    for (const ch of text) {
      if (isCjk(ch)) chars.add(ch);
    }
  });
}

// Safety: include common CJK punctuation used in Chinese typography if not already scanned
for (const ch of '，。、；：？！「」『』《》（）—…·～“”‘’') chars.add(ch);

const text = Array.from(chars).sort().join('');
console.log(`Collected ${text.length} unique CJK/fullwidth code points`);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const sourceBuffer = fs.readFileSync(sourcePath);
console.log(`Source font: ${(sourceBuffer.length / 1024).toFixed(1)} KB`);

const subsetBuffer = await subsetFont(sourceBuffer, text, {
  targetFormat: 'woff2',
});

fs.writeFileSync(outPath, subsetBuffer);
console.log(`Subset font: ${(subsetBuffer.length / 1024).toFixed(1)} KB → ${path.relative(root, outPath)}`);
