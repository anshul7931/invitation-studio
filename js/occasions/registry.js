import { birthday } from "./birthday.js";
import { engagement } from "./engagement.js";
import { office } from "./office.js";

export const occasionRegistry = new Map(
  [birthday, engagement, office].map((occasion) => [occasion.id, occasion])
);

export function getOccasion(id) {
  const occasion = occasionRegistry.get(id);
  if (!occasion) throw new Error(`Unknown occasion: ${id}`);
  return occasion;
}
