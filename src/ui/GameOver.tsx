import { plural, POLA } from '../game/plural';
import { netWorth, tilesOwnedBy } from '../game/selectors';
import type { GameState } from '../game/types';

export function GameOver({ s, onRestart }: { s: GameState; onRestart: () => void }) {
  const rows = s.players
    .map((p) => ({ p, worth: p.alive ? netWorth(s, p.id) : 0, tiles: tilesOwnedBy(s, p.id).length }))
    .sort((a, b) => b.worth - a.worth);

  return (
    <div className="overlay">
      <div className="modal">
        <h1>Koniec gry</h1>
        <div className="sub">
          {s.winner !== null
            ? `Wygrywa ${s.players[s.winner].name}.`
            : 'Nikt nie utrzymał infrastruktury.'}
        </div>

        <div className="results">
          {rows.map((r, i) => (
            <div key={r.p.id} className={`result-row${r.p.id === s.winner ? ' win' : ''}`}>
              <div className="rank mono">{i + 1}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.p.color }} />
                  {r.p.name}
                  {r.p.isBot && <span className="badge bot">bot</span>}
                  {!r.p.alive && <span className="badge blackout">bankrut</span>}
                </div>
                <div className="meta mono" style={{ color: '#8899ab', fontSize: 12 }}>
                  {r.tiles} {plural(r.tiles, POLA)} · gotówka {r.p.cash} PLN
                </div>
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{r.worth} PLN</div>
            </div>
          ))}
        </div>

        <div className="actions">
          <button className="primary" onClick={onRestart}>Nowa gra</button>
        </div>
      </div>
    </div>
  );
}
