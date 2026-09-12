import { BOARD, GROUPS, GROUP_TILES, MAX_LEVEL, OWNABLE_IDS, POWER_MULT, UPLINK_RENT } from './board';
import type { GameState, GroupId, OwnableTile, Tile } from './types';

export const tileAt = (id: number): Tile => BOARD[id];

export function isOwnable(t: Tile): t is OwnableTile {
  return t.kind === 'rack' || t.kind === 'uplink' || t.kind === 'power';
}

export function priceOf(id: number): number {
  const t = tileAt(id);
  return isOwnable(t) ? t.price : 0;
}

export function nodeCostOf(id: number): number {
  const t = tileAt(id);
  return t.kind === 'rack' ? GROUPS[t.group].nodeCost : 0;
}

export function tilesOwnedBy(s: GameState, player: number): number[] {
  return OWNABLE_IDS.filter((id) => s.own[id]?.owner === player);
}

export function ownsWholeGroup(s: GameState, player: number, group: GroupId): boolean {
  return GROUP_TILES[group].every((id) => s.own[id]?.owner === player);
}

/** Czy w grupie są ulepszenia rozłożone równomiernie (można budować na tym polu). */
export function canBuild(s: GameState, player: number, id: number): boolean {
  const t = tileAt(id);
  if (t.kind !== 'rack') return false;
  const o = s.own[id];
  if (!o || o.owner !== player || o.mortgaged) return false;
  if (o.level >= MAX_LEVEL) return false;
  if (!ownsWholeGroup(s, player, t.group)) return false;
  // żadne pole grupy nie może być zahipotekowane
  if (GROUP_TILES[t.group].some((g) => s.own[g].mortgaged)) return false;
  // budowa równomierna: nie wolno wyprzedzić najsłabszego pola w grupie o więcej niż 1
  const min = Math.min(...GROUP_TILES[t.group].map((g) => s.own[g].level));
  return o.level === min;
}

export function canSell(s: GameState, player: number, id: number): boolean {
  const t = tileAt(id);
  if (t.kind !== 'rack') return false;
  const o = s.own[id];
  if (!o || o.owner !== player || o.level === 0) return false;
  const max = Math.max(...GROUP_TILES[t.group].map((g) => s.own[g].level));
  return o.level === max;
}

export function canMortgage(s: GameState, player: number, id: number): boolean {
  const o = s.own[id];
  if (!o || o.owner !== player || o.mortgaged) return false;
  const t = tileAt(id);
  // nie można zahipotekować pola w grupie, w której stoją ulepszenia
  if (t.kind === 'rack' && GROUP_TILES[t.group].some((g) => s.own[g].level > 0)) return false;
  return true;
}

export const mortgageValue = (id: number) => Math.floor(priceOf(id) / 2);
/** Wykup hipoteki kosztuje 10% więcej niż otrzymana kwota. */
export const unmortgageCost = (id: number) => Math.ceil(mortgageValue(id) * 1.1);

export function rentFor(s: GameState, tileId: number, diceSum: number): number {
  const t = tileAt(tileId);
  const o = s.own[tileId];
  if (!o || o.owner === null || o.mortgaged) return 0;

  if (t.kind === 'rack') {
    if (o.level > 0) return t.rent[o.level];
    // goła szafa w komplecie grupy = podwójny czynsz bazowy
    return ownsWholeGroup(s, o.owner, t.group) ? t.rent[0] * 2 : t.rent[0];
  }
  if (t.kind === 'uplink') {
    const n = BOARD.filter((x) => x.kind === 'uplink' && s.own[x.id].owner === o.owner && !s.own[x.id].mortgaged).length;
    return UPLINK_RENT[n] ?? 0;
  }
  if (t.kind === 'power') {
    const n = BOARD.filter((x) => x.kind === 'power' && s.own[x.id].owner === o.owner && !s.own[x.id].mortgaged).length;
    return diceSum * (POWER_MULT[n] ?? 0);
  }
  return 0;
}

/** Wartość likwidacyjna: ile gracz może realnie zebrać sprzedając wszystko. */
export function liquidValue(s: GameState, player: number): number {
  let sum = s.players[player].cash;
  for (const id of tilesOwnedBy(s, player)) {
    const o = s.own[id];
    if (!o.mortgaged) sum += mortgageValue(id);
    sum += Math.floor((o.level * nodeCostOf(id)) / 2);
  }
  return sum;
}

/** Majątek netto - kryterium zwycięstwa w trybie krótkim. */
export function netWorth(s: GameState, player: number): number {
  let sum = s.players[player].cash;
  for (const id of tilesOwnedBy(s, player)) {
    const o = s.own[id];
    // pole zahipotekowane jest warte tyle, ile zostanie po wykupieniu hipoteki
    sum += o.mortgaged ? priceOf(id) - unmortgageCost(id) : priceOf(id);
    sum += o.level * nodeCostOf(id);
  }
  return sum;
}

export function standings(s: GameState): { player: number; worth: number }[] {
  return s.players
    .map((p) => ({ player: p.id, worth: p.alive ? netWorth(s, p.id) : -1 }))
    .sort((a, b) => b.worth - a.worth);
}

export function activePlayers(s: GameState): number[] {
  return s.players.filter((p) => p.alive).map((p) => p.id);
}
