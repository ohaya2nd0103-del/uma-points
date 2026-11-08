import {gameProgramData as data} from './game-programs.js';
import {localGradedData} from './local-graded-programs.js';
import {uid,jpDay,clone} from './core.js';

const aliases={'ARG共和国杯':'アルゼンチン共和国杯','マイルCS':'マイルチャンピオンシップ','チャンピオンズC':'チャンピオンズカップ','阪神JF':'阪神ジュベナイルフィリーズ','朝日杯FS':'朝日杯フューチュリティステークス','ジャパンダートC':'ジャパンダートクラシック','マイルCS南部杯':'マイルチャンピオンシップ南部杯','JBCレディスC':'JBCレディスクラシック'};
const canonical=name=>aliases[name]||name;
export function gradeLevel(grade) {return {'GⅠ':1,'JpnⅠ':1,'GⅡ':2,'JpnⅡ':2,'GⅢ':3,'JpnⅢ':3}[grade]||0;}
export function gradeClass(grade) {const level=gradeLevel(grade);return level?`grade-${level}`:grade==='L'?'grade-listed':'';}
const basePrograms=data.rows.map(r=>{
  const period=data.periods.find(p=>p.id===r[1]),venue=data.venues[r[2]],local=['大井','川崎','船橋','浦和','盛岡'].includes(venue);
  const grade=['I','II','III'].includes(r[9])?`${local?'Jpn':'G'}${{I:'Ⅰ',II:'Ⅱ',III:'Ⅲ'}[r[9]]}`:r[9]==='L'?'L':null;
  return {id:`ds2-${r[0]}`,period:period.id,month:period.month,week:period.week,venue,meeting:r[3],age:r[4],condition:r[5],name:canonical(r[6]||`${r[4]} ${r[5]==='OP'?'オープン':r[5]}`),surface:r[7]==='t'?'turf':'dirt',distance:r[8],grade,special:r[9]==='S',symbols:r[10],sourceImageId:r[11],sourceRow:r[12],sourceIDs:['ds2-game-program-reference','ds2-game-program-data'],category:local?'local':'central',class:grade&&grade!=='L'?'graded':r[5]==='新馬'?'maidenDebut':r[5]==='未勝利'?'maiden':r[5]==='OP'?'open':'allowance'};
});
// 地方13件の重複を追加しない。旧番組へのリンクは同じIDで引き継ぐ。
const localPrograms=localGradedData.rows.map(r=>{
  const periods=data.periods.filter(p=>p.month===r.month),period=periods.find(p=>p.week===Math.ceil(r.day/7))||periods.at(-1);
  const old=basePrograms.find(p=>p.category==='local'&&p.name===r.name);
  return {...r,id:old?.id||r.id,period:period.id,week:period.week,category:'local',surface:'dirt',condition:'OP',class:'graded',special:false,sourceIDs:['nar-graded-2026']};
});
export const gameCalendar = {
  version:3,revision:data.datasetVersion+'-annual-nar-2026-v1',checkedOn:data.checkedOn,sources:[...data.sources,...localGradedData.sources],periods:data.periods,
  coverageNote:'中央GⅠ24・GⅡ38・GⅢ68、地方GⅠ1・JpnⅠ12・JpnⅡ12・JpnⅢ21を内蔵しています。中央の週枠と一般競走は参考番組表を基にした年間目安です。参考資料のゲーム名・版は未特定で、公式との全件照合はしていません。地方はNAR公式2026年日程の月・週を目安に配置しています。開催日・番号・締切は利用時に設定します。',
  weekBasis:localGradedData.weekBasis,
  programs:[...basePrograms.filter(p=>p.category==='central'),...localPrograms]
};
export const calendarCounts={central:130,local:46,debut:106,maiden:175};
export function gamePeriod(month,week) {
  const periods=gameCalendar.periods.filter(p=>p.month===Number(month));
  return periods.find(p=>p.week===Number(week))||(Number(week)>periods.at(-1)?.week?periods.at(-1):periods[0])||gameCalendar.periods[0];
}
export function currentGamePeriod(now=Date.now()) {
  const day=jpDay(now);return gamePeriod(Number(day.slice(5,7)),Math.ceil(Number(day.slice(8,10))/7));
}
export function filterPrograms({month,week,category='',venue='',condition='',search=''}={}) {
  const period=gamePeriod(month,week);
  return gameCalendar.programs.filter(p=>p.period===period.id&&(!category||p.category===category)&&(!venue||p.venue===venue)&&(!condition||(condition==='graded'?p.class==='graded':/^grade[123]$/.test(condition)?gradeLevel(p.grade)===Number(condition.at(-1)):condition==='OP'?p.condition==='OP'&&p.class!=='graded':p.condition===condition))&&(!search||`${p.name} ${p.venue} ${p.age}`.includes(search)))
    .sort((a,b)=>(gradeLevel(a.grade)||9)-(gradeLevel(b.grade)||9)||a.venue.localeCompare(b.venue,'ja')||({maidenDebut:0,maiden:1,allowance:2,open:3,graded:4}[a.class]-{maidenDebut:0,maiden:1,allowance:2,open:3,graded:4}[b.class])||a.distance-b.distance||a.id.localeCompare(b.id));
}
export function raceFromProgram(program,{day=jpDay(Date.now()),id=uid()}={}) {
  return {id,date:day,category:program.category,country:'日本',venue:program.venue,number:1,name:program.name,surface:program.surface,distance:program.distance,grade:program.grade,class:program.class,zone:'Asia/Tokyo',startAt:null,manual:true,sourceIDs:[...program.sourceIDs],checkedOn:gameCalendar.checkedOn,confirmedKinds:null,
    calendarOrigin:{programId:program.id,month:program.month,week:program.week,age:program.age,condition:program.condition}};
}
export function calendarMigration(state,now=Date.now()) {
  const period=currentGamePeriod(now);
  // 既存の購入・精算・レースは上書きしない。任意の新フィールドだけを補完する。
  state.preferences.calendarMode??='game';
  state.preferences.gameMonth??=period.month;state.preferences.gameWeek??=period.week;
  state.preferences.gameCategory??='';state.preferences.gameVenue??='';state.preferences.gameCondition??='';
  for(const source of gameCalendar.sources){const index=state.sources.findIndex(s=>s.id===source.id);if(index<0)state.sources.push(clone(source));else state.sources[index]=clone(source);}
  state.programCatalogRevision=gameCalendar.revision;
}
