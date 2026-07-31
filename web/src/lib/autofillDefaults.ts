/**
 * NSW Food Safety–aligned pass-range generators for QA autofill.
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

/** Structured readings for reuse outside the compliance log form */
export type AutofillSectionFields = {
  // Marination
  marinade_temp_c?: number;
  marinade_ph?: number;
  time_in_marinade_hrs?: number;
  batch_id?: string;
  // Drying
  drying_temp_c?: number;
  drying_time_hrs?: number;
  drying_start?: string;
  drying_end?: string;
  oven_id?: string;
  water_activity?: number;
  // Finished product
  weight_g?: number;
  finished_ph?: number;
  colour_appearance?: 'Pass' | 'Fail';
  packaging_integrity?: 'Pass' | 'Fail';
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
  // Temperature monitoring
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
  const marinadeTemp = randFloat(2, 5, 1); // chilled marinade
  const ph = randFloat(4.8, 5.5, 2);
  const hours = randFloat(12, 24, 1);
  const batch = batchId();
  const marinatedOn = input.extraDates?.marinated_on || input.completedAt;

  const fields: AutofillSectionFields = {
    marinade_temp_c: marinadeTemp,
    marinade_ph: ph,
    time_in_marinade_hrs: hours,
    batch_id: batch,
  };

  return {
    completed_at: input.completedAt,
    completed_by: operator,
    scope: `Batch ${batch} — marination tub`,
    result: `Pass — marinade ${marinadeTemp}°C, pH ${ph}, ${hours} h in marinade`,
    notes: [
      `Operator: ${operator}`,
      `Marinated on: ${formatLocalDateLabel(marinatedOn)}`,
      `Batch ID: ${batch}`,
      `Within NSW Food Safety chilled marinade / acidification criteria.`,
    ].join('\n'),
    batches_covered: '',
    batch_start: '',
    batch_end: '',
    fields,
  };
}

function buildDrying(input: AutofillInput): AutofillResult {
  const operator = resolveOperator(input.operatorName);
  const dryingTemp = randFloat(70, 80, 1); // min 70°C core
  const dryingHrs = randFloat(4, 8, 1);
  const aw = randFloat(0.75, 0.85, 3); // target ≤ 0.85
  const oven = `OVN-${randInt(1, 4)}`;
  const end = input.extraDates?.dried_on || input.completedAt;
  const start = shiftLocalDatetime(end, -dryingHrs);
  const batch = batchId();

  const fields: AutofillSectionFields = {
    drying_temp_c: dryingTemp,
    drying_time_hrs: dryingHrs,
    drying_start: start,
    drying_end: end,
    oven_id: oven,
    water_activity: aw,
    batch_id: batch,
  };

  return {
    completed_at: input.completedAt,
    completed_by: operator,
    scope: `Oven ${oven} — batch ${batch}`,
    result: `Pass — core ${dryingTemp}°C, ${dryingHrs} h, Aw ${aw}`,
    notes: [
      `Operator: ${operator}`,
      `Dried on: ${formatLocalDateLabel(end)}`,
      `Start: ${formatLocalDateLabel(start)} → End: ${formatLocalDateLabel(end)}`,
      `Core temp ≥70°C; Aw ≤0.85 (NSW Food Safety drying criteria).`,
    ].join('\n'),
    batches_covered: '',
    batch_start: '',
    batch_end: '',
    fields,
  };
}

function buildFinishedProduct(input: AutofillInput): AutofillResult {
  const operator = resolveOperator(input.operatorName);
  const weight = randFloat(80, 250, 1);
  const aw = randFloat(0.75, 0.85, 3);
  const ph = randFloat(4.8, 5.5, 2);
  const batch = batchId();

  const fields: AutofillSectionFields = {
    weight_g: weight,
    water_activity: aw,
    finished_ph: ph,
    colour_appearance: 'Pass',
    packaging_integrity: 'Pass',
    batch_id: batch,
  };

  return {
    completed_at: input.completedAt,
    completed_by: operator,
    scope: `Finished product — batch ${batch}`,
    result: `Pass — ${weight} g, Aw ${aw}, pH ${ph}, colour Pass, pack integrity Pass`,
    notes: [
      `Operator: ${operator}`,
      `Colour/appearance: Pass`,
      `Packaging integrity: Pass`,
      `Aw ≤0.85 and pH within product specification.`,
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
  // Fridge 0–5°C; freezer ≤ −18°C — stay in range so no corrective action needed
  const temp = isFreezer ? randFloat(-22, -18, 1) : randFloat(0, 4.5, 1);

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
  if (code.startsWith('FIN-') || cat.includes('finished')) {
    return 'finished_product';
  }

  return 'environmental_monitoring';
}

export function localDatetimeInputValue(date = new Date()): string {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
