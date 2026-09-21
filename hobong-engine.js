/* Education pay-step calculator. Reference behaviour: scan0 auto_habong_master v1.3.
 * Pure functions; UTC day numbers avoid browser timezone/DST differences.
 * End dates are the LAST INCLUDED day. Post-appointment rows end before base date.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Hobong = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  const serial = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);
  const parts = n => { const d = new Date(n * DAY); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
  function parse(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
    const m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(String(value || '').trim());
    if (!m) return null;
    const [y, mo, d] = m.slice(1).map(Number), n = serial(y, mo, d);
    return y >= 1900 && parts(n).every((v, i) => v === [y, mo, d][i]) ? n : null;
  }
  const iso = n => n == null ? '' : parts(n).map((v, i) => i ? String(v).padStart(2, '0') : v).join('-');
  const lastDay = n => { const [y,m] = parts(n); return serial(y,m+1,0); };
  function shiftMonth(n, count) {
    const [y,m,d] = parts(n), last = parts(serial(y,m+count+1,0));
    return serial(last[0],last[1],Math.min(d,last[2]));
  }
  const nextMonth = n => { const [y,m] = parts(n); return serial(y,m+1,1); };
  function split(days) {
    const n = Math.max(0,Math.round(days || 0));
    return {y:Math.floor(n/360),m:Math.floor(n%360/30),d:n%30};
  }
  const units = t => t ? t.y*360+t.m*30+t.d : 0;
  const text = t => t ? `${t.y}년 ${t.m}월 ${t.d}일` : '';
  const prorate = (days,numerator,denominator=100) => Math.max(0,Math.floor(days*numerator/denominator+1e-7));

  // Calendar anniversaries, inclusive end, short month-end and 30-day carry.
  function period(start, end) {
    if (start == null || end == null || end < start) return null;
    const [sy,sm,sd] = parts(start), [ey,em,ed] = parts(end);
    const atEnd = lastDay(end) === end;
    const previousMonthLength = parts(serial(ey,em,0))[2];
    const beforeAnniversary = end < serial(ey,sm,sd)-1;
    let years = ey-sy + (sm===1 && sd===1 && em===12 && ed===31 ? 1 : 0) - Number(beforeAnniversary);
    let months = em-sm + Number(sd===1 && atEnd) + 12*Number(beforeAnniversary)
      - Number(ed < sd-1) + Number(atEnd && ed < sd-1);
    months = (months%12+12)%12;
    let days = 0;
    if (!(sd===1 && atEnd) && ed!==sd-1 && !(atEnd && ed<sd-1)) {
      days = ed;
      if (sd-1<ed) days -= sd-1;
      if (ed<sd-1 && sd-1<previousMonthLength) days += previousMonthLength-sd+1;
      if (sd+29===ed || (previousMonthLength===31 && sd-2===ed)) days--;
    }
    months += Math.floor(days/30); years += Math.floor(months/12);
    return {y:years,m:months%12,d:days%30};
  }
  function afterPeriod(start, length) {
    const [y,m,d] = parts(start), shifted = shiftMonth(serial(y+length.y,m,d),length.m);
    return shifted + length.d + Number(parts(shifted)[2]!==d);
  }
  const eras = [
    {start:parse('2012-03-01'),end:Infinity,hours:40},
    {start:parse('2006-03-01'),end:parse('2012-02-29'),hours:42},
    {start:parse('2005-03-01'),end:parse('2006-02-28'),hours:43},
    {start:-Infinity,end:parse('2005-02-28'),hours:44}
  ];
  function beforeRow(input) {
    const r = {...input, start:parse(input.start), end:parse(input.end), warnings:[], valid:false, days:0, converted:0};
    const rate = Number(input.rate), part = input.part;
    if (input.rate==='' || !Number.isFinite(rate) || rate<0 || rate>100) { r.warnings.push('환산율은 0~100 사이로 입력하세요.'); return r; }
    if (part && Number(part.method)===3) {
      const avg=Number(part.avg)||40, total=Number(part.total)||0, weekdays=avg===40?5:6;
      r.days=prorate(weekdays,total,avg); r.converted=prorate(weekdays,total*rate,avg*100);
      r.valid=total>0; r.noDates=true;
      if (!r.valid) r.warnings.push('총 근무시간을 입력하세요.');
    } else {
      if (r.start==null || r.end==null || r.end<r.start) { r.warnings.push('경력 시작일·산입 마지막 날을 확인하세요.'); return r; }
      r.days=units(period(r.start,r.end)); r.valid=true;
      if (!part) r.converted=prorate(r.days,rate);
      else if (Number(part.method)===4) r.converted=prorate(r.days,30*rate,10000);
      else {
        const hours=Number(part.method)===2 ? (r.days?Math.floor(Number(part.total)*7/r.days):0) : Number(part.hours)||0;
        r.weekly=hours;
        for (const era of eras) {
          const a=Math.max(r.start,era.start), b=Math.min(r.end,era.end);
          if (a<=b) r.converted+=prorate(units(period(a,b)),hours*rate,era.hours*100);
        }
        if (hours<=12) r.warnings.push('주당 12시간 이하: 30% 방식 적용 여부를 확인하세요.');
      }
    }
    if (Number(input.cap)>0) r.converted=Math.min(r.converted,prorate(Math.round(Number(input.cap))*30,rate));
    return r;
  }
  function afterRows(inputs, appointment, base, capMonths) {
    const rows=inputs.map((r,i)=>({...r,start:i===0?appointment:parse(r.start),warnings:[],valid:false,days:0,converted:0}));
    const out={rows,segments:[],total:0,naive:0,correction:0,returns:[],children:{1:[],2:[]},inLeave:()=>false};
    if (appointment==null || base==null) return out;
    const eligible=rows.filter(r=>{
      if(r.start==null) { r.warnings.push('시작일을 입력하세요.'); return false; }
      if(r.start<appointment) { r.warnings.push('임용일 이전 — 임용 전 경력(2단계)에 넣으세요.'); return false; }
   if(r.start>=base) { r.warnings.push('획정기준일 이후 — 산입되지 않음'); return false; }
      return true;
    });
    eligible.forEach((r,i)=>{
      r.end=i+1<eligible.length?eligible[i+1].start-1:base-1;
      if(i && r.start<=eligible[i-1].start) r.warnings.push('임용 후 시작일을 오름차순으로 입력하세요.');
      if(r.end<r.start) { r.warnings.push('다음 행 시작일을 확인하세요.'); return; }
      if(!['child','child3','familyCare'].includes(r.rate)&&(r.rate===''||!Number.isFinite(Number(r.rate))||Number(r.rate)<0||Number(r.rate)>100)){r.warnings.push('환산율은 0~100 사이로 입력하세요.');return;}
      r.valid=true; r.days=units(period(r.start,r.end));
      r.leave=/휴직/.test(r.desc||'');
      r.childLimited=r.rate==='child' && [1,2].includes(Number(r.child));
      r.child3Limited=r.rate==='child3';
      r.familyCareLimited=r.rate==='familyCare';
      if(!r.childLimited && !r.child3Limited && !r.familyCareLimited) r.converted=prorate(r.days,Number(r.rate)||0);
    });
    const valid=rows.filter(r=>r.valid);
    for(const child of [1,2]) {
      let used=0;
      for(const r of valid.filter(r=>r.childLimited && Number(r.child)===child)) {
        r.converted=Math.min(r.days,Math.max(0,capMonths*30-used)); used+=r.days;
        out.children[child].push({start:r.start,end:r.end,days:r.days,counted:r.converted});
      }
    }
    { // 셋째 이상 자녀 육아휴직: 36개월(3년) 산입 상한.
      let used=0;
      for(const r of valid.filter(r=>r.child3Limited)) {
        r.converted=Math.min(r.days,Math.max(0,36*30-used)); used+=r.days;
      }
    }
    { // 가족돌봄휴직: 2026-01-01 이후 시작분만 첫 90일 산입 (공무원보수규정 개정, 대통령령 제36501호).
      // 부칙 경과규정(2026-01-01 이전 개시분의 경과일수 이월)은 미구현 — 그 경우는 산입 0으로 처리하고 경고를 남긴다.
      let used=0; const familyCareEffective=parse('2026-01-01');
      for(const r of valid.filter(r=>r.familyCareLimited)) {
        if(r.start>=familyCareEffective) { r.converted=Math.min(r.days,Math.max(0,90-used)); used+=r.days; }
        else { r.converted=0; r.warnings.push('2026-01-01 이전에 시작한 가족돌봄휴직의 90일 산입 경과규정은 자동 계산되지 않습니다. 담당자가 수동으로 확인하세요.'); }
      }
    }
    // Keep each partial-rate row as its own segment. Only fully counted adjacent
    // post-appointment rows share a calendar interval (pre rows stay separate).
    const boundaries=new Set(); let previous=null;
    for(const r of valid) {
      r.full=r.converted===r.days;
      r.partialChild=(r.childLimited||r.child3Limited||r.familyCareLimited) && !r.full;
      if(r.partialChild) r.capDate=afterPeriod(r.start,split(r.converted));
      if(!r.full || previous===null || !previous) boundaries.add(r.partialChild?r.capDate:r.start);
      if(r.partialChild && (previous===null || !previous)) boundaries.add(r.start);
      previous=r.full;
    }
    const cuts=[...boundaries].sort((a,b)=>a-b);
    cuts.forEach((start,i)=>{
      const end=i+1<cuts.length?cuts[i+1]-1:base-1, row=valid.find(r=>r.start===start);
      const days=row?(row.full?units(period(start,end)):row.converted):0;
      out.segments.push({start,end,days,before:out.total,full:!!row?.full}); out.total+=days;
    });
    out.naive=valid.reduce((sum,r)=>sum+r.converted,0); out.correction=out.total-out.naive;
    valid.forEach((r,i)=>{ if(i && !r.leave && valid[i-1].leave) out.returns.push(r.start); });
    if(valid.length && valid[valid.length-1].leave) out.returns.push(base);
    out.inLeave=date=>{ let last; for(const r of valid) { if(r.start>date) break; last=r; } return !!last?.leave; };
    return out;
  }
  function creditedAt(post,date) {
    const segments=post.segments;
    if(!segments.length) return 0;
    const at=segments.find(s=>s.start===date); if(at) return at.before;
    if(date-1>=segments[segments.length-1].end) return post.total;
    const s=segments.find(s=>s.start<=date-1 && date-1<=s.end);
    return s?s.before+units(period(s.start,date-1)):0;
  }
  function calculate(state) {
    const cfg=state.settings||{}, appointment=parse(cfg.appointDate), base=parse(cfg.standardDate);
    const pre=(state.careers||[]).filter(r=>r.scope!=='post').map(beforeRow);
    const postInput=(state.careers||[]).filter(r=>r.scope==='post');
    const post=afterRows(postInput,appointment,base,Number(cfg.parentalLimit)||12);
    const preTotal=pre.reduce((sum,r)=>sum+r.converted,0), total=preTotal+post.total;
    const education=Number(cfg.schoolYears)-16+(Number(cfg.extraYears)||0)+(cfg.specialSchool?1:0);
    const cert=Number(cfg.baseStep)||0, issues=[];
    if(appointment==null) issues.push('임용일자를 입력하세요.');
    if(base==null) issues.push('획정기준일을 입력하세요.');
    if(base!=null && appointment!=null && base<appointment) issues.push('획정기준일이 임용일보다 빠릅니다.');
    if(!cert) issues.push('기산호봉을 선택하세요.');
    if(cfg.schoolYears==='' || !Number.isFinite(education)) issues.push('학령을 입력하세요.');
    if(Number(cfg.schoolMonths)||Number(cfg.extraMonths)) issues.push('기준 사이트는 학령·가산연수를 연 단위로 계산합니다. 기존 월 입력값을 확인하세요.');
    const r={pre,post,preTotal,total,education,events:[],result:null,issues};
    for(const [label,rows] of [['임용 전',pre],['임용 후',post.rows]]) rows.forEach((row,i)=>row.warnings.forEach(w=>issues.push(`${label} ${i+1}행: ${w}`)));
    if(pre.some(row=>row.valid&&!row.noDates&&appointment!=null&&row.end>=appointment))issues.push('임용 전 경력이 임용일 이후까지 포함되어 있습니다.');
    if(!Number.isInteger(Number(cfg.schoolYears))||Number(cfg.schoolYears)<0||!Number.isInteger(Number(cfg.extraYears||0))||Number(cfg.extraYears||0)<0)issues.push('학령과 가산연수는 0 이상의 정수로 입력하세요.');
    const spans=pre.filter(p=>p.valid&&!p.noDates).map(p=>[p.start,p.end]);
    if(appointment!=null && base>appointment) spans.push([appointment,base-1]);
    if(spans.some((a,i)=>spans.some((b,j)=>j>i&&a[0]<=b[1]&&b[0]<=a[1]))) issues.push('겹치는 경력이 있습니다. 중복 산입 여부를 확인하세요.');
    if(appointment==null || base==null || base<appointment || !cert || !Number.isFinite(education)) return r;
    const certDate=cert===9?parse(cfg.certificateDate):null;
    let certChange=certDate==null?null:nextMonth(certDate);
    if(certChange!=null && post.inLeave(certChange)) certChange=null;
    const milestones=[base,...post.returns,...(certChange==null?[]:[certChange])];
    function event(date,previous,type) {
      const credited=preTotal+creditedAt(post,date), t=split(credited), rem=t.m*30+t.d;
      const firstGrade=certDate==null || date>certDate ? 1 : 0;
      const deferred=!!(previous && type==='호봉재획정' && date<previous.next && t.y>previous.period.y);
      const anniversary=shiftMonth(date,Math.floor((360-rem)/30))+(360-rem)%30-1;
      return {date,type,step:t.y+education+cert-1+firstGrade-Number(deferred),period:t,total:credited,
        next:deferred?nextMonth(date):nextMonth(anniversary),deferred};
    }
    r.events.push(event(appointment,null,'초임호봉획정'));
    for(let i=0;i<80;i++) {
      const previous=r.events[r.events.length-1]; let date;
      if(previous.deferred) date=nextMonth(previous.date);
      else {
        date=Math.min(previous.next,...milestones.filter(d=>d>previous.date));
        if(post.inLeave(date)) { const returns=post.returns.filter(d=>d>=date); if(!returns.length) break; date=Math.min(...returns); }
        if(date>base) break;
      }
      if(date<=previous.date) { issues.push('승급기록 날짜를 확인하세요.'); break; }
      r.events.push(event(date,previous,previous.deferred || date===previous.next?'정기승급':'호봉재획정'));
      if(date>base) break;
    }
    const current=r.events.find(e=>e.date===base);
    if(!current) { issues.push('획정기준일이 휴직 중인지 확인하고 복직일을 입력하세요.'); return r; }
    const rem=current.period.m*30+current.period.d;
    const regularNext=nextMonth(shiftMonth(base,Math.floor((360-rem)/30))+(360-rem)%30-1);
    r.result={...current,step:cfg.limitStep?Math.min(current.step,14):current.step,
      years:current.period.y,
      noNext:cfg.reason==='계약제교원 임용',
      carry:Math.max(0,units(period(base,regularNext-1))+rem-360)};
    return r;
  }
  return {parse,iso,serial,parts,period,split,units,text,prorate,shiftMonth,nextMonth,afterPeriod,beforeRow,afterRows,calculate};
});
