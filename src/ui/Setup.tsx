import { useState } from 'react';
import { DEFAULT_MAX_ROUNDS } from '../game/engine';
import { plural, RUNDY } from '../game/plural';
import { PLAYER_COLORS, START_CASH } from '../game/board';
import type { GameMode } from '../game/types';
import type { PlayerSeed } from '../game/engine';

const DEFAULT_NAMES = ['Gracz 1', 'Bot Nagios', 'Bot Ansible', 'Bot Kubelet'];

export function Setup({ onStart }: { onStart: (seeds: PlayerSeed[], mode: GameMode) => void }) {
  const [count, setCount] = useState(4);
  const [mode, setMode] = useState<GameMode>('short');
  const [seeds, setSeeds] = useState<PlayerSeed[]>(
    DEFAULT_NAMES.map((name, i) => ({ name, isBot: i > 0 })),
  );

  const update = (i: number, patch: Partial<PlayerSeed>) =>
    setSeeds((prev) => prev.map((s, j) => (i === j ? { ...s, ...patch } : s)));

  const active = seeds.slice(0, count);

  return (
    <div className="overlay">
      <div className="modal">
        <h1>Serwerownia</h1>
        <div className="sub">
          Gra ekonomiczna o budowaniu infrastruktury. Kupujesz szafy, łącza i zasilanie,
          kompletujesz grupy, rozbudowujesz je i inkasujesz opłaty od konkurencji.
          Każdy zaczyna z {START_CASH} PLN.
        </div>

        <div className="field">
          <span>Liczba graczy</span>
          <div className="row" style={{ display: 'flex', gap: 8 }}>
            {[2, 3, 4].map((n) => (
              <button key={n} className={count === n ? 'primary' : ''} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Gracze</span>
          <div className="pick">
            {active.map((s, i) => (
              <label key={i} style={{ gap: 12 }}>
                <span className="dot" style={{ width: 12, height: 12, borderRadius: '50%', background: PLAYER_COLORS[i] }} />
                <input
                  style={{ flex: 1, background: '#0e1620', border: '1px solid #243040', borderRadius: 6, padding: '6px 9px', color: 'inherit' }}
                  value={s.name}
                  maxLength={18}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
                <button className={s.isBot ? '' : 'primary'} onClick={() => update(i, { isBot: false })}>człowiek</button>
                <button className={s.isBot ? 'primary' : ''} onClick={() => update(i, { isBot: true })}>bot</button>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Tryb</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={mode === 'short' ? 'primary' : ''} onClick={() => setMode('short')}>
              Krótki — {DEFAULT_MAX_ROUNDS} {plural(DEFAULT_MAX_ROUNDS, RUNDY)}
            </button>
            <button className={mode === 'classic' ? 'primary' : ''} onClick={() => setMode('classic')}>
              Klasyczny — do bankructwa
            </button>
          </div>
          <div className="meta" style={{ color: '#8899ab', fontSize: 13 }}>
            {mode === 'short'
              ? 'Po ostatniej rundzie wygrywa największy majątek netto. Partia trwa ok. 20 minut.'
              : 'Gra do ostatniego wypłacalnego gracza. Zabezpieczona twardym limitem 60 rund.'}
          </div>
        </div>

        <div className="actions">
          <button className="primary" onClick={() => onStart(active, mode)}>
            Rozpocznij grę
          </button>
        </div>
      </div>
    </div>
  );
}
