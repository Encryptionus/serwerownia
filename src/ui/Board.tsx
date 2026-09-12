import { BOARD, GROUPS, gridPos, MAX_LEVEL } from '../game/board';
import { tileAt } from '../game/selectors';
import type { GameState, Tile } from '../game/types';

const SYMBOL: Record<string, string> = {
  start: '⏻',
  blackout: '🔌',
  maintenance: '🛠',
  gotoblackout: '🚨',
  uplink: '🌐',
  power: '⚡',
  tax: '⚖',
};

const CORNER_SUB: Record<string, string> = {
  start: '+200 PLN',
  blackout: 'tylko z wizytą',
  maintenance: 'nic się nie dzieje',
  gotoblackout: 'idź do BLACKOUT',
};

function tileTitle(t: Tile): string {
  switch (t.kind) {
    case 'rack': return `${t.name} — ${GROUPS[t.group].label}, cena ${t.price} PLN`;
    case 'uplink': return `${t.name} — cena ${t.price} PLN, czynsz rośnie z liczbą łączy`;
    case 'power': return `${t.name} — cena ${t.price} PLN, czynsz zależy od rzutu kośćmi`;
    case 'tax': return `${t.name} — zapłać ${t.amount} PLN`;
    case 'card': return t.deck === 'incydent' ? 'Karta incydentu' : 'Karta budżetu';
    default: return t.name;
  }
}

function TileView({ s, t, me, onPick }: { s: GameState; t: Tile; me: number; onPick?: (id: number) => void }) {
  const { row, col } = gridPos(t.id);
  const own = s.own[t.id];
  const corner = t.kind === 'start' || t.kind === 'blackout' || t.kind === 'maintenance' || t.kind === 'gotoblackout';
  const ownerColor = own?.owner != null ? s.players[own.owner].color : null;
  const here = s.players.some((p) => p.alive && p.pos === t.id);

  const cls = [
    'tile',
    corner ? 'corner' : '',
    here ? 'here' : '',
    own?.owner === me ? 'owned-by-me' : '',
    onPick ? 'clickable' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      style={{ gridRow: row, gridColumn: col }}
      title={tileTitle(t)}
      onClick={onPick ? () => onPick(t.id) : undefined}
    >
      {t.kind === 'rack' && <div className="stripe" style={{ background: GROUPS[t.group].color }} />}

      {corner ? (
        <>
          <div className="icon">{SYMBOL[t.kind]}</div>
          <div className="tname">{t.name}</div>
          <div className="sub">{CORNER_SUB[t.kind]}</div>
        </>
      ) : (
        <>
          {t.kind !== 'rack' && <div className="icon">{t.kind === 'card' ? (t.deck === 'incydent' ? '⚠' : '＄') : SYMBOL[t.kind]}</div>}
          <div className="tname">{t.name}</div>
          {t.kind === 'tax' && <div className="tprice mono">−{t.amount}</div>}
          {(t.kind === 'rack' || t.kind === 'uplink' || t.kind === 'power') && (
            <div className="tprice mono">{t.price} PLN</div>
          )}
        </>
      )}

      {own && own.level > 0 && (
        <div className="levels">
          {own.level === MAX_LEVEL
            ? <div className="pip cluster" title="Klaster HA" />
            : Array.from({ length: own.level }, (_, i) => <div key={i} className="pip" />)}
        </div>
      )}

      {own?.mortgaged && <div className="mortgaged">HIPOTEKA</div>}
      {ownerColor && <div className="owner-bar" style={{ background: ownerColor }} />}
    </div>
  );
}

/** Żetony leżą nad planszą i przesuwają się płynnie między polami. */
function Tokens({ s }: { s: GameState }) {
  return (
    <>
      {s.players.map((p, i) => {
        const { row, col } = gridPos(p.pos);
        // rozsuwamy żetony w obrębie pola, żeby nie nakładały się na siebie
        const dx = ((i % 2) * 2 - 1) * 1.5;
        const dy = (Math.floor(i / 2) * 2 - 1) * 1.5;
        return (
          <div
            key={p.id}
            className={`token${p.alive ? '' : ' dead'}`}
            title={`${p.name} — ${tileAt(p.pos).name}`}
            style={{
              background: p.color,
              left: `${((col - 0.5) / 9) * 100 + dx}%`,
              top: `${((row - 0.5) / 9) * 100 + dy}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {p.name.slice(0, 1).toUpperCase()}
          </div>
        );
      })}
    </>
  );
}

export function Board({ s, me, onPick, children }: {
  s: GameState;
  me: number;
  onPick?: (id: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="board-wrap">
      <div className="board">
        {BOARD.map((t) => <TileView key={t.id} s={s} t={t} me={me} onPick={onPick} />)}
        <div className="center">{children}</div>
      </div>
      <Tokens s={s} />
    </div>
  );
}
