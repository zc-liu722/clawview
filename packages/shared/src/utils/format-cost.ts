function isValidCost(
  costCents: number | null | undefined,
): costCents is number {
  return typeof costCents === "number" && Number.isFinite(costCents);
}

export function formatCostFromCents(
  costCents: number | null | undefined,
): string {
  if (!isValidCost(costCents)) {
    return "¥--";
  }

  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(costCents / 100);
}

export function formatCostFromCentsCompact(
  costCents: number | null | undefined,
): string {
  if (!isValidCost(costCents)) {
    return "¥--";
  }

  const absoluteValue = Math.abs(costCents);
  // Keep fractional-cent values visible in compact cards instead of rounding
  // them down to ¥0.00.
  const fractionDigits =
    absoluteValue === 0
      ? 2
      : absoluteValue >= 10_000
        ? 0
        : absoluteValue >= 1
          ? 2
          : 4;

  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(costCents / 100);
}
