/**
 * Plan catalog and price helpers for dummy checkout.
 */
const periods = {
  monthly: { label: "Monthly", months: 1, days: 30, singleMultiplier: 1, multiPaidCards: 9 },
  quarterly: { label: "Quarterly", months: 3, days: 90, singleMultiplier: 2.5, multiPaidCards: 8 },
  halfyearly: { label: "Half Yearly", months: 6, days: 180, singleMultiplier: 5, multiPaidCards: 7 },
  yearly: { label: "Yearly", months: 12, days: 365, singleMultiplier: 9, multiPaidCards: 6 }
};

const plans = {
  single_basic: { id: "single_basic", title: "Single Card Basic Plan", creditType: "BASIC", cardType: "basic", credits: 1, basePrice: 149, multi: false },
  single_premium: { id: "single_premium", title: "Single Card Premium Plan", creditType: "PREMIUM", cardType: "premium", credits: 1, basePrice: 249, multi: false },
  multi_basic: { id: "multi_basic", title: "Multi-Card Basic Plan", creditType: "BASIC", cardType: "basic", credits: 10, basePrice: 149, multi: true },
  multi_premium: { id: "multi_premium", title: "Multi-Card Premium Plan", creditType: "PREMIUM", cardType: "premium", credits: 10, basePrice: 249, multi: true }
};

function priceFor(planId, periodId) {
  const plan = plans[planId];
  const period = periods[periodId];
  if (!plan || !period) return null;
  const actual = plan.basePrice * plan.credits * period.months;
  const price = plan.multi
    ? plan.basePrice * period.multiPaidCards * period.singleMultiplier
    : plan.basePrice * period.singleMultiplier;
  const discount = actual > price ? Math.round((1 - price / actual) * 100) : 0;
  return { actual: Math.round(actual), price: Math.round(price), discount };
}

function catalogDto() {
  return {
    periods,
    plans: Object.values(plans).map((plan) => ({
      ...plan,
      prices: Object.fromEntries(Object.keys(periods).map((periodId) => [periodId, priceFor(plan.id, periodId)]))
    }))
  };
}

module.exports = { catalogDto, periods, plans, priceFor };
