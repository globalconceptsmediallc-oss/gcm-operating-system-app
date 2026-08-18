# Pickett Weaponry — Canonical Investigation and Repair

**Record Date:** 2026-08-18  
**Client:** Pickett Weaponry  
**Website:** https://pickettweaponry.com/  
**Record Type:** Signal → Investigation → Work → Result / Proof  
**Status:** **RESOLVED / PROVEN**

---

## Signal

A REPORTS-SEO alert from Ahrefs reported:

- **61 non-canonical pages in sitemap**
- Site Audit Health Score: **74**
- Related crawl findings also showed one 3XX redirect in sitemap, 17 redirects, and 7 redirect chains.

The issue was not accepted as work solely from the alert. It was investigated against the live site before action.

---

## Initial Ahrefs Evidence

The 2026-08-17 Ahrefs export contained **61 sitemap URLs** reported as non-canonical.

Observed pattern:

- All affected URLs returned HTTP 200.
- All were included in a sitemap.
- Ahrefs reported their canonical as the site homepage: `https://pickettweaponry.com/`.
- Affected URLs included real pages such as About Us, Services, Contact Us, Class 3 Items, Virtual Tour, testimonials, gallery items, gallery categories, and course URLs.

Initial interpretation: possible sitewide canonical configuration failure.

---

## Live Verification Changed the Diagnosis

A live source check of the About Us page showed the correct self-referencing canonical:

`https://pickettweaponry.com/about-us-pickett-weaponry/`

This proved the 61-page Ahrefs condition was at least partly stale relative to the live site.

A new Ahrefs crawl was run on 2026-08-18.

### Fresh Crawl Result

The issue dropped from **61 URLs to 1 URL**.

Ahrefs showed the prior 61 URLs as no longer matching the issue filter.

The one remaining issue was the homepage.

---

## Remaining Homepage Canonical Failure

Ahrefs reported:

- URL: `https://pickettweaponry.com/`
- HTTP status: 200
- In sitemap: Yes
- Canonical URL: `https://pickettweaponry.com/?p=2665`
- Canonical target status: 404

Live page source confirmed the homepage was actually outputting:

`<link rel="canonical" href="https://pickettweaponry.com/?p=2665" />`

This was therefore a real current issue, not stale Ahrefs data.

---

## Normal WordPress / Yoast Checks

The following were inspected and ruled out:

1. **Yoast page-level Canonical URL**
   - Initially blank.
   - Manual homepage canonical was later set to `https://pickettweaponry.com/` for testing.
   - The live source still output `?p=2665`, proving something else was overriding Yoast.

2. **WPCode canonical snippets**
   - `Homepage Canonical` — inactive.
   - `Canonical Tags (Sitewide)` — inactive.

3. **WordPress Permalinks**
   - Correctly set to **Post name**.

4. **WordPress Reading Settings**
   - A static page is selected.
   - Homepage = **Home**.
   - Posts page = **Blog**.
   - Search engine visibility is not blocked.

5. **WordPress page permalink**
   - WordPress itself links the Home page to `https://pickettweaponry.com/`.

6. **The7 theme files**
   - `header.php`: no canonical override.
   - `header-main.php`: no canonical override.
   - `functions.php`: no `canonical` or `rel_canonical` match.
   - `header-single.php`: contains normal `wp_head()` call; no direct canonical code.

7. **WPCode Global Header & Footer**
   - Header, Body, and Footer fields were empty.

8. **The7 Custom JavaScript**
   - Empty.

9. **Caching**
   - GoDaddy cache was flushed.
   - Private-browser source still showed `?p=2665`.
   - Cache was ruled out as the cause.

---

## Diagnostic Proof

A temporary WPCode diagnostic was used to inspect WordPress's own canonical calculation.

It reported:

- `front_id=363`
- `queried_id=363`
- `permalink=https://pickettweaponry.com/`
- `core_canonical=https://pickettweaponry.com/`

This proved:

- WordPress knew the correct homepage.
- WordPress core calculated the correct canonical.
- The bad `?p=2665` canonical was being injected separately.

A second diagnostic checked record ID 2665 and found:

- `ID2665_type=revision`
- `ID2665_status=inherit`
- `ID2665_title=Home`

Therefore `2665` was an old **revision of the Home page**, not the actual homepage.

---

## Root Cause

A callback audit of `wp_head` identified:

`seo_setup_output_mu_plugins_canonical_tag`

from:

`wp-content/mu-plugins/seo-canonical-deactivation.php`

The WordPress **Must-Use** plugins screen confirmed the file exists.

The file was read using a temporary diagnostic snippet because GoDaddy File Manager was not available in the admin Quick Links.

The MU-plugin contained:

`add_filter( 'wpseo_canonical', '__return_false' );`

This disabled Yoast's canonical output sitewide.

It then registered its own output:

`add_action( 'wp_head', 'seo_setup_output_mu_plugins_canonical_tag', 1 );`

The custom function used:

`$post_id = get_the_ID();`

and then either `_seo_setup_canonical_url` post meta or:

`get_permalink( $post_id )`

before echoing its own canonical tag.

On the homepage, this legacy MU-plugin was resolving to revision ID **2665**, which generated:

`https://pickettweaponry.com/?p=2665`

### Root Cause Statement

A legacy Must-Use SEO canonical plugin disabled Yoast canonical output and substituted custom canonical logic based on `get_the_ID()`. On the static front page, that logic resolved to an old Home revision (ID 2665) instead of the real front-page object (ID 363), producing a canonical URL that returned 404.

---

## Production Fix

Because the MU-plugin file could not be directly edited through available WordPress file-management access, a reversible WPCode production fix was deployed:

**Snippet name:** `GCM Restore Yoast Canonicals`

```php
/**
 * GCM Restore Yoast Canonicals
 * Removes the legacy MU-plugin canonical override
 * and returns canonical control to Yoast SEO.
 */

remove_action(
    'wp_head',
    'seo_setup_output_mu_plugins_canonical_tag',
    1
);

remove_filter(
    'wpseo_canonical',
    '__return_false'
);
```

Configuration:

- Type: PHP
- Insertion: Auto Insert
- Location: Run Everywhere
- Status: Active

The legacy MU-plugin remains physically present but its canonical output is neutralized by the active WPCode fix.

---

## Live Proof After Fix

After activation, live homepage source showed Yoast outputting:

`<link rel="canonical" href="https://pickettweaponry.com/" class="yoast-seo-meta-tag" />`

A source search for:

`?p=2665`

returned:

**Not found**

### Live Proof Status

- Correct homepage canonical visible live: **PASS**
- Bad revision canonical absent from live source: **PASS**
- WordPress core canonical calculation: **PASS**
- Yoast canonical control restored: **PASS**

---

## Final Ahrefs Verification — 2026-08-18

A fresh Ahrefs Site Audit was run after the production fix.

### Final Crawl Results

- **Health Score: 92** — up from 74 at the original alert
- **Errors: 19** — down from 62 at the earlier crawl
- **Warnings: 157**
- **Notices: 22**
- **URLs without errors: 223**
- **URLs with errors: 19**

Most importantly, the Ahrefs **All issues** screen no longer listed **Non-canonical page in sitemap** as a current issue.

The fresh crawl also showed **Canonical URL changed** with a large downward change, consistent with the canonical cleanup being recognized by Ahrefs.

### Final Proof Status

- Live source correct: **PASS**
- Bad `?p=2665` canonical absent: **PASS**
- Fresh Ahrefs crawl completed after fix: **PASS**
- `Non-canonical page in sitemap` absent from current Ahrefs All Issues: **PASS**
- Site Health improved from 74 to 92: **PASS**

**Final disposition: RESOLVED / PROVEN.**

The original REPORTS-SEO alert can be treated as processed and closed. No new Pickett canonical Work Item is required.

---

## Related Observations — Not Part of This Fix

### Homepage Safe Positioning

The homepage gives safes only secondary prominence compared with firearms/suppressors.

Observed:

- Navigation includes Safes.
- Homepage contains a Gun Safes block.
- SEO title and meta description are focused primarily on suppressors/accessories.
- The homepage does not position gun safes as a major business category despite the business selling recognized safe brands.

**Disposition:** Deferred content/SEO opportunity. Do not mix into canonical repair.

### Image Optimization

The crawl showed multiple JPEG images over 250 KB, with a cluster of older files in `/wp-content/uploads/2016/01/`.

**Disposition:** Deferred. Higher-impact Pickett technical issues take priority. Do not mass-convert images without page/use impact review.

---

## Operating-System Lessons

1. **Alert is a signal, not proof of work.**
   - Ahrefs initially reported 61 URLs.
   - Live verification proved most of that condition had already changed.

2. **Fresh crawl before broad remediation.**
   - A new crawl reduced the real issue from 61 URLs to one homepage URL.

3. **Live source is final technical proof.**
   - The one remaining homepage canonical was verified in live source before work began.

4. **Do not patch the symptom before finding the owner of the output.**
   - Yoast, permalinks, Reading settings, theme files, WPCode, and cache were checked before changing production behavior.

5. **Diagnostic instrumentation can isolate hidden WordPress behavior.**
   - WordPress core was proven correct.
   - Record 2665 was identified as a revision.
   - `wp_head` callback inspection identified the exact MU-plugin callback and file.

6. **Must-Use plugins must be included in WordPress investigations.**
   - They do not appear in the normal Active Plugins list and cannot be deactivated normally.

7. **Canonical ownership should be singular.**
   - With Yoast active, legacy custom canonical systems should not independently disable and replace Yoast without a documented reason.

8. **Fix → Build → Deploy → Test → Proof.**
   - The fix was not considered complete at live-source proof alone.
   - The final Ahrefs recrawl was required to prove that the originating monitoring system also cleared the issue.

9. **Do not create unnecessary work from neighboring issues.**
   - Image optimization and homepage safe positioning were observed but deliberately deferred because they were not part of the canonical failure.

---

## Closure

This canonical investigation is closed as **Resolved / Proven**.

Do not reopen the original 61-page canonical remediation path unless fresh crawl evidence shows the problem has returned.
