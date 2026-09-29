import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { Screen } from '../components/Screen';
import { StatHero, formatMoney, PrimaryButton, Chip, SegmentedRow, Banner } from '../components/ui';
import { Glass, GlassPill } from '../components/Glass';
import { DeleteButton } from '../components/DeleteButton';
import { SmartInsights } from '../components/SmartInsights';
import { colors, fonts, radii, spacing, type } from '../theme';
import { formatPeriod } from '../utils/history';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { BOT_NAME, t } from '../utils/copy';
import { noamHistoryHero } from '../utils/noamCompanion';
import { historySmartInsights } from '../utils/smartInsights';
import { monthsLabel } from '../utils/plural';
import { formatRelativeTime } from '../utils/relativeTime';
import {
  exportHistoryCsv,
  exportYearSummaryCsv,
  printYearSummary,
} from '../utils/exportCsv';
import type { YearMode, YearSummaryResult } from '../utils/yearSummary';
import { fillTaxCalculatorFromYear } from '../utils/taxFillBridge';
import { useTabNav } from '../navigation/TabNavContext';

type ViewMode = 'months' | 'year';
type YearSummaryModule = typeof import('../utils/hebcalLazy');

export default function HistoryScreen() {
  const { profile, history: entries, ledger, deleteMonth, clearHistory } = useApp();
  const toast = useToast();
  const { goToTab } = useTabNav();

  const [viewMode, setViewMode] = useState<ViewMode>('months');
  const [yearMode, setYearMode] = useState<YearMode>('hebrew');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  /** T-52: yearSummary + hebcal נטענים רק כשצריך תצוגה שנתית */
  const [yearMod, setYearMod] = useState<YearSummaryModule | null>(null);

  const totalRemaining = entries.reduce((s, e) => s + e.result.remaining, 0);
  const name = profile.displayName || t(profile.gender, 'חבר', 'חברה');
  const insights = useMemo(
    () => historySmartInsights({ name, gender: profile.gender, entries }),
    [name, profile.gender, entries]
  );

  useEffect(() => {
    if (viewMode !== 'year') return;
    let alive = true;
    import('../utils/hebcalLazy')
      .then((m) => {
        if (alive) setYearMod(m);
      })
      .catch(() => {
        /* סיכום שנתי יישאר ריק עד ניסיון הבא */
      });
    return () => {
      alive = false;
    };
  }, [viewMode]);

  const years = useMemo(() => {
    if (!yearMod) return [] as number[];
    return yearMod.availableYears(ledger, yearMode);
  }, [yearMod, ledger, yearMode]);
  const activeYear = selectedYear != null && years.includes(selectedYear) ? selectedYear : years[0];

  const summary = useMemo((): YearSummaryResult | null => {
    if (!yearMod || activeYear == null) return null;
    return yearMod.yearSummary(ledger, profile, yearMode, activeYear);
  }, [yearMod, ledger, profile, yearMode, activeYear]);

  const hero = (
    <View style={styles.hero}>
      <GlassPill gold>
        <Text style={styles.badgeText}>✦ ארכיון עם {BOT_NAME}</Text>
      </GlassPill>
      <Text style={styles.heroTitle}>היסטוריה</Text>
      <Text style={styles.heroSub}>{noamHistoryHero(name, profile.gender, entries.length)}</Text>
    </View>
  );

  const onFillTax = async () => {
    if (!summary || yearMode !== 'civil' || activeYear == null) return;
    const donations =
      summary.section46Approved != null
        ? summary.section46Approved
        : summary.totals.tzedaka;
    try {
      const payload = await fillTaxCalculatorFromYear(donations, activeYear);
      goToTab('Tax');
      toast.success(
        'מולא מחשבון מס ✦',
        `תרומות ${payload.donationsTotal.toLocaleString('he-IL')} ₪ · שנת ${payload.taxYear}`
      );
    } catch {
      toast.error('המילוי נכשל', 'נסה שוב');
    }
  };

  return (
    <Screen sheet hero={hero} scroll>
      <SegmentedRow>
        <Chip
          fill
          label="חודשים"
          selected={viewMode === 'months'}
          onPress={() => setViewMode('months')}
        />
        <Chip
          fill
          label="שנה"
          selected={viewMode === 'year'}
          onPress={() => setViewMode('year')}
        />
      </SegmentedRow>
      <View style={{ height: spacing.md }} />

      {viewMode === 'year' ? (
        <>
          <SegmentedRow>
            <Chip
              fill
              label="עברית"
              selected={yearMode === 'hebrew'}
              onPress={() => {
                setYearMode('hebrew');
                setSelectedYear(null);
              }}
            />
            <Chip
              fill
              label="אזרחית"
              selected={yearMode === 'civil'}
              onPress={() => {
                setYearMode('civil');
                setSelectedYear(null);
              }}
            />
          </SegmentedRow>
          <View style={{ height: spacing.sm }} />
          {!yearMod ? (
            <Text style={styles.emptySub}>טוען לוח שנתי…</Text>
          ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.yearChips}
          >
            {years.map((y) => (
              <Chip
                key={y}
                label={yearMode === 'hebrew' ? yearMod.hebrewYearLabel(y) : String(y)}
                selected={y === activeYear}
                onPress={() => setSelectedYear(y)}
              />
            ))}
          </ScrollView>
          )}
          <View style={{ height: spacing.md }} />

          {summary && yearMod ? (
            <>
              <Glass dark gold style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>
                  סיכום {yearMod.yearLabel(yearMode, activeYear!)}
                </Text>
                <View style={styles.grid}>
                  <Cell label="הכנסות" value={formatMoney(summary.totals.income)} />
                  <Cell label="ניכויים" value={formatMoney(summary.totals.expenses)} />
                  <Cell label="בסיס" value={formatMoney(summary.totals.netBase)} />
                  <Cell label="חובה" value={formatMoney(summary.totals.obligation)} />
                  <Cell label="ניתן" value={formatMoney(summary.totals.tzedaka)} />
                  <Cell
                    label="פער / נותר"
                    value={formatMoney(summary.totals.remaining)}
                    strong
                  />
                </View>
                {yearMode === 'civil' ? (
                  <Text style={styles.section46Line}>
                    עם אישור סעיף 46:{' '}
                    {formatMoney(summary.section46Approved ?? 0)}
                  </Text>
                ) : null}
              </Glass>

              <Banner
                text="חובת השנה שמחושבת על סכום השנה כולה עלולה להיבדל מסכום החובות החודשיות — בגלל עודפים או חוסרים שנסגרים בחודש."
                tone="info"
              />
              <View style={{ height: spacing.sm }} />

              <PrimaryButton
                label="ייצוא CSV שנתי ✦"
                onPress={async () => {
                  try {
                    await exportYearSummaryCsv(summary, {
                      mode: yearMode,
                      year: activeYear!,
                    });
                    toast.success('הקובץ מוכן ✦', 'נשמר / שותף מהמכשיר');
                  } catch {
                    toast.error('הייצוא נכשל', 'נסה שוב');
                  }
                }}
              />
              <View style={{ height: spacing.sm }} />
              <PrimaryButton
                label={Platform.OS === 'web' ? 'הדפסה ✦' : 'שתף להדפסה ✦'}
                onPress={async () => {
                  try {
                    await printYearSummary(summary, {
                      mode: yearMode,
                      year: activeYear!,
                    });
                  } catch {
                    toast.error('ההדפסה נכשלה', 'נסה שוב');
                  }
                }}
              />
              {yearMode === 'civil' ? (
                <>
                  <View style={{ height: spacing.sm }} />
                  <PrimaryButton label="מלא מחשבון מס ✦" onPress={() => void onFillTax()} />
                </>
              ) : null}

              <Text style={styles.monthsHeading}>חודשים בשנה</Text>
              {summary.months.length === 0 ? (
                <Glass dark style={styles.emptyCard}>
                  <Text style={styles.emptySub}>אין תנועות בשנה שנבחרה</Text>
                </Glass>
              ) : (
                summary.months.map((m) => (
                  <Glass dark key={m.period} style={styles.monthCard}>
                    <Text style={styles.cardTitle}>{m.label}</Text>
                    <View style={styles.grid}>
                      <Cell label="בסיס" value={formatMoney(m.totals.netBase)} />
                      <Cell label="חובה" value={formatMoney(m.totals.obligation)} />
                      <Cell label="ניתן" value={formatMoney(m.totals.tzedaka)} />
                      <Cell
                        label="נותר"
                        value={formatMoney(m.totals.remaining)}
                        strong
                      />
                    </View>
                    {m.surplus && m.surplus > 0 ? (
                      <Text style={styles.surplusLine}>
                        נתת {formatMoney(m.surplus)} יותר מהחובה החודש
                      </Text>
                    ) : null}
                    {profile.carryForwardSurplus && m.carryIn && m.carryIn > 0 ? (
                      <Text style={styles.carryLine}>
                        העברה מחודש קודם: {formatMoney(m.carryIn)}
                      </Text>
                    ) : null}
                  </Glass>
                ))
              )}
            </>
          ) : (
            <Glass dark style={styles.emptyCard}>
              <Text style={styles.emptySub}>אין נתונים לשנה</Text>
            </Glass>
          )}
        </>
      ) : (
        <>
          {entries.length > 0 ? (
            <>
              <SmartInsights items={insights} />
              <StatHero
                label="סה״כ יתרות לתת"
                value={formatMoney(totalRemaining)}
                hint={monthsLabel(entries.length)}
              />
              <PrimaryButton
                label="ייצוא CSV לרו״ח ✦"
                onPress={async () => {
                  try {
                    await exportHistoryCsv(entries);
                    toast.success('הקובץ מוכן ✦', 'נשמר / שותף מהמכשיר');
                  } catch {
                    toast.error('הייצוא נכשל', 'נסה שוב');
                  }
                }}
              />
              <View style={{ height: spacing.md }} />
            </>
          ) : (
            <Glass dark style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>עדיין אין ארכיון</Text>
              <Text style={styles.emptySub}>
                בסוף כל חודש לוחצים «שמור סיכום חודש», והוא נשמר כאן
              </Text>
              <PrimaryButton label="חזור לבית" onPress={() => goToTab('Home')} />
            </Glass>
          )}

          {entries.map((e) => (
            <Glass dark gold key={e.id} style={styles.monthCard}>
              <View style={styles.cardTop}>
                <View style={styles.deleteAbs}>
                  <DeleteButton
                    onPress={() =>
                      toast.confirm({
                        title: 'למחוק את החודש?',
                        message: e.label || formatPeriod(e.period),
                        destructive: true,
                        confirmLabel: 'מחק',
                        onConfirm: async () => {
                          await deleteMonth(e.id);
                          toast.success('החודש נמחק');
                        },
                      })
                    }
                  />
                </View>
                <View style={styles.cardHeadText}>
                  <Text style={styles.cardTitle}>{e.label || formatPeriod(e.period)}</Text>
                  <Text style={styles.cardMeta}>
                    {formatRelativeTime(e.savedAt)} · {e.result.ratePercent}%
                  </Text>
                </View>
              </View>
              <View style={styles.grid}>
                <Cell label="בסיס" value={formatMoney(e.result.netBase)} />
                <Cell label="חובה" value={formatMoney(e.result.obligation)} />
                <Cell label="ניתן" value={formatMoney(e.result.alreadyGiven)} />
                <Cell label="נותר" value={formatMoney(e.result.remaining)} strong />
              </View>
            </Glass>
          ))}

          {entries.length > 0 ? (
            <Pressable
              style={styles.clear}
              onPress={() =>
                toast.confirm({
                  title: 'לנקות את כל ההיסטוריה?',
                  message: 'הפעולה לא ניתנת לביטול',
                  destructive: true,
                  confirmLabel: 'נקה הכול',
                  onConfirm: async () => {
                    await clearHistory();
                    toast.success('ההיסטוריה נוקתה');
                  },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="נקה את כל ההיסטוריה"
            >
              <Text style={styles.clearText}>נקה הכול</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Cell({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.cell} accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.cellVal, strong && { color: colors.gold }]}>{value}</Text>
      <Text style={styles.cellLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', width: '100%' },
  badgeText: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.gold,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  heroTitle: {
    ...type.h1,
    color: colors.ink,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  heroSub: {
    ...type.bodySm,
    color: colors.inkSoft,
    marginTop: 4,
    textAlign: 'center',
  },
  yearChips: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  summaryCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  summaryTitle: {
    ...type.emphasis,
    fontSize: 17,
    color: colors.sheetInk,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 12,
  },
  section46Line: {
    ...type.bodySm,
    color: colors.gold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 12,
  },
  monthsHeading: {
    ...type.emphasis,
    color: colors.sheetInk,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyCard: { padding: spacing.xl, marginBottom: spacing.md },
  emptyTitle: {
    ...type.emphasis,
    fontFamily: fonts.extra,
    color: colors.sheetInk,
    fontSize: 17,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    ...type.bodySm,
    color: colors.sheetMuted,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  monthCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  surplusLine: {
    ...type.caption,
    fontFamily: fonts.semi,
    color: colors.gold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 8,
  },
  carryLine: {
    ...type.caption,
    color: colors.sheetMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 4,
  },
  cardTop: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    minHeight: 36,
    paddingHorizontal: 40,
  },
  deleteAbs: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  cardHeadText: {
    alignItems: 'center',
  },
  cardTitle: {
    ...type.emphasis,
    fontSize: 17,
    color: colors.sheetInk,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  cardMeta: {
    ...type.caption,
    color: colors.sheetMuted,
    fontFamily: fonts.regular,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  cell: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  cellVal: {
    ...type.money,
    fontSize: 14,
    color: colors.sheetInk,
    textAlign: 'center',
  },
  cellLbl: {
    ...type.caption,
    color: colors.sheetMuted,
    marginTop: 3,
    textAlign: 'center',
  },
  clear: {
    marginTop: spacing.sm,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.sheetBorder,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  clearText: {
    fontFamily: fonts.medium,
    color: colors.expense,
    fontSize: 13,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
});
