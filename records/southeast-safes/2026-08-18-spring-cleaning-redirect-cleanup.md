# Southeast Safes — Spring Cleaning Redirect Cleanup

Date opened: 2026-08-18
Status: Open — Verification / Cleanup Required
Source: Kristy Schirmer email, subject `SPRING CLEANING REDIRECTED -`, received 2026-08-07

## Signal
Kristy flagged the Spring Cleaning sale redirect behavior for review.

Known redirect path from prior review:

`/s/spring-sale` → `/pages/spring-cleaning-sale` → `/pages/safe-deals`

The current destination is the Safe Deals page.

## Why This Matters
The redirect chain is functional, but it creates an unnecessary intermediate hop. GCM's redirect standard is to point retired or replaced URLs directly to the current destination and avoid redirect chains when the final destination is known.

## Related References
Older GCM/A1 page code still contains direct links to:

`https://sesafes.com/pages/spring-cleaning-sale`

Those references should be reviewed and updated to the current Safe Deals destination where appropriate rather than relying on the redirect.

## Work Required
1. Verify the live redirect behavior before making changes.
2. Identify the current canonical Safe Deals URL.
3. Change the old Spring Cleaning redirect so legacy URLs resolve directly to the current Safe Deals page with no unnecessary intermediate hop.
4. Review known GCM-controlled references to the old Spring Cleaning URL and update them directly where appropriate.
5. Test each affected URL after deployment.
6. Record the final redirect path and proof of successful resolution.

## Ownership
GCM owns the SEO/redirect review and verification.
Kristy's original email is the triggering communication/evidence.

## Proof Standard
Do not close this record until:
- the legacy URL resolves directly to the intended current destination;
- no unintended redirect chain remains for the reviewed path;
- any GCM-controlled old references identified during the work are updated or explicitly documented as intentionally retained;
- live testing confirms the final behavior.

## Current State
This record documents the work before implementation so the cleanup is traceable from signal → work → result/proof. No completion is claimed yet.
