/** pt-PT number formatting (decimal comma). */
export const fmt = (n: number, digits = 2) => n.toFixed(digits).replace('.', ',');

export const fmtInt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${fmt(bytes / 1024, 1)} KB`;
  return `${fmt(bytes / (1024 * 1024), 1)} MB`;
}
