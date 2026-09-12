/** Polska liczba mnoga: 1 pole, 2-4 pola, 5+ pól (z wyjątkiem 12-14). */
export function plural(n: number, forms: [string, string, string]): string {
  const [one, few, many] = forms;
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const rest = abs % 100;
  if (rest >= 12 && rest <= 14) return many;
  const last = abs % 10;
  return last >= 2 && last <= 4 ? few : many;
}

export const POLA: [string, string, string] = ['pole', 'pola', 'pól'];
export const RUNDY: [string, string, string] = ['runda', 'rundy', 'rund'];
export const TURY: [string, string, string] = ['turę', 'tury', 'tur'];
export const SERWERY: [string, string, string] = ['serwer', 'serwery', 'serwerów'];
export const SZAFY: [string, string, string] = ['szafę', 'szafy', 'szaf'];
