import {gameProgramData as data} from './game-programs.js';
import {uid,jpDay,clone} from './core.js';

export const gameCalendar = {
  version:data.version,revision:data.datasetVersion,edition:data.edition,checkedOn:data.checkedOn,sources:data.sources,periods:data.periods,coverageNote:data.coverageNote,
  programs:data.rows.map(r=>{
    const period=data.periods.find(p=>p.id===r[1]),venue=data.venues[r[2]],local=['大井','川崎','船橋','浦和','盛岡'].includes(venue);
    const grade=['I','II','III'].includes(r[9])?`${local?'Jpn':'G'}${{I:'Ⅰ',II:'Ⅱ',III:'Ⅲ'}[r[9]]}`:r[9]==='L'?'L':null;
    return {id:`ds2-${r[0]}`,period:period.id,month:period.month,week:period.week,venue,meeting:r[3],age:r[4],condition:r[5],name:r[6]||`${r[4]} ${r[5]==='OP'?'オープン':r[5]}`,surface:r[7]==='t'?'turf':'dirt',distance:r[8],grade,special:r[9]==='S',symbols:r[10],sourceImageId:r[11],sourceRow:r[12],category:local?'local':'central',class:grade&&grade!=='L'?'graded':r[5]==='新馬'?'maidenDebut':r[5]==='未勝利'?'maiden':r[5]==='OP'?'open':'allowance'};
  })
};
export function gamePeriod(month,week) {
  const periods=gameCalendar.periods.filter(p=>p.month===Number(month));
  return periods.find(p=>p.week===Number(week))||(Number(week)>periods.at(-1)?.week?periods.at(-1):periods[0])||gameCalendar.periods[0];
}
export function currentGamePeriod(now=Date.now()) {
  const day=jpDay(now);return gamePeriod(Number(day.slice(5,7)),Math.ceil(Number(day.slice(8,10))/7));
}
export function filterPrograms({month,week,category='',venue='',condition='',search=''}={}) {
  const period=gamePeriod(month,week);
  return gameCalendar.programs.filter(p=>p.period===period.id&&(!category||p.category===category)&&(!venue||p.venue===venue)&&(!condition||(condition==='graded'?p.class==='graded':condition==='OP'?p.condition==='OP'&&p.class!=='graded':p.condition===condition))&&(!search||`${p.name} ${p.venue} ${p.age}`.includes(search)))
    .sort((a,b)=>a.venue.localeCompare(b.venue,'ja')||({maidenDebut:0,maiden:1,allowance:2,open:3,graded:4}[a.class]-{maidenDebut:0,maiden:1,allowance:2,open:3,graded:4}[b.class])||a.distance-b.distance||a.id.localeCompare(b.id));
}
export function raceFromProgram(program,{day=jpDay(Date.now()),id=uid()}={}) {
  return {id,date:day,category:program.category,country:'日本',venue:program.venue,number:1,name:program.name,surface:program.surface,distance:program.distance,grade:program.grade,class:program.class,zone:'Asia/Tokyo',startAt:null,manual:true,sourceIDs:['ds2-game-program-reference','ds2-game-program-data'],checkedOn:gameCalendar.checkedOn,confirmedKinds:null,
    gameOrigin:{edition:'Nintendo Switch 2版参考',programId:program.id,month:program.month,week:program.week,age:program.age,condition:program.condition,sourceImageId:program.sourceImageId,sourceRow:program.sourceRow}};
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
