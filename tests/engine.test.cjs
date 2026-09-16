const assert=require('node:assert/strict');
const H=require('../hobong-engine.js');
const fixtures=require('./reference-fixtures.json');
for(const f of fixtures){
 const r=H.calculate(f.input);
 const actual={total:r.total,pre:r.preTotal,post:r.post.total,correction:r.post.correction,step:r.result?.step,next:r.result?.next,carry:r.result?.carry,events:r.events.map(e=>[e.date,e.type,e.step,e.period.y,e.period.m,e.period.d,e.next,e.deferred])};
 assert.deepEqual(JSON.parse(JSON.stringify(actual)),f.expected,f.name);
}
assert.equal(H.parse('2023-02-29'),null);
assert.equal(H.parse('2024-02-30'),null);
assert.deepEqual(H.period(H.parse('2024-01-31'),H.parse('2024-02-29')),{y:0,m:1,d:0});
assert.deepEqual(H.period(H.parse('2020-03-01'),H.parse('2021-02-28')),{y:1,m:0,d:0});
assert.equal(H.prorate(29,50),14);
assert.equal(H.beforeRow({start:'2020-03-01',end:'2021-02-28',rate:100}).converted,360);
assert.equal(H.beforeRow({start:'2020-03-01',end:'2021-02-28',rate:80}).converted,288);
assert.equal(H.calculate({settings:{},careers:[]}).result,null);
console.log(`PASS: ${fixtures.length} reference scenarios (all event rows), date validation and conversion assertions`);
