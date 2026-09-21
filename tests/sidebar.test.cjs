const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const dir=require('node:path').resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(dir+'/index.html','utf8'),{runScripts:'outside-only',url:'https://example.test'}),w=dom.window;
w.HTMLElement.prototype.scrollIntoView=function(){};w.TextEncoder=TextEncoder;w.Blob=Blob;w.Response=Response;w.DecompressionStream=DecompressionStream;w.TextDecoder=TextDecoder;w.confirm=()=>true;w.alert=msg=>{throw Error(msg)};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
for(const f of ['hobong-engine.js','xlsx-export.js','xlsx-import.js','app.js'])w.eval(fs.readFileSync(dir+'/'+f,'utf8'));
const $=id=>w.document.getElementById(id),fill=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
(async()=>{
 assert.equal(w.document.querySelectorAll('[data-section]').length,7);
 for(const btn of w.document.querySelectorAll('[data-section]')){btn.click();assert.equal(btn.getAttribute('aria-current'),'step');}
 $('btnExample').click();assert.equal($('resultStep').textContent,'25호봉');assert.equal($('nextPromotion').textContent,'2021-07-01');
 for(const [id,value] of Object.entries({org:'테스트학교',personName:'시험대상',schoolName:'시험대학교',certificateName:'정교사 1급',writerName:'작성',selfName:'본인',checkerName:'확인'}))fill(id,value);
 assert.equal($('railProgressText').textContent,'7/7');
 let captured;w.HobongXlsx.export=(S,R)=>{captured={S,R};};$('btnExcel').click();assert.equal(captured.S.who.name,'시험대상');
 const blob=w.HobongXlsx.build(captured.S,captured.R),data=await w.HobongImport(blob);
 assert.equal(data.settings.personName,'시험대상');assert.equal(data.settings.writerName,'작성');assert.equal(data.careers.length,8);assert.equal(data.settings.appointDate,'2006-09-01');assert.equal(data.settings.standardDate,'2021-03-01');
 const result=w.Hobong.calculate(data);assert.equal(result.result.step,25);assert.equal(w.Hobong.iso(result.result.next),'2021-07-01');
 fill('schoolYears','-1');captured=null;$('btnExcel').click();assert.equal(captured,null);assert.equal($('resultStep').textContent,'입력 확인');
 assert.equal($('eventBody').children.length,0,'invalid input hides promotion records');
 let prints=0;w.print=()=>prints++;
 for(const b of w.document.querySelectorAll('[data-rail=print]'))b.click();
 $('btnPrint').click();assert.equal(prints,0,'all print paths reject invalid input');
 $('btnNew').click();assert.equal($('personName').value,'');assert.equal($('writerName').value,'');
 console.log('PASS: seven navigation targets, completion, example, identity export, XLSX round-trip, invalid-output guard, new person');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1;});

