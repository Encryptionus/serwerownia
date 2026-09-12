import { useMemo, useState } from 'react';
import { GROUPS } from '../game/board';
import { tileAt, tilesOwnedBy } from '../game/selectors';
import type { GameState, TradeOffer } from '../game/types';

function tradable(s: GameState, owner: number): number[] {
  return tilesOwnedBy(s, owner).filter((id) => s.own[id].level === 0);
}

function TileList({ s, ids, picked, toggle }: {
  s: GameState; ids: number[]; picked: Set<number>; toggle: (id: number) => void;
}) {
  if (ids.length === 0) return <div className="meta" style={{ color: '#8899ab', fontSize: 13 }}>Brak pól do wymiany.</div>;
  return (
    <div className="pick">
      {ids.map((id) => {
        const t = tileAt(id);
        const color = t.kind === 'rack' ? GROUPS[t.group].color : '#5b6b7e';
        return (
          <label key={id}>
            <input type="checkbox" checked={picked.has(id)} onChange={() => toggle(id)} />
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ flex: 1 }}>{t.name}</span>
            {s.own[id].mortgaged && <span className="badge blackout">hip.</span>}
          </label>
        );
      })}
    </div>
  );
}

export function TradeDialog({ s, me, onSubmit, onClose, notice }: {
  s: GameState;
  me: number;
  onSubmit: (offer: TradeOffer) => void;
  onClose: () => void;
  notice: string | null;
}) {
  const partners = s.players.filter((p) => p.alive && p.id !== me);
  const [to, setTo] = useState(partners[0]?.id ?? 0);
  const [give, setGive] = useState<Set<number>>(new Set());
  const [want, setWant] = useState<Set<number>>(new Set());
  const [giveCash, setGiveCash] = useState(0);
  const [wantCash, setWantCash] = useState(0);

  const mine = useMemo(() => tradable(s, me), [s, me]);
  const theirs = useMemo(() => tradable(s, to), [s, to]);

  const toggle = (set: Set<number>, setter: (v: Set<number>) => void) => (id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const offer: TradeOffer = {
    from: me, to,
    giveTiles: [...give], giveCash,
    wantTiles: [...want], wantCash,
  };
  const empty = offer.giveTiles.length + offer.wantTiles.length + giveCash + wantCash === 0;
  const overCash = giveCash > s.players[me].cash || wantCash > s.players[to].cash;

  return (
    <div className="overlay">
      <div className="modal">
        <h1>Wymiana</h1>
        <div className="sub">
          Pola z rozbudową trzeba najpierw zdemontować. Hipoteka przechodzi razem z polem.
        </div>

        <div className="field">
          <span>Partner</span>
          <select value={to} onChange={(e) => { setTo(Number(e.target.value)); setWant(new Set()); setWantCash(0); }}>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.isBot ? ' (bot)' : ''}</option>
            ))}
          </select>
        </div>

        <div className="two-col" style={{ marginTop: 14 }}>
          <div>
            <h2 style={{ fontSize: 12, color: '#8899ab', letterSpacing: '.14em', textTransform: 'uppercase' }}>
              Oddajesz
            </h2>
            <TileList s={s} ids={mine} picked={give} toggle={toggle(give, setGive)} />
            <div className="field">
              <span>Gotówka (masz {s.players[me].cash})</span>
              <input
                type="number" min={0} max={s.players[me].cash} step={10} value={giveCash}
                onChange={(e) => setGiveCash(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 12, color: '#8899ab', letterSpacing: '.14em', textTransform: 'uppercase' }}>
              Otrzymujesz
            </h2>
            <TileList s={s} ids={theirs} picked={want} toggle={toggle(want, setWant)} />
            <div className="field">
              <span>Gotówka (partner ma {s.players[to].cash})</span>
              <input
                type="number" min={0} max={s.players[to].cash} step={10} value={wantCash}
                onChange={(e) => setWantCash(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
        </div>

        {notice && (
          <div className="card" style={{ marginTop: 14, borderColor: '#5d2429', background: '#2a1517' }}>
            {notice}
          </div>
        )}

        <div className="actions">
          <button onClick={onClose}>Zamknij</button>
          <button className="primary" disabled={empty || overCash} onClick={() => onSubmit(offer)}>
            Złóż ofertę
          </button>
        </div>
      </div>
    </div>
  );
}

export function IncomingOffer({ s, offer, onAccept, onReject }: {
  s: GameState;
  offer: TradeOffer;
  onAccept: () => void;
  onReject: () => void;
}) {
  const names = (ids: number[], cash: number) => {
    const parts = ids.map((id) => tileAt(id).name);
    if (cash > 0) parts.push(`${cash} PLN`);
    return parts.length ? parts.join(' + ') : 'nic';
  };
  return (
    <div className="overlay">
      <div className="modal" style={{ width: 'min(520px, 100%)' }}>
        <h1>Oferta wymiany</h1>
        <div className="sub">
          <b>{s.players[offer.from].name}</b> proponuje wymianę graczowi <b>{s.players[offer.to].name}</b>.
        </div>
        <div className="results">
          <div className="result-row">
            <div className="rank">→</div>
            <div><div style={{ fontWeight: 600 }}>Dostajesz</div><div className="meta">{names(offer.giveTiles, offer.giveCash)}</div></div>
            <div />
          </div>
          <div className="result-row">
            <div className="rank">←</div>
            <div><div style={{ fontWeight: 600 }}>Oddajesz</div><div className="meta">{names(offer.wantTiles, offer.wantCash)}</div></div>
            <div />
          </div>
        </div>
        <div className="actions">
          <button onClick={onReject}>Odrzuć</button>
          <button className="good" onClick={onAccept}>Przyjmij</button>
        </div>
      </div>
    </div>
  );
}
