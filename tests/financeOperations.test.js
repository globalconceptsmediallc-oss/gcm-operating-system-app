/* =========================================================
   Global Concepts Media Operating System
   File: tests/financeOperations.test.js
   Version: 1.1.0
   Status: Production Regression Test
   Purpose: Verify Finance reads invoice numbering from permanent D1 and
            prepares D1-authoritative invoice creation without browser-local
            numbering or dry-run writes.
   ========================================================= */

import assert from "node:assert/strict";
import {
  handleFinanceOperations,
  FINANCE_OPERATIONS_VERSION
} from "../routes/financeOperations.js";

assert.equal(FINANCE_OPERATIONS_VERSION,"1.1.0");

function mockDb(){
  const state={writes:0};
  return {
    state,
    prepare(sql){
      const query={
        args:[],
        bind(...args){
          query.args=args;
          return query;
        },
        async all(){
          if(/SELECT \* FROM finance_billing_accounts WHERE id=/i.test(sql) || /SELECT \* FROM finance_billing_accounts WHERE lower\(name\)/i.test(sql)){
            return {results:[{
              id:1,
              account_key:"1",
              name:"Southeast Safes",
              contact_name:"Adrianne",
              billing_email:"Adrianne@sesafes.com",
              address:"",
              website:"https://sesafes.com",
              logo_url:"",
              invoice_note:"Payment method: Check. Thank you for your business.",
              monthly_amount_cents:160000,
              covered_clients_json:JSON.stringify(["Southeast Safes","A1 Action Safe & Lock"]),
              default_services_json:JSON.stringify([
                {name:"Liberty Safe Content — Website • SEO",values:[400,400]},
                {name:"Liberty Safe Content — Social Media • Content",values:[400,400]}
              ]),
              archived_at:null
            }]};
          }
          if(/FROM finance_billing_accounts WHERE archived_at IS NULL ORDER BY id/i.test(sql)){
            return {results:[{id:1,account_key:"1",name:"Southeast Safes"}]};
          }
          if(/FROM finance_invoices ORDER BY/i.test(sql)){
            return {results:[{id:56,invoice_number:"2243",billing_account_id:14}]};
          }
          if(/FROM finance_invoice_lines/i.test(sql)){
            return {results:[]};
          }
          if(/FROM finance_payments/i.test(sql)){
            return {results:[]};
          }
          if(/latest_numeric_invoice/i.test(sql)){
            return {results:[{latest_numeric_invoice:2243}]};
          }
          throw new Error(`Unexpected Finance SQL: ${sql}`);
        },
        async run(){
          state.writes += 1;
          return {meta:{changes:1}};
        }
      };
      return query;
    }
  };
}

{
  const DB=mockDb();
  const response=await handleFinanceOperations(
    {operation:"list"},
    {DB},
    "finance-numbering-test"
  );

  assert.equal(response.status,200);
  const payload=await response.json();

  assert.equal(payload.ok,true);
  assert.equal(payload.operation,"list");
  assert.equal(payload.financeOperationsVersion,"1.1.0");
  assert.equal(payload.latestNumericInvoice,2243);
  assert.equal(payload.nextInvoiceNumber,2244);
  assert.equal(payload.writesPerformed,0);
  assert.equal(payload.invoices[0].invoice_number,"2243");
  assert.equal(DB.state.writes,0);
}

{
  const DB=mockDb();
  const response=await handleFinanceOperations(
    {
      operation:"create_invoice",
      dryRun:true,
      accountName:"Southeast Safes",
      invoiceType:"monthly",
      invoiceDate:"2026-10-03",
      billingPeriod:"Services performed during September 2026",
      emailTo:"Adrianne@sesafes.com",
      extras:[]
    },
    {DB},
    "finance-create-dry-run"
  );

  assert.equal(response.status,200);
  const payload=await response.json();

  assert.equal(payload.ok,true);
  assert.equal(payload.operation,"create_invoice");
  assert.equal(payload.financeOperationsVersion,"1.1.0");
  assert.equal(payload.dryRun,true);
  assert.equal(payload.preparedInvoiceNumber,"2244");
  assert.equal(payload.amountCents,160000);
  assert.equal(payload.lines.length,2);
  assert.equal(payload.lines[0].amountCents,80000);
  assert.equal(payload.lines[1].amountCents,80000);
  assert.equal(payload.writesPerformed,0);
  assert.equal(DB.state.writes,0);
}

console.log("PASS Finance D1 invoice numbering + no-write invoice preparation: latest 2243, next 2244");
