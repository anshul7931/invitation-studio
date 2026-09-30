/** Central catalog for invitation motifs, previews, and occasion defaults. */
const svg = (content) => `<svg viewBox="0 0 72 72" aria-hidden="true">${content}</svg>`;
const stroke = (content, width = 2.5) => `<g fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${content}</g>`;
const assetUrl = (name) => `/frontend/General/svgs/${name}`;

// Numbered asset files make it easy to add new selectable artwork by category.
export const svgAssetMap = Object.freeze({
  cake1: assetUrl("cake1.svg"), cake2: assetUrl("cake2.svg"),
  ganesha1: assetUrl("ganesha1.svg"), ganesha2: assetUrl("ganesha2.svg"), ganesha3: assetUrl("ganesha3.svg"),
  couple1: assetUrl("couple1.svg"), couple2: assetUrl("couple2.svg"), couple3: assetUrl("couple3.svg"),
  bouquet1: assetUrl("bouquet1.svg"), bouquet2: assetUrl("bouquet2.svg"), bouquet3: assetUrl("bouquet3.svg"),
  wreath1: assetUrl("wreath1.svg"), cradle1: assetUrl("cradle1.svg"), house1: assetUrl("house1.svg"),
  kalash1: assetUrl("kalash1.svg"), lotus1: assetUrl("lotus1.svg"), lotus2: assetUrl("lotus2.svg"),
  rings1: assetUrl("rings1.svg"), rings2: assetUrl("rings2.svg"), rings3: assetUrl("rings3.svg")
});

const imageMarkup = (src) => `<img class="motif-img" src="${src}" alt="">`;
const authoredMotifs = {
  cakeHeritage: { label: "Cake 1", markup: imageMarkup(svgAssetMap.cake1) },
  celebrationWreath: { label: "Wreath 1", markup: imageMarkup(svgAssetMap.wreath1) },
  cradleHeritage: { label: "Cradle 1", markup: imageMarkup(svgAssetMap.cradle1) },
  houseHeritage: { label: "House 1", markup: imageMarkup(svgAssetMap.house1) },
  roseLotus: { label: "Lotus 2", markup: imageMarkup(svgAssetMap.lotus2) },
  peacockRings: { label: "Rings 2", markup: imageMarkup(svgAssetMap.rings2) },
  ganeshaLinework: { label: "Ganesha 2", markup: imageMarkup(svgAssetMap.ganesha2) },
  bouquetHeritage: { label: "Bouquet 2", markup: imageMarkup(svgAssetMap.bouquet2) },
  bouquetBlush: { label: "Bouquet 1", markup: imageMarkup(svgAssetMap.bouquet1) },
  bouquetIndigo: { label: "Bouquet 3", markup: imageMarkup(svgAssetMap.bouquet3) },
  kalashHeritage: { label: "Kalash 1", markup: imageMarkup(svgAssetMap.kalash1) }
};

export const svgCatalog = {
  cake: { label: "Golden cake", markup: svg(stroke('<path d="M14 54H58V64H14ZM20 37H52V54H20ZM27 23H45V37H27Z"/><path d="M36 6Q28 16 36 23Q44 16 36 6Z" fill="var(--occasion-accent)"/><path d="M20 45Q28 39 36 45T52 45"/>')) },
  candle: { label: "Birthday candle", markup: svg(stroke('<path d="M24 31H48V61H24ZM19 61H53"/><path d="M36 8Q27 18 36 25Q45 18 36 8Z" fill="var(--occasion-accent)"/><path d="M36 25V31"/>')) },
  gift: { label: "Ribboned gift", markup: svg(stroke('<path d="M13 31H59V61H13ZM10 24H62V32H10Z"/><path d="M36 24V61M36 24C18 24 16 9 26 10Q34 11 36 24ZM36 24C54 24 56 9 46 10Q38 11 36 24Z" fill="var(--occasion-soft)"/>')) },
  ringsHeritage: { label: "Rings 1", markup: imageMarkup(svgAssetMap.rings1) },
  ringsRef: { label: "Rings 3", markup: imageMarkup(svgAssetMap.rings3) },
  rings: { label: "Intertwined rings", markup: svg(stroke('<circle cx="28" cy="43" r="18"/><circle cx="44" cy="43" r="18"/><path d="M37 18L45 8L53 18L45 28Z" fill="var(--occasion-accent)"/>', 3)) },
  officeTower: { label: "Office tower", markup: svg(stroke('<path d="M11 63H61M18 63V21H54V63M27 29H33M40 29H46M27 39H33M40 39H46M27 49H33M40 49H46"/><path d="M29 21V11H43V21" stroke="var(--occasion-accent)"/>')) },
  envelope: { label: "Invitation seal", markup: svg(stroke('<rect x="13" y="22" width="46" height="32" rx="6"/><path d="M16 27L36 42L56 27M17 50L31 39M55 50L41 39"/><circle cx="36" cy="42" r="4" fill="var(--occasion-accent)"/><path d="M55 13V19M52 16H58M18 12L21 17L26 19L21 21L18 26L15 21L10 19L15 17Z"/>')) },
  lotus: { label: "Lotus bloom", markup: svg(stroke('<path d="M36 51C23 51 15 44 11 35C22 34 31 39 36 51ZM36 51C49 51 57 44 61 35C50 34 41 39 36 51ZM36 50C27 39 28 25 36 14C44 25 45 39 36 50Z" fill="var(--occasion-soft)"/><path d="M17 58H55"/>')) },
  lotusHeritage: { label: "Lotus 1", markup: imageMarkup(svgAssetMap.lotus1) },
  diya: { label: "Auspicious diya", markup: svg(stroke('<path d="M14 43Q36 61 58 43Q47 55 25 55Q17 51 14 43Z"/><path d="M36 13Q25 27 36 36Q47 27 36 13Z" fill="var(--occasion-accent)"/><path d="M24 43H48M20 59H52"/>')) },
  coupleRoyal: { label: "Couple 1", markup: imageMarkup(svgAssetMap.couple1) },
  coupleEmerald: { label: "Couple 2", markup: imageMarkup(svgAssetMap.couple2) },
  coupleRef: { label: "Couple 3", markup: imageMarkup(svgAssetMap.couple3) },
  couple: { label: "Modern couple", markup: svg(stroke('<circle cx="27" cy="22" r="7"/><circle cx="45" cy="22" r="7"/><path d="M20 58Q22 36 27 30Q32 36 34 58ZM38 58Q40 36 45 30Q50 36 52 58Z"/><path d="M22 16L27 10L32 16M40 15L45 9L50 15" fill="var(--occasion-accent)"/>')) },
  bouquet: { label: "Celebration bouquet", markup: svg(stroke('<path d="M24 35Q16 25 24 18Q32 24 30 34M36 33Q32 20 40 14Q47 23 41 35M43 35Q49 24 57 29Q56 39 46 42M25 38L37 62L47 38M30 47H44"/><circle cx="24" cy="18" r="4" fill="var(--occasion-accent)"/><circle cx="40" cy="14" r="4" fill="var(--occasion-accent)"/><circle cx="57" cy="29" r="4" fill="var(--occasion-accent)"/>')) },
  flutes: { label: "Celebration flutes", markup: svg(stroke('<path d="M18 12H34L32 33Q31 40 26 42Q21 40 20 33ZM38 12H54L52 33Q51 40 46 42Q41 40 40 33ZM26 42V60M46 42V60M19 61H33M39 61H53"/><path d="M20 27H33M40 27H53" stroke="var(--occasion-accent)"/>')) },
  kalash: { label: "Kalash 1", markup: imageMarkup(svgAssetMap.kalash1) },
  cradle: { label: "Welcoming cradle", markup: svg(stroke('<path d="M16 30Q36 45 56 30L52 47Q36 57 20 47Z"/><path d="M22 48L17 62M50 48L55 62M15 63H57M23 27V19M36 27V14M49 27V19"/><path d="M36 9V15" stroke="var(--occasion-accent)"/>')) },
  calendar: { label: "Event calendar", markup: svg(stroke('<rect x="13" y="17" width="46" height="44" rx="5"/><path d="M13 29H59M24 11V22M48 11V22M24 39H29M36 39H41M48 39H53M24 49H29M36 49H41"/><path d="M48 49L51 52L57 45" stroke="var(--occasion-accent)"/>')) },
  house: { label: "Housewarming home", markup: svg(stroke('<path d="M9 34L36 12L63 34M16 30V61H56V30M30 61V43H43V61"/><path d="M47 18H55V27" stroke="var(--occasion-accent)"/>')) }
};

Object.assign(svgCatalog, authoredMotifs);
svgCatalog.cakeRef = { label: "Cake 2", markup: imageMarkup(svgAssetMap.cake2) };
svgCatalog.cakeGold = { label: "Golden celebration cake", markup: svgCatalog.cake.markup };
svgCatalog.bouquet = svgCatalog.bouquetHeritage;
svgCatalog.kalash = svgCatalog.kalashHeritage;

export const occasionSvgMap = {
  wedding: { default: "ringsHeritage", options: ["ringsHeritage", "ringsRef", "peacockRings", "rings", "coupleRoyal", "coupleEmerald", "coupleRef", "lotusHeritage", "roseLotus", "lotus", "bouquet", "bouquetBlush", "bouquetIndigo", "diya", "kalash", "envelope"] },
  birthday: { default: "cakeHeritage", options: ["cakeHeritage", "cakeRef", "cakeGold", "candle", "gift", "celebrationWreath", "diya", "envelope"] },
  engagement: { default: "ringsHeritage", options: ["ringsHeritage", "ringsRef", "peacockRings", "rings", "coupleRoyal", "coupleEmerald", "coupleRef", "bouquet", "bouquetBlush", "bouquetIndigo", "flutes", "lotusHeritage", "roseLotus", "diya", "envelope"] },
  office: { default: "celebrationWreath", options: ["celebrationWreath", "officeTower", "calendar", "flutes", "envelope", "lotus"] },
  custom: { default: "lotusHeritage", options: ["lotusHeritage", "roseLotus", "lotus", "diya", "kalash", "cradleHeritage", "houseHeritage", "celebrationWreath", "ringsHeritage", "ringsRef", "peacockRings", "cakeHeritage", "cakeRef", "cakeGold", "bouquet", "bouquetBlush", "bouquetIndigo", "envelope"] }
};

export const weddingIllustrations = {
  ganesha: {
    default: "ganesha-linework",
    options: [
      { value: "ganesh", label: "Ganesha 1", markup: imageMarkup(svgAssetMap.ganesha1) },
      { value: "ganesha-linework", label: "Ganesha 2", markup: imageMarkup(svgAssetMap.ganesha2) },
      { value: "ganesha-3", label: "Ganesha 3", markup: imageMarkup(svgAssetMap.ganesha3) }
    ]
  },
  couple: {
    default: "couple-royal",
    options: [
      { value: "couple-royal", label: "Couple 1", markup: imageMarkup(svgAssetMap.couple1) },
      { value: "couple-emerald", label: "Couple 2", markup: imageMarkup(svgAssetMap.couple2) },
      { value: "couple-ref", label: "Couple 3", markup: imageMarkup(svgAssetMap.couple3) }
    ]
  }
};

export function svgMarkup(key) {
  return svgCatalog[key]?.markup || svgCatalog.envelope.markup;
}

export function occasionSvgOptions(occasion) {
  const mapping = occasionSvgMap[occasion] || occasionSvgMap.custom;
  return mapping.options.map((key) => [key, svgCatalog[key].label]);
}
