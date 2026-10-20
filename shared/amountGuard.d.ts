export function forceIlsSymbol(text: string): string;
export const NEGATIVE_AMOUNT_RE: RegExp;
export function detectNegativeAmount(text: string | null | undefined): number | null;
export function negativeAmountReply(amount: number): string;
export function detectAmbiguousAmount(
  text: string | null | undefined
): { low: number; high: number } | null;
export function ambiguousAmountReply(low: number, high: number): string;
export function userMessageBlocksCard(text: string | null | undefined): boolean;
