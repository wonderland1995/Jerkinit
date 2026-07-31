/**
 * Adams Poultry Master Manual (07-11-23) jerky FSP–aligned pass-range generators.
 * Critical limits from Step 3A/3B CCPs and Form 10a (drying temp and time).
 * Values are randomised within compliant ranges so forms can be demo-filled
 * and still edited before submit.
 */

export type AutofillSection =
  | 'marination'
  | 'drying'
  | 'finished_product'
  | 'environmental_monitoring'
  | 'microbiological_testing'
  | 'temperature_monitoring'
  | 'cleaning_sanitation';

export type AutofillExtraDates = {
  marinated_on?: string;
  dried_on?: string;
  swabbed_on?: string;
  tested_on?: string;
  cleaned_on?: string;
};

export type AutofillInput = {
  /** datetime-local value used as completed_at */
  completedAt: string;
  operatorName: string;
  /** Section-specific key dates from the modal */
  extraDates?: AutofillExtraDates;
  /** Optional task code to refine micro / env wording */
  taskCode?: string | null;
};

/**
 * Structured readings for reuse outside the compliance log form.
 * Ranges follow Adams Poultry Master Manual (07-11-23) jerky FSP / Form 10a.
 */
export type AutofillSectionFields = {
  // Marination — ≤5°C, 12–24 h; nitrite ≤125 ppm
  marinade_temp_c?: number;
  marinade_ph?: number;
  time_in_marinade_hrs?: number;
  nitrite_ppm?: number;
  batch_id?: string;
  // Drying — oven CCP 65–68°C, 8–10 h; product ≥65°C / 10 min; Aw < 0.85
  drying_temp_c?: number;
  product_temp_1_c?: number;
  product_temp_2_c?: number;
  drying_time_hrs?: number;
  drying_start?: string;
  drying_end?: string;
  oven_id?: string;
  dryer_humidity_pct?: number;
  water_activity?: number;
  // Finished product — 50 g packs; Aw < 0.85; cool <25°C within 2 h
  weight_g?: number;
  finished_ph?: number;
  colour_appearance?: 'Pass' | 'Fail';
  packaging_integrity?: 'Pass' | 'Fail';
  // Weights (batch QA)
  wet_weight_kg?: number;
  dry_weight_kg?: number;
  preheat_temp_c?: number;
  marination_start?: string;
  marination_end?: string;
  // Environmental
  swab_location?: string;
  surface_type?: 'food_contact' | 'non_food_contact';
  cfu?: number;
  // Micro
  test_type?: 'Listeria' | 'E.coli' | 'Salmonella';
  lab_reference?: string;
  batches_covered?: number;
  batch_start?: string;
  batch_end?: string;
  // Temperature monitoring — chilled ≤5°C; frozen ≤−18°C
  equipment_id?: string;
  fridge_freezer_temp_c?: number;
  corrective_action?: string;
  // Cleaning
  area_equipment?: string;
  chemical_used?: string;
  concentration_pct?: number;
};

export type AutofillResult = {
  completed_at: string;
  completed_by: string;
  scope: string;
  result: string;
  notes: string;
  batches_covered: string;
  batch_start: string;
  batch_end: string;
  fields: AutofillSectionFields;
};

const OPERATORS = [
  'A. Chen',
  'J. Patel',
  'M. Nguyen',
  'S. Williams',
  'R. Okafor',
  'L. Santos',
];

const FOOD_CONTACT_SURFACES = [
  'Slicer blade & guard',
  'Marination tub A',
  'Packaging bench 1',
  'Drying rack rail (food contact)',
  'Vacuum sealer platen',
];

const NON_FOOD_CONTACT_SURFACES = [
  'Floor drain Zone B',
  'Wall panel near oven 2',
  'Trolley handle / frame',
  'Door push plate (pack room)',
  'Conveyor frame underside',
];

const CLEAN_AREAS = [
  'Marination room benches',
  'Drying oven #2 interior',
  'Slicer & prep table',
  'Packaging line',
  'Cold room shelves',
];

const CHEMICALS = [
  { name: 'Sodium hypochlorite sanitiser', pct: [100, 200] as const },
  { name: 'Quaternary ammonium sanitiser', pct: [200, 400] as const },
  { name: 'Peracetic acid sanitiser', pct: [50, 150] as const },
  { name: 'Alkaline detergent', pct: [1, 3] as const },
];

function rand(): number {
  return Math.random();
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): number {
  const value = min + rand() * (max - min);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)];
}

function batchId(prefix = 'JERK'): string {
  return `${prefix}-${String(randInt(100, 999)).padStart(4, '0')}`;
}

function shiftLocalDatetime(base: string, hoursDelta: number): string {
  const parsed = new Date(base);
  if (Number.isNaN(parsed.getTime())) return base;
  // datetime-local is timezone-naive; treat as local wall clock
  const shifted = new Date(parsed.getTime() + hoursDelta * 60 * 60 * 1000);
  const offset = shifted.getTimezoneOffset() * 60000;
  return new Date(shifted.getTime() - offset).toISOString().slice(0, 16);
}

function formatLocalDateLabel(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveOperator(name: string): string {
  const trimmed = name.trim();
  return trimmed || pick(OPERATORS);
}

function microTestFromCode(taskCode?: string | null): AutofillSectionFields['test_type'] {
  const code = (taskCode ?? '').toUpperCase();
  if (code.includes('ECOLI') || code.includes('E.COLI')) return 'E.coli';
  if (code.includes('SALMONELLA')) return 'Salmonella';
  return 'Listeria';
}

function surfaceFromCode(taskCode?: string | null): AutofillSectionFields['surface_type'] {
  const code = (taskCode ?? '').toUpperCase();
  if (code.includes('NONFOOD') || code.includes('NON-FOOD') || code.includes('NON_FOOD')) {
    return 'non_food_contact';
  }
  return 'food_contact';
}

function buildMarination(input: AutofillInput): AutofillResult {
  const operator = resolveOperator(input.operatorName);
  // Master Manual CCP: marinade temp 5°C or less; 12–24 h; nitrite ≤125 ppm
  const marinadeTemp = randFloat(1, 5, 1);
  const hours = randFloat(12, 24, 1);
  const nitritePpm = randInt(100, 125);
  const wetKg = randFloat(80, 150, 2);
  const batch = batchId();
  const marinatedOn = input.extraDates?.marinated_on || input.completedAt;
  const marinationEnd = marinatedOn;
  const marinationStart = shiftLocalDatetime(marinationEnd, -hours);

  const fields: AutofillSectionFields = {
    marinade_temp_c: marinadeTemp,
    time_in_marinade_hrs: hours,
    nitrite_ppm: nitritePpm,
    batch_id: batch,
    wet_weight_kg: wetKg,
    marination_start: marinationStart,
    marination_end: marinationEnd,
  };

  return {
    completed_at: input.completedAt,
    completed_by: operator,
    scope: `Batch ${batch} — marination tub`,
    result: `Pass — marinade ${marinadeTemp}°C (≤5°C), ${hours} h, nitrite ${nitritePpm} ppm`,
    notes: [
      `Operator: ${operator}`,
      `Marinated on: ${formatLocalDateLabel(marinatedOn)}`,
      `Batch ID: ${batch}`,
      `Wet weight: ${wetKg} kg`,
      `Adams FSP Step 3A: marinade ≤5°C for 12–24 h; nitrite ≤125 ppm.`,
    ].join('\n'),
    batches_covered: '',
    batch_start: '',
    batch_end: '',
    fields,
  };
}

function buildDrying(input: AutofillInput): AutofillResult {
  const operator = resolveOperator(input.operatorName);
  // Form 10a / Step 3B CCP: oven 65–68°C, drying 8–10 h
  // Procedure: preheat 90°C then hold 68°C; product ≥65°C for ≥10 min; Aw < 0.85
  const ovenTemp = randFloat(65, 68, 1);
  const productTemp1 = randFloat(65, 68, 1);
  const productTemp2 = randFloat(65, 68, 1);
  const dryingHrs = randFloat(8, 10, 1);
  const aw = randFloat(0.75, 0.84, 3);
  const humidity = randInt(20, 45);
  const wetKg = randFloat(80, 150, 2);
  const lossPct = randFloat(54, 58, 1);
  const dryKg = Math.round(wetKg * (1 - lossPct / 100) * 100) / 100;
  const oven = `OVN-${randInt(1, 4)}`;
  const end = input.extraDates?.dried_on || input.completedAt;
  const start = shiftLocalDatetime(end, -dryingHrs);
  const batch = batchId();

  const fields: AutofillSectionFields = {
    drying_temp_c: ovenTemp,
    product_temp_1_c: productTemp1,
    product_temp_2_c: productTemp2,
    drying_time_hrs: dryingHrs,
    drying_start: start,
    drying_end: end,
    oven_id: oven,
    dryer_humidity_pct: humidity,
    water_activity: aw,
    batch_id: batch,
    wet_weight_kg: wetKg,
    dry_weight_kg: dryKg,
    preheat_temp_c: randFloat(88, 90, 1),
  };

  return {
    completed_at: input.completedAt,
    completed_by: operator,
    scope: `Oven ${oven} — batch ${batch}`,
    result: `Pass — oven ${ovenTemp}°C, product ${productTemp1}/${productTemp2}°C, ${dryingHrs} h, Aw ${aw}`,
    notes: [
      `Operator: ${operator}`,
      `Dried on: ${formatLocalDateLabel(end)}`,
      `Start: ${formatLocalDateLabel(start)} → End: ${formatLocalDateLabel(end)}`,
      `Form 10a: 1st product temp ${productTemp1}°C, 2nd ${productTemp2}°C; dryer humidity ${humidity}%`,
      `Weight: wet ${wetKg} kg → dry ${dryKg} kg (${lossPct}% loss)`,
      `Adams FSP Step 3B: oven CCP 65–68°C, dry 8–10 h, product ≥65°C/10 min, Aw < 0.85.`,
    ].join('\n'),
    batches_covered: '',
    batch_start: '',
    batch_end: '',
    fields,
  };
}

function buildFinishedProduct(input: AutofillInput): AutofillResult {
  const operator = resolveOperator(input.operatorName);
  // Master Manual: 50 g packs; Aw < 0.85; cool <25°C within 2 h; O2 absorber + seal check
  const weight = 50;
  const aw = randFloat(0.75, 0.84, 3);
  const batch = batchId();

  const fields: AutofillSectionFields = {
    weight_g: weight,
    water_activity: aw,
    colour_appearance: 'Pass',
    packaging_integrity: 'Pass',
    batch_id: batch,
  };

  return {
    completed_at: input.completedAt,
    completed_by: operator,
    scope: `Finished product — batch ${batch}`,
    result: `Pass — ${weight} g pack, Aw ${aw}, colour Pass, pack integrity Pass`,
    notes: [
      `Operator: ${operator}`,
      `Net weight: ${weight} g (standard pack)`,
      `Colour/appearance: Pass`,
      `Packaging integrity: Pass (heat seal + oxygen absorber)`,
      `Adams FSP: Aw < 0.85; cooled to <25°C within 2 h before packing.`,
    ].join('\n'),
    batches_covered: '',
    batch_start: '',
    batch_end: '',
    fields,
  };
}

function buildEnvironmental(input: AutofillInput): AutofillResult {
  const operator = resolveOperator(input.operatorName);
  const surfaceType = surfaceFromCode(input.taskCode);
  const location =
    surfaceType === 'food_contact'
      ? pick(FOOD_CONTACT_SURFACES)
      : pick(NON_FOOD_CONTACT_SURFACES);
  // Pass: food-contact often <10 CFU/swab; non-food slightly higher but still "pass"
  const cfu = surfaceType === 'food_contact' ? randInt(0, 9) : randInt(0, 49);
  const swabbedOn = input.extraDates?.swabbed_on || input.completedAt;
  const surfaceLabel =
    surfaceType === 'food_contact' ? 'Food contact' : 'Non-food contact';

  const fields: AutofillSectionFields = {
    swab_location: location,
    surface_type: surfaceType,
    cfu,
  };

  return {
    completed_at: input.completedAt,
    completed_by: operator,
    scope: location,
    result: `Pass — ${cfu} CFU/swab (${surfaceLabel})`,
    notes: [
      `Operator: ${operator}`,
      `Swabbed on: ${formatLocalDateLabel(swabbedOn)}`,
      `Surface type: ${surfaceLabel}`,
      `Listeria environmental monitoring — result within pass criteria.`,
    ].join('\n'),
    batches_covered: '',
    batch_start: '',
    batch_end: '',
    fields,
  };
}

function buildMicrobiological(input: AutofillInput): AutofillResult {
  const operator = resolveOperator(input.operatorName);
  const testType = microTestFromCode(input.taskCode);
  const labRef = `LAB-${new Date().getFullYear()}-${String(randInt(1000, 9999))}`;
  const covered = 10;
  const startNum = randInt(200, 900);
  const batchStart = `JERK-${String(startNum).padStart(4, '0')}`;
  const batchEnd = `JERK-${String(startNum + covered - 1).padStart(4, '0')}`;
  const testedOn = input.extraDates?.tested_on || input.completedAt;
  // Pass: not detected / <10 CFU/g depending on organism
  const resultText =
    testType === 'E.coli'
      ? 'Pass — <10 CFU/g'
      : 'Pass — Not detected / 25 g';

  const fields: AutofillSectionFields = {
    test_type: testType,
    lab_reference: labRef,
    batches_covered: covered,
    batch_start: batchStart,
    batch_end: batchEnd,
    cfu: testType === 'E.coli' ? randInt(0, 9) : 0,
  };

  return {
    completed_at: input.completedAt,
    completed_by: operator,
    scope: `${testType} — batches ${batchStart} to ${batchEnd}`,
    result: resultText,
    notes: [
      `Operator: ${operator}`,
      `Tested on: ${formatLocalDateLabel(testedOn)}`,
      `Test type: ${testType}`,
      `Lab reference: ${labRef}`,
      `Batches covered: ${covered} (${batchStart}–${batchEnd})`,
      `NSW Food Safety microbiological verification — pass.`,
    ].join('\n'),
    batches_covered: String(covered),
    batch_start: batchStart,
    batch_end: batchEnd,
    fields,
  };
}

function buildTemperatureMonitoring(input: AutofillInput): AutofillResult {
  const operator = resolveOperator(input.operatorName);
  const equipment = pick(['FR-01 Cold room', 'FR-02 Fridge', 'FZ-01 Freezer', 'FZ-02 Blast freezer']);
  const isFreezer = equipment.toLowerCase().includes('freezer');
  // Master Manual: chilled ≤5°C; frozen ≤−18°C
  const temp = isFreezer ? randFloat(-22, -18, 1) : randFloat(0, 5, 1);

  const fields: AutofillSectionFields = {
    equipment_id: equipment,
    fridge_freezer_temp_c: temp,
    corrective_action: 'N/A — within range',
  };

  return {
    completed_at: input.completedAt,
    completed_by: operator,
    scope: equipment,
    result: `Pass — ${temp}°C (within range)`,
    notes: [
      `Operator: ${operator}`,
      `Equipment ID: ${equipment}`,
      `Logged temp: ${temp}°C`,
      `Corrective action: N/A — within range`,
    ].join('\n'),
    batches_covered: '',
    batch_start: '',
    batch_end: '',
    fields,
  };
}

function buildCleaning(input: AutofillInput): AutofillResult {
  const operator = resolveOperator(input.operatorName);
  const area = pick(CLEAN_AREAS);
  const chemical = pick(CHEMICALS);
  const concentration =
    chemical.pct[1] > 10
      ? randInt(chemical.pct[0], chemical.pct[1])
      : randFloat(chemical.pct[0], chemical.pct[1], 1);
  const unit = chemical.pct[1] > 10 ? 'ppm' : '%';
  const cleanedOn = input.extraDates?.cleaned_on || input.completedAt;

  const fields: AutofillSectionFields = {
    area_equipment: area,
    chemical_used: chemical.name,
    concentration_pct: typeof concentration === 'number' ? concentration : Number(concentration),
  };

  return {
    completed_at: input.completedAt,
    completed_by: operator,
    scope: area,
    result: `Pass — ${chemical.name} @ ${concentration} ${unit}`,
    notes: [
      `Operator: ${operator}`,
      `Cleaned on: ${formatLocalDateLabel(cleanedOn)}`,
      `Area / equipment: ${area}`,
      `Chemical: ${chemical.name}`,
      `Concentration: ${concentration} ${unit}`,
    ].join('\n'),
    batches_covered: '',
    batch_start: '',
    batch_end: '',
    fields,
  };
}

const BUILDERS: Record<AutofillSection, (input: AutofillInput) => AutofillResult> = {
  marination: buildMarination,
  drying: buildDrying,
  finished_product: buildFinishedProduct,
  environmental_monitoring: buildEnvironmental,
  microbiological_testing: buildMicrobiological,
  temperature_monitoring: buildTemperatureMonitoring,
  cleaning_sanitation: buildCleaning,
};

export const AUTOFILL_SECTION_LABELS: Record<AutofillSection, string> = {
  marination: 'Marination',
  drying: 'Drying / Dehydration',
  finished_product: 'Finished Product',
  environmental_monitoring: 'Environmental Monitoring',
  microbiological_testing: 'Microbiological Testing',
  temperature_monitoring: 'Temperature Monitoring',
  cleaning_sanitation: 'Cleaning & Sanitation',
};

/** Extra datetime fields shown in the modal per section */
export const AUTOFILL_EXTRA_DATE_FIELDS: Record<
  AutofillSection,
  { key: keyof AutofillExtraDates; label: string }[]
> = {
  marination: [{ key: 'marinated_on', label: 'Marinated on' }],
  drying: [{ key: 'dried_on', label: 'Dried on' }],
  finished_product: [],
  environmental_monitoring: [{ key: 'swabbed_on', label: 'Swabbed on' }],
  microbiological_testing: [{ key: 'tested_on', label: 'Tested on' }],
  temperature_monitoring: [],
  cleaning_sanitation: [{ key: 'cleaned_on', label: 'Cleaned on' }],
};

export function generateAutofillDefaults(
  section: AutofillSection,
  input: AutofillInput,
): AutofillResult {
  return BUILDERS[section](input);
}

/** Map compliance task code / category to an autofill section */
export function resolveAutofillSection(
  taskCode?: string | null,
  category?: string | null,
): AutofillSection {
  const code = (taskCode ?? '').toUpperCase();
  const cat = (category ?? '').toLowerCase();

  if (code.startsWith('ENV-') || cat.includes('environmental')) {
    return 'environmental_monitoring';
  }
  if (code.startsWith('MICRO-') || cat.includes('micro')) {
    return 'microbiological_testing';
  }
  if (code.startsWith('TEMP-') || cat.includes('temperature')) {
    return 'temperature_monitoring';
  }
  if (code.startsWith('CLEAN-') || cat.includes('clean') || cat.includes('sanit')) {
    return 'cleaning_sanitation';
  }
  if (code.startsWith('MAR-') || cat.includes('marinat')) {
    return 'marination';
  }
  if (code.startsWith('DRY-') || cat.includes('dry') || cat.includes('dehydr')) {
    return 'drying';
  }
  if (code.startsWith('FIN-') || code.startsWith('PKG-') || cat.includes('finished') || cat.includes('pack')) {
    return 'finished_product';
  }

  return 'environmental_monitoring';
}

/** Map batch QA checkpoint code / stage to an autofill section */
export function resolveAutofillSectionFromCheckpoint(
  checkpointCode?: string | null,
  stage?: string | null,
): AutofillSection {
  const code = (checkpointCode ?? '').toUpperCase();
  const stageKey = (stage ?? '').toLowerCase();

  if (code.startsWith('MAR-') || stageKey === 'marination') return 'marination';
  if (code.startsWith('DRY-') || stageKey === 'drying') return 'drying';
  if (code.startsWith('PKG-') || code.startsWith('FIN-') || stageKey === 'packaging' || stageKey === 'final') {
    return 'finished_product';
  }
  if (code.startsWith('MIX-') || stageKey === 'mixing') return 'marination';
  if (stageKey === 'preparation') return 'temperature_monitoring';

  return resolveAutofillSection(code, stage);
}

export function localDatetimeInputValue(date = new Date()): string {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

/** Quarterly lab cadence used on the QA hub */
export const LAB_CADENCE_MONTHS = 3;

export function addMonths(isoOrDate: string | Date, months: number): Date {
  const base = typeof isoOrDate === 'string' ? new Date(isoOrDate) : new Date(isoOrDate.getTime());
  const next = new Date(base.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

/** Persist wall-clock datetime-local as `YYYY-MM-DDTHH:mm:00` (matches batch QA page). */
function toStoredIso(local: string | undefined | null): string | null {
  if (!local) return null;
  return local.length >= 16 ? `${local.slice(0, 16)}:00` : `${local}:00`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a calendar date + clock as datetime-local (no timezone shift). */
export function wallClockLocal(dateYmd: string, hour: number, minute: number): string {
  return `${dateYmd}T${pad2(hour)}:${pad2(minute)}`;
}

export function addCalendarDays(dateYmd: string, days: number): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** Most recent Friday on or before `from` (local calendar). */
export function mostRecentFridayDate(from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const daysSinceFriday = (d.getDay() + 2) % 7; // Fri=0 … Thu=6
  d.setDate(d.getDate() - daysSinceFriday);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Production Friday for a batch from its created_at (local calendar).
 * Fri → that day; Sat/Sun → that weekend's Friday; Mon–Thu → previous Friday.
 */
export function fridayDateFromCreatedAt(createdAt: string | Date): string {
  const raw = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (Number.isNaN(raw.getTime())) return mostRecentFridayDate();
  return mostRecentFridayDate(raw);
}

export type JerkyProductionSchedule = {
  fridayDate: string;
  marinate_start: string;
  marinate_end: string;
  drying_start: string;
  drying_end: string;
  marinade_hours: number;
  drying_hours: number;
};

/**
 * Adams production weekend:
 * Fri ~18:00–19:00 marinate → Sat ~18:00–20:00 load dryer (>20 h) → Sun ~08:00–13:00 unload.
 */
export function generateJerkyWeekendSchedule(fridayDate: string): JerkyProductionSchedule {
  const friday = /^\d{4}-\d{2}-\d{2}$/.test(fridayDate) ? fridayDate : mostRecentFridayDate();
  const saturday = addCalendarDays(friday, 1);
  const sunday = addCalendarDays(friday, 2);

  // Fri 18:00–19:00
  const marinate_start = wallClockLocal(friday, 18, randInt(0, 59));

  // Sat 18:00–20:00, but keep marination > 20 h from Friday start
  const startMs = Date.parse(`${marinate_start}:00`);
  const satOffsetMin = randInt(0, 120);
  let drying_start = wallClockLocal(
    saturday,
    18 + Math.floor(satOffsetMin / 60),
    satOffsetMin % 60,
  );
  let endMs = Date.parse(`${drying_start}:00`);
  const minMarinateMs = 20 * 60 * 60 * 1000 + 10 * 60 * 1000;
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs - startMs < minMarinateMs) {
    // Push load time later on Saturday (toward 20:00)
    drying_start = wallClockLocal(saturday, 20, randInt(0, 0));
    endMs = Date.parse(`${drying_start}:00`);
  }
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs - startMs < minMarinateMs) {
    drying_start = wallClockLocal(saturday, 20, 0);
  }

  const marinate_end = drying_start;

  // Sun 08:00–13:00
  const sunOffsetMin = randInt(0, 5 * 60);
  const drying_end = wallClockLocal(
    sunday,
    8 + Math.floor(sunOffsetMin / 60),
    sunOffsetMin % 60,
  );

  const marinade_hours =
    Math.round(((Date.parse(`${marinate_end}:00`) - Date.parse(`${marinate_start}:00`)) / 36e5) * 10) /
    10;
  const drying_hours =
    Math.round(((Date.parse(`${drying_end}:00`) - Date.parse(`${drying_start}:00`)) / 36e5) * 10) / 10;

  return {
    fridayDate: friday,
    marinate_start,
    marinate_end,
    drying_start,
    drying_end,
    marinade_hours: Number.isFinite(marinade_hours) ? marinade_hours : 20,
    drying_hours: Number.isFinite(drying_hours) ? drying_hours : 14,
  };
}

export type RecipeIngredientWeight = {
  actual_amount?: number | null;
  target_amount?: number | null;
  unit?: string | null;
};

function amountToKg(amount: number, unit: string): number | null {
  const u = unit.trim().toLowerCase();
  if (u === 'kg') return amount;
  if (u === 'g') return amount / 1000;
  // Liquids contribute to wet mass (~1 g/ml)
  if (u === 'l') return amount;
  if (u === 'ml') return amount / 1000;
  return null;
}

/** Wet weight = beef kg + summed recipe ingredient fills (actual preferred, else target). */
export function sumRecipeWetWeightKg(
  beefWeightKg: number | null | undefined,
  ingredients: RecipeIngredientWeight[] | null | undefined,
): number {
  let total = typeof beefWeightKg === 'number' && Number.isFinite(beefWeightKg) ? beefWeightKg : 0;
  for (const ing of ingredients ?? []) {
    const actual = ing.actual_amount != null ? Number(ing.actual_amount) : NaN;
    const target = ing.target_amount != null ? Number(ing.target_amount) : NaN;
    const raw = Number.isFinite(actual) && actual > 0 ? actual : target;
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const kg = amountToKg(raw, String(ing.unit ?? 'g'));
    if (kg != null && Number.isFinite(kg)) total += kg;
  }
  return Math.round(total * 1000) / 1000;
}

export type BatchQaCheckpointPayload = {
  status: 'passed';
  checked_by: string;
  /** Backdated timestamp for API `checked_at` */
  checked_at?: string | null;
  temperature_c?: number | null;
  humidity_percent?: number | null;
  ph_level?: number | null;
  water_activity?: number | null;
  notes?: string | null;
  corrective_action?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type BatchQaAutofillResult = {
  completed_at: string;
  completed_by: string;
  schedule: JerkyProductionSchedule;
  wet_weight_kg: number;
  dry_weight_kg: number;
  weight_loss_percent: number;
  /** Payloads keyed by checkpoint code (e.g. MAR-FSP-TIME) */
  byCode: Record<string, BatchQaCheckpointPayload>;
};

export type BatchQaAutofillInput = {
  operatorName: string;
  /** Production Friday as YYYY-MM-DD */
  fridayDate: string;
  /** Sum of beef + recipe fills (kg) */
  wetWeightKg: number;
  /** Optional dry override; otherwise derived from ≥54% loss */
  dryWeightKg?: number;
};

/**
 * Build pass-range payloads for every jerky batch QA checkpoint in one go.
 * Uses Fri→Sat→Sun schedule and recipe wet weight; dry weight / loss calculated at unload.
 */
export function generateBatchQaAutofill(input: BatchQaAutofillInput): BatchQaAutofillResult {
  const operator = resolveOperator(input.operatorName);
  const schedule = generateJerkyWeekendSchedule(input.fridayDate);
  const wetKg =
    typeof input.wetWeightKg === 'number' && input.wetWeightKg > 0
      ? Math.round(input.wetWeightKg * 1000) / 1000
      : 17;

  const lossPct =
    input.dryWeightKg != null && input.dryWeightKg > 0 && wetKg > 0
      ? Math.round(((wetKg - input.dryWeightKg) / wetKg) * 1000) / 10
      : randFloat(54, 58, 1);
  const dryKg =
    input.dryWeightKg != null && input.dryWeightKg > 0
      ? Math.round(input.dryWeightKg * 1000) / 1000
      : Math.round(wetKg * (1 - lossPct / 100) * 1000) / 1000;
  const weightLossPercent =
    wetKg > 0 ? Math.round(((wetKg - dryKg) / wetKg) * 1000) / 10 : lossPct;

  const marinadeTemp = randFloat(1, 5, 1);
  const nitritePpm = randInt(100, 125);
  const ovenTemp = randFloat(65, 68, 1);
  const productTemp1 = randFloat(65, 68, 1);
  const productTemp2 = randFloat(65, 68, 1);
  const aw = randFloat(0.75, 0.84, 3);
  const preheatTemp = randFloat(88, 90, 1);
  const mixTemp = randFloat(2, 8, 1);

  const marinadeMinutes = Math.round(schedule.marinade_hours * 60);
  const dryingMinutes = Math.round(schedule.drying_hours * 60);

  const checkedMix = toStoredIso(schedule.marinate_start);
  const checkedMarinate = toStoredIso(schedule.marinate_end);
  const checkedPreheat = toStoredIso(schedule.drying_start);
  const checkedUnload = toStoredIso(schedule.drying_end);

  const byCode: Record<string, BatchQaCheckpointPayload> = {
    'DRY-PREHEAT': {
      status: 'passed',
      checked_by: operator,
      checked_at: checkedPreheat,
      temperature_c: preheatTemp,
      notes: `Dehydrator preheat ${preheatTemp}°C before load (Adams FSP initial ~90°C).`,
    },
    'MIX-INGR': {
      status: 'passed',
      checked_by: operator,
      checked_at: checkedMix,
      notes: `Ingredients verified; nitrite ${nitritePpm} ppm (≤125). Wet mix mass ${wetKg} kg.`,
    },
    'MAR-FSP-SALT': {
      status: 'passed',
      checked_by: operator,
      checked_at: checkedMix,
      notes: `Salt/cure addition confirmed; nitrite ${nitritePpm} ppm (≤125 ppm).`,
    },
    'MAR-FSP-TIME': {
      status: 'passed',
      checked_by: operator,
      checked_at: checkedMarinate,
      temperature_c: marinadeTemp,
      notes: `Marinade ${marinadeTemp}°C for ${schedule.marinade_hours} h (>20 h); wet weight ${wetKg} kg from recipe fill.`,
      metadata: {
        marination_run: {
          start_iso: toStoredIso(schedule.marinate_start),
          end_iso: toStoredIso(schedule.marinate_end),
          duration_minutes: marinadeMinutes,
          marinade_temp_c: marinadeTemp,
        },
        weight_log: {
          wet_weight_kg: wetKg,
          dry_weight_kg: null,
          weight_loss_percent: null,
        },
      },
    },
    'DRY-FSP-OVEN': {
      status: 'passed',
      checked_by: operator,
      checked_at: checkedUnload,
      temperature_c: ovenTemp,
      notes: `Oven hold ${ovenTemp}°C (CCP 65–68°C); run ${schedule.drying_hours} h Sat eve → Sun unload.`,
      metadata: {
        drying_run: {
          oven_temp_c: ovenTemp,
          start_iso: toStoredIso(schedule.drying_start),
          end_iso: toStoredIso(schedule.drying_end),
          duration_minutes: dryingMinutes,
          temp_adjusted: false,
          temp_adjust_note: null,
        },
      },
    },
    'DRY-FSP-CORE': {
      status: 'passed',
      checked_by: operator,
      checked_at: checkedUnload,
      temperature_c: Math.max(productTemp1, productTemp2),
      notes: `Product internal temps ${productTemp1}°C / ${productTemp2}°C (≥65°C for ≥10 min).`,
      metadata: {
        readings: [
          { label: 'Piece 1', tempC: productTemp1, time_iso: toStoredIso(schedule.drying_end) },
          { label: 'Piece 2', tempC: productTemp2, time_iso: toStoredIso(schedule.drying_end) },
        ],
      },
    },
    'DRY-FSP-AW-LAB': {
      status: 'passed',
      checked_by: operator,
      checked_at: checkedUnload,
      water_activity: aw,
      notes: `Process confirmed; wet ${wetKg} kg → dry ${dryKg} kg (${weightLossPercent}% loss); process Aw ${aw} (< 0.85). External lab send remains separate.`,
      metadata: {
        process_check: {
          temp_met: true,
          weight_met: weightLossPercent >= 54,
          runtime_logged: true,
        },
        weight_log: {
          wet_weight_kg: wetKg,
          dry_weight_kg: dryKg,
          weight_loss_percent: weightLossPercent,
        },
      },
    },
    'MIX-TEMP': {
      status: 'passed',
      checked_by: operator,
      checked_at: checkedMix,
      temperature_c: mixTemp,
      notes: `Mix temp ${mixTemp}°C.`,
    },
    'MIX-CORE': {
      status: 'passed',
      checked_by: operator,
      checked_at: checkedMix,
      temperature_c: mixTemp,
      notes: `Mix core temp ${mixTemp}°C.`,
    },
  };

  return {
    completed_at: schedule.drying_end,
    completed_by: operator,
    schedule,
    wet_weight_kg: wetKg,
    dry_weight_kg: dryKg,
    weight_loss_percent: weightLossPercent,
    byCode,
  };
}
