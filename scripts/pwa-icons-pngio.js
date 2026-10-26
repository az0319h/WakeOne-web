// Minimal PNG (8-bit RGBA/RGB/Gray, non-interlaced) decode/encode using only zlib.
const zlib = require('zlib');
const fs = require('fs');
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function paeth(a, b, c) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
function decode(file) {
  const buf = fs.readFileSync(file); let pos = 8; let w, h, ct, bd; const idat = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8); const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; if (data[12] !== 0) throw new Error('interlaced'); }
    else if (type === 'IDAT') idat.push(data); pos += 12 + len; }
  if (bd !== 8) throw new Error('bitdepth ' + bd);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct]; const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * ch; const out = new Uint8Array(w * h * 4); let rp = 0; let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) { const f = raw[rp++]; const line = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) { const x = raw[rp++]; const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0; let v;
      switch (f) { case 0: v = x; break; case 1: v = x + a; break; case 2: v = x + b; break; case 3: v = x + ((a + b) >> 1); break; case 4: v = x + paeth(a, b, c); break; default: throw new Error('filter ' + f); } line[i] = v & 0xff; }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, s = x * ch;
      if (ch === 4) { out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2]; out[o + 3] = line[s + 3]; }
      else if (ch === 3) { out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2]; out[o + 3] = 255; }
      else if (ch === 2) { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = line[s + 1]; }
      else { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = 255; } }
    prev = line; }
  return { w, h, data: out };
}
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function encode(file, img, opaque = false) { const { w, h, data } = img; const ch = opaque ? 3 : 4; const raw = Buffer.alloc((w * ch + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * ch + 1)] = 0; for (let x = 0; x < w; x++) for (let c = 0; c < ch; c++) raw[y * (w * ch + 1) + 1 + x * ch + c] = data[(y * w + x) * 4 + c]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = opaque ? 2 : 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])); }
module.exports = { decode, encode };
