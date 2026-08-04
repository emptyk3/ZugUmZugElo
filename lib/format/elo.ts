const integer = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 0 });

export function formatElo(value: number) {
  return integer.format(Math.round(value));
}

export function formatEloChange(value: number) {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${integer.format(rounded)}`;
  if (rounded < 0) return `−${integer.format(Math.abs(rounded))}`;
  return integer.format(0);
}
