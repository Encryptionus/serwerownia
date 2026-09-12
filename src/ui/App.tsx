import { useCallback, useEffect, useRef, useState } from 'react';
import { botAcceptsTrade, botAction, findBotTrade } from '../game/bot';
import { createGame, DEFAULT_MAX_ROUNDS, reduce, type PlayerSeed } from '../game/engine';
import type { Action, GameMode, GameState, TradeOffer } from '../game/types';
import { ActionPanel } from './ActionPanel';
import { Board } from './Board';
import { Dice } from './Dice';
import { GameOver } from './GameOver';
import { Setup } from './Setup';
import { Sidebar } from './Sidebar';
import { IncomingOffer, TradeDialog } from './TradeDialog';

/** Opóźnienia ruchów bota - bez nich partia botów przewija się szybciej, niż da się przeczytać. */
const BOT_DELAY: Record<string, number> = {
  roll: 750, buy: 700, auction: 320, card: 1400, debt: 450, end: 600,
};

/** Limit rund da się nadpisać przez ?rounds=N - przydatne przy strojeniu kiosku pod ruch. */
function roundsFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('rounds');
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : DEFAULT_MAX_ROUNDS;
}

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [rolling, setRolling] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeNotice, setTradeNotice] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<TradeOffer | null>(null);
  const proposedRef = useRef<string>('');

  const dispatch = useCallback((a: Action) => {
    setState((prev) => (prev ? reduce(prev, a) : prev));
  }, []);

  const start = (seeds: PlayerSeed[], mode: GameMode) => {
    proposedRef.current = '';
    setIncoming(null);
    setTradeOpen(false);
    setState(createGame(seeds, mode, Date.now(), roundsFromUrl()));
  };

  // animacja kości po każdym rzucie
  const lastDice = useRef<string>('');
  useEffect(() => {
    if (!state?.dice) return;
    const key = `${state.dice[0]}:${state.dice[1]}:${state.log.length}`;
    if (key === lastDice.current) return;
    lastDice.current = key;
    setRolling(true);
    const t = setTimeout(() => setRolling(false), 450);
    return () => clearTimeout(t);
  }, [state?.dice, state?.log.length]);

  /** Czy w danym momencie decyzję podejmuje bot? */
  const botIsDeciding = (s: GameState): boolean => {
    if (s.over) return false;
    if (s.phase === 'auction' && s.auction) {
      return s.players[s.auction.inRace[s.auction.turnIdx]]?.isBot ?? false;
    }
    return s.players[s.current].isBot;
  };

  // pętla bota
  useEffect(() => {
    const s = state;
    if (!s || s.over || incoming || !botIsDeciding(s)) return;

    // bot może chcieć zaproponować wymianę człowiekowi - wtedy czekamy na decyzję
    if (s.phase === 'end') {
      const key = `${s.round}:${s.current}`;
      if (proposedRef.current !== key) {
        proposedRef.current = key;
        const offer = findBotTrade(s, s.current);
        if (offer && !s.players[offer.to].isBot) {
          const t = setTimeout(() => setIncoming(offer), 500);
          return () => clearTimeout(t);
        }
      }
    }

    const delay = BOT_DELAY[s.phase] ?? 500;
    const t = setTimeout(() => {
      setState((prev) => {
        if (!prev || prev.over) return prev;
        const a = botAction(prev);
        return a ? reduce(prev, a) : prev;
      });
    }, delay);
    return () => clearTimeout(t);
  }, [state, incoming]);

  if (!state) return <Setup onStart={start} />;

  const s = state;
  const humanControls = !botIsDeciding(s);

  const submitTrade = (offer: TradeOffer) => {
    const partner = s.players[offer.to];
    if (partner.isBot) {
      if (botAcceptsTrade(s, offer)) {
        dispatch({ t: 'TRADE', offer });
        setTradeOpen(false);
        setTradeNotice(null);
      } else {
        setTradeNotice(`${partner.name} odrzuca ofertę. Dołóż gotówki albo lepsze pole.`);
      }
      return;
    }
    // wymiana między ludźmi - druga strona potwierdza na tym samym ekranie
    setTradeOpen(false);
    setTradeNotice(null);
    setIncoming(offer);
  };

  return (
    <div className="app">
      <div className="stage">
        <Board s={s} me={s.current}>
          <div className="brand">
            <div className="logo">SERWEROWNIA</div>
            <div className="tag">uptime · kolokacja · czynsze</div>
          </div>
          <Dice dice={s.dice} rolling={rolling} />
          <ActionPanel
            s={s}
            dispatch={dispatch}
            humanControls={humanControls}
            onOpenTrade={() => { setTradeNotice(null); setTradeOpen(true); }}
          />
          <div className="turn-strip">
            <span>Runda {s.round}{s.mode === 'short' ? ` / ${s.maxRounds}` : ''}</span>
            <span style={{ color: s.players[s.current].color }}>{s.players[s.current].name}</span>
          </div>
        </Board>
      </div>

      <Sidebar s={s} dispatch={dispatch} humanControls={humanControls} />

      {tradeOpen && (
        <TradeDialog
          s={s}
          me={s.current}
          notice={tradeNotice}
          onSubmit={submitTrade}
          onClose={() => { setTradeOpen(false); setTradeNotice(null); }}
        />
      )}

      {incoming && (
        <IncomingOffer
          s={s}
          offer={incoming}
          onAccept={() => { dispatch({ t: 'TRADE', offer: incoming }); setIncoming(null); }}
          onReject={() => setIncoming(null)}
        />
      )}

      {s.over && <GameOver s={s} onRestart={() => setState(null)} />}
    </div>
  );
}
