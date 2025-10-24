export type CureType = 'denkurit' | 'prague1';

export interface CureOption {
  id: CureType;
  label: string;
  nitritePercent: number;
}

export const CURE_OPTIONS: CureOption[] = [
  { id: 'denkurit', label: 'Denkurit', nitritePercent: 11 },
  { id: 'prague1', label: 'Prague Powder #1', nitritePercent: 6.25 },
];

export const CURE_BY_ID: Record<CureType, CureOption> = {
  denkurit: CURE_OPTIONS[0],
  prague1: CURE_OPTIONS[1],
};

const NOTE_KEY = 'cure_type';

export function encodeCureNote(cureType: CureType | null | undefined): string | null {
  if (!cureType) return null;
  return JSON.stringify({ [NOTE_KEY]: cureType });
}

export function parseCureNote(note: unknown): CureType | null {
  if (!note) return null;

  if (typeof note === 'string') {
    try {
      const parsed = JSON.parse(note);
      if (parsed && typeof parsed === 'object' && NOTE_KEY in parsed) {
        const value = (parsed as Record<string, unknown>)[NOTE_KEY];
        if (value === 'denkurit' || value === 'prague1') {
          return value;
        }
      }
    } catch {
      const lowered = note.toLowerCase();
      if (lowered.includes('denkurit')) return 'denkurit';
      if (lowered.includes('prague')) return 'prague1';
    }
    return null;
  }

  if (typeof note === 'object' && NOTE_KEY in (note as Record<string, unknown>)) {
    const value = (note as Record<string, unknown>)[NOTE_KEY];
    if (value === 'denkurit' || value === 'prague1') {
      return value;
    }
  }

  return null;
}
