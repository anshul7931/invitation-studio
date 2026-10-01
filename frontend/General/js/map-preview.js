const mapHosts = /(^|\.)google\.(com|co\.[a-z]{2}|[a-z]{2})$|(^|\.)maps\.app\.goo\.gl$|(^|\.)goo\.gl$/i;

export function googleMapEmbedUrl(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { return ""; }
  if (!/^https?:$/.test(url.protocol) || !mapHosts.test(url.hostname)) return "";
  if (/\/maps\/embed\//i.test(url.pathname)) return url.href;

  const placePath = url.pathname.match(/\/(?:maps\/)?(?:place|search)\/([^/@]+)/i)?.[1];
  let place = "";
  try { place = placePath ? decodeURIComponent(placePath.replace(/\+/g, " ")) : ""; } catch { /* Invalid escapes fall back to the map URL query. */ }
  const coordinates = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const query = url.searchParams.get("q") || url.searchParams.get("query") ||
    url.searchParams.get("destination") || url.searchParams.get("daddr") ||
    place ||
    (coordinates ? `${coordinates[1]},${coordinates[2]}` : "");
  if (!query) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function renderVenueMap(container, frame, link, title = "Venue") {
  const url = String(link || "").trim();
  const valid = /^https?:\/\//i.test(url);
  container.hidden = !valid;
  if (!valid) {
    frame.replaceChildren();
    return;
  }
  const directions = container.querySelector(".venue-directions");
  directions.href = url;
  frame.classList.remove("map-placeholder");
  frame.removeAttribute("aria-label");
  const embedUrl = googleMapEmbedUrl(url);
  frame.replaceChildren();
  if (embedUrl) {
    const map = document.createElement("iframe");
    map.title = `Map showing ${title}`;
    map.src = embedUrl;
    map.loading = "lazy";
    map.referrerPolicy = "no-referrer-when-downgrade";
    map.allowFullscreen = true;
    map.setAttribute("aria-label", `Map showing ${title}`);
    frame.append(map);
    return;
  }

  frame.classList.add("map-placeholder");
  frame.setAttribute("aria-label", `Map preview for ${title}; use the directions link to open the map`);
  frame.innerHTML = `<svg viewBox="0 0 640 220" role="img" aria-hidden="true"><path d="M-10 170C110 130 130 220 250 180S420 105 650 145M-10 60C120 110 180 15 310 62S490 135 650 72M120 -10C160 70 90 110 150 230M400 -10C350 48 450 96 390 230M535 -10C495 40 570 92 520 230"/><path class="map-route" d="M80 180C165 145 220 195 315 135S445 95 555 98"/><g class="map-pin" transform="translate(320 105)"><path d="M0 48S-28 15-28-2a28 28 0 1 1 56 0C28 15 0 48 0 48Z"/><circle cy="-3" r="9"/></g></svg>`;
}
