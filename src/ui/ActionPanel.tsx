import { BLACKOUT_FEE, GROUPS, LEVEL_LABEL } from '../game/board';
import { nextBid } from '../game/engine';
import { plural, TURY } from '../game/plural';
import { priceOf, rentFor, tileAt } from '../game/selectors';
import type { Action, GameState } from '../game/types';

interface Props {
  s: GameState;
  dispatch: (a: Action) => void;
  humanControls: boolean;
  onOpenTrade: () => void;
}

function TileBrief({ id }: { id: number }) {
  const t = tileAt(id);
  if (t.kind === 'rack') {
    return (
      <div className="desc">
        {GROUPS[t.group].label} · czynsz bazowy <b className="mono">{t.rent[0]}</b> PLN,
        z kompletem grupy <b className="mono">{t.rent[0] * 2}</b>, z pełną rozbudową <b className="mono">{t.rent[4]}</b>.
      </div>
    );
  }
  if (t.kind === 'uplink') return <div className="desc">Czynsz 50 / 100 / 200 / 400 PLN — zależnie od liczby posiadanych łączy.</div>;
  if (t.kind === 'power') return <div className="desc">Czynsz: suma oczek × 4 (jedno pole) lub × 10 (oba pola).</div>;
  return null;
}

export function ActionPanel({ s, dispatch, humanControls, onOpenTrade }: Props) {
  const p = s.players[s.current];
  const waitingForBot = !humanControls;

  const wrap = (title: string, body: React.ReactNode) => (
    <div className="action">
      <div className="title">{title}</div>
      {body}
    </div>
  );

  if (s.phase === 'roll') {
    const inBlackout = p.blackout > 0;
    return wrap(
      inBlackout ? 'BLACKOUT' : `Tura: ${p.name}`,
      <>
        {inBlackout ? (
          <div className="desc">
            Infrastruktura offline. Wyjdziesz dubletem, płacąc {BLACKOUT_FEE} PLN
            albo kartą generatora. Zostało: <b>{p.blackout}</b> {plural(p.blackout, TURY)}.
          </div>
        ) : (
          <div className="desc">Rzuć kośćmi, żeby ruszyć dalej po obwodzie serwerowni.</div>
        )}
        <div className="row">
          <button className="primary" disabled={waitingForBot} onClick={() => dispatch({ t: 'ROLL' })}>
            Rzuć kośćmi
          </button>
          {inBlackout && p.generators > 0 && (
            <button className="good" disabled={waitingForBot} onClick={() => dispatch({ t: 'USE_GENERATOR' })}>
              Użyj generatora
            </button>
          )}
          {inBlackout && (
            <button disabled={waitingForBot || p.cash < BLACKOUT_FEE} onClick={() => dispatch({ t: 'PAY_BLACKOUT' })}>
              Zapłać {BLACKOUT_FEE} PLN
            </button>
          )}
        </div>
      </>,
    );
  }

  if (s.phase === 'buy') {
    const t = tileAt(p.pos);
    const price = priceOf(p.pos);
    return wrap(
      t.name,
      <>
        <TileBrief id={p.pos} />
        <div className="desc">Wolne pole. Kupisz za <b className="mono">{price} PLN</b>, albo idzie na licytację.</div>
        <div className="row">
          <button className="primary" disabled={waitingForBot || p.cash < price} onClick={() => dispatch({ t: 'BUY' })}>
            Kup za {price} PLN
          </button>
          <button disabled={waitingForBot} onClick={() => dispatch({ t: 'DECLINE' })}>Na licytację</button>
        </div>
      </>,
    );
  }

  if (s.phase === 'auction' && s.auction) {
    const a = s.auction;
    const bidder = a.inRace[a.turnIdx];
    const bp = s.players[bidder];
    const next = nextBid(a.tileId, a.price);
    return wrap(
      'Licytacja',
      <>
        <div className="desc">
          <b>{tileAt(a.tileId).name}</b> — cena katalogowa {priceOf(a.tileId)} PLN.
        </div>
        <div className="desc">
          {a.highBidder === null
            ? 'Brak ofert.'
            : <>Najwyższa oferta: <b className="mono">{a.price} PLN</b> — {s.players[a.highBidder].name}.</>}
        </div>
        <div className="desc">Licytuje: <b style={{ color: bp.color }}>{bp.name}</b></div>
        <div className="row">
          <button
            className="primary"
            disabled={bp.isBot || bp.cash < next}
            onClick={() => dispatch({ t: 'BID' })}
          >
            Podbij do {next} PLN
          </button>
          <button disabled={bp.isBot} onClick={() => dispatch({ t: 'PASS_BID' })}>Pas</button>
        </div>
      </>,
    );
  }

  if (s.phase === 'card' && s.drawn) {
    const { deck, card, outcome } = s.drawn;
    return wrap(
      deck === 'incydent' ? 'Incydent' : 'Budżet',
      <>
        <div className="card-draw">
          <div className={`kind ${deck}`}>{deck === 'incydent' ? '⚠ Incydent' : '＄ Budżet'}</div>
          <div>{card.text}</div>
          <div className="outcome mono">{outcome}</div>
        </div>
        <div className="row">
          <button className="primary" disabled={waitingForBot} onClick={() => dispatch({ t: 'ACK_CARD' })}>OK</button>
        </div>
      </>,
    );
  }

  if (s.phase === 'debt' && s.debt) {
    const d = s.debt;
    const dp = s.players[d.player];
    return wrap(
      'Brak środków',
      <>
        <div className="desc">
          <b>{dp.name}</b> musi zebrać <b className="mono">{d.amount} PLN</b> ({d.reason}).
          Sprzedaj sprzęt lub zahipotekuj pola w panelu obok.
        </div>
        <div className="desc mono">W kasie: {dp.cash} PLN</div>
        <div className="row">
          <button className="danger" disabled={waitingForBot} onClick={() => dispatch({ t: 'BANKRUPT' })}>
            Ogłoś bankructwo
          </button>
        </div>
      </>,
    );
  }

  if (s.phase === 'end') {
    const t = tileAt(p.pos);
    const own = s.own[p.pos];
    const lvl = own?.level ?? 0;
    return wrap(
      `Tura: ${p.name}`,
      <>
        <div className="desc">
          Stoisz na: <b>{t.name}</b>
          {own?.owner === p.id && lvl > 0 && <> · {LEVEL_LABEL[lvl]} · czynsz {rentFor(s, p.pos, 7)} PLN</>}
        </div>
        <div className="desc">Możesz rozbudować pola i handlować, zanim zakończysz turę.</div>
        <div className="row">
          <button disabled={waitingForBot} onClick={onOpenTrade}>Wymiana</button>
          <button className="primary" disabled={waitingForBot} onClick={() => dispatch({ t: 'END_TURN' })}>
            Zakończ turę
          </button>
        </div>
      </>,
    );
  }

  return wrap('…', <div className="desc">Czekam.</div>);
}
