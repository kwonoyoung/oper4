/* UI adapter: the pure calculation engine is also used by regression tests. */
(() => {
  'use strict';
  const H=window.Hobong, $=id=>document.getElementById(id), body=$('careerBody');
  const KEY='edu_public_officer_hobong_v2', OLD='edu_public_officer_hobong_draft_v1';
  const settings=['org','personName','position','currentStep','schoolName','educationType','certificateName','writerPos','writerName','selfPos','selfName','checkerPos','checkerName','noPre','schoolYears','schoolMonths','extraYears','extraMonths','baseStep','certificateDate','appointDate','standardDate','reason','parentalLimit','specialSchool','limitStep','casePreset'];
  const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // 교육부 예규 제97호(2025.4.23) 별표 1 기준. 환산율은 증빙·심의 결과에
  // 따라 달라질 수 있으므로 사용자가 최종 확인·조정할 수 있게 둔다.
  const kinds=[
    ['normal','일반 경력(직접 입력)',100],['publicTeacher','국·공립학교 교원',100],
    ['privateTeacher','사립학교 교원(임면 보고)',100],['privateUnreported','사립학교 교원(미보고)',50],
    ['mismatchTeacher','자격증·학교 불일치 기간제교원',80],['lifelongTeacher','학교형태 평생교육시설 교원',100],
    ['koreanSchool','한국학교 교원',100],['daycare','어린이집 보육교직원',100],['disabledDaycare','장애영유아 어린이집',80],
    ['nationalCivil','국가·지방공무원',100],['employmentCivil','고용직공무원',80],
    ['publicAgency','공공기관·공공법인',50],['foundation','재단법인 근무',30],['alternative','대안교육 위탁교육기관',70],
    ['academy','등록 학원·교습소 강사',50],['academyUnregistered','미등록 학원·교습소(객관자료)',30],['company','일반 회사 근무',40],
    ['religious','종교법인 교육활동',60],['lawyer','변호사·법무사 업무',70],['teacherUnion','교원 노동조합 근무',70],
    ['sick','질병휴직',0],['official','공무상 질병휴직',100],['military','병역휴직',100],['duty','법정의무수행휴직',100],['study','유학휴직',100],
    ['partLeave','고용휴직(비상근)',50],['fullLeave','고용휴직(상근)',100],['adopt','입양휴직',100],['fertility','불임난임휴직',0],
    ['child1','육아휴직(첫째)','child',1],['child2','육아휴직(둘째)','child',2],['child3','육아휴직(셋째 이상)',100,3],
    ['training','국내연수휴직',0],['degreeLeave','국내연수휴직(학위취득)',100],['family','가사휴직',0],['accompany','동반휴직',0],
    ['union','노조전임자휴직',100],['selfTraining','자율연수휴직',0],['degree','대학원 학위',100],['part','시간강사',100]
  ];
  let timer,lastResult,canExport=false;
  const defaults=Object.fromEntries(settings.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));
  function toast(message) { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2400); }
  function inferKind(r) {
    if(r.kind) return r.kind;
    if(r.rate==='child') return Number(r.child)===2?'child2':'child1';
    if(r.part) return 'part'; if(r.cap || r.type==='학위') return 'degree';
    return 'normal'; // Legacy generic 휴직 cannot imply a legal percentage.
  }
  function addRow(data={}) {
    const r={scope:'pre',start:'',end:'',rate:100,desc:'',cap:0,...data};
    const tr=document.createElement('tr'); tr.dataset.kind=inferKind(r);
    tr.innerHTML=`<td><span class="rownum"></span><select class="user career-scope" aria-label="경력 구분"><option value="pre">임용 전</option><option value="post">임용 후</option></select></td>
      <td><input type="date" class="user career-start" aria-label="경력 시작일"></td>
      <td><input type="date" class="user career-end" aria-label="산입 마지막 날"></td>
      <td><input class="auto career-period" readonly aria-label="경력 기간"></td>
      <td><input class="user career-desc" aria-label="경력 내용" placeholder="기관·경력 또는 휴직 종류"></td>
      <td><input class="user career-rate" type="number" min="0" max="100" step="0.01" aria-label="환산율"><small class="child-label" hidden>자녀별 상한 적용</small></td>
      <td><input class="auto converted-period" readonly aria-label="환산 기간"></td>
      <td class="special-cell"><div class="special-fields"><select class="career-kind" aria-label="특수 경력 종류">${kinds.map(k=>`<option value="${k[0]}">${k[1]}</option>`).join('')}</select>
        <label class="cap-field" hidden>학위 상한<select class="career-cap" aria-label="학위 상한"><option value="0">없음</option><option value="24">석사 2년</option><option value="30">석사 2년 6개월</option><option value="36">박사 3년</option></select></label>
        <div class="part-fields" hidden><label>시간강사 방식<select class="part-method" aria-label="시간강사 방식"><option value="1">주당 근무시간</option><option value="2">총 시간 → 주당 환산</option><option value="3">비연속 총 근무시간</option><option value="4">30% 적용</option></select></label>
          <label class="hours-field">주당 근무시간<input type="number" min="0" class="part-hours" aria-label="주당 근무시간" value="20"></label>
          <label class="total-field">총 근무시간<input type="number" min="0" class="part-total" aria-label="총 근무시간" value="0"></label>
          <label class="avg-field">주당 평균시간<select class="part-avg" aria-label="주당 평균시간"><option>40</option><option>42</option><option>43</option><option>44</option></select></label>
        </div></div></td>
      <td class="special-cell"><button class="btn btn-outline btn-sm move-up" aria-label="경력 위로">↑</button><button class="btn btn-outline btn-sm move-down" aria-label="경력 아래로">↓</button><button class="btn btn-danger btn-sm delete-row">삭제</button></td>`;
    const set=(cls,value)=>tr.querySelector('.'+cls).value=value??'';
    set('career-scope',r.scope);set('career-start',r.start);set('career-end',r.end);set('career-desc',r.desc);
    set('career-rate',r.rate==='child'?100:r.rate);set('career-kind',tr.dataset.kind);set('career-cap',r.cap);
    if(r.part) for(const k of ['method','hours','total','avg']) if(r.part[k]!=null) set('part-'+k,r.part[k]);
    body.append(tr);
    tr.addEventListener('input',()=>{recalculate();saveLater();});
    tr.addEventListener('change',e=>{
      if(e.target.matches('.career-kind')) {
        const selected=kinds.find(k=>k[0]===e.target.value);tr.dataset.kind=selected[0];
        if(selected[0]!=='normal') {set('career-desc',selected[1]);set('career-rate',selected[2]==='child'?100:selected[2]);}
        if(selected[0]==='degree') {set('career-scope','pre');if(!Number(tr.querySelector('.career-cap').value))set('career-cap',24);}
        if(selected[0]==='part') set('career-scope','pre');
        if(/휴직/.test(selected[1])) set('career-scope','post');
      }
      recalculate();saveLater();
    });
    tr.addEventListener('focusin',e=>{if('value' in e.target){$('formulaAddress').textContent='행 '+([...body.rows].indexOf(tr)+1);$('formulaValue').textContent=e.target.value||'(빈 값)';}});
    tr.querySelector('.delete-row').onclick=()=>{tr.remove();recalculate();saveLater();};
    tr.querySelector('.move-up').onclick=()=>{if(tr.previousElementSibling)body.insertBefore(tr,tr.previousElementSibling);recalculate();saveLater();};
    tr.querySelector('.move-down').onclick=()=>{if(tr.nextElementSibling)body.insertBefore(tr.nextElementSibling,tr);recalculate();saveLater();};
    return tr;
  }
  function rowData(tr) {
    const val=cls=>tr.querySelector('.'+cls).value,kind=val('career-kind'),limited=kind==='child1'||kind==='child2';
    return {scope:val('career-scope'),start:val('career-start'),end:val('career-end'),desc:val('career-desc'),kind,
      rate:limited?'child':val('career-rate'),child:limited?Number(kind.slice(-1)):kind==='child3'?3:0,
      cap:kind==='degree'?Number(val('career-cap')):0,
      part:kind==='part'?{method:Number(val('part-method')),hours:Number(val('part-hours')),total:Number(val('part-total')),avg:Number(val('part-avg'))}:null};
  }
  function collect() {
    return {version:2,settings:Object.fromEntries(settings.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),careers:[...body.rows].map(rowData),savedAt:new Date().toISOString()};
  }
  function active(r) { return r.scope==='post'||r.start||r.end||r.desc||r.part; }
  function recalculate() {
    const rows=[...body.rows],post=rows.filter(tr=>tr.querySelector('.career-scope').value==='post');
    rows.forEach((tr,i)=>{
      tr.querySelector('.rownum').textContent=i+1;
      const scope=tr.querySelector('.career-scope').value,kind=tr.querySelector('.career-kind').value;
      tr.querySelector('.cap-field').hidden=kind!=='degree';tr.querySelector('.part-fields').hidden=kind!=='part';
      const method=tr.querySelector('.part-method').value;
      tr.querySelector('.hours-field').hidden=method!=='1';tr.querySelector('.total-field').hidden=!['2','3'].includes(method);tr.querySelector('.avg-field').hidden=method!=='3';
      tr.querySelectorAll('td').forEach(td=>td.classList.toggle('row-special',kind!=='normal'));
      const isChild=kind==='child1'||kind==='child2';tr.querySelector('.career-rate').readOnly=isChild;tr.querySelector('.child-label').hidden=!isChild;
      tr.querySelector('.career-end').readOnly=scope==='post';tr.querySelector('.career-start').readOnly=scope==='post'&&post[0]===tr;
      tr.querySelector('.career-period').value='';tr.querySelector('.converted-period').value='';
    });
    post.forEach((tr,i)=>{
      if(!i) tr.querySelector('.career-start').value=$('appointDate').value;
      const next=H.parse(i+1<post.length?post[i+1].querySelector('.career-start').value:$('standardDate').value);
      tr.querySelector('.career-end').value=next==null?'':H.iso(next-1);
    });
    const data=collect();data.careers=data.careers.filter(active);
    const result=H.calculate(data);lastResult=result;
    let preIndex=0,postIndex=0;
    rows.forEach(tr=>{
      const r=rowData(tr);if(!active(r))return;
      const calculated=r.scope==='post'?result.post.rows[postIndex++]:result.pre[preIndex++];
      if(calculated?.valid){tr.querySelector('.career-period').value=H.text(H.split(calculated.days));tr.querySelector('.converted-period').value=H.text(H.split(calculated.converted));}
    });
    const warnings=[...result.issues];
    if(!post.length && H.parse(data.settings.standardDate)>H.parse(data.settings.appointDate))warnings.push('임용 후 경력이 없습니다. 근무기간이 있으면 임용 후 경력 행을 추가하세요.');
    const incompatible=data.careers.some(r=>(r.scope==='post'&&(r.cap||r.part))||(r.scope==='pre'&&r.rate==='child'));
    if(incompatible)warnings.push('학위·시간강사는 임용 전, 자녀별 육아휴직은 임용 후로 입력하세요.');
    const legacyMonths=Number(data.settings.schoolMonths)||Number(data.settings.extraMonths);
    // 경고가 있는 상태에서 숫자 호봉을 보여주면 잘못된 입력을 확정값으로
    // 오인할 수 있다. 날짜·환산율·기준일 오류가 해소될 때까지 결과를 보류한다.
    if(data.settings.noPre&&data.careers.some(r=>r.scope==='pre'))warnings.push('임용 전 경력 없음 선택과 입력 경력이 충돌합니다.');
    const current=incompatible||legacyMonths||warnings.length?null:result.result;canExport=!!current;
    $('resultStep').textContent=current?current.step+'호봉':'입력 확인';
    $('nextPromotion').textContent=current?(current.noNext?'없음 (계약제)':H.iso(current.next)):'—';
    $('totalConverted').textContent=H.text(H.split(result.total));
    $('preTotal').textContent=H.text(H.split(result.preTotal));$('postTotal').textContent=H.text(H.split(result.post.total));
    $('correction').textContent=(result.post.correction>0?'+':'')+result.post.correction+'일';
    $('eduAdjustment').textContent=(result.education>0?'+':'')+result.education+'년';
    $('remaining').textContent=current?`${current.years}년 / ${current.period.m}월 ${current.period.d}일`:'—';
    $('carryDays').textContent=current?current.carry+'일':'—';
    $('careerCount').textContent=data.careers.length+'건';$('baseStepView').textContent=data.settings.baseStep+'호봉';$('reasonView').textContent=data.settings.reason;
    const s=data.settings, filled=v=>String(v??'').trim()!=='';
    const checks=[filled(s.org)&&filled(s.personName),filled(s.schoolName)&&filled(s.schoolYears),filled(s.baseStep)&&filled(s.certificateName),!!H.parse(s.appointDate)&&!!H.parse(s.standardDate),s.noPre&&!data.careers.some(r=>r.scope==='pre')||result.pre.length>0&&result.pre.every(r=>r.valid&&!r.warnings.length),H.parse(s.appointDate)===H.parse(s.standardDate)&&!!s.appointDate||result.post.rows.some(r=>r.valid)&&result.post.rows.every(r=>!r.warnings.length),filled(s.writerName)&&filled(s.selfName)&&filled(s.checkerName)];
    const done=checks.filter(Boolean).length;
    $('railProgressText').textContent=`${done}/7`;$('railProgressBar').style.width=`${done/7*100}%`;
    document.querySelectorAll('[data-section]').forEach((btn,i)=>{btn.parentElement.classList.toggle('done',checks[i]);btn.querySelector('em').textContent=checks[i]?'완료':'미입력';});
    $('issues').innerHTML=warnings.length?warnings.map(w=>`<li>${html(w)}</li>`).join(''):'<li>입력 오류 없음 — 경력 증빙과 적용 환산율을 대조해 주세요.</li>';
    $('eventBody').innerHTML=result.events.slice().reverse().map(e=>`<tr><td>${H.iso(e.date)}</td><td>${html(e.type)}</td><td>${e.step}호봉</td><td>${e.period.y}년</td><td>${e.period.m}월 ${e.period.d}일</td><td>${data.settings.reason==='계약제교원 임용'&&e.date===H.parse(data.settings.standardDate)?'없음':H.iso(e.next)}</td></tr>`).join('');
    $('childBody').innerHTML=Object.entries(result.post.children).flatMap(([child,items])=>items.map(r=>`<tr><td>${child==='1'?'첫째':'둘째'}</td><td>${H.iso(r.start)}</td><td>${H.iso(r.end)}</td><td>${H.text(H.split(r.days))}</td><td>${H.text(H.split(r.counted))}</td></tr>`)).join('');
  }
  function apply(data) {
    if(!data||!data.settings||!Array.isArray(data.careers))throw new Error('호봉획정 JSON 형식이 아닙니다.');
    for(const id of settings){const value=data.settings[id]??defaults[id];if($(id).type==='checkbox')$(id).checked=!!value;else $(id).value=value;}
    body.innerHTML='';
    const appointment=H.parse(data.settings.appointDate);
    const migrated=data.careers.map(r=>({...r,scope:r.scope||((appointment!=null&&H.parse(r.start)!=null&&H.parse(r.start)>=appointment)?'post':'pre')}));
    for(const r of migrated)addRow(r);
    if(!migrated.length)addRow();
    if(data.version!==2) {$('migrationNotice').hidden=false;$('migrationNotice').textContent='기존 초안 자료를 불러왔습니다. 임용일 기준으로 임용 전·후를 구분했으므로 분류와 종료일을 확인하세요. 기존 휴직·학위 표시는 적용 종류를 다시 선택하세요. 원본은 기존 저장 키에 유지됩니다.';}
    document.querySelectorAll('.legacy-month').forEach(el=>el.hidden=!Number(el.querySelector('input').value));
    recalculate();
  }
  function save(message=false) {timer=null;try{localStorage.setItem(KEY,JSON.stringify(collect()));$('saveStatus').textContent='저장됨 '+new Date().toLocaleTimeString('ko-KR');$('railSaveStatus').textContent='✓ '+$('saveStatus').textContent;if(message)toast('이 브라우저에 저장했습니다.');}catch(e){$('saveStatus').textContent='저장 실패 · JSON으로 백업하세요.';$('railSaveStatus').textContent='저장 실패';}}
  function saveLater(){clearTimeout(timer);$('saveStatus').textContent='저장 중…';$('railSaveStatus').textContent='저장 중…';timer=setTimeout(()=>save(),350);}
  function download(name,data,type) {const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function example(){apply({version:2,settings:{schoolYears:16,schoolMonths:0,extraYears:1,extraMonths:0,specialSchool:false,limitStep:false,baseStep:9,certificateDate:'2010-08-27',appointDate:'2006-09-01',standardDate:'2021-03-01',parentalLimit:12,reason:'일반'},careers:[
    {scope:'pre',start:'2002-03-01',end:'2004-08-31',desc:'기간제교사 1',rate:100},{scope:'pre',start:'2005-01-01',end:'2006-02-07',desc:'기간제교사 2',rate:100},
    ...['2006-09-01','2014-07-25','2015-11-01','2018-10-04','2019-04-25','2019-07-24'].map((start,i)=>({scope:'post',start,rate:[100,0,100,'child',100,'child'][i],child:i===3||i===5?1:0,kind:['normal','sick','normal','child1','normal','child1'][i],desc:['근무','질병휴직','근무','육아휴직(첫째)','근무','육아휴직(첫째)'][i]}))]});saveLater();toast('기준 예제: 25호봉 · 차기승급일 2021-07-01');}
  function applyCasePreset(){
    const p=$('casePreset').value;
    const base={schoolYears:16,schoolMonths:0,extraYears:0,extraMonths:0,specialSchool:false,limitStep:false,baseStep:9,certificateDate:'',parentalLimit:12,reason:'초임호봉획정',casePreset:p};
    const cases={
      agency:{appointDate:'2022-01-01',standardDate:'2023-01-01',careers:[{scope:'pre',start:'2021-01-01',end:'2021-03-31',desc:'교육지원청 근무(주 15시간 이상)',kind:'nationalCivil',rate:50},{scope:'pre',start:'2021-04-01',end:'2021-12-31',desc:'재단법인 근무(주 15시간 이상)',kind:'foundation',rate:30}]},
      academy:{appointDate:'2022-01-01',standardDate:'2023-01-01',careers:[{scope:'pre',start:'2021-01-01',end:'2021-06-30',desc:'등록 학원 강사',kind:'academy',rate:50},{scope:'pre',start:'2021-07-01',end:'2021-12-31',desc:'일반 회사 근무',kind:'company',rate:40}]},
      leave:{appointDate:'2020-03-01',standardDate:'2022-03-01',reason:'일반',careers:[{scope:'post',start:'2020-03-01',desc:'근무',kind:'normal',rate:100},{scope:'post',start:'2021-03-01',desc:'육아휴직(첫째)',kind:'child1',rate:'child',child:1}]}
    };
    if(cases[p]){apply({version:2,settings:{...base,...cases[p]},careers:cases[p].careers});saveLater();toast('사례집 대표 사례를 적용했습니다. 증빙자료에 맞게 수정하세요.');}
  }
  function toSiteRow(x){ return {from:x.start,to:x.end,start:x.start,text:x.rate==='child'?x.desc.replace(/\s*\((첫째|둘째)\)/g,'')+' ('+(Number(x.child)===2?'둘째':'첫째')+')':x.desc,pct:x.rate,note:'',cap:Number(x.cap)||0,part:x.part||null}; }
  function exportExcel(){
    recalculate();if(!canExport){toast('입력 확인의 오류를 먼저 수정하세요.');document.querySelector('[data-tab=issues]').click();$('detail').scrollIntoView();return;}const r=lastResult,d=collect(),s=d.settings;
    const rows=d.careers.filter(active);
    const children={};Object.entries(r.post.children||{}).forEach(([child,items])=>{children[child]=items.map(x=>({start:x.start,end:x.end,termStr:H.text(H.split(x.days)),countedStr:H.text(H.split(x.counted)),exceed:null}));});
    const S={who:{org:s.org,name:s.personName,pos:s.position},form:{formTitle:'',curHobong:s.currentStep,writerPos:s.writerPos,writerName:s.writerName,selfPos:s.selfPos,selfName:s.selfName,checkerPos:s.checkerPos,checkerName:s.checkerName},
      edu:{type:s.educationType,school:s.schoolName,age:s.schoolYears,add:s.extraYears,spe:!!s.specialSchool},
      cert:{name:s.certificateName,base:s.baseStep,date:s.certificateDate},
      opt:{first:!!s.reason&&s.reason!=='일반',limit:!!s.limitStep,childCap:s.parentalLimit},
      appt:s.appointDate,base:s.standardDate,
      pre:rows.filter(x=>x.scope!=='post').map(toSiteRow),
      post:rows.filter(x=>x.scope==='post').map(toSiteRow)};
    const R={pre:{rows:[]},post:{rows:[],children},result:{flag13:r.result?.deferred?1:0},contract:s.reason==='계약제교원 임용',base:H.parse(s.standardDate),
      events:r.events.map(e=>({hobong:e.step,type:e.type,date:e.date,years:e.period.y,remStr:`${e.period.m}월 ${e.period.d}일`,next:e.next,flag13:false,beyond:false}))};
    try{ window.HobongXlsx.export(S,R); toast('엑셀로 저장했습니다 — 호봉획정표(수식 포함) · 자료 · 계산 · 승급기록'); }
    catch(err){ console.error(err); toast('엑셀 생성 실패: '+err.message); }
  }
  document.querySelectorAll('.setting-card input,.setting-card select,#noPre').forEach(el=>{
    el.addEventListener('input',()=>{recalculate();saveLater();});
    el.addEventListener('change',()=>{
      if(el.id==='reason'){
        let first=[...body.rows].find(tr=>tr.querySelector('.career-scope').value==='post');
        if(!first)first=addRow({scope:'post',desc:'근무'});
        const desc=first.querySelector('.career-desc'),rate=first.querySelector('.career-rate'),kind=first.querySelector('.career-kind');
        if(el.value!=='일반'){desc.value='초임호봉획정 또는 계약제교원 임용';rate.value=0;kind.value='normal';}
        else if(desc.value==='초임호봉획정 또는 계약제교원 임용'){desc.value='근무';rate.value=100;}
      }
      recalculate();saveLater();
    });
  });
  document.querySelectorAll('[data-adjust]').forEach(btn=>btn.onclick=()=>{const n=H.parse($('standardDate').value);if(n==null)return;const token=btn.dataset.adjust,sign=token[0]==='-'?-1:1,unit=token.slice(-1);$('standardDate').value=H.iso(unit==='d'?n+sign:H.shiftMonth(n,sign*(unit==='y'?12:1)));recalculate();saveLater();});
  $('btnSameDate').onclick=()=>{$('standardDate').value=$('appointDate').value;recalculate();saveLater();};
  $('btnAddRow').onclick=()=>{addRow();recalculate();saveLater();};
  $('btnAddPost').onclick=()=>{addRow({scope:'post',desc:'근무'});recalculate();saveLater();};
  $('btnAddLeave').onclick=()=>{addRow({scope:'post',desc:'질병휴직',rate:0,kind:'sick'});recalculate();saveLater();};
  $('btnAddDegree').onclick=()=>{addRow({scope:'pre',desc:'대학원 학위',kind:'degree',cap:24});recalculate();saveLater();};
  $('btnApplyCase').onclick=applyCasePreset;
  document.querySelectorAll('[data-rail]').forEach(btn=>btn.onclick=()=>{
    const action=btn.dataset.rail;
    if(action==='example') example();
    if(action==='excel') exportExcel();
    if(action==='print') window.print();
    if(action==='save') save(true);
    if(action==='reset') $('btnReset').click();
    if(action==='help'){document.querySelectorAll('[data-rail]').forEach(b=>b.classList.toggle('on',b===btn));$('helpside').classList.remove('min');$('helpBody').innerHTML=helpText.help;$('helpside').scrollIntoView({behavior:'smooth'});}
    if(action==='work'){document.querySelectorAll('[data-rail]').forEach(b=>b.classList.toggle('on',b===btn));body.querySelectorAll('tr').forEach(r=>r.hidden=false);document.querySelector('.sheet-card')?.scrollIntoView({behavior:'smooth'});}
  });
  $('btnSave').onclick=()=>save(true);$('btnPrint').onclick=()=>{recalculate();if(!canExport){toast('입력 확인의 오류를 먼저 수정하세요.');return;}body.querySelectorAll('tr').forEach(r=>r.hidden=false);window.print();};$('btnExample').onclick=example;$('btnExcel').onclick=exportExcel;
  $('btnExportJson').onclick=()=>download('교육공무원_호봉획정_백업.json',JSON.stringify(collect(),null,2),'application/json');
  $('jsonFile').onchange=async e=>{try{if(e.target.files[0]){apply(JSON.parse(await e.target.files[0].text()));save();toast('자료를 불러왔습니다.');}}catch(err){alert('불러오기 실패: '+err.message);}finally{e.target.value='';}};
  $('btnReset').onclick=()=>{if(confirm('현재 브라우저의 호봉 입력자료를 초기화할까요? 먼저 JSON으로 백업할 수 있습니다.')){clearTimeout(timer);timer=null;localStorage.removeItem(KEY);localStorage.removeItem(OLD);location.reload();}};
  const helpText={
    help:'<h3>사용설명서</h3><p>① 왼쪽 7개 항목을 차례로 입력합니다. ② 임용 전 경력은 산입 마지막 날까지, 임용 후 경력은 시작일을 입력합니다. ③ 입력 확인 탭의 오류를 수정한 뒤 엑셀 저장·인쇄를 사용하세요.</p><p>입력값은 자동 저장됩니다. 새 대상자는 현재 자료를 JSON으로 내려받은 뒤 새 입력을 시작합니다. 엑셀 불러오기는 이 프로그램의 표준 서식을 지원합니다.</p>',
    who:'<h3>대상자</h3><p>소속·성명·직위를 입력하세요. 엑셀 호봉획정표에도 함께 반영됩니다.</p>',
    edu:'<h3>학력</h3><p>졸업학교와 실제 학령을 입력하세요. 학력 가감은 학령 − 16 + 가산연수 + 특수학교 가산으로 계산합니다. 가산연수는 증빙에 따라 확인하세요.</p>',
    cert:'<h3>자격면허 · 기산호봉</h3><p>자격면허명과 기산호봉을 입력하세요. 1급 9호봉·2급 8호봉·준교사 및 실기교사 5호봉입니다. 1정 취득일은 승급기록에도 반영됩니다.</p>',
    date:'<h3>임용일자 · 획정기준일</h3><p>임용 후 경력은 획정기준일 전날까지 계산합니다. 초임일에 획정하는 경우 두 날짜를 같게 입력하세요.</p>',
    pre:'<h3>임용 전 경력</h3><p>시작일·산입 마지막 날·경력 유형·환산율을 입력하세요. 경력이 없으면 경력 없음에 체크하세요. 중복 기간과 증빙을 확인하세요.</p>',
    post:'<h3>임용 후 경력</h3><p>임용일 이후 발령 순서로 시작일을 입력합니다. 종료일은 자동입니다. 휴직과 복직은 각각 행을 추가하세요.</p>',
    sign:'<h3>작성자 · 본인 · 확인자</h3><p>각 직위와 성명을 입력하세요. 엑셀 서식의 확인란에 반영됩니다.</p>'
  };
  const targets={who:'bcWho',edu:'bcEdu',cert:'bcCert',date:'bcDate',pre:'xwrap',post:'xwrap',sign:'bcSign'};
  function navigate(key){
    document.querySelectorAll('[data-section]').forEach(b=>{b.classList.toggle('on',b.dataset.section===key);b.setAttribute('aria-current',b.dataset.section===key?'step':'false');});
    document.querySelectorAll('[data-rail]').forEach(b=>b.classList.remove('on'));
    $('helpBody').innerHTML=helpText[key];$('helpside').classList.remove('min');
    const target=$(targets[key]);target.tabIndex=-1;target.scrollIntoView({behavior:'smooth',block:'start'});target.focus({preventScroll:true});
    if(key==='pre'||key==='post'){const row=[...body.rows].find(r=>r.querySelector('.career-scope').value===key);row?.querySelector('.career-start').focus({preventScroll:true});}
  }
  document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>navigate(b.dataset.section));
  Object.entries(targets).filter(([k])=>!['pre','post'].includes(k)).forEach(([key,id])=>$(id).addEventListener('focusin',()=>{$('helpBody').innerHTML=helpText[key];}));
  body.addEventListener('focusin',e=>{const row=e.target.closest('tr');if(row)$('helpBody').innerHTML=helpText[row.querySelector('.career-scope').value];});
  $('railSaveStatus').onclick=()=>save(true);
  $('btnNew').onclick=()=>{clearTimeout(timer);download('호봉획정_이전대상자.json',JSON.stringify(collect(),null,2),'application/json');apply({version:2,settings:defaults,careers:[]});save();navigate('who');toast('이전 대상자를 JSON으로 백업하고 새 입력을 시작합니다.');};
  $('btnImportExcel').onclick=()=>$('excelFile').click();
  $('excelFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const data=await window.HobongImport(file);if(!confirm('현재 입력을 선택한 엑셀 자료로 바꿀까요?'))return;download('호봉획정_불러오기전_백업.json',JSON.stringify(collect(),null,2),'application/json');apply(data);save();toast('엑셀 입력을 불러와 다시 계산했습니다. 입력 확인을 검토하세요.');}catch(err){alert('엑셀 불러오기 실패: '+err.message);}finally{e.target.value='';}};

  // 서비스 표기: VibeCoding 업무지원 페이지와 동일한 명칭을 좌측 상단에 표시합니다.
  (function addProgramBranding(){
    const style=document.createElement('style');
    style.textContent=`
      .oper4-service-brand{padding:18px 20px 15px;border-bottom:1px solid #dedbd2;background:linear-gradient(135deg,#082f4d,#0d5879 58%,#0b8b82);color:#fff;font-size:15px;font-weight:900;line-height:1.35;letter-spacing:-.02em}
      .oper4-service-brand small{display:block;margin-top:4px;color:#b9e5e2;font-size:10px;letter-spacing:.08em;font-weight:800}
      .oper4-program-footer{width:100%;padding:24px 16px 28px;text-align:center;color:#73858f;font-size:11px;line-height:1.7}
      @media(max-width:900px){.oper4-service-brand{padding:14px 16px}.oper4-program-footer{padding:20px 12px 26px}}
      @media print{.oper4-service-brand,.oper4-program-footer{display:none!important}}
    `;
    document.head.append(style);
    const rail=document.querySelector('.rail');
    if(rail&&!rail.querySelector('.oper4-service-brand')){
      const brand=document.createElement('div');
      brand.className='oper4-service-brand';
      brand.innerHTML='오춘기 권오영 업무지원 서비스<small>VIBE CODING · HOBONG TOOL</small>';
      rail.prepend(brand);
    }
    const main=document.querySelector('main');
    if(main&&!main.querySelector('.oper4-program-footer')){
      const footer=document.createElement('div');
      footer.className='oper4-program-footer';
      footer.textContent='2026. Program by Kwon O Young.';
      main.append(footer);
    }
  })();

  window.addEventListener('pagehide',()=>{if(timer){clearTimeout(timer);save();}});
  let restored=false;
  try{const raw=localStorage.getItem(KEY)||localStorage.getItem(OLD);if(raw){apply(JSON.parse(raw));restored=true;}}catch(e){toast('저장 자료를 읽지 못했습니다. 원본은 유지됩니다.');}
  if(!restored){addRow();addRow({scope:'post',desc:'근무'});recalculate();}
})();
