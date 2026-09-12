import { describe, expect, it } from 'vitest';
import { BOARD, BOARD_SIZE, GROUP_TILES, gridPos, OWNABLE_IDS, PASS_START, START_CASH } from '../game/board';
import { botAction } from '../game/bot';
import { createGame, reduce } from '../game/engine';
import { canBuild, netWorth, rentFor, tilesOwnedBy } from '../game/selectors';
import type { GameState } from '../game/types';

const seeds = [
  { name: 'A', isBot: true }, { name: 'B', isBot: true },
  { name: 'C', isBot: true }, { name: 'D', isBot: true },
];

describe('plansza', () => {
  it('ma 32 pola o unikalnych pozycjach w siatce', () => {
    expect(BOARD).toHaveLength(BOARD_SIZE);
    BOARD.forEach((t, i) => expect(t.id).toBe(i));
    const cells = new Set(BOARD.map((t) => { const g = gridPos(t.id); return `${g.row}:${g.col}`; }));
    expect(cells.size).toBe(BOARD_SIZE);
  });

  it('każde pole siatki leży na obwodzie 9x9', () => {
    for (const t of BOARD) {
      const { row, col } = gridPos(t.id);
      expect(row === 1 || row === 9 || col === 1 || col === 9).toBe(true);
    }
  });

  it('grupy pokrywają wszystkie szafy', () => {
    const inGroups = Object.values(GROUP_TILES).flat().sort((a, b) => a - b);
    const racks = BOARD.filter((t) => t.kind === 'rack').map((t) => t.id);
    expect(inGroups).toEqual(racks);
  });
});

describe('ekonomia', () => {
  it('start daje każdemu równy budżet', () => {
    const s = createGame(seeds, 'short', 1);
    expect(s.players.every((p) => p.cash === START_CASH)).toBe(true);
  });

  it('przejście przez BOOT wypłaca budżet', () => {
    let s = createGame(seeds, 'short', 1);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, pos: 30 } : p)) };
    const before = s.players[0].cash;
    s = reduce(s, { t: 'ROLL' });
    expect(s.players[0].pos).toBeLessThan(30);
    expect(s.players[0].cash).toBeGreaterThanOrEqual(before + PASS_START - 200);
  });

  it('komplet grupy podwaja czynsz bazowy', () => {
    const s = createGame(seeds, 'short', 1);
    const group = GROUP_TILES.piwnica;
    const one = { ...s, own: { ...s.own, [group[0]]: { owner: 1, level: 0, mortgaged: false } } };
    const base = rentFor(one, group[0], 7);
    const both = {
      ...s,
      own: Object.fromEntries(group.map((id) => [id, { owner: 1, level: 0, mortgaged: false }])) as GameState['own'],
    };
    const full = { ...one, own: { ...one.own, ...both.own } };
    expect(rentFor(full, group[0], 7)).toBe(base * 2);
  });

  it('zahipotekowane pole nie generuje czynszu', () => {
    const s = createGame(seeds, 'short', 1);
    const id = GROUP_TILES.salaA[0];
    const owned = { ...s, own: { ...s.own, [id]: { owner: 1, level: 2, mortgaged: true } } };
    expect(rentFor(owned, id, 7)).toBe(0);
  });

  it('budowa wymaga kompletu grupy i jest równomierna', () => {
    const s = createGame(seeds, 'short', 1);
    const g = GROUP_TILES.kolokacja;
    const partial = { ...s, own: { ...s.own, [g[0]]: { owner: 0, level: 0, mortgaged: false } } };
    expect(canBuild(partial, 0, g[0])).toBe(false);

    const full: GameState = {
      ...s,
      own: { ...s.own, ...Object.fromEntries(g.map((id) => [id, { owner: 0, level: 0, mortgaged: false }])) },
    };
    expect(canBuild(full, 0, g[0])).toBe(true);
    const uneven: GameState = { ...full, own: { ...full.own, [g[0]]: { owner: 0, level: 1, mortgaged: false } } };
    expect(canBuild(uneven, 0, g[0])).toBe(false);
    expect(canBuild(uneven, 0, g[1])).toBe(true);
  });

  it('hipoteka i wykup są stratne dla gracza', () => {
    let s = createGame(seeds, 'short', 1);
    const id = OWNABLE_IDS[0];
    s = { ...s, own: { ...s.own, [id]: { owner: 0, level: 0, mortgaged: false } } };
    const before = s.players[0].cash;
    s = reduce(s, { t: 'MORTGAGE', tile: id });
    expect(s.own[id].mortgaged).toBe(true);
    s = reduce(s, { t: 'UNMORTGAGE', tile: id });
    expect(s.own[id].mortgaged).toBe(false);
    expect(s.players[0].cash).toBeLessThan(before);
  });
});

describe('bankructwo', () => {
  it('przekazuje majątek wierzycielowi i usuwa gracza', () => {
    let s = createGame(seeds, 'short', 1);
    const id = OWNABLE_IDS[3];
    s = {
      ...s,
      phase: 'debt',
      own: { ...s.own, [id]: { owner: 0, level: 0, mortgaged: false } },
      players: s.players.map((p) => (p.id === 0 ? { ...p, cash: 10 } : p)),
      debt: { player: 0, to: 1, amount: 900, reason: 'test' },
    };
    const creditorBefore = s.players[1].cash;
    s = reduce(s, { t: 'BANKRUPT' });
    expect(s.players[0].alive).toBe(false);
    expect(s.own[id].owner).toBe(1);
    expect(s.players[1].cash).toBe(creditorBefore + 10);
  });
});

describe('pełna partia botów', () => {
  const playOut = (seed: number, mode: 'short' | 'classic') => {
    let s = createGame(seeds, mode, seed);
    let steps = 0;
    while (!s.over && steps < 30000) {
      const a = botAction(s);
      expect(a, `brak akcji bota w fazie ${s.phase}`).not.toBeNull();
      const next = reduce(s, a!);
      expect(next, `akcja ${a!.t} nie zmieniła stanu w fazie ${s.phase}`).not.toBe(s);
      s = next;
      steps += 1;
    }
    return { s, steps };
  };

  it.each([1, 2, 7, 42, 1234, 99999])('kończy się i wyłania zwycięzcę (seed %i)', (seed) => {
    const { s, steps } = playOut(seed, 'short');
    expect(s.over).toBe(true);
    expect(steps).toBeLessThan(30000);
    expect(s.winner).not.toBeNull();
    expect(s.players[s.winner!].alive).toBe(true);
  });

  it('tryb krótki nie przekracza limitu rund', () => {
    const { s } = playOut(2024, 'short');
    expect(s.round).toBeLessThanOrEqual(s.maxRounds + 1);
  });

  it('tryb klasyczny kończy się jednym wypłacalnym graczem', () => {
    const { s } = playOut(555, 'classic');
    expect(s.players.filter((p) => p.alive)).toHaveLength(1);
  });

  it('suma majątków pozostaje dodatnia i pola mają spójnych właścicieli', () => {
    const { s } = playOut(31337, 'short');
    for (const p of s.players) if (p.alive) expect(netWorth(s, p.id)).toBeGreaterThan(0);
    for (const id of OWNABLE_IDS) {
      const o = s.own[id];
      if (o.owner !== null) expect(tilesOwnedBy(s, o.owner)).toContain(id);
    }
  });
});
