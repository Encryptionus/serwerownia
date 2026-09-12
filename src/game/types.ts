export type GroupId = 'piwnica' | 'kolokacja' | 'salaA' | 'salaB' | 'edge' | 'hyper';
export type DeckId = 'incydent' | 'budzet';

export interface Group {
  id: GroupId;
  label: string;
  color: string;
  nodeCost: number;
}

export type Tile =
  | { id: number; kind: 'start'; name: string }
  | { id: number; kind: 'blackout'; name: string }
  | { id: number; kind: 'maintenance'; name: string }
  | { id: number; kind: 'gotoblackout'; name: string }
  | { id: number; kind: 'rack'; name: string; group: GroupId; price: number; rent: number[] }
  | { id: number; kind: 'uplink'; name: string; price: number }
  | { id: number; kind: 'power'; name: string; price: number }
  | { id: number; kind: 'card'; name: string; deck: DeckId }
  | { id: number; kind: 'tax'; name: string; amount: number };

export type OwnableTile = Extract<Tile, { kind: 'rack' | 'uplink' | 'power' }>;

export type CardEffect =
  | { t: 'pay'; amount: number }
  | { t: 'gain'; amount: number }
  | { t: 'payEach'; amount: number }
  | { t: 'collectEach'; amount: number }
  | { t: 'goto'; tile: number; collectStart: boolean }
  | { t: 'gotoBlackout' }
  | { t: 'move'; delta: number }
  | { t: 'perNode'; perNode: number; perCluster: number }
  | { t: 'perRack'; amount: number }
  | { t: 'skipTurn' }
  | { t: 'generator' };

export interface Card {
  id: string;
  text: string;
  effect: CardEffect;
}

export interface Player {
  id: number;
  name: string;
  isBot: boolean;
  color: string;
  cash: number;
  pos: number;
  alive: boolean;
  /** Liczba tur, które gracz musi jeszcze spędzić w BLACKOUT (0 = wolny). */
  blackout: number;
  /** Karty "Generator awaryjny" na ręce. */
  generators: number;
  /** Gracz pomija najbliższą turę (efekt karty). */
  skipNext: boolean;
}

export interface Ownership {
  owner: number | null;
  /** 0 = goła szafa, 1-3 = serwery, 4 = klaster. Dotyczy tylko pól typu 'rack'. */
  level: number;
  mortgaged: boolean;
}

export type Phase =
  | 'roll'
  | 'buy'
  | 'auction'
  | 'card'
  | 'debt'
  | 'end'
  | 'gameover';

export interface Auction {
  tileId: number;
  price: number;
  highBidder: number | null;
  /** Gracze wciąż licytujący, w kolejności. */
  inRace: number[];
  turnIdx: number;
}

export interface Debt {
  player: number;
  /** null = bank */
  to: number | null;
  amount: number;
  reason: string;
}

export interface DrawnCard {
  deck: DeckId;
  card: Card;
  /** Tekst skutku po zastosowaniu, do pokazania w UI. */
  outcome: string;
}

export interface TradeOffer {
  from: number;
  to: number;
  giveTiles: number[];
  giveCash: number;
  wantTiles: number[];
  wantCash: number;
}

export interface LogEntry {
  id: number;
  round: number;
  player: number | null;
  text: string;
  kind: 'info' | 'money' | 'bad' | 'good' | 'system';
}

export type GameMode = 'short' | 'classic';

export interface GameState {
  players: Player[];
  current: number;
  phase: Phase;
  own: Record<number, Ownership>;
  dice: [number, number] | null;
  doubles: number;
  round: number;
  maxRounds: number;
  mode: GameMode;
  rngState: number;
  decks: Record<DeckId, { order: number[]; ptr: number }>;
  drawn: DrawnCard | null;
  auction: Auction | null;
  debt: Debt | null;
  log: LogEntry[];
  logSeq: number;
  over: boolean;
  winner: number | null;
  /** Gracz właśnie przeszedł przez START - do animacji/podświetleń. */
  lastMoveFrom: number | null;
  /** Wyrzucono dublet - ten sam gracz rzuca ponownie. */
  extraRoll: boolean;
  /** Liczba wymian zawartych w bieżącej turze - ogranicznik przeciw pętlom handlowym. */
  tradesThisTurn: number;
}

export type Action =
  | { t: 'ROLL' }
  | { t: 'BUY' }
  | { t: 'DECLINE' }
  | { t: 'BID' }
  | { t: 'PASS_BID' }
  | { t: 'BUILD'; tile: number }
  | { t: 'SELL'; tile: number }
  | { t: 'MORTGAGE'; tile: number }
  | { t: 'UNMORTGAGE'; tile: number }
  | { t: 'PAY_BLACKOUT' }
  | { t: 'USE_GENERATOR' }
  | { t: 'ACK_CARD' }
  | { t: 'END_TURN' }
  | { t: 'BANKRUPT' }
  | { t: 'TRADE'; offer: TradeOffer };
