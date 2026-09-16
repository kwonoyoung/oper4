/* Read the application's standard OOXML form, including edited input cells.
   No macros or formulas are executed. ZIP sizes and format are bounded. */
(function(root){
'use strict';
async function unzip(file){
 if(file.size>10*1024*1024)throw Error('10MB 이하 파일을 선택하세요.');
 const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer),dec=new TextDecoder();
 let end=bytes.length-22;while(end>=Math.max(0,bytes.length-65557)&&v.getUint32(end,true)!==0x06054b50)end--;
 if(end<0||end<bytes.length-65557)throw Error('올바른 XLSX 파일이 아닙니다.');
 const count=v.getUint16(end+10,true);let pos=v.getUint32(end+16,true),total=0;const out={};
 if(count>300)throw Error('지원하는 표준 서식이 아닙니다.');
 for(let i=0;i<count;i++){
  if(v.getUint32(pos,true)!==0x02014b50)throw Error('손상된 ZIP 디렉터리입니다.');
  const method=v.getUint16(pos+10,true),packed=v.getUint32(pos+20,true),size=v.getUint32(pos+24,true),nl=v.getUint16(pos+28,true),el=v.getUint16(pos+30,true),cl=v.getUint16(pos+32,true),off=v.getUint32(pos+42,true),name=dec.decode(bytes.slice(pos+46,pos+46+nl));
  total+=size;if(total>20*1024*1024)throw Error('압축 해제 크기가 너무 큽니다.');
  const start=off+30+v.getUint16(off+26,true)+v.getUint16(off+28,true);let raw=bytes.slice(start,start+packed);
  if(name.endsWith('.xml')||name.endsWith('.rels')){
   if(method===8)raw=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
   else if(method!==0)throw Error('지원하지 않는 압축 방식입니다.');
   if(raw.length!==size)throw Error('파일 크기 검증에 실패했습니다.');out[name]=dec.decode(raw);
  }
  pos+=46+nl+el+cl;
 }
 return out;
}
const xml=text=>{const d=new DOMParser().parseFromString(text||'','application/xml');if(d.querySelector('parsererror'))throw Error('엑셀 XML을 읽을 수 없습니다.');return d;};
async function read(file){
 const files=await unzip(file),wb=xml(files['xl/workbook.xml']),rels=xml(files['xl/_rels/workbook.xml.rels']);
 const shared=files['xl/sharedStrings.xml']?[...xml(files['xl/sharedStrings.xml']).getElementsByTagName('si')].map(n=>n.textContent):[];
 function sheet(name){
  const s=[...wb.getElementsByTagName('sheet')].find(s=>s.getAttribute('name')===name);if(!s)throw Error('이 프로그램의 호봉획정표·자료 표준 서식만 지원합니다.');
  const id=s.getAttribute('r:id'),rel=[...rels.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===id);if(!rel)throw Error('시트 연결이 없습니다.');
  const target=rel.getAttribute('Target'),path=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');const d=xml(files[path]),cells={};
  for(const c of d.getElementsByTagName('c')){const type=c.getAttribute('t'),value=c.getElementsByTagName('v')[0]?.textContent??'';cells[c.getAttribute('r')]=type==='inlineStr'?c.getElementsByTagName('is')[0]?.textContent||'':type==='s'?shared[Number(value)]||'':value;}
  return cells;
 }
 const a=sheet('호봉획정표'),d=sheet('자료'),date=v=>v===''?'':Number.isFinite(Number(v))?new Date((Number(v)-25569)*864e5).toISOString().slice(0,10):String(v),num=v=>Number(v)||0;
 if(d.A4!=='학령'||d.A9!=='기산호봉')throw Error('지원하지 않는 자료 시트 구조입니다.');
 const settings={org:a.E5||'',personName:a.E6||'',position:a.Q6||'',currentStep:a.Q7||'',schoolName:a.E7||'',certificateName:a.M6||'',educationType:d.B3||'',schoolYears:d.B4,schoolMonths:0,extraYears:d.B5,extraMonths:0,specialSchool:num(d.B6)===1,baseStep:d.B9,certificateDate:date(d.B10||''),limitStep:num(d.B14)===1,parentalLimit:d.B15,reason:num(d.B17)?'계약제교원 임용':num(d.B13)?'초임호봉획정':'일반'};
 const rownums=Object.keys(a).filter(k=>/^B\d+$/.test(k)&&['임용전','임용후'].includes(a[k])).map(k=>Number(k.slice(1))).sort((x,y)=>x-y),careers=[];
 for(const n of rownums){const get=c=>a[c+n]||'',scope=get('B')==='임용전'?'pre':'post',start=get('C'),desc=get('I'),rate=get('O'),method=num(get('U'));
  if(!start&&!desc&&!rate)continue;
  if(get('U').includes('*'))throw Error('구간 분할 시간강사는 원본 JSON으로 불러오세요.');
  const child=rate==='육아휴직'?(/둘째/.test(desc)?2:1):0,cap=num(get('Y'));
  careers.push({scope,start:start==='-'?'':date(start),end:scope==='pre'?date(get('F')):'',desc,rate:child?'child':rate,child,cap,kind:child?'child'+child:method?'part':cap?'degree':'normal',part:method?{method,hours:method===1?num(get('V')):0,total:method!==1?num(get('V')):0,avg:num(get('W'))||40}:null});
 }
 settings.appointDate=careers.find(r=>r.scope==='post')?.start||date(d.B11||'');
 const header=Object.keys(a).find(k=>/^M\d+$/.test(k)&&a[k]==='호봉획정일');if(!header)throw Error('획정기준일 위치를 찾지 못했습니다.');
 settings.standardDate=date(a['M'+(Number(header.slice(1))+1)]||'');
 for(const [label,prefix] of [['작성자','writer'],['본  인','self'],['확인자','checker']]){const ref=Object.keys(a).find(k=>/^C\d+$/.test(k)&&a[k]===label);if(ref){const n=ref.slice(1);settings[prefix+'Pos']=a['G'+n]||'';settings[prefix+'Name']=(a['K'+n]||'').replace(/\s*\(인\)\s*$/,'');}}
 settings.noPre=!careers.some(r=>r.scope==='pre');return {version:2,settings,careers};
}
root.HobongImport=read;
})(typeof globalThis==='undefined'?this:globalThis);
