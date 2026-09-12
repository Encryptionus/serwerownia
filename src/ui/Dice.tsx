const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const on = new Set(PIPS[value] ?? []);
  return (
    <div className={`die${rolling ? ' rolling' : ''}`} aria-label={`kość: ${value}`}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} className={on.has(i) ? '' : 'off'} />)}
    </div>
  );
}

export function Dice({ dice, rolling }: { dice: [number, number] | null; rolling: boolean }) {
  if (!dice) return null;
  return (
    <div className="dice-row">
      <Die value={dice[0]} rolling={rolling} />
      <Die value={dice[1]} rolling={rolling} />
    </div>
  );
}
