export type PromotionKind = "genius"|"mobile"|"country"|"getaway"|"early_year"|"basic"|"last_minute"|"early_booker"|"limited_time";
export type PromotionInput = { kind: PromotionKind; label: string; percent: number; enabled: boolean };
export type PromotionScenario = { promotions: PromotionInput[]; guestPrice: number; effectiveDiscount: number; hotelPayout: number };

const campaigns = new Set<PromotionKind>(["getaway","early_year"]);
const standardDeals = new Set<PromotionKind>(["basic","last_minute","early_booker"]);

export function promotionsCanStack(items: PromotionInput[]) {
  const kinds = new Set(items.map(item => item.kind));
  if (items.length > 3) return false;
  if (kinds.has("mobile") && kinds.has("country")) return false;
  if ((kinds.has("mobile") || kinds.has("country")) && ([...campaigns].some(kind => kinds.has(kind)) || kinds.has("limited_time"))) return false;
  if ([...campaigns].some(kind => kinds.has(kind)) && items.some(item => item.kind !== "genius" && !campaigns.has(item.kind))) return false;
  if (kinds.has("limited_time") && items.length > 1) return false;
  if ([...standardDeals].filter(kind => kinds.has(kind)).length > 1) return false;
  if ([...campaigns].filter(kind => kinds.has(kind)).length > 1) return false;
  return true;
}

export function calculatePromotionScenarios(rackRate: number, commissionPercent: number, promotions: PromotionInput[]) {
  const active = promotions.filter(item => item.enabled && item.percent > 0);
  const scenarios: PromotionScenario[] = [];
  for (let mask = 0; mask < (1 << active.length); mask += 1) {
    const selected = active.filter((_, index) => Boolean(mask & (1 << index)));
    if (!promotionsCanStack(selected)) continue;
    const guestPrice = selected.reduce((price, promotion) => price * (1 - promotion.percent / 100), rackRate);
    scenarios.push({ promotions: selected, guestPrice, effectiveDiscount: rackRate > 0 ? (1 - guestPrice / rackRate) * 100 : 0, hotelPayout: guestPrice * (1 - Math.max(0, commissionPercent) / 100) });
  }
  return scenarios.sort((a, b) => a.guestPrice - b.guestPrice);
}
