import { catalog } from './catalog.js';
import { LocalStore } from './storage.js';
import { TYPES,CATEGORIES,SURFACES,CLASSES,JUDGMENTS,METHODS,uid,jpDay,zonedParts,localTimeToISO,scopeKey,balance,allLines,scopeLines,scopeTickets,isLocked,selectionText,allowedMethods,generate,preview,settlementDraft,payout,sum,dispatch,performances,metrics,classify,inPeriod } from './core.js';
import { escapeHTML as h,paperHTML,pageCount,shareTicket } from './tickets.js';
import { gameCalendar,gamePeriod,currentGamePeriod,filterPrograms,raceFromProgram,calendarMigration,gradeClass } from './game-calendar.js';

const $ = selector => document.querySelector(selector);
const main = $('#main'), dialog = $('#dialog');
const pt = value => `${value.toLocaleString('ja-JP')} pt`;
const rate = value => value == null ? '—' : `${value.toLocaleString('ja-JP',{maximumFractionDigits:1})}%`;
const dateText = (value, zone='Asia/Tokyo') => value ? new Intl.DateTimeFormat('ja-JP',{timeZone:zone,month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)) : '時刻未登録';
const timeText = r => r.startAt ? `${zonedParts(r.startAt,r.zone).hour}:${zonedParts(r.startAt,r.zone).minute}` : '時刻未登録';
const totalOf = lines => sum(lines.map(l=>l.stake));
const titleOf = r => `${r.venue} ${r.number}R`;
const scopeTitle = key => { const ticket = scopeTickets(state,key)[0]; return ticket?.kind==='win5'?'WIN5（5レース）':ticket?titleOf(ticket.races[0]):'レース'; };
const routeLink = (route,text,css='text-button') => `<button class="${css}" data-route="${h(route)}">${text}</button>`;
const optionList = (object,value,includeAll=false) => `${includeAll?'<option value="">すべて</option>':''}${Object.entries(object).map(([id,label])=>`<option value="${h(id)}" ${id===value?'selected':''}>${h(typeof label==='object'?label.name:label)}</option>`).join('')}`;
const field = (label,name,type,value,extra='') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${h(value)}" ${extra}></label>`;
const row = (label,value) => `<div class="row"><span>${label}</span><span class="mono">${value}</span></div>`;
const legal = '<div class="legal">架空ポイント・換金不可</div>';
const icons = {
 ticket:'<path d="M3 7h18v4a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V7Z"/><path d="M15 8v2m0 3v2m0 2v1"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
 list:'<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h1m3 0h5M8 12h1m3 0h5M8 16h1m3 0h5"/>',
 chart:'<path d="M4 4v16h17M7 15l4-5 4 3 5-7"/>',
 gear:'<path d="m10 3-.7 2.4-2.5 1L4.6 6 3 9l1.7 1.8v2.5L3 15l1.6 3 2.2-.4 2.5 1 .7 2.4h4l.7-2.4 2.5-1 2.2.4 1.6-3-1.7-1.7v-2.5L21 9l-1.6-3-2.2.4-2.5-1L14 3h-4Z"/><circle cx="12" cy="12" r="3"/>',
 back:'<path d="m14 5-7 7 7 7"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
let state,store,ui={compose:null,history:{},analysis:{period:'all',anchor:jpDay(Date.now()),dimension:'category',balance:false,bars:false},checkout:null},toastTimer,dialogResolve,dialogHandler,saving=Promise.resolve(),animationTimer,animationContext,workerRegistration;
let busy=false;

function go(route) { if (location.hash.slice(1)===route) render(); else location.hash=route; }
function toast(message) { clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000); }
function errorMessage(error) { const element=$('#page-error');if(element){element.textContent=error.message; element.hidden=false;}else toast(error.message || String(error)); }
async function run(action,payload={},redraw=true) {
  const result=await store.update(s=>{const result=dispatch(s,action,payload,Date.now(),catalog);if(action==='reset')calendarMigration(s);return result;});state=result.state;if(redraw)render();return result.result;
}
function warning() { return balance(state)<100?`<p class="warning">${balance(state)<0?'精算修正で残高が負になっています。':'ポイントが不足しています。'}新規購入は停止中です。精算・履歴は利用できます。</p>`:''; }
function errorBox() { return '<p id="page-error" class="error" role="alert" hidden></p>'; }
function empty(title,body,action='') { return `<div class="empty"><strong>${title}</strong>${body}${action?`<div class="actions">${action}</div>`:''}</div>`; }
function currentRoute() { const [page='races',encoded='']=(location.hash.slice(1)||'races').split('/');let id='';try{id=decodeURIComponent(encoded);}catch{}return {page,id}; }
function header(title,back='') {
  $('#header').innerHTML=`${back?routeLink(back,`${icon('back')}<span>戻る</span>`,'back'):''}<h1>${h(title)}</h1><button class="balance ${balance(state)<0?'danger':''}" data-route="points" aria-label="保有ポイント ${pt(balance(state))}。増減履歴を開く"><small>保有ポイント</small>${pt(balance(state))}</button>`;
}
function render() {
  if(!state)return;
  clearTimeout(animationTimer);animationTimer=null;
  const {page,id}=currentRoute();
  const active={race:'races',program:'races',dates:'races',editor:'races',compose:'races',win5:'races',cart:'races',checkout:'races',scope:'purchased',ticket:'purchased',settle:'purchased',points:'settings',machine:'purchased'}[page]||page;
  $('#tabs').innerHTML=[['purchased','購入済み','ticket'],['history','履歴','clock'],['races','レース','list'],['analysis','分析','chart'],['settings','設定','gear']].map(([route,label,name])=>`<button data-route="${route}" class="${route==='races'?'center':''}" ${active===route?'aria-current="page"':''}>${icon(name)}<span>${label}</span></button>`).join('');
  const pages={races:renderRaces,dates:renderDateRaces,program:()=>renderProgram(id),race:()=>renderRace(id),editor:()=>renderEditor(id),compose:()=>renderCompose(id),win5:renderWin5,cart:renderCart,checkout:renderCheckout,purchased:renderPurchased,scope:()=>renderScope(id),ticket:()=>renderTicket(id),settle:()=>renderSettlement(id),history:renderHistory,analysis:renderAnalysis,settings:renderSettings,points:renderPoints,machine:renderMachine};
  try {(pages[page]||renderRaces)();bindHold();}catch(error){header('読み込みエラー','races');main.innerHTML=`<div class="section"><p class="error">${h(error.message)}</p>${routeLink('races','レースへ戻る','secondary')}</div>`;}
}
function gradeBadge(grade) {return grade?`<span class="grade-badge ${gradeClass(grade)}">${h(grade)}</span>`:'';}
function originOf(r) {return r.calendarOrigin||r.gameOrigin;}
function raceRow(r) {
  const closed=r.startAt&&new Date(r.startAt).getTime()<=Date.now();
  return `<button class="race ${gradeClass(r.grade)}" data-route="race/${h(r.id)}"><span class="race-number">${r.number}R</span><span class="race-info"><strong>${h(r.name||titleOf(r))}</strong>${gradeBadge(r.grade)}<small>${h(r.venue)} · ${h(SURFACES[r.surface])}${r.distance?` ${r.distance}m`:''}${r.runners?` · ${r.runners}頭`:''}</small></span><span class="race-time">${timeText(r)}<small>${!r.startAt?'時刻未登録':closed?'締切済み':'購入可能'}</small></span><span class="chevron">›</span></button>`;
}
function programRow(program) {
  const badge=gradeBadge(program.grade)||`<span class="class-badge">${h({'新馬':'新馬','未勝利':'未勝利','1勝クラス':'1勝','2勝クラス':'2勝','3勝クラス':'3勝','OP':'OP'}[program.condition])}</span>`;
  return `<button class="race program-row ${gradeClass(program.grade)}" data-route="program/${h(program.id)}">${badge}<span class="race-info"><strong>${h(program.name)}</strong><small>${program.category==='local'?'地方 · ':''}${h(program.venue)} · ${h(program.age)} · ${h(SURFACES[program.surface])} ${program.distance}m${program.symbols.length?' · '+h(program.symbols.join('・')):''}</small></span><span class="chevron">›</span></button>`;
}
function renderRaces() {
  header('レース');const p=state.preferences,period=gamePeriod(p.gameMonth,p.gameWeek),weeks=gameCalendar.periods.filter(slot=>slot.month===period.month);
  const base=filterPrograms({month:period.month,week:period.week,category:p.gameCategory}),venues=[...new Set(base.map(r=>r.venue))].sort((a,b)=>a.localeCompare(b,'ja'));
  const programs=filterPrograms({month:period.month,week:period.week,category:p.gameCategory,venue:p.gameVenue,condition:p.gameCondition});
  const conditions={graded:'重賞すべて',grade1:'GⅠ・JpnⅠ',grade2:'GⅡ・JpnⅡ',grade3:'GⅢ・JpnⅢ','新馬':'新馬','未勝利':'未勝利','1勝クラス':'1勝クラス','2勝クラス':'2勝クラス','3勝クラス':'3勝クラス',OP:'オープン'};
  const graded=programs.filter(r=>r.class==='graded'),others=programs.filter(r=>r.class!=='graded');
  main.innerHTML=`${warning()}<section class="section"><div class="section-title"><h2>年間カレンダー</h2>${routeLink('dates','開催日で探す　›')}</div><div class="field-grid"><label class="field"><span>月</span><select id="game-month">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${period.month===i+1?'selected':''}>${i+1}月</option>`).join('')}</select></label><label class="field"><span>開催週</span><select id="game-week">${weeks.map(slot=>`<option value="${slot.week}" ${slot.week===period.week?'selected':''}>第${slot.week}週</option>`).join('')}</select></label><label class="field"><span>競馬区分</span><select id="game-category">${optionList({central:'中央',local:'地方'},p.gameCategory,true)}</select></label><label class="field"><span>競馬場</span><select id="game-venue"><option value="">すべて</option>${venues.map(v=>`<option ${v===p.gameVenue?'selected':''}>${h(v)}</option>`).join('')}</select></label></div><label class="field"><span>クラス・重賞格</span><select id="game-condition">${optionList(conditions,p.gameCondition,true)}</select></label><div class="grade-legend" aria-label="重賞の色分け"><span class="grade-badge grade-1">GⅠ / JpnⅠ</span><span class="grade-badge grade-2">GⅡ / JpnⅡ</span><span class="grade-badge grade-3">GⅢ / JpnⅢ</span></div><p class="note">例年の開催週を目安にした内蔵番組です。レースを選んで開催日・締切を設定できます。</p></section><section class="section"><div class="section-title"><h2>${period.label} · ${programs.length}レース</h2><button class="text-button" data-action="game-current">今の月・週</button></div>${graded.length?`<h3 class="calendar-heading">今週の重賞 <small>${graded.length}レース</small></h3>${graded.map(programRow).join('')}`:''}${others.length?`<h3 class="calendar-heading">${graded.length?'その他のレース':'レース一覧'}</h3>${others.map(programRow).join('')}`:''}${!programs.length?empty('該当するレースはありません','月・週・クラス・競馬場を変更してください。'):''}</section><section class="section"><div class="row"><h2>購入予定</h2>${routeLink('cart',`${state.drafts.length}点を確認　›`)}</div>${routeLink('editor','＋ レースを追加')}<p class="note">中央重賞130・地方ダートグレード46を内蔵。新馬・未勝利などの一般競走も収録しています。</p></section>${legal}`;
}
function renderProgram(id) {
  const program=gameCalendar.programs.find(p=>p.id===id);if(!program)throw new Error('レースが見つかりません。');header('レース情報','races');
  const scheduled=state.races.filter(r=>originOf(r)?.programId===id);
  main.innerHTML=`<section class="section"><div class="race-title">${gradeBadge(program.grade)}<h2>${h(program.name)}</h2></div>${row('開催週の目安',`${program.month}月 第${program.week}週`)}${row('競馬区分',program.category==='local'?'地方':'中央')}${row('競馬場',h(program.venue))}${row('年齢条件',h(program.age))}${row('クラス',h(program.condition==='OP'?'オープン':program.condition))}${row('馬場・距離',`${h(SURFACES[program.surface])} ${program.distance}m`)}${program.symbols.length?row('条件',h(program.symbols.join('・'))):''}<p class="note">開催週は年間の目安です。開催日・レース番号・購入締切を設定して購入に進みます。</p><div class="actions">${routeLink(`editor/${encodeURIComponent('program:'+id)}`,'開催日・締切を設定する','primary full')}</div></section>${scheduled.length?`<section class="section"><h2>開催日を設定したレース</h2>${scheduled.map(raceRow).join('')}</section>`:''}<section class="section"><details><summary>番組情報の出典</summary>${gameCalendar.sources.filter(s=>program.sourceIDs.includes(s.id)).map(s=>`<p class="note"><a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.title)}</a><br>${h(s.coverage)}</p>`).join('')}</details></section>${legal}`;
}
function renderDateRaces() {
  header('開催日で探す','races');const p=state.preferences,races=state.races.filter(r=>r.date===p.date&&(!p.category||r.category===p.category)&&(!p.venue||r.venue===p.venue)).sort((a,b)=>a.venue.localeCompare(b.venue,'ja')||a.number-b.number),venues=[...new Set(state.races.filter(r=>r.date===p.date).map(r=>r.venue))].sort();
  main.innerHTML=`${warning()}<section class="section"><div class="date-row"><input class="control" type="date" id="race-date" aria-label="開催日" value="${p.date}"><button class="text-button" data-action="today">今日に戻る</button></div><div class="filter-grid"><label class="field"><span>競馬区分</span><select id="race-category">${optionList(CATEGORIES,p.category,true)}</select></label><label class="field"><span>競馬場</span><select id="race-venue"><option value="">すべて</option>${venues.map(v=>`<option ${v===p.venue?'selected':''}>${h(v)}</option>`).join('')}</select></label></div><div class="section-title"><h2>${p.date} · ${races.length}レース</h2>${routeLink('editor','＋ レースを追加')}</div>${races.length?races.map(raceRow).join(''):empty('この日のレースは未設定です','年間カレンダーから選ぶか、手動で追加してください。',routeLink('races','年間カレンダーへ','secondary'))}</section><section class="section"><div class="row"><h2>購入予定</h2>${routeLink('cart',`${state.drafts.length}点を確認　›`)}</div>${routeLink('win5','WIN5を選ぶ　›')}</section>${legal}`;
}
function renderRace(id) {
  const r=state.races.find(r=>r.id===id);if(!r)throw new Error('レースが見つかりません。');header(titleOf(r),'races');
  const locked=isLocked(state,id),closed=r.startAt&&new Date(r.startAt).getTime()<=Date.now();
  main.innerHTML=`<section class="section"><div class="race-title">${gradeBadge(r.grade)}<h2>${h(r.name||titleOf(r))}</h2></div>${row('開催日',h(r.date))}${row('発走予定（現地）',h(timeText(r)))}${row('競馬区分',h(CATEGORIES[r.category]))}${row('開催地',h(r.country||'不明'))}${row('タイムゾーン',h(r.zone))}${r.category==='overseas'?row('日本時間',h(dateText(r.startAt))):''}${row('馬場・距離',h(SURFACES[r.surface])+(r.distance?` ${r.distance}m`:' · 距離不明'))}${row('レース格',h(r.grade||'不明'))}<p class="note">${originOf(r)?'内蔵カレンダーから開催日・締切を設定したレースです。':r.manual?'手動登録のレースです。':'公式番組で確認済み。発走時刻は手動補完が必要です。'}</p></section>${warning()}<section class="section">${!r.startAt?routeLink(`editor/${id}`,'発走時刻を登録して購入','primary full'):!closed&&balance(state)>=100?routeLink(`compose/${id}`,'馬番・券種を選ぶ','primary full'):`<p class="warning">${closed?'発走予定時刻を過ぎたため締切済みです。':'ポイント不足のため新規購入はできません。'}</p>`}<div class="actions">${routeLink('cart','購入予定を開く','secondary')}${locked?routeLink(`scope/${encodeURIComponent(scopeKey([id]))}`,'購入した紙馬券・精算','secondary'):routeLink(`editor/${id}`,'レース情報を編集','secondary')}</div><p class="note">締切は発走予定時刻ちょうどです。実際の発売締切とは異なるアプリ独自のルールです。</p></section><section class="section"><h2>出典</h2>${r.sourceIDs?.length?state.sources.filter(s=>r.sourceIDs.includes(s.id)).map(s=>`<p class="note"><a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.title)}</a><br>確認日 ${h(s.checkedOn)}<br>${h(s.coverage)}</p>`).join(''):'<p class="note">手動登録のため公式情報との照合は行っていません。</p>'}</section>${legal}`;
}
function renderEditor(id) {
  const program=id.startsWith('program:')?gameCalendar.programs.find(p=>p.id===id.slice(8)):null;
  if(id.startsWith('program:')&&!program)throw new Error('参考の番組が見つかりません。');
  const existing=state.races.find(r=>r.id===id);if(existing&&isLocked(state,id))throw new Error('購入済みレースは変更できません。');
  const t=zonedParts(Date.now()+3_600_000,existing?.zone||'Asia/Tokyo');
  const r=existing||(program?raceFromProgram(program):{id:uid(),date:state.preferences.date||jpDay(Date.now()),category:'central',country:'日本',venue:'',number:1,name:'',surface:'unknown',distance:null,grade:null,class:'unknown',zone:'Asia/Tokyo',manual:true,sourceIDs:[],startAt:null});
  const time=existing?.startAt?timeText(existing):program?'':`${t.hour}:${t.minute}`,lock=existing&&!r.manual?'disabled':'';ui.editRace=r;
  header(existing?'レースを編集':program?'購入用レースを作成':'レースを追加',existing?`race/${id}`:program?`program/${program.id}`:'races');
  main.innerHTML=`${originOf(r)?`<p class="notice">年間カレンダー · ${originOf(r).month}月 第${originOf(r).week}週。開催日・番号・購入締切を設定してください。</p>`:''}
    <form id="race-form"><section class="section"><h2>開催情報</h2><div class="field-grid">${field(originOf(r)?'開催日（アプリ内）':'開催日（現地）','date','date',r.date,`required ${lock}`)}<label class="field"><span>競馬区分</span><select name="category" ${lock}>${optionList(CATEGORIES,r.category)}</select></label></div>
    ${field('国・地域','country','text',r.country,lock)}${field('競馬場','venue','text',r.venue,`required maxlength="60" ${lock}`)}<div class="field-grid">${field(originOf(r)?'レース番号（アプリ内）':'レース番号','number','number',r.number,`required min="1" max="99" ${lock}`)}${field('レース名（省略可）','name','text',r.name,`maxlength="100" ${lock}`)}</div></section>
    <section class="section"><h2>${originOf(r)?'購入の締切時刻（アプリ内）':'発走予定時刻'}</h2><label class="field"><span>開催地のタイムゾーン</span><select name="zone" ${lock}>${['Asia/Tokyo','Europe/London','Europe/Paris','America/New_York','America/Los_Angeles','Australia/Sydney','Asia/Hong_Kong','Asia/Dubai','America/Chicago','Australia/Melbourne','Asia/Seoul','Pacific/Auckland'].map(z=>`<option ${z===r.zone?'selected':''}>${z}</option>`).join('')}</select></label>
    <label class="field inline"><span>時刻を登録する</span><input type="checkbox" name="hasTime" ${r.startAt||!existing?'checked':''}></label>${field(originOf(r)?'締切時刻（アプリ内・現地時間）':'発走予定時刻（現地）','time','time',time)}<label class="field"><span>時計が戻る日に同じ時刻が2回ある場合</span><select name="fold"><option value="first">1回目の時刻</option><option value="last">2回目の時刻</option></select></label></section>
    <section class="section"><h2>レース条件</h2><div class="field-grid"><label class="field"><span>馬場</span><select name="surface" ${lock}>${optionList(SURFACES,r.surface)}</select></label>${field('距離（m・不明なら空欄）','distance','number',r.distance||'',`min="1" ${lock}`)}</div><label class="field"><span>競走条件</span><select name="class" ${lock}>${optionList(CLASSES,r.class)}</select></label>${field('格付け（不明なら空欄）','grade','text',r.grade||'',lock)}
    <p class="note">1件でも購入を確定すると、このレースの変更・削除はできません。未確認の項目は推測せず空欄にしてください。</p>${errorBox()}<button class="primary full" type="submit">保存する</button></section></form>${existing?.manual?`<div class="section"><button class="destructive full" data-action="race-delete" data-id="${h(id)}">このレースと購入予定を削除</button></div>`:''}`;
}
function getComposer(id,win5=false) {
  if(ui.compose?.key!==id)ui.compose={key:id,kind:win5?'win5':'win',method:win5?'formation':'normal',active:0,groups:[[],[],[],[],[]],raceIds:win5?['','','','','']:[id]};return ui.compose;
}
function groupCount(c) { return c.method==='box'?1:['wheel','multi'].includes(c.method)?2:TYPES[c.kind].size; }
function groupName(c,index) { return c.kind==='win5'?`第${index+1}対象`:['wheel','multi'].includes(c.method)?index?'相手':'軸':c.method==='box'?'選択番号':TYPES[c.kind].ordered?`${index+1}着`:`${index+1}頭目`; }
function comboResult(c,max=18) { try {return {lines:generate(c.kind,c.method,c.groups.slice(0,groupCount(c)),max)};}catch(error){return {lines:[],error:error.message};} }
function numberRows(c,max) {return `<div class="number-list">${Array.from({length:max},(_,i)=>i+1).map(n=>`<button class="number-choice" aria-label="${n}番" aria-pressed="${c.groups[c.active].includes(n)}" data-action="number" data-number="${n}"><strong>${String(n).padStart(2,'0')}</strong><span class="tick" aria-hidden="true">✓</span></button>`).join('')}</div>`;}
function selectionSummary(c) {return `<div class="selection-summary">${Array.from({length:groupCount(c)},(_,i)=>`<div>${groupName(c,i)}：${c.groups[i].join('・')||'未選択'}</div>`).join('')}</div>`;}
function renderCompose(id) {
  const r=state.races.find(r=>r.id===id);if(!r)throw new Error('レースが見つかりません。');header('買い目を選ぶ',`race/${id}`);const c=getComposer(id),max=c.kind==='bracket'?8:r.category==='overseas'?30:18,result=comboResult(c,max);
  main.innerHTML=`<section class="section"><h2>${h(titleOf(r))} · ${timeText(r)}</h2><div class="field-grid"><label class="field"><span>券種</span><select id="bet-kind">${optionList(Object.fromEntries(Object.entries(TYPES).filter(([kind])=>kind!=='win5'&&(!r.confirmedKinds||r.confirmedKinds.includes(kind)))),c.kind)}</select></label><label class="field"><span>購入方式</span><select id="bet-method">${optionList(Object.fromEntries(allowedMethods(c.kind).map(m=>[m,METHODS[m]])),c.method)}</select></label></div><p class="note">${r.confirmedKinds?'確認済みの券種を表示しています。':'発売券種は要確認です。ここでの選択はシミュレーション入力です。'}</p>${groupCount(c)>1?`<div class="segments">${Array.from({length:groupCount(c)},(_,i)=>`<button aria-pressed="${c.active===i}" data-action="group" data-index="${i}">${groupName(c,i)}</button>`).join('')}</div>`:''}${selectionSummary(c)}</section><section class="section"><h2>${c.kind==='bracket'?'枠番号':'馬番'}を選択</h2>${numberRows(c,max)}</section><p class="note">実際の頭数と照合しないため、存在しない馬番を選べる場合があります。海外はゲート番号ではなく馬番です。${['wheel','multi'].includes(c.method)?'流しは軸を先頭の着順に固定します。2頭軸は番号順。任意の配置はフォーメーション、全着順はマルチを使います。':''}</p><div class="sticky-action">${row('買い目',`<strong id="combo-count">${result.lines.length}点 · ${pt(result.lines.length*100)}</strong>`)}${errorBox()}<button class="primary full" data-action="draft-add" ${!result.lines.length?'disabled':''}>購入予定に追加</button>${routeLink('cart',`購入予定を確認（${state.drafts.length}点）`,'text-button full')}</div>${legal}`;
}
function renderWin5() {
  header('WIN5','races');const c=getComposer('win5',true),races=state.races.filter(r=>r.startAt&&new Date(r.startAt).getTime()>Date.now()&&(!r.confirmedKinds||r.confirmedKinds.includes('win5'))).sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const selected=races.find(r=>r.id===c.raceIds[c.active]),result=comboResult(c,30);
  main.innerHTML=`<section class="section"><p class="note">異なる5レースを順番に選び、各レースの1着を選択します。実際の対象競走・発売は利用者が確認してください。締切は5レースのうち最も早い発走時刻です。</p>${Array.from({length:5},(_,i)=>`<label class="field"><span>第${i+1}対象レース</span><select data-win5-leg="${i}"><option value="">選択してください</option>${races.map(r=>`<option value="${h(r.id)}" ${c.raceIds[i]===r.id?'selected':''}>${r.date} ${h(titleOf(r))} ${timeText(r)}</option>`).join('')}</select></label>`).join('')}<div class="segments">${Array.from({length:5},(_,i)=>`<button data-action="group" data-index="${i}" aria-pressed="${c.active===i}">第${i+1}対象</button>`).join('')}</div>${selectionSummary(c)}</section>${selected?`<section class="section"><h2>${h(titleOf(selected))} の馬番</h2>${numberRows(c,selected.category==='overseas'?30:18)}</section>`:empty('対象レースを選択','発走時刻を登録したレースが候補に表示されます。')}<div class="sticky-action">${row('買い目',`${result.lines.length}点 · ${pt(result.lines.length*100)}`)}${errorBox()}<button class="primary full" data-action="draft-add" ${result.lines.length&&new Set(c.raceIds).size===5&&!c.raceIds.includes('')?'':'disabled'}>購入予定に追加</button>${routeLink('cart','購入予定を確認','text-button full')}</div>`;
}
function draftRaceText(d) { return d.kind==='win5'?'WIN5（5レース）':titleOf(state.races.find(r=>r.id===d.raceIds[0])); }
function renderCart() {
  header('購入予定','races');const p=preview(state,Date.now());
  main.innerHTML=`${warning()}<section class="section">${row('購入可能な買い目',`${p.lines.length}点`)}${row('購入合計',pt(p.total))}${p.excluded?`<p class="note">締切済み・時刻未登録の${p.excluded}点は合計から除外しています。自動削除はしません。</p>`:''}</section>${state.drafts.length?state.drafts.map(d=>{
    let end=null;try{const times=d.raceIds.map(id=>state.races.find(r=>r.id===id)?.startAt);end=times.every(Boolean)?Math.min(...times.map(t=>new Date(t).getTime())):null;}catch{}
    const closed=end===null||end<=Date.now();
    return `<div class="bet-row"><h3>${h(draftRaceText(d))}</h3><div class="selection">${h(TYPES[d.kind].name)}　${h(selectionText(d))}</div><small class="${closed?'danger':''}">${end===null?'時刻未登録 · 合計から除外':closed?'締切済み · 合計から除外':`締切 ${h(dateText(end))}（日本時間）`}</small><div class="controls"><button class="points-edit" data-action="stake" data-id="${h(d.id)}">${pt(d.stake)}　変更</button><button class="danger" data-action="draft-delete" data-id="${h(d.id)}">削除</button></div></div>`;
  }).join(''):empty('購入予定はありません','レースから買い目を選んで追加してください。')}<div class="section">${errorBox()}<button class="primary full" data-action="checkout" ${!p.lines.length||balance(state)<100?'disabled':''}>購入内容を確認</button><p class="note">確定前は金額変更・削除が可能です。買い目を変更する場合は削除して選び直してください。</p></div>${legal}`;
}
function renderCheckout() {
  header('購入確認','cart');const p=ui.checkout?.preview;if(!p){main.innerHTML=empty('確認画面を開き直してください','購入予定は保存されています。',routeLink('cart','購入予定へ','secondary'));return;}
  main.innerHTML=`<section class="section">${row('購入点数',`${p.lines.length}点`)}${row('購入ポイント',`<strong>${pt(p.total)}</strong>`)}${row('購入前残高',pt(p.balanceBefore))}${row('購入後残高',`<strong class="${p.balanceBefore-p.total<0?'danger':''}">${pt(p.balanceBefore-p.total)}</strong>`)}${p.excluded?`<p class="note">締切済み・時刻未登録の${p.excluded}点は除外しています。</p>`:''}</section><section class="section"><h2>全買い目</h2>${p.lines.map(d=>{
    const races=d.raceIds.map(id=>state.races.find(r=>r.id===id));const end=Math.min(...races.map(r=>new Date(r.startAt).getTime()));
    return `<div class="bet-row"><small>${h(draftRaceText(d))}</small><div class="selection">${h(TYPES[d.kind].name)}　${h(selectionText(d))}</div>${row('購入ポイント',pt(d.stake))}<small>締切 ${h(dateText(end))}（日本時間）</small>${d.kind==='win5'?`<p class="note">${races.map((r,i)=>`${i+1}：${h(r.date)} ${h(titleOf(r))}`).join('<br>')}</p>`:''}</div>`;
  }).join('')}</section><section class="section"><p class="note">確定後の取消・内容変更はできません。実際の出走頭数・発売券種とは照合していません。架空ポイントのシミュレーションです。</p>${errorBox()}<button id="purchase-hold" class="hold full" ${p.balanceBefore-p.total<0?'disabled':''}><span>1秒長押しで購入確定</span></button><button class="accessible-purchase" data-action="accessible-purchase" ${p.balanceBefore-p.total<0?'disabled':''}>長押しが難しい場合は確認して購入</button></section>${legal}`;
}
function purchasedScopes(includeSettled=false) {
  return [...new Set(state.tickets.map(t=>t.scope))].filter(key=>includeSettled||!state.settlements[key]).sort((a,b)=>Math.min(...scopeTickets(state,a)[0].races.map(r=>new Date(r.startAt).getTime()))-Math.min(...scopeTickets(state,b)[0].races.map(r=>new Date(r.startAt).getTime())));
}
function renderPurchased() {
  header('購入済み');const keys=purchasedScopes();
  main.innerHTML=`${warning()}${keys.length?keys.map(key=>{const t=scopeTickets(state,key)[0];return `<button class="scope-link" data-route="scope/${encodeURIComponent(key)}"><span class="title-line"><strong>${h(scopeTitle(key))}</strong><span class="pill">未精算</span></span><small>${h(t.races[0].date)} · ${scopeTickets(state,key).length}枚</small><div class="ticket-thumb">${paperHTML(t)}</div></button>`;}).join(''):empty('未精算の馬券はありません','購入した紙馬券をここに表示します。<br>精算済みの馬券は履歴から確認できます。',routeLink('races','レースへ','secondary'))}${legal}`;
}
function renderScope(key) {
  header(scopeTitle(key),'purchased');const lines=scopeLines(state,key),result=state.settlements[key],tickets=scopeTickets(state,key);if(!lines.length)throw new Error('購入した馬券が見つかりません。');
  main.innerHTML=`<section class="section">${row('購入ポイント',pt(totalOf(lines)))}${row('精算状況',result?'精算済み':'未精算')}${result?row('払戻ポイント',pt(result.total))+row('損益',pt(result.total-totalOf(lines))):''}${routeLink(`settle/${encodeURIComponent(key)}`,result?'精算結果を確認・修正':'レースを精算','primary full')}</section><section class="section"><h2>発行済みの紙馬券 · ${tickets.length}枚</h2>${tickets.map(t=>`<button class="scope-link" data-route="ticket/${t.id}"><small>${h(TYPES[t.kind].name)} · ${h(dateText(t.at))}購入</small><div class="ticket-thumb">${paperHTML(t)}</div><small>券面を開く　›</small></button>`).join('')}</section>${legal}`;
}
function renderTicket(id) {
  const t=state.tickets.find(t=>t.id===id);if(!t)throw new Error('紙馬券が見つかりません。');header('紙馬券',`scope/${encodeURIComponent(t.scope)}`);const result=state.settlements[t.scope];
  main.innerHTML=`<div class="ticket-detail">${Array.from({length:pageCount(t)},(_,page)=>`${paperHTML(t,page)}<button class="secondary full" data-action="share-ticket" data-id="${t.id}" data-page="${page}">${pageCount(t)>1?`${page+1}ページ目の`:'券面の'}画像を保存・共有</button>`).join('<div class="section"></div>')}<p class="ticket-outcome">${result?`精算済み · この券の払戻 ${pt(sum(t.lines.map(l=>result.byLine[l.id])))}`:'未精算'}</p>${routeLink(`settle/${encodeURIComponent(t.scope)}`,'精算を開く','primary full')}<p class="note">iPhoneでは共有メニューから「画像を保存」を選べます。券面は購入時の内容で固定し、結果は券面の外側に表示します。</p></div>${legal}`;
}
function settlementTotal(key) {
  try {const d=settlementDraft(state,key,Date.now());return sum(scopeLines(state,key).map(l=>payout(l.stake,d.inputs[l.id])));}catch{return null;}
}
function renderSettlement(key) {
  const d=settlementDraft(state,key,Date.now()),result=state.settlements[key],lines=scopeLines(state,key),total=settlementTotal(key);header(result?'精算結果を修正':'手動精算',`scope/${encodeURIComponent(key)}`);
  if(!lines.length)throw new Error('精算する買い目がありません。');
  ui.settlementToken=uid();ui.saveFailure=false;
  main.innerHTML=`<section class="section"><h2>入力オッズに基づくシミュレーション</h2><p class="note">購入pt × 入力倍率を計算し、1 pt未満は買い目ごとに切り捨てます。公式払戻金とは異なる場合があります。入力は自動保存され、確定までは残高に反映しません。</p><button class="text-button" data-action="mark-loss" data-scope="${h(key)}">未判定をすべて不的中にする</button><div class="save-state" id="save-state" role="status">下書きは端末内に自動保存されます</div></section>${lines.map(l=>{const input=d.inputs[l.id];let amount=null;try{amount=payout(l.stake,input);}catch{}return `<section class="section"><div class="row"><h3>${h(TYPES[l.kind].name)}　${h(selectionText(l))}</h3><span>${pt(l.stake)}</span></div><div class="outcome-select">${Object.entries(JUDGMENTS).map(([value,label])=>`<button data-action="judgment" data-id="${l.id}" data-scope="${h(key)}" data-value="${value}" aria-pressed="${input.judgment===value}">${label}</button>`).join('')}</div>${input.judgment==='win'?`<label class="field inline"><span>倍率</span><input class="control" type="text" inputmode="decimal" autocomplete="off" placeholder="例：3.5" aria-label="${h(selectionText(l))}の倍率" data-odds-line="${l.id}" data-scope="${h(key)}" value="${h(input.odds)}"></label>`:''}<small id="payout-${l.id}">払戻予定 ${amount==null?'未確定':pt(amount)}</small></section>`;}).join('')}<section class="section">${row('払戻合計',`<strong id="settlement-total">${total==null?'未確定':pt(total)}</strong>`)}${result?row('修正前の払戻',pt(result.total)):''}${errorBox()}<button class="primary full" id="settlement-commit" data-action="settle" data-scope="${h(key)}" ${total==null||(result&&JSON.stringify(result.inputs)===JSON.stringify(d.inputs))?'disabled':''}>${result?'修正を確定':'精算を確定'}</button></section><section class="section"><h2>精算の変更履歴</h2>${state.revisions.filter(r=>r.scope===key).reverse().map(rev=>`<div class="revision"><small>${h(dateText(rev.at))} · ${rev.before?'修正':'初回精算'}</small><p>${pt(rev.before?.total||0)} → ${pt(rev.after.total)}（差額 ${pt(rev.delta)}）</p>${lines.filter(l=>JSON.stringify(rev.before?.inputs[l.id])!==JSON.stringify(rev.after.inputs[l.id])).map(l=>`<small>${h(selectionText(l))}：${h(JUDGMENTS[rev.before?.inputs[l.id]?.judgment]||'未判定')} ${h(rev.before?.inputs[l.id]?.odds||'')} → ${h(JUDGMENTS[rev.after.inputs[l.id].judgment])} ${h(rev.after.inputs[l.id].odds||'')}</small><br>`).join('')}</div>`).join('')||'<p class="note">確定後の記録を表示します。</p>'}</section>${legal}`;
}
function updateSettlementDisplay(key,lineId) {
  const d=settlementDraft(state,key,Date.now()),line=scopeLines(state,key).find(l=>l.id===lineId);let amount=null;try{amount=payout(line.stake,d.inputs[lineId]);}catch{}
  const output=document.getElementById(`payout-${lineId}`);if(output)output.textContent=`払戻予定 ${amount==null?'未確定':pt(amount)}`;
  const total=settlementTotal(key),element=$('#settlement-total');if(element)element.textContent=total==null?'未確定':pt(total);
  const button=$('#settlement-commit');if(button)button.disabled=total==null||ui.saveFailure||(state.settlements[key]&&JSON.stringify(state.settlements[key].inputs)===JSON.stringify(d.inputs));
}
function renderHistory() {
  header('履歴');const f=ui.history,keys=purchasedScopes(true).filter(key=>{
    const tickets=scopeTickets(state,key),races=tickets[0].races,result=state.settlements[key];
    if(f.status==='open'&&result||f.status==='settled'&&!result)return false;
    if(f.outcome==='win'&&!Object.values(result?.inputs||{}).some(i=>i.judgment==='win'))return false;
    if(f.outcome==='loss'&&(!result||Object.values(result.inputs).some(i=>i.judgment!=='loss')))return false;
    if(f.outcome==='refund'&&!Object.values(result?.inputs||{}).some(i=>i.judgment==='refund'))return false;
    if(f.kind&&!tickets.some(t=>t.kind===f.kind)||f.venue&&!races.some(r=>r.venue===f.venue))return false;
    if(f.from&&!races.some(r=>r.date>=f.from)||f.to&&!races.some(r=>r.date<=f.to))return false;
    const text=races.map(r=>`${r.date} ${titleOf(r)} ${r.name}`).join(' ')+tickets.map(t=>TYPES[t.kind].name).join(' ');return !f.search||text.includes(f.search);
  }).sort((a,b)=>scopeTickets(state,b)[0].at.localeCompare(scopeTickets(state,a)[0].at));
  const venues=[...new Set(state.tickets.flatMap(t=>t.races).map(r=>r.venue))];
  main.innerHTML=`<section class="section"><form id="history-form">${field('検索（開催日・競馬場・レース名・券種）','search','search',f.search||'')}<details ${f.status||f.outcome||f.kind||f.venue||f.from||f.to?'open':''}><summary>絞り込み</summary><div class="field-grid"><label class="field"><span>精算状況</span><select name="status">${optionList({open:'未精算',settled:'精算済み'},f.status,true)}</select></label><label class="field"><span>結果</span><select name="outcome">${optionList({win:'的中',loss:'不的中のみ',refund:'返還あり'},f.outcome,true)}</select></label><label class="field"><span>券種</span><select name="kind">${optionList(TYPES,f.kind,true)}</select></label><label class="field"><span>競馬場</span><select name="venue"><option value="">すべて</option>${venues.map(v=>`<option ${f.venue===v?'selected':''}>${h(v)}</option>`).join('')}</select></label>${field('開始日（現地開催日）','from','date',f.from||'')}${field('終了日（現地開催日）','to','date',f.to||'')}</div></details><button class="secondary full" type="submit">検索・絞り込み</button></form></section><section class="section"><h2>${keys.length}件</h2>${keys.length?keys.map(key=>{const result=state.settlements[key],t=scopeTickets(state,key)[0];return `<button class="scope-link" data-route="scope/${encodeURIComponent(key)}"><span class="title-line"><strong>${h(scopeTitle(key))}</strong><span class="pill">${result?Object.values(result.inputs).some(i=>i.judgment==='win')?'的中':'的中なし':'未精算'}</span></span><small>${h(t.races[0].date)}</small><div class="row"><span>購入 ${pt(totalOf(scopeLines(state,key)))}</span><span>${result?`払戻 ${pt(result.total)}`:''}</span></div></button>`;}).join(''):empty('履歴がありません','条件に一致する購入履歴はありません。')}</section>${legal}`;
}
function metricRows(m,unit='レース') {
  return row(`的中率（${unit}単位）`,rate(m.hitRate))+row('回収率',rate(m.returnRate))+row('純損益',m.count?`<strong>${pt(m.profit)}</strong>`:'—')+row('購入ポイント',m.count?pt(m.cost):'—')+row('払戻ポイント',m.count?pt(m.payout):'—')+row(`精算済み${unit}数`,String(m.count))+row(`的中${unit}数`,String(m.wins))+row('最高払戻',m.maxPayout==null?'—':pt(m.maxPayout))+row('最大利益',m.maxProfit==null?'—':pt(m.maxProfit))+row('最大損失',m.maxLoss==null?'—':pt(m.maxLoss))+row('平均購入ポイント',m.average==null?'—':`${m.average.toLocaleString('ja-JP',{maximumFractionDigits:1})} pt`);
}
function graphHTML(items,a) {
  const amounts=new Map();if(a.balance)state.ledger.forEach(e=>amounts.set(jpDay(e.at),(amounts.get(jpDay(e.at))||0)+e.amount));else items.forEach(i=>amounts.set(jpDay(i.race.startAt),(amounts.get(jpDay(i.race.startAt))||0)+i.profit));
  let running=0;const points=[];[...amounts].sort(([a],[b])=>a.localeCompare(b)).forEach(([day,amount])=>{running+=amount;if(inPeriod(day+'T12:00:00+09:00',a.period,a.anchor+'T12:00:00+09:00'))points.push({day,value:running});});
  if(!points.length)return '<p class="note">この期間の増減はありません。</p>';
  const values=points.map(p=>p.value),min=Math.min(0,...values),max=Math.max(1,...values),range=max-min||1;
  const xy=points.map((p,i)=>({x:55+(points.length===1?245:i/(points.length-1)*490),y:165-(p.value-min)/range*140,...p}));
  const y0=165-(0-min)/range*140;
  return `<svg class="graph" viewBox="0 0 600 205" role="img" aria-label="${a.balance?'保有ポイント':'確定馬券損益'}の推移"><line x1="55" y1="${y0}" x2="555" y2="${y0}" stroke="#d9e2db"/><text x="0" y="24">${max.toLocaleString('ja-JP')}</text><text x="0" y="170">${min.toLocaleString('ja-JP')}</text>${a.bars?xy.map(p=>`<rect x="${p.x-8}" y="${Math.min(y0,p.y)}" width="16" height="${Math.max(2,Math.abs(p.y-y0))}" fill="#42735c"/>`).join(''):`<polyline points="${xy.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#1e5241" stroke-width="2"/>${xy.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3" fill="#1e5241"/>`).join('')}`}<text x="55" y="196">${xy[0].day.slice(5)}</text><text x="510" y="196">${xy.at(-1).day.slice(5)}</text></svg>`;
}
function renderAnalysis() {
  header('分析');const a=ui.analysis,items=performances(state,a.period,a.anchor+'T12:00:00+09:00'),normal=metrics(items.filter(i=>!i.win5)),win5=metrics(items.filter(i=>i.win5)),groups=classify(state,items,a.dimension);
  main.innerHTML=`<section class="section"><div class="segments">${Object.entries({all:'累計',year:'年別',month:'月別',week:'週別'}).map(([p,label])=>`<button data-action="analysis-period" data-value="${p}" aria-pressed="${a.period===p}">${label}</button>`).join('')}</div>${a.period!=='all'?`<label class="field"><span>この日を含む期間（日本時間）</span><input type="date" id="analysis-anchor" value="${a.anchor}"></label>`:''}<p class="note">週は月曜始まり。海外は発走日時を日本時間に変換して集計します。未精算の購入は確定成績から除外します。</p></section><section class="section"><h2>確定成績 · ${normal.count}レース</h2>${metricRows(normal)}</section>${win5.count?`<section class="section"><h2>WIN5の確定成績 · ${win5.count}組</h2>${metricRows(win5,'組')}<p class="note">5レース横断の1組として、通常のレース単位成績から分離します。</p></section>`:''}<section class="section"><h2>推移</h2><div class="segments"><button data-action="analysis-balance" data-value="false" aria-pressed="${!a.balance}">馬券損益</button><button data-action="analysis-balance" data-value="true" aria-pressed="${a.balance}">保有ポイント</button></div><div class="segments"><button data-action="analysis-bars" data-value="false" aria-pressed="${!a.bars}">折れ線</button><button data-action="analysis-bars" data-value="true" aria-pressed="${a.bars}">棒</button></div>${graphHTML(items,a)}<p class="note">${a.balance?'配布分・未精算購入を含む台帳上の残高です。':'精算済みの損益を発走日順に累積。WIN5を含み、配布は含みません。'}</p></section><section class="section"><h2>分類別 · ${items.length}対象</h2><label class="field"><span>分類（1項目ずつ）</span><select id="analysis-dimension">${optionList({category:'競馬区分',kind:'券種',venue:'競馬場',surface:'馬場',distance:'距離帯',grade:'レース格',class:'競走条件',weekday:'曜日'},a.dimension)}</select></label>${groups.map(g=>`<div class="classification"><div class="row"><h3>${h(g.label)}</h3><small>${g.count}${g.label.includes('WIN5')?'組':'レース'}</small></div>${row('損益',pt(g.profit))}${row('回収率',rate(g.returnRate))}<small>的中 ${g.wins}/${g.count}対象 · 購入 ${pt(g.cost)} · 払戻 ${pt(g.payout)}</small></div>`).join('')||'<p class="note">集計対象がありません。</p>'}<p class="note">券種別の分母は、その券種を購入・精算したレース数です。WIN5は1組単位です。未登録の条件は「不明」とします。</p></section>${legal}`;
}
function renderPoints() {
  header('ポイント','races');const monthly=sum(state.ledger.filter(e=>e.kind==='monthly').map(e=>e.amount)),profit=sum(state.ledger.filter(e=>['purchase','payout','correction'].includes(e.kind)).map(e=>e.amount));
  main.innerHTML=`${warning()}<section class="section">${row('現在残高',`<strong>${pt(balance(state))}</strong>`)}${row('初期元本','10,000 pt')}${row('毎月の配布累計',pt(monthly))}${row('馬券による純増減',pt(profit))}<p class="note">馬券の純増減には未精算の購入支出も含みます。分析の確定成績とは対象が異なります。</p></section><p class="note">利用開始月の翌月から、日本時間の毎月1日に3,000 ptを配布します。開かなかった月も次回起動時に補充します。自由な補充はありません。</p><section class="section"><h2>ポイント増減履歴</h2>${state.ledger.slice().reverse().map(e=>`<div class="revision"><div class="row"><span>${h(e.note)}</span><strong>${e.amount>0?'+':''}${pt(e.amount)}</strong></div><small>${h(dateText(e.at))}（日本時間）</small></div>`).join('')}</section>${legal}`;
}
function renderSettings() {
  header('設定');const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  main.innerHTML=`<section class="section"><h2>ホーム画面から使う</h2><p class="note">${installed?'ホーム画面のアプリとして開いています。':'iPhoneのSafariでこのURLを開き、共有メニュー →「ホーム画面に追加」→「追加」を選びます。以後は追加したアイコンから使ってください。'}</p><p class="note">初回のオンライン読み込み後はオフラインでも利用できます。${'serviceWorker' in navigator?'':'このブラウザーではオフライン保存を利用できません。'}</p></section><section class="section"><h2>端末内の保存</h2><p class="note">ポイント・馬券・履歴はこの端末のブラウザー内だけに保存します。GitHubには送信しません。Safariとホーム画面アプリで保存領域が異なる場合があるため、継続利用する方を決めてから購入してください。</p><p class="note">サイトデータの削除、アプリの削除、端末の状況によって保存データが失われる場合があります。バックアップ・復元・同期機能はありません。</p><button class="text-button" data-action="persist">保存データの保持をリクエスト</button></section><section class="section"><h2>Web版の通知</h2><p class="note">GitHub Pagesだけでは、アプリを閉じている間の「発走10分前」の時刻指定通知を確実に送れません。この版ではバックグラウンド通知は提供していません。購入・精算は通知なしで利用できます。</p></section><section class="section"><h2>このアプリについて</h2><p class="note">現金・実際の投票・換金・課金はありません。倍率による払戻はシミュレーションです。地方・海外の固有券種は未対応です。</p>${workerRegistration?.waiting?'<button class="secondary full" data-action="update-app">更新して再読み込み</button>':''}${legal}</section><section class="section"><button class="destructive full" data-action="reset-first">全データを初期化</button><p class="note">二段階の確認後、購入・精算・履歴・手動レースを削除し、10,000 ptで新しく開始します。バックアップがないため復元できません。別途保存した画像には触れません。</p></section>`;
  main.insertAdjacentHTML('afterbegin',`<section class="section"><h2>内蔵の年間カレンダー</h2>${row('中央重賞','GⅠ24 · GⅡ38 · GⅢ68')}${row('地方ダートグレード','GⅠ1 · JpnⅠ12 · JpnⅡ12 · JpnⅢ21')}${row('新馬・未勝利','新馬106 · 未勝利175')}${row('全収録数',`${gameCalendar.programs.length.toLocaleString('ja-JP')}レース · ${gameCalendar.periods.length}週枠`)}<p class="note">${h(gameCalendar.coverageNote)}</p><details><summary>収録資料と開催週の決め方</summary><p class="note">${h(gameCalendar.weekBasis)}</p>${gameCalendar.sources.map(source=>`<p class="note"><a href="${h(source.url)}" target="_blank" rel="noopener noreferrer">${h(source.title)}</a><br>確認日 ${h(source.checkedOn)}<br>${h(source.coverage)}</p>`).join('')}</details></section>`);
}
function renderMachine() {
  if(!animationContext){go('purchased');return;}const a=animationContext,tickets=a.receipt.winningIds.map(id=>state.tickets.find(t=>t.id===id)).filter(Boolean),done=a.index>=tickets.length||matchMedia('(prefers-reduced-motion: reduce)').matches,t=tickets[a.index],result=state.settlements[a.scope];header('払戻',`scope/${encodeURIComponent(a.scope)}`);
  const amount=done?a.receipt.total:sum(t.lines.map(l=>result.byLine[l.id]));
  main.innerHTML=`<div class="row"><span>精算は保存済みです</span><button class="text-button" data-action="machine-skip">スキップ</button></div><div class="machine"><h3>払戻ポイント</h3><div class="machine-display">${pt(amount)}</div><div class="machine-slot"></div><div class="machine-feeder">${!done?`<div class="machine-ticket" id="machine-ticket">${paperHTML(t)}</div>`:''}</div><div class="machine-state">${done?'払戻が完了しました':`紙馬券 ${a.index+1} / ${tickets.length}枚`}</div></div>${done?`<section class="section">${row('払戻合計',pt(a.receipt.total))}${row('損益',pt(a.receipt.total-totalOf(scopeLines(state,a.scope))))}<button class="primary full" data-action="machine-skip">閉じる</button></section>`:''}<p class="note">スキップ・画面切替・終了をしても、保存済みの残高に影響しません。</p>${legal}`;
  if(!done){animationTimer=setTimeout(()=>{$('#machine-ticket')?.classList.add('ingesting');animationTimer=setTimeout(()=>{if(currentRoute().page==='machine'&&animationContext===a){a.index++;render();}},3350);},650);}
}

function ask(title,body,confirm='確認する',danger=false) {
  return new Promise(resolve=>{dialogResolve=resolve;dialogHandler=null;$('#dialog-body').innerHTML=`<h2>${h(title)}</h2><p>${body}</p><div class="actions"><button class="secondary" data-dialog="cancel">キャンセル</button><button class="${danger?'destructive':'primary'}" data-dialog="ok">${h(confirm)}</button></div>`;dialog.showModal();});
}
function closeDialog(result) {const resolve=dialogResolve;dialogResolve=null;dialogHandler=null;dialog.close();resolve?.(result);}
dialog.addEventListener('cancel',()=>{dialogResolve?.(false);dialogResolve=null;dialogHandler=null;});
dialog.addEventListener('click',event=>{const button=event.target.closest('[data-dialog]');if(button)closeDialog(button.dataset.dialog==='ok');});

async function buy() {
  if(busy||!ui.checkout)return;busy=true;const button=$('#purchase-hold');if(button)button.disabled=true;
  try {
    await saving;if(ui.saveFailure)throw new Error('未保存の入力があります。確認してから再実行してください。');
    const order=await run('purchase',{preview:ui.checkout.preview,token:ui.checkout.token},false);
    const t=state.tickets.find(t=>t.orderId===order.id);ui.checkout=null;go(`scope/${encodeURIComponent(t.scope)}`);toast('購入とポイント減算を保存しました。');
  } catch(error){errorMessage(error);if(button)button.disabled=false;}finally{busy=false;}
}
function bindHold() {
  const button=$('#purchase-hold');if(!button||button.disabled)return;let timer=null,started=0,complete=false;
  const cancel=()=>{clearTimeout(timer);timer=null;button.classList.remove('holding');};
  const start=event=>{
    if(busy||button.disabled||document.hidden||event.button>0)return;
    cancel();started=performance.now();complete=false;button.classList.add('holding');
    if(event.pointerId!=null)button.setPointerCapture(event.pointerId);
    timer=setTimeout(()=>{if(document.hidden||performance.now()-started<990)return;complete=true;cancel();buy();},1000);
  };
  button.addEventListener('pointerdown',start);button.addEventListener('pointerup',cancel);button.addEventListener('pointercancel',cancel);button.addEventListener('lostpointercapture',cancel);button.addEventListener('contextmenu',e=>e.preventDefault());
  button.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)&&!e.repeat){e.preventDefault();start(e);}});
  button.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!complete)cancel();}});
  document.addEventListener('visibilitychange',cancel,{once:true});
}

document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-route],[data-action]');if(!target)return;
  if(target.dataset.route){go(target.dataset.route);return;}
  const action=target.dataset.action,id=target.dataset.id,key=target.dataset.scope;
  try {
        if(action==='game-current'){const period=currentGamePeriod();await run('preferences',{gameMonth:period.month,gameWeek:period.week,gameVenue:'',gameCategory:'',gameCondition:''});return;}
    if(action==='today'){await run('preferences',{date:jpDay(Date.now()),category:'',venue:''});return;}
    if(action==='number'){
      const c=ui.compose,n=Number(target.dataset.number),selected=c.groups[c.active];
      if(selected.includes(n))c.groups[c.active]=selected.filter(v=>v!==n);else c.groups[c.active]=(c.method==='normal'&&TYPES[c.kind].size>1?[n]:[...selected,n]).sort((a,b)=>a-b);
      const y=window.scrollY;render();window.scrollTo({top:y});return;
    }
    if(action==='group'){ui.compose.active=Number(target.dataset.index);render();return;}
    if(action==='draft-add'){
      const c=ui.compose,r=state.races.find(r=>r.id===c.raceIds[0]),max=c.kind==='win5'?30:c.kind==='bracket'?8:r?.category==='overseas'?30:18;
      const result=generate(c.kind,c.method,c.groups.slice(0,groupCount(c)),max);
      const count=await run('draftAdd',{lines:result.map(numbers=>({id:uid(),raceIds:c.raceIds.slice(),kind:c.kind,numbers,stake:100}))},false);
      toast(`${count}点を購入予定に追加しました。重複は1点にまとめます。`);go('cart');return;
    }
    if(action==='draft-delete'){await run('draftDelete',{id});return;}
    if(action==='stake'){
      const d=state.drafts.find(d=>d.id===id);$('#dialog-body').innerHTML=`<h2>購入ポイントを変更</h2><form id="stake-form">${field('100 pt以上、100 pt刻み','stake','number',d.stake,'required min="100" step="100" inputmode="numeric"')}<p class="error" id="dialog-error" hidden></p><div class="actions"><button type="button" class="secondary" data-dialog="cancel">キャンセル</button><button type="submit" class="primary">保存</button></div></form>`;
      dialogHandler=async form=>{await run('draftStake',{id,stake:Number(new FormData(form).get('stake'))});closeDialog(true);};dialog.showModal();return;
    }
    if(action==='checkout'){await run('refresh',{},false);ui.checkout={token:uid(),preview:preview(state,Date.now())};go('checkout');return;}
    if(action==='accessible-purchase'){if(await ask('購入を確定しますか？',`${pt(ui.checkout.preview.total)}を使用します。確定後は取り消せません。<br>架空ポイント・換金不可。`,'購入を確定'))await buy();return;}
    if(action==='race-delete'){
      if(await ask('手動レースを削除しますか？','このレースと購入予定を削除します。購入済みの場合は削除できません。','削除する',true)){await run('raceDelete',{id},false);go('races');}return;
    }
    if(action==='judgment'){
      await saving;if(ui.saveFailure)throw new Error('未保存の倍率があります。入力をやり直してください。');const d=settlementDraft(state,key,Date.now());
      await run('settlementInput',{scope:key,lineId:id,input:{...d.inputs[id],judgment:target.dataset.value},baseVersion:d.baseVersion});return;
    }
    if(action==='mark-loss'){await saving;const d=settlementDraft(state,key,Date.now());await run('markLoss',{scope:key,baseVersion:d.baseVersion});return;}
    if(action==='settle'){
      await saving;if(ui.saveFailure)throw new Error('未保存の入力があります。再入力してから確定してください。');
      const d=settlementDraft(state,key,Date.now()),total=settlementTotal(key);if(total===null)throw new Error('判定・倍率をすべて確認してください。');
      if(!await ask(state.settlements[key]?'差額を記録して修正しますか？':'精算を確定しますか？',`払戻合計は${pt(total)}です。${state.settlements[key]?`台帳には差額${pt(total-state.settlements[key].total)}だけ記録します。`:'購入ポイントは精算時に再度引きません。'}`,'確定する'))return;
      const receipt=await run('settle',{scope:key,baseVersion:d.baseVersion,token:ui.settlementToken},false);
      if(receipt.first&&receipt.winningIds.length){animationContext={receipt,scope:key,index:0};go('machine');}else{render();toast('精算と残高を保存しました。');}return;
    }
    if(action==='share-ticket'){target.disabled=true;try{const status=await shareTicket(state.tickets.find(t=>t.id===id),Number(target.dataset.page));if(status==='downloaded')toast('券面PNGを保存しました。');}finally{target.disabled=false;}return;}
    if(action==='machine-skip'){const key=animationContext?.scope;animationContext=null;go(key?`scope/${encodeURIComponent(key)}`:'purchased');return;}
    if(action==='analysis-period'){ui.analysis.period=target.dataset.value;render();return;}
    if(action==='analysis-balance'){ui.analysis.balance=target.dataset.value==='true';render();return;}
    if(action==='analysis-bars'){ui.analysis.bars=target.dataset.value==='true';render();return;}
    if(action==='persist'){const ok=await navigator.storage?.persist?.();toast(ok?'保存データの保持が許可されました。':'保持の保証はできません。サイトデータを消さず、同じアイコンから利用してください。');return;}
    if(action==='update-app'){await saving;workerRegistration?.waiting?.postMessage('ACTIVATE_UPDATE');navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});return;}
    if(action==='reset-first'){
      if(!await ask('全データを初期化しますか？','購入・精算・履歴・下書き・手動レースを削除します。保存済みの画像には触れません。','最終確認へ',true))return;
      if(!await ask('この操作は取り消せません','バックアップがないため復元できません。初期元本10,000 ptで新しく開始します。','全データを削除して開始',true))return;
      await saving;await run('reset',{},false);ui.compose=null;ui.checkout=null;animationContext=null;go('races');toast('10,000 ptで新しく開始しました。');return;
    }
  }catch(error){errorMessage(error);}
});
document.addEventListener('change',async event=>{
  const target=event.target;
  try {
    if(target.id==='game-month'){const period=gamePeriod(Number(target.value),state.preferences.gameWeek);await run('preferences',{gameMonth:period.month,gameWeek:period.week,gameVenue:''});return;}
    if(target.id==='game-week'){await run('preferences',{gameWeek:Number(target.value),gameVenue:''});return;}
    if(target.id==='game-category'){await run('preferences',{gameCategory:target.value,gameVenue:''});return;}
    if(target.id==='game-venue'){await run('preferences',{gameVenue:target.value});return;}
    if(target.id==='game-condition'){await run('preferences',{gameCondition:target.value});return;}
    if(target.id==='race-date'){await run('preferences',{date:target.value||jpDay(Date.now()),venue:''});return;}
    if(target.id==='race-category'){await run('preferences',{category:target.value,venue:''});return;}
    if(target.id==='race-venue'){await run('preferences',{venue:target.value});return;}
    if(target.id==='bet-kind'){ui.compose.kind=target.value;ui.compose.method=allowedMethods(target.value)[0];ui.compose.groups=[[],[],[],[],[]];ui.compose.active=0;render();return;}
    if(target.id==='bet-method'){ui.compose.method=target.value;ui.compose.groups=[[],[],[],[],[]];ui.compose.active=0;render();return;}
    if(target.dataset.win5Leg!=null){const i=Number(target.dataset.win5Leg);ui.compose.raceIds[i]=target.value;ui.compose.groups[i]=[];render();return;}
    if(target.id==='analysis-anchor'){ui.analysis.anchor=target.value||jpDay(Date.now());render();return;}
    if(target.id==='analysis-dimension'){ui.analysis.dimension=target.value;render();return;}
  }catch(error){errorMessage(error);}
});
document.addEventListener('input',event=>{
  const target=event.target;if(!target.matches('[data-odds-line]'))return;
  const key=target.dataset.scope,lineId=target.dataset.oddsLine,d=settlementDraft(state,key,Date.now()),input={...d.inputs[lineId],odds:target.value};
  const indicator=$('#save-state');if(indicator)indicator.textContent='保存中…';
  saving=saving.then(async()=>{await run('settlementInput',{scope:key,lineId,input,baseVersion:d.baseVersion},false);ui.saveFailure=false;updateSettlementDisplay(key,lineId);if($('#save-state'))$('#save-state').textContent='下書きを保存しました';}).catch(error=>{ui.saveFailure=true;if($('#save-state'))$('#save-state').textContent='保存に失敗しました。再入力してください。';errorMessage(error);});
});
document.addEventListener('submit',async event=>{
  const form=event.target;event.preventDefault();
  try {
    if(form.id==='stake-form'){try{await dialogHandler(form);}catch(error){$('#dialog-error').hidden=false;$('#dialog-error').textContent=error.message;}return;}
    if(form.id==='history-form'){ui.history=Object.fromEntries(new FormData(form));render();return;}
    if(form.id==='race-form'){
      const f=new FormData(form),old=ui.editRace,get=name=>f.has(name)?f.get(name):old[name];
      const r={...old,date:get('date'),category:get('category'),country:get('country'),venue:String(get('venue')).trim(),number:Number(get('number')),name:get('name'),surface:get('surface'),distance:get('distance')==null||get('distance')===''?null:Number(get('distance')),grade:get('grade')||null,class:get('class'),zone:get('zone')};
      r.startAt=f.get('hasTime')?localTimeToISO(r.date,f.get('time'),r.zone,f.get('fold')):null;
      await run('raceSave',r,false);go(`race/${r.id}`);toast('レースを保存しました。');return;
    }
  }catch(error){errorMessage(error);}
});
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0});main.focus({preventScroll:true});});
document.addEventListener('visibilitychange',async()=>{
  if(document.hidden){if(currentRoute().page==='machine'){const key=animationContext?.scope;animationContext=null;if(key)go(`scope/${encodeURIComponent(key)}`);}return;}
  if(store){try{await saving;await run('refresh',{},currentRoute().page!=='settle');}catch(error){errorMessage(error);}}
});
window.addEventListener('pageshow',async event=>{if(event.persisted&&store){try{await run('refresh');}catch(error){errorMessage(error);}}});
async function boot() {
  try {
    const base=new URL('.',location.href).pathname;
    store=await LocalStore.open(`uma-points-v1:${base}`,catalog);const migrated=await store.update(s=>calendarMigration(s));state=migrated.state;await run('refresh',{},false);render();
    if(store.channel)store.channel.onmessage=async()=>{try{state=await store.read();if(currentRoute().page!=='settle')render();}catch(error){errorMessage(error);}};
    if('serviceWorker' in navigator){
      try{workerRegistration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});workerRegistration.addEventListener('updatefound',()=>{const installing=workerRegistration.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed'&&navigator.serviceWorker.controller)toast('新しい版があります。設定から更新できます。');});});}catch{toast('オフライン保存を準備できませんでした。オンラインで利用できます。');}
    }
  }catch(error){$('#header').innerHTML='<h1>うまポイント</h1>';main.innerHTML=`<div class="section"><h2>保存データを開けません</h2><p class="error">${h(error.message)}</p><p class="note">既存データは消去していません。通常のSafariで開き、ブラウザーの保存設定を確認してください。</p><button class="secondary" id="retry-open">再読み込み</button></div>`;$('#retry-open').onclick=()=>location.reload();}
}
boot();
