/* =========================================================
   Global Concepts Media Operating System
   File: routes/commercePerformance.js
   Version: 1.0.0
   Status: Production Candidate — Client Commerce Evidence
   Purpose:
   Read durable client-level commerce performance snapshots for Growth Reviews
   and Proof without tying business outcomes to a campaign Schedule item.

   Rules:
   - Read-only route.
   - Platform-reported facts only.
   - No causal interpretation.
   - Session/conversion caveats are preserved from the source snapshot.
   ========================================================= */

import { getDatabase, rowsOf } from "../shared/database.js";
import { clean, jsonResponse, logWorkerError, safeErrorMessage } from "../shared/http.js";

export const COMMERCE_PERFORMANCE_ACTION = "commerce-performance";
export const COMMERCE_PERFORMANCE_VERSION = "1.0.0";

export async function handleCommercePerformance(body, env, requestId) {
  const db = getDatabase(env);
  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok:false,
      requestId,
      action:COMMERCE_PERFORMANCE_ACTION,
      commercePerformanceVersion:COMMERCE_PERFORMANCE_VERSION,
      error:"The production D1 database binding is unavailable."
    },503);
  }

  const operation = clean(body?.operation || "list").toLowerCase();
  if (operation !== "list") {
    return jsonResponse({
      ok:false,
      requestId,
      action:COMMERCE_PERFORMANCE_ACTION,
      commercePerformanceVersion:COMMERCE_PERFORMANCE_VERSION,
      error:"Commerce Performance is read-only. Supported operation: list.",
      writesPerformed:0
    },400);
  }

  try {
    const clientId = positive(body?.clientId);
    const clientCode = clean(body?.clientCode || body?.client).toLowerCase() || null;
    const limit = normalizeLimit(body?.limit);

    const rows = rowsOf(await db.prepare(`
      SELECT cp.*, c.client_code, c.name AS client_name
      FROM client_commerce_performance cp
      JOIN clients c ON c.id = cp.client_id
      WHERE (? IS NULL OR cp.client_id = ?)
        AND (? IS NULL OR lower(c.client_code) = ?)
      ORDER BY cp.period_end DESC, cp.period_start DESC, cp.id DESC
      LIMIT ?
    `).bind(
      clientId,clientId,
      clientCode,clientCode,
      limit
    ).all()).map(normalizeRow);

    return jsonResponse({
      ok:true,
      requestId,
      action:COMMERCE_PERFORMANCE_ACTION,
      operation:"list",
      commercePerformanceVersion:COMMERCE_PERFORMANCE_VERSION,
      snapshots:rows,
      writesPerformed:0
    });
  } catch (error) {
    logWorkerError({
      requestId,
      route:COMMERCE_PERFORMANCE_ACTION,
      stage:"commerce_performance_list",
      error
    });

    return jsonResponse({
      ok:false,
      requestId,
      action:COMMERCE_PERFORMANCE_ACTION,
      commercePerformanceVersion:COMMERCE_PERFORMANCE_VERSION,
      error:"Commerce Performance could not complete the request.",
      details:safeErrorMessage(error),
      writesPerformed:0
    },500);
  }
}

function normalizeRow(row) {
  return {
    id:Number(row.id),
    clientId:Number(row.client_id),
    clientCode:clean(row.client_code),
    clientName:clean(row.client_name),
    sourceSystem:clean(row.source_system),
    periodStart:clean(row.period_start),
    periodEnd:clean(row.period_end),
    comparisonStart:clean(row.comparison_start),
    comparisonEnd:clean(row.comparison_end),
    currency:clean(row.currency),
    grossSales:numberOrNull(row.gross_sales),
    discounts:numberOrNull(row.discounts),
    salesReversals:numberOrNull(row.sales_reversals),
    netSales:numberOrNull(row.net_sales),
    shippingCharges:numberOrNull(row.shipping_charges),
    returnFees:numberOrNull(row.return_fees),
    taxes:numberOrNull(row.taxes),
    totalSales:numberOrNull(row.total_sales),
    orders:numberOrNull(row.orders),
    ordersFulfilled:numberOrNull(row.orders_fulfilled),
    averageOrderValue:numberOrNull(row.average_order_value),
    returningCustomerRate:numberOrNull(row.returning_customer_rate),
    sessions:numberOrNull(row.sessions),
    conversionRate:numberOrNull(row.conversion_rate),
    addedToCartCount:numberOrNull(row.added_to_cart_count),
    addedToCartRate:numberOrNull(row.added_to_cart_rate),
    reachedCheckoutCount:numberOrNull(row.reached_checkout_count),
    reachedCheckoutRate:numberOrNull(row.reached_checkout_rate),
    completedCheckoutCount:numberOrNull(row.completed_checkout_count),
    completedCheckoutRate:numberOrNull(row.completed_checkout_rate),
    grossSalesChangePct:numberOrNull(row.gross_sales_change_pct),
    totalSalesChangePct:numberOrNull(row.total_sales_change_pct),
    ordersChangePct:numberOrNull(row.orders_change_pct),
    ordersFulfilledChangePct:numberOrNull(row.orders_fulfilled_change_pct),
    averageOrderValueChangePct:numberOrNull(row.average_order_value_change_pct),
    sessionsChangePct:numberOrNull(row.sessions_change_pct),
    conversionRateChangePct:numberOrNull(row.conversion_rate_change_pct),
    addedToCartChangePct:numberOrNull(row.added_to_cart_change_pct),
    reachedCheckoutChangePct:numberOrNull(row.reached_checkout_change_pct),
    completedCheckoutChangePct:numberOrNull(row.completed_checkout_change_pct),
    sourceReference:nullable(row.source_reference),
    dataCaveat:nullable(row.data_caveat),
    notes:nullable(row.notes),
    capturedAt:clean(row.captured_at),
    createdBy:clean(row.created_by)
  };
}

function positive(value) {
  const n=Number(value);
  return Number.isInteger(n)&&n>0?n:null;
}
function normalizeLimit(value) {
  const n=Number(value);
  if(!Number.isInteger(n)||n<1)return 25;
  return Math.min(n,100);
}
function numberOrNull(value) {
  if(value===null||value===undefined||value==="")return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function nullable(value) {
  const v=clean(value);
  return v||null;
}
