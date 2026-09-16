/* 호봉획정표(xlsx) 내보내기 — 별지 제17호 표준 서식.
   · 호봉획정표 : 별지 제17호 서식 그대로. 노란색 셀=수기 입력, 나머지=수식(자동 계산)
   · 자료       : 학력·자격·옵션 입력(노란색) + 획정 결과(수식)
   · 계산       : 경력기간(역에 의한 계산)·환산·합산·차기승급일 수식 (숨김)
   · 승급기록   : 앱에서 계산한 승급기록·육아휴직 현황(값)
   외부 의존성 없는 값·수식 혼합 OOXML 작성기. */
(function(root){
  'use strict';
  const APP_NAME='교육공무원 호봉획정 자동화', APP_VER='oper4';

  /* ---------- 문자열 ---------- */
  const xesc=s=>String(s??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const trim=s=>String(s??'').trim();
  const SEAL_RE=/\(\s*인\s*\)\s*$/;
  const sealName=v=>{ const t=trim(v); return t?(SEAL_RE.test(t)?t:t+' (인)'):''; };
  const pad2=n=>String(n).padStart(2,'0');
  const safeName=s=>String(s).replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim();

  /* ---------- 날짜(일련번호: 1970-01-01 = 0, UTC) ---------- */
  function dser(y,m,d){ return Math.round(Date.UTC(y,m-1,d)/864e5); }
  function civil(n){ const t=new Date(n*864e5); return {y:t.getUTCFullYear(),m:t.getUTCMonth()+1,d:t.getUTCDate(),w:t.getUTCDay()}; }
  function pdN(s){ if(s==null||s==='') return null; if(typeof s==='number') return Math.round(s); const m=/^(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})/.exec(String(s).trim()); if(!m) return null; const y=+m[1],mo=+m[2],d=+m[3]; if(mo<1||mo>12||d<1||d>31) return null; const n=dser(y,mo,d); const c=civil(n); if(c.m!==mo||c.d!==d) return null; return n; }
  function isoN(n){ if(n==null||n==='') return ''; const c=civil(n); return `${c.y}-${pad2(c.m)}-${pad2(c.d)}`; }
  function isoToExcelSerial(s){ const n=pdN(s); return n==null?null:n+25569; }
  function todayN(){ const t=new Date(); return dser(t.getFullYear(),t.getMonth()+1,t.getDate()); }

  const capMonths=v=>{ const n=+v; return isFinite(n)&&n>0?Math.round(n):0; };
  const textUnits=t=>[...String(t||'')].reduce((a,ch)=>a+(/[\u1100-\u11FF\u3000-\u303F\u3130-\u318F\uAC00-\uD7AF\uFF00-\uFFEF\u4E00-\u9FFF]/.test(ch)?1.9:0.95),0);
  const textLines=(t,capUnits)=>Math.max(1,Math.ceil(textUnits(t)/Math.max(1,capUnits-1)));
  const ymdStr=(daysRef)=>`"( "&TEXT(INT(${daysRef}/360),"00")&"."&TEXT(INT(MOD(${daysRef},360)/30),"00")&"."&TEXT(MOD(${daysRef},30),"00")&" )"`;

  /* ---------- 열 이름 ---------- */
  function colName(n){ let s=''; n++; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; }
  function colIndex(letters){ let n=0; for(const ch of letters) n=n*26+(ch.charCodeAt(0)-64); return n-1; }
  const CN=colName;

  /* ---------- CRC32 / ZIP(무압축) ---------- */
  const CRC_T=(()=>{const t=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c;}return t;})();
  function crc32(u8){let c=-1;for(let i=0;i<u8.length;i++)c=CRC_T[(c^u8[i])&255]^(c>>>8);return (c^-1)>>>0;}
  function zipStore(files,mime){
    const enc=new TextEncoder(); const parts=[]; const cd=[]; let off=0; const now=new Date();
    const dt=((now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1))&0xffff, dd=(((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate())&0xffff;
    for(const f of files){
      const name=enc.encode(f.name); const data=typeof f.data==='string'?enc.encode(f.data):f.data; const crc=crc32(data);
      const lh=new Uint8Array(30+name.length); const v=new DataView(lh.buffer);
      v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint16(6,0x0800,true); v.setUint16(8,0,true); v.setUint16(10,dt,true); v.setUint16(12,dd,true); v.setUint32(14,crc,true); v.setUint32(18,data.length,true); v.setUint32(22,data.length,true); v.setUint16(26,name.length,true); v.setUint16(28,0,true); lh.set(name,30);
      parts.push(lh,data);
      const ch=new Uint8Array(46+name.length); const c=new DataView(ch.buffer);
      c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x0800,true); c.setUint16(10,0,true); c.setUint16(12,dt,true); c.setUint16(14,dd,true); c.setUint32(16,crc,true); c.setUint32(20,data.length,true); c.setUint32(24,data.length,true); c.setUint16(28,name.length,true); c.setUint16(30,0,true); c.setUint16(32,0,true); c.setUint16(34,0,true); c.setUint16(36,0,true); c.setUint32(38,0,true); c.setUint32(42,off,true); ch.set(name,46);
      cd.push(ch); off+=lh.length+data.length;
    }
    const cdLen=cd.reduce((a,b)=>a+b.length,0); const eocd=new Uint8Array(22); const e=new DataView(eocd.buffer);
    e.setUint32(0,0x06054b50,true); e.setUint16(4,0,true); e.setUint16(6,0,true); e.setUint16(8,files.length,true); e.setUint16(10,files.length,true); e.setUint32(12,cdLen,true); e.setUint32(16,off,true); e.setUint16(20,0,true);
    return new Blob([...parts,...cd,eocd],{type:mime||'application/zip'});
  }

  /* ---------- 스타일 등록부 ---------- */
  function StyleReg(){
    const fonts=[
      [10,0,'000000','맑은 고딕'],[10,1,'000000','맑은 고딕'],[20,1,'000000','맑은 고딕'],[8,0,'000000','맑은 고딕'],[12,1,'000000','맑은 고딕'],[8,0,'808080','맑은 고딕'],[10,1,'FFFFFF','맑은 고딕'],[9,1,'000000','맑은 고딕'],[9,0,'000000','맑은 고딕'],[11,1,'1E3A5F','맑은 고딕'],[10,0,'808080','맑은 고딕']
    ];
    const fills=['none','gray125','FFF2CC','F2F2F2','DCE6F2','1E3A5F','E2F3EE','FFFFFF'];
    const numFmts={date:164,pct:165,sign:166};
    const borders=[]; const bmap=new Map();
    const side=(n,v)=>v?`<${n} style="${v}"><color ${v==='hair'?'rgb="FFBFBFBF"':'auto="1"'}/></${n}>`:`<${n}/>`;
    const borderId=b=>{ if(typeof b==='number'){ b=b===1?{l:'thin',r:'thin',t:'thin',b:'thin'}:b===2?{l:'hair',r:'hair',t:'hair',b:'hair'}:{l:'',r:'',t:'',b:''}; } const k=`${b.l||''}|${b.r||''}|${b.t||''}|${b.b||''}`; if(bmap.has(k)) return bmap.get(k); const id=borders.length; borders.push(`<border>${side('left',b.l)}${side('right',b.r)}${side('top',b.t)}${side('bottom',b.b)}<diagonal/></border>`); bmap.set(k,id); return id; };
    borderId(0); borderId(1); borderId(2);
    const xfs=[]; const map=new Map();
    const norm=o=>({font:o.font||0,fill:o.fill||0,border:borderId(o.border||0),fmt:o.fmt||0,al:o.al||'',wrap:o.wrap?1:0,shrink:o.shrink?1:0,bspec:typeof o.border==='object'?o.border:(o.border===1?{l:'thin',r:'thin',t:'thin',b:'thin'}:o.border===2?{l:'hair',r:'hair',t:'hair',b:'hair'}:{l:'',r:'',t:'',b:''})});
    const get=o=>{ const n=norm(o); const k=`${n.font}|${n.fill}|${n.border}|${n.fmt}|${n.al}|${n.wrap}|${n.shrink}`; if(map.has(k)) return map.get(k); const id=xfs.length; xfs.push(n); map.set(k,id); return id; };
    get({font:0,fill:0,border:0,fmt:0,al:'',wrap:0});
    const withBorder=(id,patch)=>{ const o=xfs[id]||xfs[0]; return get({font:o.font,fill:o.fill,fmt:o.fmt,al:o.al,wrap:o.wrap,shrink:o.shrink,border:{...o.bspec,...patch}}); };
    const xml=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="0&quot;%&quot;"/><numFmt numFmtId="166" formatCode="&quot;+&quot;0;&quot;-&quot;0;0"/></numFmts><fonts count="${fonts.length}">${fonts.map(f=>`<font>${f[1]?'<b/>':''}<sz val="${f[0]}"/><color rgb="FF${f[2]}"/><name val="${f[3]}"/><family val="2"/></font>`).join('')}</fonts><fills count="${fills.length}">${fills.map(f=>f==='none'?'<fill><patternFill patternType="none"/></fill>':f==='gray125'?'<fill><patternFill patternType="gray125"/></fill>':`<fill><patternFill patternType="solid"><fgColor rgb="FF${f}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.map(o=>`<xf numFmtId="${o.fmt||0}" fontId="${o.font||0}" fillId="${o.fill||0}" borderId="${o.border||0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="${o.al||'general'}" vertical="center"${o.wrap?' wrapText="1"':''}${o.shrink&&!o.wrap?' shrinkToFit="1"':''}/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    return {get,withBorder,xml,numFmts};
  }

  /* ---------- 시트 빌더 ---------- */
  function Sheet(name){
    const cells={}; const merges=[]; let widths=[]; const heights={};
    const set=(ref,v,s,f)=>{ cells[ref]={v,s,f}; };
    const xml=(opts={})=>{
      const rows={}; for(const ref of Object.keys(cells)){ const m=/^([A-Z]+)(\d+)$/.exec(ref); (rows[+m[2]]=rows[+m[2]]||[]).push([colIndex(m[1]),ref,cells[ref]]); }
      let x=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`;
      if(opts.fitToPage) x+=`<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`;
      x+=`<sheetViews><sheetView workbookViewId="0"${opts.showGrid===false?' showGridLines="0"':''}${opts.active?' tabSelected="1"':''}/></sheetViews><sheetFormatPr defaultRowHeight="15"/>`;
      if(widths.length) x+=`<cols>${widths.map((w,i)=>w?`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`:'').join('')}</cols>`;
      x+='<sheetData>';
      const rnums=Object.keys(rows).map(Number).sort((a,b)=>a-b); const allRows=new Set(rnums); Object.keys(heights).forEach(r=>allRows.add(+r));
      for(const r of [...allRows].sort((a,b)=>a-b)){ const h=heights[r]; x+=`<row r="${r}"${h?` ht="${h}" customHeight="1"`:''}>`;
        for(const [ci,ref,c] of (rows[r]||[]).sort((a,b)=>a[0]-b[0])){ const st=c.s?` s="${c.s}"`:'';
          if(c.f!=null){ x+=`<c r="${ref}"${st}><f>${xesc(c.f)}</f></c>`; }
          else if(c.v==null||c.v===''){ if(c.s) x+=`<c r="${ref}"${st}/>`; }
          else if(typeof c.v==='number'){ x+=`<c r="${ref}"${st}><v>${c.v}</v></c>`; }
          else if(typeof c.v==='boolean'){ x+=`<c r="${ref}"${st} t="b"><v>${c.v?1:0}</v></c>`; }
          else { x+=`<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xesc(c.v)}</t></is></c>`; } }
        x+='</row>'; }
      x+='</sheetData>';
      if(merges.length) x+=`<mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;
      if(opts.center) x+='<printOptions horizontalCentered="1"/>';
      x+='<pageMargins left="0.35" right="0.35" top="0.45" bottom="0.35" header="0.2" footer="0.2"/>';
      x+=`<pageSetup paperSize="9" orientation="${opts.landscape?'landscape':'portrait'}"${opts.fitToPage?` fitToWidth="1" fitToHeight="${opts.fitWidthOnly?0:1}"`:''}/>`;
      return x+'</worksheet>';
    };
    const fillMerges=()=>{ for(const m of merges){ const [a,b]=m.split(':'); const ma=/^([A-Z]+)(\d+)$/.exec(a), mb=/^([A-Z]+)(\d+)$/.exec(b); const c0=colIndex(ma[1]),c1=colIndex(mb[1]),r0=+ma[2],r1=+mb[2]; const top=cells[a]; if(!top) continue; for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){ const ref=colName(c)+r; if(ref===a) continue; if(!cells[ref]) cells[ref]={v:null,s:top.s}; else if(!cells[ref].s) cells[ref].s=top.s; } } };
    return {name,cells,merges,set,merge:(a)=>merges.push(a),setWidths:w=>{widths=w;},height:(r,h)=>{heights[r]=h;},xml,fillMerges};
  }

  /* ---------- 기간 계산(Term) 수식 ---------- */
  function termFormulas(sheet,cols,row,S,F,V,style){
    const [cE,cP,cA,cY0,cM0,cD0,cY,cM,cD]=cols; const r=row;
    const E=`${cE}${r}`,Pv=`${cP}${r}`,A=`${cA}${r}`,Y0=`${cY0}${r}`,M0=`${cM0}${r}`,D0=`${cD0}${r}`;
    sheet.set(E,null,style,`IF(${V},${F}=EOMONTH(${F},0),FALSE)`);
    sheet.set(Pv,null,style,`IF(${V},DAY(EOMONTH(${F},-1)),0)`);
    sheet.set(A,null,style,`IF(${V},DATE(YEAR(${F}),MONTH(${S}),DAY(${S})),0)`);
    sheet.set(Y0,null,style,`IF(${V},YEAR(${F})-YEAR(${S})+IF(AND(MONTH(${S})=1,DAY(${S})=1,MONTH(${F})=12,DAY(${F})=31),1,0)+IF(${F}<${A}-1,-1,0),0)`);
    sheet.set(M0,null,style,`IF(${V},MOD(MONTH(${F})-MONTH(${S})+IF(AND(DAY(${S})=1,${E}),1,0)+IF(${F}<${A}-1,12,0)+IF(DAY(${F})<DAY(${S})-1,-1,0)+IF(AND(${E},DAY(EOMONTH(${F},0))<DAY(${S})-1),1,0),12),0)`);
    sheet.set(D0,null,style,`IF(${V},IF(OR(AND(DAY(${S})=1,${E}),DAY(${F})=DAY(${S})-1,AND(${E},DAY(EOMONTH(${F},0))<DAY(${S})-1)),0,DAY(${F})-IF(DAY(${S})-1<DAY(${F}),DAY(${S})-1,0)+IF(AND(DAY(${F})<DAY(${S})-1,DAY(${S})-1<${Pv}),${Pv}-DAY(${S})+1,0)-IF(OR(DAY(${S})+29=DAY(${F}),AND(${Pv}=31,DAY(${S})-2=DAY(${F}))),1,0)),0)`);
    sheet.set(`${cY}${r}`,null,style,`${Y0}+INT((${M0}+INT(${D0}/30))/12)`);
    sheet.set(`${cM}${r}`,null,style,`MOD(${M0}+INT(${D0}/30),12)`);
    sheet.set(`${cD}${r}`,null,style,`MOD(${D0},30)`);
  }

  /* ---------- 통합문서 생성 ---------- */
  function buildHobongXlsx(S,R){
    S=S||{}; R=R||{};
    const who=S.who||{}, edu=S.edu||{}, cert=S.cert||{}, opt=S.opt||{}, form=S.form||{};
    const pre=S.pre||[], post=S.post||[];
    const rPreRows=(R.pre&&R.pre.rows)||[], rPostRows=(R.post&&R.post.rows)||[];
    const st=StyleReg();
    const F={
      lab:st.get({font:7,fill:3,border:1,al:'center',wrap:1}), labL:st.get({font:7,fill:3,border:1,al:'left',wrap:1}),
      in:st.get({font:0,fill:2,border:1,al:'center'}), inL:st.get({font:0,fill:2,border:1,al:'left'}), inW:st.get({font:0,fill:2,border:1,al:'left',wrap:1}), inD:st.get({font:0,fill:2,border:1,al:'center',fmt:164}), inP:st.get({font:0,fill:2,border:1,al:'center',fmt:165}), inS:st.get({font:3,fill:2,border:1,al:'left',shrink:1}),
      fx:st.get({font:0,fill:7,border:1,al:'center'}), fxL:st.get({font:0,fill:7,border:1,al:'left'}), fxD:st.get({font:0,fill:7,border:1,al:'center',fmt:164}), fxB:st.get({font:4,fill:7,border:1,al:'center'}), fxSign:st.get({font:1,fill:7,border:1,al:'center',fmt:166}), fxS:st.get({font:3,fill:7,border:1,al:'center'}),
      title:st.get({font:2,fill:7,border:1,al:'center'}), small:st.get({font:3,fill:2,border:1,al:'left'}), gut:st.get({font:5,fill:0,border:0,al:'center'}), aux:st.get({font:10,fill:0,border:2,al:'center'}), auxH:st.get({font:5,fill:3,border:2,al:'center',wrap:1}),
      hdr:st.get({font:6,fill:5,border:1,al:'center'}), key:st.get({font:1,fill:4,border:1,al:'left'}), val:st.get({font:0,fill:7,border:1,al:'left'}), valD:st.get({font:0,fill:7,border:1,al:'left',fmt:164}), note:st.get({font:5,fill:0,border:0,al:'left'}), calc:st.get({font:8,fill:0,border:2,al:'center'}), calcH:st.get({font:7,fill:4,border:2,al:'center',wrap:1}), calcD:st.get({font:8,fill:0,border:2,al:'center',fmt:164}), sec:st.get({font:9,fill:0,border:0,al:'left'})
    };
    /* ===== 1. 호봉획정표 ===== */
    const A=Sheet('호봉획정표'); const D=Sheet('자료'); const C=Sheet('계산'); const E=Sheet('승급기록');
    A.setWidths([1,3.4,2.6,4.9,4.9,4.9,4.9,3.3,3.3,5.2,15.1,3,3,6.2,6.6,2.6,3.9,5.6,8.5,1.5,5,6,6,6,7]);
    A.height(1,6); A.height(2,18); A.height(3,24); A.height(4,24); [5,6,7].forEach(r=>A.height(r,27)); A.height(8,24); A.height(9,24);
    A.merge('C2:S2'); A.set('C2',form.formTitle||'',st.get({font:3,fill:7,border:1,al:'left'}));
    A.merge('C3:S4'); A.set('C3','호  봉  획  정  표',F.title);
    A.merge('C5:D5'); A.set('C5','(1) 소속',F.lab); A.merge('E5:L5'); A.set('E5',trim(who.org),F.in); A.merge('M5:P5'); A.set('M5','(2) 제청(내신) 자격',F.lab); A.merge('Q5:S5'); A.set('Q5','(3) 현 직위(직급)',F.lab);
    A.merge('C6:D6'); A.set('C6','(4) 성명',F.lab); A.merge('E6:L6'); A.set('E6',trim(who.name),F.in); A.merge('M6:P6'); A.set('M6',trim(cert.name),F.in); A.merge('Q6:S6'); A.set('Q6',trim(who.pos),F.in);
    A.merge('C7:D7'); A.set('C7','(5) 학력',F.lab); A.merge('E7:L7'); A.set('E7',trim(edu.school),F.in); A.merge('M7:P7'); A.set('M7','(6) 현 호봉',F.lab); A.merge('Q7:S7'); A.set('Q7',trim(form.curHobong),F.in);
    A.merge('C8:H8'); A.set('C8','(7) 경력기간',F.lab); A.merge('I8:K9'); A.set('I8','(8) 경력 내용',F.lab); A.merge('L8:N9'); A.set('L8','(9) 경력년수',F.lab); A.merge('O8:O9'); A.set('O8','(10) 환산율',F.lab); A.merge('P8:R9'); A.set('P8','(11) 환산년수',F.lab); A.merge('S8:S9'); A.set('S8','(12) 비고',F.lab);
    A.merge('C9:E9'); A.set('C9','부터',F.lab); A.merge('F9:H9'); A.set('F9','까지',F.lab);
    A.set('B9','구분',F.auxH); A.set('U9','시간강사\n방법',F.auxH); A.set('V9','주당·총\n시간',F.auxH); A.set('W9','평균\n시간',F.auxH); A.set('X9','고정\n일수',F.auxH); A.set('Y9','학위상한\n(개월)',F.auxH);
    const preRows=pre.map((r,i)=>({kind:'전',row:r,c:rPreRows[i]||{}}));
    const postRows=post.map((r,i)=>({kind:'후',row:r,c:rPostRows[i]||{}}));
    const nPre=Math.max(preRows.length,1)+1, nPostMin=postRows.length+2; const nPost=Math.max(nPostMin,11-nPre);
    const list=[]; for(let i=0;i<nPre;i++) list.push(preRows[i]||{kind:'전',row:null}); for(let i=0;i<nPost;i++) list.push(postRows[i]||{kind:'후',row:null});
    const r0=10, N=list.length; const baseCell=()=>`$M$${r0+N+3}`;
    const rhData=Math.max(22,Math.min(30,Math.floor((780-400)/N)));
    list.forEach((it,i)=>{ const r=r0+i; A.height(r,rhData); ['C:E','F:H','I:K','L:N','P:R'].forEach(m=>{ const [a,b]=m.split(':'); A.merge(`${a}${r}:${b}${r}`); });
      A.set(`B${r}`,it.kind==='전'?'임용전':'임용후',F.gut);
      const row=it.row; const isPost=it.kind==='후'; const p=row&&row.part; const nodate=p&&p.method===3;
      const isFirstPost=isPost&&i===nPre;
      if(row){ if(nodate) A.set(`C${r}`,'-',F.in); else A.set(`C${r}`,isFirstPost?{date:S.appt}:{date:isPost?row.start:row.from},F.inD); } else A.set(`C${r}`,null,F.inD);
      if(isPost) A.set(`F${r}`,null,F.fxD,`IF(C${r}="","",IF(C${r+1}="",${baseCell()}-1,C${r+1}-1))`);
      else if(row&&nodate) A.set(`F${r}`,'-',F.in); else A.set(`F${r}`,row?{date:row.to}:null,F.inD);
      A.set(`I${r}`,row?trim(row.text):null,F.inW); if(row){ const ln=textLines(trim(row.text),23.6); if(ln>1) A.height(r,Math.max(rhData,ln*13.5+6)); }
      A.set(`L${r}`,null,F.fx,`계산!AC${6+i}`);
      if(row&&row.pct==='child') A.set(`O${r}`,'육아휴직',F.in); else A.set(`O${r}`,row&&row.pct!==''&&row.pct!=null?+row.pct:null,F.inP);
      A.set(`P${r}`,null,F.fx,`계산!AF${6+i}`);
      A.set(`S${r}`,row?trim(row.note):null,F.inS);
      if(p&&it.c&&it.c.spanned){ A.set(`U${r}`,`${p.method}*`,F.aux); A.set(`V${r}`,p.method===1?+p.hours||null:(+p.total||null),F.aux); A.set(`W${r}`,null,F.aux); A.set(`X${r}`,it.c.rateDays||null,F.aux); }
      else if(p){ A.set(`U${r}`,p.method,F.aux); A.set(`V${r}`,p.method===1?+p.hours||null:(+p.total||null),F.aux); A.set(`W${r}`,p.method===3?+p.avg||40:null,F.aux); A.set(`X${r}`,p.method===3?((+p.avg||40)===40?5:6):null,F.aux); }
      else if(row&&row.fixed&&it.c&&it.c.fixed){ A.set(`X${r}`,it.c.termDays||null,F.aux); }
      else { ['U','V','W','X'].forEach(c=>A.set(`${c}${r}`,null,F.aux)); }
      A.set(`Y${r}`,row&&!isPost&&capMonths(row.cap)?capMonths(row.cap):null,F.aux);
    });
    for(const ref of Object.keys(A.cells)){ const c=A.cells[ref]; if(c.v&&typeof c.v==='object'&&'date' in c.v){ const n=isoToExcelSerial(c.v.date); c.v=n==null?null:n; } }
    const rAdj=r0+N, rSum=rAdj+1, rH=rAdj+2, rV=rAdj+3, rW=rAdj+4, rSelf=rAdj+5, rChk=rAdj+6;
    A.height(rAdj,24); A.height(rSum,27); A.height(rH,38); A.height(rV,30); [rW,rSelf,rChk].forEach(r=>A.height(r,27));
    A.merge(`C${rAdj}:H${rAdj}`); A.set(`C${rAdj}`,null,F.fx); A.merge(`I${rAdj}:O${rAdj}`); A.set(`I${rAdj}`,'* 「역에 의한 계산」에 따른 보정일',st.get({font:8,fill:7,border:1,al:'right'})); A.merge(`P${rAdj}:R${rAdj}`); A.set(`P${rAdj}`,null,F.fxSign,'계산!D3'); A.set(`S${rAdj}`,null,F.fx);
    A.merge(`C${rSum}:H${rSum}`); A.set(`C${rSum}`,null,F.fx); A.merge(`I${rSum}:K${rSum}`); A.set(`I${rSum}`,'(13) 계',F.lab); A.merge(`L${rSum}:O${rSum}`); A.set(`L${rSum}`,null,F.fx); A.merge(`P${rSum}:R${rSum}`); A.set(`P${rSum}`,null,F.fxB,'자료!B22'); A.set(`S${rSum}`,null,F.fx);
    A.merge(`C${rH}:E${rH}`); A.set(`C${rH}`,'(14) 환산 총\n경력년수',F.lab); A.merge(`F${rH}:G${rH}`); A.set(`F${rH}`,'(15) 가감\n년수',F.lab); A.merge(`H${rH}:J${rH}`); A.set(`H${rH}`,'(16) 호봉\n획정경력년수',F.lab); A.merge(`K${rH}:L${rH}`); A.set(`K${rH}`,'(17) 사정\n호봉',F.lab); A.merge(`M${rH}:O${rH}`); A.set(`M${rH}`,'호봉획정일',F.lab); A.merge(`P${rH}:S${rH}`); A.set(`P${rH}`,'(18) 사정 호봉에 필요한\n경력 년수',F.lab);
    A.merge(`C${rV}:E${rV}`); A.set(`C${rV}`,null,F.fx,'자료!B22'); A.merge(`F${rV}:G${rV}`); A.set(`F${rV}`,null,F.fxSign,'자료!B7'); A.merge(`H${rV}:J${rV}`); A.set(`H${rV}`,null,F.fx,`"( "&TEXT(계산!F3+자료!B7,"00")&"."&TEXT(계산!G3,"00")&"."&TEXT(계산!H3,"00")&" )"`); A.merge(`K${rV}:L${rV}`); A.set(`K${rV}`,null,F.fxB,`자료!B26&IF(AND(자료!B14=1,계산!P3>14),"(호봉상한)","")`); A.merge(`M${rV}:O${rV}`); A.set(`M${rV}`,S.base?isoToExcelSerial(S.base):null,F.inD); A.merge(`P${rV}:S${rV}`); A.set(`P${rV}`,null,F.fx,'계산!F3+자료!B7');
    const whoRow=(r,lab,pos,name)=>{ A.merge(`C${r}:D${r}`); A.set(`C${r}`,lab,F.lab); A.merge(`E${r}:F${r}`); A.set(`E${r}`,'직위(급):',st.get({font:0,fill:7,border:1,al:'left'})); A.merge(`G${r}:H${r}`); A.set(`G${r}`,pos,F.in); A.merge(`I${r}:J${r}`); A.set(`I${r}`,'성  명 :',st.get({font:0,fill:7,border:1,al:'left'})); A.merge(`K${r}:L${r}`); A.set(`K${r}`,name,F.in); };
    whoRow(rW,'작성자',trim(form.writerPos),sealName(form.writerName)); whoRow(rSelf,'본  인',trim(form.selfPos),sealName(form.selfName)); whoRow(rChk,'확인자',trim(form.checkerPos),sealName(form.checkerName));
    A.merge(`M${rW}:O${rSelf}`); A.set(`M${rW}`,'잔여월일 :',F.lab); A.merge(`P${rW}:Q${rSelf}`); A.set(`P${rW}`,null,F.fx,'자료!B27'); A.merge(`R${rW}:S${rSelf}`); A.set(`R${rW}`,null,F.fxS,`IF(${baseCell()}="","","("&TEXT(${baseCell()},"yyyy-mm-dd")&" 현재)")`);
    A.merge(`M${rChk}:O${rChk}`); A.set(`M${rChk}`,'차기승급일 :',F.lab); A.merge(`P${rChk}:R${rChk}`); A.set(`P${rChk}`,null,F.fxD,'자료!B28'); A.set(`S${rChk}`,null,F.fxS,`"(잔여 "&계산!N3&"일)"`);
    A.set(`C${rChk+2}`,'■ 연한 노란색 셀만 입력하세요. 나머지 셀은 자동 계산됩니다. 임용 후 경력의 "까지"는 다음 행 시작일의 전날로 자동 계산됩니다. 학력·자격·옵션은 [자료] 시트에서 입력합니다.',F.note);
    const printArea=`'호봉획정표'!$C$2:$S$${rChk}`;
    A.fillMerges();
    for(let r=2;r<=rChk;r++){ for(let c=colIndex('C');c<=colIndex('S');c++){ const ref=CN(c)+r; const cell=A.cells[ref]||(A.cells[ref]={v:null,s:F.fx}); const patch={}; if(c===colIndex('C')) patch.l='medium'; if(c===colIndex('S')) patch.r='medium'; if(r===2) patch.t='medium'; if(r===rChk) patch.b='medium'; if(Object.keys(patch).length) cell.s=st.withBorder(cell.s||F.fx,patch); } }
    /* ===== 2. 자료 ===== */
    D.setWidths([30,22,60]); D.height(1,22);
    D.set('A1','호봉획정 자료 — 노란색 셀 입력',st.get({font:9,fill:0,border:0,al:'left'})); D.set('A2','항목',F.hdr); D.set('B2','값',F.hdr); D.set('C2','설명',F.hdr);
    const firstPostRow=r0+nPre;
    const drows=[
      ['학력 유형',trim(edu.type),F.inL,'버튼으로 고른 학력 유형(참고)'],
      ['학령',edu.age===''||edu.age==null?null:+edu.age,F.in,'정규 학교 수학연한 합계 (대학 4년제 졸업 = 16)'],
      ['가산연수',+edu.add||0,F.in,'교육대학·사범대학 졸업 1년, 해당 없으면 0'],
      ['특수학교(학급) 가산',edu.spe?1:0,F.in,'해당 1 / 아니면 0'],
      ['학력 가감',null,F.val,'= 학령 − 16 + 가산연수 + 특수 가산','B4-16+B5+B6'],
      ['자격면허',null,F.val,'호봉획정표 (2) 칸과 연결','호봉획정표!M6'],
      ['기산호봉',+cert.base||null,F.in,'1급 정교사 등 9 · 2급 8 · 준교사 5'],
      ['1정 자격 발급일',cert.date?isoToExcelSerial(cert.date):null,F.inD,'기산호봉 9 자격의 발급일. 획정일이 발급일 이후이면 9, 이전이면 8 적용'],
      ['임용일자',null,F.valD,'호봉획정표 임용 후 첫 행의 시작일',`호봉획정표!C${firstPostRow}`],
      ['획정기준일',null,F.valD,'호봉획정표 호봉획정일 칸',`호봉획정표!M${rV}`],
      ['초임호봉획정·계약제교원 임용',opt.first?1:0,F.in,'참고용 표시 (1/0) — 호봉획정사유가 초임호봉획정 또는 계약제교원 임용이면 1'],
      ['호봉상한제 적용',opt.limit?1:0,F.in,'계약제교원 14호봉 상한 적용 1 / 미적용 0'],
      ['육아휴직 산입 상한(개월)',+opt.childCap||12,F.in,'첫째·둘째 자녀 산입 상한: 12 또는 18'],
      ['공무원보수규정 제13조제4항 적용',R.result&&R.result.flag13?1:0,F.in,'앱에서 판정한 값(1이면 사정호봉 −1, 차기승급일 = 획정일 다음 달 1일). 날짜를 바꾼 경우 앱에서 다시 확인'],
      ['계약제(기간제)교원 임용',R.contract?1:0,F.in,'1이면 차기승급일에 "없음" 표시 (기간제교원은 승급하지 않음). 호봉획정사유 = 계약제(기간제)교원 임용'],
    ];
    drows.forEach((d,i)=>{ const r=3+i; D.set(`A${r}`,d[0],F.key); if(d[4]) D.set(`B${r}`,null,d[2],d[4]); else D.set(`B${r}`,d[1],d[2]); D.set(`C${r}`,d[3],F.note); });
    const rContract=3+drows.findIndex(d=>d[0]==='계약제(기간제)교원 임용');
    D.set('A18','획정 결과 (자동 계산)',st.get({font:9,fill:0,border:0,al:'left'}));
    const rrows=[
      ['임용 전 환산 경력년수',ymdStr('계산!A3')],['임용 후 환산 경력년수',ymdStr('계산!B3')],['역에 의한 계산 보정일','계산!D3'],['환산 총 경력년수',ymdStr('계산!E3')],['근무년수','계산!R3'],['학력 가감','B7'],['기산호봉(적용)','B9-1+계산!O3'],['사정호봉','계산!Q3'],['잔여월일','계산!G3&"월"&계산!H3&"일"'],['차기승급일',`IF($B$${rContract}=1,"없음",계산!S3)`],['차기승급일 잔여일','계산!N3']
    ];
    rrows.forEach((d,i)=>{ const r=19+i; D.set(`A${r}`,d[0],F.key); D.set(`B${r}`,null,d[0]==='차기승급일'?F.valD:F.val,d[1]); });
    D.set('A31','저장 프로그램',F.key); D.set('B31',`${APP_NAME} v${APP_VER}`,F.val); D.set('A32','저장 일시',F.key); D.set('B32',new Date().toLocaleString('ko-KR'),F.val);
    /* ===== 3. 계산 ===== */
    C.setWidths([5,6,11,11,8,6,5,5,6, 6,6,10,6,6,6,5,5,5, 5,7,7,7, 8,7,7,6,6,8,13, 8,8,13, 6,6,11,7,11,7,7,11, 7,6,10,6,6,6,5,5,5, 8,8, 9]);
    C.set('A1','자동 계산 시트 — 수정하지 마세요. (호봉획정표·자료 시트의 노란색 셀만 입력)',st.get({font:9,fill:0,border:0,al:'left'}));
    const tot=[['A','임용 전 일수'],['B','임용 후 일수(합산)'],['C','임용 후 일수(행합)'],['D','보정일'],['E','총 일수'],['F','년'],['G','월'],['H','일'],['I','잔여(일)'],['J','남은 월'],['K','남은 일'],['L','만료일'],['M','다음달1일'],['N','잔여일'],['O','1정 반영'],['P','사정호봉(원)'],['Q','사정호봉'],['R','근무년수'],['S','차기승급일'],['T','isE'],['U','dPrev'],['V','anni'],['W','ry0'],['X','rm0'],['Y','rd0'],['Z','ry'],['AA','rm'],['AB','rd']];
    tot.forEach(([c,l])=>C.set(`${c}2`,l,F.calcH));
    const last=5+N; const base='자료!$B$12';
    C.set('A3',null,F.calc,`SUMIFS(AE6:AE${last},B6:B${last},"임용전")`); C.set('B3',null,F.calc,`SUM(AZ6:AZ${last})`); C.set('C3',null,F.calc,`SUMIFS(AE6:AE${last},B6:B${last},"임용후")`); C.set('D3',null,F.calc,'B3-C3'); C.set('E3',null,F.calc,'A3+B3');
    C.set('F3',null,F.calc,'INT(E3/360)'); C.set('G3',null,F.calc,'INT(MOD(E3,360)/30)'); C.set('H3',null,F.calc,'MOD(E3,30)'); C.set('I3',null,F.calc,'30*G3+H3'); C.set('J3',null,F.calc,'INT((360-I3)/30)'); C.set('K3',null,F.calc,'MOD(360-I3,30)');
    C.set('L3',null,F.calcD,`IF(ISNUMBER(${base}),EDATE(${base},J3)+K3-1,"")`); C.set('M3',null,F.calcD,`IF(ISNUMBER(L3),DATE(YEAR(L3),MONTH(L3)+1,1),"")`);
    termFormulas(C,['T','U','V','W','X','Y','Z','AA','AB'],3,base,'(M3-1)',`AND(ISNUMBER(${base}),ISNUMBER(M3))`,F.calc);
    C.set('N3',null,F.calc,`IF(ISNUMBER(M3),MAX(0,Z3*360+AA3*30+AB3+I3-360),0)`);
    C.set('O3',null,F.calc,`IF(OR(자료!B10="",자료!B9<>9),1,IF(${base}>자료!B10,1,0))`);
    C.set('P3',null,F.calc,`F3+자료!B7+자료!B9-1+O3-자료!B16`); C.set('Q3',null,F.calc,`IF(자료!B14=1,MIN(P3,14),P3)`); C.set('R3',null,F.calc,`IF(자료!B14=1,MIN(F3,5),F3)`); C.set('S3',null,F.calcD,`IF(자료!B16=1,DATE(YEAR(${base}),MONTH(${base})+1,1),M3)`);
    const hdr=['순번','구분','시작','종료','환산율','유효','육아','자녀','pct','isE','dPrev','anni','ry0','rm0','rd0','ry','rm','rd','방법','시간','평균입력','고정일수','기간일수','평균(시기)','주당시간','분자','분모','경력일수(표시)','경력기간','육아누적(이전)','환산일수','환산기간','100%산입','육아부분','상한도달일','이전100%','합산시작','다음100%','다음육아부분','합산종료','합산유효','isE2','dPrev2','anni2','ry0','rm0','rd0','ry','rm','rd','합산일수','기여일수','학위상한(일)'];
    hdr.forEach((h,i)=>C.set(`${CN(i)}5`,h,F.calcH)); C.height(5,30);
    const cap='(자료!$B$15*30)';
    for(let i=0;i<N;i++){ const r=6+i, fr=r0+i; const p=r-1,n=r+1; const s=F.calc;
      C.set(`A${r}`,i+1,s); C.set(`B${r}`,null,s,`호봉획정표!B${fr}`); C.set(`C${r}`,null,F.calcD,`IF(호봉획정표!C${fr}="","",호봉획정표!C${fr})`); C.set(`D${r}`,null,F.calcD,`IF(호봉획정표!F${fr}="","",호봉획정표!F${fr})`); C.set(`E${r}`,null,s,`호봉획정표!O${fr}`);
      C.set(`F${r}`,null,s,`AND(ISNUMBER(C${r}),ISNUMBER(D${r}),C${r}<=D${r})`); C.set(`G${r}`,null,s,`IF(E${r}="육아휴직",1,0)`); C.set(`H${r}`,null,s,`IF(G${r}=1,IF(ISNUMBER(FIND("둘째",호봉획정표!I${fr})),2,1),0)`); C.set(`I${r}`,null,s,`IF(G${r}=1,0,IF(ISNUMBER(E${r}),E${r},0))`);
      termFormulas(C,['J','K','L','M','N','O','P','Q','R'],r,`C${r}`,`D${r}`,`F${r}`,s);
      C.set(`S${r}`,null,s,`N(호봉획정표!U${fr})`); C.set(`T${r}`,null,s,`N(호봉획정표!V${fr})`); C.set(`U${r}`,null,s,`N(호봉획정표!W${fr})`); C.set(`V${r}`,null,s,`N(호봉획정표!X${fr})`);
      C.set(`W${r}`,null,s,`IF(V${r}>0,V${r},IF(F${r},P${r}*360+Q${r}*30+R${r},0))`);
      C.set(`X${r}`,null,s,`IF(S${r}=3,U${r},IF(F${r},IF(C${r}>=DATE(2012,3,1),40,IF(AND(C${r}>=DATE(2006,3,1),D${r}<=DATE(2012,2,29)),42,IF(AND(C${r}>=DATE(2005,3,1),D${r}<=DATE(2006,2,28)),43,IF(D${r}<=DATE(2005,2,28),44,0)))),0))`);
      C.set(`Y${r}`,null,s,`IF(S${r}=2,IF(W${r}>0,INT(T${r}*7/W${r}),0),T${r})`);
      C.set(`Z${r}`,null,s,`IF(S${r}=4,30,IF(OR(S${r}=1,S${r}=2,S${r}=3),Y${r},1))`); C.set(`AA${r}`,null,s,`IF(S${r}=4,100,IF(OR(S${r}=1,S${r}=2,S${r}=3),X${r},1))`);
      C.set(`AB${r}`,null,s,`IF(F${r},P${r}*360+Q${r}*30+R${r},IF(AA${r}=0,0,ROUNDDOWN(W${r}*Z${r}/AA${r}+0.0000001,0)))`);
      C.set(`AC${r}`,null,s,`IF(OR(F${r},V${r}>0),${ymdStr(`AB${r}`)},"")`);
      C.set(`AD${r}`,null,s,i===0?'0':`IF(G${r}=1,SUMIFS($W$6:W${p},$H$6:H${p},H${r},$G$6:G${p},1),0)`);
      C.set(`BA${r}`,null,s,`N(호봉획정표!Y${fr})*30`);
      C.set(`AE${r}`,null,s,`IF(NOT(OR(F${r},V${r}>0)),0,IF(G${r}=1,MAX(0,MIN(W${r},${cap}-AD${r})),IF(AA${r}=0,0,IF(BA${r}>0,MIN(ROUNDDOWN(W${r}*Z${r}*I${r}/(AA${r}*100)+0.0000001,0),ROUNDDOWN(BA${r}*I${r}/100+0.0000001,0)),ROUNDDOWN(W${r}*Z${r}*I${r}/(AA${r}*100)+0.0000001,0)))))`);
      C.set(`AF${r}`,null,s,`IF(OR(F${r},V${r}>0),${ymdStr(`AE${r}`)},"")`);
      C.set(`AG${r}`,null,s,`AND(F${r},AE${r}=W${r})`); C.set(`AH${r}`,null,s,`AND(F${r},G${r}=1,NOT(AG${r}))`);
      C.set(`AI${r}`,null,F.calcD,`IF(AH${r},EDATE(DATE(YEAR(C${r})+INT(AE${r}/360),MONTH(C${r}),DAY(C${r})),INT(MOD(AE${r},360)/30))+MOD(AE${r},30)+IF(DAY(EDATE(DATE(YEAR(C${r})+INT(AE${r}/360),MONTH(C${r}),DAY(C${r})),INT(MOD(AE${r},360)/30)))<>DAY(C${r}),1,0),"")`);
      C.set(`AJ${r}`,null,s,i===0?'FALSE':`IF(AND(B${r}="임용후",B${p}="임용후"),AG${p},FALSE)`);
      C.set(`AK${r}`,null,F.calcD,`IF(AND(AG${r},AJ${r}),${i===0?`C${r}`:`AK${p}`},C${r})`);
      C.set(`AL${r}`,null,s,i===N-1?'FALSE':`IF(B${n}="임용후",AG${n},FALSE)`); C.set(`AM${r}`,null,s,i===N-1?'FALSE':`IF(B${n}="임용후",AH${n},FALSE)`);
      C.set(`AN${r}`,null,F.calcD,i===N-1?`D${r}`:`IF(AM${r},AI${n}-1,D${r})`);
      C.set(`AO${r}`,null,s,`AND(F${r},AG${r},NOT(AL${r}),ISNUMBER(AK${r}),ISNUMBER(AN${r}),AK${r}<=AN${r})`);
      termFormulas(C,['AP','AQ','AR','AS','AT','AU','AV','AW','AX'],r,`AK${r}`,`AN${r}`,`AO${r}`,s);
      C.set(`AY${r}`,null,s,`IF(AO${r},AV${r}*360+AW${r}*30+AX${r},0)`);
      C.set(`AZ${r}`,null,s,`IF(OR(NOT(F${r}),B${r}<>"임용후"),0,IF(AG${r},IF(AL${r},0,AY${r}),IF(AH${r},IF(AJ${r},0,AE${r}),AE${r})))`);
    }
    /* ===== 4. 승급기록 (값) ===== */
    const events=(R.events||[]);
    E.setWidths([10,14,14,10,12,14,30]); E.set('A1','승급기록 · 육아휴직 사용현황 — 앱에서 계산한 값입니다. 엑셀에서 경력 날짜를 고쳤다면 앱에서 [엑셀 불러오기]로 다시 계산해 확인하세요.',F.note);
    ['호봉','종류','발령년월일','근무년수','잔여월일','차기승급일','비고'].forEach((h,i)=>E.set(`${CN(i)}3`,h,F.hdr));
    [...events].reverse().forEach((e,i)=>{ const r=4+i; E.set(`A${r}`,e.hobong+'호봉',F.calc); E.set(`B${r}`,e.type,F.calc); E.set(`C${r}`,isoToExcelSerial(isoN(e.date)),F.calcD); E.set(`D${r}`,e.years+'년',F.calc); E.set(`E${r}`,e.remStr,F.calc); E.set(`F${r}`,(R.contract&&e.date===R.base)?'없음':isoToExcelSerial(isoN(e.next)),F.calcD); E.set(`G${r}`,e.flag13?'공무원보수규정 제13조제4항':(e.beyond?'획정기준일 이후(예정)':''),st.get({font:8,fill:0,border:2,al:'left'})); });
    let er=4+events.length+2; E.set(`A${er}`,'육아휴직 사용현황',F.sec); er++;
    ['자녀','부터','까지','기간','산입 기간','1년 초과일',''].forEach((h,i)=>E.set(`${CN(i)}${er}`,h,F.hdr)); er++;
    const children=R.post&&R.post.children||{};
    for(const c of [1,2]){ (children[c]||[]).forEach(x=>{ E.set(`A${er}`,c===1?'첫째':'둘째',F.calc); E.set(`B${er}`,x.start+25569,F.calcD); E.set(`C${er}`,x.end+25569,F.calcD); E.set(`D${er}`,x.termStr,F.calc); E.set(`E${er}`,x.countedStr||'-',F.calc); E.set(`F${er}`,x.exceed?x.exceed+25569:null,F.calcD); er++; }); }
    /* ===== 패키지 ===== */
    const sheets=[A,D,C,E];
    const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="12000"/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xesc(s.name)}" sheetId="${i+1}"${s.name==='계산'?' state="hidden"':''} r:id="rId${i+1}"/>`).join('')}</sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">${xesc(printArea)}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
    const wrels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const files=[{name:'[Content_Types].xml',data:ct},{name:'_rels/.rels',data:rels},{name:'xl/workbook.xml',data:wb},{name:'xl/_rels/workbook.xml.rels',data:wrels},{name:'xl/styles.xml',data:st.xml()}];
    sheets.forEach((s,i)=>files.push({name:`xl/worksheets/sheet${i+1}.xml`,data:s.xml({fitToPage:true,fitWidthOnly:i!==0,showGrid:i===0?false:true,active:i===0,center:i===0})}));
    return zipStore(files,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  function fileName(S){ S=S||{}; const who=S.who||{}; return safeName(`호봉획정표_${trim(who.org)||'학교'}_${trim(who.name)||'성명'}_${S.base||isoN(todayN())}.xlsx`); }
  function exportHobong(S,R){
    const blob=buildHobongXlsx(S,R);
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=fileName(S); document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},2000);
    return fileName(S);
  }

  root.HobongXlsx={build:buildHobongXlsx, export:exportHobong, fileName:fileName, buildHobongXlsx, exportHobong};
  if(typeof module==='object'&&module.exports) module.exports=buildHobongXlsx;
})(typeof globalThis==='undefined'?this:globalThis);
