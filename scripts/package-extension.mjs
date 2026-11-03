// Zips extension/ into release/checklater-extension-v<version>.zip for the Chrome Web Store.
// The manifest version is taken from package.json so the two never drift. No dependencies.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const manifestPath = 'extension/manifest.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.version !== version) {
  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest version → ${version}`);
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const posix = (p) => p.split('\\').join('/');
const files = walk('extension').filter((f) => !/(^|\/)\./.test(posix(relative('extension', f))));
if (!files.some((f) => posix(f).endsWith('lib/shared/config.js'))) {
  console.error('extension/lib/shared is missing. Run `npm run sync` first.');
  process.exit(1);
}

// Minimal ZIP writer (deflate, no zip64).
const locals = [];
const centrals = [];
let offset = 0;
for (const file of files.sort()) {
  const name = Buffer.from(posix(relative('extension', file)));
  const data = readFileSync(file);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0);
  head.writeUInt16LE(20, 4);
  head.writeUInt16LE(0x0800, 6); // UTF-8 names
  head.writeUInt16LE(8, 8); // deflate
  head.writeUInt16LE(0, 10);
  head.writeUInt16LE(0x21, 12); // 1980-01-01 (reproducible)
  head.writeUInt32LE(crc, 14);
  head.writeUInt32LE(comp.length, 18);
  head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(name.length, 26);
  head.writeUInt16LE(0, 28);
  locals.push(head, name, comp);

  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(8, 10);
  cen.writeUInt16LE(0, 12);
  cen.writeUInt16LE(0x21, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(comp.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(name.length, 28);
  cen.writeUInt32LE(offset, 42);
  centrals.push(cen, name);
  offset += head.length + name.length + comp.length;
}
const cenBuf = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenBuf.length, 12);
end.writeUInt32LE(offset, 16);

mkdirSync('release', { recursive: true });
const out = `release/checklater-extension-v${version}.zip`;
writeFileSync(out, Buffer.concat([...locals, cenBuf, end]));
console.log(`wrote ${out} (${files.length} files)`);
