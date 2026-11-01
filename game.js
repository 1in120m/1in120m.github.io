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
function weighted(obj) {
  const ents = Array.isArray(obj) ? obj : Object.entries(obj);
  const total = ents.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [k, w] of ents) { r -= w; if (r <= 0) return k; }
  return ents[ents.length - 1][0];
}
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const other = (sex) => sex === '男' ? '女' : '男';
const yen = (m) => { const v = Math.round(m); if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}億円`; return `${v.toLocaleString()}万円`; };

/* ---------- 都道府県 ---------- */
const PREFS = D.prefectures.map(p => ({ name: p[0], pop: p[1], birthW: p[2], income: p[3], univ: p[4], urban: p[5], region: p[6], hazards: p[7], spots: [p[8], p[9]] }));
const prefByName = (n) => PREFS.find(p => p.name === n);
const birthsIn = (p) => Math.round(D.birthsPerYear * (p.pop * p.birthW) / PREFS.reduce((s, q) => s + q.pop * q.birthW, 0) / 100) * 100;

/* ---------- 死亡率 ---------- */
function qx(age, sex) { let q = D.mortalityMale.find(([mx]) => age <= mx)[1]; if (sex === '女') q *= D.femaleMortalityFactor; return q; }
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
  if (j.name === '会社の経営者') return false;
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
    if (j.needs && eduRank(L.edu) >= 2) w *= 1.3;
    if (!j.needs && eduRank(L.edu) >= 3) w *= 0.6;
    if (L.sex === '女' && ['看護師', '保育士', '介護職', '一般事務', '美容師', 'アパレルの販売員', '薬剤師'].includes(j.name)) w *= 2;
    if (L.sex === '男' && ['建設の現場作業員', '大工', 'トラック運転手', '自動車工場の作業員', '町工場の技術者', '電気工事士', '警察官', '消防士', '自衛官'].includes(j.name)) w *= 2;
    return [j.name, w];
  });
  const out = [];
  while (out.length < n && weights.length) { const k = weighted(weights); out.push(jobByName(k)); weights.splice(weights.findIndex(([name]) => name === k), 1); }
  return out;
}
function salaryOf(L) {
  if (!L.job || !L.working) return 0;
  const base = D.salaryCurve.find(([mx]) => L.age <= mx)[1];
  let s = base * L.job.salary * (D.eduSalaryFactor[L.edu] || 1) * prefByName(L.livePref).income;
  if (L.sex === '女') s *= D.femaleSalaryFactor;
  if (!L.regular) s *= D.nonRegularFactor / (L.sex === '女' ? D.femaleSalaryFactor : 1) * 0.9;
  if (L.flags.promoted) s *= 1.18;
  if (L.flags.promoted2) s *= 1.15;
  if (L.flags.rehired) s *= 0.6;
  return Math.round(s);
}
const netWorth = (L) => L.money + L.inv + L.homeValue - L.loan - L.debt;

/* ---------- 人生の状態 ---------- */
function newLife(name, gentle) {
  const sex = chance(D.maleRatio) ? '男' : '女';
  const pref = weighted(PREFS.map(p => [p.name, p.pop * p.birthW]));
  const surname = pick(D.surnames);
  const L = {
    surname, name: name || pick(D.namesYoung[sex]), sex, pref, livePref: pref, gentle,
    birthYear: D.year, age: 0, alive: true,
    s: { health: clamp(72 + gauss() * 10), happy: 60, learn: clamp(50 + gauss() * 12), bond: clamp(55 + gauss() * 10) },
    money: 0, inv: 0, invIn: 0, invGain: 0, homeValue: 0, loan: 0, loanYears: 0, debt: 0, incomeTotal: 0, peakNet: 0, inherited: 0, sideIncome: 0, nisa: 0,
    family: { tier: weighted({ 低: 25, 中: 55, 高: 20 }), single: chance(0.10), siblings: +weighted({ 0: 20, 1: 50, 2: 25, 3: 5 }) },
    parents: [], sibs: [], grands: [],
    friend: null, lover: null, partner: null, kids: [], grandkids: [], pet: null, boss: null,
    edu: '中卒', stage: '幼児', job: null, working: false, regular: false, retired: false, home: '実家',
    habits: { smoke: false, exercise: false, saving: false },
    traits: { 体力: clamp(35 + gauss() * 12, 10, 70), 頭脳: clamp(35 + gauss() * 12, 10, 70), 芸術: clamp(30 + gauss() * 12, 10, 70), 社交: clamp(35 + gauss() * 12, 10, 70), ものづくり: clamp(30 + gauss() * 12, 10, 70), お金: clamp(30 + gauss() * 10, 10, 70) }, likes: [],
    flags: {}, log: [], map: [], hist: [], cause: null, oneWord: '',
  };
  L.fullName = `${surname} ${L.name}`;
  L.parents.push({ role: '母', name: pick(D.namesParent.女), ageAtBirth: clamp(Math.round(30 + gauss() * 5), 18, 48), alive: true });
  if (!L.family.single) L.parents.push({ role: '父', name: pick(D.namesParent.男), ageAtBirth: clamp(Math.round(32 + gauss() * 5), 18, 55), alive: true });
  const older = irnd(0, L.family.siblings);
  for (let i = 0; i < L.family.siblings; i++) { const ss = chance(0.5) ? '男' : '女'; L.sibs.push({ name: pick(D.namesYoung[ss]), sex: ss, older: i < older, born: false }); }
  L.sibs.filter(x => x.older).forEach(x => x.born = true);
  L.grands = [{ role: '祖母', name: pick(D.namesGrand.女), ageAtBirth: irnd(50, 68), alive: true }, { role: '祖父', name: pick(D.namesGrand.男), ageAtBirth: irnd(53, 70), alive: true }];
  return L;
}
const kRef = (k) => `${k.sex === '男' ? '息子' : '娘'}の${k.name}`;
const pRef = (L) => `${L.sex === '男' ? '妻' : '夫'}の${L.partner.name}`;
const fRef = (L) => `友達の${L.friend.name}`;
const lRef = (L) => `恋人の${L.lover.name}`;
const gRef = (gk) => `孫の${gk.name}`;
const sibWord = (x) => x.older ? (x.sex === '男' ? '兄' : '姉') : (x.sex === '男' ? '弟' : '妹');

/* ---------- ログ ---------- */
let UI = {};
function say(L, text, kind = 'info') { L.log.push({ age: L.age, text, kind }); UI.onLog && UI.onLog(L.log[L.log.length - 1]); }
const add = (L, k, v) => { L.s[k] = clamp(L.s[k] + v); };
const tr = (L, k, v) => { L.traits[k] = clamp(L.traits[k] + v); };
const like = (L, x) => { if (x && !L.likes.includes(x) && L.likes.length < 8) L.likes.push(x); };

/* ---------- 決断 ---------- */
async function decide(L, q, options) {
  let chosen;
  if (UI.auto()) chosen = options[+weighted(options.map((o, i) => [String(i), o.w || 1]))];
  else chosen = await UI.ask(L, q, options);
  say(L, `${q} → ${chosen.t}`, 'choice');
  await chosen.f?.();
  return chosen;
}

/* ---------- 年ごとの処理 ---------- */
async function stepYear(L) {
  const a = L.age;
  const pref = prefByName(L.livePref);

  /* --- 誕生・幼少 --- */
  if (a === 0) {
    const birthsHere = birthsIn(prefByName(L.pref));
    say(L, `${L.pref}で生まれた。${L.fullName}、${L.sex}の子。今年ここで生まれる赤ちゃんはおよそ${birthsHere.toLocaleString()}人。`, 'milestone');
    const pa = L.parents.map(p => `${p.role}・${p.name}（${p.ageAtBirth}歳）`).join('と');
    const olders = L.sibs.filter(x => x.older).map(x => `${sibWord(x)}の${x.name}`).join('、');
    say(L, `家族は${pa}${olders ? '、' + olders : ''}。${L.family.single ? '父はいない。' : ''}暮らし向きは${{ 低: 'ゆとりがない', 中: 'ふつう', 高: 'ゆとりがある' }[L.family.tier]}。`);
    say(L, `${L.parents[0].role === '母' ? '母' : '父'}の実家は${pref.spots[0]}の近く。${{ 低: '古いアパートで', 中: '郊外の賃貸で', 高: '一戸建てで' }[L.family.tier]}育つ。`);
    if (L.family.tier === '低') add(L, 'learn', -4);
    if (L.family.tier === '高') add(L, 'learn', 5);
  }
  if (a === 1) say(L, `歩きはじめた。最初の言葉は「${pick(['まんま', 'ママ', 'パパ', 'わんわん', 'ブーブー'])}」。`);
  if (a === 2 && chance(0.7)) say(L, L.family.single ? '保育園に通いはじめた。母は朝から晩まで働いている。' : '保育園に通いはじめた。父も母も働いている。');
  if (a === 3) say(L, chance(0.5) ? `${pref.spots[0]}に連れて行ってもらった。覚えていない。` : `祖母によくなついた。`);
  if (a >= 2 && a <= 6) { const next = L.sibs.find(x => !x.born); if (next && chance(0.4)) { next.born = true; say(L, `${sibWord(next)}の${next.name}が生まれた。`, 'good'); add(L, 'bond', 3); } }
  if (a === 5) say(L, `七五三。母が写真館で記念写真を撮った。`);
  if (a === 6) { say(L, `小学校に入学した。担任は${pick(D.surnames)}先生。`, 'milestone'); L.stage = '小学生'; }
  if (a === 7 && !L.friend) { const fs = chance(0.7) ? L.sex : other(L.sex); L.friend = { name: pick(D.namesYoung[fs]), sex: fs }; say(L, `となりの席の${L.friend.name}と仲良くなった。友達になった。毎日いっしょに帰る。`, 'good'); add(L, 'bond', 5); }
  if (a === 8 && L.family.tier !== '低' && chance(0.8)) {
    const o = ['ピアノ', 'スイミング', 'そろばん', '英語', 'サッカー', '習字', 'ダンス'].sort(() => rnd() - 0.5).slice(0, 3);
    await decide(L, `母が「何か習い事をしてみる？」と言う。`, [
      ...o.map(x => ({ t: x, w: 25, f: () => { L.flags.lesson = x; like(L, x); tr(L, ['ピアノ', '習字', 'ダンス'].includes(x) ? '芸術' : ['そろばん', '英語'].includes(x) ? '頭脳' : '体力', 8); say(L, `${x}を習いはじめた。月謝は${irnd(6, 12)}千円。`); add(L, 'learn', ['ピアノ', 'そろばん', '英語', '習字'].includes(x) ? 5 : 2); add(L, 'health', ['スイミング', 'サッカー', 'ダンス'].includes(x) ? 4 : 0); } })),
      { t: 'やらない', d: '遊ぶ時間が増える', w: 25, f: () => { add(L, 'happy', 2); } },
    ]);
  }
  if (a === 10 && L.friend && chance(0.5)) await decide(L, `${fRef(L)}がクラスの子にからかわれている。`, [
    { t: 'かばう', w: 55, f: () => { say(L, `${fRef(L)}をかばった。自分も少しからかわれたが、${fRef(L)}とは一生の友達になった。`, 'good'); add(L, 'bond', 8); add(L, 'happy', 2); } },
    { t: '見て見ぬふり', w: 45, f: () => { say(L, '何も言えなかった。そのことを長く覚えている。'); add(L, 'happy', -4); add(L, 'bond', -3); } },
  ]);
  if (a === 10 && chance(0.6)) say(L, `運動会のリレーで${pick(['転んだ', 'アンカーを走った', '1位になった', '2位だった'])}。`);
  if (a === 12) { say(L, '中学校に入学した。制服が少し大きい。', 'milestone'); L.stage = '中学生'; }
  if (a === 13) {
    const sp = pick(['野球', 'サッカー', 'バスケ', 'バレー', '陸上', 'テニス', '卓球', '剣道']), cu = pick(['吹奏楽', '美術', '書道', '科学', '放送', '演劇']);
    await decide(L, '中学1年。部活はどうする？', [
      { t: `${sp}部`, d: '体力と仲間', w: 55, f: () => { L.flags.club = '運動部'; L.flags.clubName = sp; say(L, `${sp}部に入った。朝練がつらい。`); add(L, 'health', 4); add(L, 'bond', 4); tr(L, '体力', 12); tr(L, '社交', 4); like(L, sp); } },
      { t: `${cu}部`, d: '好きなことを深める', w: 25, f: () => { L.flags.club = '文化部'; L.flags.clubName = cu; say(L, `${cu}部に入った。`); add(L, 'learn', 3); add(L, 'bond', 3); tr(L, '芸術', 12); like(L, cu); } },
      { t: '入らない', d: '放課後は自由', w: 20, f: () => { L.flags.club = '帰宅部'; say(L, '部活には入らなかった。放課後はゲームと動画。'); add(L, 'learn', -1); add(L, 'happy', 2); } },
    ]);
  }
  if (a === 14 && chance(0.7)) {
    const ln = pick(D.namesYoung[other(L.sex)]); say(L, `初めて好きな人ができた。同じクラスの${ln}。`); add(L, 'happy', 4);
    await decide(L, `${ln}に気持ちを伝える？`, [
      { t: '告白する', w: 40, f: () => { tr(L, '社交', 4); if (chance(0.4)) { L.lover = { name: ln }; say(L, `OKだった。${ln}と付き合うことになった。`, 'good'); add(L, 'happy', 8); add(L, 'bond', 3); } else { say(L, `振られた。しばらく学校に行くのがつらかった。`, 'bad'); add(L, 'happy', -5); } } },
      { t: '言えない', w: 60, f: () => { say(L, '話しかけられないまま1年が過ぎた。'); } },
    ]);
  }
  if (a === 15) await decideHighSchool(L, pref);
  if (a === 18) await decideAfterHigh(L, pref);
  if (a === 20) {
    say(L, `はたちになった。${L.livePref}の成人式で${L.friend ? fRef(L) + 'と' : ''}再会した。`, 'milestone');
    if (chance(0.6)) await decide(L, `${L.friend ? fRef(L) : '友達'}にタバコを勧められた。`, [
      { t: '断る', w: L.sex === '男' ? 50 : 85, f: () => { } },
      { t: '吸ってみる', d: '習慣になるかもしれない', w: L.sex === '男' ? 50 : 15, f: () => { L.habits.smoke = true; say(L, 'タバコが習慣になった。月に1万円ほど煙になる。', 'bad'); } },
    ]);
    if (L.edu === '専門卒' && L.stage === '専門学生') { L.stage = '社会人'; await decideJob(L); }
  }
  if (((a === 22 && !L.flags.roninDone) || (a === 23 && L.flags.roninDone)) && L.stage === '大学生') {
    if (L.s.learn >= 80 && chance(0.25)) { say(L, '大学院に進んだ。研究室に泊まる日もある。'); L.stage = '大学院生'; }
    else { say(L, '大学を卒業した。', 'milestone'); L.edu = '大卒'; L.stage = '社会人'; await decideJob(L); }
  }
  if (a === (L.flags.roninDone ? 25 : 24) && L.stage === '大学院生') { say(L, '大学院を修了した。', 'milestone'); L.edu = '大学院卒'; L.stage = '社会人'; await decideJob(L); }

  /* --- 子ども時代の出来事 --- */
  if (a >= 7 && a <= 11) {
    const r = rnd();
    if (r < 0.08 && L.friend) { say(L, `${fRef(L)}の家に泊まった。夜中までゲーム。`, 'good'); add(L, 'bond', 3); add(L, 'happy', 3); }
    else if (r < 0.13) { say(L, '学校でいじめられた。誰にも言えなかった。', 'bad'); add(L, 'happy', -10); add(L, 'bond', -6); }
    else if (r < 0.20) { say(L, `${pick(['インフルエンザ', '肺炎', '骨折'])}で入院した。母が毎日来てくれた。`); add(L, 'health', -3); }
    else if (r < 0.28 && L.family.tier !== '低') { say(L, `${pick(['ピアノ', 'スイミング', '習字', '英語', 'サッカー', '公文'])}を習いはじめた。月謝は${irnd(6, 12)}千円。`); add(L, 'learn', 4); }
    else if (r < 0.34) { say(L, '本を読むのが好きになった。図書室の常連。'); add(L, 'learn', 5); tr(L, '頭脳', 8); like(L, '読書'); }
    else if (r < 0.40) { say(L, `家族で${pref.spots[1]}を見に行った。`, 'good'); add(L, 'happy', 3); }
    else if (r < 0.43 && !L.family.single) { say(L, `父の転勤で引っ越した。${L.friend ? fRef(L) + 'と別れた。' : ''}`); add(L, 'bond', -5); L.friend = null; }
    else if (r < 0.46 && !L.family.single) { say(L, `両親が離婚した。母と暮らすことになった。`, 'bad'); L.family.single = true; add(L, 'happy', -10); L.family.tier = L.family.tier === '高' ? '中' : '低'; }
    else if (r < 0.50) { L.pet = { name: pick(D.petNames), kind: pick(['犬', '猫', 'ハムスター', '金魚']) }; say(L, `${L.pet.kind}を飼いはじめた。名前は${L.pet.name}。`, 'good'); add(L, 'happy', 4); }
  }
  if (a >= 13 && a <= 17 && L.stage !== '社会人') {
    const r = rnd();
    if (r < 0.08) { say(L, 'スマホを持った。夜中まで見るようになった。'); add(L, 'health', -2); add(L, 'bond', 2); }
    else if (r < 0.15) { const ln = pick(D.namesYoung[other(L.sex)]); L.lover = { name: ln }; say(L, `${ln}と付き合いはじめた。初めての恋人。`, 'good'); add(L, 'happy', 6); }
    else if (r < 0.19 && L.lover) { say(L, `${lRef(L)}に振られた。`, 'bad'); L.lover = null; add(L, 'happy', -6); }
    else if (r < 0.23) { say(L, '自転車で車と接触した。幸い軽いけが。'); add(L, 'health', -3); }
    else if (r < 0.29 && a >= 16 && !L.flags.baitoAsked) { L.flags.baitoAsked = true; await decide(L, `${pick(['コンビニ', 'ファミレス', 'スーパー', '塾'])}のバイト募集。やる？`, [
      { t: 'やる', d: '月5万円', w: 55, f: () => { tr(L, '社交', 5); tr(L, 'お金', 5); say(L, `バイトをはじめた。時給${irnd(10, 12)}00円。初任給で${pick(['スニーカー', 'ゲーム機', '親へのプレゼント', 'ライブのチケット'])}を買った。`, 'good'); add(L, 'bond', 2); add(L, 'learn', -2); L.money += 40; } },
      { t: '学校に集中する', w: 45, f: () => { add(L, 'learn', 3); } },
    ]); }
    else if (r < 0.33) { say(L, '学校に行けない時期があった。', 'bad'); add(L, 'happy', -8); add(L, 'learn', -4); }
    else if (r < 0.38) { say(L, L.flags.club === '運動部' ? `${L.flags.clubName}で県大会に出た。` : '文化祭で主役をやった。', 'good'); add(L, 'happy', 5); add(L, 'bond', 3); }
    else if (r < 0.42) { say(L, `${pick(['数学', '英語', '物理', '世界史'])}の${pick(D.surnames)}先生の授業が好きだった。`); add(L, 'learn', 3); }
    if (a === 17 && L.flags.club === '運動部' && !L.flags.lastAsked) { L.flags.lastAsked = true; await decide(L, `高3の夏。${L.flags.clubName}部の最後の大会と受験勉強が重なる。`, [
      { t: '最後まで部活をやり切る', w: 50, f: () => { say(L, `最後の大会は${pick(['初戦で負けた', '県大会ベスト8', '決勝で負けた'])}。泣いた。`, 'good'); add(L, 'happy', 6); add(L, 'bond', 4); add(L, 'learn', -2); } },
      { t: '引退して受験に集中', w: 50, f: () => { add(L, 'learn', 6); add(L, 'happy', -2); tr(L, '頭脳', 6); } },
    ]); }
  }

  /* --- 大学・専門時代 --- */
  if (['大学生', '専門学生', '大学院生'].includes(L.stage) && a >= 19) {
    if (a === 19 && !L.flags.campusAsked) { L.flags.campusAsked = true; await decide(L, '学生生活、何に時間を使う？', [
      { t: 'サークルと友達', w: 35, f: () => { const fs = chance(0.7) ? L.sex : other(L.sex); L.friend = { name: pick(D.namesYoung[fs]), sex: fs }; const ck = pick(['テニス', '軽音', '映画', 'ボランティア', 'フットサル']); like(L, ck); tr(L, '社交', 10); say(L, `${ck}サークルで${L.friend.name}と出会った。`, 'good'); add(L, 'bond', 8); add(L, 'happy', 4); } },
      { t: '勉強と資格', w: 25, f: () => { tr(L, '頭脳', 10); say(L, `${pick(['簿記', 'TOEIC', 'プログラミング', '教員免許'])}の勉強に打ち込んだ。`); add(L, 'learn', 8); } },
      { t: 'バイト漬け', d: 'お金は貯まる', w: 25, f: () => { tr(L, 'お金', 8); say(L, '週5でバイト。学費と生活費を自分で。'); L.money += 120; add(L, 'health', -3); add(L, 'learn', -2); } },
      { t: '海外へ', d: '留学・バックパック', w: 15, f: () => { tr(L, '社交', 5); tr(L, '頭脳', 5); like(L, '旅'); say(L, `${pick(['カナダ', 'オーストラリア', '台湾', 'ドイツ'])}へ半年。世界が広がった。`, 'good'); add(L, 'learn', 8); add(L, 'happy', 5); L.money -= 100; } },
    ]); }
    const r = rnd();
    if (r < 0.15) { const fs = chance(0.7) ? L.sex : other(L.sex); L.friend = { name: pick(D.namesYoung[fs]), sex: fs }; say(L, `${pick(['サークル', 'ゼミ', 'バイト先'])}で${L.friend.name}と出会った。一生の友達になる。`, 'good'); add(L, 'bond', 6); }
    else if (r < 0.20) { say(L, `半年、${pick(['カナダ', 'オーストラリア', '韓国', 'フィリピン'])}に留学した。`); add(L, 'learn', 8); add(L, 'happy', 5); L.money -= 100; }
    else if (r < 0.27) { const ln = pick(D.namesYoung[other(L.sex)]); L.lover = { name: ln }; say(L, `${ln}と付き合いはじめた。`, 'good'); add(L, 'happy', 6); }
    else if (r < 0.31) { say(L, 'ほとんど授業に出なかった。単位が危ない。'); add(L, 'learn', -4); }
    else if (r < 0.37) { say(L, 'バイトと授業で手いっぱいの一年。'); L.money += 60; add(L, 'health', -2); }
    if (a === 21 && L.stage === '大学生') say(L, '就職活動がはじまった。スーツで何十社も回った。');
  }

  if (a === 22 && L.lover && chance(0.5)) { say(L, `${lRef(L)}とは、就職を機に自然と離れていった。`); L.lover = null; }
  /* --- 働く --- */
  if (L.working) await workYear(L, pref);

  /* --- 結婚・家族 --- */
  await familyYear(L, pref);

  /* --- お金の決断 --- */
  await moneyDecisions(L, pref);
  await lifeDecisions(L, pref);

  /* --- 健康の節目 --- */
  if (a === 35 && chance(0.6)) await decide(L, '健康診断で血圧と血糖が高めだと言われた。', [
    { t: '運動と食事を変える', d: '長く効く', w: 45, f: () => { L.habits.exercise = true; add(L, 'health', 6); tr(L, '体力', 8); like(L, 'ランニング'); say(L, '週に2回走るようになった。体重が4キロ落ちた。', 'good'); } },
    { t: '今は気にしない', w: 55, f: () => { add(L, 'health', -3); } },
  ]);
  if (a === 50) await decide(L, 'がん検診の案内が届いた。', [
    { t: '受ける', w: 50, f: () => { L.flags.screening = true; if (chance(0.08)) { say(L, '早期のがんが見つかった。手術で取り切れた。', 'bad'); add(L, 'health', -6); L.money -= 50; } } },
    { t: '忙しいから後で', w: 50, f: () => { } },
  ]);
  if (L.habits.smoke && a >= 40 && chance(0.08)) await decide(L, 'せきが止まらない。医者に禁煙を勧められた。', [
    { t: '禁煙する', w: 50, f: () => { L.habits.smoke = false; say(L, 'タバコをやめた。', 'good'); add(L, 'health', 4); } },
    { t: 'やめられない', w: 50, f: () => { add(L, 'health', -4); } },
  ]);

  /* --- 大人の出来事 --- */
  if (a >= 25 && a < 65) {
    const r = rnd();
    if (r < 0.04) { say(L, `${pick(['ぎっくり腰', '帯状疱疹', 'うつ', '胃潰瘍', 'ヘルニア'])}になった。しばらく休んだ。`, 'bad'); add(L, 'health', -6); add(L, 'happy', -4); }
    else if (r < 0.08) { L.flags.hobby = pick(['釣り', '登山', 'キャンプ', 'ランニング', '料理', 'ギター', 'ゴルフ', '推し活', '家庭菜園', 'サウナ']); say(L, `${L.flags.hobby}が趣味になった。`, 'good'); add(L, 'happy', 5); }
    else if (r < 0.10 && !L.pet) { L.pet = { name: pick(D.petNames), kind: chance(0.5) ? '犬' : '猫' }; like(L, L.pet.kind); say(L, `${L.pet.kind}を飼いはじめた。名前は${L.pet.name}。`, 'good'); add(L, 'happy', 4); add(L, 'health', 2); }
    else if (r < 0.13) { like(L, '旅行'); say(L, `${L.friend ? fRef(L) + 'と' : '友達と'}${pick(['沖縄', '北海道', '韓国', '台湾', 'ハワイ'])}に旅行した。`, 'good'); add(L, 'happy', 4); L.money -= 20; }
    else if (r < 0.15 && L.friend) { say(L, `${fRef(L)}と疎遠になった。最後に会ったのがいつか思い出せない。`); add(L, 'bond', -5); }
    else if (r < 0.17) { say(L, 'SNSで知り合った人たちと会うようになった。'); add(L, 'bond', 4); }
    else if (r < 0.19 && L.friend) { say(L, `${fRef(L)}の結婚式でスピーチをした。`, 'good'); add(L, 'bond', 3); L.money -= 5; }
    else if (r < 0.21 && L.pet && a - 10 > 0 && chance(0.5)) { say(L, `${L.pet.kind}の${L.pet.name}が死んだ。${irnd(12, 16)}年いっしょだった。`, 'bad'); L.pet = null; add(L, 'happy', -7); }
  }

  /* --- 災害 --- */
  if (pref.hazards.includes('地震') && chance(0.006)) { say(L, '大きな地震が起きた。家の中はめちゃくちゃになった。', 'bad'); add(L, 'happy', -8); L.money -= L.home === '持ち家' ? 300 : 50; if (L.home === '持ち家') L.homeValue *= 0.8; if (chance(0.02)) L.cause = '地震'; }
  if (pref.hazards.includes('台風') && chance(0.02)) { say(L, '台風で屋根が飛んだ。修理に50万円。'); L.money -= 50; add(L, 'happy', -3); }
  if (pref.hazards.includes('雪') && chance(0.03)) { say(L, pick(['大雪で3日間、家から出られなかった。', '雪かきで腰をやった。', '記録的な大雪。駅で一晩過ごした。'])); add(L, 'health', -1); }
  if (pref.hazards.includes('火山') && chance(0.02)) say(L, '桜島の灰で洗濯物が真っ黒になった。');
  if (pref.hazards.includes('津波') && chance(0.002)) { say(L, '津波警報。高台へ走った。', 'bad'); add(L, 'happy', -8); if (chance(0.03)) L.cause = '津波'; }

  /* --- 老い --- */
  await elderYear(L, pref);

  /* --- 祖父母・親 --- */
  for (const g of L.grands) {
    if (!g.alive) continue;
    const ga = g.ageAtBirth + a;
    if (chance(qx(ga, g.role === '祖母' ? '女' : '男'))) { g.alive = false; say(L, `${g.role}が亡くなった。${ga}歳だった。${a < 20 ? '初めてのお葬式。' : ''}`, 'bad'); add(L, 'happy', a < 25 ? -8 : -4); }
  }
  for (const p of L.parents) {
    if (!p.alive) continue;
    const pa = p.ageAtBirth + a;
    if (chance(qx(pa, p.role === '母' ? '女' : '男') * 1.15)) {
      p.alive = false;
      say(L, `${p.role}が亡くなった。${pa}歳だった。`, 'bad'); add(L, 'happy', a < 30 ? -14 : -9); add(L, 'bond', -4);
      if (L.flags.caring === p.role) L.flags.caring = null;
      inherit(L, p);
    }
  }

  /* --- お金 --- */
  moneyYear(L, pref);

  /* --- 数値の自然な動き --- */
  if (a >= 40) add(L, 'health', -(0.4 + (a - 40) * 0.035) + (L.habits.exercise ? 0.3 : 0) - (L.habits.smoke ? 0.6 : 0));
  if (a >= 25 && a <= 60 && L.working) add(L, 'learn', 0.3);
  if (a >= 65) add(L, 'learn', -0.3);
  const nw = netWorth(L);
  const base = 50 + (L.s.bond - 50) * 0.35 + (L.s.health - 50) * 0.3 + (nw > 1000 ? 6 : nw > 300 ? 3 : nw < -200 ? -8 : 0) + (L.partner?.alive ? 4 : 0);
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
  L.hist.push({ age: a, s: { ...L.s }, net: Math.round(netWorth(L)), money: Math.round(L.money), inv: Math.round(L.inv) });
  L.peakNet = Math.max(L.peakNet, netWorth(L));
  if (L.cause) { die(L); return; }
  L.map.push(Math.round(L.s.happy));
}

function pickCause(L) {
  const band = D.causes.find(c => L.age <= c.max);
  const w = { ...band.w };
  if (L.habits.smoke) for (const k of Object.keys(w)) if (/がん|心臓|脳/.test(k)) w[k] *= 1.6;
  if (L.flags.screening) for (const k of Object.keys(w)) if (/がん/.test(k)) w[k] *= 0.75;
  if (L.s.happy < 25 && w['自殺']) w['自殺'] *= 2.5;
  if (L.s.happy > 70 && w['自殺']) w['自殺'] *= 0.4;
  if (L.gentle) for (const k of D.heavyCauses) delete w[k];
  if (!Object.keys(w).length) return '病気';
  return weighted(w);
}
function die(L) {
  L.alive = false; L.map.push(Math.round(L.s.happy));
  const c = L.cause;
  const who = L.partner?.alive ? pRef(L) : L.kids.length ? kRef(L.kids[0]) : L.friend ? fRef(L) : null;
  const line = c === '老衰' ? `${L.age}歳、眠るように亡くなった。${who ? who + 'が手を握っていた。' : ''}` : `${L.age}歳で亡くなった。${/事故|地震|津波|殺人/.test(c) ? c + 'だった' : c + 'が原因だった'}。`;
  say(L, line, 'death');
}

/* ---------- 進学 ---------- */
async function decideHighSchool(L, pref) {
  await decide(L, '中学を卒業する。高校はどうする？', [
    { t: '普通科に進む', w: 70 + L.s.learn / 2, f: () => { L.stage = '高校生'; L.flags.hs = '普通科'; say(L, `${pick(['県立', '市立', '私立'])}${pick(D.surnames).slice(0, 1)}${pick(['北', '南', '東', '西', '中央', '第一'])}高校の普通科に入った。${L.friend ? fRef(L) + 'とは別の高校になった。' : ''}`, 'milestone'); } },
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
      if (pref.urban < 0.7 && chance(0.4)) where = ['近畿', '中国', '四国'].includes(pref.region) ? pick(['大阪府', '京都府']) : ['九州', '沖縄'].includes(pref.region) ? pick(['福岡県', '東京都']) : '東京都';
      if (where !== L.livePref) { L.livePref = where; L.home = '一人暮らし'; say(L, `${where}の大学に合格した。親元を離れて家賃${irnd(5, 8)}万円の一人暮らし。`, 'milestone'); add(L, 'bond', -3); }
      else say(L, '地元の大学に合格した。', 'milestone');
      if (L.family.tier !== '高' && chance(0.5)) { L.debt += 300; say(L, '学費は奨学金。卒業後に300万円を返していく。'); }
      add(L, 'learn', 8); tr(L, '頭脳', 10);
    } },
    { t: '専門学校に進む', d: '2年で資格をとる', w: 22, f: () => { L.stage = '専門学生'; L.edu = '専門卒'; say(L, `${pick(['看護', '保育', '美容', '調理', 'IT', 'デザイン', '自動車整備', '医療事務'])}の専門学校に入った。`, 'milestone'); add(L, 'learn', 4); tr(L, 'ものづくり', 6); if (L.family.tier === '低' && chance(0.5)) { L.debt += 150; say(L, '学費の一部は奨学金で。'); } } },
    { t: '就職する', w: 15 + (L.flags.hs === '専門学科' ? 20 : 0), f: async () => { L.stage = '社会人'; await decideJob(L); } },
    { t: '浪人する', d: 'もう1年がんばる', w: 3, f: () => { L.stage = '浪人'; say(L, '予備校に通うことになった。'); add(L, 'learn', 5); } },
  ]);
}
async function ronin(L) { if (L.stage === '浪人') { L.stage = '大学生'; say(L, '1年遅れで大学に合格した。', 'milestone'); L.flags.roninDone = true; } }

/* ---------- 仕事 ---------- */
async function decideJob(L, q = '仕事を選ぶ。') {
  const opts = jobOptions(L);
  await decide(L, q, opts.map(j => ({ t: j.name, d: `${j.field}・正社員になれる確率 ${Math.round(j.regular * 100)}%`, w: 1, f: () => setJob(L, j) })));
}
function setJob(L, j) {
  L.job = j; L.working = true; L.retired = false;
  const pr = j.regular + (eduRank(L.edu) >= 3 ? 0.1 : 0) - (L.age > 45 ? 0.2 : 0);
  L.regular = chance(pr);
  if (['フリーランス', '会社の経営者', '農家', '漁師'].includes(j.name)) L.regular = j.name !== 'フリーランス';
  L.flags.promoted = false; L.flags.promoted2 = false; L.flags.jobStart = L.age;
  L.boss = { name: pick(D.surnames) };
  tr(L, ['製造', '建設', '農林水産'].includes(j.field) ? 'ものづくり' : ['IT', '研究', '金融', '事務'].includes(j.field) ? '頭脳' : '社交', 8);
  if (j.name === '会社の経営者' || j.name === 'フリーランス') tr(L, 'お金', 8);
  const s = salaryOf(L);
  say(L, `${L.regular ? '正社員' : j.name === 'フリーランス' ? '個人事業主' : '契約・パート'}として${j.name}になった。年収は${yen(s)}。上司は${L.boss.name}さん。`, 'milestone');
}
async function workYear(L, pref) {
  const a = L.age, j = L.job;
  const years = a - (L.flags.jobStart || a);
  if (years === 1 && chance(0.5)) say(L, pick(['仕事を覚えるのに必死の一年。', '毎日くたくた。でも給料日はうれしい。', `上司の${L.boss.name}さんに怒られながら覚えた。`, '初めてのボーナスで親に食事をごちそうした。']));
  const r = rnd();
  if (r < 0.05 && j.health <= -1) { say(L, '残業が月80時間。体を壊した。'); add(L, 'health', -5); add(L, 'happy', -4); }
  else if (r < 0.09 && L.regular && a >= 30 && a <= 50 && !L.flags.promoted && !(L.flags.promoBlock && chance(0.5))) { L.flags.promoted = true; say(L, `${pick(['主任', '係長', '班長', 'リーダー', '店長'])}になった。年収${yen(salaryOf(L))}。`, 'good'); add(L, 'happy', 5); add(L, 'learn', 3); }
  else if (r < 0.105 && L.regular && a >= 40 && a <= 55 && L.flags.promoted && !L.flags.promoted2) { L.flags.promoted2 = true; say(L, `${pick(['課長', '部長', '工場長', 'マネージャー'])}になった。年収${yen(salaryOf(L))}。部下は${irnd(5, 30)}人。`, 'good'); add(L, 'happy', 4); add(L, 'health', -2); }
  else if (r < 0.125 && a >= 25 && a < 55 && (L.flags.moves || 0) < 2 + rnd() * 2) {
    await decide(L, `${pick(['知り合い', '取引先', '転職サイト'])}から誘いが来た。${pick(['条件はいまより少し上', '仕事はきついが給料は上', '給料は同じで家から近い'])}。`, [
      { t: '転職する', w: 40, f: async () => { L.flags.moves = (L.flags.moves || 0) + 1; say(L, '転職を決めた。', 'milestone'); await decideJob(L, '次の仕事を選ぶ。'); } },
      { t: 'いまの職場に残る', w: 60, f: () => { add(L, 'bond', 1); } },
    ]);
  }
  else if (r < 0.14 && chance(L.regular ? 0.6 : 1) && a < 60) { say(L, L.regular ? '会社が倒産した。' : '契約を切られた。', 'bad'); add(L, 'happy', -10); L.working = false; L.flags.jobless = 1; }
  else if (r < 0.155 && a >= 28 && a <= 50 && L.s.learn >= 55 && chance(0.5)) {
    await decide(L, pick(['独立しないか、と言われた。', '自分で店をやりたい気持ちが強くなった。', '副業の収入が本業に近づいた。']), [
      { t: '独立する', d: '収入は不安定、自由は増える', w: 25, f: () => { setJob(L, jobByName(chance(0.5) ? '会社の経営者' : 'フリーランス')); add(L, 'happy', 6); if (chance(0.35)) { say(L, '最初の2年は赤字。貯金が300万円減った。', 'bad'); L.money -= 300; } } },
      { t: 'いまのまま', w: 75, f: () => { } },
    ]);
  }
  else if (r < 0.175) { say(L, pick(['職場に気の合う仲間ができた。', '後輩を育てる立場になった。', '仕事で表彰された。', `上司の${L.boss.name}さんに「任せる」と言われた。`]), 'good'); add(L, 'bond', 3); add(L, 'happy', 3); }
  else if (r < 0.195) { say(L, pick([`上司の${L.boss.name}さんと合わない。毎朝が重い。`, '人手不足で休みが取れない。', '給料が3年上がっていない。']), 'bad'); add(L, 'happy', -5); }
  if (j.field === '製造' && years === 3 && chance(0.4)) { say(L, '機械を一人で任されるようになった。', 'good'); add(L, 'learn', 4); tr(L, 'ものづくり', 8); }
}
async function joblessYear(L) {
  if (L.flags.jobless) { L.flags.jobless++; if (L.flags.jobless >= 2) { L.flags.jobless = 0; const nj = pick(jobOptions(L, 3, L.job && chance(0.5) ? L.job.field : null)); say(L, '半年の失業を経て、次の仕事が見つかった。'); setJob(L, nj); } }
}

/* ---------- 結婚・子ども ---------- */
async function familyYear(L, pref) {
  const a = L.age;
  if (L.stage === '浪人') await ronin(L);
  if (!L.working && !L.retired && L.stage === '社会人' && a < 65) await joblessYear(L);

  if (!L.partner && a >= 22 && a <= 48 && !L.lover) {
    const m = D.marriage;
    const peak = L.sex === '男' ? m.meanAgeMale : m.meanAgeFemale;
    let p = 0.185 * Math.exp(-Math.pow((a - peak) / 7, 2)) * (L.s.bond / 55) * (L.money > 100 || L.sex === '女' ? 1 : 0.7) * (L.working || L.sex === '女' ? 1 : 0.6);
    if (L.flags.divorced) p *= 0.6;
    if (chance(p)) { const ln = pick(D.namesYoung[other(L.sex)]); L.lover = { name: ln, job: pick(JOBS).name, age: a + irnd(-4, 3) }; say(L, `${pick(['職場', '友達の紹介', 'アプリ', '学生時代からの縁', '趣味の集まり'])}で${ln}（${L.lover.age}歳・${L.lover.job}）と付き合いはじめた。`, 'good'); add(L, 'happy', 6); }
  } else if (L.lover && !L.partner && a >= 22) {
    if (chance(0.55)) {
      const ln = L.lover.name;
      await decide(L, L.sex === '男' ? `恋人の${ln}にプロポーズするか、迷っている。` : `恋人の${ln}にプロポーズされた。`, [
        { t: '結婚する', w: 70, f: () => {
          L.partner = { name: ln, alive: true, age: L.lover.age || a + irnd(-3, 3), job: L.lover.job || pick(JOBS).name, works: chance(L.sex === '男' ? 0.7 : 0.95), since: a };
          L.lover = null; if (L.home !== '持ち家') L.home = '賃貸';
          say(L, `恋人の${ln}と結婚した。今日から${L.sex === '男' ? '妻' : '夫'}の${ln}。`, 'milestone'); add(L, 'happy', 12); add(L, 'bond', 10);
          L.flags.weddingAsk = true;
        } },
        { t: 'まだ結婚はしない', w: 30, f: () => { if (chance(0.5)) { say(L, `その後、恋人の${ln}とは別れた。`, 'bad'); L.lover = null; add(L, 'happy', -6); } } },
      ]);
    } else if (chance(0.25)) { say(L, `${lRef(L)}と別れた。`, 'bad'); L.lover = null; add(L, 'happy', -6); }
  }

  if (L.flags.weddingAsk) { L.flags.weddingAsk = false; await decide(L, '結婚式はどうする？', [
    { t: 'ホテルで盛大に', d: '300万円・親戚も友達も', w: 30, f: () => { say(L, `${pref.spots[0]}の近くのホテルで式。${irnd(60, 100)}人が来た。ご祝儀で半分戻って、持ち出しは150万円。`, 'good'); L.money -= 150; add(L, 'bond', 6); add(L, 'happy', 4); } },
    { t: '家族だけで小さく', d: '60万円', w: 40, f: () => { say(L, `${pick(['小さなチャペル', '地元の神社', '海の見えるレストラン'])}で家族だけの式。`, 'good'); L.money -= 60; add(L, 'happy', 4); } },
    { t: '写真だけ', d: '浮いたお金は新婚旅行に', w: 30, f: () => { say(L, `式はせず写真だけ。浮いたお金で${pick(['沖縄', 'ハワイ', 'イタリア', '北海道'])}へ新婚旅行。`); L.money -= 40; add(L, 'happy', 3); } },
  ]); }
  if (L.partner && L.partner.alive && !L.flags.kidsAsked && a >= 24) { L.flags.kidsAsked = true; await decide(L, `${pRef(L)}と子どもの話をした。`, [
    { t: '早く欲しい', w: 50, f: () => { L.flags.kidsWant = 1.4; } },
    { t: 'もう少し二人で', w: 35, f: () => { L.flags.kidsWant = 0.7; } },
    { t: '持たないでいい', w: 15, f: () => { L.flags.kidsWant = 0.15; say(L, '二人で生きていくことにした。'); } },
  ]); }
  if (L.partner && L.partner.alive) {
    const momAge = L.sex === '女' ? a : L.partner.age + (a - L.partner.since);
    if (L.kids.length < 3 && momAge >= 22 && momAge <= 42) {
      let p = (L.kids.length === 0 ? 0.30 : L.kids.length === 1 ? 0.22 : 0.07) * (L.flags.kidsWant || 1);
      if (momAge > 36) p *= 0.5; if (netWorth(L) < -100) p *= 0.6;
      if (chance(p)) {
        const ks = chance(0.513) ? '男' : '女'; const cands = [...D.namesYoung[ks]].sort(() => rnd() - 0.5).slice(0, 3);
        const k = { born: a, sex: ks, name: cands[0] }; L.kids.push(k);
        say(L, `${['第一子', '第二子', '第三子'][L.kids.length - 1]}が生まれた。${ks}の子、${irnd(2600, 3600)}グラム。`, 'milestone'); add(L, 'happy', 10); add(L, 'bond', 6); add(L, 'health', -2);
        await decide(L, '名前を決める。', cands.map(n => ({ t: n, w: 1, f: () => { k.name = n; say(L, `名前は${n}にした。`); } })));
      }
    }
    if (chance(D.marriage.divorceYearly * (L.s.happy < 40 ? 1.8 : 1))) {
      const half = Math.max(0, Math.round((L.money + L.inv) * 0.5));
      say(L, `${pRef(L)}と離婚した。財産分与で${yen(half)}を渡した。`, 'bad'); add(L, 'happy', -14); add(L, 'bond', -8); L.money -= half * (L.money / Math.max(1, L.money + L.inv)); L.inv -= half * (L.inv / Math.max(1, L.money + L.inv));
      L.flags.divorced = true; L.partner = null;
      if (L.kids.length && L.sex === '男') say(L, `子どもは母親と暮らすことになった。養育費は月${irnd(3, 6)}万円。`);
    }
  }
  for (const k of L.kids) {
    const ka = a - k.born;
    if (ka === 6 && chance(0.6)) say(L, `${kRef(k)}が小学校に入った。ランドセルは${pick(['祖父母', L.partner ? pRef(L) : '自分'])}が買った。`);
    if (ka === 13 && chance(0.4)) say(L, `${kRef(k)}が反抗期。口をきいてくれない。`);
    if (ka === 12 && !k.jukuAsked) { k.jukuAsked = true; await decide(L, `${kRef(k)}が中学に上がる。塾に通わせる？`, [
      { t: '通わせる', d: '年40万円', w: 55, f: () => { k.juku = true; say(L, `${kRef(k)}を塾に入れた。送り迎えの日々。`); L.money -= 40; } },
      { t: '本人に任せる', w: 45, f: () => { } },
    ]); }
    if (ka === 15 && chance(0.5)) await decide(L, `${kRef(k)}の高校受験。${k.juku ? '塾の先生は「上を狙える」と言う。' : ''}`, [
      { t: '私立も受けさせる', d: '学費は年100万円', w: 40, f: () => { say(L, `${kRef(k)}は${chance(0.7) ? '私立に受かった。学費が重い。' : '公立に進んだ。'}`); L.money -= 100; } },
      { t: '公立一本', w: 60, f: () => { say(L, `${kRef(k)}は${chance(0.85) ? '公立に受かった。' : '滑り止めがなく、定時制に通うことになった。'}`); } },
    ]); 
    if (ka === 18) { const u = chance(0.6); say(L, `${kRef(k)}が${u ? '大学に進んだ' : '就職した'}。${u ? '入学金と学費で初年度150万円。' : ''}`); if (u) { L.money -= 150; k.univ = true; } }
    if (ka === 22 && chance(0.5)) say(L, `${kRef(k)}が家を出た。部屋が静かになった。`);
    if (ka >= 26 && ka <= 36 && !k.married && chance(0.15)) { k.married = true; const pn = pick(D.namesYoung[other(k.sex)]); say(L, `${kRef(k)}が${pn}さんと結婚した。${chance(0.5) ? '結婚資金として100万円を渡した。' : ''}`, 'good'); add(L, 'happy', 6); if (chance(0.5)) L.money -= 100; }
    if (k.married && ka >= 27 && ka <= 40 && L.grandkids.length < 4 && chance(0.2)) { const gs = chance(0.5) ? '男' : '女'; const g = { name: pick(D.namesYoung[gs]), born: a }; L.grandkids.push(g); say(L, `${kRef(k)}に${gs}の子が生まれた。${L.grandkids.length === 1 ? '初めての孫、' : ''}名前は${g.name}。`, 'good'); add(L, 'happy', 8); add(L, 'bond', 4); }
  }
  if (L.home !== '持ち家' && a >= 29 && a <= 42 && (L.partner || L.money > 600) && !L.flags.homeAsked && chance(0.5)) {
    L.flags.homeAsked = true;
    const price = Math.round((pref.urban >= 0.8 ? 4800 : 3200) * pref.income / 100) * 100;
    const kind = pref.urban >= 0.8 ? 'マンション' : '一戸建て';
    await decide(L, `家を買うか考えている。${kind}で${yen(price)}。${pref.urban >= 0.8 ? 'このあたりは高い。' : '郊外なら庭つき。'}`, [
      { t: '買う', d: `頭金${yen(Math.min(300, Math.max(0, L.money)))}・残りは35年ローン`, w: 68, f: () => { const down = Math.min(300, Math.max(0, L.money)); L.home = '持ち家'; L.homeValue = price; L.loan = price - down; L.loanYears = 35; L.money -= down; L.flags.homeKind = kind; L.flags.homeAge = a; say(L, `${kind}を買った。ローンは月${Math.round(L.loan / 35 / 12 * 10) / 10}万円、35年。`, 'milestone'); add(L, 'happy', 6); } },
      { t: '賃貸のままでいい', w: 32, f: () => { L.home = '賃貸'; } },
    ]);
  }
  if (L.flags.homeAge && a - L.flags.homeAge === 20 && chance(0.6)) { say(L, `家のリフォーム。水回りで${irnd(150, 300)}万円。`); L.money -= 200; L.homeValue += 100; }
  for (const p of L.parents) {
    const pa = p.ageAtBirth + a;
    if (p.alive && pa >= 82 && !L.flags.careAsked && chance(0.25)) {
      L.flags.careAsked = true;
      await decide(L, `${p.role}に介護が必要になった。`, [
        { t: '自分が中心になって見る', d: '時間とお金がかかる', w: 35, f: () => { L.flags.caring = p.role; add(L, 'bond', 5); add(L, 'health', -5); add(L, 'happy', -4); L.money -= 150; say(L, `${p.role}の介護で、仕事と実家の往復の日々。`); } },
        { t: '施設に頼む', d: '月15万円ほど', w: 40, f: () => { L.money -= 300; say(L, `${p.role}は施設に入った。週末に会いに行く。`); } },
        { t: '兄弟や親戚に任せる', w: L.sibs.length ? 25 : 2, f: () => { add(L, 'bond', -6); add(L, 'happy', -3); if (L.sibs.length) say(L, `${sibWord(L.sibs[0])}の${L.sibs[0].name}が見ることになった。少し気まずい。`); } },
      ]);
    }
  }
}

/* ---------- 老い ---------- */
async function elderYear(L, pref) {
  const a = L.age;
  if (a === 60 && L.working) {
    const retire = L.regular ? Math.round(Math.min(2200, 300 + (a - (L.flags.firstJob || 22)) * 45) * (L.flags.promoted2 ? 1.3 : 1)) : 0;
    await decide(L, `60歳。定年を迎えた。${retire ? `退職金は${yen(retire)}。` : ''}この先は？`, [
      { t: '再雇用で働き続ける', d: '給料は6割', w: 55, f: () => { L.flags.rehired = true; L.money += retire; say(L, `同じ職場で嘱託として働くことにした。${retire ? '退職金' + yen(retire) + 'が振り込まれた。' : ''}`, 'milestone'); } },
      { t: '仕事を辞めてのんびりする', w: 30, f: () => { L.working = false; L.retired = true; L.money += retire; say(L, `仕事を辞めた。${retire ? '退職金' + yen(retire) + '。' : ''}朝ゆっくり起きる。`, 'milestone'); add(L, 'happy', 5); add(L, 'bond', -4); } },
      { t: '新しいことをはじめる', d: '店、畑、ボランティア', w: 15, f: () => { L.working = false; L.retired = true; L.money += retire; say(L, `退職して、${pick(['小さな畑', '週3日のボランティア', '趣味の教室', '地域のサークル'])}をはじめた。`, 'milestone'); add(L, 'happy', 8); add(L, 'bond', 6); } },
    ]);
  }
  if (a === 65) {
    if (L.working && !['会社の経営者', 'フリーランス', '農家', '漁師'].includes(L.job.name)) { L.working = false; L.retired = true; say(L, '65歳で仕事を終えた。年金暮らしがはじまる。', 'milestone'); }
    else if (!L.working) say(L, '年金が入るようになった。');
    L.flags.pension = true;
    const amt = (L.job && (L.regular || L.flags.promoted)) ? 180 : L.job ? 110 : 70;
    L.flags.pensionAmt = amt;
    say(L, `年金は年${yen(amt)}${L.partner?.alive ? '、夫婦で' + yen(amt + 80) : ''}。貯金${yen(L.money)}、投資${yen(L.inv)}。`);
  }
  if (a >= 66 && a <= 80) {
    const r = rnd();
    if (r < 0.06) { say(L, pick(['毎朝、近所を散歩する。', '地域の集まりに顔を出すようになった。', `${L.friend ? fRef(L) + 'と' : '昔の仲間と'}年に一度集まる。`]), 'good'); add(L, 'bond', 4); add(L, 'health', 1); }
    else if (r < 0.10) { say(L, pick(['膝が痛くて階段がつらい。', '白内障の手術をした。', '血圧の薬が増えた。'])); add(L, 'health', -3); }
    else if (r < 0.13 && L.partner?.alive) { say(L, `${pRef(L)}と${pick(['温泉', pref.spots[0], '孫の運動会'])}に行った。`, 'good'); add(L, 'happy', 5); }
    else if (r < 0.15 && !L.partner && !L.kids.length) { say(L, '一人の時間が長い。'); add(L, 'bond', -4); add(L, 'happy', -3); }
    else if (r < 0.17 && L.grandkids.length) { say(L, `${gRef(L.grandkids[0])}にお年玉。${irnd(5, 10)}千円。`, 'good'); add(L, 'happy', 3); }
  }
  if (a === 75 && pref.urban < 0.6 && !L.flags.licenseAsked) {
    L.flags.licenseAsked = true;
    await decide(L, '75歳。運転免許をどうするか。', [
      { t: '返納する', d: '買い物が不便になる', w: 40, f: () => { L.flags.noCar = true; add(L, 'bond', -3); say(L, '免許を返した。バスの時間を調べる生活。'); } },
      { t: 'まだ運転する', w: 60, f: () => { if (chance(0.1)) { say(L, '駐車場で車をぶつけた。'); add(L, 'happy', -3); L.money -= 20; } } },
    ]);
  }
  if (L.partner && L.partner.alive) {
    const pAge = L.partner.age + (a - L.partner.since);
    if (chance(qx(pAge, other(L.sex)))) { L.partner.alive = false; say(L, `${pRef(L)}が亡くなった。${pAge}歳だった。${a - L.partner.since}年いっしょにいた。`, 'bad'); add(L, 'happy', -18); add(L, 'bond', -8); add(L, 'health', -3); }
  }
  if (a >= 78 && !L.flags.care && chance(0.02 + (a - 78) * 0.012 + (L.s.health < 40 ? 0.05 : 0))) {
    L.flags.care = true; say(L, pick(['転んで骨折した。歩くのに杖が要るようになった。', '物忘れが増えた。認知症と診断された。', '脳梗塞で倒れた。左半身が動きにくい。']), 'bad'); add(L, 'health', -12);
    if (!L.partner?.alive && chance(0.5)) { say(L, L.kids.length ? `${kRef(L.kids[0])}の近くの施設に入った。月${irnd(15, 25)}万円。` : '施設に入った。'); L.home = '施設'; L.money -= 200; }
  }
  if (a === 88 && chance(0.6)) say(L, `米寿。${L.kids.length ? L.kids.map(kRef).join('と') + 'が' : '親戚が'}集まった。`, 'good');
  if (a === 100) say(L, '100歳。市長から表彰された。', 'milestone');
}

/* ---------- 人生の選択（大人） ---------- */
async function lifeDecisions(L, pref) {
  const a = L.age, F = L.flags;
  if (a === 24 && pref.urban < 0.6 && L.working && !F.carAsked) { F.carAsked = true; await decide(L, `${L.livePref}は車がないと不便。車をどうする？`, [
    { t: '新車を買う', d: '250万円・ローン', w: 30, f: () => { say(L, `${pick(['軽の新車', 'コンパクトカー', 'SUV'])}を買った。ローン月3万円。`); L.money -= 50; L.debt += 200; F.car = true; add(L, 'happy', 4); } },
    { t: '中古で十分', d: '60万円', w: 50, f: () => { say(L, '中古の軽を60万円で買った。'); L.money -= 60; F.car = true; } },
    { t: '買わない', d: '自転車とバス', w: 20, f: () => { add(L, 'bond', -2); add(L, 'health', 2); } },
  ]); }
  if (a === 27 && L.working && L.regular && !F.transferAsked && chance(0.5)) { F.transferAsked = true; const to = pick(PREFS.filter(p => p.name !== L.livePref)).name; await decide(L, `${to}への転勤を打診された。${L.lover ? lRef(L) + 'とは遠距離になる。' : ''}`, [
    { t: '受ける', d: '出世コース', w: 45, f: () => { L.livePref = to; F.transferred = true; say(L, `${to}に引っ越した。知らない土地で一からやり直し。`, 'milestone'); add(L, 'bond', -6); add(L, 'learn', 4); if (L.lover && chance(0.5)) { say(L, `${lRef(L)}とは遠距離の末に別れた。`, 'bad'); L.lover = null; add(L, 'happy', -6); } } },
    { t: '断る', w: 55, f: () => { say(L, '転勤を断った。出世は遅れるかもしれない。'); F.promoBlock = true; } },
  ]); }
  if (a === 30 && !F.hobbyAsked) { F.hobbyAsked = true; const hs = ['釣り', '登山', 'キャンプ', 'ランニング', '料理', 'ギター', 'ゴルフ', '推し活', '家庭菜園', 'サウナ', '写真', '筋トレ'].sort(() => rnd() - 0.5).slice(0, 3); await decide(L, '30歳。何か一つ、長く続ける趣味を持つなら？', [
    ...hs.map(h => ({ t: h, w: 30, f: () => { F.hobby = h; like(L, h); tr(L, ['ランニング', '登山', '筋トレ', '釣り', 'キャンプ'].includes(h) ? '体力' : ['ギター', '写真', '料理'].includes(h) ? '芸術' : ['家庭菜園'].includes(h) ? 'ものづくり' : '社交', 8); say(L, `${h}が趣味になった。週末が楽しみになる。`, 'good'); add(L, 'happy', 5); add(L, ['ランニング', '登山', '筋トレ'].includes(h) ? 'health' : 'bond', 3); } })),
    { t: '特にない', w: 10, f: () => { } },
  ]); }
  if (a === 33 && L.working && !F.licenseAsk2 && chance(0.6)) { F.licenseAsk2 = true; const q = pick(['簿記2級', '宅建', '電気工事士', 'ケアマネ', 'TOEIC 800', '中小企業診断士', '衛生管理者']); await decide(L, `${q}の資格を取れば、仕事の幅が広がりそうだ。`, [
    { t: '夜と週末に勉強する', d: '1年', w: 50, f: () => { if (chance(0.7)) { say(L, `${q}に合格した。手当がついた。`, 'good'); add(L, 'learn', 6); tr(L, '頭脳', 6); F.cert = true; } else { say(L, `${q}は不合格。来年また。`); add(L, 'learn', 3); } add(L, 'health', -1); } },
    { t: 'いまの仕事で手いっぱい', w: 50, f: () => { } },
  ]); }
  if (a === 38 && L.friend && !F.guarantorAsked && chance(0.3)) { F.guarantorAsked = true; await decide(L, `${fRef(L)}が「借金の保証人になってほしい」と頼んできた。`, [
    { t: '断る', w: 60, f: () => { say(L, `断った。${fRef(L)}とは気まずくなった。`); add(L, 'bond', -5); } },
    { t: 'なる', d: '友達だから', w: 40, f: () => { if (chance(0.5)) { say(L, `${fRef(L)}が返せなくなり、300万円を肩代わりした。`, 'bad'); L.money -= 300; add(L, 'happy', -8); add(L, 'bond', -8); L.friend = null; } else { say(L, `${fRef(L)}はきちんと返した。`); add(L, 'bond', 4); } } },
  ]); }
  if (a === 40 && !F.dockAsked) { F.dockAsked = true; await decide(L, '40歳。人間ドックの案内が来た。', [
    { t: '毎年受ける', d: '年5万円', w: 50, f: () => { F.screening = true; say(L, '毎年、人間ドックを受けることにした。'); add(L, 'health', 2); } },
    { t: '健康診断だけでいい', w: 50, f: () => { } },
  ]); }
  if (a === 45 && L.loan > 0 && L.money > 800 && !F.prepayAsked) { F.prepayAsked = true; await decide(L, `住宅ローンの残りは${yen(L.loan)}。貯金は${yen(L.money)}。`, [
    { t: '500万円を繰り上げ返済', d: '利息が減る', w: 50, f: () => { L.loan -= 500; L.money -= 500; L.loanYears = Math.max(1, L.loanYears - 6); say(L, '500万円を繰り上げ返済した。完済が6年早まる。', 'good'); } },
    { t: '貯金は残しておく', w: 50, f: () => { } },
  ]); }
  if (a === 48 && L.parents.some(p => p.alive) && !F.cohabitAsked && chance(0.4)) { F.cohabitAsked = true; const p = L.parents.find(x => x.alive); await decide(L, `${p.role}が一人暮らしになった。同居する？`, [
    { t: '同居する', w: 40, f: () => { say(L, `${p.role}と同居を始めた。${L.partner?.alive ? pRef(L) + 'は少し複雑そう。' : ''}`); add(L, 'bond', 5); add(L, 'happy', -2); F.cohabit = true; } },
    { t: '近くに住んでもらう', w: 40, f: () => { say(L, `${p.role}は近所のアパートに移った。週に一度ごはんを食べる。`); add(L, 'bond', 3); } },
    { t: 'いまのまま', w: 20, f: () => { } },
  ]); }
  if (a === 52 && L.working && !F.relearnAsked && chance(0.5)) { F.relearnAsked = true; await decide(L, '52歳。「学び直し」という言葉が気になる。', [
    { t: 'オンラインで新しい分野を学ぶ', w: 40, f: () => { say(L, `${pick(['AI', 'データ分析', '英会話', '経営', '介護'])}を学び始めた。若い人と机を並べる。`, 'good'); add(L, 'learn', 8); tr(L, '頭脳', 6); add(L, 'happy', 3); } },
    { t: 'いまの経験を後輩に教える', w: 40, f: () => { say(L, '社内で若手の指導役になった。'); add(L, 'bond', 5); add(L, 'learn', 2); } },
    { t: 'どちらもしない', w: 20, f: () => { } },
  ]); }
  if (a === 55 && L.working && L.regular && !F.earlyAsked && chance(0.4)) { F.earlyAsked = true; await decide(L, '会社が早期退職を募集している。退職金に1,000万円の上乗せ。', [
    { t: '応じる', d: '55歳で自由になる', w: 35, f: () => { L.money += 1800; L.working = false; L.retired = true; say(L, '早期退職した。退職金は上乗せで1,800万円。', 'milestone'); add(L, 'happy', 4); add(L, 'bond', -4); F.earlyRetired = true; } },
    { t: '残る', w: 65, f: () => { say(L, '残った。同期が何人か辞めていった。'); } },
  ]); }
  if (a === 62 && !L.working && !F.silverAsked && chance(0.5)) { F.silverAsked = true; await decide(L, '時間がある。何かする？', [
    { t: 'シルバー人材で週3日働く', d: '月6万円', w: 35, f: () => { L.sideIncome = 70; say(L, `${pick(['公園の清掃', '学童の見守り', '駐輪場の管理', '農作業の手伝い'])}を週3日。月6万円。`); add(L, 'bond', 4); add(L, 'health', 2); } },
    { t: '孫や地域のために', w: 35, f: () => { say(L, `${L.grandkids.length ? '孫の送り迎え' : '町内会の役員'}を引き受けた。`); add(L, 'bond', 5); } },
    { t: '趣味に全部使う', w: 30, f: () => { say(L, `${F.hobby || '旅行'}三昧の毎日。`, 'good'); add(L, 'happy', 6); L.money -= 50; } },
  ]); }
  if (a === 68 && !F.moveAsked && chance(0.5)) { F.moveAsked = true; const near = L.kids.length ? kRef(L.kids[0]) : null; await decide(L, `${near ? near + 'が「近くに来ない？」と言う。' : '家が広すぎる。'}住み替える？`, [
    { t: near ? `${near}の近くへ` : '小さな家へ', w: 40, f: () => { say(L, near ? `${near}の家の近くに越した。孫と会う日が増えた。` : '駅前の小さなマンションに越した。', 'good'); add(L, 'bond', 5); L.money += L.homeValue ? Math.round(L.homeValue * 0.4) : 0; } },
    { t: '住み慣れた家に残る', w: 60, f: () => { } },
  ]); }
  if (a === 72 && !F.willAsked) { F.willAsked = true; await decide(L, '72歳。終活の本を読んだ。', [
    { t: '遺言を書く', w: 50, f: () => { say(L, `遺言を書いた。${L.kids.length ? L.kids.map(kRef).join('と') + 'に残すものを決めた。' : '財産の行き先を決めた。'}`); add(L, 'happy', 2); F.will = true; } },
    { t: 'まだ早い', w: 50, f: () => { } },
  ]); }
  if (a === 82 && !F.facilityAsked && (L.partner?.alive === false || !L.partner)) { F.facilityAsked = true; await decide(L, '一人暮らしが心配だと周りが言う。', [
    { t: '施設に入る', d: '月20万円', w: 45, f: () => { L.home = '施設'; say(L, `${L.kids.length ? kRef(L.kids[0]) + 'の近くの' : ''}施設に入った。`); add(L, 'bond', 2); add(L, 'happy', -2); } },
    { t: '自宅で暮らし続ける', w: 55, f: () => { say(L, 'ヘルパーさんに週2回来てもらうことにした。'); L.money -= 30; add(L, 'happy', 3); } },
  ]); }
  if (a >= 25 && a <= 75 && chance(0.03) && L.money > 50) await decide(L, '年末ジャンボ、買う？', [
    { t: '10枚（3,000円）', w: 50, f: () => { const r = rnd(); if (r < 0.0005) { say(L, '1等が当たった。3億円。', 'good'); L.money += 30000; add(L, 'happy', 20); } else if (r < 0.01) { say(L, '10万円が当たった。', 'good'); L.money += 10; add(L, 'happy', 4); } else say(L, 'はずれ。'); } },
    { t: '買わない', w: 50, f: () => { } },
  ]);
}

/* ---------- お金 ---------- */
async function moneyDecisions(L, pref) {
  const a = L.age;
  if (L.working && !L.flags.firstJob) L.flags.firstJob = a;
  if (L.home === '実家' && L.working && a >= 22 && a <= 32 && !L.flags.aloneAsked && chance(0.4)) { L.flags.aloneAsked = true; await decide(L, '実家を出る？', [
    { t: '一人暮らしを始める', d: `家賃${pref.urban >= 0.8 ? '8' : '5'}万円`, w: 55, f: () => { L.home = '一人暮らし'; say(L, `実家を出て一人暮らしを始めた。家賃${pref.urban >= 0.8 ? irnd(7, 9) : irnd(4, 6)}万円。`); add(L, 'bond', -2); add(L, 'happy', 3); } },
    { t: '実家に残ってお金を貯める', w: 45, f: () => { say(L, '実家に残った。月3万円を家に入れる。'); add(L, 'happy', -1); } },
  ]); }
  if (L.working && !L.flags.saveAsked && a >= 23 && a <= 30) {
    L.flags.saveAsked = true;
    await decide(L, `給料が入るようになった。お金の使い方は？`, [
      { t: '先取りで貯金する', d: '給料の15%を別口座に', w: 45, f: () => { L.habits.saving = true; tr(L, 'お金', 8); say(L, '給料日に自動で貯金する口座を作った。', 'good'); } },
      { t: '使いたいときに使う', w: 55, f: () => { } },
    ]);
  }
  if (L.working && !L.flags.nisaAsked && a >= 25 && a <= 35 && chance(0.5)) {
    L.flags.nisaAsked = true;
    await decide(L, `${L.friend ? fRef(L) : '同僚'}が「NISAで積立投資をしている」と言う。`, [
      { t: '月3万円で始める', d: '年36万円を投資信託に', w: 30, f: () => { L.nisa = 36; tr(L, 'お金', 8); say(L, 'NISAを始めた。毎月3万円、世界の株に積み立てる。', 'good'); } },
      { t: '月1万円で始める', w: 30, f: () => { L.nisa = 12; tr(L, 'お金', 5); say(L, 'NISAを始めた。毎月1万円。'); } },
      { t: 'よく分からないのでやらない', w: 40, f: () => { } },
    ]);
  }
  if (a >= 30 && a <= 70 && !L.flags.scamAsked && L.money > 300 && chance(0.05)) {
    L.flags.scamAsked = true;
    await decide(L, `${pick(['久しぶりに会った知人', 'SNSで知り合った人', '電話の相手'])}に「月利5%、元本保証」の投資を勧められた。`, [
      { t: '断る', w: 70, f: () => { } },
      { t: '200万円を預ける', w: 30, f: () => { if (chance(0.85)) { say(L, '連絡が取れなくなった。投資詐欺だった。200万円が消えた。', 'bad'); L.money -= 200; add(L, 'happy', -8); tr(L, 'お金', -6); } else { say(L, '半年後、260万円で戻ってきた。運がよかった。'); L.money += 60; } } },
    ]);
  }
  if (a >= 35 && a <= 50 && !L.flags.realEstateAsked && L.regular && salaryOf(L) >= 550 && L.money > 500 && chance(0.3)) {
    L.flags.realEstateAsked = true;
    await decide(L, '不動産会社から「ワンルーム投資」の営業電話。2,000万円を全額ローンで。', [
      { t: 'やらない', w: 65, f: () => { } },
      { t: '1部屋買う', d: '家賃収入からローンを払う', w: 35, f: () => { L.flags.realEstate = { price: 2000, loan: 2000, bought: a }; say(L, '東京のワンルームを1部屋買った。家賃7万円、ローン返済8万円。'); } },
    ]);
  }
  if (a >= 30 && a <= 50 && L.working && !L.flags.sideAsked && chance(0.08)) {
    L.flags.sideAsked = true;
    const sb = ['週末のデリバリー', '動画の編集', 'ハンドメイド販売', 'ブログ', '週1のバイト', 'せどり'].sort(() => rnd() - 0.5).slice(0, 3);
    await decide(L, '副業をしてみる？', [
      ...sb.map(x => ({ t: x, d: '年30〜80万円', w: 15, f: () => { L.sideIncome = irnd(30, 80); tr(L, 'お金', 5); like(L, x); say(L, `${x}の副業を始めた。年に${L.sideIncome}万円ほど増える。`); add(L, 'health', -2); } })),
      { t: 'やらない', w: 55, f: () => { } },
    ]);
  }
  if (a >= 25 && a <= 70 && a % 5 === 0 && (L.working || L.flags.pension)) {
    const inc = L.working ? salaryOf(L) : L.flags.pensionAmt || 0;
    say(L, `${a}歳の家計：年収${yen(inc)}。貯金${yen(L.money)}・投資${yen(L.inv)}${L.loan > 0 ? '・ローン残' + yen(L.loan) : ''}。純資産${yen(netWorth(L))}。`);
  }
}
function inherit(L, p) {
  const base = { 低: irnd(0, 150), 中: irnd(200, 900), 高: irnd(1200, 3500) }[L.family.tier];
  const share = Math.round(base / (L.sibs.length + 1));
  if (share >= 50) { L.money += share; L.inherited += share; say(L, `遺産として${yen(share)}を相続した。${L.sibs.length ? '兄弟と分けた。' : ''}`); }
  else if (L.family.tier === '低' && chance(0.3)) { say(L, '残ったのは古い家具と少しの借金だった。相続放棄をした。'); }
}
function moneyYear(L, pref) {
  const a = L.age;
  if (a < 18) { L.money = Math.max(L.money, 0); return; }
  let inc = 0;
  if (L.working) { const s = salaryOf(L); inc += Math.round(s * 0.78); L.incomeTotal += s; }
  if (L.sideIncome && a < 65) inc += L.sideIncome;
  if (L.partner?.alive && L.partner.works && a < 65) { const pb = D.salaryCurve.find(([mx]) => a <= mx)[1]; inc += Math.round((L.sex === '男' ? Math.min(pb, 420) * 0.72 : pb * 0.95) * pref.income * 0.78); }
  if (L.flags.pension) inc += L.flags.pensionAmt + (L.partner?.alive ? 80 : 0);
  let exp = (pref.urban >= 0.8 ? 320 : 240) * (a >= 65 ? 0.8 : 1) * (L.home === '実家' ? 0.5 : 1);
  if (['大学生', '専門学生', '大学院生', '浪人'].includes(L.stage)) { exp = L.family.tier === '低' ? 60 : 0; if (L.family.tier === '低') inc += 80; }
  if (!L.working && !L.flags.pension && L.stage === '社会人') exp *= 0.7;
  if (L.partner?.alive) exp += 120;
  exp += L.kids.filter(k => a - k.born < 22).length * 100;
  if (L.habits.smoke) exp += 12;
  if (L.loanYears > 0) { const pay = Math.round(L.loan / L.loanYears); exp += pay; L.loan -= pay; L.loanYears--; if (L.loanYears === 0) { L.loan = 0; say(L, '住宅ローンを払い終えた。', 'good'); add(L, 'happy', 4); } }
  if (L.homeValue > 0) L.homeValue = Math.round(L.homeValue * (L.flags.homeKind === 'マンション' && pref.urban >= 0.8 ? 0.995 : 0.985));
  if (L.debt > 0 && L.stage === '社会人') { const r = Math.min(L.debt, 20); L.debt -= r; exp += r; if (L.debt === 0) say(L, '奨学金を返し終えた。', 'good'); }
  if (L.home === '施設') exp += 150;
  if (L.flags.realEstate) { const re = L.flags.realEstate; const yrs = a - re.bought; re.loan = Math.max(0, re.loan - 60); const net = -12 + (yrs > 10 ? -20 : 0); inc += net; L.homeValue += 0; if (yrs === 15) { const sale = irnd(1100, 1700); say(L, `ワンルームを${yen(sale)}で売った。ローン残${yen(re.loan)}を返して${sale - re.loan >= 0 ? yen(sale - re.loan) + '残った' : yen(re.loan - sale) + '持ち出し'}。`, sale - re.loan >= 0 ? 'good' : 'bad'); L.money += sale - re.loan; L.flags.realEstate = null; } }
  // 投資
  if (L.nisa && a < 65 && L.working) { const put = Math.min(L.nisa, Math.max(0, L.money + inc - exp)); L.inv += put; L.invIn += put; exp += put; }
  if (L.inv > 0) {
    const ret = a < 65 ? 0.06 + gauss() * 0.15 : 0.03 + gauss() * 0.08; const gain = Math.round(L.inv * ret); L.inv += gain; L.invGain += gain;
    if (ret > 0.28 && L.inv > 300) say(L, `株が大きく上がった。投資が${yen(gain)}増えて${yen(L.inv)}に。`, 'good');
    if (ret < -0.2 && L.inv > 300) { say(L, `株が暴落。投資が${yen(-gain)}減った。${chance(0.3) ? '売らずに持ち続けた。' : ''}`, 'bad'); add(L, 'happy', -3); }
    if (a >= 65 && L.inv > 0) { const draw = Math.round(L.inv * 0.04); L.inv -= draw; inc += draw; }
  }
  if (L.habits.saving && L.working) exp *= 0.92;
  L.money += inc - exp;
  if (a >= 65 && L.money < 0) { if (!L.flags.outOfMoney) { L.flags.outOfMoney = true; say(L, '貯金が底をついた。年金の範囲で暮らす。', 'bad'); add(L, 'happy', -6); } L.money = Math.max(L.money, -200); }
  if (L.money < -500 && !L.flags.broke) { L.flags.broke = true; say(L, 'カードローンが膨らんで、生活が苦しい。', 'bad'); add(L, 'happy', -8); }
  if (netWorth(L) > 3000 && !L.flags.rich) { L.flags.rich = true; say(L, `純資産が3,000万円を超えた。`, 'good'); }
  if (netWorth(L) > 10000 && !L.flags.rich2) { L.flags.rich2 = true; say(L, `純資産が1億円を超えた。`, 'good'); }
}

/* ---------- 画面 ---------- */
const S = { life: null, speedMs: 2400, paused: false, auto: false, resolveAsk: null };
const screens = ['title', 'birth', 'life', 'result'];
function show(name) { for (const s of screens) $(`#screen-${s}`).classList.toggle('active', s === name); window.scrollTo(0, 0); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitUnpaused() { while (S.paused) await sleep(120); }
function radarSvg(traits, size, withLabels) {
  const keys = Object.keys(traits); const n = keys.length; const cx = size / 2, cy = size / 2, r = size * (withLabels ? 0.27 : 0.42);
  const pt = (i, v) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(ang) * r * v, cy + Math.sin(ang) * r * v]; };
  let s = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="radar">`;
  for (const lv of [0.33, 0.66, 1]) s += `<polygon points="${keys.map((k, i) => pt(i, lv).join(',')).join(' ')}" fill="none" stroke="#e4e6ea"/>`;
  keys.forEach((k, i) => { const [x, y] = pt(i, 1); s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e4e6ea"/>`; });
  s += `<polygon points="${keys.map((k, i) => pt(i, Math.max(0.05, traits[k] / 100)).join(',')).join(' ')}" fill="rgba(74,123,208,.25)" stroke="#4a7bd0" stroke-width="2"/>`;
  if (withLabels) keys.forEach((k, i) => { const [x, y] = pt(i, 1.25); s += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="${Math.round(size * 0.065)}" fill="#6b6f7a">${k}</text>`; });
  return s + '</svg>';
}
function topTraits(L, n = 2) { return Object.entries(L.traits).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k); }
function renderStats(L) {
  const rd = $('#radar'); if (rd) rd.innerHTML = radarSvg(L.traits, 120, true);
  for (const k of ['health', 'happy', 'learn', 'bond']) { $(`#bar-${k}`).style.width = `${Math.round(L.s[k])}%`; $(`#val-${k}`).textContent = Math.round(L.s[k]); }
  $('#val-money').textContent = yen(L.money); $('#val-inv').textContent = yen(L.inv); $('#val-net').textContent = yen(netWorth(L));
  $('#life-job').textContent = L.job ? (L.working ? L.job.name : L.retired ? `元${L.job.name}` : '求職中') : ['大学生', '専門学生', '大学院生', '高校生', '中学生', '小学生', '浪人'].includes(L.stage) ? L.stage : '';
  $('#life-age').textContent = L.age; $('#life-year').textContent = `${L.birthYear + L.age}年`;
  $('#life-pref').textContent = L.livePref === L.pref ? L.pref : `${L.livePref}（${L.pref}生まれ）`;
}
function logLine(ev, into) {
  const d = document.createElement('div'); d.className = `ev ${ev.kind}`;
  d.innerHTML = `<span class="age">${ev.age}</span><span class="txt"></span>`; d.querySelector('.txt').textContent = ev.text;
  into.appendChild(d); return d;
}
UI.onLog = (ev) => { const log = $('#log'); logLine(ev, log); log.scrollTop = log.scrollHeight; renderStats(S.life); };
UI.auto = () => S.auto;
UI.ask = (L, q, options) => new Promise(resolve => {
  $('#decision-age').textContent = `${L.age}歳 · ${L.livePref}`; $('#decision-q').textContent = q;
  const box = $('#decision-opts'); box.innerHTML = '';
  options.forEach(o => { const b = document.createElement('button'); b.className = 'btn'; b.innerHTML = `${esc(o.t)}${o.d ? `<small>${esc(o.d)}</small>` : ''}`; b.onclick = () => { $('#decision').classList.add('hidden'); S.resolveAsk = null; resolve(o); }; box.appendChild(b); });
  $('#decision').classList.remove('hidden'); S.resolveAsk = { options, resolve };
  requestAnimationFrame(() => { const lg = $('#log'); lg.scrollTop = lg.scrollHeight; });
});
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function startLife(L) {
  S.life = L; show('life'); $('#log').innerHTML = ''; $('#decision').classList.add('hidden');
  $('#life-name').textContent = L.fullName; renderStats(L);
  await stepYear(L); await sleep(S.speedMs);
  while (L.alive) {
    await waitUnpaused(); L.age++; renderStats(L);
    const before = L.log.length;
    await stepYear(L); renderStats(L);
    if (!L.alive) break;
    const n = L.log.length - before;
    await sleep(n === 0 ? S.speedMs * 0.35 : S.speedMs * Math.min(1.8, 0.8 + n * 0.3));
  }
  await sleep(2200); finish(L);
}

/* ---------- 結果 ---------- */
function summaryOf(L) {
  const fam = [];
  if (L.partner) fam.push(`${L.sex === '男' ? '妻' : '夫'}・${L.partner.name}${L.partner.alive ? '' : '（先立たれた）'}`);
  else if (L.flags.divorced) fam.push('離婚歴あり');
  if (L.kids.length) fam.push(`子ども${L.kids.length}人`);
  if (L.grandkids.length) fam.push(`孫${L.grandkids.length}人`);
  return fam.length ? fam.join('・') : '独身';
}
function finish(L) {
  const pct = Math.round((1 - survivalTo(L.age, L.sex)) * 100);
  const job = L.job ? L.job.name : '仕事はしなかった';
  $('#result-main').textContent = `${L.pref}に生まれて、${L.age}歳まで生きた。`;
  $('#result-cause').textContent = `${L.fullName}（${L.sex}）· ${L.cause === '老衰' ? '老衰' : '原因は' + L.cause}。`;
  const help = $('#result-help');
  if (D.heavyCauses.includes(L.cause)) { help.classList.remove('hidden'); help.textContent = `これは統計上の出来事で、場面は描いていません。つらいときは相談できます：${D.helpLines.map(h => `${h.name} ${h.tel}`).join(' ／ ')}`; } else help.classList.add('hidden');
  $('#r-age').textContent = `${L.age}年`; $('#r-pct').textContent = `${pct}%より長く`; $('#r-job').textContent = job; $('#r-family').textContent = summaryOf(L);
  $('#r-income').textContent = L.incomeTotal ? yen(L.incomeTotal) : '―'; $('#r-live').textContent = `${L.livePref}・${L.home}`;
  $('#r-net').textContent = yen(netWorth(L)); $('#r-peak').textContent = yen(L.peakNet);
  $('#r-inv').textContent = L.invIn ? `${yen(L.invIn)} → 損益 ${L.invGain >= 0 ? '+' : ''}${yen(L.invGain)}` : 'しなかった';
  $('#r-inherit').textContent = L.inherited ? yen(L.inherited) : 'なし';
  $('#radar-result').innerHTML = radarSvg(L.traits, 260, true);
  $('#r-traits').textContent = `得意：${topTraits(L).join('・')}`;
  $('#r-likes').textContent = L.likes.length ? `好き：${L.likes.join('・')}` : '好き：まだ見つかっていない';
  const map = $('#lifemap'); map.innerHTML = '';
  L.map.forEach((h, i) => { const c = document.createElement('i'); c.style.opacity = (0.15 + h / 100 * 0.85).toFixed(2); c.title = `${i}歳 幸せ${h}`; map.appendChild(c); });
  const rl = $('#result-log'); rl.innerHTML = ''; L.log.filter(e => e.kind !== 'choice').forEach(e => logLine(e, rl));
  const yd = CFG.yado;
  if (yd && yd.base) {
    const pg = D.yadoPages[L.pref] || D.yadoPages[L.livePref] || D.yadoRegion[prefByName(L.pref).region];
    const which = D.yadoPages[L.pref] ? `生まれた${L.pref}` : D.yadoPages[L.livePref] ? `最後に住んだ${L.livePref}` : `${L.pref}の近く`;
    $('#exit-link').href = pg ? `${yd.base}${pg[0]}/` : yd.base;
    $('#exit-link').textContent = pg ? `${pg[1]}の安い宿を見る` : '日本の安い宿を見る';
    $('#exit-note').textContent = `${which}に、泊まりに行ってみる。${yd.note || ''}`;
  } else $('.exit').classList.add('hidden');
  const ad = $('#ad-result');
  if (CFG.adsenseClient && CFG.adsenseSlot) {
    ad.classList.remove('hidden');
    ad.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${CFG.adsenseClient}" data-ad-slot="${CFG.adsenseSlot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    if (!document.querySelector('script[src*="adsbygoogle"]')) { const s = document.createElement('script'); s.async = true; s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CFG.adsenseClient}`; s.crossOrigin = 'anonymous'; document.head.appendChild(s); }
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { }
  }
  drawCard(L, pct); setupShare(L, pct); setupMovie(L, pct); savePast(L); show('result');
}

/* ---------- カード ---------- */
const REGION_COLORS = { 北海道: ['#2b4a6f', '#8fb4d9'], 東北: ['#3e5a3a', '#a9c7a0'], 関東: ['#1b1f2a', '#7c86a8'], 中部: ['#4a3f6b', '#b2a4d6'], 近畿: ['#6b2d3e', '#d9a2ae'], 中国: ['#2f5d62', '#9ccbc8'], 四国: ['#5c4a1f', '#d4bf7a'], 九州: ['#7a3a1d', '#e0a583'], 沖縄: ['#0f6b8a', '#8ad7e8'] };
const FONT = (w, px) => `${w} ${px}px -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;
function drawCard(L, pct) {
  const cv = $('#card'), c = cv.getContext('2d'), W = cv.width, H = cv.height;
  const pref = prefByName(L.pref);
  const [c1, c2] = REGION_COLORS[pref.region] || ['#333', '#999'];
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const cell = 28, gap = 6, cols = 20, startX = (W - (cols * cell + (cols - 1) * gap)) / 2, startY = 900;
  L.map.forEach((h, i) => { const x = startX + (i % cols) * (cell + gap), y = startY + Math.floor(i / cols) * (cell + gap); c.fillStyle = `rgba(255,255,255,${0.12 + h / 100 * 0.78})`; c.fillRect(x, y, cell, cell); });
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = FONT(500, 34); c.textAlign = 'left'; c.fillText('1億2千万分の1 ― 日本のどこかで', 80, 110);
  c.fillStyle = '#fff'; c.font = FONT(700, 120); c.fillText(L.pref, 80, 260);
  c.font = FONT(500, 48); c.fillText(`に生まれて、${L.age}歳まで生きた。`, 80, 330);
  c.font = FONT(400, 38); c.fillStyle = 'rgba(255,255,255,.92)';
  const lines = [`${L.fullName}（${L.sex}）· ${L.job ? L.job.name : '―'}`, `${summaryOf(L)}`, `${L.livePref}で${L.home} · 純資産 ${yen(netWorth(L))}`, `得意は${topTraits(L).join('と')}${L.likes.length ? '、' + L.likes.slice(0, 2).join('と') + 'が好き' : ''}。`];
  lines.forEach((t, i) => c.fillText(t, 80, 420 + i * 56));
  [['健康', 'health'], ['幸せ', 'happy'], ['学び', 'learn'], ['つながり', 'bond']].forEach(([lab, k], i) => {
    const y = 690 + i * 42; c.fillStyle = 'rgba(255,255,255,.85)'; c.font = FONT(500, 28); c.textAlign = 'left'; c.fillText(lab, 80, y + 24);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(230, y + 4, 740, 20); c.fillStyle = '#fff'; c.fillRect(230, y + 4, 740 * L.s[k] / 100, 20);
  });
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = FONT(500, 30); c.fillText(`${L.cause === '老衰' ? '老衰で' : L.cause + 'で'}この世を去った。`, 80, 660);
  c.fillText('人生地図：1マス＝1年、明るいほど幸せ', 80, 876);
  c.font = FONT(500, 30); c.textAlign = 'center'; c.fillText(`同じ年に生まれた${L.sex}の${pct}%より長く生きた`, W / 2, 1230);
  c.font = FONT(400, 26); c.fillText(CFG.siteUrl ? CFG.siteUrl.replace(/^https?:\/\//, '') : '#1億2千万分の1', W / 2, 1290);
}
function cardBlob() { return new Promise(r => $('#card').toBlob(r, 'image/png')); }
function shareText(L) { return `${L.pref}に生まれて、${L.age}歳まで生きた。${L.job ? L.job.name + '。' : ''}${summaryOf(L)}。純資産${yen(netWorth(L))}。 #1億2千万分の1`; }
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

/* ---------- ショートムービー ---------- */
function setupMovie(L, pct) {
  const M = window.JINSEI_MOVIE; if (!M) return;
  const box = $('#movie'); const cv = $('#movie-canvas'); const status = $('#movie-status');
  let current = null;
  const stop = () => { if (current) { current.stop(); current = null; } };
  $('#btn-movie-play').onclick = async () => { stop(); box.classList.remove('hidden'); status.textContent = '再生中…'; current = M.play(L, cv, { record: false, siteUrl: CFG.siteUrl, pct }); await current.done; status.textContent = '終わり。もう一度見るか、動画として保存できます。'; };
  $('#btn-movie-save').onclick = async () => {
    stop(); box.classList.remove('hidden');
    if (!window.MediaRecorder || !cv.captureStream) { status.textContent = 'このブラウザでは動画の保存ができません。再生はできます。'; return; }
    status.textContent = '動画を作っています。画面を閉じずに、このまま最後まで待ってください…';
    current = M.play(L, cv, { record: true, siteUrl: CFG.siteUrl, pct, onProgress: (p) => { status.textContent = `動画を作っています… ${Math.round(p * 100)}%`; } });
    const blob = await current.done; current = null;
    if (!blob) { status.textContent = '動画を作れませんでした。'; return; }
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `jinsei_${L.pref}_${L.age}.${ext}`, { type: blob.type });
    status.textContent = `できました（${(blob.size / 1024 / 1024).toFixed(1)}MB）。`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: shareText(L) }); return; } catch (e) { } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  };
  $('#btn-movie-close').onclick = () => { stop(); box.classList.add('hidden'); };
}

/* ---------- 前世の記録 ---------- */
const KEY = 'jinsei.lives';
function loadPast() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
function savePast(L) {
  try { const list = loadPast(); list.unshift({ at: new Date().toISOString().slice(0, 10), name: L.fullName, sex: L.sex, pref: L.pref, age: L.age, cause: L.cause, job: L.job ? L.job.name : '', fam: summaryOf(L), net: Math.round(netWorth(L)) }); localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10))); } catch (e) { }
}
function renderPast() {
  const list = loadPast(); const box = $('#past-lives'); const ul = $('#past-list'); ul.innerHTML = '';
  if (!list.length) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  list.forEach(p => { const li = document.createElement('li'); li.innerHTML = `${esc(p.pref)}生まれ・${esc(p.name)}（${p.sex}）${p.age}歳 <small>${esc(p.job || '')}${p.job ? ' · ' : ''}${esc(p.fam)} · ${esc(p.cause)}${p.net != null ? ' · 純資産' + yen(p.net) : ''} · ${p.at}</small>`; ul.appendChild(li); });
}

/* ---------- 誕生画面 ---------- */
function showBirth(L) {
  const p = prefByName(L.pref);
  $('#birth-year').textContent = `${L.birthYear}年`; $('#birth-pref').textContent = L.pref;
  $('#birth-line1').textContent = `${L.fullName}。${L.sex}の子として、${L.pref}に生まれました。`;
  $('#birth-line2').textContent = `今年、日本で生まれる約${Math.round(D.birthsPerYear / 10000)}万人のうち、${L.pref}はおよそ${birthsIn(p).toLocaleString()}人。`;
  $('#birth-line3').textContent = `生まれる県は出生数の割合で、性別は${Math.round(D.maleRatio * 1000) / 10}対${Math.round((1 - D.maleRatio) * 1000) / 10}で決まります。選べるのは、ここから先だけ。`;
  show('birth');
}

/* ---------- 操作 ---------- */
function bind() {
  $('#in-gentle').checked = localStorage.getItem('jinsei.gentle') === '1';
  $('#btn-birth').onclick = () => { const gentle = $('#in-gentle').checked; localStorage.setItem('jinsei.gentle', gentle ? '1' : '0'); const L = newLife($('#in-name').value.trim(), gentle); showBirth(L); S.life = L; };
  $('#btn-start').onclick = () => { S.paused = false; startLife(S.life); };
  $('#btn-pause').onclick = () => { S.paused = !S.paused; $('#btn-pause').textContent = S.paused ? '▶' : '⏸'; };
  document.querySelectorAll('.spd').forEach(b => b.onclick = () => { document.querySelectorAll('.spd').forEach(x => x.classList.remove('active')); b.classList.add('active'); S.speedMs = +b.dataset.ms; });
  $('#in-auto').onchange = (e) => { S.auto = e.target.checked; if (S.auto && S.resolveAsk) { const { options, resolve } = S.resolveAsk; $('#decision').classList.add('hidden'); S.resolveAsk = null; resolve(options[+weighted(options.map((o, i) => [String(i), o.w || 1]))]); } };
  $('#btn-again').onclick = () => { renderPast(); show('title'); };
  renderPast();
}
document.addEventListener('DOMContentLoaded', bind);
window.JINSEI_SIM = { newLife, stepYear, UI, summaryOf, survivalTo, netWorth };
})();
