import { BLACKOUT_FEE, GROUP_TILES, MAX_LEVEL } from './board';
import { nextBid } from './engine';
import {
  canBuild, canMortgage, canSell, liquidValue, mortgageValue, netWorth, nodeCostOf,
  ownsWholeGroup, priceOf, tileAt, tilesOwnedBy,
} from './selectors';
import type { Action, GameState, GroupId, TradeOffer } from './types';

/** Ile gotówki bot chce trzymać w rezerwie na czynsze. */
function reserve(s: GameState): number {
  const progress = s.mode === 'short' ? s.round / s.maxRounds : Math.min(1, s.round / 30);
  return Math.round(120 + 380 * progress);
}

/** Ilu graczy (poza botem) jest blisko skompletowania grupy tego pola. */
function blocksOpponent(s: GameState, me: number, tileId: number): boolean {
  const t = tileAt(tileId);
  if (t.kind !== 'rack') return false;
  const ids = GROUP_TILES[t.group];
  for (const p of s.players) {
    if (!p.alive || p.id === me) continue;
    const theirs = ids.filter((id) => s.own[id].owner === p.id).length;
    if (theirs === ids.length - 1) return true;
  }
  return false;
}

function completesGroup(s: GameState, me: number, tileId: number): boolean {
  const t = tileAt(tileId);
  if (t.kind !== 'rack') return false;
  const ids = GROUP_TILES[t.group];
  return ids.filter((id) => s.own[id].owner === me).length === ids.length - 1;
}

/** Subiektywna wartość pola dla bota, w PLN. */
export function valuate(s: GameState, me: number, tileId: number): number {
  const t = tileAt(tileId);
  let v = priceOf(tileId);
  if (t.kind === 'uplink') {
    const owned = tilesOwnedBy(s, me).filter((id) => tileAt(id).kind === 'uplink').length;
    v *= 1 + owned * 0.35;
  } else if (t.kind === 'power') {
    const owned = tilesOwnedBy(s, me).filter((id) => tileAt(id).kind === 'power').length;
    v *= 1 + owned * 0.3;
  } else if (t.kind === 'rack') {
    if (completesGroup(s, me, tileId)) v *= 1.8;
    else if (blocksOpponent(s, me, tileId)) v *= 1.45;
    const mine = GROUP_TILES[t.group].filter((id) => s.own[id].owner === me).length;
    v *= 1 + mine * 0.12;
  }
  return Math.round(v);
}

/** Najlepsza inwestycja w rozbudowę, albo null. */
function bestBuild(s: GameState, me: number): number | null {
  const cash = s.players[me].cash;
  const candidates = tilesOwnedBy(s, me).filter((id) => canBuild(s, me, id));
  let best: number | null = null;
  let bestScore = 0;
  for (const id of candidates) {
    const cost = nodeCostOf(id);
    if (cash - cost < reserve(s)) continue;
    const t = tileAt(id);
    if (t.kind !== 'rack') continue;
    const lvl = s.own[id].level;
    const gain = t.rent[lvl + 1] - (lvl === 0 ? t.rent[0] * 2 : t.rent[lvl]);
    const score = gain / cost;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}

/** Kolejność wyprzedaży przy długu: najpierw najmniej wartościowe aktywa. */
function raiseCashAction(s: GameState, me: number): Action | null {
  const sells = tilesOwnedBy(s, me)
    .filter((id) => canSell(s, me, id))
    .sort((a, b) => nodeCostOf(a) - nodeCostOf(b));
  const keepGroups = new Set<GroupId>();
  for (const id of tilesOwnedBy(s, me)) {
    const t = tileAt(id);
    if (t.kind === 'rack' && ownsWholeGroup(s, me, t.group) && s.own[id].level > 0) keepGroups.add(t.group);
  }
  const mortgages = tilesOwnedBy(s, me)
    .filter((id) => canMortgage(s, me, id))
    .sort((a, b) => {
      const ta = tileAt(a), tb = tileAt(b);
      const pa = ta.kind === 'rack' && keepGroups.has(ta.group) ? 1 : 0;
      const pb = tb.kind === 'rack' && keepGroups.has(tb.group) ? 1 : 0;
      if (pa !== pb) return pa - pb;
      return mortgageValue(a) - mortgageValue(b);
    });

  if (mortgages.length) return { t: 'MORTGAGE', tile: mortgages[0] };
  if (sells.length) return { t: 'SELL', tile: sells[0] };
  return null;
}

export function botAction(s: GameState): Action | null {
  if (s.over) return null;

  if (s.phase === 'auction' && s.auction) {
    const bidder = s.auction.inRace[s.auction.turnIdx];
    if (!s.players[bidder]?.isBot) return null;
    const value = valuate(s, bidder, s.auction.tileId);
    const cap = Math.min(value, Math.max(0, s.players[bidder].cash - Math.floor(reserve(s) / 2)));
    if (s.auction.highBidder === bidder) return { t: 'PASS_BID' };
    return nextBid(s.auction.tileId, s.auction.price) <= cap ? { t: 'BID' } : { t: 'PASS_BID' };
  }

  const me = s.current;
  const p = s.players[me];
  if (!p.isBot) return null;

  switch (s.phase) {
    case 'card':
      return { t: 'ACK_CARD' };

    case 'roll': {
      if (p.blackout > 0) {
        if (p.generators > 0) return { t: 'USE_GENERATOR' };
        const lateGame = s.mode === 'short' && s.round > s.maxRounds - 6;
        if (p.cash > reserve(s) + BLACKOUT_FEE && !lateGame) return { t: 'PAY_BLACKOUT' };
      }
      return { t: 'ROLL' };
    }

    case 'buy': {
      const tileId = p.pos;
      const price = priceOf(tileId);
      const value = valuate(s, me, tileId);
      const after = p.cash - price;
      if (value >= price && after >= reserve(s)) return { t: 'BUY' };
      // bardzo atrakcyjne pole - bot schodzi poniżej rezerwy
      if (value >= price * 1.5 && after >= 0) return { t: 'BUY' };
      return { t: 'DECLINE' };
    }

    case 'debt': {
      const debt = s.debt!;
      if (liquidValue(s, debt.player) < debt.amount) return { t: 'BANKRUPT' };
      const act = raiseCashAction(s, debt.player);
      return act ?? { t: 'BANKRUPT' };
    }

    case 'end': {
      const trade = findBotTrade(s, me);
      if (trade !== null && s.players[trade.to].isBot) return { t: 'TRADE', offer: trade };
      const build = bestBuild(s, me);
      if (build !== null) return { t: 'BUILD', tile: build };
      const redeem = tilesOwnedBy(s, me).find((id) => {
        const o = s.own[id];
        return o.mortgaged && p.cash - Math.ceil(mortgageValue(id) * 1.1) > reserve(s) * 1.5;
      });
      if (redeem !== undefined) return { t: 'UNMORTGAGE', tile: redeem };
      return { t: 'END_TURN' };
    }

    default:
      return null;
  }
}

/** Czy bot przyjmie ofertę wymiany? Porównuje wartość subiektywną obu stron oferty. */
export function botAcceptsTrade(s: GameState, offer: TradeOffer): boolean {
  const bot = offer.to;
  if (!s.players[bot]?.isBot) return false;
  const gains = offer.giveTiles.reduce((sum, id) => sum + valuate(s, bot, id), 0) + offer.giveCash;
  const loses = offer.wantTiles.reduce((sum, id) => sum + valuate(s, bot, id), 0) + offer.wantCash;
  if (s.players[bot].cash - offer.wantCash < reserve(s) / 2) return false;
  // bot nie oddaje pola, które kończy komuś grupę, bez wyraźnej premii
  const givesAwayKeystone = offer.wantTiles.some((id) => blocksOpponent(s, bot, id) || completesGroup(s, offer.from, id));
  const threshold = givesAwayKeystone ? 1.6 : 1.12;
  return gains >= loses * threshold;
}

export function botSummary(s: GameState, me: number): string {
  const worth = netWorth(s, me);
  const nodes = tilesOwnedBy(s, me).reduce((n, id) => n + (s.own[id].level === MAX_LEVEL ? 0 : s.own[id].level), 0);
  return `${worth} PLN / ${nodes} serwerów`;
}

/** Czy pole należy do grupy, którą bot ma już w komplecie (nie oddajemy takich). */
function isKeystone(s: GameState, me: number, tileId: number): boolean {
  const t = tileAt(tileId);
  if (t.kind !== 'rack') return false;
  return ownsWholeGroup(s, me, t.group);
}

/**
 * Szuka wymiany kompletującej botowi grupę. Bez tego mechanizmu grupy nie domykają się
 * w ogóle, nikt nie buduje i partia grzęźnie w pat ekonomiczny.
 */
export function findBotTrade(s: GameState, me: number): TradeOffer | null {
  if (!s.players[me]?.isBot || s.tradesThisTurn > 0) return null;
  const myCash = s.players[me].cash;

  const candidates: { offer: TradeOffer; cost: number }[] = [];

  for (const group of Object.keys(GROUP_TILES) as GroupId[]) {
    const ids = GROUP_TILES[group];
    const mine = ids.filter((id) => s.own[id].owner === me);
    if (mine.length !== ids.length - 1) continue;

    const missing = ids.find((id) => s.own[id].owner !== me);
    if (missing === undefined) continue;
    const owner = s.own[missing].owner;
    if (owner === null || owner === me || !s.players[owner].alive) continue;
    if (s.own[missing].level > 0) continue;

    const price = priceOf(missing);
    const maxCash = Math.min(myCash - Math.floor(reserve(s) / 2), Math.round(price * 2.5));
    if (maxCash < Math.round(price * 0.6)) continue;

    const sweeteners = tilesOwnedBy(s, me).filter(
      (id) => !ids.includes(id) && s.own[id].level === 0 && !s.own[id].mortgaged && !isKeystone(s, me, id),
    );

    const cashSteps: number[] = [];
    for (let c = Math.round(price * 0.6); c <= maxCash; c += Math.max(20, Math.round(price * 0.2))) {
      cashSteps.push(Math.round(c / 10) * 10);
    }

    const push = (giveTiles: number[], giveCash: number) => {
      if (giveCash > myCash) return;
      const offer: TradeOffer = { from: me, to: owner, giveTiles, giveCash, wantTiles: [missing], wantCash: 0 };
      const cost = giveCash + giveTiles.reduce((sum, id) => sum + valuate(s, me, id), 0);
      candidates.push({ offer, cost });
    };

    for (const c of cashSteps) push([], c);
    for (const sw of sweeteners) {
      for (const c of cashSteps.slice(0, 3)) push([sw], Math.round(c / 2 / 10) * 10);
    }
  }

  candidates.sort((a, b) => a.cost - b.cost);
  for (const c of candidates) {
    const other = s.players[c.offer.to];
    // wobec bota sprawdzamy jego realną decyzję; wobec człowieka - czy oferta jest uczciwa
    const ok = other.isBot
      ? botAcceptsTrade(s, c.offer)
      : c.cost >= valuate(s, c.offer.to, c.offer.wantTiles[0]) * 1.2;
    if (ok) return c.offer;
  }
  return null;
}
