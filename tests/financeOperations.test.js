/* =========================================================
   Global Concepts Media Operating System
   File: tests/financeOperations.test.js
   Version: 1.2.0
   Status: Production Regression Test
   Purpose: Lock D1-authoritative Finance numbering, invoice preparation,
            write-path dry runs, and Billing UI D1 authority wiring.
   ========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  handleFinanceOperations,
  FINANCE_OPERATIONS_VERSION
} from "../routes/financeOperations.js";

assert.equal(FINANCE_OPERATIONS_VERSION,"1.2.0");

function accountRow(){
  return {
    id:1,account_key:"1",name:"Southeast Safes",contact_name:"Adrianne",
    billing_email:"Adrianne@sesafes.com",phone:"",address:"",website:"https://sesafes.com",
    logo_url:"",terms_days:30,invoice_note:"Payment method: Check. Thank you for your business.",
    monthly_amount_cents:160000,
    covered_clients_json:JSON.stringify(["Southeast Safes","A1 Action Safe & Lock"]),
    default_services_json:JSON.stringify([
      {name:"Liberty Safe Content — Website • SEO",values:[400,400]},
      {name:"Liberty Safe Content — Social Media • Content",values:[400,400]}
    ]),
    archived_at:null
  };
}
function invoice2243(){
  return {
    id:56,billing_account_id:1,invoice_number:"2243",invoice_type:"monthly",
    invoice_date:"2026-10-02",due_date:null,billing_period:"Services performed during September 2026",
    description:"Monthly Billing Package",amount_cents:160000,paid_amount_cents:0,status:"sent",
    email_to:"Adrianne@sesafes.com",original_invoice_number:null,revision_number:0,
    correction_statement:null,account_snapshot_json:null
  };
}
function invoice2241(){
  return {
    id:54,billing_account_id:1,invoice_number:"2241",invoice_type:"monthly",
    invoice_date:"2026-09-02",billing_period:"Services performed during August 2026",
    description:"Monthly Billing Package",amount_cents:160000,paid_amount_cents:160000,status:"closed",
    email_to:"Adrianne@sesafes.com",revision_number:0
  };
}
function mockDb(){
  const state={writes:0};
  return {
    state,
    prepare(sql){
      const query={
        args:[],
        bind(...args){query.args=args;return query;},
        async all(){
          if(/SELECT \* FROM finance_billing_accounts WHERE id=/i.test(sql)){
            return {results:[accountRow()]};
          }
          if(/SELECT \* FROM finance_billing_accounts WHERE lower\(name\)/i.test(sql)){
            return {results:[accountRow()]};
          }
          if(/FROM finance_billing_accounts WHERE archived_at IS NULL ORDER BY id/i.test(sql)){
            return {results:[accountRow()]};
          }
          if(/SELECT \* FROM finance_invoices WHERE invoice_number=/i.test(sql)){
            return {results:[String(query.args[0])==="2241"?invoice2241():invoice2243()]};
          }
          if(/SELECT revision_number,invoice_number FROM finance_invoices/i.test(sql)){
            return {results:[{revision_number:0,invoice_number:"2243"}]};
          }
          if(/FROM finance_invoices ORDER BY/i.test(sql)){
            return {results:[invoice2243(),invoice2241()]};
          }
          if(/FROM finance_invoice_lines WHERE invoice_id=/i.test(sql)){
            return {results:[
              {id:1,invoice_id:56,line_type:"service",description:"Liberty Safe Content — Website • SEO",location_label:null,amount_cents:80000,sort_order:1},
              {id:2,invoice_id:56,line_type:"service",description:"Liberty Safe Content — Social Media • Content",location_label:null,amount_cents:80000,sort_order:2}
            ]};
          }
          if(/FROM finance_invoice_lines ORDER BY/i.test(sql)){
            return {results:[]};
          }
          if(/FROM finance_payments/i.test(sql)){
            return {results:[]};
          }
          if(/latest_numeric_invoice/i.test(sql)){
            return {results:[{latest_numeric_invoice:2243}]};
          }
          if(/invoice_count/i.test(sql)&&/payment_count/i.test(sql)){
            return {results:[{invoice_count:0,payment_count:0}]};
          }
          throw new Error(`Unexpected Finance SQL: ${sql}`);
        },
        async run(){state.writes+=1;return {meta:{changes:1}};}
      };
      return query;
    }
  };
}

{
  const DB=mockDb();
  const response=await handleFinanceOperations({operation:"list"},{DB},"finance-numbering-test");
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.ok,true);
  assert.equal(payload.financeOperationsVersion,"1.2.0");
  assert.equal(payload.latestNumericInvoice,2243);
  assert.equal(payload.nextInvoiceNumber,2244);
  assert.equal(payload.writesPerformed,0);
  assert.equal(DB.state.writes,0);
}

{
  const DB=mockDb();
  const response=await handleFinanceOperations({
    operation:"create_invoice",dryRun:true,accountName:"Southeast Safes",invoiceType:"monthly",
    invoiceDate:"2026-10-03",billingPeriod:"Services performed during September 2026",
    emailTo:"Adrianne@sesafes.com",extras:[]
  },{DB},"finance-create-dry-run");
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.preparedInvoiceNumber,"2244");
  assert.equal(payload.amountCents,160000);
  assert.equal(payload.lines.length,2);
  assert.equal(payload.writesPerformed,0);
  assert.equal(DB.state.writes,0);
}

{
  const DB=mockDb();
  const response=await handleFinanceOperations({
    operation:"save_account",dryRun:true,account:{
      id:1,name:"Southeast Safes",email:"Adrianne@sesafes.com",termsDays:30,
      note:"Payment method: Check. Thank you for your business.",
      locations:["Southeast Safes","A1 Action Safe & Lock"],
      services:[
        {name:"Liberty Safe Content — Website • SEO",values:[400,400]},
        {name:"Liberty Safe Content — Social Media • Content",values:[400,400]}
      ]
    }
  },{DB},"finance-account-dry-run");
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.preparedAccount.monthlyAmountCents,160000);
  assert.equal(payload.writesPerformed,0);
  assert.equal(DB.state.writes,0);
}

{
  const DB=mockDb();
  const response=await handleFinanceOperations({
    operation:"create_correction",dryRun:true,originalInvoiceNumber:"2243",
    invoiceDate:"2026-10-03",billingPeriod:"Services performed during September 2026",
    replaceStandardLines:false,correctedLines:[]
  },{DB},"finance-correction-dry-run");
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.preparedInvoiceNumber,"2243-R1");
  assert.equal(payload.amountCents,160000);
  assert.equal(payload.writesPerformed,0);
  assert.equal(DB.state.writes,0);
}

{
  const DB=mockDb();
  const response=await handleFinanceOperations({
    operation:"record_payment",dryRun:true,invoiceNumber:"2243",paymentDate:"2026-10-03",
    paymentMethod:"Check",reference:"DRY-RUN",amount:1
  },{DB},"finance-payment-dry-run");
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.amountCents,100);
  assert.equal(payload.nextStatus,"sent");
  assert.equal(payload.writesPerformed,0);
  assert.equal(DB.state.writes,0);
}

{
  const DB=mockDb();
  const response=await handleFinanceOperations({
    operation:"close_invoice",dryRun:true,invoiceNumber:"2241"
  },{DB},"finance-close-dry-run");
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.writesPerformed,0);
  assert.equal(DB.state.writes,0);
}

{
  const DB=mockDb();
  const response=await handleFinanceOperations({
    operation:"mark_gmail_draft",dryRun:true,invoiceNumber:"2243",
    emailTo:"Adrianne@sesafes.com",gmailDraftUrl:"draft-url",gmailDraftCreatedAt:"2026-10-03T10:00:00.000Z"
  },{DB},"finance-draft-dry-run");
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.invoiceNumber,"2243");
  assert.equal(payload.writesPerformed,0);
  assert.equal(DB.state.writes,0);
}

{
  const page=fs.readFileSync(new URL("../finance.html",import.meta.url),"utf8");
  assert.match(page,/Version: 1\.8\.0/);
  assert.match(page,/Installed version 1\.8\.0/);
  assert.match(page,/async function loadFinanceFromD1\(\)/);
  assert.match(page,/operation:"list"/);
  assert.match(page,/operation:"save_account"/);
  assert.match(page,/operation:"create_invoice"/);
  assert.match(page,/operation:"create_correction"/);
  assert.match(page,/operation:"record_payment"/);
  assert.match(page,/operation:"close_invoice"/);
  assert.match(page,/operation:"mark_gmail_draft"/);
  assert.match(page,/D1 is authoritative/);
  assert.match(page,/localStorage remains untouched as fallback/);
  assert.doesNotMatch(page,/\n\s*migrateFinanceToD1Once\(\);\s*\n/);
  assert.match(page,/replace\(\/Payment method:\\s\*Check\\s\+or\\s\+ACH\/gi,"Payment method: Check"\)/);
  const scripts=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).filter(Boolean);
  const appScript=scripts.at(-1);
  assert.ok(appScript&&appScript.includes('const VERSION="1.8.0"'));
  new Function(appScript);
}

console.log("PASS Finance 1.8.0 D1 authority: reads, numbering, invoice preparation, account/correction/payment/close/draft dry runs, and UI wiring");
