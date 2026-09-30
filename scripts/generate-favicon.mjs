#!/usr/bin/env node
/**
 * בונה public/favicon.ico מ־public/favicon-32.png (ו־icon-192 אם קיים)
 * כ־ICO עם PNG מוטמע — בלי תלות חיצונית.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');

function icoFromPngs(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];
  for (const png of pngBuffers) {
    entries.push({ png, offset, size: png.length });
    offset += png.length;
  }
  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  let entryAt = 6;
  for (const e of entries) {
    // 0 = 256px in ICO; for smaller PNGs browsers ignore and use IHDR
    out.writeUInt8(0, entryAt);
    out.writeUInt8(0, entryAt + 1);
    out.writeUInt8(0, entryAt + 2);
    out.writeUInt8(0, entryAt + 3);
    out.writeUInt16LE(1, entryAt + 4);
    out.writeUInt16LE(32, entryAt + 6);
    out.writeUInt32LE(e.size, entryAt + 8);
    out.writeUInt32LE(e.offset, entryAt + 12);
    e.png.copy(out, e.offset);
    entryAt += 16;
  }
  return out;
}

function main() {
  const sources = ['favicon-32.png', 'icon-192.png']
    .map((name) => join(PUBLIC, name))
    .filter((p) => existsSync(p));
  if (sources.length === 0) {
    console.error('generate-favicon: חסרים favicon-32.png / icon-192.png ב־public/');
    process.exit(1);
  }
  const pngs = sources.map((p) => readFileSync(p));
  const ico = icoFromPngs(pngs);
  const dest = join(PUBLIC, 'favicon.ico');
  writeFileSync(dest, ico);
  console.log(
    `generate-favicon: כתב ${dest} (${ico.length} bytes) מ־${sources.map((s) => s.split(/[/\\]/).pop()).join(', ')}`
  );
}

main();
