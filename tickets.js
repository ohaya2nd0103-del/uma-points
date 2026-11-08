import { TYPES, selectionText, sum } from './core.js';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pageCount = ticket => Math.max(1,Math.ceil(ticket.lines.length/30));
export function paperHTML(ticket, page = 0) {
  const h = escapeHTML, race = ticket.races[0], rows = ticket.lines.slice(page*30,page*30+30);
  return `<div class="paper" aria-label="${h(TYPES[ticket.kind].name)}の馬券">
    <div class="paper-label">うまポイント</div>
    ${ticket.kind === 'win5' ? `<div class="paper-race">WIN5</div>${ticket.races.map((r,i) => `<div class="paper-leg">${i+1}　${h(r.date)}　${h(r.venue)} ${r.number}R</div>`).join('')}` : `<div class="paper-day">${h(race.date)}${race.calendarOrigin?` · ${race.calendarOrigin.month}月${race.calendarOrigin.week}週`:race.gameOrigin?` · 参考 ${race.gameOrigin.month}月${race.gameOrigin.week}週`:''}</div><div class="paper-race">${h(race.venue)} ${race.number}R</div><div class="paper-name">${h(race.name)}</div>`}
    <div class="paper-kind">${h(TYPES[ticket.kind].name)}</div>
    ${rows.map(l => `<div class="paper-line"><span>${h(selectionText(l))}</span><small>${l.stake.toLocaleString('ja-JP')} pt</small></div>`).join('')}
    <div class="paper-foot">合計 ${ticket.lines.length}点　${sum(ticket.lines.map(l=>l.stake)).toLocaleString('ja-JP')} pt<br>${page+1}/${pageCount(ticket)}</div>
  </div>`;
}
export function ticketCanvas(ticket, page = 0, scale = 2) {
  const lines = ticket.lines.slice(page*30,page*30+30), header = ticket.kind === 'win5' ? 222 : 152;
  const width = 360, height = header+lines.length*24+94, canvas = document.createElement('canvas');
  canvas.width = width*scale; canvas.height = height*scale;
  const c = canvas.getContext('2d'); if (!c) throw new Error('画像を作成できません。');
  c.scale(scale,scale); c.fillStyle = '#f7f6e8'; c.fillRect(0,0,width,height); c.fillStyle = '#1e3329'; c.textBaseline = 'top';
  const text = (value,x,y,size=13,bold=false,max=316) => { c.font = `${bold?'600':'400'} ${size}px ui-monospace, "Hiragino Sans", monospace`; c.fillText(value,x,y,max); };
  const rule = y => { c.strokeStyle = '#7e8979'; c.lineWidth = .7; c.beginPath(); c.moveTo(22,y); c.lineTo(338,y); c.stroke(); };
  text('うまポイント',22,20,12);
  if (ticket.kind === 'win5') {
    text('WIN5',22,46,25,true);
    ticket.races.forEach((r,i)=>text(`${i+1}　${r.date}　${r.venue} ${r.number}R`,22,82+i*22,12)); rule(198);
  } else {
    const r = ticket.races[0]; text(r.date+(r.calendarOrigin?` · ${r.calendarOrigin.month}月${r.calendarOrigin.week}週`:r.gameOrigin?` · 参考 ${r.gameOrigin.month}月${r.gameOrigin.week}週`:''),22,46,13); text(`${r.venue} ${r.number}R`,22,73,26,true); text(r.name,22,112,12); rule(134);
  }
  text(TYPES[ticket.kind].name,22,header-6,14,true);
  lines.forEach((l,i)=>{const y=header+23+i*24;text(selectionText(l),22,y,ticket.kind==='win5'?12:15,false,212);text(`${l.stake.toLocaleString('ja-JP')} pt`,244,y,12,false,94);});
  rule(height-72);text(`合計 ${ticket.lines.length}点　${sum(ticket.lines.map(l=>l.stake)).toLocaleString('ja-JP')} pt`,22,height-59,12,true);
  text(`${page+1}/${pageCount(ticket)}`,300,height-31,10,false,40);
  return canvas;
}
export async function shareTicket(ticket, page = 0) {
  const canvas = ticketCanvas(ticket,page,3);
  const blob = await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('画像を作成できません。')),'image/png'));
  const file = new File([blob],`紙馬券-${ticket.races[0].date}-${page+1}.png`,{type:'image/png'});
  if (navigator.canShare?.({files:[file]}) && navigator.share) {
    try { await navigator.share({files:[file],title:'紙馬券'}); return 'shared'; }
    catch (error) { if (error.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000);return 'downloaded';
}
