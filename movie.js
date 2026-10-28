/* 1億2千万分の1 ― 一生涯のショートムービー（縦720×1280、BGMつき、録画できる） */
'use strict';
window.JINSEI_MOVIE = (() => {
const FONT = (w, px) => `${w} ${px}px -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;
const COLORS = { milestone: '#e8503a', good: '#2e8b57', bad: '#5b6b8c', death: '#1f2330', info: '#8a8f9a' };
const STAT = { health: '#3aa66b', happy: '#f2a93b', learn: '#4a7bd0', bond: '#c85c9e' };
const yen = (m) => { const v = Math.round(m); if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}億円`; return `${v.toLocaleString()}万円`; };

function seedRnd(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- 場面を選ぶ ---------- */
function buildScenes(L, pct) {
  const evs = L.log.map((e, i) => ({ ...e, i })).filter(e => ['milestone', 'good', 'bad', 'death'].includes(e.kind));
  const MAX = 30;
  let chosen = evs;
  if (evs.length > MAX) {
    const must = evs.filter(e => e.kind === 'milestone' || e.kind === 'death');
    const rest = evs.filter(e => !(e.kind === 'milestone' || e.kind === 'death'));
    const room = Math.max(0, MAX - must.length);
    const step = rest.length / Math.max(1, room);
    const picked = []; for (let k = 0; k < room; k++) picked.push(rest[Math.floor(k * step)]);
    chosen = [...must, ...picked].sort((a, b) => a.i - b.i);
    if (chosen.length > MAX) { const keep = chosen.filter(e => e.kind !== 'milestone' || e.age <= 24 || e.age >= 55); chosen = (keep.length >= MAX ? keep : chosen).slice(0, MAX - 1).concat(chosen[chosen.length - 1]); }
  }
  const scenes = [{ type: 'intro', dur: 2.6 }];
  for (const e of chosen) scenes.push({ type: 'event', dur: e.kind === 'death' ? 2.6 : 1.7, e });
  scenes.push({ type: 'outro', dur: 4.2, pct });
  let t = 0; for (const s of scenes) { s.t0 = t; t += s.dur; }
  return { scenes, total: t };
}

/* ---------- 描画 ---------- */
function wrap(c, text, maxW) {
  const lines = []; let cur = '';
  for (const ch of text) { const test = cur + ch; if (c.measureText(test).width > maxW && cur) { lines.push(cur); cur = ch; } else cur = test; }
  if (cur) lines.push(cur); return lines;
}
function histAt(L, age) { let h = L.hist[0]; for (const x of L.hist) { if (x.age <= age) h = x; else break; } return h || { s: L.s, net: 0 }; }
function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

function drawFrame(c, W, H, L, sc, local, opts) {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  const fade = Math.min(1, local / 0.3); const out = Math.min(1, Math.max(0, (sc.dur - local) / 0.25));
  const alpha = Math.min(fade, out);
  c.globalAlpha = 1;
  // 共通ヘッダー
  c.fillStyle = '#8a8f9a'; c.font = FONT(500, 24); c.textAlign = 'left'; c.fillText('1億2千万分の1', 48, 70);
  c.textAlign = 'right'; c.fillText(`${L.fullName} · ${L.pref}生まれ`, W - 48, 70); c.textAlign = 'left';

  if (sc.type === 'intro') {
    c.globalAlpha = alpha;
    c.fillStyle = '#1f2330'; c.font = FONT(700, 60); c.textAlign = 'center';
    c.fillText(`${L.birthYear}年`, W / 2, 440);
    c.font = FONT(700, 112); c.fillText(L.pref, W / 2, 580);
    c.font = FONT(500, 44); c.fillText('に、ひとりの子が生まれた。', W / 2, 660);
    c.font = FONT(500, 40); c.fillStyle = '#6b6f7a'; c.fillText(`${L.fullName}（${L.sex}）`, W / 2, 760);
    c.fillStyle = '#e8503a'; c.fillRect(W / 2 - 40 * easeOut(Math.min(1, local / 1.2)), 820, 80 * easeOut(Math.min(1, local / 1.2)), 6);
    c.globalAlpha = 1; return;
  }
  if (sc.type === 'event') {
    const e = sc.e; const h = histAt(L, e.age);
    const col = COLORS[e.kind] || COLORS.info;
    // 年齢
    c.globalAlpha = alpha;
    c.fillStyle = col; c.fillRect(48, 120, 10, 150);
    c.fillStyle = '#1f2330'; c.font = FONT(700, 140); c.fillText(`${e.age}`, 80, 250);
    c.font = FONT(500, 40); c.fillText('歳', 80 + c.measureText(`${e.age}`).width * 3.5 + 16, 250);
    c.fillStyle = '#8a8f9a'; c.font = FONT(500, 30); c.fillText(`${L.birthYear + e.age}年`, 82, 300);
    // 本文
    c.fillStyle = e.kind === 'death' ? '#1f2330' : '#1f2330'; c.font = FONT(e.kind === 'milestone' || e.kind === 'death' ? 700 : 500, 46);
    const lines = wrap(c, e.text, W - 96);
    const y0 = 420; const slide = (1 - easeOut(Math.min(1, local / 0.4))) * 20;
    lines.slice(0, 7).forEach((ln, i) => c.fillText(ln, 48, y0 + i * 68 + slide));
    // 状態
    const sy = 880;
    [['健康', 'health'], ['幸せ', 'happy'], ['学び', 'learn'], ['つながり', 'bond']].forEach(([lab, k], i) => {
      const y = sy + i * 46; c.fillStyle = '#6b6f7a'; c.font = FONT(500, 24); c.fillText(lab, 48, y + 22);
      c.fillStyle = '#eceef2'; c.fillRect(170, y + 4, W - 170 - 48, 18); c.fillStyle = STAT[k]; c.fillRect(170, y + 4, (W - 170 - 48) * (h.s[k] / 100), 18);
    });
    c.fillStyle = '#1f2330'; c.font = FONT(600, 28); c.fillText(`純資産 ${yen(h.net || 0)}`, 48, sy + 4 * 46 + 26);
    c.globalAlpha = 1;
    // 人生の帯（下）
    const total = Math.max(60, L.map.length); const cw = (W - 96) / total;
    for (let i = 0; i < L.map.length; i++) { const on = i <= e.age; c.fillStyle = on ? `rgba(242,169,59,${0.25 + L.map[i] / 100 * 0.75})` : '#eceef2'; c.fillRect(48 + i * cw, H - 90, Math.max(1, cw - 1), 30); }
    c.fillStyle = '#8a8f9a'; c.font = FONT(500, 22); c.fillText('人生地図 1マス＝1年', 48, H - 100);
    return;
  }
  if (sc.type === 'outro') {
    c.globalAlpha = alpha; c.textAlign = 'center';
    c.fillStyle = '#1f2330'; c.font = FONT(700, 54); c.fillText(`${L.pref}に生まれて、`, W / 2, 360); c.fillText(`${L.age}歳まで生きた。`, W / 2, 430);
    c.font = FONT(500, 34); c.fillStyle = '#6b6f7a';
    const fam = []; if (L.partner) fam.push(`${L.sex === '男' ? '妻' : '夫'}・${L.partner.name}`); if (L.kids.length) fam.push(`子ども${L.kids.length}人`); if (L.grandkids.length) fam.push(`孫${L.grandkids.length}人`);
    const ls = [`${L.fullName}（${L.sex}）· ${L.job ? L.job.name : '―'}`, fam.length ? fam.join('・') : '独身', `${L.livePref}で${L.home} · 純資産 ${yen(L.money + L.inv + L.homeValue - L.loan - L.debt)}`, `${L.cause === '老衰' ? '老衰' : L.cause}で、この世を去った。`];
    ls.forEach((t, i) => c.fillText(t, W / 2, 520 + i * 54));
    const total = Math.max(60, L.map.length); const cols = 20; const cell = Math.min(28, (W - 96) / cols - 6); const gx = (W - (cols * (cell + 6))) / 2;
    L.map.forEach((hp, i) => { c.fillStyle = `rgba(242,169,59,${0.25 + hp / 100 * 0.75})`; c.fillRect(gx + (i % cols) * (cell + 6), 800 + Math.floor(i / cols) * (cell + 6), cell, cell); });
    c.fillStyle = '#1f2330'; c.font = FONT(500, 30); c.fillText(`同じ年に生まれた${L.sex}の${sc.pct}%より長く生きた`, W / 2, 1080);
    c.fillStyle = '#e8503a'; c.font = FONT(700, 34); c.fillText('あなたは、どこに生まれる？', W / 2, 1150);
    c.fillStyle = '#8a8f9a'; c.font = FONT(500, 26); c.fillText(opts.siteUrl ? opts.siteUrl.replace(/^https?:\/\//, '') : '#1億2千万分の1', W / 2, 1200);
    c.globalAlpha = 1; c.textAlign = 'left';
  }
}

/* ---------- BGM（オルゴール風、全部合成） ---------- */
function makeMusic(ctx, rand, total) {
  const master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
  const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.34; const fb = ctx.createGain(); fb.gain.value = 0.28; const wet = ctx.createGain(); wet.gain.value = 0.35;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
  const dry = ctx.createGain(); dry.connect(master); dry.connect(delay);
  const t0 = ctx.currentTime + 0.05;
  master.gain.setTargetAtTime(0.5, t0, 0.4);
  const bpm = 88, beat = 60 / bpm, eighth = beat / 2;
  const scale = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81]; // C major pentatonic
  const chords = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]]; // C Am F G
  const f = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let step = 0, idx = 4, tNext = t0, bars = 0;
  const endAt = t0 + total - 3.2;
  function note(m, t, dur, type, g, dest) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f(m); const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + 0.012); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(e); e.connect(dest); o.start(t); o.stop(t + dur + 0.05); }
  function schedule() {
    while (tNext < ctx.currentTime + 1.2 && tNext < endAt) {
      const bar = Math.floor(step / 8), chord = chords[Math.floor(bar / 2) % 4];
      if (step % 8 === 0) { note(chord[0], tNext, beat * 3.6, 'sine', 0.16, dry); chord.forEach(m => note(m + 12, tNext, beat * 3.8, 'triangle', 0.035, dry)); }
      if (rand() < 0.72) { idx += Math.round((rand() - 0.5) * 3); idx = Math.max(0, Math.min(scale.length - 1, idx)); note(scale[idx], tNext, 0.9, 'triangle', 0.13, dry); if (rand() < 0.3) note(scale[idx] + 12, tNext, 0.6, 'sine', 0.05, dry); }
      tNext += eighth; step++;
    }
  }
  const timer = setInterval(schedule, 200); schedule();
  // 終わりの和音
  setTimeout(() => { const t = ctx.currentTime; [48, 55, 60, 64, 67, 72].forEach((m, i) => note(m, t + i * 0.06, 3.0, i < 2 ? 'sine' : 'triangle', i < 2 ? 0.14 : 0.07, dry)); master.gain.setTargetAtTime(0.0001, t + 2.0, 0.5); }, Math.max(0, (total - 3.0) * 1000));
  return { master, stop() { clearInterval(timer); try { master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1); } catch (e) { } } };
}

/* ---------- 再生・録画 ---------- */
function play(L, canvas, opts = {}) {
  const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const { scenes, total } = buildScenes(L, opts.pct || 0);
  const rand = seedRnd(`${L.fullName}${L.pref}${L.age}`);
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const music = makeMusic(ctx, rand, total);
  let rec = null, chunks = [], stopped = false, raf = 0;
  let resolveDone; const done = new Promise(r => resolveDone = r);
  if (opts.record) {
    const stream = canvas.captureStream(30);
    const dest = ctx.createMediaStreamDestination(); music.master.connect(dest);
    dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 }); } catch (e) { rec = new MediaRecorder(stream); }
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    rec.onstop = () => { resolveDone(chunks.length ? new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' }) : null); try { ctx.close(); } catch (e) { } };
    rec.start(500);
  }
  const start = performance.now();
  function frame() {
    if (stopped) return;
    const t = (performance.now() - start) / 1000;
    if (t >= total) { finish(); return; }
    let sc = scenes[scenes.length - 1]; for (const s of scenes) { if (t >= s.t0 && t < s.t0 + s.dur) { sc = s; break; } }
    drawFrame(c, W, H, L, sc, t - sc.t0, opts);
    opts.onProgress && opts.onProgress(t / total);
    raf = requestAnimationFrame(frame);
  }
  function finish() {
    stopped = true; cancelAnimationFrame(raf); music.stop();
    if (rec) { setTimeout(() => { try { rec.stop(); } catch (e) { resolveDone(null); } }, 300); }
    else { setTimeout(() => { try { ctx.close(); } catch (e) { } resolveDone(null); }, 600); }
  }
  raf = requestAnimationFrame(frame);
  return { done, stop() { if (stopped) return; stopped = true; cancelAnimationFrame(raf); music.stop(); if (rec) { try { rec.ondataavailable = null; rec.stop(); } catch (e) { } } try { ctx.close(); } catch (e) { } resolveDone(null); } };
}
return { play, buildScenes };
})();
