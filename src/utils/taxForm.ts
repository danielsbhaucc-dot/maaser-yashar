import AsyncStorage from '@react-native-async-storage/async-storage';

export const TAX_STORAGE_KEY = 'maaser_tax_v1';

export type TaxFormState = {
  donationsTotal: number;
  taxableIncome: number;
  taxPaid: number;
  isCompany: boolean;
  taxYear: number;
  knowsIncome: boolean;
};

export const DEFAULT_TAX_FORM: TaxFormState = {
  donationsTotal: 0,
  taxableIncome: 0,
  taxPaid: 0,
  isCompany: false,
  taxYear: 2026,
  knowsIncome: true,
};

function asFiniteNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export async function loadTaxForm(): Promise<TaxFormState> {
  try {
    const raw = await AsyncStorage.getItem(TAX_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TAX_FORM };
    const parsed = JSON.parse(raw) as Partial<TaxFormState>;
    return {
      donationsTotal: asFiniteNumber(parsed.donationsTotal, 0),
      taxableIncome: asFiniteNumber(parsed.taxableIncome, 0),
      taxPaid: asFiniteNumber(parsed.taxPaid, 0),
      isCompany: parsed.isCompany === true,
      taxYear: asFiniteNumber(parsed.taxYear, DEFAULT_TAX_FORM.taxYear),
      knowsIncome: parsed.knowsIncome !== false,
    };
  } catch {
    return { ...DEFAULT_TAX_FORM };
  }
}

export async function saveTaxForm(state: TaxFormState): Promise<void> {
  await AsyncStorage.setItem(TAX_STORAGE_KEY, JSON.stringify(state));
}
