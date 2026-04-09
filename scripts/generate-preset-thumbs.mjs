// Generates 6 placeholder PNG thumbnails for the EffectsPanel preset chips.
// Pure-JS PNG encoder using node:zlib + manual IHDR/IDAT/IEND chunks — no
// external dependencies. The output PNGs are 96×96 RGBA HSL gradients tinted
// to match each preset's visual identity. Replace with hand-curated photos
// later via a follow-up quick task.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

function makeCrcTable() {
  const t = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC_TABLE = makeCrcTable();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePng(pixels, w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // Filter byte 0 per row, then RGBA pixel bytes
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    raw.set(pixels.subarray(y * w * 4, (y + 1) * w * 4), y * stride + 1);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)];
}

const W = 96;
const H = 96;
const presets = {
  bw:    { hue: 0,   sat: 0,  light: 50 },
  sepia: { hue: 30,  sat: 40, light: 55 },
  vivid: { hue: 200, sat: 80, light: 55 },
  fade:  { hue: 210, sat: 20, light: 65 },
  warm:  { hue: 25,  sat: 60, light: 55 },
  cool:  { hue: 210, sat: 50, light: 50 },
};

mkdirSync('src/assets/presets', { recursive: true });

for (const [name, { hue, sat, light }] of Object.entries(presets)) {
  const pixels = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Diagonal light → dark gradient gives the chip some visual texture
      const t = (x + y) / (W + H);
      const l = Math.max(5, Math.min(95, light + (t - 0.5) * 30));
      const [r, g, b] = hslToRgb(hue, sat, l);
      const i = (y * W + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }
  writeFileSync(`src/assets/presets/${name}.png`, encodePng(pixels, W, H));
}
console.log('Generated 6 preset thumbnails in src/assets/presets/');
