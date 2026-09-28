import { loadTaxForm, saveTaxForm } from './taxForm';
import { suggestTaxDonationsFromLedger } from './smartInsights';

export type TaxFillPayload = {
  donationsTotal: number;
  taxYear: number;
};

type Listener = (payload: TaxFillPayload) => void;

const listeners = new Set<Listener>();

export function subscribeTaxFill(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** ממלא את מחשבון המס מסה״כ צדקה של שנה אזרחית ומשדר למסך המס */
export async function fillTaxCalculatorFromYear(
  ledgerTzedaka: number,
  taxYear: number
): Promise<TaxFillPayload> {
  const donationsTotal = suggestTaxDonationsFromLedger(ledgerTzedaka);
  const current = await loadTaxForm();
  const next = { ...current, donationsTotal, taxYear };
  await saveTaxForm(next);
  const payload: TaxFillPayload = { donationsTotal, taxYear };
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      // ignore listener errors
    }
  });
  return payload;
}
