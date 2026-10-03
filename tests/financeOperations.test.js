/* =========================================================
   Global Concepts Media Operating System
   File: tests/financeOperations.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose: Verify Finance list reads invoice numbering from permanent D1
            and returns the next available numeric invoice number.
   ========================================================= */

import assert from "node:assert/strict";
import {
  handleFinanceOperations,
  FINANCE_OPERATIONS_VERSION
} from "../routes/financeOperations.js";

assert.equal(FINANCE_OPERATIONS_VERSION,"1.0.3");

function mockDb(){
  return {
    prepare(sql){
      return {
        async all(){
          if(/FROM finance_billing_accounts/i.test(sql)){
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
        }
      };
    }
  };
}

const response=await handleFinanceOperations(
  {operation:"list"},
  {DB:mockDb()},
  "finance-numbering-test"
);

assert.equal(response.status,200);
const payload=await response.json();

assert.equal(payload.ok,true);
assert.equal(payload.operation,"list");
assert.equal(payload.financeOperationsVersion,"1.0.3");
assert.equal(payload.latestNumericInvoice,2243);
assert.equal(payload.nextInvoiceNumber,2244);
assert.equal(payload.writesPerformed,0);
assert.equal(payload.invoices[0].invoice_number,"2243");

console.log("PASS Finance D1 invoice numbering authority: latest 2243, next 2244");
