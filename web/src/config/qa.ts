// src/config/qa.ts
export type CoreTempLimit = { tempC: number; minutes: number };

// Adams Poultry Master Manual jerky procedure: internal ≥65°C for ≥10 minutes.
export const CORE_TEMP_LIMIT: CoreTempLimit = {
  tempC: 65,
  minutes: 10,
};
