import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { Screen } from '../components/Screen';
import {
  Banner,
  Chip,
  PrimaryButton,
  SegmentedRow,
  formatMoney,
} from '../components/ui';
import { PrivacyNotice } from '../components/PrivacyNotice';
import { PinLockSettings } from '../components/PinLockSettings';
import { Glass, GlassPill } from '../components/Glass';
import { Accordion } from '../components/Accordion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useA11y } from '../accessibility';
import { BOT_NAME, type Gender, t } from '../utils/copy';
import { EXPLAIN } from '../utils/chatScript';
import { noamSettingsHero } from '../utils/noamCompanion';
import { SmartInsights } from '../components/SmartInsights';
import { settingsSmartInsights } from '../utils/smartInsights';
import { kindLabel } from '../utils/recurring';
import { exportLedgerCsv } from '../utils/exportCsv';
import {
  buildRestoreSummary,
  collectBackupData,
  exportBackup,
  pickBackupFile,
  readBackup,
  restoreBackup,
} from '../utils/backupExport';
import { wipeAllData } from '../utils/wipeData';
import { PRIVACY_LINK_LABEL, privacyPageUrl } from '../constants/privacy';
import { ABOUT_LINK_LABEL, aboutPageUrl } from '../constants/about';
import { colors, fonts, radii, spacing, type } from '../theme';
import type { MaaserRate, TaxDeductionMode } from '../types';
import {
  defaultAdvancedSettings,
  SURPLUS_CARRY_ENGINE_TEXT,
} from '../utils/totalsAdvanced';
import {
  approxRate,
  formatRatePercent,
  parseRatePercentInput,
  rateCaption,
} from '../utils/rateLabel';
import {
  enableMonthlyReminder,
  reminderSettingsHint,
} from '../utils/monthlyReminder';
import { shareApp } from '../utils/shareApp';
import {
  CONTACT_EMAIL,
  CONTACT_PENDING_TEXT,
  contactMailto,
} from '../config/contact';

function FieldLabel({ children }: { children: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      <View style={styles.fieldAccent} />
      <Text style={styles.fieldLabel}>{children}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const {
    profile,
    patchProfile,
    recurring,
    toggleRecurring,
    removeRecurring,
    openAdd,
    ledger,
  } = useApp();
  const toast = useToast();
  const { openPanel, settings, toggle, cycleMetric } = useA11y();
  const [saved, setSaved] = React.useState(false);
  const [includeChatBackup, setIncludeChatBackup] = React.useState(false);
  const [backupBusy, setBackupBusy] = React.useState(false);
  const [reminderBusy, setReminderBusy] = React.useState(false);
  const isCustomRate =
    !approxRate(profile.rate, 0.1) && !approxRate(profile.rate, 0.2);
  const [customRateMode, setCustomRateMode] = React.useState(isCustomRate);
  const [customRateText, setCustomRateText] = React.useState(
    isCustomRate ? formatRatePercent(profile.rate) : ''
  );
  const [rateError, setRateError] = React.useState<string | null>(null);
  const [versionShort, setVersionShort] = React.useState<string | null>(null);
  const initial = (profile.displayName?.trim()?.[0] || 'מ').toUpperCase();
  const ratePct = formatRatePercent(profile.rate);
  const name = profile.displayName || t(profile.gender, 'חבר', 'חברה');

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    fetch('/version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (cancelled || !v?.commit) return;
        setVersionShort(String(v.commit).slice(0, 7));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const custom =
      !approxRate(profile.rate, 0.1) && !approxRate(profile.rate, 0.2);
    setCustomRateMode(custom);
    if (custom) setCustomRateText(formatRatePercent(profile.rate));
  }, [profile.rate]);

  const applyPresetRate = (rate: MaaserRate) => {
    setRateError(null);
    setCustomRateMode(false);
    setCustomRateText('');
    patchProfile({ rate });
  };

  const applyCustomRate = (text: string) => {
    setCustomRateText(text);
    const parsed = parseRatePercentInput(text);
    if (!parsed.ok) {
      setRateError(parsed.error);
      return;
    }
    setRateError(null);
    setCustomRateMode(true);
    patchProfile({ rate: parsed.rate });
  };
  const insights = React.useMemo(
    () => settingsSmartInsights({ name, gender: profile.gender, profile }),
    [name, profile]
  );

  const hero = (
    <>
      <GlassPill gold>
        <Text style={styles.badgeText}>✦ הפרופיל שלך עם {BOT_NAME}</Text>
      </GlassPill>
      <View style={styles.avatarWrap}>
        <Glass dark gold style={styles.avatar}>
          <View style={styles.avatarInner}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
        </Glass>
      </View>
      <Text style={styles.heroTitle}>הגדרות</Text>
      <Text style={styles.heroSub}>{noamSettingsHero(name, profile.gender)}</Text>
    </>
  );

  return (
    <Screen sheet hero={hero} scroll contentStyle={{ paddingTop: spacing.lg }}>
      <Glass light strong style={styles.a11yTop}>
        <FieldLabel>נגישות</FieldLabel>
        <Text style={styles.a11yHint}>
          ניגודיות, טקסט מוגדל, סמן ועוד — נשמר במכשיר. גודל הטקסט חל מיד על כל המסך.
        </Text>
        <SegmentedRow>
          <Chip
            fill
            label={
              settings.fontSize > 0
                ? `טקסט ×${(1 + settings.fontSize * 0.16).toFixed(1)}`
                : 'הגדל טקסט'
            }
            selected={settings.fontSize > 0}
            onPress={() => cycleMetric('fontSize')}
          />
          <Chip
            fill
            label={settings.stopAnimations ? 'אנימציות כבויות' : 'כיבוי אנימציות'}
            selected={settings.stopAnimations}
            onPress={() => toggle('stopAnimations')}
          />
          <Chip
            fill
            label={settings.reduceMotion ? 'תנועה מופחתת' : 'הפחתת תנועה'}
            selected={settings.reduceMotion}
            onPress={() => toggle('reduceMotion')}
          />
        </SegmentedRow>
        <View style={{ height: spacing.sm }} />
        <PrimaryButton label="פתח תפריט נגישות ✦" onPress={() => openPanel()} />
      </Glass>

      <PrivacyNotice light />

      <PinLockSettings />

      <SmartInsights items={insights} />
      <Glass light strong style={styles.panel}>
        <FieldLabel>שם</FieldLabel>
        <TextInput
          style={styles.input}
          value={profile.displayName}
          onChangeText={(txt) => patchProfile({ displayName: txt })}
          textAlign="center"
          placeholderTextColor={colors.sheetMuted}
          placeholder="השם שלך"
          accessibilityLabel="שם לתצוגה"
        />

        <View style={styles.divider} />

        <FieldLabel>מגדר</FieldLabel>
        <SegmentedRow>
          <Chip
            fill
            label="זכר"
            selected={profile.gender === 'male'}
            onPress={() => patchProfile({ gender: 'male' as Gender })}
          />
          <Chip
            fill
            label="נקבה"
            selected={profile.gender === 'female'}
            onPress={() => patchProfile({ gender: 'female' as Gender })}
          />
          <Chip
            fill
            label="לא צוין"
            selected={profile.gender === 'unspecified'}
            onPress={() => patchProfile({ gender: 'unspecified' as Gender })}
          />
        </SegmentedRow>

        <View style={styles.divider} />

        <FieldLabel>מצב משפחתי</FieldLabel>
        <SegmentedRow>
          <Chip
            fill
            label={t(profile.gender, 'רווק', 'רווקה', 'רווק/ה')}
            selected={profile.maritalStatus === 'single'}
            onPress={() => patchProfile({ maritalStatus: 'single', includeSpouse: false })}
          />
          <Chip
            fill
            label={t(profile.gender, 'נשוי', 'נשואה', 'נשוי/אה')}
            selected={profile.maritalStatus === 'married'}
            onPress={() => patchProfile({ maritalStatus: 'married' })}
          />
        </SegmentedRow>
        <View style={styles.nestedSeg}>
          <SegmentedRow>
            <Chip
              fill
              label={t(profile.gender, 'גרוש', 'גרושה', 'גרוש/ה')}
              selected={profile.maritalStatus === 'divorced'}
              onPress={() =>
                patchProfile({ maritalStatus: 'divorced', includeSpouse: false })
              }
            />
            <Chip
              fill
              label={t(profile.gender, 'אלמן', 'אלמנה', 'אלמן/ה')}
              selected={profile.maritalStatus === 'widowed'}
              onPress={() =>
                patchProfile({ maritalStatus: 'widowed', includeSpouse: false })
              }
            />
            <Chip
              fill
              label="לא צוין"
              selected={profile.maritalStatus === 'unknown'}
              onPress={() =>
                patchProfile({ maritalStatus: 'unknown', includeSpouse: false })
              }
            />
          </SegmentedRow>
        </View>
        {profile.maritalStatus === 'married' ? (
          <View style={styles.nestedSeg}>
            <SegmentedRow>
              <Chip
                fill
                label="חישוב ביחד"
                selected={profile.includeSpouse}
                onPress={() => patchProfile({ includeSpouse: true })}
              />
              <Chip
                fill
                label="רק שלי"
                selected={!profile.includeSpouse}
                onPress={() => patchProfile({ includeSpouse: false })}
              />
            </SegmentedRow>
          </View>
        ) : null}
      </Glass>

      <Glass light gold strong style={styles.ratePanel}>
        <FieldLabel>שיעור נתינה</FieldLabel>
        <Text style={styles.rateHero}>{ratePct}%</Text>
        <Text style={styles.rateCaption}>{rateCaption(profile.rate)}</Text>
        <SegmentedRow>
          <Chip
            fill
            label="מעשר 10%"
            selected={!customRateMode && approxRate(profile.rate, 0.1)}
            onPress={() => applyPresetRate(0.1)}
          />
          <Chip
            fill
            label="חומש 20%"
            selected={!customRateMode && approxRate(profile.rate, 0.2)}
            onPress={() => applyPresetRate(0.2)}
          />
          <Chip
            fill
            label="אחר"
            selected={customRateMode}
            onPress={() => {
              setCustomRateMode(true);
              if (!customRateText) {
                setCustomRateText(
                  isCustomRate ? formatRatePercent(profile.rate) : '15'
                );
              }
            }}
          />
        </SegmentedRow>
        {customRateMode ? (
          <View style={styles.customRateBlock}>
            <Text style={styles.customRateHint}>אחוז מותאם (1%–50%)</Text>
            <TextInput
              style={[styles.input, styles.customRateInput]}
              value={customRateText}
              onChangeText={applyCustomRate}
              keyboardType="decimal-pad"
              placeholder="לדוגמה 15"
              placeholderTextColor={colors.inkSoft}
              textAlign="center"
              accessibilityLabel="אחוז נתינה מותאם"
              accessibilityDescribedBy={rateError ? 'rate-error' : undefined}
            />
            {rateError ? (
              <Text
                nativeID="rate-error"
                style={styles.rateError}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {rateError}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.explainRow}>
          <Accordion
            items={[
              {
                id: 'rate',
                question: 'הסבר על 10% / 20%',
                answer: EXPLAIN.rate,
              },
              {
                id: 'net',
                question: 'למה מחשבים מהנטו?',
                answer: EXPLAIN.net,
              },
            ]}
          />
        </View>
      </Glass>

      <Banner
        light
        text={`${BOT_NAME} מחשב מהנטו: הכנסות פחות ניכויי חובה/עסק. לפי המקובל לא מנכים הוצאות מחיה (שכירות, אוכל). בשאלות גבוליות כדאי לשאול רב.`}
        tone="ok"
      />

      <Glass light strong style={styles.panel}>
        <FieldLabel>הגדרות חישוב מתקדמות</FieldLabel>
        <Text style={styles.recurIntro}>
          חישוב לפי שיטות הלכתיות נפוצות. אינו פסק הלכה — שאלו רב בכל ספק.
        </Text>

        <Text style={styles.advOptTitle}>ניכוי מסים מהבסיס</Text>
        <Text style={styles.advOptHint}>
          האם לנכות מס הכנסה, ביטוח לאומי ובריאות לפני חישוב המעשר. שאלו רב.
        </Text>
        <SegmentedRow>
          {(
            [
              { id: 'after_mandatory' as TaxDeductionMode, label: 'אחרי חובה' },
              { id: 'after_income_tax_only' as TaxDeductionMode, label: 'מס הכנסה בלבד' },
              { id: 'gross' as TaxDeductionMode, label: 'מברוטו' },
            ] as const
          ).map((opt) => (
            <Chip
              key={opt.id}
              fill
              label={opt.label}
              selected={(profile.advanced?.taxDeductionMode ?? 'after_mandatory') === opt.id}
              onPress={() =>
                patchProfile({
                  advanced: { ...profile.advanced, taxDeductionMode: opt.id },
                })
              }
            />
          ))}
        </SegmentedRow>

        <View style={styles.divider} />

        <Text style={styles.advOptTitle}>מתנות כסף</Text>
        <Text style={styles.advOptHint}>
          רבים מחייבים מעשר ממתנות כסף; יש פוטרים. שאלו רב.
        </Text>
        <SegmentedRow>
          <Chip
            fill
            label="כלול"
            selected={(profile.advanced?.giftMode ?? 'include') === 'include'}
            onPress={() =>
              patchProfile({ advanced: { ...profile.advanced, giftMode: 'include' } })
            }
          />
          <Chip
            fill
            label="החרג"
            selected={profile.advanced?.giftMode === 'exclude'}
            onPress={() =>
              patchProfile({ advanced: { ...profile.advanced, giftMode: 'exclude' } })
            }
          />
        </SegmentedRow>

        <View style={styles.divider} />

        <Text style={styles.advOptTitle}>קצבאות</Text>
        <Text style={styles.advOptHint}>
          יש פוסקים הפוטרים קצבאות ילדים ממעשר. שאלו רב לפי מנהגכם.
        </Text>
        <SegmentedRow>
          <Chip
            fill
            label="החרג"
            selected={(profile.advanced?.allowanceMode ?? 'exclude') === 'exclude'}
            onPress={() =>
              patchProfile({ advanced: { ...profile.advanced, allowanceMode: 'exclude' } })
            }
          />
          <Chip
            fill
            label="כלול"
            selected={profile.advanced?.allowanceMode === 'include'}
            onPress={() =>
              patchProfile({ advanced: { ...profile.advanced, allowanceMode: 'include' } })
            }
          />
        </SegmentedRow>

        <View style={styles.divider} />

        <Text style={styles.advOptTitle}>ירושה</Text>
        <Text style={styles.advOptHint}>
          רבים פוטרים ירושה ממעשר; יש מחמירים. שאלו רב.
        </Text>
        <SegmentedRow>
          <Chip
            fill
            label="החרג"
            selected={(profile.advanced?.inheritanceMode ?? 'exclude') === 'exclude'}
            onPress={() =>
              patchProfile({ advanced: { ...profile.advanced, inheritanceMode: 'exclude' } })
            }
          />
          <Chip
            fill
            label="כלול"
            selected={profile.advanced?.inheritanceMode === 'include'}
            onPress={() =>
              patchProfile({ advanced: { ...profile.advanced, inheritanceMode: 'include' } })
            }
          />
        </SegmentedRow>

        <View style={styles.divider} />

        <Text style={styles.advOptTitle}>החזרי הלוואה</Text>
        <Text style={styles.advOptHint}>
          יש פוסקים שמנכים החזר קרן מהבסיס; אחרים לא. שאלו רב.
        </Text>
        <SegmentedRow>
          <Chip
            fill
            label="לא לנכות"
            selected={!profile.advanced?.deductLoans}
            onPress={() =>
              patchProfile({ advanced: { ...profile.advanced, deductLoans: false } })
            }
          />
          <Chip
            fill
            label="לנכות"
            selected={!!profile.advanced?.deductLoans}
            onPress={() =>
              patchProfile({ advanced: { ...profile.advanced, deductLoans: true } })
            }
          />
        </SegmentedRow>

        <View style={styles.simpleEscape}>
          <Pressable
            onPress={() => {
              const on = profile.advanced?.enabled !== false;
              patchProfile({
                advanced: {
                  ...defaultAdvancedSettings(),
                  ...profile.advanced,
                  enabled: !on,
                },
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={
              profile.advanced?.enabled === false
                ? 'חזרה לחישוב מתקדם'
                : 'מעבר לחישוב פשוט'
            }
          >
            <Text style={styles.simpleEscapeText}>
              {profile.advanced?.enabled === false
                ? 'חזרה לחישוב מתקדם (מומלץ)'
                : 'חישוב פשוט (תאימות ישנה)'}
            </Text>
          </Pressable>
        </View>
      </Glass>

      <Glass light strong style={styles.panel}>
        <FieldLabel>העברת עודף לחודש הבא</FieldLabel>
        <Text style={styles.recurIntro}>{SURPLUS_CARRY_ENGINE_TEXT}</Text>
        <Text style={styles.advOptHint}>
          דורש התניה מראש לפי חלק מהפוסקים. שאלו רב לפני הפעלה.
        </Text>
        <SegmentedRow>
          <Chip
            fill
            label="כבוי"
            selected={!profile.carryForwardSurplus}
            onPress={() => patchProfile({ carryForwardSurplus: false })}
          />
          <Chip
            fill
            label="פעיל · שאלו רב"
            selected={!!profile.carryForwardSurplus}
            onPress={() => patchProfile({ carryForwardSurplus: true })}
          />
        </SegmentedRow>
      </Glass>

      <Glass light strong style={styles.panel}>
        <FieldLabel>שיתוף בצ'אט עם נועם</FieldLabel>
        <Text style={styles.recurIntro}>
          תמיד בלי שם, הערות או תנועות בודדות. אפשר לבחור אם לצרף סיכום סכומי החודש.
        </Text>
        <SegmentedRow>
          <Chip
            fill
            label="גם סיכום חודש"
            selected={profile.chatShareTotals !== false}
            onPress={() => patchProfile({ chatShareTotals: true, chatConsentDone: true })}
          />
          <Chip
            fill
            label="רק ההודעה"
            selected={profile.chatShareTotals === false}
            onPress={() => patchProfile({ chatShareTotals: false, chatConsentDone: true })}
          />
        </SegmentedRow>
        <View style={styles.divider} />
        <FieldLabel>שמירת היסטוריית שיחות</FieldLabel>
        <Text style={styles.recurIntro}>
          כבוי = השיחות נמחקות בסגירת החלון/מסך ולא נשמרות אחרי רענון.
        </Text>
        <SegmentedRow>
          <Chip
            fill
            label="שמור"
            selected={profile.saveChatHistory !== false}
            onPress={() => patchProfile({ saveChatHistory: true })}
          />
          <Chip
            fill
            label="לא לשמור"
            selected={profile.saveChatHistory === false}
            onPress={() => {
              if (profile.saveChatHistory === false) return;
              toast.confirm({
                title: 'לכבות שמירת שיחות?',
                message: 'השיחות הקיימות יימחקו מהמכשיר עכשיו.',
                confirmLabel: 'מחק ואל תשמור',
                cancelLabel: 'ביטול',
                onConfirm: async () => {
                  patchProfile({ saveChatHistory: false });
                  const { clearAllThreads } = await import('../ai/noam');
                  await clearAllThreads();
                  toast.info('היסטוריית השיחות נמחקה');
                },
              });
            }}
          />
        </SegmentedRow>
      </Glass>

      <Glass light strong style={styles.panel}>
        <FieldLabel>תזכורת חודשית</FieldLabel>
        <Text style={styles.recurIntro}>{reminderSettingsHint()}</Text>
        <PrimaryButton
          label={reminderBusy ? 'מגדיר תזכורת…' : 'הוסף תזכורת חודשית ✦'}
          disabled={reminderBusy}
          onPress={async () => {
            setReminderBusy(true);
            try {
              const result = await enableMonthlyReminder();
              if (result.ics || result.notification === 'scheduled') {
                toast.success('תזכורת חודשית ✦', result.message);
              } else {
                toast.error('לא הוגדרה תזכורת', result.message);
              }
            } catch {
              toast.error('ההגדרה נכשלה', 'נסה שוב');
            } finally {
              setReminderBusy(false);
            }
          }}
        />
      </Glass>

      <Glass light strong style={styles.panel}>
        <FieldLabel>גיבוי ושחזור</FieldLabel>
        <View style={styles.warnCard}>
          <Text style={styles.warnCardText}>
            הנתונים נשמרים רק בדפדפן הזה. אם תמחקו נתוני גלישה, תחליפו טלפון, או לא תיכנסו הרבה
            זמן באייפון — הם עלולים להימחק. גבו פעם בחודש.
          </Text>
        </View>
        <Text style={styles.recurIntro}>
          קובץ JSON מלא של הפנקס, הפרופיל, הארכיון, הוראות הקבע ומחשבון המס — לשחזור במכשיר אחר או
          אחרי מחיקת נתונים.
        </Text>
        <SegmentedRow>
          <Chip
            fill
            label="כולל שיחות עם נועם"
            selected={includeChatBackup}
            onPress={() => setIncludeChatBackup((v) => !v)}
          />
        </SegmentedRow>
        <View style={{ height: spacing.sm }} />
        <PrimaryButton
          label={backupBusy ? 'מכין גיבוי…' : 'גיבוי JSON ✦'}
          disabled={backupBusy}
          onPress={async () => {
            setBackupBusy(true);
            try {
              await exportBackup({ includeChat: includeChatBackup });
              toast.success('הגיבוי מוכן ✦', 'הקובץ הורד / שותף מהמכשיר');
            } catch {
              toast.error('הגיבוי נכשל', 'נסה שוב');
            } finally {
              setBackupBusy(false);
            }
          }}
        />
        <View style={{ height: spacing.sm }} />
        <PrimaryButton
          label={backupBusy ? 'קורא קובץ…' : 'שחזור מגיבוי'}
          disabled={backupBusy}
          onPress={async () => {
            setBackupBusy(true);
            try {
              const file = await pickBackupFile();
              if (!file) return;
              let backup;
              try {
                backup = await readBackup(file);
              } catch (e) {
                const msg =
                  e instanceof Error ? e.message : 'זה לא קובץ גיבוי של מעשר ישר';
                toast.error('שחזור בוטל', msg);
                return;
              }
              const current = await collectBackupData();
              const summary = buildRestoreSummary(backup, current);
              toast.confirm({
                title: 'לשחזר מגיבוי?',
                message: summary,
                destructive: true,
                confirmLabel: 'שחזר',
                cancelLabel: 'ביטול',
                onConfirm: async () => {
                  try {
                    await restoreBackup(backup);
                  } catch {
                    toast.error('השחזור נכשל', 'הנתונים הנוכחיים לא נדרסו');
                  }
                },
              });
            } catch {
              toast.error('לא ניתן לקרוא את הקובץ', 'נסה שוב');
            } finally {
              setBackupBusy(false);
            }
          }}
        />
      </Glass>

      <Glass light strong style={styles.panel}>
        <FieldLabel>ייצוא לרו״ח</FieldLabel>
        <Text style={styles.recurIntro}>
          הורדת CSV של הפנקס או הארכיון — קובץ מקומי במכשיר, בלי שליחה לשרת.
        </Text>
        <PrimaryButton
          label="ייצוא פנקס (CSV) ✦"
          onPress={async () => {
            try {
              await exportLedgerCsv(ledger);
              toast.success('הקובץ מוכן ✦', 'נשמר / שותף מהמכשיר');
            } catch {
              toast.error('הייצוא נכשל', 'נסה שוב');
            }
          }}
        />
      </Glass>

      <Glass light strong style={styles.panel}>
        <FieldLabel>הוראות קבע</FieldLabel>
        <Text style={styles.recurIntro}>
          הפקדה או תרומה אוטומטית לפי יום בחודש — למשל כל עשירי.
        </Text>
        {recurring.length === 0 ? (
          <Text style={styles.recurEmpty}>עדיין אין הוראות קבע</Text>
        ) : (
          recurring.map((rule) => (
            <View key={rule.id} style={styles.recurRow}>
              <View style={styles.recurMain}>
                <Text style={styles.recurTitle}>
                  {kindLabel(rule.kind)} · {formatMoney(rule.amount)}
                </Text>
                <Text style={styles.recurMeta}>
                  {rule.category} · כל {rule.dayOfMonth} בחודש
                  {rule.enabled ? '' : ' · מושהה'}
                </Text>
              </View>
              <Pressable
                onPress={() => toggleRecurring(rule.id, !rule.enabled)}
                style={[styles.recurBtn, rule.enabled && styles.recurBtnOn]}
                accessibilityRole="button"
                accessibilityLabel={rule.enabled ? 'השהה הוראת קבע' : 'הפעל הוראת קבע'}
              >
                <Text style={styles.recurBtnText}>{rule.enabled ? 'פעיל' : 'כבוי'}</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  toast.confirm({
                    title: 'למחוק הוראת קבע?',
                    message: 'תנועות שכבר נוצרו יישארו בפנקס',
                    destructive: true,
                    confirmLabel: 'מחק',
                    cancelLabel: 'ביטול',
                    onConfirm: () => {
                      void removeRecurring(rule.id);
                      toast.info('הוראת הקבע נמחקה');
                    },
                  })
                }
                style={styles.recurDelete}
                accessibilityRole="button"
                accessibilityLabel="מחק הוראת קבע"
              >
                <Text style={styles.recurDeleteText}>×</Text>
              </Pressable>
            </View>
          ))
        )}
        <PrimaryButton label="הוסף הוראת קבע ✦" onPress={() => openAdd('income')} />
      </Glass>

      <View style={styles.actions}>
        <PrimaryButton
          label={saved ? 'נשמר ✓' : 'שמור הגדרות'}
          onPress={() => {
            setSaved(true);
            toast.success('ההגדרות נשמרו ✦');
            setTimeout(() => setSaved(false), 1400);
          }}
        />
      </View>

      <Glass light strong style={styles.panel}>
        <FieldLabel>שיתוף האפליקציה</FieldLabel>
        <Text style={styles.recurIntro}>
          שלחו לחברים קישור ישיר — בלי הרשמה, והנתונים נשארים אצל כל אחד במכשיר שלו.
        </Text>
        <PrimaryButton
          label="שתף את מעשר ישר ✦"
          testID="share-app"
          onPress={async () => {
            const result = await shareApp({ path: '/' });
            if (result === 'shared') {
              toast.success('שותף ✦');
            } else if (result === 'copied') {
              toast.success('הקישור הועתק ✦', 'אפשר להדביק בוואטסאפ או במייל');
            } else if (result === 'failed') {
              toast.error('השיתוף נכשל', 'נסה שוב');
            }
          }}
        />
      </Glass>

      <Glass light strong style={styles.panel}>
        <FieldLabel>יש לך הערה או רעיון?</FieldLabel>
        {CONTACT_EMAIL ? (
          <>
            <Text style={styles.recurIntro}>
              נשמח לשמוע. בלי מעקב ובלי אנליטיקה.
            </Text>
            <PrimaryButton
              label="שלח משוב במייל"
              testID="feedback-email"
              onPress={() => {
                const href = contactMailto('משוב על מעשר ישר');
                if (!href) {
                  toast.info(CONTACT_PENDING_TEXT);
                  return;
                }
                void Linking.openURL(href);
              }}
            />
          </>
        ) : (
          <Text style={styles.recurIntro}>{CONTACT_PENDING_TEXT}</Text>
        )}
      </Glass>

      <Pressable
        style={styles.privacyLinkWrap}
        onPress={() => void Linking.openURL(privacyPageUrl())}
        accessibilityRole="link"
        accessibilityLabel={PRIVACY_LINK_LABEL}
      >
        <Text style={styles.privacyLink}>{PRIVACY_LINK_LABEL} ‹</Text>
      </Pressable>

      <Pressable
        style={styles.privacyLinkWrap}
        onPress={() => void Linking.openURL(aboutPageUrl())}
        accessibilityRole="link"
        accessibilityLabel={ABOUT_LINK_LABEL}
      >
        <Text style={styles.privacyLink}>{ABOUT_LINK_LABEL} ‹</Text>
      </Pressable>

      <Pressable
        style={styles.dangerWrap}
        onPress={() =>
          toast.confirm({
            title: 'למחוק את כל הנתונים?',
            message:
              'יימחקו הפנקס, הפרופיל, ההיסטוריה, הוראות הקבע, שיחות עם נועם והגדרות נגישות. לא ניתן לשחזר.',
            destructive: true,
            confirmLabel: 'מחק הכל',
            cancelLabel: 'ביטול',
            onConfirm: async () => {
              await wipeAllData();
            },
          })
        }
        accessibilityRole="button"
        accessibilityLabel="מחק את כל הנתונים"
      >
        <Text style={styles.dangerTitle}>מחק את כל הנתונים</Text>
        <Text style={styles.dangerSub}>
          מחיקה מקומית מהמכשיר — ואז האפליקציה תיפתח כמו בפעם הראשונה
        </Text>
      </Pressable>

      <Pressable
        style={styles.resetWrap}
        onPress={() =>
          toast.confirm({
            title: t(
              profile.gender,
              'להתחיל מחדש עם נועם?',
              'להתחיל מחדש עם נועם?'
            ),
            message: t(
              profile.gender,
              'תעבור שוב את ההיכרות',
              'תעברי שוב את ההיכרות'
            ),
            destructive: false,
            confirmLabel: 'יאללה',
            cancelLabel: 'ביטול',
            onConfirm: async () => {
              await patchProfile({ onboardingDone: false });
              setSaved(false);
              toast.info(
                t(profile.gender, 'חוזר להיכרות…', 'חוזרת להיכרות…')
              );
            },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={t(
          profile.gender,
          'התחל מחדש את ההיכרות',
          'התחילי מחדש את ההיכרות'
        )}
      >
        <Text style={styles.reset}>
          {t(
            profile.gender,
            'רוצה להכיר את נועם מחדש? לחץ כאן',
            'רוצה להכיר את נועם מחדש? לחצי כאן'
          )}
        </Text>
      </Pressable>

      {versionShort ? (
        <Text style={styles.versionLine} accessibilityLabel={`גרסה ${versionShort}`}>
          גרסה {versionShort}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badgeText: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.gold,
    writingDirection: 'rtl',
  },
  avatarWrap: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarInner: {
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.extra,
    fontSize: 30,
    color: colors.gold,
    textAlign: 'center',
    lineHeight: 36,
  },
  heroTitle: {
    ...type.h1,
    color: '#fff',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  heroSub: {
    ...type.bodySm,
    color: colors.inkSoft,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  panel: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radii.xxl,
  },
  a11yTop: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radii.xxl,
  },
  a11yHint: {
    ...type.bodySm,
    color: colors.sheetMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
    writingDirection: 'rtl',
  },
  ratePanel: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    borderRadius: radii.xxl,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  fieldAccent: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  fieldLabel: {
    ...type.eyebrow,
    color: colors.gold,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.semi,
    fontSize: 17,
    color: colors.sheetInk,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    writingDirection: 'rtl',
    textAlign: 'center',
    width: '100%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: spacing.lg,
    width: '100%',
  },
  nestedSeg: {
    marginTop: 10,
    width: '100%',
  },
  rateHero: {
    ...type.moneyHero,
    fontSize: 48,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 2,
  },
  rateCaption: {
    ...type.bodySm,
    color: colors.sheetMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  customRateBlock: {
    width: '100%',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  customRateHint: {
    ...type.caption,
    color: colors.sheetMuted,
    marginBottom: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  customRateInput: {
    maxWidth: 160,
    fontFamily: fonts.numBold,
    fontSize: 22,
  },
  rateError: {
    ...type.caption,
    fontFamily: fonts.medium,
    color: colors.danger,
    marginTop: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  explainRow: {
    width: '100%',
    marginTop: 4,
    alignItems: 'center',
  },
  actions: {
    marginBottom: spacing.sm,
  },
  privacyLinkWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: 4,
  },
  privacyLink: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.gold,
    textAlign: 'center',
    textDecorationLine: 'underline',
    writingDirection: 'rtl',
  },
  dangerWrap: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.danger}66`,
    backgroundColor: colors.dangerSoft,
    gap: 4,
  },
  dangerTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.danger,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  dangerSub: {
    ...type.caption,
    color: colors.sheetMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  resetWrap: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.sheetBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reset: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  versionLine: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    opacity: 0.7,
  },
  warnCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.danger}55`,
    backgroundColor: colors.dangerSoft,
    marginBottom: spacing.md,
  },
  warnCardText: {
    ...type.bodySm,
    color: colors.sheetInk,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 22,
  },
  recurIntro: {
    ...type.bodySm,
    color: colors.sheetMuted,
    textAlign: 'start',
    marginBottom: spacing.md,
    writingDirection: 'rtl',
  },
  advOptTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.sheetInk,
    textAlign: 'start',
    writingDirection: 'rtl',
    marginBottom: 4,
  },
  advOptHint: {
    ...type.caption,
    color: colors.sheetMuted,
    textAlign: 'start',
    writingDirection: 'rtl',
    marginBottom: 10,
    lineHeight: 18,
  },
  simpleEscape: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  simpleEscapeText: {
    ...type.caption,
    color: colors.sheetMuted,
    textDecorationLine: 'underline',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  recurEmpty: {
    ...type.caption,
    color: colors.sheetMuted,
    textAlign: 'start',
    marginBottom: spacing.md,
  },
  recurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 4,
  },
  recurMain: { flex: 1, minWidth: 0 },
  recurTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.sheetInk,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  recurMeta: {
    ...type.caption,
    color: colors.sheetMuted,
    marginTop: 2,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  recurBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.sheetBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  recurBtnOn: {
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  recurBtnText: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.gold,
  },
  recurDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,80,100,0.12)',
  },
  recurDeleteText: {
    fontSize: 20,
    color: colors.danger,
    lineHeight: 22,
  },
});
