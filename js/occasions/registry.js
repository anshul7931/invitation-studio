/**
 * Frontend registry for non-wedding card types.
 * Wedding uses a bespoke stationery layout, while these modules share the
 * generic occasion form/card renderer.
 */
import { birthday } from "./birthday.js";
import { engagement } from "./engagement.js";
import { office } from "./office.js";
import { custom } from "./custom.js";

export const occasionRegistry = new Map(
  [birthday, engagement, office, custom].map((occasion) => [occasion.id, occasion])
);

export function getOccasion(id) {
  const occasion = occasionRegistry.get(id);
  if (!occasion) throw new Error(`Unknown occasion: ${id}`);
  return occasion;
}
