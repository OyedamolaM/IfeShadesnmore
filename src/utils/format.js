const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});

export function toPrice(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return NGN_FORMATTER.format(0);
  return NGN_FORMATTER.format(amount);
}
