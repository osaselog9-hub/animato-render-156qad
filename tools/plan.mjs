// node tools/plan.mjs <meta.json> [part]   Refuses anything over the limits (the build matrix itself comes from the app).
import fs from 'node:fs';
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));   // meta.json: only { seconds, parts }, nothing private
const secs = Number(job.seconds) || 0, parts = Number(job.parts) || 1, part = Number(process.argv[3] || 0);
if (!(secs > 0) || secs > 1800 + 5) { console.error('This video is longer than the limit of 1800 seconds.'); process.exit(1); }
if (parts < 1 || parts > 12 || part < 0 || part >= parts) { console.error('Part ' + part + ' is not part of this job (' + parts + ' parts, at most 12).'); process.exit(1); }
console.log('part', part + 1, 'of', parts, 'seconds', secs);
