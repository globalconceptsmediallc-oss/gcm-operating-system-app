/* =========================================================
   MediaForge
   File: functions/api/catalog.js
   Version: 1.8.0
   Status: SES Product Catalog Import Road Test
   Source: Production Development
   Purpose: Import the Liberty Premium Home product catalog from
            Southeast Safes and convert it into Kristy's canonical
            63-slot MediaForge reference catalog.
   Route: GET /api/catalog
   ========================================================= */

const PRODUCT_HANDLE = "liberty-safe-premium-home-series";
const PRODUCT_URL =
  `https://sesafes.com/products/${PRODUCT_HANDLE}`;
const PRODUCT_JSON_URL =
  `${PRODUCT_URL}.js`;

const SIZES = ["08", "12", "17"];

/*
  Kristy's approved universal order.

  Southeast Safes currently uses "Black Gloss" on the product page.
  Kristy's production naming convention uses "Black Mirror Gloss".
  The catalog importer therefore treats those labels as aliases while
  preserving Kristy's final filename vocabulary.
*/
const CANONICAL_VARIANTS = [
  {
    position: 1,
    canonical_label: "White Marble-Black Chrome",
    site_labels: ["White Marble-Black Chrome"],
    color: "White",
    finish: "Marble",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 2,
    canonical_label: "Champagne Marble-Black Chrome",
    site_labels: ["Champagne Marble-Black Chrome"],
    color: "Champagne",
    finish: "Marble",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 3,
    canonical_label: "Gray Marble-Black Chrome",
    site_labels: ["Gray Marble-Black Chrome"],
    color: "Gray",
    finish: "Marble",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 4,
    canonical_label: "Burgundy Marble-Black Chrome",
    site_labels: ["Burgundy Marble-Black Chrome"],
    color: "Burgundy",
    finish: "Marble",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 5,
    canonical_label: "Green Marble-Black Chrome",
    site_labels: ["Green Marble-Black Chrome"],
    color: "Green",
    finish: "Marble",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 6,
    canonical_label: "White Gloss-Black Chrome",
    site_labels: ["White Gloss-Black Chrome"],
    color: "White",
    finish: "Gloss",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 7,
    canonical_label: "Champagne Gloss-Black Chrome",
    site_labels: ["Champagne Gloss-Black Chrome"],
    color: "Champagne",
    finish: "Gloss",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 8,
    canonical_label: "Gray Gloss-Black Chrome",
    site_labels: ["Gray Gloss-Black Chrome"],
    color: "Gray",
    finish: "Gloss",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 9,
    canonical_label: "Bronze Gloss-Black Chrome",
    site_labels: ["Bronze Gloss-Black Chrome"],
    color: "Bronze",
    finish: "Gloss",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 10,
    canonical_label: "Forest Mist Gloss-Black Chrome",
    site_labels: ["Forest Mist Gloss-Black Chrome"],
    color: "Forest Mist",
    finish: "Gloss",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 11,
    canonical_label: "Green Gloss-Black Chrome",
    site_labels: ["Green Gloss-Black Chrome"],
    color: "Green",
    finish: "Gloss",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 12,
    canonical_label: "Burgundy Gloss-Black Chrome",
    site_labels: ["Burgundy Gloss-Black Chrome"],
    color: "Burgundy",
    finish: "Gloss",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 13,
    canonical_label: "Black Cherry Gloss-Black Chrome",
    site_labels: ["Black Cherry Gloss-Black Chrome"],
    color: "Black Cherry",
    finish: "Gloss",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 14,
    canonical_label: "Black Mirror Gloss-Black Chrome",
    site_labels: [
      "Black Mirror Gloss-Black Chrome",
      "Black Gloss-Black Chrome"
    ],
    color: "Black Mirror",
    finish: "Gloss",
    hardware: "Black Chrome",
    hardware_code: "bc"
  },
  {
    position: 15,
    canonical_label: "Burgundy Marble-Brass",
    site_labels: ["Burgundy Marble-Brass"],
    color: "Burgundy",
    finish: "Marble",
    hardware: "Brass",
    hardware_code: "brass"
  },
  {
    position: 16,
    canonical_label: "Green Marble-Brass",
    site_labels: ["Green Marble-Brass"],
    color: "Green",
    finish: "Marble",
    hardware: "Brass",
    hardware_code: "brass"
  },
  {
    position: 17,
    canonical_label: "Green Gloss-Brass",
    site_labels: ["Green Gloss-Brass"],
    color: "Green",
    finish: "Gloss",
    hardware: "Brass",
    hardware_code: "brass"
  },
  {
    position: 18,
    canonical_label: "Burgundy Gloss-Brass",
    site_labels: ["Burgundy Gloss-Brass"],
    color: "Burgundy",
    finish: "Gloss",
    hardware: "Brass",
    hardware_code: "brass"
  },
  {
    position: 19,
    canonical_label: "Black Mirror Gloss-Brass",
    site_labels: [
      "Black Mirror Gloss-Brass",
      "Black Gloss-Brass"
    ],
    color: "Black Mirror",
    finish: "Gloss",
    hardware: "Brass",
    hardware_code: "brass"
  },
  {
    position: 20,
    canonical_label: "Black Mirror Gloss-Chrome",
    site_labels: [
      "Black Mirror Gloss-Chrome",
      "Black Gloss-Chrome"
    ],
    color: "Black Mirror",
    finish: "Gloss",
    hardware: "Chrome",
    hardware_code: "chrome"
  },
  {
    position: 21,
    canonical_label: "Blue Gloss-Chrome",
    site_labels: ["Blue Gloss-Chrome"],
    color: "Blue",
    finish: "Gloss",
    hardware: "Chrome",
    hardware_code: "chrome"
  }
];

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseSize(optionValue, title) {
  const source = `${optionValue || ""} ${title || ""}`;
  const match = source.match(/\b(08|8|12|17)\b/);
  if (!match) return null;
  return match[1] === "8" ? "08" : match[1];
}

function getVariantOptions(variant) {
  if (Array.isArray(variant.options)) {
    return variant.options.map(normalizeText);
  }

  return [
    variant.option1,
    variant.option2,
    variant.option3
  ]
    .filter(Boolean)
    .map(normalizeText);
}

function getVariantLabel(variant) {
  const options = getVariantOptions(variant);

  if (options.length >= 2) {
    return options.slice(1).join(" / ");
  }

  const title = normalizeText(variant.title);
  const slashIndex = title.indexOf("/");

  if (slashIndex >= 0) {
    return normalizeText(title.slice(slashIndex + 1));
  }

  return title;
}

function findCanonicalVariant(siteLabel) {
  const normalized = normalizeText(siteLabel).toLowerCase();

  return CANONICAL_VARIANTS.find(item =>
    item.site_labels.some(
      label => normalizeText(label).toLowerCase() === normalized
    )
  ) || null;
}

function getImageUrl(variant) {
  const featured = variant.featured_image;

  if (typeof featured === "string") {
    return featured.startsWith("//")
      ? `https:${featured}`
      : featured;
  }

  if (featured && typeof featured === "object") {
    const source =
      featured.src ??
      featured.url ??
      featured.original_src ??
      null;

    if (source) {
      return source.startsWith("//")
        ? `https:${source}`
        : source;
    }
  }

  return null;
}

function buildFilename(size, canonical) {
  return [
    "liberty",
    "premium",
    size,
    canonical.position,
    slug(canonical.color),
    slug(canonical.finish),
    canonical.hardware_code,
    "dorma"
  ].join("-") + ".webp";
}

function buildCatalog(product) {
  const variants = Array.isArray(product.variants)
    ? product.variants
    : [];

  const records = [];
  const ignored = [];
  const unmatched = [];

  for (const variant of variants) {
    const options = getVariantOptions(variant);
    const size = parseSize(options[0], variant.title);
    const siteLabel = getVariantLabel(variant);
    const canonical = findCanonicalVariant(siteLabel);

    if (!size || !SIZES.includes(size)) {
      unmatched.push({
        variant_id: variant.id ?? null,
        title: variant.title ?? null,
        reason: "Size could not be resolved"
      });
      continue;
    }

    if (!canonical) {
      ignored.push({
        variant_id: variant.id ?? null,
        size,
        site_label: siteLabel,
        reason: "Not part of Kristy's canonical 21-position order"
      });
      continue;
    }

    records.push({
      catalog_key: `${size}-${canonical.position}`,
      manufacturer: "Liberty",
      model: "Premium",
      size,
      position: canonical.position,
      site_label: siteLabel,
      canonical_label: canonical.canonical_label,
      color: canonical.color,
      finish: canonical.finish,
      hardware: canonical.hardware,
      hardware_code: canonical.hardware_code,
      lock: "Dorma",
      variant_id: variant.id ?? null,
      sku: variant.sku ?? null,
      available: variant.available ?? null,
      price: variant.price ?? null,
      image_url: getImageUrl(variant),
      product_url: PRODUCT_URL,
      output_filename: buildFilename(size, canonical)
    });
  }

  records.sort((a, b) => {
    const sizeDifference =
      SIZES.indexOf(a.size) - SIZES.indexOf(b.size);

    if (sizeDifference !== 0) return sizeDifference;

    return a.position - b.position;
  });

  return {
    records,
    ignored,
    unmatched
  };
}

async function fetchProduct() {
  const response = await fetch(PRODUCT_JSON_URL, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "MediaForge/1.8.0"
    },
    cf: {
      cacheTtl: 300,
      cacheEverything: true
    }
  });

  if (!response.ok) {
    throw new Error(
      `Southeast Safes returned HTTP ${response.status}.`
    );
  }

  const product = await response.json();

  if (!product || !Array.isArray(product.variants)) {
    throw new Error(
      "The Southeast Safes product response did not contain Shopify variants."
    );
  }

  return product;
}

export async function onRequestGet() {
  try {
    const product = await fetchProduct();
    const catalog = buildCatalog(product);

    const bySize = Object.fromEntries(
      SIZES.map(size => [
        size,
        catalog.records.filter(record => record.size === size).length
      ])
    );

    const missingSlots = [];

    for (const size of SIZES) {
      for (const canonical of CANONICAL_VARIANTS) {
        const exists = catalog.records.some(
          record =>
            record.size === size &&
            record.position === canonical.position
        );

        if (!exists) {
          missingSlots.push({
            size,
            position: canonical.position,
            canonical_label: canonical.canonical_label
          });
        }
      }
    }

    const duplicateSlots = [];
    const seen = new Map();

    for (const record of catalog.records) {
      const count = (seen.get(record.catalog_key) || 0) + 1;
      seen.set(record.catalog_key, count);
    }

    for (const [catalogKey, count] of seen.entries()) {
      if (count > 1) {
        duplicateSlots.push({
          catalog_key: catalogKey,
          count
        });
      }
    }

    const complete =
      catalog.records.length === 63 &&
      missingSlots.length === 0 &&
      duplicateSlots.length === 0;

    return json({
      ok: true,
      version: "1.8.0",
      source: {
        site: "Southeast Safes",
        product_title: product.title ?? "Liberty Safe Premium Home Series",
        product_handle: product.handle ?? PRODUCT_HANDLE,
        product_url: PRODUCT_URL,
        shopify_product_id: product.id ?? null,
        imported_at: new Date().toISOString()
      },
      rules: {
        sizes: SIZES,
        canonical_positions_per_size: 21,
        expected_total: 63,
        black_gloss_alias:
          "Southeast Safes Black Gloss maps to Kristy's Black Mirror Gloss naming.",
        excluded_site_variants:
          "Variants outside Kristy's approved 21-position order are reported but not imported."
      },
      validation: {
        complete,
        imported_total: catalog.records.length,
        by_size: bySize,
        missing_slots: missingSlots,
        duplicate_slots: duplicateSlots,
        ignored_site_variants: catalog.ignored,
        unmatched_site_variants: catalog.unmatched,
        images_present: catalog.records.filter(record => record.image_url).length,
        images_missing: catalog.records.filter(record => !record.image_url).length
      },
      catalog: catalog.records
    });
  } catch (error) {
    console.error("MediaForge catalog import error", error);

    return json({
      ok: false,
      version: "1.8.0",
      error:
        error instanceof Error
          ? error.message
          : "The Southeast Safes catalog import failed."
    }, 500);
  }
}