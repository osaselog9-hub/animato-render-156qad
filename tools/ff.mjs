// The ffmpeg to use: the one installed with the tools (cached), else the one on the machine.
let bin = 'ffmpeg';
try { const m = await import('ffmpeg-static'); if (m.default) bin = m.default; } catch (e) { /* use the machine's ffmpeg */ }
export const ffmpegBin = bin;
