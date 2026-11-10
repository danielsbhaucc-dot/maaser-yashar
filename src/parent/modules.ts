/**
 * מודולים להתקנה מספריית הרכיבים של חברת האם (שלב 2).
 * לוח הבקרה מפעיל/מכבה מודול לכל מוצר → /v1/light מחזיר רשימה חתומה → כאן היא מאומתת מקומית, נשמרת (עובד בלי רשת),
 * ומודולים נטענים בעצלות. הסרה מפרקת את המודול ומחזירה את המצב הקודם. לעולם לא נוגעים בנתוני המשתמש
 * (תנועות, הגדרות, נועם): למודול יש רק את ה־DOM שלו ומפתח העדפות משלו.
 * כל כשל (חתימה, רשת, טעינה) = שום שינוי: האפליקציה ממשיכה עם ההתנהגות המובנית שלה.
 */
import { verifyManifest, type ModuleManifest } from '../../packages/@core/product-link/src/index.ts';

export interface InstalledModule { remove(): void }
export type ModuleLoader = () => Promise<{ install(): Promise<InstalledModule | null> }>;
export interface KVRead { get(k: string): Promise<string | null> }

type Listener = () => void;
const installed = new Map<string, { version: string; handle: InstalledModule }>();
const listeners = new Set<Listener>();
let snapshot: ReadonlySet<string> = new Set();
const emit = () => { snapshot = new Set(installed.keys()); for (const l of [...listeners]) { try { l(); } catch { /* ignore */ } } };
export const subscribeModules = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const installedModules = (): ReadonlySet<string> => snapshot;

/** מודולים שהאפליקציה יודעת לטעון. מודול שלא כאן מתעלמים ממנו (גם אם הופעל בלוח). */
export const REGISTRY: Record<string, ModuleLoader> = {
  /** החשבון המרכזי (@core/account-kit). כבוי בלוח כברירת מחדל, ועולה רק כשהשרת של מעשר ישר מוגדר (סוד ב־Netlify). */
  account: () => import('./mods/account'),
  /** המתג הגלוי (כפתור/קטע בהגדרות). כבוי בלוח = מחובר ברקע בלי כפתור. תלוי ב־'account'. */
  'account-ui': () => import('./mods/accountUi'),
};

let pubKey: Promise<CryptoKey | null> | null = null;
export function parentKey(jwk: JsonWebKey): Promise<CryptoKey | null> {
  return pubKey ??= (async () => { try { return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); } catch { return null; } })();
}

/** הרשימה האחרונה שאומתה (מהאחסון המקומי). null = אין/לא תקינה. */
export async function lastManifest(store: KVRead, pub: CryptoKey | null, productId: string): Promise<ModuleManifest | null> {
  if (!pub) return null;
  try { const raw = await store.get('pl:manifest'); return raw ? await verifyManifest(JSON.parse(raw), pub, productId) : null; } catch { return null; }
}

let queue: Promise<void> = Promise.resolve();
/** מיישם רשימה: מתקין מה שחסר, מסיר מה שכבר לא ברשימה. null = לא משנים כלום (נשארים במצב הקיים). */
export function applyManifest(m: ModuleManifest | null, registry: Record<string, ModuleLoader> = REGISTRY): Promise<void> {
  queue = queue.then(async () => {
    if (!m) return;
    const want = new Map(m.modules.filter((x) => registry[x.id]).map((x) => [x.id, x.version] as const));
    for (const [id, cur] of [...installed]) {
      if (want.get(id) === cur.version) continue;
      try { cur.handle.remove(); } catch { /* ignore */ }
      installed.delete(id); emit();
    }
    for (const [id, version] of want) {
      if (installed.has(id)) continue;
      try {
        const mod = await registry[id]!();
        const handle = await mod.install();
        if (handle) { installed.set(id, { version, handle }); emit(); }
      } catch { /* load failed: keep built-in behaviour */ }
    }
  }).catch(() => undefined);
  return queue;
}

/** לבדיקות בלבד. */
export function __resetModulesForTests(): void { for (const [, c] of installed) { try { c.handle.remove(); } catch { /* */ } } installed.clear(); emit(); queue = Promise.resolve(); pubKey = null; }
