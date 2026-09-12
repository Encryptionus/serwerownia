import { useEffect, useRef } from 'react';
import { GROUPS, LEVEL_LABEL, MAX_LEVEL } from '../game/board';
import { plural, POLA } from '../game/plural';
import {
  canBuild, canMortgage, canSell, mortgageValue, netWorth, nodeCostOf,
  tileAt, tilesOwnedBy, unmortgageCost,
} from '../game/selectors';
import type { Action, GameState } from '../game/types';

function PlayerRow({ s, id }: { s: GameState; id: number }) {
  const p = s.players[id];
  const tiles = tilesOwnedBy(s, id).length;
  return (
    <div className={`pl${s.current === id ? ' active' : ''}${p.alive ? '' : ' out'}`}>
      <div className="dot" style={{ background: p.color }} />
      <div>
        <div className="nm">
          {p.name}
          {p.isBot && <span className="badge bot">bot</span>}
          {p.blackout > 0 && <span className="badge blackout">blackout {p.blackout}</span>}
          {p.generators > 0 && <span className="badge gen">generator ×{p.generators}</span>}
        </div>
        <div className="meta mono">{tiles} {plural(tiles, POLA)} · majątek {p.alive ? netWorth(s, id) : 0} PLN</div>
      </div>
      <div className="cash mono">{p.alive ? `${p.cash} PLN` : '—'}</div>
    </div>
  );
}

function Holdings({ s, dispatch, active }: { s: GameState; dispatch: (a: Action) => void; active: boolean }) {
  const me = s.current;
  const tiles = tilesOwnedBy(s, me);
  if (tiles.length === 0) return <div className="meta">Brak posiadłości.</div>;

  return (
    <div className="holdings">
      {tiles.map((id) => {
        const t = tileAt(id);
        const o = s.own[id];
        const color = t.kind === 'rack' ? GROUPS[t.group].color : '#5b6b7e';
        const buildCost = nodeCostOf(id);
        return (
          <div key={id} className={`hold${o.mortgaged ? ' mort' : ''}`}>
            <div className="swatch" style={{ background: color }} />
            <div>
              <div className="hname">{t.name}</div>
              <div className="hsub mono">
                {o.mortgaged ? 'zahipotekowane' : t.kind === 'rack' ? LEVEL_LABEL[o.level] : t.kind === 'uplink' ? 'łącze' : 'zasilanie'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {canBuild(s, me, id) && (
                <button
                  className="good"
                  disabled={!active || s.players[me].cash < buildCost}
                  title={`Rozbuduj za ${buildCost} PLN`}
                  onClick={() => dispatch({ t: 'BUILD', tile: id })}
                >
                  +{buildCost}
                </button>
              )}
              {canSell(s, me, id) && (
                <button
                  disabled={!active}
                  title={`Demontuj, odzyskaj ${Math.floor(buildCost / 2)} PLN`}
                  onClick={() => dispatch({ t: 'SELL', tile: id })}
                >
                  −{o.level === MAX_LEVEL ? 'HA' : '1'}
                </button>
              )}
              {canMortgage(s, me, id) && (
                <button
                  disabled={!active}
                  title={`Zahipotekuj za ${mortgageValue(id)} PLN`}
                  onClick={() => dispatch({ t: 'MORTGAGE', tile: id })}
                >
                  hip.
                </button>
              )}
              {o.mortgaged && (
                <button
                  disabled={!active || s.players[me].cash < unmortgageCost(id)}
                  title={`Wykup hipotekę za ${unmortgageCost(id)} PLN`}
                  onClick={() => dispatch({ t: 'UNMORTGAGE', tile: id })}
                >
                  wykup
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Log({ s }: { s: GameState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [s.log.length]);
  return (
    <div className="log" ref={ref}>
      {s.log.map((e) => (
        <div key={e.id} className={`entry ${e.kind}`}>{e.text}</div>
      ))}
    </div>
  );
}

export function Sidebar({ s, dispatch, humanControls }: {
  s: GameState;
  dispatch: (a: Action) => void;
  humanControls: boolean;
}) {
  const manageable = humanControls && (s.phase === 'roll' || s.phase === 'end' || s.phase === 'debt');
  return (
    <div className="sidebar">
      <div className="card">
        <h2>Gracze · runda {s.round}{s.mode === 'short' ? ` / ${s.maxRounds}` : ''}</h2>
        <div className="players">
          {s.players.map((p) => <PlayerRow key={p.id} s={s} id={p.id} />)}
        </div>
      </div>
      <div className="card">
        <h2>Posiadłości: {s.players[s.current].name}</h2>
        <Holdings s={s} dispatch={dispatch} active={manageable} />
      </div>
      <div className="card" style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr)', minHeight: 0 }}>
        <h2>Dziennik zdarzeń</h2>
        <Log s={s} />
      </div>
    </div>
  );
}
