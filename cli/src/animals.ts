import type { EdgeAnimal } from './types.js';

/** UHF, then LF, then remote:{Cosva id}. Never a plaque. */
export function scanPayload(animal: EdgeAnimal | null | undefined): string {
  const uhf = String(animal?.rfid_uhf || '').trim();
  if (uhf) return uhf;
  const lf = String(animal?.rfid_lf || '').trim();
  if (lf) return lf;
  const id = String(animal?.id || '').trim();
  return id ? `remote:${id}` : '';
}

export function plaqueCounts(animals: EdgeAnimal[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const animal of animals) {
    const key = String(animal.plaque || '').trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export function animalLabel(
  animal: EdgeAnimal,
  counts: Map<string, number>,
  milkedIds?: Set<string>
): string {
  const plaque = String(animal.plaque || '').trim();
  const name = String(animal.name || '').trim();
  let who = '—';
  if (plaque && name) who = `${plaque} — ${name}`;
  else if (plaque || name) who = plaque || name;
  const rfid = animal.has_rfid ? 'RFID' : 'no RFID';
  const ambiguous = Boolean(plaque) && (counts.get(plaque) || 0) > 1;
  const idBit = ambiguous ? ` · ${animal.id}` : '';
  const milked = milkedIds?.has(String(animal.id)) ? ' · already milked' : '';
  return `${who} · ${rfid}${idBit}${milked}`;
}

export function sortAnimals(
  animals: EdgeAnimal[],
  milkedIds?: Set<string>
): EdgeAnimal[] {
  return [...animals].sort((left, right) => {
    const leftMilked = milkedIds?.has(String(left.id)) ? 1 : 0;
    const rightMilked = milkedIds?.has(String(right.id)) ? 1 : 0;
    if (leftMilked !== rightMilked) return leftMilked - rightMilked;
    return String(left.plaque || left.name || '').localeCompare(
      String(right.plaque || right.name || ''),
      'en',
      { numeric: true }
    );
  });
}
