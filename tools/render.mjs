// node tools/render.mjs <jobdir> <outdir> <part>
// Opens the app's engine in headless Chrome, draws this part's frames one by one and pipes them into ffmpeg.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { serve } from './serve.mjs';
import { readJobFile, encryptFile } from './crypt.mjs';
import { ffmpegBin } from './ff.mjs';

const [, , jobDir, outDir, partArg] = process.argv;
const part = Number(partArg) || 0;
const job = readJobFile(jobDir, process.env.KEY);
fs.mkdirSync(outDir, { recursive: true });

const { srv, port } = await serve(process.env.APP_DIR || 'app');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-extensions'] });
let ff = null;
try {
  // Several pages draw frames side by side (one per CPU core, at most 4): each page is its own process, so the cores all work.
  const cores = Math.max(1, Math.min(4, Number(process.env.RENDER_PAGES) || (os.availableParallelism ? os.availableParallelism() : os.cpus().length)));
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    page.on('pageerror', (e) => console.log('page error:', String(e).slice(0, 300)));
    await page.goto('http://127.0.0.1:' + port + '/index.html?render=1', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__AnimatoRender, null, { timeout: 120000 });
    const info = await page.evaluate((j) => window.__AnimatoRender.load(j), job);
    return { page, info };
  };
  const pages = await Promise.all(Array.from({ length: cores }, open));
  const info = pages[0].info;
  const N = info.frames, FPS = info.fps, parts = Math.max(1, Number(job.parts) || 1);
  const f0 = Math.floor(part * N / parts), f1 = part === parts - 1 ? N : Math.floor((part + 1) * N / parts);
  console.log('part', part + 1, 'of', parts, 'frames', f0, 'to', f1, 'of', N, 'at', info.W + 'x' + info.H, FPS + 'fps', 'with', cores, 'page(s)');
  const out = path.join(outDir, 'part-' + part + '.mp4');   // plain file, only here on the runner
  ff = spawn(ffmpegBin, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2), '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, bad) => { ff.on('close', (c) => (c === 0 ? ok() : bad(new Error('ffmpeg stopped with code ' + c)))); ff.on('error', bad); });
  const grab = (i) => pages[(i - f0) % cores].page.evaluate((n) => window.__AnimatoRender.frame(n), i);
  const AHEAD = 2 * cores, q = [];
  let next = f0;
  while (next < f1 && q.length < AHEAD) q.push(grab(next++));
  for (let i = f0; i < f1; i++) {
    const d = await q.shift();
    if (next < f1) q.push(grab(next++));
    const buf = Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((i - f0) % 600 === 0) console.log('frame', i, '/', f1);
  }
  ff.stdin.end();
  await done;
  encryptFile(out, path.join(outDir, 'part-' + part + '.enc'), process.env.KEY);
  fs.unlinkSync(out);
  console.log('part done', part + 1);
} finally {
  try { await browser.close(); } catch (e) { /* closed */ }
  srv.close();
}
