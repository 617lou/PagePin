"use strict";

// Generates the pushpin PNG icons (16/32/48/128) referenced by manifest.json.
// Pure Node, no dependencies: the same Material push_pin silhouette used by the
// toolbar logo (rotated 45 degrees) is rasterized with supersampling and encoded
// with a minimal PNG writer. Run: node tools/make-icons.js

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZES = [16, 32, 48, 128];
const OUT_DIR = path.join(__dirname, "..", "icons");

// ---------------------------------------------------------------- PNG encode

let CRC_TABLE = null;

function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// ------------------------------------------------------------------ geometry

const ROT_C = Math.SQRT1_2;

function inRoundRect(x, y, x0, x1, y0, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) {
    return false;
  }
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
  return dx * dx + dy * dy <= r * r;
}

// Material push_pin silhouette in a 24x24 design space (before rotation).
function inPinDesign(u, v) {
  if (inRoundRect(u, v, 6, 18, 2, 4, 1)) return true; // handle bar
  if (u >= 8 && u <= 16 && v >= 4 && v <= 12) return true; // neck
  // funnel flares: concave arcs, filled outside the radius-3 circle
  if (u >= 5 && u <= 8 && v >= 9 && v <= 12 && (u - 5) * (u - 5) + (v - 9) * (v - 9) >= 9) return true;
  if (u >= 16 && u <= 19 && v >= 9 && v <= 12 && (u - 19) * (u - 19) + (v - 9) * (v - 9) >= 9) return true;
  if (u >= 5 && u <= 19 && v >= 12 && v <= 14) return true; // collar
  if (u >= 10.97 && u <= 12.97 && v >= 14 && v <= 21) return true; // needle
  if (v >= 21 && v <= 22 && Math.abs(u - 11.97) <= 22 - v) return true; // tip
  return false;
}

// Bounding box of the pin after rotate(45 12 12) is roughly
// x:[4.91, 23.31] y:[0.69, 19.05] -> visual center (14.11, 9.87).
const PIN_CX = 14.11;
const PIN_CY = 9.87;

function inPin(px, py, size) {
  const scale = size / 23;
  const dx = (px - size / 2) / scale + PIN_CX - 12;
  const dy = (py - size / 2) / scale + PIN_CY - 12;
  // undo rotate(45deg) around (12, 12)
  const u = ROT_C * (dx + dy) + 12;
  const v = ROT_C * (dy - dx) + 12;
  return inPinDesign(u, v);
}

function inBadge(px, py, size) {
  const r = size * 0.22;
  const h = size / 2;
  const ax = Math.abs(px - h) - (h - r);
  const ay = Math.abs(py - h) - (h - r);
  const ox = Math.max(ax, 0);
  const oy = Math.max(ay, 0);
  return ox * ox + oy * oy <= r * r;
}

// ------------------------------------------------------------------ rendering

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const sup = size <= 48 ? 8 : 4; // supersampling grid
  const n = sup * sup;
  const top = [59, 130, 246]; // #3b82f6
  const bottom = [29, 78, 216]; // #1d4ed8

  for (let y = 0; y < size; y++) {
    const t = (y + 0.5) / size;
    const bg = [
      Math.round(top[0] + (bottom[0] - top[0]) * t),
      Math.round(top[1] + (bottom[1] - top[1]) * t),
      Math.round(top[2] + (bottom[2] - top[2]) * t)
    ];
    for (let x = 0; x < size; x++) {
      let badge = 0;
      let pin = 0;
      for (let sy = 0; sy < sup; sy++) {
        for (let sx = 0; sx < sup; sx++) {
          const px = x + (sx + 0.5) / sup;
          const py = y + (sy + 0.5) / sup;
          if (inBadge(px, py, size)) {
            badge++;
            if (inPin(px, py, size)) {
              pin++;
            }
          }
        }
      }
      const cb = badge / n;
      if (cb <= 0) {
        continue; // stays fully transparent
      }
      const cp = pin / n;
      const off = (y * size + x) * 4;
      rgba[off] = Math.round((255 * cp + bg[0] * (cb - cp)) / cb);
      rgba[off + 1] = Math.round((255 * cp + bg[1] * (cb - cp)) / cb);
      rgba[off + 2] = Math.round((255 * cp + bg[2] * (cb - cp)) / cb);
      rgba[off + 3] = Math.round(cb * 255);
    }
  }
  return encodePng(size, rgba);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = path.join(OUT_DIR, "icon" + size + ".png");
  fs.writeFileSync(file, renderIcon(size));
  console.log("written " + file);
}
