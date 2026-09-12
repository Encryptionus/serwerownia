import {
  BLACKOUT_FEE, BLACKOUT_TILE, BLACKOUT_TURNS, BOARD, BOARD_SIZE,
  GROUP_TILES, MAX_LEVEL, OWNABLE_IDS, PASS_START, PLAYER_COLORS, START_CASH,
} from './board';
import { DECKS } from './cards';
import { plural, RUNDY, SERWERY, SZAFY, TURY } from './plural';
import { nextInt, shuffle } from './rng';
import {
  canBuild, canMortgage, canSell, isOwnable, mortgageValue, netWorth, nodeCostOf,
  priceOf, rentFor, tileAt, tilesOwnedBy, unmortgageCost,
} from './selectors';
import type {
  Action, Card, DeckId, GameMode, GameState, LogEntry, Ownership, Player, TradeOffer,
} from './types';

export interface PlayerSeed { name: string; isBot: boolean }

export const DEFAULT_MAX_ROUNDS = 24;
/** Bezpiecznik trybu klasycznego - kiosk nigdy nie może zawisnąć na partii bez końca. */
export const HARD_ROUND_LIMIT = 60;

export function createGame(
  seeds: PlayerSeed[],
  mode: GameMode,
  seed = Date.now(),
  maxRounds = DEFAULT_MAX_ROUNDS,
): GameState {
  const players: Player[] = seeds.map((s, i) => ({
    id: i, name: s.name, isBot: s.isBot, color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    cash: START_CASH, pos: 0, alive: true, blackout: 0, generators: 0, skipNext: false,
  }));

  const own: Record<number, Ownership> = {};
  for (const id of OWNABLE_IDS) own[id] = { owner: null, level: 0, mortgaged: false };

  let rng = seed | 0;
  const mk = (deck: DeckId) => {
    const r = shuffle(DECKS[deck].map((_, i) => i), rng);
    rng = r.state;
    return { order: r.items, ptr: 0 };
  };
  const decks = { incydent: mk('incydent'), budzet: mk('budzet') };

  const s: GameState = {
    players, current: 0, phase: 'roll', own, dice: null, doubles: 0,
    round: 1, maxRounds, mode, rngState: rng,
    decks, drawn: null, auction: null, debt: null,
    log: [], logSeq: 0, over: false, winner: null, lastMoveFrom: null, extraRoll: false,
    tradesThisTurn: 0,
  };
  note(s, null, mode === 'short'
    ? `Tryb krótki: ${maxRounds} ${plural(maxRounds, RUNDY)}, wygrywa największy majątek netto.`
    : 'Tryb klasyczny: gra do ostatniego wypłacalnego gracza.', 'system');
  return s;
}

function draft(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p })),
    own: Object.fromEntries(Object.entries(s.own).map(([k, v]) => [k, { ...v }])),
    log: s.log.slice(),
    decks: { incydent: { ...s.decks.incydent }, budzet: { ...s.decks.budzet } },
    auction: s.auction ? { ...s.auction, inRace: s.auction.inRace.slice() } : null,
    debt: s.debt ? { ...s.debt } : null,
    dice: s.dice ? [s.dice[0], s.dice[1]] : null,
  };
}

function note(d: GameState, player: number | null, text: string, kind: LogEntry['kind'] = 'info') {
  d.logSeq += 1;
  d.log.push({ id: d.logSeq, round: d.round, player, text, kind });
  if (d.log.length > 200) d.log.splice(0, d.log.length - 200);
}

const name = (d: GameState, id: number) => d.players[id].name;

function roll(d: GameState): [number, number] {
  const a = nextInt(d.rngState, 6); d.rngState = a.state;
  const b = nextInt(d.rngState, 6); d.rngState = b.state;
  return [a.value + 1, b.value + 1];
}

function credit(d: GameState, pid: number, amount: number) {
  d.players[pid].cash += amount;
}

function charge(d: GameState, pid: number, to: number | null, amount: number, reason: string): boolean {
  if (amount <= 0) return true;
  const p = d.players[pid];
  if (p.cash >= amount) {
    p.cash -= amount;
    if (to !== null) credit(d, to, amount);
    return true;
  }
  d.debt = { player: pid, to, amount, reason };
  note(d, pid, `${p.name} nie ma czym zapłacić ${amount} PLN (${reason}). Musi zebrać środki.`, 'bad');
  return false;
}

function settleDebt(d: GameState) {
  if (!d.debt) return;
  const { player, to, amount, reason } = d.debt;
  if (d.players[player].cash < amount) return;
  d.players[player].cash -= amount;
  if (to !== null) credit(d, to, amount);
  note(d, player, `${name(d, player)} reguluje zobowiązanie ${amount} PLN (${reason}).`, 'money');
  d.debt = null;
}

function sendToBlackout(d: GameState, pid: number) {
  const p = d.players[pid];
  p.pos = BLACKOUT_TILE;
  p.blackout = BLACKOUT_TURNS;
  d.doubles = 0;
  d.extraRoll = false;
  note(d, pid, `${p.name} trafia do BLACKOUT - infrastruktura offline na ${BLACKOUT_TURNS} ${plural(BLACKOUT_TURNS, TURY)}.`, 'bad');
}

function moveTo(d: GameState, pid: number, target: number, collectStart: boolean) {
  const p = d.players[pid];
  if (collectStart && target < p.pos) {
    credit(d, pid, PASS_START);
    note(d, pid, `${p.name} mija BOOT i pobiera budżet ${PASS_START} PLN.`, 'money');
  }
  p.pos = target;
}

function advance(d: GameState, pid: number, steps: number) {
  const p = d.players[pid];
  const target = (p.pos + steps + BOARD_SIZE) % BOARD_SIZE;
  if (steps > 0 && target <= p.pos) {
    credit(d, pid, PASS_START);
    note(d, pid, `${p.name} mija BOOT i pobiera budżet ${PASS_START} PLN.`, 'money');
  }
  p.pos = target;
}

function drawCard(d: GameState, deck: DeckId): Card {
  const dk = d.decks[deck];
  if (dk.ptr >= dk.order.length) {
    const r = shuffle(dk.order, d.rngState);
    d.rngState = r.state;
    dk.order = r.items;
    dk.ptr = 0;
  }
  const card = DECKS[deck][dk.order[dk.ptr]];
  dk.ptr += 1;
  return card;
}

function countNodes(d: GameState, pid: number) {
  let nodes = 0, clusters = 0;
  for (const id of tilesOwnedBy(d, pid)) {
    const lvl = d.own[id].level;
    if (lvl === MAX_LEVEL) clusters += 1;
    else nodes += lvl;
  }
  return { nodes, clusters };
}

/** Zwraca true, jeśli tura czeka na decyzję gracza (kupno / licytacja). */
function resolveLanding(d: GameState, pid: number, depth = 0): boolean {
  if (depth > 4 || d.over) return false;
  const p = d.players[pid];
  const t = tileAt(p.pos);
  const diceSum = d.dice ? d.dice[0] + d.dice[1] : 7;

  switch (t.kind) {
    case 'start':
    case 'blackout':
    case 'maintenance':
      if (t.kind === 'blackout') note(d, pid, `${p.name} zagląda do BLACKOUT — tylko z wizytą.`);
      return false;

    case 'gotoblackout':
      note(d, pid, `${p.name} zgłasza awarię krytyczną.`, 'bad');
      sendToBlackout(d, pid);
      return false;

    case 'tax':
      note(d, pid, `${p.name}: ${t.name} — ${t.amount} PLN.`, 'bad');
      charge(d, pid, null, t.amount, t.name);
      return false;

    case 'card': {
      const card = drawCard(d, t.deck);
      const outcome = applyCard(d, pid, card, depth);
      d.drawn = { deck: t.deck, card, outcome };
      return false;
    }

    case 'rack':
    case 'uplink':
    case 'power': {
      const o = d.own[t.id];
      if (o.owner === null) {
        if (d.players[pid].cash >= t.price) {
          d.phase = 'buy';
          return true;
        }
        note(d, pid, `${p.name} nie stać na ${t.name} — pole idzie na licytację.`);
        startAuction(d, t.id);
        return true;
      }
      if (o.owner === pid) {
        note(d, pid, `${p.name} ląduje na własnym polu: ${t.name}.`);
        return false;
      }
      if (o.mortgaged) {
        note(d, pid, `${t.name} jest zahipotekowane — brak opłaty.`);
        return false;
      }
      const rent = rentFor(d, t.id, diceSum);
      note(d, pid, `${p.name} płaci ${rent} PLN za ${t.name} (właściciel: ${name(d, o.owner)}).`, 'money');
      charge(d, pid, o.owner, rent, `czynsz za ${t.name}`);
      return false;
    }
  }
}

function applyCard(d: GameState, pid: number, card: Card, depth: number): string {
  const p = d.players[pid];
  const e = card.effect;
  switch (e.t) {
    case 'pay':
      charge(d, pid, null, e.amount, card.text);
      return `-${e.amount} PLN`;
    case 'gain':
      credit(d, pid, e.amount);
      return `+${e.amount} PLN`;
    case 'payEach': {
      const others = d.players.filter((o) => o.alive && o.id !== pid);
      const total = e.amount * others.length;
      for (const o of others) credit(d, o.id, e.amount);
      d.players[pid].cash -= total;
      if (d.players[pid].cash < 0) {
        const missing = -d.players[pid].cash;
        d.players[pid].cash = 0;
        d.debt = { player: pid, to: null, amount: missing, reason: 'rekompensaty SLA' };
      }
      return `-${total} PLN (po ${e.amount} dla ${others.length} graczy)`;
    }
    case 'collectEach': {
      const others = d.players.filter((o) => o.alive && o.id !== pid);
      let got = 0;
      for (const o of others) {
        const take = Math.min(o.cash, e.amount);
        o.cash -= take;
        got += take;
      }
      credit(d, pid, got);
      return `+${got} PLN od ${others.length} graczy`;
    }
    case 'goto':
      moveTo(d, pid, e.tile, e.collectStart);
      resolveLanding(d, pid, depth + 1);
      return `przenosi się na: ${tileAt(e.tile).name}`;
    case 'gotoBlackout':
      sendToBlackout(d, pid);
      return 'BLACKOUT';
    case 'move':
      advance(d, pid, e.delta);
      resolveLanding(d, pid, depth + 1);
      return `${e.delta > 0 ? '+' : ''}${e.delta} pola → ${tileAt(d.players[pid].pos).name}`;
    case 'perNode': {
      const { nodes, clusters } = countNodes(d, pid);
      const total = nodes * e.perNode + clusters * e.perCluster;
      if (total === 0) return 'brak ulepszeń — bez kosztów';
      charge(d, pid, null, total, card.text);
      return `-${total} PLN (${nodes} ${plural(nodes, SERWERY)}, ${clusters} ${plural(clusters, ['klaster', 'klastry', 'klastrów'])})`;
    }
    case 'perRack': {
      const n = tilesOwnedBy(d, pid).filter((id) => tileAt(id).kind === 'rack').length;
      const total = n * e.amount;
      if (total === 0) return 'brak szaf — bez kosztów';
      charge(d, pid, null, total, card.text);
      return `-${total} PLN (${n} ${plural(n, SZAFY)})`;
    }
    case 'skipTurn':
      p.skipNext = true;
      d.extraRoll = false;
      return 'tracisz następną turę';
    case 'generator':
      p.generators += 1;
      return 'karta zostaje na ręce';
  }
}

/** Cena wywoławcza - bez niej licytacja pełzła od zera po 20 PLN i trwała kilkanaście kolejek. */
export function openingBid(tileId: number): number {
  return Math.round((priceOf(tileId) * 0.5) / 10) * 10;
}

export function bidIncrement(tileId: number): number {
  return Math.max(10, Math.round((priceOf(tileId) * 0.15) / 10) * 10);
}

/** Kwota, na jaką opiewałby kolejny podbicie w tej licytacji. */
export function nextBid(tileId: number, price: number): number {
  return price === 0 ? openingBid(tileId) : price + bidIncrement(tileId);
}

function startAuction(d: GameState, tileId: number) {
  const inRace = d.players.filter((p) => p.alive && p.cash >= openingBid(tileId)).map((p) => p.id);
  if (inRace.length === 0) {
    note(d, null, `Nikogo nie stać na licytację ${tileAt(tileId).name}. Pole zostaje wolne.`);
    d.phase = 'end';
    return;
  }
  const start = inRace.findIndex((id) => id >= d.current);
  d.auction = { tileId, price: 0, highBidder: null, inRace, turnIdx: start < 0 ? 0 : start };
  d.phase = 'auction';
  note(d, null, `Licytacja: ${tileAt(tileId).name} — cena wywoławcza ${openingBid(tileId)} PLN, krok ${bidIncrement(tileId)} PLN.`, 'system');
}

function finishAuction(d: GameState) {
  const a = d.auction!;
  if (a.highBidder !== null) {
    const w = a.highBidder;
    d.players[w].cash -= a.price;
    d.own[a.tileId] = { owner: w, level: 0, mortgaged: false };
    note(d, w, `${name(d, w)} wygrywa licytację: ${tileAt(a.tileId).name} za ${a.price} PLN.`, 'good');
  } else {
    note(d, null, `Brak ofert — ${tileAt(a.tileId).name} zostaje wolne.`);
  }
  d.auction = null;
  finishStep(d);
}

function auctionAdvance(d: GameState) {
  const a = d.auction!;
  if (a.inRace.length === 0) { finishAuction(d); return; }
  if (a.inRace.length === 1 && a.highBidder === a.inRace[0]) { finishAuction(d); return; }
  a.turnIdx = a.turnIdx % a.inRace.length;
}

function finishStep(d: GameState) {
  if (d.over) { d.phase = 'gameover'; return; }
  if (d.drawn) { d.phase = 'card'; return; }
  if (d.debt) { d.phase = 'debt'; return; }
  if (d.extraRoll && d.players[d.current].blackout === 0) { d.phase = 'roll'; return; }
  d.phase = 'end';
}

function checkEnd(d: GameState) {
  const alive = d.players.filter((p) => p.alive);
  if (alive.length <= 1) {
    d.over = true;
    d.winner = alive.length === 1 ? alive[0].id : null;
    d.phase = 'gameover';
    note(d, null, d.winner !== null ? `Koniec gry — wygrywa ${name(d, d.winner)}.` : 'Koniec gry.', 'system');
    return;
  }
  const capped = d.mode === 'short' ? d.round > d.maxRounds : d.round > HARD_ROUND_LIMIT;
  if (capped) {
    d.over = true;
    let best = alive[0].id, bestW = -Infinity;
    for (const p of alive) {
      const w = netWorth(d, p.id);
      if (w > bestW) { bestW = w; best = p.id; }
    }
    d.winner = best;
    d.phase = 'gameover';
    const limit = d.mode === 'short' ? d.maxRounds : HARD_ROUND_LIMIT;
    note(d, null, `Koniec po ${limit} ${plural(limit, RUNDY)} — wygrywa ${name(d, best)} z majątkiem ${bestW} PLN.`, 'system');
  }
}

function endTurn(d: GameState, guard = 0) {
  d.dice = null;
  d.doubles = 0;
  d.extraRoll = false;
  d.drawn = null;
  d.tradesThisTurn = 0;

  const n = d.players.length;
  let next = d.current;
  for (let i = 0; i < n; i++) {
    next = (next + 1) % n;
    if (d.players[next].alive) break;
  }
  if (next <= d.current) d.round += 1;
  d.current = next;

  checkEnd(d);
  if (d.over) return;

  const p = d.players[d.current];
  if (p.skipNext) {
    p.skipNext = false;
    note(d, p.id, `${p.name} pomija turę — trwa przywracanie systemu.`, 'bad');
    if (guard < d.players.length) { endTurn(d, guard + 1); return; }
  }
  d.phase = 'roll';
}

function doRoll(d: GameState) {
  const pid = d.current;
  const p = d.players[pid];
  const dice = roll(d);
  d.dice = dice;
  const isDouble = dice[0] === dice[1];
  const sum = dice[0] + dice[1];

  if (p.blackout > 0) {
    note(d, pid, `${p.name} rzuca ${dice[0]}+${dice[1]} próbując wznowić zasilanie.`);
    if (isDouble) {
      p.blackout = 0;
      note(d, pid, `Dublet! ${p.name} przywraca zasilanie i rusza o ${sum}.`, 'good');
      d.lastMoveFrom = p.pos;
      advance(d, pid, sum);
      if (resolveLanding(d, pid)) return;
      finishStep(d);
      return;
    }
    p.blackout -= 1;
    if (p.blackout === 0) {
      note(d, pid, `${p.name} płaci ${BLACKOUT_FEE} PLN za serwis ekspresowy i rusza o ${sum}.`, 'money');
      if (!charge(d, pid, null, BLACKOUT_FEE, 'serwis ekspresowy')) { finishStep(d); return; }
      d.lastMoveFrom = p.pos;
      advance(d, pid, sum);
      if (resolveLanding(d, pid)) return;
      finishStep(d);
      return;
    }
    note(d, pid, `Bez dubletu — ${p.name} czeka jeszcze ${p.blackout} ${plural(p.blackout, TURY)}.`, 'bad');
    d.phase = 'end';
    return;
  }

  if (isDouble) {
    d.doubles += 1;
    if (d.doubles >= 3) {
      note(d, pid, `${p.name} trzeci dublet z rzędu — podejrzenie kryptokoparki w szafie!`, 'bad');
      sendToBlackout(d, pid);
      d.phase = 'end';
      return;
    }
    d.extraRoll = true;
  } else {
    d.extraRoll = false;
  }

  note(d, pid, `${p.name} rzuca ${dice[0]}+${dice[1]} = ${sum}${isDouble ? ' (dublet)' : ''}.`);
  d.lastMoveFrom = p.pos;
  advance(d, pid, sum);
  note(d, pid, `${p.name} ląduje na: ${tileAt(p.pos).name}.`);
  if (resolveLanding(d, pid)) return;
  finishStep(d);
}

function goBankrupt(d: GameState, pid: number) {
  const p = d.players[pid];
  const creditor = d.debt && d.debt.player === pid ? d.debt.to : null;

  let cashFromNodes = 0;
  for (const id of tilesOwnedBy(d, pid)) {
    const o = d.own[id];
    if (o.level > 0) {
      cashFromNodes += Math.floor((o.level * nodeCostOf(id)) / 2);
      o.level = 0;
    }
    if (creditor !== null) o.owner = creditor;
    else { o.owner = null; o.mortgaged = false; }
  }

  const pot = p.cash + cashFromNodes;
  if (creditor !== null) {
    credit(d, creditor, pot);
    note(d, pid, `${p.name} bankrutuje. Majątek przejmuje ${name(d, creditor)} (+${pot} PLN).`, 'bad');
  } else {
    note(d, pid, `${p.name} bankrutuje. Infrastruktura wraca na rynek.`, 'bad');
  }
  p.cash = 0;
  p.alive = false;
  p.generators = 0;
  d.debt = null;

  checkEnd(d);
  if (!d.over) {
    if (d.current === pid) endTurn(d);
    else d.phase = 'end';
  }
}

function validTrade(d: GameState, o: TradeOffer): boolean {
  const a = d.players[o.from], b = d.players[o.to];
  if (!a?.alive || !b?.alive || o.from === o.to) return false;
  if (o.giveCash < 0 || o.wantCash < 0) return false;
  if (a.cash < o.giveCash || b.cash < o.wantCash) return false;
  for (const id of o.giveTiles) if (d.own[id]?.owner !== o.from || d.own[id].level > 0) return false;
  for (const id of o.wantTiles) if (d.own[id]?.owner !== o.to || d.own[id].level > 0) return false;
  if (o.giveTiles.length + o.wantTiles.length + o.giveCash + o.wantCash === 0) return false;
  return true;
}

export function reduce(state: GameState, action: Action): GameState {
  if (state.over) return state;
  const d = draft(state);
  const pid = d.current;
  const p = d.players[pid];

  switch (action.t) {
    case 'ROLL': {
      if (d.phase !== 'roll') return state;
      doRoll(d);
      break;
    }

    case 'BUY': {
      if (d.phase !== 'buy') return state;
      const t = tileAt(p.pos);
      if (!isOwnable(t) || d.own[t.id].owner !== null || p.cash < t.price) return state;
      p.cash -= t.price;
      d.own[t.id] = { owner: pid, level: 0, mortgaged: false };
      note(d, pid, `${p.name} kupuje ${t.name} za ${t.price} PLN.`, 'good');
      finishStep(d);
      break;
    }

    case 'DECLINE': {
      if (d.phase !== 'buy') return state;
      const t = tileAt(p.pos);
      if (!isOwnable(t)) return state;
      note(d, pid, `${p.name} rezygnuje z zakupu — ${t.name} idzie na licytację.`);
      startAuction(d, t.id);
      break;
    }

    case 'BID': {
      if (d.phase !== 'auction' || !d.auction) return state;
      const a = d.auction;
      const bidder = a.inRace[a.turnIdx];
      const newPrice = nextBid(a.tileId, a.price);
      if (d.players[bidder].cash < newPrice) return state;
      a.price = newPrice;
      a.highBidder = bidder;
      note(d, bidder, `${name(d, bidder)} licytuje ${newPrice} PLN.`);
      a.turnIdx = (a.turnIdx + 1) % a.inRace.length;
      auctionAdvance(d);
      break;
    }

    case 'PASS_BID': {
      if (d.phase !== 'auction' || !d.auction) return state;
      const a = d.auction;
      const bidder = a.inRace[a.turnIdx];
      note(d, bidder, `${name(d, bidder)} pasuje.`);
      a.inRace.splice(a.turnIdx, 1);
      if (a.inRace.length === 0) { finishAuction(d); break; }
      auctionAdvance(d);
      break;
    }

    case 'BUILD': {
      if (!canBuild(d, pid, action.tile)) return state;
      const cost = nodeCostOf(action.tile);
      if (p.cash < cost) return state;
      p.cash -= cost;
      d.own[action.tile].level += 1;
      note(d, pid, `${p.name} rozbudowuje ${tileAt(action.tile).name} do poziomu ${d.own[action.tile].level} (-${cost} PLN).`, 'good');
      break;
    }

    case 'SELL': {
      if (!canSell(d, pid, action.tile)) return state;
      const back = Math.floor(nodeCostOf(action.tile) / 2);
      d.own[action.tile].level -= 1;
      credit(d, pid, back);
      note(d, pid, `${p.name} demontuje sprzęt z ${tileAt(action.tile).name} (+${back} PLN).`, 'money');
      settleDebt(d);
      if (d.phase === 'debt' && !d.debt) finishStep(d);
      break;
    }

    case 'MORTGAGE': {
      if (!canMortgage(d, pid, action.tile)) return state;
      d.own[action.tile].mortgaged = true;
      const got = mortgageValue(action.tile);
      credit(d, pid, got);
      note(d, pid, `${p.name} hipotekuje ${tileAt(action.tile).name} (+${got} PLN).`, 'money');
      settleDebt(d);
      if (d.phase === 'debt' && !d.debt) finishStep(d);
      break;
    }

    case 'UNMORTGAGE': {
      const o = d.own[action.tile];
      if (!o || o.owner !== pid || !o.mortgaged) return state;
      const cost = unmortgageCost(action.tile);
      if (p.cash < cost) return state;
      p.cash -= cost;
      o.mortgaged = false;
      note(d, pid, `${p.name} wykupuje hipotekę: ${tileAt(action.tile).name} (-${cost} PLN).`, 'money');
      break;
    }

    case 'PAY_BLACKOUT': {
      if (d.phase !== 'roll' || p.blackout === 0 || p.cash < BLACKOUT_FEE) return state;
      p.cash -= BLACKOUT_FEE;
      p.blackout = 0;
      note(d, pid, `${p.name} płaci ${BLACKOUT_FEE} PLN za serwis ekspresowy — zasilanie wróciło.`, 'money');
      break;
    }

    case 'USE_GENERATOR': {
      if (d.phase !== 'roll' || p.blackout === 0 || p.generators === 0) return state;
      p.generators -= 1;
      p.blackout = 0;
      note(d, pid, `${p.name} uruchamia generator awaryjny i wychodzi z BLACKOUT.`, 'good');
      break;
    }

    case 'ACK_CARD': {
      if (d.phase !== 'card') return state;
      d.drawn = null;
      finishStep(d);
      break;
    }

    case 'END_TURN': {
      if (d.phase !== 'end') return state;
      endTurn(d);
      break;
    }

    case 'BANKRUPT': {
      if (d.phase !== 'debt' || !d.debt) return state;
      goBankrupt(d, d.debt.player);
      break;
    }

    case 'TRADE': {
      const o = action.offer;
      if (!validTrade(d, o)) return state;
      for (const id of o.giveTiles) d.own[id].owner = o.to;
      for (const id of o.wantTiles) d.own[id].owner = o.from;
      d.players[o.from].cash += o.wantCash - o.giveCash;
      d.players[o.to].cash += o.giveCash - o.wantCash;
      const desc = (tiles: number[], cash: number) => {
        const parts = tiles.map((id) => tileAt(id).name);
        if (cash > 0) parts.push(`${cash} PLN`);
        return parts.length ? parts.join(', ') : 'nic';
      };
      d.tradesThisTurn += 1;
      note(d, o.from, `Wymiana: ${name(d, o.from)} oddaje [${desc(o.giveTiles, o.giveCash)}] za [${desc(o.wantTiles, o.wantCash)}] od ${name(d, o.to)}.`, 'good');
      settleDebt(d);
      if (d.phase === 'debt' && !d.debt) finishStep(d);
      break;
    }
  }

  return d;
}

export { BOARD, GROUP_TILES, MAX_LEVEL };
