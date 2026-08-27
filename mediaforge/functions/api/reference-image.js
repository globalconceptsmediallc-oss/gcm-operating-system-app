/* =========================================================
MediaForge
File: functions/api/reference-image.js
Version: 1.0.0
Status: Production Road Test
Source: Global Concepts Media LLC
Purpose: Fetch approved Shopify catalog reference images through
         the MediaForge origin so browser canvas comparison works
         without cross-origin/CORS failures.
========================================================= */

const ALLOWED_HOSTS = new Set([
  "cdn.shopify.com",
  "libertysafe.com",
  "www.libertysafe.com",
  "sesafes.com",
  "www.sesafes.com"
]);

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const rawUrl = requestUrl.searchParams.get("url");

  if (!rawUrl) {
    return jsonError("Missing required url parameter.");
  }

  let sourceUrl;
  try {
    sourceUrl = new URL(rawUrl);
  } catch {
    return jsonError("The supplied reference image URL is invalid.");
  }

  if (sourceUrl.protocol !== "https:") {
    return jsonError("Only HTTPS reference images are allowed.");
  }

  if (!ALLOWED_HOSTS.has(sourceUrl.hostname.toLowerCase())) {
    return jsonError("Reference image host is not approved.", 403);
  }

  let upstream;
  try {
    upstream = await fetch(sourceUrl.toString(), {
      headers: {
        "accept": "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        "user-agent": "MediaForge-Reference-Image-Proxy/1.0"
      },
      cf: {
        cacheEverything: true,
        cacheTtl: 86400
      }
    });
  } catch (error) {
    return jsonError(`Reference image request failed: ${error.message}`, 502);
  }

  if (!upstream.ok) {
    return jsonError(
      `Reference image returned HTTP ${upstream.status}.`,
      502
    );
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return jsonError("The requested resource is not an image.", 415);
  }

  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("cache-control", "public, max-age=86400, s-maxage=86400");
  headers.set("access-control-allow-origin", "*");
  headers.set("x-content-type-options", "nosniff");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    headers.set("content-length", contentLength);
  }

  return new Response(upstream.body, {
    status: 200,
    headers
  });
}