/* =========================================================
 Global Concepts Media Operating System
 File: tests/growthReviewAssembly.test.js
 Version: 1.0.0
 Purpose: Lock exact-period SES preview, approval freshness,
          Shopify deduplication, and non-generating read-only assembly.
 ========================================================= */
import assert from "node:assert/strict";
import {assembleGrowthPreview,validPeriod,GROWTH_ASSEMBLY_VERSION} from "../growth-review-assembly-core.js";
assert.equal(GROWTH_ASSEMBLY_VERSION,"1.0.0");
function fixture(){
 return {
  period:{start:"2026-09-01",end:"2026-09-30",type:"custom"},
  workspace:{record:{
    metadata:{clientId:11,clientCode:"SES"},
    business:{name:"Southeast Safes",website:"https://sesafes.com"},
    currentPriorities:[{title:"Validate Merchant Center"}],
    workQueue:[],workspace:{currentPriority:"Shopify integration",nextAction:"Confirm account structure"}
  },operational:{
    client:{id:11,client_code:"SES"},
    workItems:[
      {id:25,status:"completed",title:"Completed ad asset",completed_at:"2026-09-18"},
      {id:26,status:"open",title:"Unfinished",created_at:"2026-09-11"}
    ],
    proofOfWork:[
      {id:40,status:"completed",title:"Social production",date:"2026-09-19",work_item_id:25},
      {id:41,status:"completed",title:"Completed SEO update",date:"2026-09-20"},
      {id:42,status:"completed",title:"Ranking alert",date:"2026-09-17"},
      {id:43,status:"completed",title:"October activity",date:"2026-10-02"}
    ]
  }},
  findings:[
    {id:2,source_date:"2026-09-09",source_title:"September Merchant Center alert",analysis:"Merchant Center issue"},
    {id:3,source_date:"2026-10-09",source_title:"October follow-up"},
    {id:4,source_title:"Undated historical alert"}
  ],
  measurements:[
    {sourceSystem:"Shopify Analytics",metricKey:"orders",periodEnd:"2026-09-30",metricValue:1},
    {sourceSystem:"GA4",metricKey:"sessions",periodEnd:"2026-09-30",metricValue:100},
    {sourceSystem:"GSC",metricKey:"clicks",periodEnd:"2026-10-03",metricValue:500}
  ],
  mediaRecords:[{id:1,clientId:11,creativeName:"Radio Spot",startDate:"2026-09-01",endDate:"2026-09-30",market:"Orlando"}],
  creativeWorkflow:{creatives:[{id:1,clientId:11,creativeName:"Radio Spot"}],assignments:[
    {id:40,clientId:11,creativeId:1,market:"Orlando",rotationStartDate:"2026-09-01",rotationEndDate:"2026-09-30"},
    {id:41,clientId:12,creativeId:1,market:"Different",rotationStartDate:"2026-09-01",rotationEndDate:"2026-09-30"}
  ]},
  commerceSnapshots:[{
    clientId:11,clientCode:"SES",id:7,periodStart:"2026-09-01",periodEnd:"2026-09-30",
    comparisonStart:"2026-08-02",comparisonEnd:"2026-08-31",
    sourceReference:"Connected Shopify Analytics, exact September",
    totalSales:2749,orders:1,sessions:5518,conversionRate:0.018123,
    dataCaveat:"Sep 21 session definition changed"
  },{
    clientId:11,clientCode:"SES",id:8,periodStart:"2026-07-12",periodEnd:"2026-10-09",totalSales:11524.73
  },{
    clientId:12,clientCode:"NFS",id:9,periodStart:"2026-09-01",periodEnd:"2026-09-30",totalSales:99999
  }],
  interpretationClientCode:"SES",interpretationPeriodStart:"2026-09-01",interpretationPeriodEnd:"2026-09-30",
  interpretationItems:[{
    selectionId:52,recordType:"investigation",recordId:46,clientCode:"SES",periodStart:"2026-09-01",periodEnd:"2026-09-30",
    eligibleForReview:true,sourceChanged:false,effectiveStatus:"approved",
    operationalRecord:{title:"Merchant Center issue",status:"open"},
    interpretation:{
      reviewStatus:"approved",approvedAt:"2026-10-11 13:13:14",approvedBy:"Andy",
      verifiedFacts:"September alert and 56 listings compared with hundreds on Shopify",
      evidenceReferences:"Investigation #46 / September source Finding",
      growthImplications:"Catalog mismatch may constrain shopping visibility; impact unmeasured.",
      recommendedAction:"Confirm Google account structure.",
      clientNarrative:"Potential visibility issue requiring correction; no revenue loss established.",
      caveats:"October is follow-up context, not September facts."
    }
  }]
 };
}
{
 const view=assembleGrowthPreview(fixture());
 assert.equal(view.reviewReady,true);
 assert.equal(view.previewOnly,true);
 assert.equal(view.generatorLocked,true);
 assert.equal(view.writesPerformed,0);
 assert.equal(view.interpretation.approved.length,1);
 assert.equal(view.interpretation.approved[0].recordId,46);
 assert.equal(view.commerce.totalSales,2749);
 assert.equal(view.overlappingCommerceCount,1);
 assert.equal(view.context.sourceDatedFindings.length,1);
 assert.equal(view.context.measurements.length,1);
 assert.equal(view.context.excludedShopifyDuplicates,1);
 assert.equal(view.context.completedWork.length,2);
 assert.equal(view.context.media.length,1);
 assert.match(view.notes.join(" "),/Sep 21/);
 assert.equal(view.context.outcomes.length,0);
}
{
 const x=fixture();x.interpretationItems[0].sourceChanged=true;
 const view=assembleGrowthPreview(x);
 assert.equal(view.reviewReady,false);
 assert.equal(view.interpretation.approved.length,0);
 assert.equal(view.interpretation.held.length,1);
}
{
 const x=fixture();x.interpretationItems[0].effectiveStatus="draft";
 const view=assembleGrowthPreview(x);
 assert.equal(view.interpretation.approved.length,0);
 assert.equal(view.reviewReady,false);
}
{
 const x=fixture();x.interpretationItems=[];
 const view=assembleGrowthPreview(x);
 assert.equal(view.reviewReady,false);
 assert.match(view.problems.join(" "),/No issue is explicitly included/);
}
{
 const x=fixture();x.commerceSnapshots=x.commerceSnapshots.filter(c=>c.id!==7);
 const view=assembleGrowthPreview(x);
 assert.equal(view.commerce,null);
 assert.equal(view.reviewReady,false);
 assert.match(view.problems.join(" "),/No exact-period Shopify/);
}
{
 const x=fixture();x.commerceSnapshots.push({...x.commerceSnapshots[0],id:42});
 const view=assembleGrowthPreview(x);
 assert.equal(view.commerce,null);
 assert.equal(view.reviewReady,false);
 assert.match(view.problems.join(" "),/Multiple exact-period/);
}
{
 const x=fixture();x.workspace.record.metadata.clientCode="NFS";
 assert.throws(()=>assembleGrowthPreview(x),/identity/);
}
{
 const x=fixture();x.interpretationPeriodStart="2026-10-01";
 assert.throws(()=>assembleGrowthPreview(x),/does not match/);
}
assert.equal(validPeriod("2026-09-01","2026-09-30"),true);
assert.equal(validPeriod("2026-09-31","2026-10-01"),false);
console.log("PASS Growth Assembly Preview: SES boundary, exact commerce, approved interpretation, date limits, deduplication, no writes");
