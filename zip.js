/* Minimal ZIP support so backups work offline with no libraries.
   createZip(): writes "stored" (uncompressed) entries - PDFs/JPGs are already compressed.
   readZip(): reads stored entries and deflate entries (if the browser has DecompressionStream),
   and verifies each entry's CRC-32 so damaged backups are rejected. */
(function (g) {
  'use strict';
  const T = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const enc = new TextEncoder(), dec = new TextDecoder();

  async function toU8(d) {
    if (d instanceof Uint8Array) return d;
    if (typeof d === 'string') return enc.encode(d);
    return new Uint8Array(await d.arrayBuffer());
  }

  async function createZip(entries) {
    const parts = [], central = [];
    let offset = 0;
    const now = new Date();
    const dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    for (const e of entries) {
      const name = enc.encode(e.name), data = await toU8(e.data), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, tm, true); lh.setUint16(12, dt, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.length;
    }
    let csize = 0; central.forEach(c => csize += c.byteLength);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }

  async function readZip(blob) {
    const buf = await blob.arrayBuffer();
    const v = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65535); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('This file is not a valid ZIP archive.');
    const count = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    const files = {};
    for (let i = 0; i < count; i++) {
      if (p + 46 > buf.byteLength || v.getUint32(p, true) !== 0x02014b50) throw new Error('The ZIP directory is damaged.');
      const method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true), csize = v.getUint32(p + 20, true);
      const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), lho = v.getUint32(p + 42, true);
      files[dec.decode(u8.subarray(p + 46, p + 46 + nlen))] = { method, crc, csize, lho };
      p += 46 + nlen + xlen + clen;
    }
    async function get(name) {
      const f = files[name];
      if (!f) return null;
      const lp = f.lho;
      if (lp + 30 > buf.byteLength || v.getUint32(lp, true) !== 0x04034b50) throw new Error('ZIP entry is damaged: ' + name);
      const start = lp + 30 + v.getUint16(lp + 26, true) + v.getUint16(lp + 28, true);
      if (start + f.csize > buf.byteLength) throw new Error('ZIP entry is truncated: ' + name);
      const raw = u8.subarray(start, start + f.csize);
      let out;
      if (f.method === 0) out = raw;
      else if (f.method === 8) {
        if (!('DecompressionStream' in g)) throw new Error('This browser cannot open compressed ZIP entries. Use a backup made by this app.');
        const ds = new DecompressionStream('deflate-raw');
        out = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer());
      } else throw new Error('Unsupported ZIP compression method in: ' + name);
      if (crc32(out) !== f.crc) throw new Error('Checksum mismatch - the backup file is corrupted: ' + name);
      return out;
    }
    return { names: Object.keys(files), get };
  }

  g.Zip = { createZip, readZip, crc32 };
})(typeof window !== 'undefined' ? window : globalThis);
