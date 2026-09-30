/** Recolors linked vector artwork using the invitation's own palette tokens. */
const sourceCache = new Map();
const themedAssetCache = new Map();

// Only assets listed here inherit the invitation palette. Keep bouquets and
// other artwork out of this set to preserve their designed colours.
const THEME_ADAPTED_ASSETS = new Set([
  "couple1.svg",
  "couple2.svg",
  "cradle1.svg",
  "ganesha1.svg",
  "ganesha2.svg"
]);

function parseColor(value) {
  const hex = String(value || "").trim().match(/^#([\da-f]{3,8})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map((digit) => digit + digit).join("");
    if (digits.length !== 6 && digits.length !== 8) return null;
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) : 255
    };
  }
  const rgb = String(value || "").match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] ? Math.round(+rgb[4] * 255) : 255 };
  return null;
}

function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const delta = max - min; const lightness = (max + min) / 2;
  let hue = 0; let saturation = 0;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: saturation, l: lightness };
}

function fromHsl({ h, s, l }, alpha = 255) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = h / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const [r, g, b] = section < 1 ? [chroma, x, 0]
    : section < 2 ? [x, chroma, 0]
      : section < 3 ? [0, chroma, x]
        : section < 4 ? [0, x, chroma]
          : section < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const m = l - chroma / 2;
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}${alpha < 255 ? alpha.toString(16).padStart(2, "0") : ""}`;
}

function blend(first, second, amount) {
  const a = parseColor(first); const b = parseColor(second);
  if (!a || !b) return first;
  return fromHsl(toHsl({
    r: Math.round(a.r * (1 - amount) + b.r * amount),
    g: Math.round(a.g * (1 - amount) + b.g * amount),
    b: Math.round(a.b * (1 - amount) + b.b * amount)
  }));
}

function paletteFor(card) {
  const css = getComputedStyle(card);
  const token = (...names) => {
    for (const name of names) {
      const value = css.getPropertyValue(name).trim();
      if (value && parseColor(value)) return value;
    }
    return "#8a263d";
  };
  const main = token("--occasion-main", "--maroon");
  const accent = token("--occasion-accent", "--gold");
  return {
    dark: token("--occasion-dark", "--maroon-deep"),
    main,
    accent,
    soft: token("--occasion-soft", "--blush"),
    leaf: blend(main, accent, 0.24)
  };
}

function recolor(source, palette) {
  const roles = Object.fromEntries(Object.entries(palette).map(([key, value]) => [key, parseColor(value)]));
  const convert = (match) => {
    const original = parseColor(match);
    if (!original) return match;
    const { h, s, l } = toHsl(original);
    let role;
    if (s < 0.14) role = l > 0.82 ? "soft" : l < 0.2 ? "dark" : "main";
    else if (h >= 24 && h <= 64) role = "accent";
    else if (h >= 68 && h <= 175) role = "leaf";
    else role = l > 0.84 ? "soft" : l < 0.28 ? "dark" : "main";
    const target = roles[role] || roles.main;
    const targetHsl = toHsl(target);
    targetHsl.l = Math.max(0.12, Math.min(0.94, targetHsl.l + (l - 0.5) * 0.34));
    return fromHsl(targetHsl, original.a);
  };
  let output = source.replace(/#[\da-f]{3,8}\b/gi, convert);
  output = output.replace(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/gi, convert);
  const main = palette.main;
  output = output.replace(/<svg\b([^>]*)>/i, (tag, attributes) =>
    /\bcolor\s*=/.test(attributes) ? tag : `<svg${attributes} color="${main}">`);
  return output;
}

async function loadSvg(source) {
  if (!sourceCache.has(source)) {
    sourceCache.set(source, fetch(source).then((response) => {
      if (!response.ok) throw new Error(`Unable to load invitation artwork (${response.status})`);
      return response.text();
    }));
  }
  return sourceCache.get(source);
}

async function themeImage(image, palette, themeKey) {
  const currentSrc = image.getAttribute("src");
  const source = currentSrc && !currentSrc.startsWith("blob:")
    ? currentSrc
    : image.dataset.originalSvg || currentSrc;
  if (!source || !source.toLowerCase().includes(".svg")) return;
  image.dataset.originalSvg = source;
  const filename = new URL(source, window.location.href).pathname.split("/").pop().toLowerCase();
  if (!THEME_ADAPTED_ASSETS.has(filename)) {
    image.src = image.dataset.originalSvg;
    delete image.dataset.svgThemeKey;
    return;
  }
  image.dataset.svgThemeKey = themeKey;
  const cacheKey = `${source}|${themeKey}`;
  try {
    if (!themedAssetCache.has(cacheKey)) {
      const xml = await loadSvg(source);
      const blob = new Blob([recolor(xml, palette)], { type: "image/svg+xml" });
      themedAssetCache.set(cacheKey, URL.createObjectURL(blob));
    }
    if (image.dataset.svgThemeKey === themeKey) image.src = themedAssetCache.get(cacheKey);
  } catch (error) {
    console.warn("Invitation artwork kept its original colours:", error.message);
  }
}

export function applyInvitationSvgTheme(card) {
  if (!card) return;
  const palette = paletteFor(card);
  const themeKey = Object.values(palette).join("|");
  card.querySelectorAll("img.motif-img, #ganeshaReferenceSvg, #coupleReferenceSvg")
    .forEach((image) => { void themeImage(image, palette, themeKey); });
}
