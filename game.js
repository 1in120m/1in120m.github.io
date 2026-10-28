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
const sibWord = (x) => x.older ? (x.sex === '男' ? '兄' : '姉') : (x.sex === '男' ? '弟' : '妹');

/* ---------- ログ ---------- */
let UI = {};
function say(L, text, kind = 'info') { L.log.push({ age: L.age, text, kind }); UI.onLog && UI.onLog(L.log[L.log.length - 1]); }
const add = (L, k, v) => { L.s[k] = clamp(L.s[k] + v); };

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
  if (a === 3) say(L, chance(0.5) ? `${pref.spots[0]}に連れて行ってもらった。覚えていない。` : `祖母の${L.grands[0].name}によくなついた。`);
  if (a >= 2 && a <= 6) { const next = L.sibs.find(x => !x.born); if (next && chance(0.4)) { next.born = true; say(L, `${sibWord(next)}の${next.name}が生まれた。`, 'good'); add(L, 'bond', 3); } }
  if (a === 5) say(L, `七五三。${L.parents[0].name}が写真館で記念写真を撮った。`);
  if (a === 6) { say(L, `小学校に入学した。担任は${pick(D.surnames)}先生。`, 'milestone'); L.stage = '小学生'; }
  if (a === 7 && !L.friend) { const fs = chance(0.7) ? L.sex : other(L.sex); L.friend = { name: pick(D.namesYoung[fs]), sex: fs }; say(L, `となりの席の${L.friend.name}と仲良くなった。毎日いっしょに帰る。`, 'good'); add(L, 'bond', 5); }
  if (a === 10 && chance(0.6)) say(L, `運動会のリレーで${pick(['転んだ', 'アンカーを走った', '1位になった', '2位だった'])}。`);
  if (a === 12) { say(L, '中学校に入学した。制服が少し大きい。', 'milestone'); L.stage = '中学生'; }
  if (a === 13) {
    const club = weighted({ 運動部: 55, 文化部: 25, 帰宅部: 20 }); L.flags.club = club;
    if (club === '運動部') { L.flags.clubName = pick(['野球', 'サッカー', 'バスケ', 'バレー', '陸上', 'テニス', '卓球', '剣道']); say(L, `${L.flags.clubName}部に入った。朝練がつらい。`); add(L, 'health', 4); add(L, 'bond', 4); }
    else if (club === '文化部') { L.flags.clubName = pick(['吹奏楽', '美術', '書道', '科学', '放送', '演劇']); say(L, `${L.flags.clubName}部に入った。`); add(L, 'learn', 3); add(L, 'bond', 3); }
    else { say(L, '部活には入らなかった。放課後はゲームと動画。'); add(L, 'learn', -1); }
  }
  if (a === 14 && chance(0.6)) { const ln = pick(D.namesYoung[other(L.sex)]); say(L, `初めて好きな人ができた。同じクラスの${ln}。話しかけられないまま1年が過ぎた。`); add(L, 'happy', 4); }
  if (a === 15) await decideHighSchool(L, pref);
  if (a === 18) await decideAfterHigh(L, pref);
  if (a === 20) {
    say(L, `はたちになった。${L.livePref}の成人式で${L.friend ? L.friend.name + 'と' : ''}再会した。`, 'milestone');
    if (chance(0.6)) await decide(L, `${L.friend ? L.friend.name : '友達'}にタバコを勧められた。`, [
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
    if (r < 0.08 && L.friend) { say(L, `${L.friend.name}の家に泊まった。夜中までゲーム。`, 'good'); add(L, 'bond', 3); add(L, 'happy', 3); }
    else if (r < 0.13) { say(L, '学校でいじめられた。誰にも言えなかった。', 'bad'); add(L, 'happy', -10); add(L, 'bond', -6); }
    else if (r < 0.20) { say(L, `${pick(['インフルエンザ', '肺炎', '骨折'])}で入院した。${L.parents[0].name}が毎日来てくれた。`); add(L, 'health', -3); }
    else if (r < 0.28 && L.family.tier !== '低') { say(L, `${pick(['ピアノ', 'スイミング', '習字', '英語', 'サッカー', '公文'])}を習いはじめた。月謝は${irnd(6, 12)}千円。`); add(L, 'learn', 4); }
    else if (r < 0.34) { say(L, '本を読むのが好きになった。図書室の常連。'); add(L, 'learn', 5); }
    else if (r < 0.40) { say(L, `家族で${pref.spots[1]}を見に行った。`, 'good'); add(L, 'happy', 3); }
    else if (r < 0.43 && !L.family.single) { say(L, `父・${L.parents[1].name}の転勤で引っ越した。${L.friend ? L.friend.name + 'と別れた。' : ''}`); add(L, 'bond', -5); L.friend = null; }
    else if (r < 0.46 && !L.family.single) { say(L, `両親が離婚した。母・${L.parents[0].name}と暮らすことになった。`, 'bad'); L.family.single = true; add(L, 'happy', -10); L.family.tier = L.family.tier === '高' ? '中' : '低'; }
    else if (r < 0.50) { L.pet = { name: pick(D.petNames), kind: pick(['犬', '猫', 'ハムスター', '金魚']) }; say(L, `${L.pet.kind}を飼いはじめた。名前は${L.pet.name}。`, 'good'); add(L, 'happy', 4); }
  }
  if (a >= 13 && a <= 17 && L.stage !== '社会人') {
    const r = rnd();
    if (r < 0.08) { say(L, 'スマホを持った。夜中まで見るようになった。'); add(L, 'health', -2); add(L, 'bond', 2); }
    else if (r < 0.15) { const ln = pick(D.namesYoung[other(L.sex)]); L.lover = { name: ln }; say(L, `${ln}と付き合いはじめた。初めての恋人。`, 'good'); add(L, 'happy', 6); }
    else if (r < 0.19 && L.lover) { say(L, `${L.lover.name}に振られた。`, 'bad'); L.lover = null; add(L, 'happy', -6); }
    else if (r < 0.23) { say(L, '自転車で車と接触した。幸い軽いけが。'); add(L, 'health', -3); }
    else if (r < 0.29 && a >= 16) { say(L, `${pick(['コンビニ', 'ファミレス', 'スーパー', '塾'])}でバイトをはじめた。時給${irnd(10, 12)}00円。`); add(L, 'bond', 2); L.money += 30; }
    else if (r < 0.33) { say(L, '学校に行けない時期があった。', 'bad'); add(L, 'happy', -8); add(L, 'learn', -4); }
    else if (r < 0.38) { say(L, L.flags.club === '運動部' ? `${L.flags.clubName}で県大会に出た。` : '文化祭で主役をやった。', 'good'); add(L, 'happy', 5); add(L, 'bond', 3); }
    else if (r < 0.42) { say(L, `${pick(['数学', '英語', '物理', '世界史'])}の${pick(D.surnames)}先生の授業が好きだった。`); add(L, 'learn', 3); }
  }

  /* --- 大学・専門時代 --- */
  if (['大学生', '専門学生', '大学院生'].includes(L.stage) && a >= 19) {
    const r = rnd();
    if (r < 0.15) { const fs = chance(0.7) ? L.sex : other(L.sex); L.friend = { name: pick(D.namesYoung[fs]), sex: fs }; say(L, `${pick(['サークル', 'ゼミ', 'バイト先'])}で${L.friend.name}と出会った。一生の友達になる。`, 'good'); add(L, 'bond', 6); }
    else if (r < 0.20) { say(L, `半年、${pick(['カナダ', 'オーストラリア', '韓国', 'フィリピン'])}に留学した。`); add(L, 'learn', 8); add(L, 'happy', 5); L.money -= 100; }
    else if (r < 0.27) { const ln = pick(D.namesYoung[other(L.sex)]); L.lover = { name: ln }; say(L, `${ln}と付き合いはじめた。`, 'good'); add(L, 'happy', 6); }
    else if (r < 0.31) { say(L, 'ほとんど授業に出なかった。単位が危ない。'); add(L, 'learn', -4); }
    else if (r < 0.37) { say(L, 'バイトと授業で手いっぱいの一年。'); L.money += 60; add(L, 'health', -2); }
    if (a === 21 && L.stage === '大学生') say(L, '就職活動がはじまった。スーツで何十社も回った。');
  }

  if (a === 22 && L.lover && chance(0.5)) { say(L, `${L.lover.name}とは、就職を機に自然と離れていった。`); L.lover = null; }
  /* --- 働く --- */
  if (L.working) await workYear(L, pref);

  /* --- 結婚・家族 --- */
  await familyYear(L, pref);

  /* --- お金の決断 --- */
  await moneyDecisions(L, pref);

  /* --- 健康の節目 --- */
  if (a === 35 && chance(0.6)) await decide(L, '健康診断で血圧と血糖が高めだと言われた。', [
    { t: '運動と食事を変える', d: '長く効く', w: 45, f: () => { L.habits.exercise = true; add(L, 'health', 6); say(L, '週に2回走るようになった。体重が4キロ落ちた。', 'good'); } },
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
    else if (r < 0.10 && !L.pet) { L.pet = { name: pick(D.petNames), kind: chance(0.5) ? '犬' : '猫' }; say(L, `${L.pet.kind}を飼いはじめた。名前は${L.pet.name}。`, 'good'); add(L, 'happy', 4); add(L, 'health', 2); }
    else if (r < 0.13) { say(L, `${L.friend ? L.friend.name + 'と' : '友達と'}${pick(['沖縄', '北海道', '韓国', '台湾', 'ハワイ'])}に旅行した。`, 'good'); add(L, 'happy', 4); L.money -= 20; }
    else if (r < 0.15 && L.friend) { say(L, `${L.friend.name}と疎遠になった。最後に会ったのがいつか思い出せない。`); add(L, 'bond', -5); }
    else if (r < 0.17) { say(L, 'SNSで知り合った人たちと会うようになった。'); add(L, 'bond', 4); }
    else if (r < 0.19 && L.friend) { say(L, `${L.friend.name}の結婚式でスピーチをした。`, 'good'); add(L, 'bond', 3); L.money -= 5; }
    else if (r < 0.21 && L.pet && a - 10 > 0 && chance(0.5)) { say(L, `${L.pet.name}が死んだ。${irnd(12, 16)}年いっしょだった。`, 'bad'); L.pet = null; add(L, 'happy', -7); }
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
    if (chance(qx(ga, g.role === '祖母' ? '女' : '男'))) { g.alive = false; say(L, `${g.role}の${g.name}が亡くなった。${ga}歳だった。${a < 20 ? '初めてのお葬式。' : ''}`, 'bad'); add(L, 'happy', a < 25 ? -8 : -4); }
  }
  for (const p of L.parents) {
    if (!p.alive) continue;
    const pa = p.ageAtBirth + a;
    if (chance(qx(pa, p.role === '母' ? '女' : '男') * 1.15)) {
      p.alive = false;
      say(L, `${p.role}・${p.name}が亡くなった。${pa}歳だった。`, 'bad'); add(L, 'happy', a < 30 ? -14 : -9); add(L, 'bond', -4);
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
  const who = L.partner?.alive ? `${L.partner.name}` : L.kids.length ? `${L.kids[0].name}` : L.friend ? L.friend.name : null;
  const line = c === '老衰' ? `${L.age}歳、眠るように亡くなった。${who ? who + 'が手を握っていた。' : ''}` : `${L.age}歳で亡くなった。${/事故|地震|津波|殺人/.test(c) ? c + 'だった' : c + 'が原因だった'}。`;
  say(L, line, 'death');
}

/* ---------- 進学 ---------- */
async function decideHighSchool(L, pref) {
  await decide(L, '中学を卒業する。高校はどうする？', [
    { t: '普通科に進む', w: 70 + L.s.learn / 2, f: () => { L.stage = '高校生'; L.flags.hs = '普通科'; say(L, `${pick(['県立', '市立', '私立'])}${pick(D.surnames).slice(0, 1)}${pick(['北', '南', '東', '西', '中央', '第一'])}高校の普通科に入った。${L.friend ? L.friend.name + 'とは別の高校になった。' : ''}`, 'milestone'); } },
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
      add(L, 'learn', 8);
    } },
    { t: '専門学校に進む', d: '2年で資格をとる', w: 22, f: () => { L.stage = '専門学生'; L.edu = '専門卒'; say(L, `${pick(['看護', '保育', '美容', '調理', 'IT', 'デザイン', '自動車整備', '医療事務'])}の専門学校に入った。`, 'milestone'); add(L, 'learn', 4); if (L.family.tier === '低' && chance(0.5)) { L.debt += 150; say(L, '学費の一部は奨学金で。'); } } },
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
  const s = salaryOf(L);
  say(L, `${L.regular ? '正社員' : j.name === 'フリーランス' ? '個人事業主' : '契約・パート'}として${j.name}になった。年収は${yen(s)}。上司は${L.boss.name}さん。`, 'milestone');
}
async function workYear(L, pref) {
  const a = L.age, j = L.job;
  const years = a - (L.flags.jobStart || a);
  if (years === 1 && chance(0.5)) say(L, pick(['仕事を覚えるのに必死の一年。', '毎日くたくた。でも給料日はうれしい。', `${L.boss.name}さんに怒られながら覚えた。`, '初めてのボーナスで親に食事をごちそうした。']));
  const r = rnd();
  if (r < 0.05 && j.health <= -1) { say(L, '残業が月80時間。体を壊した。'); add(L, 'health', -5); add(L, 'happy', -4); }
  else if (r < 0.09 && L.regular && a >= 30 && a <= 50 && !L.flags.promoted) { L.flags.promoted = true; say(L, `${pick(['主任', '係長', '班長', 'リーダー', '店長'])}になった。年収${yen(salaryOf(L))}。`, 'good'); add(L, 'happy', 5); add(L, 'learn', 3); }
  else if (r < 0.105 && L.regular && a >= 40 && a <= 55 && L.flags.promoted && !L.flags.promoted2) { L.flags.promoted2 = true; say(L, `${pick(['課長', '部長', '工場長', 'マネージャー'])}になった。年収${yen(salaryOf(L))}。部下は${irnd(5, 30)}人。`, 'good'); add(L, 'happy', 4); add(L, 'health', -2); }
  else if (r < 0.125 && a >= 25 && a < 55 && (L.flags.moves || 0) < 2 + rnd() * 2) {
    await decide(L, `${pick(['知り合い', '取引先', '転職サイト'])}から誘いが来た。${pick(['条件はいまより少し上', '仕事はきついが給料は上', '給料は同じで家から近い'])}。`, [
      { t: '転職する', w: 40, f: () => { const nj = pick(jobOptions(L, 3, chance(0.6) ? j.field : null)); L.flags.moves = (L.flags.moves || 0) + 1; say(L, '転職した。', 'milestone'); setJob(L, nj); } },
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
  else if (r < 0.175) { say(L, pick(['職場に気の合う仲間ができた。', '後輩を育てる立場になった。', '仕事で表彰された。', `${L.boss.name}さんに「任せる」と言われた。`]), 'good'); add(L, 'bond', 3); add(L, 'happy', 3); }
  else if (r < 0.195) { say(L, pick([`上司の${L.boss.name}さんと合わない。毎朝が重い。`, '人手不足で休みが取れない。', '給料が3年上がっていない。']), 'bad'); add(L, 'happy', -5); }
  if (j.field === '製造' && years === 3 && chance(0.4)) { say(L, '機械を一人で任されるようになった。', 'good'); add(L, 'learn', 4); }
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
      await decide(L, L.sex === '男' ? `${ln}にプロポーズするか、迷っている。` : `${ln}にプロポーズされた。`, [
        { t: '結婚する', w: 70, f: () => {
          L.partner = { name: ln, alive: true, age: L.lover.age || a + irnd(-3, 3), job: L.lover.job || pick(JOBS).name, works: chance(L.sex === '男' ? 0.7 : 0.95), since: a };
          L.lover = null; if (L.home !== '持ち家') L.home = '賃貸';
          say(L, `${ln}と結婚した。${L.surname}${ln}になる。`, 'milestone'); add(L, 'happy', 12); add(L, 'bond', 10);
          if (chance(0.5)) { const c = irnd(100, 300); say(L, `${pick([pref.spots[0] + 'の近くのホテル', '小さなチャペル', '地元の神社'])}で結婚式。費用は${c}万円、ご祝儀で半分戻った。`); L.money -= c / 2; } else say(L, '式はせず、写真だけ撮った。浮いたお金は新婚旅行に。');
        } },
        { t: 'まだ結婚はしない', w: 30, f: () => { if (chance(0.5)) { say(L, `その後、${ln}とは別れた。`, 'bad'); L.lover = null; add(L, 'happy', -6); } } },
      ]);
    } else if (chance(0.25)) { say(L, `${L.lover.name}と別れた。`, 'bad'); L.lover = null; add(L, 'happy', -6); }
  }

  if (L.partner && L.partner.alive) {
    const momAge = L.sex === '女' ? a : L.partner.age + (a - L.partner.since);
    if (L.kids.length < 3 && momAge >= 22 && momAge <= 42) {
      let p = L.kids.length === 0 ? 0.30 : L.kids.length === 1 ? 0.22 : 0.07;
      if (momAge > 36) p *= 0.5; if (netWorth(L) < -100) p *= 0.6;
      if (chance(p)) { const ks = chance(0.513) ? '男' : '女'; const k = { born: a, sex: ks, name: pick(D.namesYoung[ks]) }; L.kids.push(k); say(L, `${['第一子', '第二子', '第三子'][L.kids.length - 1]}の${k.name}が生まれた。${ks}の子、${irnd(2600, 3600)}グラム。`, 'milestone'); add(L, 'happy', 10); add(L, 'bond', 6); add(L, 'health', -2); }
    }
    if (chance(D.marriage.divorceYearly * (L.s.happy < 40 ? 1.8 : 1))) {
      const half = Math.max(0, Math.round((L.money + L.inv) * 0.5));
      say(L, `${L.partner.name}と離婚した。財産分与で${yen(half)}を渡した。`, 'bad'); add(L, 'happy', -14); add(L, 'bond', -8); L.money -= half * (L.money / Math.max(1, L.money + L.inv)); L.inv -= half * (L.inv / Math.max(1, L.money + L.inv));
      L.flags.divorced = true; L.partner = null;
      if (L.kids.length && L.sex === '男') say(L, `子どもは母親と暮らすことになった。養育費は月${irnd(3, 6)}万円。`);
    }
  }
  for (const k of L.kids) {
    const ka = a - k.born;
    if (ka === 6 && chance(0.6)) say(L, `${k.name}が小学校に入った。ランドセルは${pick(['祖父母', L.partner ? L.partner.name : '自分'])}が買った。`);
    if (ka === 13 && chance(0.4)) say(L, `${k.name}が反抗期。口をきいてくれない。`); 
    if (ka === 18) { const u = chance(0.6); say(L, `${k.name}が${u ? '大学に進んだ' : '就職した'}。${u ? '入学金と学費で初年度150万円。' : ''}`); if (u) { L.money -= 150; k.univ = true; } }
    if (ka === 22 && chance(0.5)) say(L, `${k.name}が家を出た。部屋が静かになった。`);
    if (ka >= 26 && ka <= 36 && !k.married && chance(0.15)) { k.married = true; const pn = pick(D.namesYoung[other(k.sex)]); say(L, `${k.name}が${pn}さんと結婚した。${chance(0.5) ? '結婚資金として100万円を渡した。' : ''}`, 'good'); add(L, 'happy', 6); if (chance(0.5)) L.money -= 100; }
    if (k.married && ka >= 27 && ka <= 40 && L.grandkids.length < 4 && chance(0.2)) { const gs = chance(0.5) ? '男' : '女'; const g = { name: pick(D.namesYoung[gs]), born: a }; L.grandkids.push(g); say(L, `${k.name}に${gs}の子が生まれた。${L.grandkids.length === 1 ? '初めての孫、' : ''}名前は${g.name}。`, 'good'); add(L, 'happy', 8); add(L, 'bond', 4); }
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
      await decide(L, `${p.role}・${p.name}に介護が必要になった。`, [
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
    if (r < 0.06) { say(L, pick(['毎朝、近所を散歩する。', '地域の集まりに顔を出すようになった。', `${L.friend ? L.friend.name + 'と' : '昔の仲間と'}年に一度集まる。`]), 'good'); add(L, 'bond', 4); add(L, 'health', 1); }
    else if (r < 0.10) { say(L, pick(['膝が痛くて階段がつらい。', '白内障の手術をした。', '血圧の薬が増えた。'])); add(L, 'health', -3); }
    else if (r < 0.13 && L.partner?.alive) { say(L, `${L.partner.name}と${pick(['温泉', pref.spots[0], '孫の運動会'])}に行った。`, 'good'); add(L, 'happy', 5); }
    else if (r < 0.15 && !L.partner && !L.kids.length) { say(L, '一人の時間が長い。'); add(L, 'bond', -4); add(L, 'happy', -3); }
    else if (r < 0.17 && L.grandkids.length) { say(L, `孫の${L.grandkids[0].name}にお年玉。${irnd(5, 10)}千円。`, 'good'); add(L, 'happy', 3); }
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
    if (chance(qx(pAge, other(L.sex)))) { L.partner.alive = false; say(L, `${L.partner.name}が亡くなった。${pAge}歳だった。${a - L.partner.since}年いっしょにいた。`, 'bad'); add(L, 'happy', -18); add(L, 'bond', -8); add(L, 'health', -3); }
  }
  if (a >= 78 && !L.flags.care && chance(0.02 + (a - 78) * 0.012 + (L.s.health < 40 ? 0.05 : 0))) {
    L.flags.care = true; say(L, pick(['転んで骨折した。歩くのに杖が要るようになった。', '物忘れが増えた。認知症と診断された。', '脳梗塞で倒れた。左半身が動きにくい。']), 'bad'); add(L, 'health', -12);
    if (!L.partner?.alive && chance(0.5)) { say(L, L.kids.length ? `${L.kids[0].name}の近くの施設に入った。月${irnd(15, 25)}万円。` : '施設に入った。'); L.home = '施設'; L.money -= 200; }
  }
  if (a === 88 && chance(0.6)) say(L, `米寿。${L.kids.length ? L.kids.map(k => k.name).join('と') + 'が' : '親戚が'}集まった。`, 'good');
  if (a === 100) say(L, '100歳。市長から表彰された。', 'milestone');
}

/* ---------- お金 ---------- */
async function moneyDecisions(L, pref) {
  const a = L.age;
  if (L.working && !L.flags.firstJob) L.flags.firstJob = a;
  if (L.home === '実家' && L.working && a >= 22 && a <= 32 && chance(0.3)) { L.home = '一人暮らし'; say(L, `実家を出て一人暮らしを始めた。家賃${pref.urban >= 0.8 ? irnd(7, 9) : irnd(4, 6)}万円。`); add(L, 'bond', -2); add(L, 'happy', 3); }
  if (L.working && !L.flags.saveAsked && a >= 23 && a <= 30) {
    L.flags.saveAsked = true;
    await decide(L, `給料が入るようになった。お金の使い方は？`, [
      { t: '先取りで貯金する', d: '給料の15%を別口座に', w: 45, f: () => { L.habits.saving = true; say(L, '給料日に自動で貯金する口座を作った。', 'good'); } },
      { t: '使いたいときに使う', w: 55, f: () => { } },
    ]);
  }
  if (L.working && !L.flags.nisaAsked && a >= 25 && a <= 35 && chance(0.5)) {
    L.flags.nisaAsked = true;
    await decide(L, `${L.friend ? L.friend.name : '同僚'}が「NISAで積立投資をしている」と言う。`, [
      { t: '月3万円で始める', d: '年36万円を投資信託に', w: 30, f: () => { L.nisa = 36; say(L, 'NISAを始めた。毎月3万円、世界の株に積み立てる。', 'good'); } },
      { t: '月1万円で始める', w: 30, f: () => { L.nisa = 12; say(L, 'NISAを始めた。毎月1万円。'); } },
      { t: 'よく分からないのでやらない', w: 40, f: () => { } },
    ]);
  }
  if (a >= 30 && a <= 70 && !L.flags.scamAsked && L.money > 300 && chance(0.05)) {
    L.flags.scamAsked = true;
    await decide(L, `${pick(['久しぶりに会った知人', 'SNSで知り合った人', '電話の相手'])}に「月利5%、元本保証」の投資を勧められた。`, [
      { t: '断る', w: 70, f: () => { } },
      { t: '200万円を預ける', w: 30, f: () => { if (chance(0.85)) { say(L, '連絡が取れなくなった。投資詐欺だった。200万円が消えた。', 'bad'); L.money -= 200; add(L, 'happy', -8); } else { say(L, '半年後、260万円で戻ってきた。運がよかった。'); L.money += 60; } } },
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
    await decide(L, `${pick(['週末のデリバリー', '動画の編集', 'ハンドメイド販売', 'ブログ', '週1のバイト'])}で副業をしてみる？`, [
      { t: 'やる', d: '年50万円ほど', w: 45, f: () => { L.sideIncome = 50; say(L, '副業を始めた。年に50万円ほど増える。'); add(L, 'health', -2); } },
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
    const ret = 0.06 + gauss() * 0.15; const gain = Math.round(L.inv * ret); L.inv += gain; L.invGain += gain;
    if (ret > 0.22 && L.inv > 200) say(L, `株が上がった。投資が${yen(gain)}増えて${yen(L.inv)}に。`, 'good');
    if (ret < -0.18 && L.inv > 200) { say(L, `株が暴落。投資が${yen(-gain)}減った。${chance(0.3) ? '売らずに持ち続けた。' : ''}`, 'bad'); add(L, 'happy', -3); }
    if (a >= 65 && L.inv > 0) { const draw = Math.round(L.inv * 0.04); L.inv -= draw; inc += draw; }
  }
  if (L.habits.saving && L.working) exp *= 0.92;
  L.money += inc - exp;
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
function renderStats(L) {
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
});
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function startLife(L) {
  S.life = L; show('life'); $('#log').innerHTML = ''; $('#decision').classList.add('hidden');
  $('#life-name').textContent = L.fullName; renderStats(L);
  await stepYear(L); await sleep(S.speedMs);
  while (L.alive) {
    await waitUnpaused(); L.age++;
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
  const map = $('#lifemap'); map.innerHTML = '';
  L.map.forEach((h, i) => { const c = document.createElement('i'); c.style.opacity = (0.15 + h / 100 * 0.85).toFixed(2); c.title = `${i}歳 幸せ${h}`; map.appendChild(c); });
  const rl = $('#result-log'); rl.innerHTML = ''; L.log.filter(e => e.kind !== 'choice').forEach(e => logLine(e, rl));
  const ex = CFG.exitLink || {};
  if (ex.url) { $('#exit-link').href = ex.url; $('#exit-link').textContent = ex.label; $('#exit-note').textContent = (L.job && L.job.field === '製造') ? `${job}として生きたあなたへ。${ex.note}` : ex.note; } else $('.exit').classList.add('hidden');
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
  const lines = [`${L.fullName}（${L.sex}）· ${L.job ? L.job.name : '―'}`, `${summaryOf(L)}`, `${L.livePref}で${L.home} · 純資産 ${yen(netWorth(L))}`, `${L.cause === '老衰' ? '老衰で' : L.cause + 'で'}この世を去った。`];
  lines.forEach((t, i) => c.fillText(t, 80, 420 + i * 56));
  [['健康', 'health'], ['幸せ', 'happy'], ['学び', 'learn'], ['つながり', 'bond']].forEach(([lab, k], i) => {
    const y = 690 + i * 42; c.fillStyle = 'rgba(255,255,255,.85)'; c.font = FONT(500, 28); c.textAlign = 'left'; c.fillText(lab, 80, y + 24);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(230, y + 4, 740, 20); c.fillStyle = '#fff'; c.fillRect(230, y + 4, 740 * L.s[k] / 100, 20);
  });
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = FONT(500, 30); c.fillText('人生地図：1マス＝1年、明るいほど幸せ', 80, 876);
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
