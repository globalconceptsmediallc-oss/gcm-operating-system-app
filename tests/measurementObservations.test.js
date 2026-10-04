/* =========================================================
   Global Concepts Media Operating System
   File: tests/measurementObservations.test.js
   Version: 1.0.0
   Status: Production Regression Test
   Purpose: Lock the D1 campaign measurement observation read/write contract,
            schedule ownership validation, and duplicate protection.
   ========================================================= */

import assert from "node:assert/strict";
import {
  handleMeasurementObservations,
  MEASUREMENT_OBSERVATIONS_VERSION
} from "../routes/measurementObservations.js";

assert.equal(MEASUREMENT_OBSERVATIONS_VERSION,"1.0.0");

function observationRow(){
  return {
    id:41,
    client_id:1,
    client_code:"SES",
    client_name:"Southeast Safes",
    schedule_item_id:77,
    schedule_source_key:"manual:ses:q4-social-impact-2026",
    schedule_title:"SES Q4 2026 Social Impact Test",
    schedule_start_date:"2026-10-01",
    schedule_end_date:"2026-12-31",
    observation_key:"ga4:sessions:2026-10-01:2026-10-07",
    period_start:"2026-10-01",
    period_end:"2026-10-07",
    measurement_phase:"campaign",
    source_system:"GA4",
    channel:"Website",
    metric_key:"sessions",
    metric_value:123,
    metric_unit:"count",
    attribution_method:"platform_reported",
    source_reference:"GA4 weekly report",
    notes:"Observed website sessions for the campaign period.",
    captured_at:"2026-10-08 12:00:00",
    created_by:"Andy",
    created_at:"2026-10-08 12:00:00",
    updated_at:"2026-10-08 12:00:00"
  };
}

function mockDb({duplicate=false,scheduleClientId=1}={}){
  const state={writes:0};
  return {
    state,
    prepare(sql){
      const query={
        args:[],
        bind(...args){query.args=args;return query;},
        async all(){
          if(/FROM schedule_items\s+WHERE id = \?/i.test(sql)){
            return {results:[{
              id:77,
              client_id:scheduleClientId,
              source_key:"manual:ses:q4-social-impact-2026",
              title:"SES Q4 2026 Social Impact Test",
              start_date:"2026-10-01",
              end_date:"2026-12-31",
              archived_at:null
            }]};
          }
          if(/SELECT id\s+FROM measurement_observations/i.test(sql)){
            return {results:duplicate?[{id:41}]:[]};
          }
          if(/WHERE mo\.id = \?/i.test(sql)){
            return {results:[observationRow()]};
          }
          if(/FROM measurement_observations mo/i.test(sql)){
            return {results:[observationRow()]};
          }
          throw new Error(`Unexpected Measurement SQL: ${sql}`);
        },
        async run(){
          if(!/INSERT INTO measurement_observations/i.test(sql)){
            throw new Error(`Unexpected Measurement write: ${sql}`);
          }
          state.writes+=1;
          return {meta:{changes:1,last_row_id:41}};
        }
      };
      return query;
    }
  };
}

{
  const DB=mockDb();
  const response=await handleMeasurementObservations(
    {operation:"list",clientId:1,scheduleItemId:77},
    {DB},
    "measurement-list-test"
  );
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.ok,true);
  assert.equal(payload.measurementObservationsVersion,"1.0.0");
  assert.equal(payload.observations.length,1);
  assert.equal(payload.observations[0].scheduleTitle,"SES Q4 2026 Social Impact Test");
  assert.equal(payload.observations[0].metricKey,"sessions");
  assert.equal(payload.writesPerformed,0);
  assert.equal(DB.state.writes,0);
}

{
  const DB=mockDb();
  const response=await handleMeasurementObservations({
    operation:"create",
    observation:{
      clientId:1,
      scheduleItemId:77,
      observationKey:"ga4:sessions:2026-10-01:2026-10-07",
      periodStart:"2026-10-01",
      periodEnd:"2026-10-07",
      measurementPhase:"campaign",
      sourceSystem:"GA4",
      channel:"Website",
      metricKey:"sessions",
      metricValue:123,
      metricUnit:"count",
      attributionMethod:"platform_reported",
      sourceReference:"GA4 weekly report",
      notes:"Observed website sessions for the campaign period.",
      createdBy:"Andy"
    }
  },{DB},"measurement-create-test");
  assert.equal(response.status,201);
  const payload=await response.json();
  assert.equal(payload.ok,true);
  assert.equal(payload.observation.id,41);
  assert.equal(payload.observation.metricValue,123);
  assert.equal(payload.scheduleItem.id,77);
  assert.equal(payload.writesPerformed,1);
  assert.equal(DB.state.writes,1);
}

{
  const DB=mockDb({duplicate:true});
  const response=await handleMeasurementObservations({
    operation:"create",
    clientId:1,
    scheduleItemId:77,
    observationKey:"ga4:sessions:2026-10-01:2026-10-07",
    periodStart:"2026-10-01",
    periodEnd:"2026-10-07",
    measurementPhase:"campaign",
    sourceSystem:"GA4",
    metricKey:"sessions",
    metricValue:123,
    metricUnit:"count",
    attributionMethod:"platform_reported"
  },{DB},"measurement-duplicate-test");
  assert.equal(response.status,409);
  const payload=await response.json();
  assert.equal(payload.duplicate,true);
  assert.equal(payload.existingObservationId,41);
  assert.equal(payload.writesPerformed,0);
  assert.equal(DB.state.writes,0);
}

{
  const DB=mockDb({scheduleClientId:2});
  const response=await handleMeasurementObservations({
    operation:"create",
    clientId:1,
    scheduleItemId:77,
    observationKey:"ga4:sessions:mismatch",
    periodStart:"2026-10-01",
    periodEnd:"2026-10-07",
    measurementPhase:"campaign",
    sourceSystem:"GA4",
    metricKey:"sessions",
    metricValue:123,
    attributionMethod:"platform_reported"
  },{DB},"measurement-client-mismatch-test");
  assert.equal(response.status,400);
  const payload=await response.json();
  assert.match(payload.error,/does not belong to client 1/);
  assert.equal(DB.state.writes,0);
}

console.log("PASS Measurement Observations D1 read/write, schedule ownership, and duplicate protection");
