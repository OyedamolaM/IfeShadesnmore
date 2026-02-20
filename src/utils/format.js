export function toPrice(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "$0";
  return `$${amount.toFixed(0)}`;
}
