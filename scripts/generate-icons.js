/**
 * Gera os ícones do WishWatch (SVG + PNGs do PWA) sem dependências externas.
 *
 * Estilo: ícone monocromático do Android — squircle cinza (#8A8A8A) com um olho
 * preto (#1C1C1C). O olho é uma lente (interseção de dois círculos), com um anel
 * vazado e a pupila no centro.
 *
 * Uso: npm run icons
 */
import fs from 'fs';
import zlib from 'zlib';

const GRAY = [138, 138, 138];
const INK = [28, 28, 28];

// Proporções do olho em relação ao lado do ícone
const EYE = {
  any: { halfW: 0.34, halfH: 0.2, ring: 0.13, pupil: 0.075 },
  // Maskable: o launcher recorta até 20% das bordas, então o olho encolhe um pouco
  maskable: { halfW: 0.285, halfH: 0.168, ring: 0.109, pupil: 0.063 },
};

function lensGeometry(size, e) {
  const a = e.halfW * size;
  const b = e.halfH * size;
  const R = (a * a + b * b) / (2 * b);
  return { a, b, R, d: R - b, ring: e.ring * size, pupil: e.pupil * size };
}

/** Retorna a cor (ou null = transparente) de um ponto do ícone. */
function sample(x, y, size, mode) {
  const c = size / 2;
  const withBg = mode !== 'monochrome';
  const rounded = mode === 'any';

  if (rounded) {
    const r = size * 0.22;
    const qx = Math.max(Math.abs(x - c) - (c - r), 0);
    const qy = Math.max(Math.abs(y - c) - (c - r), 0);
    if (qx * qx + qy * qy > r * r) return null;
  }

  const g = lensGeometry(size, mode === 'any' ? EYE.any : EYE.maskable);
  const dx = x - c;
  const dy = y - c;
  const insideLens =
    dx * dx + (dy - g.d) * (dy - g.d) <= g.R * g.R &&
    dx * dx + (dy + g.d) * (dy + g.d) <= g.R * g.R;
  const dist = Math.sqrt(dx * dx + dy * dy);

  let ink = false;
  if (insideLens) ink = dist <= g.pupil || dist > g.ring;

  if (ink) return INK;
  return withBg ? GRAY : null;
}

function renderPNG(size, mode) {
  const SS = 4; // supersampling 4x4 para bordas suaves
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const col = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, size, mode);
          if (col) {
            r += col[0]; g += col[1]; b += col[2]; a += 1;
          }
        }
      }
      const n = SS * SS;
      raw[o++] = a ? Math.round(r / a) : 0;
      raw[o++] = a ? Math.round(g / a) : 0;
      raw[o++] = a ? Math.round(b / a) : 0;
      raw[o++] = Math.round((a / n) * 255);
    }
  }
  return encodePNG(size, size, raw);
}

function renderSVG(size = 512) {
  const g = lensGeometry(size, EYE.any);
  const c = size / 2;
  const f = (n) => +n.toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${f(size * 0.22)}" fill="#8A8A8A"/>
  <path fill="#1C1C1C" fill-rule="evenodd" d="M ${f(c - g.a)} ${c} A ${f(g.R)} ${f(g.R)} 0 0 1 ${f(c + g.a)} ${c} A ${f(g.R)} ${f(g.R)} 0 0 1 ${f(c - g.a)} ${c} Z M ${f(c + g.ring)} ${c} A ${f(g.ring)} ${f(g.ring)} 0 1 0 ${f(c - g.ring)} ${c} A ${f(g.ring)} ${f(g.ring)} 0 1 0 ${f(c + g.ring)} ${c} Z"/>
  <circle cx="${c}" cy="${c}" r="${f(g.pupil)}" fill="#1C1C1C"/>
</svg>
`;
}

// --- Encoder PNG mínimo ---
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.writeFileSync('public/icon.svg', renderSVG());
fs.writeFileSync('public/pwa-192x192.png', renderPNG(192, 'any'));
fs.writeFileSync('public/pwa-512x512.png', renderPNG(512, 'any'));
fs.writeFileSync('public/pwa-maskable-512x512.png', renderPNG(512, 'maskable'));
fs.writeFileSync('public/pwa-monochrome-512x512.png', renderPNG(512, 'monochrome'));
fs.writeFileSync('public/apple-touch-icon.png', renderPNG(180, 'maskable'));
fs.writeFileSync('public/notification-icon.png', renderPNG(192, 'any'));
console.log('Ícones gerados em public/.');
