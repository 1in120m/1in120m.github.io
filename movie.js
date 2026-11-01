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
  const MAX = 26;
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
  const scenes = [{ type: 'intro', dur: 3.2 }];
  for (const e of chosen) scenes.push({ type: 'event', dur: e.kind === 'death' ? 3.6 : 2.5, e });
  scenes.push({ type: 'outro', dur: 5.2, pct });
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


/* ---------- 絵（建物・人・風景） ---------- */
const SKIN = '#f6d3b5';
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function person(c, x, gy, o) {
  // o: {age:'baby'|'child'|'teen'|'adult'|'elder', sex:'男'|'女', shirt, t, bow, cane, flip}
  const H = { baby: 46, child: 95, teen: 135, adult: 170, elder: 150 }[o.age || 'adult'];
  const bob = Math.sin((o.t || 0) * 3 + x) * 2;
  const y0 = gy - H + bob;
  const hr = H * 0.15, bw = H * 0.3, bh = H * 0.36, legH = H * 0.3;
  c.save(); c.translate(x, 0); if (o.flip) { c.scale(-1, 1); }
  c.lineCap = 'round'; c.lineWidth = Math.max(3, H * 0.05);
  // 脚
  c.strokeStyle = o.age === 'elder' ? '#6b6f7a' : '#3b4252'; c.beginPath(); c.moveTo(-bw * 0.25, y0 + hr * 2 + bh); c.lineTo(-bw * 0.3, gy + bob); c.moveTo(bw * 0.25, y0 + hr * 2 + bh); c.lineTo(bw * 0.3, gy + bob); c.stroke();
  // 体
  c.fillStyle = o.shirt || '#4a7bd0'; rr(c, -bw / 2, y0 + hr * 2 - 2, bw, bh, bw * 0.3); c.fill();
  if (o.sex === '女' && o.age !== 'baby') { c.beginPath(); c.moveTo(-bw / 2, y0 + hr * 2 + bh * 0.6); c.lineTo(-bw * 0.7, y0 + hr * 2 + bh + 4); c.lineTo(bw * 0.7, y0 + hr * 2 + bh + 4); c.lineTo(bw / 2, y0 + hr * 2 + bh * 0.6); c.closePath(); c.fill(); }
  // 腕
  c.strokeStyle = SKIN; c.beginPath();
  const ay = y0 + hr * 2 + bh * 0.15;
  if (o.pose === 'up') { c.moveTo(-bw / 2, ay); c.lineTo(-bw * 0.9, ay - bh * 0.6); c.moveTo(bw / 2, ay); c.lineTo(bw * 0.9, ay - bh * 0.6); }
  else if (o.pose === 'hold') { c.moveTo(-bw / 2, ay); c.lineTo(0, ay + bh * 0.45); c.moveTo(bw / 2, ay); c.lineTo(0, ay + bh * 0.45); }
  else if (o.pose === 'bow') { c.moveTo(-bw / 2, ay); c.lineTo(-bw * 0.4, ay + bh * 0.5); c.moveTo(bw / 2, ay); c.lineTo(bw * 0.4, ay + bh * 0.5); }
  else { c.moveTo(-bw / 2, ay); c.lineTo(-bw * 0.75, ay + bh * 0.55); c.moveTo(bw / 2, ay); c.lineTo(bw * 0.75, ay + bh * 0.55); }
  c.stroke();
  // 頭
  const hy = o.pose === 'bow' ? y0 + hr + 10 : y0 + hr;
  c.fillStyle = SKIN; c.beginPath(); c.arc(0, hy, hr, 0, Math.PI * 2); c.fill();
  // 髪
  c.fillStyle = o.age === 'elder' ? '#b8bcc6' : (o.hair || '#2b2b2b');
  c.beginPath(); c.arc(0, hy - hr * 0.1, hr * 1.02, Math.PI, 0); c.fill();
  if (o.sex === '女' && o.age !== 'baby') { c.fillRect(-hr * 1.02, hy - hr * 0.1, hr * 0.32, hr * 1.3); c.fillRect(hr * 0.7, hy - hr * 0.1, hr * 0.32, hr * 1.3); }
  // 顔
  c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(-hr * 0.35, hy + hr * 0.1, hr * 0.08, 0, 7); c.arc(hr * 0.35, hy + hr * 0.1, hr * 0.08, 0, 7); c.fill();
  c.strokeStyle = '#2b2b2b'; c.lineWidth = 2; c.beginPath(); if (o.sad) c.arc(0, hy + hr * 0.7, hr * 0.3, Math.PI * 1.15, Math.PI * 1.85); else c.arc(0, hy + hr * 0.35, hr * 0.3, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  if (o.tie) { c.fillStyle = '#c0392b'; c.fillRect(-3, y0 + hr * 2, 6, bh * 0.5); }
  if (o.cane) { c.strokeStyle = '#8b5a2b'; c.lineWidth = 4; c.beginPath(); c.moveTo(bw * 0.9, ay + bh * 0.5); c.lineTo(bw * 0.95, gy + bob); c.stroke(); }
  if (o.bag) { c.fillStyle = '#c0392b'; rr(c, bw * 0.45, y0 + hr * 2 + 4, bw * 0.5, bh * 0.7, 6); c.fill(); }
  c.restore();
}
function baby(c, x, y, t) { const bob = Math.sin(t * 3) * 2; c.fillStyle = '#ffffff'; rr(c, x - 22, y - 14 + bob, 44, 28, 12); c.fill(); c.strokeStyle = '#d9a2ae'; c.lineWidth = 2; c.stroke(); c.fillStyle = SKIN; c.beginPath(); c.arc(x - 14, y + bob, 11, 0, 7); c.fill(); c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(x - 18, y - 2 + bob, 1.6, 0, 7); c.arc(x - 10, y - 2 + bob, 1.6, 0, 7); c.fill(); }
function pet(c, x, gy, kind, t) { const bob = Math.sin(t * 4) * 1.5; c.fillStyle = kind === '猫' ? '#8c8c8c' : '#c9a066'; rr(c, x - 22, gy - 26 + bob, 44, 22, 10); c.fill(); c.beginPath(); c.arc(x + 22, gy - 28 + bob, 12, 0, 7); c.fill(); c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(x + 26, gy - 30 + bob, 1.5, 0, 7); c.fill(); if (kind === '猫') { c.fillStyle = '#8c8c8c'; c.beginPath(); c.moveTo(x + 14, gy - 36 + bob); c.lineTo(x + 18, gy - 48 + bob); c.lineTo(x + 24, gy - 36 + bob); c.fill(); } }
function tree(c, x, gy, s = 1) { c.fillStyle = '#8b5a2b'; c.fillRect(x - 6 * s, gy - 60 * s, 12 * s, 60 * s); c.fillStyle = '#6ab04c'; c.beginPath(); c.arc(x, gy - 80 * s, 34 * s, 0, 7); c.arc(x - 24 * s, gy - 60 * s, 26 * s, 0, 7); c.arc(x + 24 * s, gy - 60 * s, 26 * s, 0, 7); c.fill(); }
function cloud(c, x, y, s = 1) { c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(x, y, 22 * s, 0, 7); c.arc(x + 26 * s, y - 8 * s, 28 * s, 0, 7); c.arc(x + 56 * s, y, 22 * s, 0, 7); c.fill(); c.fillRect(x, y, 56 * s, 22 * s); }
function windowGrid(c, x, y, w, h, cols, rows, col = '#dbe7f6') { const cw = w / cols, ch = h / rows; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { c.fillStyle = col; c.fillRect(x + i * cw + cw * 0.22, y + j * ch + ch * 0.22, cw * 0.56, ch * 0.56); } }
function building(c, kind, x, gy, t) {
  switch (kind) {
    case 'home': case 'house': { c.fillStyle = '#f3e6d0'; c.fillRect(x - 90, gy - 130, 180, 130); c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(x - 105, gy - 130); c.lineTo(x, gy - 210); c.lineTo(x + 105, gy - 130); c.closePath(); c.fill(); c.fillStyle = '#8b5a2b'; c.fillRect(x - 20, gy - 70, 40, 70); windowGrid(c, x - 85, gy - 115, 60, 45, 1, 1); windowGrid(c, x + 25, gy - 115, 60, 45, 1, 1); break; }
    case 'school': { c.fillStyle = '#f6efe2'; c.fillRect(x - 220, gy - 150, 440, 150); windowGrid(c, x - 210, gy - 140, 420, 100, 7, 2); c.fillStyle = '#8b5a2b'; c.fillRect(x - 24, gy - 60, 48, 60); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, gy - 175, 22, 0, 7); c.fill(); c.strokeStyle = '#2b2b2b'; c.lineWidth = 2; c.beginPath(); c.arc(x, gy - 175, 22, 0, 7); c.moveTo(x, gy - 175); c.lineTo(x, gy - 188); c.moveTo(x, gy - 175); c.lineTo(x + 9, gy - 175); c.stroke(); c.fillStyle = '#6b6f7a'; c.fillRect(x + 180, gy - 230, 4, 80); c.fillStyle = '#c0392b'; c.fillRect(x + 184, gy - 228, 30, 18); break; }
    case 'office': { c.fillStyle = '#cfd8e3'; c.fillRect(x - 110, gy - 300, 220, 300); windowGrid(c, x - 100, gy - 290, 200, 250, 4, 7, '#eaf2fb'); c.fillStyle = '#8fa3b8'; c.fillRect(x - 30, gy - 50, 60, 50); c.fillStyle = '#a9b7c6'; c.fillRect(x + 130, gy - 200, 120, 200); windowGrid(c, x + 138, gy - 190, 104, 160, 2, 5, '#eaf2fb'); break; }
    case 'bank': { c.fillStyle = '#e9e4d6'; c.fillRect(x - 150, gy - 180, 300, 180); c.fillStyle = '#d4cdb8'; for (let i = 0; i < 5; i++) c.fillRect(x - 130 + i * 60, gy - 160, 20, 160); c.fillStyle = '#b8ad90'; c.beginPath(); c.moveTo(x - 165, gy - 180); c.lineTo(x, gy - 230); c.lineTo(x + 165, gy - 180); c.closePath(); c.fill(); c.fillStyle = '#2b2b2b'; c.font = FONT(700, 34); c.textAlign = 'center'; c.fillText('¥', x, gy - 192); c.textAlign = 'left'; break; }
    case 'hospital': { c.fillStyle = '#f7f7f7'; c.fillRect(x - 160, gy - 200, 320, 200); windowGrid(c, x - 150, gy - 190, 300, 130, 5, 3); c.fillStyle = '#8fa3b8'; c.fillRect(x - 30, gy - 55, 60, 55); c.fillStyle = '#e8503a'; c.fillRect(x - 10, gy - 245, 20, 50); c.fillRect(x - 25, gy - 230, 50, 20); break; }
    case 'factory': { c.fillStyle = '#d9d2c5'; c.fillRect(x - 200, gy - 140, 400, 140); c.fillStyle = '#8c8276'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x - 200 + i * 100, gy - 140); c.lineTo(x - 200 + i * 100, gy - 200); c.lineTo(x - 100 + i * 100, gy - 140); c.closePath(); c.fill(); } c.fillStyle = '#6b6f7a'; c.fillRect(x + 120, gy - 260, 28, 120); c.fillRect(x + 160, gy - 240, 28, 100); c.fillStyle = 'rgba(200,200,200,.6)'; c.beginPath(); c.arc(x + 134 + Math.sin(t) * 6, gy - 285 - (t * 10 % 40), 14, 0, 7); c.fill(); windowGrid(c, x - 190, gy - 120, 300, 60, 5, 1); break; }
    case 'shop': { c.fillStyle = '#fbf3e4'; c.fillRect(x - 120, gy - 140, 240, 140); c.fillStyle = '#e8503a'; for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#fff' : '#e8503a'; c.fillRect(x - 130 + i * 44, gy - 150, 44, 26); } windowGrid(c, x - 100, gy - 110, 120, 70, 1, 1); c.fillStyle = '#8b5a2b'; c.fillRect(x + 40, gy - 90, 50, 90); break; }
    case 'chapel': { c.fillStyle = '#fffaf0'; c.fillRect(x - 90, gy - 150, 180, 150); c.fillStyle = '#e4d9c4'; c.beginPath(); c.moveTo(x - 100, gy - 150); c.lineTo(x, gy - 230); c.lineTo(x + 100, gy - 150); c.closePath(); c.fill(); c.fillStyle = '#c8a97e'; c.fillRect(x - 4, gy - 275, 8, 40); c.fillRect(x - 14, gy - 265, 28, 8); c.fillStyle = '#8b5a2b'; c.beginPath(); c.arc(x, gy - 60, 26, Math.PI, 0); c.fill(); c.fillRect(x - 26, gy - 60, 52, 60); break; }
    case 'grave': { c.fillStyle = '#9aa0ad'; c.fillRect(x - 60, gy - 20, 120, 20); c.fillRect(x - 40, gy - 40, 80, 20); c.fillStyle = '#7a8090'; rr(c, x - 24, gy - 150, 48, 112, 6); c.fill(); c.fillStyle = '#6ab04c'; c.beginPath(); c.arc(x - 50, gy - 45, 10, 0, 7); c.arc(x + 50, gy - 45, 10, 0, 7); c.fill(); break; }
    case 'station': { c.fillStyle = '#dfe6ee'; c.fillRect(x - 200, gy - 120, 400, 120); c.fillStyle = '#3b4252'; c.fillRect(x - 210, gy - 135, 420, 15); c.fillStyle = '#4a7bd0'; rr(c, x - 150, gy - 100, 300, 70, 14); c.fill(); windowGrid(c, x - 140, gy - 92, 280, 36, 5, 1, '#eaf2fb'); c.fillStyle = '#2b2b2b'; [-110, -40, 40, 110].forEach(d => { c.beginPath(); c.arc(x + d, gy - 22, 12, 0, 7); c.fill(); }); break; }
    case 'bench': { c.fillStyle = '#8b5a2b'; c.fillRect(x - 70, gy - 48, 140, 10); c.fillRect(x - 70, gy - 70, 140, 8); c.fillRect(x - 60, gy - 48, 8, 48); c.fillRect(x + 52, gy - 48, 8, 48); break; }
  }
}
function scenery(c, kind, x0, y0, w, h, gy, t, sky) {
  // 空
  const g = c.createLinearGradient(0, y0, 0, gy);
  if (sky === 'sunset') { g.addColorStop(0, '#f8c8a0'); g.addColorStop(1, '#fdf0e2'); } else if (sky === 'night') { g.addColorStop(0, '#2d3457'); g.addColorStop(1, '#5a6a9a'); } else if (sky === 'rain') { g.addColorStop(0, '#8e99a8'); g.addColorStop(1, '#c6cdd6'); } else { g.addColorStop(0, '#cfe6fb'); g.addColorStop(1, '#eef7ff'); }
  c.fillStyle = g; c.fillRect(x0, y0, w, gy - y0);
  if (sky === 'day') { c.fillStyle = '#ffd56b'; c.beginPath(); c.arc(x0 + w - 90, y0 + 70, 34, 0, 7); c.fill(); cloud(c, x0 + 60 + (t * 12) % 140, y0 + 60, 0.9); cloud(c, x0 + 380 + (t * 8) % 120, y0 + 110, 0.7); }
  if (sky === 'sunset') { c.fillStyle = '#ff9f5a'; c.beginPath(); c.arc(x0 + w / 2, gy - 10, 60, Math.PI, 0); c.fill(); }
  if (sky === 'night') { c.fillStyle = '#fff6c9'; c.beginPath(); c.arc(x0 + w - 90, y0 + 70, 26, 0, 7); c.fill(); for (let i = 0; i < 20; i++) { c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(x0 + (i * 97) % w, y0 + (i * 53) % (gy - y0 - 60), 2, 2); } }
  // 遠景
  if (kind === 'mountain' || kind === 'field') { c.fillStyle = kind === 'mountain' ? '#9fb7d8' : '#b9d6a8'; c.beginPath(); c.moveTo(x0, gy); c.lineTo(x0 + 120, gy - 150); c.lineTo(x0 + 260, gy - 40); c.lineTo(x0 + 400, gy - 190); c.lineTo(x0 + 560, gy - 60); c.lineTo(x0 + w, gy - 120); c.lineTo(x0 + w, gy); c.closePath(); c.fill(); if (kind === 'mountain') { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x0 + 400, gy - 190); c.lineTo(x0 + 372, gy - 150); c.lineTo(x0 + 428, gy - 150); c.closePath(); c.fill(); } }
  if (kind === 'sea') { c.fillStyle = '#5fa8d3'; c.fillRect(x0, gy - 90, w, 90); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; for (let i = 0; i < 6; i++) { c.beginPath(); const yy = gy - 75 + i * 14; c.moveTo(x0 + ((i * 70 + t * 30) % 120), yy); c.lineTo(x0 + ((i * 70 + t * 30) % 120) + 30, yy); c.stroke(); } }
  if (kind === 'city') { c.fillStyle = '#b9c4d2'; [[0, 120, 90], [140, 60, 170], [230, 100, 120], [360, 70, 210], [460, 120, 100], [610, 90, 150]].forEach(([dx, bw, bh]) => { c.fillRect(x0 + dx, gy - bh, bw, bh); }); }
  // 地面
  c.fillStyle = kind === 'city' || kind === 'station' ? '#d9dde3' : kind === 'sea' ? '#f1e3c2' : '#cfe5bf'; c.fillRect(x0, gy, w, y0 + h - gy);
  if (kind === 'city' || kind === 'station') { c.fillStyle = '#fff'; for (let i = 0; i < 8; i++) c.fillRect(x0 + i * 100 + (t * 20 % 100), gy + 40, 50, 6); }
  if (sky === 'rain') { c.strokeStyle = 'rgba(80,100,130,.5)'; c.lineWidth = 2; for (let i = 0; i < 40; i++) { const rx = x0 + (i * 53 + t * 300) % w, ry = y0 + (i * 71 + t * 500) % (y0 + h - y0); c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx - 6, ry + 18); c.stroke(); } }
  if (sky === 'snow') { c.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(x0 + (i * 53 + Math.sin(t + i) * 10) % w, y0 + (i * 71 + t * 60) % h, 3, 0, 7); c.fill(); } c.fillStyle = '#fff'; c.fillRect(x0, gy, w, y0 + h - gy); }
}
function hearts(c, x, y, t, broken) { for (let i = 0; i < 3; i++) { const hy = y - ((t * 40 + i * 30) % 90), hx = x + Math.sin(t * 2 + i) * 10 + i * 18 - 18; c.fillStyle = broken ? '#9aa0ad' : '#ff6b8a'; c.beginPath(); c.arc(hx - 5, hy, 6, 0, 7); c.arc(hx + 5, hy, 6, 0, 7); c.moveTo(hx - 11, hy + 2); c.lineTo(hx, hy + 14); c.lineTo(hx + 11, hy + 2); c.fill(); } }
function coins(c, x, y, t) { for (let i = 0; i < 4; i++) { c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(x + i * 22, y - ((t * 50 + i * 25) % 70), 9, 0, 7); c.fill(); c.strokeStyle = '#c99a2e'; c.lineWidth = 2; c.stroke(); } }
function birds(c, x, y, t) { c.strokeStyle = '#555'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const bx = x + i * 40 + (t * 20 % 60), by = y + Math.sin(t * 3 + i) * 6 - i * 14; c.beginPath(); c.moveTo(bx - 10, by); c.quadraticCurveTo(bx - 5, by - 6, bx, by); c.quadraticCurveTo(bx + 5, by - 6, bx + 10, by); c.stroke(); } }

const ageKind = (age) => age < 2 ? 'baby' : age < 12 ? 'child' : age < 20 ? 'teen' : age < 66 ? 'adult' : 'elder';
function sceneSpec(e, L) {
  const tx = e.text, a = e.age, me = (o = {}) => ({ age: ageKind(a), sex: L.sex, shirt: L.sex === '男' ? '#4a7bd0' : '#e07a9a', ...o });
  const other = (o = {}) => ({ age: 'adult', sex: L.sex === '男' ? '女' : '男', shirt: L.sex === '男' ? '#e07a9a' : '#4a7bd0', ...o });
  const parents = [{ age: 'adult', sex: '女', shirt: '#e07a9a', pose: 'hold' }, { age: 'adult', sex: '男', shirt: '#4a7bd0' }];
  const jobPlace = () => { const f = L.job?.field; return f === '製造' ? 'factory' : f === '農林水産' ? 'field' : ['小売', '飲食', 'サービス'].includes(f) ? 'shop' : f === '医療福祉' ? 'hospital' : f === '建設' ? 'city' : f === '教育' ? 'school' : f === '運輸' ? 'station' : 'office'; };
  const S = (place, people, props = {}, sky = 'day', ground = 'plain') => ({ place, people, props, sky, ground });
  if (e.kind === 'death') return S('none', [], { birds: true, tree: true }, 'sunset', 'mountain');
  if (a === 0) return S('hospital', [parents[0], { ...parents[1], flip: true }], { baby: true });
  if (/亡くなった/.test(tx)) return S('grave', [me({ pose: 'bow', sad: true })], {}, 'sunset');
  if (/地震|津波/.test(tx)) return S('house', [me({ pose: 'up', sad: true })], { quake: true }, 'rain');
  if (/台風|雨/.test(tx)) return S('house', [me({ sad: true })], {}, 'rain');
  if (/大雪|雪/.test(tx)) return S('house', [me()], {}, 'snow');
  if (/結婚した|結婚式|式はせず|チャペル|神社で/.test(tx)) return S('chapel', [me({ pose: 'up' }), other({ pose: 'up', flip: true })], { hearts: true });
  if (/プロポーズ|付き合い|告白|恋人|OKだった/.test(tx)) return S(a < 19 ? 'school' : 'park', [me(), other({ age: ageKind(a), flip: true })], { hearts: true });
  if (/振られ|別れた|離婚|疎遠/.test(tx)) return S('park', [me({ sad: true }), other({ age: ageKind(a), flip: true, sad: true })], { hearts: 'broken' }, 'rain');
  if (/第.子|生まれた。.*グラム|名前は.*にした/.test(tx)) return S('house', [me({ pose: 'hold' }), other({ flip: true })], { baby: true });
  if (/(弟|妹)の.*が生まれた/.test(tx)) return S('house', [me(), parents[0], { ...parents[1], flip: true }], { baby: true, babyAt: 1 });
  if (/孫/.test(tx)) return S('park', [me({ cane: a >= 75 }), { age: 'child', sex: '男', shirt: '#f2a93b', flip: true }], { tree: true });
  if (/小学校に入学|中学校に入学|高校.*入った|大学に合格|専門学校に入った|予備校|卒業|受験|塾|先生|授業|学び始め|学び直し|資格/.test(tx)) return S('school', [me({ bag: a < 19 })]);
  if (/部活|部に入った|大会|運動会|リレー/.test(tx)) return S('none', [me({ pose: 'up' }), { age: ageKind(a), sex: '男', shirt: '#f2a93b', flip: true, pose: 'up' }], { ball: true }, 'day', 'field');
  if (/家を買|マンション|一戸建て|ローン|リフォーム|引っ越|一人暮らし|実家|同居|住み替|越した/.test(tx)) return S('house', [me(), ...(L.partner?.alive && a >= L.partner.since ? [other({ flip: true })] : [])], { key: true });
  if (/入院|手術|がん|倒れ|骨折|診断|検診|人間ドック|病気|うつ|腰|手術|薬|認知症|介護|施設|ヘルパー|せき/.test(tx)) return S('hospital', [me({ sad: true, cane: a >= 70 })]);
  if (/旅行|留学|温泉|新婚旅行|海外|バックパック/.test(tx)) return S('none', [me({ pose: 'up' })], { bag: true }, 'day', /海|沖縄|ハワイ/.test(tx) ? 'sea' : 'mountain');
  if (/工場|機械/.test(tx)) return S('factory', [me({ shirt: '#5b6b8c' })]);
  if (/NISA|投資|株|貯金|家計|詐欺|宝くじ|遺産|退職金|純資産|副業|年金|ローン/.test(tx)) return S('bank', [me({ cane: a >= 75 })], { coins: true });
  if (/ペット|犬|猫|ハムスター/.test(tx)) return S('house', [me()], { pet: L.pet?.kind || (/猫/.test(tx) ? '猫' : '犬') });
  if (/転職|就職|正社員|年収|昇進|主任|課長|部長|工場長|店長|退職|定年|会社|仕事|上司|残業|表彰|後輩|独立|経営|フリーランス|嘱託|シルバー/.test(tx)) return S(jobPlace(), [me({ tie: L.sex === '男' && L.job?.field !== '製造', shirt: L.job?.field === '製造' ? '#5b6b8c' : undefined })]);
  if (/成人式|はたち/.test(tx)) return S('city', [me({ pose: 'up' }), { age: 'teen', sex: L.sex, shirt: '#f2a93b', flip: true }], {}, 'day', 'city');
  if (/散歩|集まり|町内|ボランティア|畑|趣味|サウナ|釣り|登山|キャンプ|米寿|100歳|遺言|免許|バス/.test(tx)) return S('bench', [me({ cane: a >= 75 })], { tree: true });
  if (/友達|仲良く|かばう|泊まった|バイト|スマホ|本を読む|習い/.test(tx)) return S(a < 13 ? 'park' : a < 19 ? 'school' : 'city', [me({ bag: a < 19 }), ...(L.friend ? [{ age: ageKind(a), sex: L.friend.sex, shirt: '#f2a93b', flip: true }] : [])], { tree: a < 13 });
  if (a < 6) return S('house', [parents[0], { ...parents[1], flip: true }], { baby: a < 2 });
  if (a < 19) return S('school', [me({ bag: true })]);
  if (a < 66) return S('none', [me()], {}, 'day', 'city');
  return S('bench', [me({ cane: a >= 78 })], { tree: true }, 'sunset');
}
function drawScene(c, L, spec, t, x0, y0, w, h) {
  const gy = y0 + h - 70;
  c.save(); c.beginPath(); rr(c, x0, y0, w, h, 24); c.clip();
  const ground = spec.ground === 'plain' ? (['city', 'station', 'office', 'bank'].includes(spec.place) ? 'city' : 'plain') : spec.ground;
  scenery(c, ground, x0, y0, w, h, gy, t, spec.sky);
  if (spec.props.tree) { tree(c, x0 + 90, gy, 1.1); tree(c, x0 + w - 80, gy, 0.8); }
  const bx = x0 + w / 2 + (['house', 'home', 'chapel', 'grave', 'bench'].includes(spec.place) ? 110 : 0);
  if (spec.place !== 'none' && spec.place !== 'park' && spec.place !== 'city') { c.save(); if (spec.props.quake) c.translate(Math.sin(t * 30) * 4, 0); building(c, spec.place, bx, gy, t); c.restore(); }
  if (spec.place === 'park') { tree(c, x0 + 120, gy, 1.2); tree(c, x0 + w - 110, gy, 1); }
  const n = spec.people.length; const px0 = spec.place === 'none' || spec.place === 'park' ? x0 + w / 2 : x0 + 170;
  spec.people.forEach((p, i) => person(c, px0 + (i - (n - 1) / 2) * 110, gy, { ...p, t }));
  if (spec.props.baby) { const bi = spec.props.babyAt != null ? spec.props.babyAt : 0; baby(c, px0 + (bi - (n - 1) / 2) * 110, gy - 118, t); }
  if (spec.props.pet) pet(c, px0 + 90, gy, spec.props.pet, t);
  if (spec.props.hearts) hearts(c, px0, gy - 200, t, spec.props.hearts === 'broken');
  if (spec.props.coins) coins(c, px0 + 60, gy - 150, t);
  if (spec.props.birds) birds(c, x0 + 420, y0 + 120, t);
  if (spec.props.ball) { c.fillStyle = '#fff'; c.beginPath(); c.arc(px0 + Math.sin(t * 4) * 50, gy - 40 - Math.abs(Math.sin(t * 4)) * 60, 12, 0, 7); c.fill(); c.strokeStyle = '#2b2b2b'; c.lineWidth = 2; c.stroke(); }
  if (spec.props.bag) { c.fillStyle = '#8b5a2b'; rr(c, px0 + 40, gy - 60, 36, 50, 6); c.fill(); }
  c.restore();
}

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
    c.fillText(`${L.birthYear}年`, W / 2, 380);
    c.font = FONT(700, 112); c.fillText(L.pref, W / 2, 520);
    c.font = FONT(500, 44); c.fillText('に、ひとりの子が生まれた。', W / 2, 600);
    c.font = FONT(500, 40); c.fillStyle = '#6b6f7a'; c.fillText(`${L.fullName}（${L.sex}）`, W / 2, 700);
    if (!sc.spec) sc.spec = sceneSpec({ text: '', age: 0, kind: 'milestone' }, L);
    drawScene(c, L, sc.spec, local, 48, 820, W - 96, 360);
    c.globalAlpha = 1; return;
  }
  if (sc.type === 'event') {
    const e = sc.e; const h = histAt(L, e.age);
    const col = COLORS[e.kind] || COLORS.info;
    c.globalAlpha = alpha;
    // 年齢
    c.fillStyle = col; c.fillRect(48, 104, 10, 110);
    c.fillStyle = '#1f2330'; c.font = FONT(700, 104); c.fillText(`${e.age}`, 76, 200);
    c.font = FONT(500, 34); c.fillText('歳', 76 + c.measureText(`${e.age}`).width * 3.05 + 12, 200);
    c.fillStyle = '#8a8f9a'; c.font = FONT(500, 28); c.fillText(`${L.birthYear + e.age}年`, 80 + 0, 240);
    // 絵
    if (!sc.spec) sc.spec = sceneSpec(e, L);
    drawScene(c, L, sc.spec, local + sc.t0, 48, 270, W - 96, 400);
    // 本文
    c.fillStyle = '#1f2330'; c.font = FONT(e.kind === 'milestone' || e.kind === 'death' ? 700 : 500, 40);
    const lines = wrap(c, e.text, W - 96);
    const y0 = 740; const slide = (1 - easeOut(Math.min(1, local / 0.4))) * 20;
    lines.slice(0, 5).forEach((ln, i) => c.fillText(ln, 48, y0 + i * 58 + slide));
    // 状態
    const sy = 1030;
    [['健康', 'health'], ['幸せ', 'happy'], ['学び', 'learn'], ['つながり', 'bond']].forEach(([lab, k], i) => {
      const y = sy + i * 34; c.fillStyle = '#6b6f7a'; c.font = FONT(500, 22); c.fillText(lab, 48, y + 18);
      c.fillStyle = '#eceef2'; c.fillRect(160, y + 2, W - 160 - 48, 14); c.fillStyle = STAT[k]; c.fillRect(160, y + 2, (W - 160 - 48) * (h.s[k] / 100), 14);
    });
    c.fillStyle = '#1f2330'; c.font = FONT(600, 26); c.fillText(`純資産 ${yen(h.net || 0)}`, 48, sy + 4 * 34 + 22);
    c.globalAlpha = 1;
    // 人生の帯（下）
    const total = Math.max(60, L.map.length); const cw = (W - 96) / total;
    for (let i = 0; i < L.map.length; i++) { const on = i <= e.age; c.fillStyle = on ? `rgba(242,169,59,${0.25 + L.map[i] / 100 * 0.75})` : '#eceef2'; c.fillRect(48 + i * cw, H - 60, Math.max(1, cw - 1), 24); }
    return;
  }
  if (sc.type === 'outro') {
    c.globalAlpha = alpha; c.textAlign = 'center';
    c.fillStyle = '#1f2330'; c.font = FONT(700, 54); c.fillText(`${L.pref}に生まれて、`, W / 2, 360); c.fillText(`${L.age}歳まで生きた。`, W / 2, 430);
    c.font = FONT(500, 34); c.fillStyle = '#6b6f7a';
    const fam = []; if (L.partner) fam.push(`${L.sex === '男' ? '妻' : '夫'}・${L.partner.name}`); if (L.kids.length) fam.push(`子ども${L.kids.length}人`); if (L.grandkids.length) fam.push(`孫${L.grandkids.length}人`);
    const tops = Object.entries(L.traits || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
    const ls = [`${L.fullName}（${L.sex}）· ${L.job ? L.job.name : '―'}`, fam.length ? fam.join('・') : '独身', `得意は${tops.join('と')}${L.likes?.length ? '、' + L.likes.slice(0, 3).join('・') + 'が好き' : ''}`, `${L.livePref}で${L.home} · 純資産 ${yen(L.money + L.inv + L.homeValue - L.loan - L.debt)}`, `${L.cause === '老衰' ? '老衰' : L.cause}で、この世を去った。`];
    ls.forEach((t, i) => c.fillText(t, W / 2, 500 + i * 50));
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
