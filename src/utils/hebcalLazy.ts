/**
 * נקודת כניסה אחת ל־dynamic import() של hebcal (T-52).
 * חשוב: צרכנים חייבים לייבא את המודול הזה ב־import() ולא סטטית,
 * כדי ש־@hebcal/core + Temporal יישארו מחוץ לחבילה הראשית.
 */
export {
  getSmartGreeting,
  type GreetingInput,
  type GreetingResult,
} from './greetings/hebcalGreeting';

export {
  availableYears,
  civilYearOf,
  entriesForYear,
  entryDateIso,
  hebrewYearLabel,
  hebrewYearOf,
  yearLabel,
  yearSummary,
  type YearMode,
  type YearMonthRow,
  type YearSummaryResult,
} from './yearSummary';
