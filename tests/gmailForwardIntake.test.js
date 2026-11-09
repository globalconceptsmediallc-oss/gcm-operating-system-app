/* =========================================================
 * Global Concepts Media Operating System
 * File: tests/gmailForwardIntake.test.js
 * Version: 1.0.0
 * Status: PR Regression Gate
 * Purpose: Verify attachment-preserving Gmail forward draft and unchanged reply behavior.
 * ========================================================= */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import vm from "node:vm";
import {webcrypto} from "node:crypto";

for(const path of ["routes/gmailIntegrationLegacy.js","shared/today-email-intake.js","shared/gcm-shell.js"]){
  execFileSync(process.execPath,["--check",path],{stdio:"pipe"});
}

const original=readFileSync("routes/gmailIntegrationLegacy.js","utf8");
const frontend=readFileSync("shared/today-email-intake.js","utf8");
const shell=readFileSync("shared/gcm-shell.js","utf8");
const today=readFileSync("today.html","utf8");

assert.match(original,/async function createGmailForwardDraft\(/);
assert.match(original,/forwardIntakeId/);
assert.match(frontend,/Reply in Gmail/);
assert.match(frontend,/Forward in Gmail/);
assert.match(frontend,/prepareGmailReply/);
assert.match(frontend,/prepareGmailForward/);
assert.match(shell,/today-email-intake\.js\?v=2\.8\.0/);
assert.match(today,/gcm-shell\.js\?v=2\.0\.67/);

const start=original.indexOf("async function createGmailForwardDraft(");
const end=original.indexOf("async function confirmProspectGmailSend(",start);
assert(start>0&&end>start);

function makeContext({sourceAttachments=true,attachmentRequestWorks=true}={}){
  let createdDrafts=0;
  let outboundRaw="";
  const sourceRow={
    provider_message_id:"source-msg-17",
    provider_thread_id:"original-thread-17",
    subject:"Original invoice",
    body_text:"Original invoice attached.",
    has_attachments:1
  };
  const plain=Buffer.from("Original invoice attached.","utf8").toString("base64url");
  const sourceMessage={
    id:"source-msg-17",threadId:"original-thread-17",
    payload:{
      headers:[
        {name:"From",value:"Julie <billing@example.com>"},
        {name:"To",value:"agency@example.com"},
        {name:"Date",value:"Fri, 6 Nov 2026 12:00:00 -0500"},
        {name:"Subject",value:"October invoice"}
      ],
      parts:[
        {mimeType:"text/plain",body:{data:plain}},
        ...(sourceAttachments?[{
          mimeType:"application/pdf",filename:"invoice.pdf",
          body:{attachmentId:"attachment-17"}
        }]:[])
      ]
    }
  };
  const fetch=async (url,options={})=>{
    if(url.includes("?format=full")){
      assert.equal(options.method||"GET","GET");
      assert(url.includes("source-msg-17"));
      return {ok:true,json:async()=>sourceMessage};
    }
    if(url.includes("/attachments/attachment-17")){
      if(!attachmentRequestWorks)return {ok:false,json:async()=>({error:{message:"Unable to read attachment"}})};
      return {ok:true,json:async()=>({data:Buffer.from("%PDF-example-invoice").toString("base64url")})};
    }
    if(url.endsWith("/drafts")){
      createdDrafts++;
      const body=JSON.parse(options.body);
      outboundRaw=Buffer.from(body.message.raw,"base64url").toString("utf8");
      assert.equal(options.method,"POST");
      assert(!body.message.threadId,"Forward draft must not overwrite original thread");
      return {ok:true,json:async()=>({id:"new-draft-17",message:{threadId:"draft-thread-17"}})};
    }
    throw new Error("Unexpected HTTP request "+url);
  };
  const db={
    prepare(sql){
      assert(/email_intake|gmail_connections/.test(sql));
      return {
        bind(...params){
          if(sql.includes("email_intake"))assert.equal(params[0],17);
          return {first:async()=>sql.includes("email_intake")?sourceRow:{encrypted_refresh_token:"encrypted"}};
        },
        first:async()=>({encrypted_refresh_token:"encrypted"})
      };
    }
  };
  const context={
    clean:v=>String(v||"").trim(),
    jsonResponse:(data,status=200)=>({status,data}),
    requireDb:()=>db,
    ensureTable:async()=>{},
    decrypt:async()=>"refresh-token",
    refreshAccessToken:async()=>"access-token",
    fetch,
    API:"https://gmail.googleapis.com/gmail/v1",
    encodeMimeHeader:v=>v,
    wrapMimeBase64:v=>v.match(/.{1,76}/g)?.join("\r\n")||"",
    bytesToStandardBase64:v=>Buffer.from(v).toString("base64"),
    decode:v=>new Uint8Array(Buffer.from(v,"base64url")),
    encode:v=>Buffer.from(v).toString("base64url"),
    TextDecoder,TextEncoder,crypto:webcrypto,
    ACTIONS:{CREATE_GMAIL_DRAFT:"create-gmail-draft"},
    GMAIL_INTEGRATION_VERSION:"1.7.6",
    logWorkerError:()=>{},
    safeErrorMessage:e=>e.message
  };
  vm.createContext(context);
  vm.runInContext(original.slice(start,end)+"\nthis.forward=createGmailForwardDraft;",context);
  return {context,details:()=>({createdDrafts,outboundRaw})};
}

{
  const {context,details}=makeContext();
  const result=await context.forward(
    {forwardIntakeId:17,to:"adrianne@example.com, kristy@example.com",body:"Please review for co-op."},
    {},"test-request");
  assert.equal(result.status,200);
  assert.equal(result.data.sent,false);
  assert.equal(result.data.attachmentCount,1);
  assert.equal(details().createdDrafts,1);
  assert.match(details().outboundRaw,/To: adrianne@example.com, kristy@example.com/);
  assert.match(details().outboundRaw,/Subject: Fwd: October invoice/);
  assert.match(details().outboundRaw,/filename="invoice.pdf"/);
  assert.match(details().outboundRaw,/JVBERi1leGFtcGxlLWludm9pY2U=/);
  assert.match(details().outboundRaw,/UGxlYXNlIHJldmlldyBmb3IgY28tb3Au/);
}
{
  const {context,details}=makeContext({sourceAttachments:false});
  const result=await context.forward({forwardIntakeId:17,to:"safe@example.com",body:""},{},"missing-attachment");
  assert.equal(result.status,500);
  assert.equal(details().createdDrafts,0,"Never create draft missing original attachment");
}
{
  const {context,details}=makeContext();
  const result=await context.forward({forwardIntakeId:17,to:"bad\nBcc:evil@example.com",body:""},{},"unsafe-recipient");
  assert.equal(result.status,400);
  assert.equal(details().createdDrafts,0);
}
console.info("PASS: Gmail forward creates review-only draft retaining exact source PDF; missing attachments fail closed; Reply remains available.");
