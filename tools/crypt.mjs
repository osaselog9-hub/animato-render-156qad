// AES-256-GCM in 4 MB chunks: [u32 length][12-byte iv][ciphertext + 16-byte tag], after the 8 bytes "AGC1" + u32 chunk size.
// The same format is written and read by the app in the browser (public/gh-render.js).
import fs from 'node:fs';
import crypto from 'node:crypto';
const CH = 4 * 1024 * 1024, MAGIC = Buffer.from('AGC1');
const keyOf = (k) => Buffer.from(String(k || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
export function encryptFile(src, dst, key) {
  const k = keyOf(key), fi = fs.openSync(src, 'r'), fo = fs.openSync(dst, 'w'), buf = Buffer.alloc(CH);
  const head = Buffer.alloc(8); MAGIC.copy(head); head.writeUInt32LE(CH, 4); fs.writeSync(fo, head);
  for (;;) {
    const n = fs.readSync(fi, buf, 0, CH, null); if (!n) break;
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', k, iv), ct = Buffer.concat([c.update(buf.subarray(0, n)), c.final(), c.getAuthTag()]);
    const h = Buffer.alloc(4); h.writeUInt32LE(ct.length); fs.writeSync(fo, Buffer.concat([h, iv, ct]));
  }
  fs.closeSync(fi); fs.closeSync(fo);
}
export function decryptBuffer(data, key) {
  const k = keyOf(key); if (data.subarray(0, 4).toString() !== 'AGC1') throw new Error('Not an encrypted file');
  const out = []; let p = 8;
  while (p < data.length) {
    const len = data.readUInt32LE(p), iv = data.subarray(p + 4, p + 16), ct = data.subarray(p + 16, p + 16 + len); p += 16 + len;
    const d = crypto.createDecipheriv('aes-256-gcm', k, iv); d.setAuthTag(ct.subarray(ct.length - 16));
    out.push(d.update(ct.subarray(0, ct.length - 16)), d.final());
  }
  return Buffer.concat(out);
}
export const decryptFile = (src, dst, key) => fs.writeFileSync(dst, decryptBuffer(fs.readFileSync(src), key));
export const readJobFile = (dir, key) => JSON.parse(decryptBuffer(fs.readFileSync(dir + '/job.enc'), key).toString('utf8'));
