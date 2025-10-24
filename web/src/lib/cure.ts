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

export interface CurePpmSettings {
  cure_ppm_min: number;
  cure_ppm_target: number;
  cure_ppm_max: number;
}

export const DEFAULT_CURE_SETTINGS: CurePpmSettings = {
  cure_ppm_min: 110,
  cure_ppm_target: 125,
  cure_ppm_max: 125,
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

export function calculateRequiredCureGrams(
  baseMassGrams: number,
  cureType: CureType,
  targetPpm: number
): number {
  if (!Number.isFinite(baseMassGrams) || baseMassGrams <= 0) return 0;
  const option = CURE_BY_ID[cureType];
  const nitriteFraction = option.nitritePercent / 100;
  const targetFraction = targetPpm / 1_000_000;
  if (nitriteFraction <= targetFraction) return 0;
  const required = (targetFraction * baseMassGrams) / (nitriteFraction - targetFraction);
  return Number.isFinite(required) && required > 0 ? required : 0;
}

export function calculatePpm(
  cureGrams: number,
  totalMassGrams: number,
  cureType: CureType
): number {
  if (!Number.isFinite(cureGrams) || cureGrams <= 0) return 0;
  if (!Number.isFinite(totalMassGrams) || totalMassGrams <= 0) return 0;
  const option = CURE_BY_ID[cureType];
  const nitriteFraction = option.nitritePercent / 100;
  const nitriteGrams = cureGrams * nitriteFraction;
  return (nitriteGrams / totalMassGrams) * 1_000_000;
}

export type CureStatus = 'LOW' | 'OK' | 'HIGH';

export function evaluateCureStatus(ppm: number, settings: CurePpmSettings): CureStatus {
  if (!Number.isFinite(ppm)) return 'LOW';
  if (ppm < settings.cure_ppm_min) return 'LOW';
  if (ppm > settings.cure_ppm_max) return 'HIGH';
  return 'OK';
}
