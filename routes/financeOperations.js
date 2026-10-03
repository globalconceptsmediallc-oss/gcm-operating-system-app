/* =========================================================
   Global Concepts Media Operating System
   File: routes/financeOperations.js
   Version: 1.1.0
   Status: Production Road-Test Candidate — D1 Invoice Creation
   Purpose: Durable D1-backed Finance/Billing operations.
   Changes — 1.1.0:
   - Adds D1-authoritative Create Invoice with invoice numbering allocated from D1.
   - Builds monthly service lines from the permanent billing-account profile.
   - Persists additional-service lines with the invoice.
   - Adds a no-write dry-run mode for production verification without manufacturing a financial record.

   Changes — 1.0.3:
   - Returns latestNumericInvoice and nextInvoiceNumber from permanent D1 invoice records.
   - Keeps invoice-number authority out of browser-local state.
   Rules:
   - D1 is the authoritative Finance source.
   - Browser state may be imported only through duplicate-safe snapshot sync.
   - Check is the default payment method.
   - No invoice or payment is manufactured by this route.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import { jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const FINANCE_OPERATIONS_ACTION = "finance-operations";
export const FINANCE_OPERATIONS_VERSION = "1.1.0";
const MAX_ACCOUNTS = 50;
const MAX_TRANSACTIONS = 2000;

export async function handleFinanceOperations(body, env, requestId) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({ok:false,requestId,action:FINANCE_OPERATIONS_ACTION,error:"The production D1 database binding is unavailable."},503);
  }
  const operation=clean(body?.operation||"list").toLowerCase();
  try {
    if(operation==="list") return await listFinance(db,requestId);
    if(operation==="create_invoice") return await createInvoice(body,db,requestId);
    if(operation==="sync_snapshot") return await syncSnapshot(body,db,requestId);
    return jsonResponse({ok:false,requestId,action:FINANCE_OPERATIONS_ACTION,error:`Unsupported Finance operation: ${operation||"unknown"}.`},400);
  } catch(error) {
    logWorkerError({requestId,route:FINANCE_OPERATIONS_ACTION,stage:`finance_${operation}`,error});
    return jsonResponse({ok:false,requestId,action:FINANCE_OPERATIONS_ACTION,error:"Finance Operations could not complete the request.",details:safeErrorMessage(error)},500);
  }
}

async function listFinance(db,requestId){
  const accounts=rowsOf(await db.prepare("SELECT * FROM finance_billing_accounts WHERE archived_at IS NULL ORDER BY id").all());
  const invoices=rowsOf(await db.prepare("SELECT * FROM finance_invoices ORDER BY invoice_date DESC,id DESC").all());
  const lines=rowsOf(await db.prepare("SELECT * FROM finance_invoice_lines ORDER BY invoice_id,sort_order,id").all());
  const payments=rowsOf(await db.prepare("SELECT * FROM finance_payments ORDER BY payment_date DESC,id DESC").all());
  const numbering=rowsOf(await db.prepare("SELECT COALESCE(MAX(CAST(invoice_number AS INTEGER)),0) AS latest_numeric_invoice FROM finance_invoices WHERE invoice_number <> '' AND invoice_number NOT GLOB '*[^0-9]*'").all());
  const latestNumericInvoice=Number(numbering[0]?.latest_numeric_invoice||0);
  return jsonResponse({ok:true,requestId,action:FINANCE_OPERATIONS_ACTION,operation:"list",financeOperationsVersion:FINANCE_OPERATIONS_VERSION,accounts,invoices,invoiceLines:lines,payments,latestNumericInvoice,nextInvoiceNumber:latestNumericInvoice+1,writesPerformed:0});
}


async function createInvoice(body,db,requestId){
  const account=await resolveBillingAccount(body,db);
  if(!account) return bad(requestId,"The billing account could not be found in permanent D1 Finance records.");

  const invoiceType=clean(body?.invoiceType||"monthly").toLowerCase();
  if(!["monthly","additional"].includes(invoiceType)) return bad(requestId,"Invoice type must be monthly or additional.");

  const invoiceDate=date(body?.invoiceDate);
  if(!invoiceDate) return bad(requestId,"A valid invoiceDate is required.");

  const dueDate=dateOrNull(body?.dueDate);
  const billingPeriod=nul(body?.billingPeriod);
  if(invoiceType==="monthly"&&!billingPeriod) return bad(requestId,"A monthly invoice requires a billing period.");

  const extras=normalizeExtras(body?.extras);
  if(invoiceType==="additional"&&!extras.length) return bad(requestId,"An additional-services invoice requires at least one service line.");

  const services=parseArray(account.default_services_json);
  const locations=parseArray(account.covered_clients_json);
  const monthlyLines=invoiceType==="monthly"
    ? services.map((service,index)=>({
        lineType:"service",
        description:clean(service?.name),
        locationLabel:null,
        amountCents:cents((Array.isArray(service?.values)?service.values:[]).reduce((sum,value)=>sum+(Number(value)||0),0)),
        sortOrder:index+1
      })).filter(line=>line.description&&line.amountCents>0)
    : [];

  if(invoiceType==="monthly"&&!monthlyLines.length&&Number(account.monthly_amount_cents||0)>0){
    monthlyLines.push({
      lineType:"service",
      description:"Monthly Billing Package",
      locationLabel:null,
      amountCents:Number(account.monthly_amount_cents||0),
      sortOrder:1
    });
  }

  const baseAmountCents=monthlyLines.reduce((sum,line)=>sum+line.amountCents,0);
  const expectedMonthlyCents=Number(account.monthly_amount_cents||0);
  if(invoiceType==="monthly"&&expectedMonthlyCents>0&&baseAmountCents!==expectedMonthlyCents){
    return jsonResponse({
      ok:false,
      requestId,
      action:FINANCE_OPERATIONS_ACTION,
      error:"The permanent billing-account service rows do not match the monthly billing amount.",
      expectedMonthlyCents,
      serviceLinesTotalCents:baseAmountCents
    },409);
  }

  const additionalLines=extras.map((extra,index)=>({
    lineType:"additional",
    description:extra.description,
    locationLabel:null,
    amountCents:extra.amountCents,
    sortOrder:monthlyLines.length+index+1
  }));
  const lines=[...monthlyLines,...additionalLines];
  const amountCents=lines.reduce((sum,line)=>sum+line.amountCents,0);
  if(amountCents<=0) return bad(requestId,"The invoice total must be greater than zero.");

  const nextInvoiceNumber=await nextNumericInvoiceNumber(db);
  const emailTo=nul(body?.emailTo)||nul(account.billing_email);
  const description=invoiceType==="monthly"?"Monthly Billing Package":"Additional Services";
  const accountSnapshot={
    name:account.name,
    contact:account.contact_name||"",
    address:account.address||"",
    website:account.website||"",
    logoUrl:account.logo_url||"",
    locations,
    services,
    note:account.invoice_note||"Payment method: Check. Thank you for your business."
  };

  if(body?.dryRun===true){
    return jsonResponse({
      ok:true,
      requestId,
      action:FINANCE_OPERATIONS_ACTION,
      operation:"create_invoice",
      financeOperationsVersion:FINANCE_OPERATIONS_VERSION,
      dryRun:true,
      billingAccountId:Number(account.id),
      preparedInvoiceNumber:String(nextInvoiceNumber),
      amountCents,
      lines,
      writesPerformed:0
    });
  }

  let invoiceNumber="",invoiceId=0;
  for(let attempt=0;attempt<3&&!invoiceId;attempt++){
    invoiceNumber=String(await nextNumericInvoiceNumber(db));
    try{
      await db.prepare(`
        INSERT INTO finance_invoices(
          billing_account_id,invoice_number,invoice_type,invoice_date,due_date,billing_period,
          description,amount_cents,paid_amount_cents,status,email_to,revision_number,
          account_snapshot_json,source_type,source_reference,external_key
        )
        VALUES(?,?,?,?,?,?,?,?,0,'draft',?,0,?,'gcm_os_finance','Billing UI',?)
      `).bind(
        Number(account.id),
        invoiceNumber,
        invoiceType,
        invoiceDate,
        dueDate,
        billingPeriod,
        description,
        amountCents,
        emailTo,
        JSON.stringify(accountSnapshot),
        `finance-ui:invoice:${invoiceNumber}`
      ).run();
      const created=rowsOf(await db.prepare("SELECT id FROM finance_invoices WHERE invoice_number=? LIMIT 1").bind(invoiceNumber).all());
      invoiceId=Number(created[0]?.id||0);
    }catch(error){
      const message=safeErrorMessage(error).toLowerCase();
      if(message.includes("unique")&&message.includes("invoice")) continue;
      throw error;
    }
  }
  if(!invoiceId) throw new Error("D1 could not allocate a unique invoice number after retrying.");

  try{
    for(const line of lines){
      await db.prepare(`
        INSERT INTO finance_invoice_lines(
          invoice_id,line_type,description,location_label,amount_cents,sort_order,source_type,source_reference
        )
        VALUES(?,?,?,?,?,?,'gcm_os_finance',?)
      `).bind(
        invoiceId,
        line.lineType,
        line.description,
        line.locationLabel,
        line.amountCents,
        line.sortOrder,
        `Invoice #${invoiceNumber}`
      ).run();
    }
  }catch(error){
    try{
      await db.prepare("DELETE FROM finance_invoice_lines WHERE invoice_id=?").bind(invoiceId).run();
      await db.prepare("DELETE FROM finance_invoices WHERE id=? AND status='draft' AND paid_amount_cents=0").bind(invoiceId).run();
    }catch(cleanupError){
      logWorkerError({requestId,route:FINANCE_OPERATIONS_ACTION,stage:"finance_create_invoice_cleanup",error:cleanupError});
    }
    throw error;
  }

  const response=await listFinance(db,requestId);
  const payload=await response.json();
  return jsonResponse({
    ...payload,
    operation:"create_invoice",
    createdInvoiceId:invoiceId,
    createdInvoiceNumber:invoiceNumber,
    writesPerformed:1+lines.length
  });
}

async function resolveBillingAccount(body,db){
  const requestedId=Number(body?.billingAccountId||0);
  if(Number.isInteger(requestedId)&&requestedId>0){
    const rows=rowsOf(await db.prepare("SELECT * FROM finance_billing_accounts WHERE id=? AND archived_at IS NULL LIMIT 1").bind(requestedId).all());
    if(rows[0]) return rows[0];
  }
  const accountName=clean(body?.accountName);
  if(!accountName) return null;
  const rows=rowsOf(await db.prepare("SELECT * FROM finance_billing_accounts WHERE lower(name)=lower(?) AND archived_at IS NULL LIMIT 1").bind(accountName).all());
  return rows[0]||null;
}

async function nextNumericInvoiceNumber(db){
  const rows=rowsOf(await db.prepare("SELECT COALESCE(MAX(CAST(invoice_number AS INTEGER)),0) AS latest_numeric_invoice FROM finance_invoices WHERE invoice_number <> '' AND invoice_number NOT GLOB '*[^0-9]*'").all());
  return Number(rows[0]?.latest_numeric_invoice||0)+1;
}

function normalizeExtras(value){
  if(!Array.isArray(value)) return [];
  return value.slice(0,50).map(extra=>({
    description:clean(extra?.description),
    amountCents:cents(extra?.amount)
  })).filter(extra=>extra.description&&extra.amountCents>0);
}

function parseArray(value){
  if(Array.isArray(value)) return value;
  try{
    const parsed=JSON.parse(String(value??""));
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

async function syncSnapshot(body,db,requestId){
  const accounts=Array.isArray(body?.accounts)?body.accounts:[];
  if(accounts.length>MAX_ACCOUNTS) return bad(requestId,"Finance snapshot has too many billing accounts.");
  let txCount=0,writes=0;
  for(const raw of accounts){
    const key=clean(raw?.accountKey||raw?.id||raw?.name).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const name=clean(raw?.name);
    if(!key||!name) return bad(requestId,"Each billing account requires a stable account key and name.");
    const monthly=cents(raw?.monthlyAmount??raw?.monthly??sumServices(raw?.services));
    const locations=raw?.coveredClients||raw?.locations||[];
    const services=raw?.defaultServices||raw?.services||[];
    await db.prepare(`
      INSERT INTO finance_billing_accounts(account_key,name,contact_name,billing_email,phone,address,website,logo_url,terms_days,invoice_note,monthly_amount_cents,covered_clients_json,default_services_json,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'active')
      ON CONFLICT(account_key) DO UPDATE SET name=excluded.name,contact_name=excluded.contact_name,billing_email=excluded.billing_email,phone=excluded.phone,address=excluded.address,website=excluded.website,logo_url=excluded.logo_url,terms_days=excluded.terms_days,invoice_note=excluded.invoice_note,monthly_amount_cents=excluded.monthly_amount_cents,covered_clients_json=excluded.covered_clients_json,default_services_json=excluded.default_services_json,status='active',updated_at=CURRENT_TIMESTAMP
    `).bind(key,name,nul(raw?.contactName),nul(raw?.billingEmail||raw?.email),nul(raw?.phone),nul(raw?.address),nul(raw?.website),nul(raw?.logoUrl),int(raw?.termsDays),nul(raw?.invoiceNote),monthly,JSON.stringify(locations),JSON.stringify(services)).run();
    writes++;
    const ar=rowsOf(await db.prepare("SELECT id FROM finance_billing_accounts WHERE account_key=? LIMIT 1").bind(key).all());
    const accountId=Number(ar[0]?.id);
    const transactions=Array.isArray(raw?.transactions)?raw.transactions:[];
    txCount+=transactions.length;
    if(txCount>MAX_TRANSACTIONS) return bad(requestId,"Finance snapshot has too many transactions.");
    const invoiceMap=new Map();
    for(const t of transactions.filter(x=>clean(x?.type).toLowerCase()==="invoice")){
      const number=clean(t?.reference||t?.invoiceNumber);
      if(!number) continue;
      const amount=cents(t?.amount);
      const snapshot=t?.accountSnapshot||{name,contact:raw?.contactName||raw?.contact||"",address:raw?.address||"",website:raw?.website||"",logoUrl:raw?.logoUrl||"",locations,services,note:raw?.invoiceNote||raw?.note||""};
      const externalKey=`finance-import:invoice:${key}:${number.toLowerCase()}`;
      await db.prepare(`
        INSERT INTO finance_invoices(billing_account_id,invoice_number,invoice_type,invoice_date,due_date,billing_period,description,amount_cents,paid_amount_cents,status,email_to,original_invoice_number,revision_number,correction_statement,account_snapshot_json,source_type,source_reference,external_key,closed_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(invoice_number) DO UPDATE SET billing_account_id=excluded.billing_account_id,invoice_date=excluded.invoice_date,due_date=excluded.due_date,billing_period=excluded.billing_period,description=excluded.description,amount_cents=excluded.amount_cents,paid_amount_cents=excluded.paid_amount_cents,status=excluded.status,email_to=excluded.email_to,original_invoice_number=excluded.original_invoice_number,revision_number=excluded.revision_number,correction_statement=excluded.correction_statement,account_snapshot_json=excluded.account_snapshot_json,updated_at=CURRENT_TIMESTAMP
      `).bind(accountId,number,clean(t?.invoiceType||"monthly"),date(t?.date||t?.invoiceDate),dateOrNull(t?.dueDate),nul(t?.billingPeriod),nul(t?.description||t?.label),amount,cents(t?.paidAmount),clean(t?.status||"closed"),nul(t?.emailTo),nul(t?.originalReference),int(t?.revisionNumber),nul(t?.correctionStatement),JSON.stringify(snapshot),"finance_local_import",number,externalKey,clean(t?.status).toLowerCase()==="closed"?date(t?.date||t?.invoiceDate):null).run();
      writes++;
      const ir=rowsOf(await db.prepare("SELECT id FROM finance_invoices WHERE invoice_number=? LIMIT 1").bind(number).all());
      invoiceMap.set(String(t?.id??number),Number(ir[0]?.id));
    }
    for(const t of transactions.filter(x=>clean(x?.type).toLowerCase()==="payment")){
      let method=clean(t?.method||t?.description||"Check");
      let reference=clean(t?.reference);
      if(key.includes("shade-river") && date(t?.date)==="2026-07-15" && method.toLowerCase()==="ach"){
        method="Check";
        if(reference.toUpperCase()==="ACH-JULY") reference="LEGACY-JULY-2026";
      }
      if(!reference) reference="Check";
      const invoiceId=invoiceMap.get(String(t?.invoiceId??""))||null;
      const externalKey=`finance-import:payment:${key}:${date(t?.date)}:${reference.toLowerCase()}`;
      const existingPayment=rowsOf(await db.prepare("SELECT id FROM finance_payments WHERE external_key=? LIMIT 1").bind(externalKey).all());
      if(existingPayment[0]?.id){
        await db.prepare(`
          UPDATE finance_payments
          SET invoice_id=?,payment_method=?,reference=?,amount_cents=?,status=?,source_type=?,source_reference=?,notes=?
          WHERE id=?
        `).bind(invoiceId,method||"Check",reference,cents(t?.amount),clean(t?.status||"closed"),"finance_local_import",clean(t?.reference),nul(t?.notes),Number(existingPayment[0].id)).run();
      }else{
        await db.prepare(`
          INSERT INTO finance_payments(billing_account_id,invoice_id,payment_date,payment_method,reference,amount_cents,status,source_type,source_reference,external_key,notes)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)
        `).bind(accountId,invoiceId,date(t?.date),method||"Check",reference,cents(t?.amount),clean(t?.status||"closed"),"finance_local_import",clean(t?.reference),externalKey,nul(t?.notes)).run();
      }
      writes++;
    }
  }
  const data=await listFinance(db,requestId);
  const payload=await data.json();
  return jsonResponse({...payload,operation:"sync_snapshot",syncedAccounts:accounts.length,syncedTransactions:txCount,writesPerformed:writes});
}

function bad(requestId,error){return jsonResponse({ok:false,requestId,action:FINANCE_OPERATIONS_ACTION,error},400)}
function clean(v){return String(v??"").trim()}
function nul(v){const s=clean(v);return s||null}
function int(v){const n=Number(v);return Number.isInteger(n)&&n>=0?n:0}
function cents(v){const n=Number(v??0);return Number.isFinite(n)?Math.round(n*100):0}
function sumServices(services){return (Array.isArray(services)?services:[]).reduce((total,service)=>total+(Array.isArray(service?.values)?service.values:[]).reduce((sum,value)=>sum+(Number(value)||0),0),0)}
function date(v){const s=clean(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:""}
function dateOrNull(v){return date(v)||null}
