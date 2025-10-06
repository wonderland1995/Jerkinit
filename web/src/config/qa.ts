// src/config/qa.ts
export type CoreTempLimit = { tempC: number; minutes: number };

// If you have validation for 62/10, set { tempC: 62, minutes: 10 }.
export const CORE_TEMP_LIMIT: CoreTempLimit = {
  tempC: 70,
  minutes: 2,
};
