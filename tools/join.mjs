// node tools/join.mjs <jobdir> <partsdir> <outdir>
// Joins the parts (in order) and adds the voiceover (raw 16-bit mono PCM pieces) as AAC.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readJobFile, decryptFile, decryptBuffer, encryptFile } from './crypt.mjs';
import { ffmpegBin } from './ff.mjs';
const [, , jobDir, partsDir, outDir] = process.argv;
const KEY = process.env.KEY;
const job = readJobFile(jobDir, KEY);
fs.mkdirSync(outDir, { recursive: true });
const run = (args) => { const r = spawnSync(ffmpegBin, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); if (r.status !== 0) throw new Error('ffmpeg failed'); };
const encParts = fs.readdirSync(partsDir).filter((n) => /^part-\d+\.enc$/.test(n)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
if (!encParts.length) throw new Error('No parts to join');
for (const n of encParts) decryptFile(path.join(partsDir, n), path.join(partsDir, n.replace('.enc', '.mp4')), KEY);
const parts = encParts.map((n) => n.replace('.enc', '.mp4'));
const list = path.join(outDir, 'list.txt');
fs.writeFileSync(list, parts.map((n) => "file '" + path.resolve(partsDir, n) + "'").join('\n'));
const silent = path.join(outDir, 'silent.mp4');
run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
const pcmFiles = fs.readdirSync(jobDir).filter((n) => /^audio-\d+\.enc$/.test(n)).sort();
const final = path.join(outDir, 'video.mp4');
if (job.audio && pcmFiles.length) {
  const raw = path.join(outDir, 'audio.raw');
  fs.writeFileSync(raw, Buffer.concat(pcmFiles.map((n) => decryptBuffer(fs.readFileSync(path.join(jobDir, n)), KEY))));
  run(['-i', silent, '-f', 's16le', '-ar', String(job.audio.rate), '-ac', '1', '-i', raw, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', final]);
} else {
  run(['-i', silent, '-c', 'copy', '-movflags', '+faststart', final]);
}
encryptFile(final, path.join(outDir, 'video.enc'), KEY);
console.log('video ready', final, (fs.statSync(final).size / 1048576).toFixed(1) + ' MB');
for (const f of ['list.txt', 'silent.mp4', 'audio.raw', 'video.mp4']) { try { fs.unlinkSync(path.join(outDir, f)); } catch (e) { /* none */ } }
