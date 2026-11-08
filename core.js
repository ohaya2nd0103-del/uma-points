// 画面・ブラウザーAPIに依存しない取引ロジック。ポイントは安全な整数、倍率はBigIntで計算する。
export const LIMIT = 9_000_000_000_000;
export const MAX_LINES = 20_000;
export const TYPES = Object.freeze({
  win: { name: '単勝', size: 1 }, place: { name: '複勝', size: 1 },
  bracket: { name: '枠連', size: 2 }, quinella: { name: '馬連', size: 2 },
  exacta: { name: '馬単', size: 2, ordered: true }, wide: { name: 'ワイド', size: 2 },
  trio: { name: '3連複', size: 3 }, trifecta: { name: '3連単', size: 3, ordered: true },
  win5: { name: 'WIN5', size: 5, ordered: true }
});
export const CATEGORIES = { central: '中央', local: '地方', overseas: '海外' };
export const SURFACES = { turf: '芝', dirt: 'ダート', jump: '障害', other: 'その他', unknown: '不明' };
export const CLASSES = { maidenDebut: '新馬', maiden: '未勝利', allowance: '条件戦', open: 'オープン', graded: '重賞', unknown: '不明' };
export const JUDGMENTS = { pending: '未判定', win: '的中', loss: '不的中', refund: '返還' };
export const METHODS = { normal: '通常', box: 'ボックス', wheel: '流し', formation: 'フォーメーション', multi: 'マルチ' };
export const fail = message => { throw new Error(message); };
export const uid = () => crypto.randomUUID();
export const clone = value => structuredClone(value);
export const iso = value => new Date(value).toISOString();
export const jpDay = value => new Date(new Date(value).getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
export const scopeKey = ids => (ids.length === 1 ? 'race:' : 'win5:') + ids.join('|');
export const balance = s => sum(s.ledger.map(e => e.amount));
export const allLines = s => s.orders.flatMap(o => o.lines);
export const scopeLines = (s, key) => allLines(s).filter(l => scopeKey(l.raceIds) === key);
export const scopeTickets = (s, key) => s.tickets.filter(t => t.scope === key);
export const isLocked = (s, id) => allLines(s).some(l => l.raceIds.includes(id));
export const selectionText = line => line.numbers.map(n => String(n).padStart(2, '0')).join(TYPES[line.kind].ordered ? ' → ' : ' − ');
export const allowedMethods = kind => kind === 'win5' ? ['formation'] : TYPES[kind]?.size === 1 ? ['normal'] : TYPES[kind]?.ordered ? Object.keys(METHODS) : ['normal', 'box', 'wheel', 'formation'];
export function sum(values) {
  const total = values.reduce((a, b) => { if (!Number.isSafeInteger(b)) fail('ポイントは整数で指定してください。'); return a + b; }, 0);
  if (!Number.isSafeInteger(total) || Math.abs(total) > LIMIT) fail('ポイントの上限を超えています。');
  return total;
}
export function initialState(now, catalog) {
  return { schema: 1, startedAt: iso(now), races: clone(catalog.races), sources: clone(catalog.sources),
    drafts: [], orders: [], tickets: [], settlementDrafts: {}, settlements: {}, revisions: [], grants: [],
    preferences: { date: jpDay(now), category: '', venue: '' },
    ledger: [{ id: 'initial', kind: 'initial', amount: 10_000, at: iso(now), reference: 'initial', note: '初期元本' }] };
}
export function grantMonths(s, now) {
  const index = date => { const [y, m] = jpDay(date).split('-').map(Number); return y * 12 + m - 1; };
  const existing = new Set(s.grants);
  for (let month = index(s.startedAt) + 1; month <= index(now); month++) {
    const key = `${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}`;
    if (existing.has(key)) continue;
    existing.add(key); s.grants.push(key);
    s.ledger.push({ id: `monthly:${key}`, kind: 'monthly', amount: 3000, at: iso(now), reference: key, note: `${key} 月次配布` });
  }
}
export function payout(stake, input) {
  if (!input || input.judgment === 'pending') fail('未判定の買い目があります。');
  if (input.judgment === 'loss') return 0;
  if (input.judgment === 'refund') return stake;
  if (input.judgment !== 'win') fail('判定を確認してください。');
  const text = String(input.odds).trim();
  if (!/^\d{1,30}(?:\.\d{1,8})?$/.test(text)) fail('倍率は正の十進数で入力してください（小数8桁まで）。');
  const [whole, fraction = ''] = text.split('.');
  const numerator = BigInt(whole + fraction);
  if (numerator <= 0n) fail('倍率は0より大きい数値で入力してください。');
  const result = BigInt(stake) * numerator / (10n ** BigInt(fraction.length));
  if (result > BigInt(LIMIT)) fail('払戻ポイントの上限を超えています。');
  return Number(result);
}
export function generate(kind, method, inputGroups, maxNumber = 18) {
  const rule = TYPES[kind];
  if (!rule || !allowedMethods(kind).includes(method)) fail('券種・購入方式を確認してください。');
  const max = kind === 'bracket' ? 8 : maxNumber;
  const groups = inputGroups.map(g => [...new Set(g)].sort((a,b) => a-b));
  if (!groups.flat().every(n => Number.isInteger(n) && n >= 1 && n <= max)) fail('番号の範囲を確認してください。');
  const result = new Map();
  const insert = nums => {
    if (!['bracket', 'win5'].includes(kind) && new Set(nums).size !== nums.length) return;
    const normalized = rule.ordered ? nums.slice() : nums.slice().sort((a,b) => a-b);
    result.set(normalized.join(','), normalized);
    if (result.size > MAX_LINES) fail('一度に選べる買い目は20,000点までです。');
  };
  const permutations = (rest, done = [], callback = insert) => {
    if (!rest.length) return callback(done);
    rest.forEach((n, i) => permutations(rest.filter((_, j) => i !== j), [...done, n], callback));
  };
  if (['normal', 'formation'].includes(method)) {
    if (groups.length !== rule.size || groups.some(g => !g.length)) fail('各選択欄で番号を選んでください。');
    if (method === 'normal' && rule.size > 1 && groups.some(g => g.length !== 1)) fail('通常は各欄から1つずつ選んでください。');
    const product = (i, nums) => i === groups.length ? insert(nums) : groups[i].forEach(n => product(i + 1, [...nums, n]));
    product(0, []);
  } else if (method === 'box') {
    if (groups.length !== 1 || groups[0].length < rule.size) fail('ボックスの番号が足りません。');
    const fill = nums => nums.length === rule.size ? insert(nums) : groups[0].filter(n => !nums.includes(n)).forEach(n => fill([...nums, n]));
    fill([]);
  } else {
    if (groups.length !== 2 || !groups[0].length || groups[0].length >= rule.size || !groups[1].length) fail('軸と相手を選んでください。');
    const others = groups[1].filter(n => !groups[0].includes(n));
    const fill = nums => {
      if (nums.length === rule.size) return method === 'multi' ? permutations(nums) : insert(nums);
      others.filter(n => !nums.includes(n)).forEach(n => fill([...nums, n]));
    };
    fill(groups[0]);
  }
  if (!result.size) fail('成立する買い目がありません。番号の重複を確認してください。');
  return [...result.values()].sort((a,b) => { for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i]-b[i]; } return 0; });
}

const dateFormatters = new Map();
export function zonedParts(value, zone) {
  if (!dateFormatters.has(zone)) dateFormatters.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, calendar: 'iso8601', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
  return Object.fromEntries(dateFormatters.get(zone).formatToParts(new Date(value)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}
export function localTimeToISO(day, time, zone, fold = 'first') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) fail('開催日・発走時刻を確認してください。');
  const [y,m,d] = day.split('-').map(Number), [h,min] = time.split(':').map(Number);
  const expected = Date.UTC(y,m-1,d,h,min);
  if (h > 23 || min > 59 || new Date(expected).toISOString().slice(0,10) !== day) fail('存在しない日時です。');
  const offsets = new Set();
  for (let step = -36; step <= 36; step += 3) {
    const t = expected + step * 3_600_000, p = zonedParts(t, zone);
    offsets.add(Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second) - t);
  }
  const candidates = [...offsets].map(o => expected-o).filter(t => {
    const p = zonedParts(t, zone); return `${p.year}-${p.month}-${p.day}` === day && `${p.hour}:${p.minute}` === time;
  }).sort((a,b) => a-b);
  if (!candidates.length) fail('開催地に存在しない時刻です。サマータイムを確認してください。');
  return iso(fold === 'last' ? candidates.at(-1) : candidates[0]);
}
export function validateRace(race) {
  if (!race.id || !CATEGORIES[race.category] || !race.venue?.trim() || !Number.isInteger(race.number) || race.number < 1 || race.number > 99) fail('競馬場・区分・レース番号を確認してください。');
  localTimeToISO(race.date, '12:00', race.zone);
  if (race.distance != null && (!Number.isInteger(race.distance) || race.distance <= 0)) fail('距離は正の整数で入力してください。');
  if (race.startAt) {
    const p = zonedParts(race.startAt, race.zone);
    if (`${p.year}-${p.month}-${p.day}` !== race.date) fail('発走時刻と開催日が一致しません。');
  }
}
export function validateDraft(s, d) {
  const rule = TYPES[d.kind];
  if (!rule || !Number.isSafeInteger(d.stake) || d.stake < 100 || d.stake % 100 || d.stake > LIMIT) fail('購入ポイントは100 pt以上、100 pt刻みです。');
  if (!Array.isArray(d.raceIds) || d.raceIds.length !== (d.kind === 'win5' ? 5 : 1) || new Set(d.raceIds).size !== d.raceIds.length || d.numbers.length !== rule.size) fail('対象レースと買い目を確認してください。WIN5は異なる5レースが必要です。');
  d.raceIds.forEach((id, i) => {
    const r = s.races.find(r => r.id === id); if (!r) fail('レースが見つかりません。');
    const max = d.kind === 'bracket' ? 8 : r.category === 'overseas' ? 30 : 18;
    if (!(d.kind === 'win5' ? [d.numbers[i]] : d.numbers).every(n => Number.isInteger(n) && n >= 1 && n <= max)) fail('馬番・枠番号の範囲を確認してください。');
    if (r.confirmedKinds && !r.confirmedKinds.includes(d.kind)) fail('このレースで発売が確認されていない券種です。');
  });
  if (!['win5','bracket'].includes(d.kind) && new Set(d.numbers).size !== d.numbers.length) fail('同じ馬番を重複して選べません。');
}
export function deadline(s, ids) {
  const times = ids.map(id => { const r = s.races.find(r => r.id === id); if (!r?.startAt) fail('購入前に発走予定時刻を登録してください。'); return new Date(r.startAt).getTime(); });
  if (!times.length || times.some(t => !Number.isFinite(t))) fail('発走予定時刻を確認してください。');
  return Math.min(...times);
}
const draftKey = d => JSON.stringify([d.raceIds,d.kind,d.numbers]);
export function preview(s, now) {
  const lines = s.drafts.filter(d => { try { return new Date(now).getTime() < deadline(s, d.raceIds); } catch { return false; } });
  return { lines: clone(lines), total: sum(lines.map(d => d.stake)), balanceBefore: balance(s), excluded: s.drafts.length-lines.length };
}
export function settlementDraft(s, key, now) {
  const version = s.settlements[key]?.version || 0;
  const existing = s.settlementDrafts[key]?.baseVersion === version ? s.settlementDrafts[key] : null;
  const inputs = clone(existing?.inputs || s.settlements[key]?.inputs || {});
  scopeLines(s,key).forEach(l => { inputs[l.id] ||= { judgment: 'pending', odds: '' }; });
  return { scope: key, inputs, baseVersion: version, updatedAt: existing?.updatedAt || iso(now) };
}
export function dispatch(s, action, p = {}, now = Date.now(), catalog) {
  if (action === 'refresh') { grantMonths(s,now); return; }
  if (action === 'preferences') { Object.assign(s.preferences,p); return; }
  if (action === 'raceSave') {
    if (isLocked(s,p.id)) fail('購入済みのレース情報は変更できません。');
    validateRace(p); const i = s.races.findIndex(r => r.id === p.id);
    if (i < 0) s.races.push(clone(p)); else s.races[i] = clone(p); return p.id;
  }
  if (action === 'raceDelete') {
    if (isLocked(s,p.id)) fail('購入済みのレースは削除できません。');
    if (!s.races.find(r => r.id === p.id)?.manual) fail('公式の登録レースは削除できません。');
    s.races = s.races.filter(r => r.id !== p.id); s.drafts = s.drafts.filter(d => !d.raceIds.includes(p.id)); return;
  }
  if (action === 'draftAdd') {
    const keys = new Set(s.drafts.map(draftKey)); let count = 0;
    p.lines.forEach(original => {
      const d = clone(original); if (!TYPES[d.kind]?.ordered) d.numbers.sort((a,b) => a-b);
      validateDraft(s,d); const key = draftKey(d);
      if (!keys.has(key)) { if (s.drafts.length >= MAX_LINES) fail('購入予定は20,000点までです。'); keys.add(key); s.drafts.push(d); count++; }
    }); return count;
  }
  if (action === 'draftDelete') { s.drafts = s.drafts.filter(d => d.id !== p.id); return; }
  if (action === 'draftStake') {
    const d = s.drafts.find(d => d.id === p.id); if (!d) fail('購入予定が更新されました。開き直してください。');
    d.stake = p.stake; validateDraft(s,d); return;
  }
  if (action === 'purchase') {
    const previous = s.orders.find(o => o.id === p.token); if (previous) return clone(previous);
    grantMonths(s,now); const expected = p.preview;
    if (!expected?.lines.length || new Set(expected.lines.map(d => d.id)).size !== expected.lines.length) fail('購入可能な買い目がありません。');
    expected.lines.forEach(d => {
      if (JSON.stringify(s.drafts.find(x => x.id === d.id)) !== JSON.stringify(d)) fail('購入予定が更新されました。確認画面を開き直してください。');
      validateDraft(s,d); if (new Date(now).getTime() >= deadline(s,d.raceIds)) fail('発走予定時刻を過ぎたため締切です。');
    });
    const total = sum(expected.lines.map(d => d.stake));
    if (balance(s) < total || balance(s) < 100) fail('ポイント不足のため購入できません。');
    if (total !== expected.total || balance(s) !== expected.balanceBefore) fail('残高が更新されました。確認画面を開き直してください。');
    const order = { id: p.token, at: iso(now), lines: clone(expected.lines) };
    s.orders.push(order); s.ledger.push({ id: `purchase:${p.token}`, kind: 'purchase', amount: -total, at: iso(now), reference: p.token, note: `馬券購入 ${order.lines.length}点` });
    const groups = new Map(); order.lines.forEach(l => { const k = `${scopeKey(l.raceIds)}:${l.kind}`; if (!groups.has(k)) groups.set(k,[]); groups.get(k).push(l); });
    groups.forEach(lines => s.tickets.push({ id: uid(), orderId: p.token, at: iso(now), scope: scopeKey(lines[0].raceIds), races: clone(lines[0].raceIds.map(id => s.races.find(r => r.id === id))), kind: lines[0].kind, lines: clone(lines) }));
    const ids = new Set(expected.lines.map(d => d.id)); s.drafts = s.drafts.filter(d => !ids.has(d.id)); return clone(order);
  }
  if (action === 'settlementInput' || action === 'markLoss') {
    const draft = settlementDraft(s,p.scope,now);
    if (draft.baseVersion !== p.baseVersion) fail('精算結果が更新されました。開き直してください。');
    if (action === 'settlementInput') { if (!scopeLines(s,p.scope).some(l => l.id === p.lineId) || !JUDGMENTS[p.input.judgment]) fail('精算対象を確認してください。'); draft.inputs[p.lineId] = clone(p.input); }
    else Object.values(draft.inputs).forEach(input => { if (input.judgment === 'pending') input.judgment = 'loss'; });
    draft.updatedAt = iso(now); s.settlementDrafts[p.scope] = draft; return;
  }
  if (action === 'settle') {
    const previous = s.revisions.find(r => r.id === p.token);
    if (previous) { if (previous.scope !== p.scope) fail('処理IDが一致しません。'); return { total: previous.after.total, delta: previous.delta, first: false, winningIds: [] }; }
    const lines = scopeLines(s,p.scope); if (!lines.length) fail('購入した買い目がありません。');
    if (!lines.flatMap(l => l.raceIds).every(id => { const r = s.races.find(r => r.id === id); return r?.startAt && new Date(r.startAt).getTime() <= new Date(now).getTime(); })) fail('対象すべての発走予定時刻を過ぎてから精算できます。');
    const before = s.settlements[p.scope] || null, draft = settlementDraft(s,p.scope,now);
    if ((before?.version || 0) !== p.baseVersion || draft.baseVersion !== p.baseVersion) fail('精算結果が更新されました。開き直してください。');
    const byLine = Object.fromEntries(lines.map(l => [l.id,payout(l.stake,draft.inputs[l.id])]));
    const total = sum(Object.values(byLine)), delta = total-(before?.total || 0);
    const after = { scope: p.scope, inputs: clone(draft.inputs), byLine, total, at: before?.at || iso(now), updatedAt: iso(now), version: p.baseVersion+1 };
    s.settlements[p.scope] = after; delete s.settlementDrafts[p.scope];
    s.revisions.push({ id: p.token, scope: p.scope, before: clone(before), after: clone(after), delta, at: iso(now) });
    s.ledger.push({ id: `settlement:${p.token}`, kind: before ? 'correction' : 'payout', amount: delta, at: iso(now), reference: p.scope, note: before ? '精算修正差額' : '払戻精算' });
    return { total, delta, first: !before, winningIds: before ? [] : scopeTickets(s,p.scope).filter(t => t.lines.some(l => after.inputs[l.id].judgment === 'win')).map(t => t.id) };
  }
  if (action === 'reset') { const fresh = initialState(now,catalog); Object.keys(s).forEach(k => delete s[k]); Object.assign(s,fresh); return; }
  fail('対応していない操作です。');
}
export function assertState(s) {
  if (s.schema !== 1) fail('対応していない保存形式です。既存データは消去しません。');
  const unique = values => new Set(values).size === values.length;
  for (const records of [s.races,s.drafts,s.orders,s.tickets,s.ledger,s.revisions,allLines(s)]) if (!unique(records.map(r => r.id))) fail('保存データに重複した記録があります。');
  if (!unique(s.grants) || s.ledger.filter(e => e.kind === 'initial').length !== 1 || s.ledger.find(e => e.kind === 'initial').amount !== 10_000) fail('初期元本・配布記録が一致しません。');
  balance(s);
  s.grants.forEach(key => { if (!s.ledger.some(e => e.id === `monthly:${key}` && e.amount === 3000 && e.kind === 'monthly')) fail('月次配布と台帳が一致しません。'); });
  s.orders.forEach(o => {
    if (!s.ledger.some(e => e.id === `purchase:${o.id}` && e.amount === -sum(o.lines.map(l => l.stake)))) fail('購入と台帳が一致しません。');
    const printed = s.tickets.filter(t => t.orderId === o.id).flatMap(t => t.lines).sort((a,b) => a.id.localeCompare(b.id));
    if (JSON.stringify(printed) !== JSON.stringify(clone(o.lines).sort((a,b) => a.id.localeCompare(b.id)))) fail('購入と券面が一致しません。');
  });
  Object.entries(s.settlements).forEach(([key,result]) => {
    const lines = scopeLines(s,key);
    if (lines.length !== Object.keys(result.inputs).length || lines.length !== Object.keys(result.byLine).length) fail('精算対象が一致しません。');
    lines.forEach(l => { if (payout(l.stake,result.inputs[l.id]) !== result.byLine[l.id]) fail('払戻結果が一致しません。'); });
    if (sum(Object.values(result.byLine)) !== result.total || sum(s.ledger.filter(e => e.reference === key && ['payout','correction'].includes(e.kind)).map(e => e.amount)) !== result.total) fail('精算と台帳が一致しません。');
  });
}

export function inPeriod(value, period, anchor) {
  if (period === 'all') return true;
  const day = jpDay(value), base = jpDay(anchor);
  if (period === 'year') return day.slice(0,4) === base.slice(0,4);
  if (period === 'month') return day.slice(0,7) === base.slice(0,7);
  const date = new Date(base+'T00:00:00+09:00'), offset = (new Date(date.getTime()+9*3_600_000).getUTCDay()+6)%7;
  const start = date.getTime()-offset*86_400_000, time = new Date(value).getTime();
  return time >= start && time < start+7*86_400_000;
}
export function performances(s, period = 'all', anchor = Date.now()) {
  return Object.entries(s.settlements).flatMap(([key,result]) => {
    const lines = scopeLines(s,key), race = s.races.find(r => r.id === lines[0]?.raceIds[0]);
    if (!race?.startAt || !inPeriod(race.startAt,period,anchor)) return [];
    const cost = sum(lines.map(l => l.stake));
    return [{ key, race, lines, cost, payout: result.total, profit: result.total-cost, win: Object.values(result.inputs).some(i => i.judgment === 'win'), win5: lines[0].kind === 'win5' }];
  }).sort((a,b) => a.race.startAt.localeCompare(b.race.startAt));
}
export function metrics(items) {
  const cost = sum(items.map(i => i.cost)), returned = sum(items.map(i => i.payout)), wins = items.filter(i => i.win).length;
  return { count: items.length, wins, cost, payout: returned, profit: returned-cost, hitRate: items.length ? wins/items.length*100 : null, returnRate: cost ? returned/cost*100 : null,
    maxPayout: items.length ? Math.max(...items.map(i => i.payout)) : null, maxProfit: items.length ? Math.max(0,...items.map(i => i.profit)) : null, maxLoss: items.length ? Math.min(0,...items.map(i => i.profit)) : null, average: items.length ? cost/items.length : null };
}
export function classify(s, items, dimension) {
  const groups = new Map(); const put = (key,item) => { if (!groups.has(key)) groups.set(key,[]); groups.get(key).push(item); };
  items.forEach(item => {
    if (dimension === 'kind') {
      Object.keys(TYPES).forEach(kind => {
        const lines = item.lines.filter(l => l.kind === kind); if (!lines.length) return;
        const result = s.settlements[item.key], cost = sum(lines.map(l => l.stake)), returned = sum(lines.map(l => result.byLine[l.id]));
        put(TYPES[kind].name,{...item,lines,cost,payout:returned,profit:returned-cost,win:lines.some(l => result.inputs[l.id].judgment === 'win')});
      }); return;
    }
    if (item.win5) { put('WIN5（横断）',item); return; }
    const r = item.race, d = r.distance;
    const key = { category: CATEGORIES[r.category], venue:r.venue, surface:SURFACES[r.surface], grade:r.grade || '不明', class:CLASSES[r.class] || '不明',
      distance: d == null ? '不明' : d < 1400 ? '1,400m未満' : d < 1800 ? '1,400〜1,799m' : d < 2200 ? '1,800〜2,199m' : d < 2800 ? '2,200〜2,799m' : '2,800m以上',
      weekday: ['日曜日','月曜日','火曜日','水曜日','木曜日','金曜日','土曜日'][new Date(jpDay(r.startAt)+'T00:00:00Z').getUTCDay()] }[dimension] || '不明';
    put(key,item);
  });
  return [...groups].map(([label,items]) => ({ label,...metrics(items) }));
}
