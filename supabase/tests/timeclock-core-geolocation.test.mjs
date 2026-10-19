import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture() {
 let watch, finishTimer, timestamp=100000, watchCount=0; const cleared=[];
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync('src/modules/timeclock/geolocation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({}),navigator:{geolocation:{watchPosition(success,error){watchCount++;watch={success,error};return 7;},clearWatch:id=>cleared.push(id)}},setTimeout:fn=>{finishTimer=fn;return 3;},clearTimeout:()=>{},Date:{now:()=>timestamp},Number,Promise});
 return {api:exports,reading(accuracy,age=0){watch.success({coords:{latitude:38,longitude:-9,accuracy},timestamp:timestamp-age});},fail(){watch.error();},timeout(){finishTimer();},advance(ms){timestamp+=ms;},get watchCount(){return watchCount;},cleared};
}
test('Given several GPS readings, when eight seconds elapse, then best accuracy is selected',async()=>{
 const f=fixture(); const promise=f.api.getBestPosition(); f.reading(150);f.reading(40);f.reading(90);f.timeout();
 assert.equal((await promise).accuracy,40);assert.deepEqual(f.cleared,[7]);
});
test('Given precise GPS, when read again within ninety seconds, then cached fix carries correct age',async()=>{
 const f=fixture();const first=f.api.getBestPosition();f.reading(20);await first;f.advance(15000);
 const result=await f.api.getBestPosition();assert.equal(result.age_ms,15000);assert.equal(f.watchCount,1);
});
test('Given denied GPS, when acquiring a fix, then punching may continue with null',async()=>{
 const f=fixture();const promise=f.api.getBestPosition();f.fail();assert.equal(await promise,null);
});
test('Given warmup still collecting, when punch asks for GPS, then same collector is shared',async()=>{
 const f=fixture();const first=f.api.getBestPosition(),second=f.api.getBestPosition();f.reading(25);
 assert.equal(first,second);await first;assert.equal(f.watchCount,1);
});
