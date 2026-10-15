/* =========================================================
   GCM OS — Advertising & Source Evidence UI Regression
   File: tests/sourceEvidenceUi.test.js
   Version: 1.0.3
   No production writes; verifies Radar v3.9.3 syntax and security wiring.
   ========================================================= */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
const html=readFileSync("prospects.html","utf8");
assert.match(html,/File: prospects\.html[\s\S]*?Version: 3\.9\.3/);
assert.match(html,/id="radar-evidence-add"/);
assert.match(html,/id="radar-evidence-list"/);
assert.match(html,/id="source-evidence-dialog"/);
assert.match(html,/id="source-evidence-form"/);
assert.match(html,/gcm_os_session/);
assert.match(html,/sessionStorage\.setItem\(EVIDENCE_SESSION_KEY,token\)/);
assert.match(html,/history\.replaceState/);
assert.match(html,/"Authorization":"Bearer "\+token/);
assert.match(html,/action:"source-evidence"/);
assert.match(html,/for\(const mime of \["image\/webp","image\/jpeg"\]\)/);
assert.match(html,/data\.type===mime/);
assert.match(html,/evidenceBusy=true/);
assert.match(html,/if\(evidenceBusy\)return/);
assert.match(html,/renderRadarDetail\(r\)/);
assert.match(html,/loadSourceEvidenceGallery\(r\.id\)/);
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(Boolean);
const main=scripts.find(s=>s.includes('const FILE_VERSION="3.9.3"'));
assert.ok(main,"Prospects main JavaScript is present");
new Script(main,{filename:"prospects.html:inline"});

// Simulate Safari reporting a createImageBitmap Blob error despite a valid JPEG.
// Verify HTMLImageElement fallback, compression and blob-URL cleanup, without a browser or D1 writes.
const first=main.indexOf("  async function compressEvidenceFile(file){");
const last=main.indexOf('  $("source-evidence-form").addEventListener',first);
assert.ok(first>=0&&last>first,"Image optimizer can be isolated for behavior tests");
const optimizerSource=main.slice(first,last);
const { runInNewContext }=await import("node:vm");
async function exerciseOptimizer({bitmapFails=false,imageFails=false}={}){
  const trace={bitmapCalls:0,imageCalls:0,draws:[],created:[],revoked:[],warnings:[],closed:0};
  const original={type:"image/jpeg",size:600000};
  class TestImage{
    constructor(){trace.imageCalls++;this.naturalWidth=1600;this.naturalHeight=900;}
    set src(url){Promise.resolve().then(()=>imageFails?this.onerror():this.onload());}
  }
  const context={
    createImageBitmap:async()=>{
      trace.bitmapCalls++;
      if(bitmapFails)throw Error("An error occurred reading the Blob argument to createImageBitmap");
      return {width:1600,height:900,close(){trace.closed++;}};
    },
    URL:{
      createObjectURL(blob){assert.equal(blob,original);trace.created.push("blob:test");return"blob:test";},
      revokeObjectURL(url){trace.revoked.push(url);}
    },
    Image:TestImage,
    document:{createElement(kind){
      assert.equal(kind,"canvas");
      return {
        width:0,height:0,
        getContext(name){assert.equal(name,"2d");return{drawImage(...args){trace.draws.push(args);}};},
        toBlob(callback,mime){callback({type:mime,size:256000});}
      };
    }},
    imageData:async()=> "ZGVtbw==",
    console:{warn(...args){trace.warnings.push(args);}}
  };
  const compress=runInNewContext(optimizerSource+";compressEvidenceFile",context);
  return {trace,result:await compress(original)};
}
const fallback=await exerciseOptimizer({bitmapFails:true});
assert.equal(fallback.trace.bitmapCalls,1);
assert.equal(fallback.trace.imageCalls,1);
assert.equal(fallback.trace.draws.length,1);
assert.deepEqual(fallback.trace.created,["blob:test"]);
assert.deepEqual(fallback.trace.revoked,["blob:test"]);
assert.equal(fallback.result.contentType,"image/webp");
assert.equal(fallback.result.widthPx,1600);
assert.equal(fallback.result.heightPx,900);
const normal=await exerciseOptimizer();
assert.equal(normal.trace.imageCalls,0);
assert.equal(normal.trace.closed,1);
assert.equal(normal.trace.revoked.length,0);
await assert.rejects(exerciseOptimizer({bitmapFails:true,imageFails:true}),
  /Safari could not read this image/);
console.log("PASS Safari Blob decode error recovery: image-element fallback, optimized output and safe resource cleanup");
console.log("PASS Prospects 3.9.3 private evidence dialog/gallery, login session, compression, single-save guard and JavaScript syntax");