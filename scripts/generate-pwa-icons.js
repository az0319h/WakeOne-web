// WakeOne PWA icons (plan 91) — source: public/assets/favicon.ico (256px, mint W on transparent)
// usage: sips -s format png public/assets/favicon.ico --out /tmp/favicon-256.png && node scripts/generate-pwa-icons.js /tmp/favicon-256.png public/icons
const path = require('path'); const fs = require('fs');
const { decode, encode } = require('./pwa-icons-pngio');
const [,, src, outDir] = process.argv;
const img = decode(src); const { w, h, data } = img;
// bbox of the W via alpha
let x0 = w, y0 = h, x1 = -1, y1 = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (data[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
const alphaAt = (fx, fy) => { // bilinear sample of alpha in source coords
  const xi = Math.floor(fx), yi = Math.floor(fy), tx = fx - xi, ty = fy - yi;
  const g = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : data[(y * w + x) * 4 + 3];
  return (g(xi, yi) * (1 - tx) + g(xi + 1, yi) * tx) * (1 - ty) + (g(xi, yi + 1) * (1 - tx) + g(xi + 1, yi + 1) * tx) * ty; };
// supersampled (2x2) mask of the W scaled to targetW, centred on size canvas
function markMask(size, targetW) {
  const scale = targetW / bw; const tw = bw * scale, th = bh * scale; const ox = (size - tw) / 2, oy = (size - th) / 2; const m = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { let acc = 0;
    for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const sx = x0 + (x + dx - ox) / scale - 0.5, sy = y0 + (y + dy - oy) / scale - 0.5; acc += alphaAt(sx, sy); }
    m[y * size + x] = acc / 4 / 255; } return m; }
function render(size, targetW, { bg, fg, transparent }) {
  const m = markMask(size, targetW); const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { const a = m[i]; const o = i * 4;
    if (transparent) { out[o] = fg[0]; out[o + 1] = fg[1]; out[o + 2] = fg[2]; out[o + 3] = Math.round(a * 255); }
    else { out[o] = Math.round(bg[0] + (fg[0] - bg[0]) * a); out[o + 1] = Math.round(bg[1] + (fg[1] - bg[1]) * a); out[o + 2] = Math.round(bg[2] + (fg[2] - bg[2]) * a); out[o + 3] = 255; } }
  return { w: size, h: size, data: out }; }
const MINT = [195, 248, 235];   // W mark colour sampled from favicon.ico (#C3F8EB)
const DARK = [9, 9, 11];        // META_THEME_COLORS.dark (#09090b)
const WHITE = [255, 255, 255];
fs.mkdirSync(outDir, { recursive: true });
const jobs = [
  ['icon-192.png', 192, 0.68, { bg: DARK, fg: MINT }],
  ['icon-512.png', 512, 0.68, { bg: DARK, fg: MINT }],
  ['icon-512-maskable.png', 512, 0.52, { bg: DARK, fg: MINT }],      // safe zone: 80% circle (r=205) · W 266x169 → corner r≈158
  ['apple-touch-icon-180.png', 180, 0.68, { bg: DARK, fg: MINT }],   // opaque (iOS adds the rounded corners)
  ['badge-72.png', 72, 0.82, { fg: WHITE, transparent: true }],      // monochrome white silhouette, transparent bg
];
for (const [name, size, ratio, opt] of jobs) { encode(path.join(outDir, name), render(size, Math.round(size * ratio), opt), !opt.transparent); console.log('wrote', name, size, 'W width', Math.round(size * ratio)); }
console.log('source bbox', { x0, y0, bw, bh });
