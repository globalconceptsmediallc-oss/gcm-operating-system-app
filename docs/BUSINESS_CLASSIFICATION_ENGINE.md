# GCM OS BUSINESS CLASSIFICATION ENGINE

**Document Version:** 1.0  
**Status:** Active Development  
**Last Updated:** 2026-07-12

---

# Purpose

The Business Classification Engine determines what type of business GCM OS is evaluating and the observable stage of its growth maturity before recommendations are generated.

The engine exists to ensure that consulting recommendations match the business.

A startup, a single-location local business, a regional multi-location company, and a mature market leader should not receive the same recommendations.

The Business Classification Engine provides the consulting context required by the Growth Intelligence Engine.

---

# Core Principle

## Diagnose Before Recommending

GCM OS must understand the observable business before deciding what the business should do next.

The classification process occurs after the Business Record is created and before Growth Intelligence is generated.

```text
Evidence Sources
        ↓
Capability Engines
        ↓
Business Record Builder
        ↓
Business Record
        ↓
Business Classification Engine
        ↓
Growth Intelligence Engine
        ↓
Consulting Knowledge Engine
        ↓
Growth Review Generator
        ↓
Presentation Engine
        ↓
Client Deliverable
