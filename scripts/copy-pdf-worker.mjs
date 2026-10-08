import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
  join(
    root,
    'node_modules',
    'react-pdf',
    'node_modules',
    'pdfjs-dist',
    'build',
    'pdf.worker.min.mjs'
  )
];

const source = candidates.find((path) => existsSync(path));

if (!source) {
  console.error('copy-pdf-worker: pdf.worker.min.mjs not found in node_modules');
  process.exit(1);
}

const target = join(root, 'public', 'pdf.worker.min.mjs');
copyFileSync(source, target);
console.log(`copy-pdf-worker: copied ${source} -> ${target}`);
