import type { Group, GroupId, Tile } from './types';

export const START_CASH = 2000;
export const PASS_START = 200;
export const BLACKOUT_FEE = 50;
export const BLACKOUT_TURNS = 2;
export const BOARD_SIZE = 32;
export const BLACKOUT_TILE = 8;
export const MAX_LEVEL = 4;

export const GROUPS: Record<GroupId, Group> = {
  piwnica:   { id: 'piwnica',   label: 'Piwnica',    color: '#8a8f98', nodeCost: 50 },
  kolokacja: { id: 'kolokacja', label: 'Kolokacja',  color: '#c9873a', nodeCost: 50 },
  salaA:     { id: 'salaA',     label: 'Sala A',     color: '#3fb950', nodeCost: 100 },
  salaB:     { id: 'salaB',     label: 'Sala B',     color: '#2f81f7', nodeCost: 100 },
  edge:      { id: 'edge',      label: 'Edge',       color: '#a371f7', nodeCost: 150 },
  hyper:     { id: 'hyper',     label: 'Hyperscale', color: '#e3b341', nodeCost: 200 },
};

export const UPLINK_RENT = [0, 50, 100, 200, 400];
export const POWER_MULT = [0, 4, 10];

export const BOARD: Tile[] = [
  { id: 0,  kind: 'start', name: 'BOOT' },
  { id: 1,  kind: 'rack', name: 'Serwer pod biurkiem', group: 'piwnica', price: 120, rent: [8, 40, 100, 300, 450] },
  { id: 2,  kind: 'card', name: 'Incydent', deck: 'incydent' },
  { id: 3,  kind: 'rack', name: 'Szafa w piwnicy', group: 'piwnica', price: 140, rent: [10, 50, 150, 450, 600] },
  { id: 4,  kind: 'tax', name: 'Audyt bezpieczeństwa', amount: 150 },
  { id: 5,  kind: 'uplink', name: 'Tranzyt IP — Północ', price: 250 },
  { id: 6,  kind: 'rack', name: 'Rack 1/4', group: 'kolokacja', price: 200, rent: [16, 80, 220, 600, 800] },
  { id: 7,  kind: 'rack', name: 'Rack 1/2', group: 'kolokacja', price: 220, rent: [18, 90, 250, 700, 875] },
  { id: 8,  kind: 'blackout', name: 'BLACKOUT' },
  { id: 9,  kind: 'rack', name: 'Rack 42U', group: 'kolokacja', price: 240, rent: [20, 100, 300, 750, 925] },
  { id: 10, kind: 'power', name: 'Zasilanie UPS', price: 200 },
  { id: 11, kind: 'rack', name: 'Sala A — rząd 1', group: 'salaA', price: 280, rent: [22, 110, 330, 800, 975] },
  { id: 12, kind: 'card', name: 'Budżet', deck: 'budzet' },
  { id: 13, kind: 'rack', name: 'Sala A — rząd 2', group: 'salaA', price: 300, rent: [24, 120, 360, 850, 1025] },
  { id: 14, kind: 'rack', name: 'Sala A — rząd 3', group: 'salaA', price: 320, rent: [26, 130, 390, 900, 1100] },
  { id: 15, kind: 'uplink', name: 'Tranzyt IP — Zachód', price: 250 },
  { id: 16, kind: 'maintenance', name: 'Przerwa serwisowa' },
  { id: 17, kind: 'rack', name: 'Klaster CPU', group: 'salaB', price: 360, rent: [30, 150, 450, 1000, 1200] },
  { id: 18, kind: 'card', name: 'Incydent', deck: 'incydent' },
  { id: 19, kind: 'rack', name: 'Klaster GPU', group: 'salaB', price: 380, rent: [32, 160, 480, 1050, 1275] },
  { id: 20, kind: 'rack', name: 'Storage NVMe', group: 'salaB', price: 400, rent: [35, 175, 500, 1100, 1300] },
  { id: 21, kind: 'uplink', name: 'Tranzyt IP — Południe', price: 250 },
  { id: 22, kind: 'rack', name: 'Edge Kraków', group: 'edge', price: 440, rent: [40, 200, 550, 1200, 1400] },
  { id: 23, kind: 'power', name: 'Chłodzenie free-cooling', price: 200 },
  { id: 24, kind: 'gotoblackout', name: 'Zgłoszenie awarii' },
  { id: 25, kind: 'rack', name: 'Edge Warszawa', group: 'edge', price: 460, rent: [42, 210, 580, 1250, 1475] },
  { id: 26, kind: 'card', name: 'Budżet', deck: 'budzet' },
  { id: 27, kind: 'rack', name: 'Kampus Hyperscale', group: 'hyper', price: 520, rent: [50, 250, 700, 1500, 1750] },
  { id: 28, kind: 'tax', name: 'Opłata licencyjna', amount: 100 },
  { id: 29, kind: 'uplink', name: 'Tranzyt IP — Wschód', price: 250 },
  { id: 30, kind: 'card', name: 'Incydent', deck: 'incydent' },
  { id: 31, kind: 'rack', name: 'Strefa Dostępności', group: 'hyper', price: 600, rent: [60, 300, 800, 1700, 2000] },
];

export const OWNABLE_IDS = BOARD.filter(
  (t) => t.kind === 'rack' || t.kind === 'uplink' || t.kind === 'power',
).map((t) => t.id);

export const GROUP_TILES: Record<GroupId, number[]> = (() => {
  const out = {} as Record<GroupId, number[]>;
  for (const g of Object.keys(GROUPS) as GroupId[]) out[g] = [];
  for (const t of BOARD) if (t.kind === 'rack') out[t.group].push(t.id);
  return out;
})();

/** Pozycja pola w siatce 9x9 (1-indeksowane wiersz/kolumna). Ruch zgodnie z ruchem wskazówek zegara. */
export function gridPos(id: number): { row: number; col: number } {
  if (id <= 8) return { row: 9 - id, col: 1 };
  if (id <= 16) return { row: 1, col: 1 + (id - 8) };
  if (id <= 24) return { row: 1 + (id - 16), col: 9 };
  return { row: 9, col: 9 - (id - 24) };
}

export const PLAYER_COLORS = ['#2f81f7', '#3fb950', '#e3b341', '#f85149'];
export const LEVEL_LABEL = ['—', 'Redundancja', 'Automatyzacja', 'Tier III', 'Klaster HA'];
