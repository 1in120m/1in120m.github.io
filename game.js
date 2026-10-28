/* 1億2千万分の1 ― 日本版 人生シミュレーション 本体 */
'use strict';
(() => {
const D = JINSEI_DATA;
const CFG = window.JINSEI_CONFIG || {};
const $ = (s) => document.querySelector(s);

/* ---------- 乱数 ---------- */
const rnd = Math.random;
const chance = (p) => rnd() < p;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const irnd = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
function weighted(obj) { // {key: weight} または [[key,w],...]
  const ents = Array.isArray(obj) ? obj : Object.entries(obj);
  const total = ents.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [k, w] of ents) { r -= w; if (r <= 0) return k; }
  return ents[ents.length - 1][0];
}
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

const NAMES = {
  男: ['蓮','陽翔','湊','蒼','樹','悠真','大和','陽太','朝陽','碧','結翔','颯','律','新','海翔','翔','大翔','陸','悠','健太'],
  女: ['陽葵','凛','結菜','芽依','葵','紬','莉子','結衣','杏','美月','咲良','澪','陽菜','楓','澄','結月','花','心春','詩','美咲'],
};

/* ---------- 都道府県 ---------- */
const PREFS = D.prefectures.map(p => ({ name: p[0], pop: p[1], birthW: p[2], income: p[3], univ: p[4], urban: p[5], region: p[6], hazards: p[7], spots: [p[8], p[9]] }));
const prefByName = (n) => PREFS.find(p => p.name === n);
const birthsIn = (p) => Math.round(D.birthsPerYear * (p.pop * p.birthW) / PREFS.reduce((s, q) => s + q.pop * q.birthW, 0) / 100) * 100;

/* ---------- 死亡率 ---------- */
function qx(age, sex) {
  let q = D.mortalityMale.find(([mx]) => age <= mx)[1];
  if (sex === '女') q *= D.femaleMortalityFactor;
  return q;
}
function survivalTo(age, sex) { let s = 1; for (let a = 0; a < age; a++) s *= (1 - qx(a, sex)); return s; }

/* ---------- 職業 ---------- */
const JOBS = D.jobs.map(j => ({ name: j[0], field: j[1], regular: j[2], salary: j[3], health: j[4], happy: j[5], needs: j[6], where: j[7] }));
const jobByName = (n) => JOBS.find(j => j.name === n);
function eduRank(edu) { return { '中卒': 0, '高卒': 1, '専門卒': 2, '短大卒': 2, '大卒': 3, '大学院卒': 4 }[edu] || 0; }
function jobAllowed(j, L) {
  const r = eduRank(L.edu);
  if (j.needs === '大' && r < 3) return false;
  if (j.needs === '専' && r < 2) return false;
  if (j.name === '医師' && !(r >= 3 && L.s.learn >= 85)) return false;
  if (j.name === '薬剤師' && !(r >= 3 && L.s.learn >= 75)) return false;
  if (j.name === '研究者' && !(r >= 4)) return false;
  if (j.name === '会社の経営者') return false; // 独立イベントからだけ
  return true;
}
const COMMON = { '一般事務': 2.2, '営業': 2.0, 'スーパーの店員': 1.8, '介護職': 2.0, '看護師': 1.6, '町工場の技術者': 1.4, '食品工場の作業員': 1.3, '飲食店のスタッフ': 1.6, '建設の現場作業員': 1.3, 'トラック運転手': 1.2, '市役所の職員': 1.2, '電気工事士': 0.6, '消防士': 0.35, '警察官': 0.6, '自衛官': 0.45, '美容師': 0.7, '鉄道会社の職員': 0.5, '研究者': 0.5, '医師': 0.6, '薬剤師': 0.6, '動画クリエイター': 0.5, '観光ガイド': 0.6, '漁師': 0.6, 'Webデザイナー': 0.7 };
function jobOptions(L, n = 3, sameField = null) {
  const pref = prefByName(L.livePref);
  const pool = JOBS.filter(j => jobAllowed(j, L));
  const weights = pool.map(j => {
    let w = 10 * (COMMON[j.name] || 1);
    if (j.where === 1) w *= pref.urban < 0.5 ? 1.8 : 0.5;
    if (j.where === 2) w *= pref.urban >= 0.6 ? 1.8 : 0.5;
    if ((D.regionalJobs[L.livePref] || []).includes(j.name)) w *= 3;
    if (sameField && j.field === sameField) w *= 6;
    if (j.needs && eduRank(L.edu) >= 2) w *= 1.3; // 学歴を活かす
    if (!j.needs && eduRank(L.edu) >= 3) w *= 0.6;
    if (L.sex === '女' && ['看護師', '保育士', '介護職', '一般事務', '美容師', 'アパレルの販売員', '薬剤師'].includes(j.name)) w *= 2;
    if (L.sex === '男' && ['建設の現場作業員', '大工', 'トラック運転手', '自動車工場の作業員', '町工場の技術者', '電気工事士', '警察官', '消防士', '自衛官'].includes(j.name)) w *= 2;
    return [j.name, w];
  });
  const out = [];
  while (out.length < n && weights.length) {
    const k = weighted(weights);
    out.push(jobByName(k));
    const i = weights.findIndex(([name]) => name === k); weights.splice(i, 1);
  }
  return out;
}
function salaryOf(L) {
  if (!L.job || !L.working) return 0;
  const base = D.salaryCurve.find(([mx]) => L.age <= mx)[1];
  let s = base * L.job.salary * (D.eduSalaryFactor[L.edu] || 1) * prefByName(L.livePref).income;
  if (L.sex === '女') s *= D.femaleSalaryFactor;
  if (!L.regular) s *= D.nonRegularFactor / (L.sex === '女' ? D.femaleSalaryFactor : 1) * 0.9;
  if (L.flags.promoted) s *= 1.18;
  if (L.flags.rehired) s *= 0.6;
  return Math.round(s);
}

/* ---------- 人生の状態 ---------- */
function newLife(name, gentle) {
  const sex = chance(D.maleRatio) ? '男' : '女';
  const pref = weighted(PREFS.map(p => [p.name, p.pop * p.birthW]));
  const L = {
    name: name || pick(NAMES[sex]), sex, pref, livePref: pref, gentle,
    birthYear: D.year, age: 0, alive: true,
    s: { health: clamp(72 + gauss() * 10), happy: 60, learn: clamp(50 + gauss() * 12), bond: clamp(55 + gauss() * 10) },
    money: 0, debt: 0, loan: 0, loanYears: 0, incomeTotal: 0,
    family: { tier: weighted({ 低: 25, 中: 55, 高: 20 }), single: chance(0.10), siblings: weighted({ 0: 20, 1: 50, 2: 25, 3: 5 }) * 1 },
    parents: [],
    edu: '中卒', stage: '幼児', student: false,
    job: null, working: false, regular: false, retired: false,
    partner: null, kids: [], grandkids: 0, home: '実家',
    habits: { smoke: false, exercise: false },
    flags: {},
    log: [], map: [], cause: null, oneWord: '',
  };
  const fAge = Math.round(32 + gauss() * 5), mAge = Math.round(30 + gauss() * 5);
  L.parents.push({ role: '母', ageAtBirth: clamp(mAge, 18, 48), alive: true });
  if (!L.family.single) L.parents.push({ role: '父', ageAtBirth: clamp(fAge, 18, 55), alive: true });
  L.family.siblings = +L.family.siblings;
  L.family.older = Math.min(L.family.siblings, irnd(0, L.family.siblings));
  return L;
}

/* ---------- ログ ---------- */
let UI = {};
function say(L, text, kind = 'info') { L.log.push({ age: L.age, text, kind }); UI.onLog && UI.onLog(L.log[L.log.length - 1]); }
const add = (L, k, v) => { L.s[k] = clamp(L.s[k] + v); };

/* ---------- 決断 ---------- */
// options: [{t:'表示', d:'補足', w:重み, f:()=>{}}]
async function decide(L, q, options) {
  let chosen;
  if (UI.auto()) { chosen = options[+weighted(options.map((o, i) => [String(i), o.w || 1]))]; }
  else { chosen = await UI.ask(L, q, options); }
  say(L, `${q} → ${chosen.t}`, 'choice');
  await chosen.f?.();
  return chosen;
}

/* ---------- 年ごとの処理 ---------- */
const FIELD_OF = (L) => L.job ? L.job.field : null;

async function stepYear(L) {
  const a = L.age;
  const pref = prefByName(L.livePref);
  const urban = pref.urban;
  let had = L.log.length;

  /* --- 節目・学校 --- */
  if (a === 0) {
    const birthsHere = birthsIn(prefByName(L.pref));
    say(L, `${L.pref}で生まれた。${L.sex}の子。今年ここで生まれる赤ちゃんはおよそ${birthsHere.toLocaleString()}人。`, 'milestone');
    const fam = L.family.single ? '母と二人' : '父と母';
    const sib = L.family.older ? `、上に${L.family.older}人の${L.sex === '男' ? '兄か姉' : '兄か姉'}` : '';
    say(L, `家族は${fam}${sib}。暮らし向きは${{ 低: 'ゆとりがない', 中: 'ふつう', 高: 'ゆとりがある' }[L.family.tier]}。`);
    if (L.family.tier === '低') { add(L, 'learn', -4); }
    if (L.family.tier === '高') { add(L, 'learn', 5); }
  }
  if (a === 1) say(L, '歩きはじめた。');
  if (a === 2 && chance(0.7)) say(L, L.family.single ? '保育園に通いはじめた。母は朝から晩まで働いている。' : '保育園に通いはじめた。父も母も働いている。');
  if (a === 3 && chance(0.5)) say(L, `${pref.spots[0]}に連れて行ってもらった。覚えていない。`);
  if (a >= 2 && a <= 6 && L.family.siblings > L.family.older && chance(0.35)) {
    L.family.older++; say(L, `${pick(['弟', '妹'])}が生まれた。`, 'good'); add(L, 'bond', 3);
  }
  if (a === 6) { say(L, '小学校に入学した。', 'milestone'); L.student = true; L.stage = '小学生'; }
  if (a === 12) { say(L, '中学校に入学した。', 'milestone'); L.stage = '中学生'; }
  if (a === 13) {
    const club = weighted({ 運動部: 55, 文化部: 25, 帰宅部: 20 });
    L.flags.club = club;
    if (club === '運動部') { say(L, `${pick(['野球', 'サッカー', 'バスケ', 'バレー', '陸上', 'テニス', '卓球', '剣道'])}部に入った。`); add(L, 'health', 4); add(L, 'bond', 4); }
    else if (club === '文化部') { say(L, `${pick(['吹奏楽', '美術', '書道', '科学', '放送', '演劇'])}部に入った。`); add(L, 'learn', 3); add(L, 'bond', 3); }
    else { say(L, '部活には入らなかった。放課後はゲームと動画。'); add(L, 'learn', -1); }
  }
  if (a === 14 && chance(0.5)) { say(L, '初めて好きな人ができた。'); add(L, 'happy', 4); }
  if (a === 15) await decideHighSchool(L, pref);
  if (a === 18) await decideAfterHigh(L, pref);
  if (a === 20) {
    say(L, 'はたちになった。', 'milestone');
    if (chance(0.6)) await decide(L, '友達にタバコを勧められた。', [
      { t: '断る', w: L.sex === '男' ? 50 : 85, f: () => { } },
      { t: '吸ってみる', d: '習慣になるかもしれない', w: L.sex === '男' ? 45 : 15, f: () => { L.habits.smoke = true; say(L, 'タバコが習慣になった。', 'bad'); } },
    ]);
    if (L.edu === '専門卒' && L.stage === '専門学生') { L.stage = '社会人'; await decideJob(L); }
  }
  if (((a === 22 && !L.flags.roninDone) || (a === 23 && L.flags.roninDone)) && L.stage === '大学生') {
    if (L.s.learn >= 80 && chance(0.25)) { say(L, '大学院に進んだ。'); L.stage = '大学院生'; }
    else { say(L, '大学を卒業した。', 'milestone'); L.edu = '大卒'; L.stage = '社会人'; await decideJob(L); }
  }
  if (a === (L.flags.roninDone ? 25 : 24) && L.stage === '大学院生') { say(L, '大学院を修了した。', 'milestone'); L.edu = '大学院卒'; L.stage = '社会人'; await decideJob(L); }

  /* --- 子ども時代の出来事 --- */
  if (a >= 7 && a <= 11) {
    const r = rnd();
    if (r < 0.10) { say(L, '仲のいい友達ができた。', 'good'); add(L, 'bond', 5); add(L, 'happy', 4); }
    else if (r < 0.15) { say(L, '学校でいじめられた。誰にも言えなかった。', 'bad'); add(L, 'happy', -10); add(L, 'bond', -6); }
    else if (r < 0.22) { say(L, `${pick(['インフルエンザ', '肺炎', '骨折'])}で入院した。`); add(L, 'health', -3); }
    else if (r < 0.30 && L.family.tier !== '低') { say(L, `${pick(['ピアノ', 'スイミング', '習字', '英語', 'サッカー', '公文'])}を習いはじめた。`); add(L, 'learn', 4); }
    else if (r < 0.36) { say(L, '本を読むのが好きになった。'); add(L, 'learn', 5); }
    else if (r < 0.40) { say(L, `家族で${pref.spots[1]}を見に行った。`, 'good'); add(L, 'happy', 3); }
    else if (r < 0.43 && !L.family.single) { say(L, '父の転勤で引っ越した。友達と別れた。'); add(L, 'bond', -5); }
    else if (r < 0.46 && !L.family.single) { say(L, '両親が離婚した。母と暮らすことになった。', 'bad'); L.family.single = true; add(L, 'happy', -10); L.family.tier = L.family.tier === '高' ? '中' : '低'; }
  }
  if (a >= 13 && a <= 17 && L.stage !== '社会人') {
    const r = rnd();
    if (r < 0.08) { say(L, 'スマホを持った。夜中まで見るようになった。'); add(L, 'health', -2); add(L, 'bond', 2); }
    else if (r < 0.14) { say(L, '恋人ができた。', 'good'); add(L, 'happy', 6); }
    else if (r < 0.18) { say(L, '失恋した。', 'bad'); add(L, 'happy', -6); }
    else if (r < 0.22) { say(L, '自転車で事故にあった。幸い軽いけが。'); add(L, 'health', -3); }
    else if (r < 0.28 && a >= 16) { say(L, `${pick(['コンビニ', 'ファミレス', 'スーパー', '塾'])}でバイトをはじめた。`); add(L, 'bond', 2); L.money += 30; }
    else if (r < 0.32) { say(L, '学校に行けない時期があった。', 'bad'); add(L, 'happy', -8); add(L, 'learn', -4); }
    else if (r < 0.36) { say(L, `${L.flags.club === '運動部' ? '県大会に出た' : '文化祭で役をやった'}。`, 'good'); add(L, 'happy', 5); add(L, 'bond', 3); }
  }

  /* --- 大学・専門時代 --- */
  if (['大学生', '専門学生', '大学院生'].includes(L.stage) && a >= 19) {
    const r = rnd();
    if (r < 0.15) { say(L, `${pick(['サークル', 'ゼミ', 'バイト先'])}で一生の友達ができた。`, 'good'); add(L, 'bond', 6); }
    else if (r < 0.20) { say(L, '半年、海外に留学した。'); add(L, 'learn', 8); add(L, 'happy', 5); L.money -= 100; }
    else if (r < 0.26) { say(L, '恋人ができた。', 'good'); add(L, 'happy', 6); }
    else if (r < 0.30) { say(L, 'ほとんど授業に出なかった。'); add(L, 'learn', -4); }
    else if (r < 0.36) { say(L, 'バイトと授業で手いっぱいの一年。'); L.money += 60; add(L, 'health', -2); }
    if (a === 21 && L.stage === '大学生') say(L, '就職活動がはじまった。スーツで何十社も回った。');
  }

  /* --- 働く --- */
  if (L.working) await workYear(L, pref);

  /* --- 結婚・家族 --- */
  await familyYear(L, pref);

  /* --- 健康の節目 --- */
  if (a === 35 && chance(0.6)) await decide(L, '健康診断で血圧と血糖が高めだと言われた。', [
    { t: '運動と食事を変える', d: '長く効く', w: 45, f: () => { L.habits.exercise = true; add(L, 'health', 6); say(L, '週に2回走るようになった。', 'good'); } },
    { t: '今は気にしない', w: 55, f: () => { add(L, 'health', -3); } },
  ]);
  if (a === 50) await decide(L, 'がん検診の案内が届いた。', [
    { t: '受ける', w: 50, f: () => { L.flags.screening = true; } },
    { t: '忙しいから後で', w: 50, f: () => { } },
  ]);
  if (L.habits.smoke && a >= 40 && chance(0.08)) { await decide(L, 'せきが止まらない。医者に禁煙を勧められた。', [
    { t: '禁煙する', w: 50, f: () => { L.habits.smoke = false; say(L, 'タバコをやめた。', 'good'); add(L, 'health', 4); } },
    { t: 'やめられない', w: 50, f: () => { add(L, 'health', -4); } },
  ]); }

  /* --- 大人の出来事 --- */
  if (a >= 25 && a < 65) {
    const r = rnd();
    if (r < 0.04) { say(L, `${pick(['ぎっくり腰', '帯状疱疹', 'うつ', '胃潰瘍', 'ヘルニア'])}になった。しばらく休んだ。`, 'bad'); add(L, 'health', -6); add(L, 'happy', -4); }
    else if (r < 0.07) { say(L, `${pick(['釣り', '登山', 'キャンプ', 'ランニング', '料理', 'ギター', 'ゴルフ', '推し活', '家庭菜園'])}が趣味になった。`, 'good'); add(L, 'happy', 5); }
    else if (r < 0.09) { say(L, '犬を飼いはじめた。', 'good'); add(L, 'happy', 4); add(L, 'health', 2); }
    else if (r < 0.11) { say(L, `友達と${pick(['沖縄', '北海道', '韓国', '台湾', 'ハワイ'])}に旅行した。`, 'good'); add(L, 'happy', 4); L.money -= 20; }
    else if (r < 0.13) { say(L, '古い友達と疎遠になった。'); add(L, 'bond', -5); }
    else if (r < 0.15) { say(L, 'SNSで知り合った人たちと会うようになった。'); add(L, 'bond', 4); }
  }

  /* --- 災害 --- */
  if (pref.hazards.includes('地震') && chance(0.006)) {
    say(L, '大きな地震が起きた。家の中はめちゃくちゃになった。', 'bad'); add(L, 'happy', -8); L.money -= L.home === '持ち家' ? 300 : 50;
    if (chance(0.02)) { L.cause = '地震'; }
  }
  if (pref.hazards.includes('台風') && chance(0.02)) { say(L, '台風で屋根が飛んだ。'); L.money -= 50; add(L, 'happy', -3); }
  if (pref.hazards.includes('雪') && chance(0.03)) { say(L, pick(['大雪で3日間、家から出られなかった。', '雪かきで腰をやった。', '記録的な大雪。駅で一晩過ごした。'])); add(L, 'health', -1); }
  if (pref.hazards.includes('火山') && chance(0.02)) say(L, '桜島の灰で洗濯物が真っ黒になった。');
  if (pref.hazards.includes('津波') && chance(0.002)) { say(L, '津波警報。高台へ走った。', 'bad'); add(L, 'happy', -8); if (chance(0.03)) L.cause = '津波'; }

  /* --- 老い --- */
  await elderYear(L, pref);

  /* --- 親 --- */
  for (const p of L.parents) {
    if (!p.alive) continue;
    const pa = p.ageAtBirth + a;
    if (chance(qx(pa, p.role === '母' ? '女' : '男') * 1.15)) {
      p.alive = false;
      say(L, `${p.role}が亡くなった。${pa}歳だった。`, 'bad'); add(L, 'happy', a < 30 ? -14 : -9); add(L, 'bond', -4);
      if (L.flags.caring === p.role) L.flags.caring = null;
    }
  }

  /* --- お金 --- */
  moneyYear(L, pref);

  /* --- 数値の自然な動き --- */
  if (a >= 40) add(L, 'health', -(0.4 + (a - 40) * 0.035) + (L.habits.exercise ? 0.3 : 0) - (L.habits.smoke ? 0.6 : 0));
  if (a >= 25 && a <= 60 && L.working) add(L, 'learn', 0.3);
  if (a >= 65) add(L, 'learn', -0.3);
  const base = 50 + (L.s.bond - 50) * 0.35 + (L.s.health - 50) * 0.3 + (L.money > 300 ? 5 : L.money < -200 ? -8 : 0) + (L.partner ? 4 : 0);
  L.s.happy = clamp(L.s.happy + (base - L.s.happy) * 0.25);
  if (L.s.bond > 50) add(L, 'bond', -0.4);

  /* --- 死 --- */
  if (!L.cause) {
    let q = qx(a, L.sex);
    q *= L.s.health < 25 ? 1.6 : L.s.health < 45 ? 1.15 : L.s.health > 80 ? 0.8 : 1;
    if (L.habits.smoke) q *= 1.35;
    if (L.habits.exercise) q *= 0.88;
    if (L.job && a < 65 && L.working) q *= 1 + (-L.job.health) * 0.06;
    if (chance(q)) L.cause = pickCause(L);
  }
  if (L.cause) { die(L); return; }

  L.map.push(Math.round(L.s.happy));
  if (L.log.length === had && a > 2) UI.onQuiet && UI.onQuiet();
}

function pickCause(L) {
  const band = D.causes.find(c => L.age <= c.max);
  const w = { ...band.w };
  if (L.habits.smoke) { for (const k of Object.keys(w)) if (/がん|心臓|脳/.test(k)) w[k] *= 1.6; }
  if (L.flags.screening) { for (const k of Object.keys(w)) if (/がん/.test(k)) w[k] *= 0.75; }
  if (L.s.happy < 25) { if (w['自殺']) w['自殺'] *= 2.5; }
  if (L.s.happy > 70) { if (w['自殺']) w['自殺'] *= 0.4; }
  if (L.gentle) for (const k of D.heavyCauses) delete w[k];
  if (!Object.keys(w).length) return '病気';
  return weighted(w);
}

function die(L) {
  L.alive = false;
  L.map.push(Math.round(L.s.happy));
  const c = L.cause;
  const line = c === '老衰' ? `${L.age}歳、眠るように亡くなった。` : `${L.age}歳で亡くなった。${/事故|地震|津波|殺人/.test(c) ? c + 'だった' : c + 'が原因だった'}。`;
  say(L, line, 'death');
}

/* ---------- 進学 ---------- */
async function decideHighSchool(L, pref) {
  await decide(L, '中学を卒業する。高校はどうする？', [
    { t: '普通科に進む', w: 70 + L.s.learn / 2, f: () => { L.stage = '高校生'; L.flags.hs = '普通科'; say(L, '普通科の高校に入った。', 'milestone'); } },
    { t: '工業・商業・農業などの専門学科へ', d: '手に職をつける', w: 22, f: () => { L.stage = '高校生'; L.flags.hs = '専門学科'; say(L, `${pick(['工業', '商業', '農業', '看護', '情報'])}高校に入った。`, 'milestone'); add(L, 'learn', 2); } },
    { t: '高校には行かない', d: '働きはじめる', w: 2, f: () => { L.stage = '社会人'; say(L, '高校には行かず、働きはじめた。', 'milestone'); } },
  ]);
  if (L.stage === '社会人') await decideJob(L);
}

async function decideAfterHigh(L, pref) {
  if (L.stage !== '高校生') return;
  say(L, '高校を卒業した。', 'milestone'); L.edu = '高卒';
  const famF = { 低: 0.65, 中: 1, 高: 1.35 }[L.family.tier];
  const univW = pref.univ * (L.s.learn / 55) * famF * (L.flags.hs === '専門学科' ? 0.5 : 1);
  await decide(L, '18歳。この先どうする？', [
    { t: '大学に進む', d: `${L.pref}の大学進学率は${pref.univ}%`, w: univW, f: async () => {
      L.stage = '大学生';
      let where = L.livePref;
      if (pref.urban < 0.7 && chance(0.4)) { where = pref.region === '近畿' || pref.region === '中国' || pref.region === '四国' ? pick(['大阪府', '京都府']) : pref.region === '九州' || pref.region === '沖縄' ? pick(['福岡県', '東京都']) : '東京都'; }
      if (where !== L.livePref) { L.livePref = where; L.home = '一人暮らし'; say(L, `${where}の大学に合格した。親元を離れて一人暮らし。`, 'milestone'); add(L, 'bond', -3); }
      else say(L, '地元の大学に合格した。', 'milestone');
      if (L.family.tier !== '高' && chance(0.5)) { L.debt += 300; say(L, '学費は奨学金。卒業後に300万円を返していく。'); }
      add(L, 'learn', 8);
    } },
    { t: '専門学校に進む', d: '2年で資格をとる', w: 22, f: () => { L.stage = '専門学生'; L.edu = '専門卒'; say(L, `${pick(['看護', '保育', '美容', '調理', 'IT', 'デザイン', '自動車整備', '医療事務'])}の専門学校に入った。`, 'milestone'); add(L, 'learn', 4); if (L.family.tier === '低' && chance(0.5)) { L.debt += 150; say(L, '学費の一部は奨学金で。'); } } },
    { t: '就職する', w: 15 + (L.flags.hs === '専門学科' ? 20 : 0), f: async () => { L.stage = '社会人'; await decideJob(L); } },
    { t: '浪人する', d: 'もう1年がんばる', w: 3, f: () => { L.stage = '浪人'; say(L, '予備校に通うことになった。'); add(L, 'learn', 5); } },
  ]);
}
// 浪人は翌年に大学へ
async function ronin(L) { if (L.stage === '浪人') { L.stage = '大学生'; say(L, '1年遅れで大学に合格した。', 'milestone'); L.flags.roninDone = true; } }

/* ---------- 仕事 ---------- */
async function decideJob(L, q = '仕事を選ぶ。') {
  const opts = jobOptions(L);
  await decide(L, q, opts.map(j => ({ t: j.name, d: `${j.field}・正社員になれる確率 ${Math.round(j.regular * 100)}%`, w: 1, f: () => setJob(L, j) })));
}
function setJob(L, j) {
  L.job = j; L.working = true; L.retired = false;
  let pr = j.regular + (eduRank(L.edu) >= 3 ? 0.1 : 0) - (L.age > 45 ? 0.2 : 0);
  L.regular = chance(pr);
  if (j.name === 'フリーランス' || j.name === '会社の経営者' || j.name === '農家' || j.name === '漁師') L.regular = j.name !== 'フリーランス';
  say(L, `${L.regular ? '正社員' : j.name === 'フリーランス' ? '個人事業主' : '契約・パート'}として${j.name}になった。`, 'milestone');
  L.flags.promoted = false; L.flags.jobStart = L.age;
}
async function workYear(L, pref) {
  const a = L.age, j = L.job;
  const years = a - (L.flags.jobStart || a);
  if (years === 1 && chance(0.3)) say(L, pick(['仕事を覚えるのに必死の一年。', '毎日くたくた。でも給料日はうれしい。', '先輩に怒られながら覚えた。']));
  const r = rnd();
  if (r < 0.05 && j.health <= -1) { say(L, '残業が続いて体を壊した。'); add(L, 'health', -5); add(L, 'happy', -4); }
  else if (r < 0.09 && L.regular && a >= 30 && a <= 50 && !L.flags.promoted) { L.flags.promoted = true; say(L, `${pick(['主任', '係長', '班長', 'リーダー', '店長'])}になった。給料が上がった。`, 'good'); add(L, 'happy', 5); add(L, 'learn', 3); }
  else if (r < 0.11 && a >= 25 && a < 55 && (L.flags.moves || 0) < 2 + rnd() * 2) {
    await decide(L, `${pick(['知り合い', '取引先', '転職サイト'])}から誘いが来た。${pick(['条件はいまより少し上', '仕事はきついが給料は上', '給料は同じで家から近い'])}。`, [
      { t: '転職する', w: 40, f: () => { const nj = pick(jobOptions(L, 3, chance(0.6) ? j.field : null)); L.flags.moves = (L.flags.moves || 0) + 1; say(L, '転職した。', 'milestone'); setJob(L, nj); } },
      { t: 'いまの職場に残る', w: 60, f: () => { add(L, 'bond', 1); } },
    ]);
  }
  else if (r < 0.125 && chance(L.regular ? 0.6 : 1) && a < 60) {
    say(L, L.regular ? '会社が倒産した。' : '契約を切られた。', 'bad'); add(L, 'happy', -10); L.working = false; L.flags.jobless = 1;
  }
  else if (r < 0.14 && a >= 28 && a <= 50 && L.s.learn >= 55 && chance(0.5)) {
    await decide(L, `${pick(['独立しないか、と言われた', '自分で店をやりたい気持ちが強くなった', '副業の収入が本業に近づいた'])}。`, [
      { t: '独立する', d: '収入は不安定、自由は増える', w: 25, f: () => { setJob(L, jobByName(chance(0.5) ? '会社の経営者' : 'フリーランス')); add(L, 'happy', 6); if (chance(0.35)) { say(L, '最初の2年は赤字だった。'); L.money -= 300; } } },
      { t: 'いまのまま', w: 75, f: () => { } },
    ]);
  }
  else if (r < 0.16) { say(L, pick(['職場に気の合う仲間ができた。', '後輩を育てる立場になった。', '仕事で表彰された。']), 'good'); add(L, 'bond', 3); add(L, 'happy', 3); }
  else if (r < 0.18) { say(L, pick(['上司と合わない。毎朝が重い。', '人手不足で休みが取れない。', '給料が上がらない。']), 'bad'); add(L, 'happy', -5); }
  if (j.field === '製造' && years === 3 && chance(0.4)) { say(L, '機械を一人で任されるようになった。', 'good'); add(L, 'learn', 4); }
}
async function joblessYear(L) {
  if (L.flags.jobless) {
    L.flags.jobless++;
    if (L.flags.jobless >= 2) { L.flags.jobless = 0; const nj = pick(jobOptions(L, 3, L.job && chance(0.5) ? L.job.field : null)); say(L, '半年の失業を経て、次の仕事が見つかった。'); setJob(L, nj); }
  }
}

/* ---------- 結婚・子ども ---------- */
async function familyYear(L, pref) {
  const a = L.age;
  if (L.stage === '浪人') await ronin(L);
  if (!L.working && !L.retired && L.stage === '社会人' && L.age < 65) await joblessYear(L);

  // 出会い → 結婚
  if (!L.partner && a >= 22 && a <= 48 && !L.flags.lover) {
    const m = D.marriage;
    const peak = L.sex === '男' ? m.meanAgeMale : m.meanAgeFemale;
    let p = 0.21 * Math.exp(-Math.pow((a - peak) / 7, 2)) * (L.s.bond / 55) * (L.money > 100 || L.sex === '女' ? 1 : 0.7) * (L.working || L.sex === '女' ? 1 : 0.6);
    if (L.flags.divorced) p *= 0.6;
    if (chance(p)) { L.flags.lover = true; say(L, `${pick(['職場', '友達の紹介', 'アプリ', '学生時代からの', '趣味の集まり'])}で出会った人と付き合いはじめた。`, 'good'); add(L, 'happy', 6); }
  } else if (L.flags.lover && !L.partner) {
    if (chance(0.55)) {
      await decide(L, L.sex === '男' ? 'プロポーズするか、迷っている。' : 'プロポーズされた。', [
        { t: '結婚する', w: 70, f: () => {
          const pname = pick(NAMES[L.sex === '男' ? '女' : '男']);
          L.partner = { name: pname, alive: true, age: a + irnd(-3, 3), works: chance(L.sex === '男' ? 0.7 : 0.95), since: a };
          L.flags.lover = false; L.home = L.home === '持ち家' ? '持ち家' : '賃貸';
          say(L, `${pname}さんと結婚した。`, 'milestone'); add(L, 'happy', 12); add(L, 'bond', 10);
          if (chance(0.5)) { say(L, '小さな結婚式を挙げた。'); L.money -= 150; } else say(L, '式はせず、写真だけ撮った。');
        } },
        { t: 'まだ結婚はしない', w: 30, f: () => { if (chance(0.5)) { L.flags.lover = false; say(L, 'その後、別れた。', 'bad'); add(L, 'happy', -6); } } },
      ]);
    } else if (chance(0.25)) { L.flags.lover = false; say(L, '別れた。', 'bad'); add(L, 'happy', -6); }
  }

  // 子ども
  if (L.partner && L.partner.alive) {
    const momAge = L.sex === '女' ? a : L.partner.age + (a - L.partner.since);
    if (L.kids.length < 3 && momAge >= 22 && momAge <= 42) {
      let p = L.kids.length === 0 ? 0.30 : L.kids.length === 1 ? 0.22 : 0.07;
      if (momAge > 36) p *= 0.5;
      if (L.money < -100) p *= 0.6;
      if (chance(p)) {
        const ks = chance(0.513) ? '男' : '女';
        L.kids.push({ born: a, sex: ks, name: pick(NAMES[ks]) });
        say(L, `${['第一子', '第二子', '第三子'][L.kids.length - 1]}の${L.kids[L.kids.length - 1].name}が生まれた。${ks}の子。`, 'milestone'); add(L, 'happy', 10); add(L, 'bond', 6); add(L, 'health', -2);
      }
    }
    // 離婚
    if (chance(D.marriage.divorceYearly * (L.s.happy < 40 ? 1.8 : 1))) {
      say(L, `${L.partner.name}さんと離婚した。`, 'bad'); add(L, 'happy', -14); add(L, 'bond', -8); L.money -= 100;
      L.flags.divorced = true; L.partner = null;
      if (L.kids.length && L.sex === '男') say(L, '子どもは母親と暮らすことになった。');
    }
  }
  // 子の成長
  for (const k of L.kids) {
    const ka = a - k.born;
    if (ka === 6 && chance(0.5)) say(L, `${k.name}が小学校に入った。`);
    if (ka === 18) { say(L, `${k.name}が${chance(0.6) ? '大学に進んだ' : '就職した'}。`); if (chance(0.6)) L.money -= 300; }
    if (ka === 22 && chance(0.5)) say(L, `${k.name}が家を出た。`);
    if (ka >= 26 && ka <= 36 && !k.married && chance(0.15)) { k.married = true; say(L, `${k.name}が結婚した。`, 'good'); add(L, 'happy', 6); }
    if (k.married && ka >= 27 && ka <= 40 && L.grandkids < 4 && chance(0.2)) { L.grandkids++; say(L, L.grandkids === 1 ? '初めての孫が生まれた。' : `${L.grandkids}人目の孫が生まれた。`, 'good'); add(L, 'happy', 8); add(L, 'bond', 4); }
  }
  // 家
  if (L.home !== '持ち家' && a >= 29 && a <= 42 && (L.partner || L.money > 600) && !L.flags.homeAsked && chance(0.5)) {
    L.flags.homeAsked = true;
    await decide(L, `家を買うか考えている。${pref.urban >= 0.8 ? 'このあたりは高い。' : '郊外なら庭つきも手が届く。'}`, [
      { t: '買う', d: '35年ローン', w: 68, f: () => { L.home = '持ち家'; L.loan = Math.round((pref.urban >= 0.8 ? 4500 : 3000) * pref.income); L.loanYears = 35; L.money -= 300; say(L, `${pref.urban >= 0.8 ? 'マンション' : '一戸建て'}を買った。ローンは35年。`, 'milestone'); add(L, 'happy', 6); } },
      { t: '賃貸のままでいい', w: 32, f: () => { L.home = '賃貸'; } },
    ]);
  }
  // 親の介護
  for (const p of L.parents) {
    const pa = p.ageAtBirth + a;
    if (p.alive && pa >= 82 && !L.flags.careAsked && chance(0.25)) {
      L.flags.careAsked = true;
      await decide(L, `${p.role}に介護が必要になった。`, [
        { t: '自分が中心になって見る', d: '時間とお金がかかる', w: 35, f: () => { L.flags.caring = p.role; add(L, 'bond', 5); add(L, 'health', -5); add(L, 'happy', -4); L.money -= 150; say(L, `${p.role}の介護で、仕事と家の往復の日々。`); } },
        { t: '施設に頼む', d: 'お金がかかる', w: 40, f: () => { L.money -= 300; say(L, `${p.role}は施設に入った。週末に会いに行く。`); } },
        { t: '兄弟や親戚に任せる', w: L.family.siblings ? 25 : 2, f: () => { add(L, 'bond', -6); add(L, 'happy', -3); } },
      ]);
    }
  }
}

/* ---------- 老い ---------- */
async function elderYear(L, pref) {
  const a = L.age;
  if (a === 60 && L.working) {
    await decide(L, '60歳。定年を迎えた。この先は？', [
      { t: '再雇用で働き続ける', d: '給料は6割', w: 55, f: () => { L.flags.rehired = true; say(L, '同じ職場で、嘱託として働くことにした。'); } },
      { t: '仕事を辞めてのんびりする', w: 30, f: () => { L.working = false; L.retired = true; say(L, '仕事を辞めた。朝ゆっくり起きる。', 'milestone'); add(L, 'happy', 5); add(L, 'bond', -4); } },
      { t: '新しいことをはじめる', d: '店、畑、ボランティア', w: 15, f: () => { L.working = false; L.retired = true; say(L, `退職して、${pick(['小さな畑', '週3日のボランティア', '趣味の教室', '地域のサークル'])}をはじめた。`, 'milestone'); add(L, 'happy', 8); add(L, 'bond', 6); } },
    ]);
  }
  if (a === 65) {
    if (L.working && L.job.name !== '会社の経営者' && L.job.name !== 'フリーランス' && L.job.name !== '農家' && L.job.name !== '漁師') { L.working = false; L.retired = true; say(L, '65歳で仕事を終えた。年金暮らしがはじまる。', 'milestone'); }
    else if (!L.working) say(L, '年金が入るようになった。');
    L.flags.pension = true;
  }
  if (a >= 66 && a <= 80) {
    const r = rnd();
    if (r < 0.06) { say(L, pick(['毎朝、近所を散歩する。', '地域の集まりに顔を出すようになった。', '昔の仲間と年に一度集まる。']), 'good'); add(L, 'bond', 4); add(L, 'health', 1); }
    else if (r < 0.10) { say(L, pick(['膝が痛くて階段がつらい。', '白内障の手術をした。', '血圧の薬が増えた。'])); add(L, 'health', -3); }
    else if (r < 0.13 && L.partner) { say(L, `${L.partner.name}さんと${pick(['温泉', pref.spots[0], '孫の運動会'])}に行った。`, 'good'); add(L, 'happy', 5); }
    else if (r < 0.15 && !L.partner && !L.kids.length) { say(L, '一人の時間が長い。'); add(L, 'bond', -4); add(L, 'happy', -3); }
  }
  if (a === 75 && pref.urban < 0.6 && !L.flags.licenseAsked) {
    L.flags.licenseAsked = true;
    await decide(L, '75歳。運転免許をどうするか。', [
      { t: '返納する', d: '買い物が不便になる', w: 40, f: () => { L.flags.noCar = true; add(L, 'bond', -3); say(L, '免許を返した。バスの時間を調べる生活。'); } },
      { t: 'まだ運転する', w: 60, f: () => { if (chance(0.1)) { say(L, '駐車場で車をぶつけた。'); add(L, 'happy', -3); } } },
    ]);
  }
  // 配偶者の死
  if (L.partner && L.partner.alive) {
    const pAge = L.partner.age + (a - L.partner.since);
    if (chance(qx(pAge, L.sex === '男' ? '女' : '男'))) {
      L.partner.alive = false; say(L, `${L.partner.name}さんが亡くなった。${pAge}歳だった。`, 'bad'); add(L, 'happy', -18); add(L, 'bond', -8); add(L, 'health', -3);
    }
  }
  // 要介護
  if (a >= 78 && !L.flags.care && chance(0.02 + (a - 78) * 0.012 + (L.s.health < 40 ? 0.05 : 0))) {
    L.flags.care = true; say(L, pick(['転んで骨折した。歩くのに杖が要るようになった。', '物忘れが増えた。認知症と診断された。', '脳梗塞で倒れた。左半身が動きにくい。']), 'bad'); add(L, 'health', -12);
    if (!L.partner?.alive && chance(0.5)) { say(L, L.kids.length ? `${L.kids[0].name}の近くの施設に入った。` : '施設に入った。'); L.home = '施設'; L.money -= 200; }
  }
  if (a === 88 && chance(0.6)) say(L, '米寿。親戚が集まった。', 'good');
  if (a === 100) say(L, '100歳。市長から表彰された。', 'milestone');
}

/* ---------- お金 ---------- */
function moneyYear(L, pref) {
  const a = L.age;
  if (a < 18) { L.money = Math.max(L.money, 0); return; }
  let inc = 0;
  if (L.working) { const s = salaryOf(L); inc += Math.round(s * 0.78); L.incomeTotal += s; }
  if (L.partner?.alive && L.partner.works && a < 65) inc += Math.round((L.working ? salaryOf(L) : 300) * (L.sex === '男' ? 0.5 : 1.2) * 0.78);
  if (L.flags.pension) {
    if (L.flags.pensionAmt == null) L.flags.pensionAmt = (L.job && (L.regular || L.flags.promoted)) ? 180 : L.job ? 110 : 70;
    inc += L.flags.pensionAmt + (L.partner?.alive ? 80 : 0);
  }
  let exp = (pref.urban >= 0.8 ? 240 : 180) * (a >= 65 ? 0.85 : 1);
  if (['大学生', '専門学生', '大学院生', '浪人'].includes(L.stage)) { exp = L.family.tier === '低' ? 60 : 0; if (L.family.tier === '低') inc += 80; }
  if (!L.working && !L.flags.pension && L.stage === '社会人') exp *= 0.7;
  if (L.partner?.alive) exp += 100;
  exp += L.kids.filter(k => a - k.born < 22).length * 100;
  if (L.loanYears > 0) { exp += Math.round(L.loan / 35); L.loanYears--; }
  if (L.debt > 0 && L.stage === '社会人') { const r = Math.min(L.debt, 20); L.debt -= r; exp += r; if (L.debt === 0) say(L, '奨学金を返し終えた。', 'good'); }
  if (L.home === '施設') exp += 150;
  L.money += inc - exp;
  if (L.money < -500 && !L.flags.broke) { L.flags.broke = true; say(L, '借金が膨らんで、生活が苦しい。', 'bad'); add(L, 'happy', -8); }
  if (L.money > 2000 && !L.flags.rich) { L.flags.rich = true; say(L, '貯金が2000万円を超えた。', 'good'); }
}

/* ---------- 画面 ---------- */
const S = { life: null, speedMs: 1600, paused: false, auto: false, resolveAsk: null, resumeFns: [] };
const screens = ['title', 'birth', 'life', 'result'];
function show(name) { for (const s of screens) $(`#screen-${s}`).classList.toggle('active', s === name); window.scrollTo(0, 0); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitUnpaused() { while (S.paused) await sleep(120); }

function renderStats(L) {
  for (const k of ['health', 'happy', 'learn', 'bond']) { $(`#bar-${k}`).style.width = `${Math.round(L.s[k])}%`; $(`#val-${k}`).textContent = Math.round(L.s[k]); }
  $('#val-money').textContent = fmtMoney(L.money);
  $('#life-job').textContent = L.job ? (L.working ? L.job.name : L.retired ? `元${L.job.name}` : '求職中') : ['大学生', '専門学生', '大学院生', '高校生', '中学生', '小学生', '浪人'].includes(L.stage) ? L.stage : '';
  $('#life-age').textContent = L.age; $('#life-year').textContent = `${L.birthYear + L.age}年`;
  $('#life-pref').textContent = L.livePref === L.pref ? L.pref : `${L.livePref}（${L.pref}生まれ）`;
}
function fmtMoney(m) { const v = Math.round(m); if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}億円`; return `${v.toLocaleString()}万円`; }
function logLine(ev, into) {
  const d = document.createElement('div'); d.className = `ev ${ev.kind}`;
  d.innerHTML = `<span class="age">${ev.age}</span><span class="txt"></span>`; d.querySelector('.txt').textContent = ev.text;
  into.appendChild(d); return d;
}
UI.onLog = (ev) => { const log = $('#log'); logLine(ev, log); log.scrollTop = log.scrollHeight; renderStats(S.life); };
UI.onQuiet = () => { };
UI.auto = () => S.auto;
UI.ask = (L, q, options) => new Promise(resolve => {
  $('#decision-age').textContent = `${L.age}歳 · ${L.livePref}`;
  $('#decision-q').textContent = q;
  const box = $('#decision-opts'); box.innerHTML = '';
  options.forEach(o => {
    const b = document.createElement('button'); b.className = 'btn';
    b.innerHTML = `${escapeHtml(o.t)}${o.d ? `<small>${escapeHtml(o.d)}</small>` : ''}`;
    b.onclick = () => { $('#decision').classList.add('hidden'); S.resolveAsk = null; resolve(o); };
    box.appendChild(b);
  });
  $('#decision').classList.remove('hidden');
  S.resolveAsk = { options, resolve };
});
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------- 進行 ---------- */
async function startLife(L) {
  S.life = L; show('life'); $('#log').innerHTML = ''; $('#decision').classList.add('hidden');
  $('#life-name').textContent = L.name; renderStats(L);
  await stepYear(L); // 0歳
  await sleep(S.speedMs);
  while (L.alive) {
    await waitUnpaused();
    L.age++;
    const before = L.log.length;
    await stepYear(L);
    renderStats(L);
    if (!L.alive) break;
    await sleep(L.log.length === before ? S.speedMs * 0.3 : S.speedMs); // 何もない年は短く
  }
  await sleep(1600);
  finish(L);
}

/* ---------- 結果 ---------- */
function summaryOf(L) {
  const fam = [];
  if (L.partner) fam.push(L.partner.alive ? `${L.sex === '男' ? '妻' : '夫'}` : `${L.sex === '男' ? '妻' : '夫'}（先立たれた）`);
  else if (L.flags.divorced) fam.push('離婚歴あり');
  if (L.kids.length) fam.push(`子ども${L.kids.length}人`);
  if (L.grandkids) fam.push(`孫${L.grandkids}人`);
  return fam.length ? fam.join('・') : '独身';
}
function finish(L) {
  const pct = Math.round((1 - survivalTo(L.age, L.sex)) * 100);
  const job = L.job ? L.job.name : '仕事はしなかった';
  $('#result-main').textContent = `${L.pref}に生まれて、${L.age}歳まで生きた。`;
  $('#result-cause').textContent = `${L.name}（${L.sex}）· ${L.cause === '老衰' ? '老衰' : '原因は' + L.cause}。`;
  const help = $('#result-help');
  if (D.heavyCauses.includes(L.cause)) { help.classList.remove('hidden'); help.textContent = `これは統計上の出来事で、場面は描いていません。つらいときは相談できます：${D.helpLines.map(h => `${h.name} ${h.tel}`).join(' ／ ')}`; }
  else help.classList.add('hidden');
  $('#r-age').textContent = `${L.age}年`;
  $('#r-pct').textContent = `${pct}%より長く`;
  $('#r-job').textContent = job;
  $('#r-family').textContent = summaryOf(L);
  $('#r-income').textContent = L.incomeTotal ? fmtMoney(L.incomeTotal) : '―';
  $('#r-live').textContent = `${L.livePref}・${L.home}`;
  const map = $('#lifemap'); map.innerHTML = '';
  L.map.forEach((h, i) => { const c = document.createElement('i'); c.style.opacity = (0.15 + h / 100 * 0.85).toFixed(2); c.title = `${i}歳 幸せ${h}`; map.appendChild(c); });
  const rl = $('#result-log'); rl.innerHTML = ''; L.log.filter(e => e.kind !== 'choice').forEach(e => logLine(e, rl));
  // 出口
  const ex = CFG.exitLink || {};
  if (ex.url) { $('#exit-link').href = ex.url; $('#exit-link').textContent = ex.label; $('#exit-note').textContent = FIELD_OF(L) === '製造' ? `${job}として生きたあなたへ。${ex.note}` : ex.note; }
  else $('.exit').classList.add('hidden');
  // 広告
  const ad = $('#ad-result');
  if (CFG.adsenseClient && CFG.adsenseSlot) {
    ad.classList.remove('hidden');
    ad.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${CFG.adsenseClient}" data-ad-slot="${CFG.adsenseSlot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    if (!document.querySelector('script[src*="adsbygoogle"]')) { const s = document.createElement('script'); s.async = true; s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CFG.adsenseClient}`; s.crossOrigin = 'anonymous'; document.head.appendChild(s); }
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { }
  }
  drawCard(L, pct);
  setupShare(L, pct);
  savePast(L);
  show('result');
}

/* ---------- カード ---------- */
const REGION_COLORS = { 北海道: ['#2b4a6f', '#8fb4d9'], 東北: ['#3e5a3a', '#a9c7a0'], 関東: ['#1b1f2a', '#7c86a8'], 中部: ['#4a3f6b', '#b2a4d6'], 近畿: ['#6b2d3e', '#d9a2ae'], 中国: ['#2f5d62', '#9ccbc8'], 四国: ['#5c4a1f', '#d4bf7a'], 九州: ['#7a3a1d', '#e0a583'], 沖縄: ['#0f6b8a', '#8ad7e8'] };
function drawCard(L, pct) {
  const cv = $('#card'), c = cv.getContext('2d'), W = cv.width, H = cv.height;
  const pref = prefByName(L.pref);
  const [c1, c2] = REGION_COLORS[pref.region] || ['#333', '#999'];
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // 人生地図（背景）
  const cell = 28, gap = 6, cols = 20, startX = (W - (cols * cell + (cols - 1) * gap)) / 2, startY = 870;
  L.map.forEach((h, i) => { const x = startX + (i % cols) * (cell + gap), y = startY + Math.floor(i / cols) * (cell + gap); c.fillStyle = `rgba(255,255,255,${0.12 + h / 100 * 0.78})`; c.fillRect(x, y, cell, cell); });
  const font = (w, px) => `${w} ${px}px -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = font(500, 34); c.textAlign = 'left'; c.fillText('1億2千万分の1 ― 日本のどこかで', 80, 110);
  c.fillStyle = '#fff'; c.font = font(700, 120); c.fillText(L.pref, 80, 260);
  c.font = font(500, 48); c.fillText(`に生まれて、${L.age}歳まで生きた。`, 80, 330);
  c.font = font(400, 38); c.fillStyle = 'rgba(255,255,255,.92)';
  const lines = [`${L.name}（${L.sex}）· ${L.job ? L.job.name : '―'}`, `${summaryOf(L)} · ${L.livePref}で${L.home}`, `${L.cause === '老衰' ? '老衰で' : L.cause + 'で'}この世を去った。`];
  lines.forEach((t, i) => c.fillText(t, 80, 420 + i * 58));
  // ステータス
  const labels = [['健康', 'health'], ['幸せ', 'happy'], ['学び', 'learn'], ['つながり', 'bond']];
  labels.forEach(([lab, k], i) => {
    const y = 630 + i * 42; c.fillStyle = 'rgba(255,255,255,.85)'; c.font = font(500, 28); c.textAlign = 'left'; c.fillText(lab, 80, y + 24);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(230, y + 4, 740, 20); c.fillStyle = '#fff'; c.fillRect(230, y + 4, 740 * L.s[k] / 100, 20);
  });
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = font(500, 30); c.fillText(`人生地図：1マス＝1年、明るいほど幸せ`, 80, 846);
  // 一言
  if (L.oneWord) { c.fillStyle = '#fff'; c.font = font(500, 40); c.textAlign = 'center'; c.fillText(`「${L.oneWord}」`, W / 2, 1160); }
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = font(500, 30); c.textAlign = 'center';
  c.fillText(`同じ年に生まれた${L.sex}の${pct}%より長く生きた`, W / 2, 1230);
  c.font = font(400, 26); c.fillText(CFG.siteUrl ? CFG.siteUrl.replace(/^https?:\/\//, '') : '#1億2千万分の1', W / 2, 1290);
}
function cardBlob() { return new Promise(r => $('#card').toBlob(r, 'image/png')); }
function shareText(L) { return `${L.pref}に生まれて、${L.age}歳まで生きた。${L.job ? L.job.name + '。' : ''}${summaryOf(L)}。 #1億2千万分の1`; }
function setupShare(L, pct) {
  const url = CFG.siteUrl || location.href.split('#')[0];
  const text = shareText(L);
  $('#share-x').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  $('#share-line').href = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  $('#btn-save').onclick = async () => { const b = await cardBlob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `jinsei_${L.pref}_${L.age}.png`; a.click(); };
  $('#btn-share').onclick = async () => {
    const b = await cardBlob(); const file = new File([b], 'jinsei.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `${text} ${url}` }); return; } catch (e) { } }
    if (navigator.share) { try { await navigator.share({ text, url }); return; } catch (e) { } }
    window.open($('#share-x').href, '_blank');
  };
}

/* ---------- 前世の記録 ---------- */
const KEY = 'jinsei.lives';
function loadPast() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
function savePast(L) {
  try {
    const list = loadPast(); list.unshift({ at: new Date().toISOString().slice(0, 10), name: L.name, sex: L.sex, pref: L.pref, age: L.age, cause: L.cause, job: L.job ? L.job.name : '', fam: summaryOf(L) });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
  } catch (e) { }
}
function renderPast() {
  const list = loadPast(); const box = $('#past-lives'); const ul = $('#past-list'); ul.innerHTML = '';
  if (!list.length) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  list.forEach(p => { const li = document.createElement('li'); li.innerHTML = `${escapeHtml(p.pref)}生まれ・${escapeHtml(p.name)}（${p.sex}）${p.age}歳 <small>${escapeHtml(p.job || '')}${p.job ? ' · ' : ''}${escapeHtml(p.fam)} · ${escapeHtml(p.cause)} · ${p.at}</small>`; ul.appendChild(li); });
}

/* ---------- 誕生画面 ---------- */
function showBirth(L) {
  const p = prefByName(L.pref);
  $('#birth-year').textContent = `${L.birthYear}年`;
  $('#birth-pref').textContent = L.pref;
  $('#birth-line1').textContent = `${L.name}。${L.sex}の子として、${L.pref}に生まれました。`;
  $('#birth-line2').textContent = `今年、日本で生まれる約${Math.round(D.birthsPerYear / 10000)}万人のうち、${L.pref}はおよそ${birthsIn(p).toLocaleString()}人。`;
  $('#birth-line3').textContent = `生まれる県は出生数の割合で、性別は${Math.round(D.maleRatio * 1000) / 10}対${Math.round((1 - D.maleRatio) * 1000) / 10}で決まります。選べるのは、ここから先だけ。`;
  show('birth');
}

/* ---------- 操作 ---------- */
function bind() {
  $('#in-gentle').checked = localStorage.getItem('jinsei.gentle') === '1';
  $('#btn-birth').onclick = () => {
    const gentle = $('#in-gentle').checked; localStorage.setItem('jinsei.gentle', gentle ? '1' : '0');
    const L = newLife($('#in-name').value.trim(), gentle);
    showBirth(L); S.life = L;
  };
  $('#btn-start').onclick = () => { S.paused = false; startLife(S.life); };
  $('#btn-pause').onclick = () => { S.paused = !S.paused; $('#btn-pause').textContent = S.paused ? '▶' : '⏸'; };
  document.querySelectorAll('.spd').forEach(b => b.onclick = () => { document.querySelectorAll('.spd').forEach(x => x.classList.remove('active')); b.classList.add('active'); S.speedMs = +b.dataset.ms; });
  $('#in-auto').onchange = (e) => {
    S.auto = e.target.checked;
    if (S.auto && S.resolveAsk) { const { options, resolve } = S.resolveAsk; $('#decision').classList.add('hidden'); S.resolveAsk = null; resolve(options[+weighted(options.map((o, i) => [String(i), o.w || 1]))]); }
  };
  $('#btn-again').onclick = () => { renderPast(); show('title'); };
  renderPast();
}
document.addEventListener('DOMContentLoaded', bind);
window.JINSEI_SIM = { newLife, stepYear, UI, summaryOf, survivalTo };
})();
