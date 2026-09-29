import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from '../components/Icon';
import { Glass } from '../components/Glass';
import { DeleteButton } from '../components/DeleteButton';
import { ProgressRing, type Ring } from '../components/ProgressRing';
import { Screen } from '../components/Screen';
import { Banner, formatMoney, PrimaryButton } from '../components/ui';
import { PrivacyNotice } from '../components/PrivacyNotice';
import { AnimatedMoney } from '../components/AnimatedMoney';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { BOT_NAME, t } from '../utils/copy';
import {
  currentPeriod,
  formatPeriod,
} from '../utils/history';
import { entriesForPeriod } from '../utils/ledger';
import { resolvePeriodTotals } from '../utils/totalsAdvanced';
import type { GreetingResult } from '../utils/greetings/types';
import {
  noamBannerTip,
  noamEmptyLedger,
  noamLedgerNudge,
  noamSaveMonthToast,
} from '../utils/noamCompanion';
import { NoamNudge } from '../components/NoamNudge';
import { SmartInsights } from '../components/SmartInsights';
import { Accordion } from '../components/Accordion';
import { colors, fonts, radii, shadow, spacing, type } from '../theme';
import type { LedgerEntry } from '../types/ledger';
import { homeSmartInsights } from '../utils/smartInsights';
import type { SmartInsight } from '../utils/smartInsights';
import { EXPLAIN } from '../utils/chatScript';
import { daysLabel, entriesLabel } from '../utils/plural';
import { formatRatePercent } from '../utils/rateLabel';
import { formatRelativeTime } from '../utils/relativeTime';
import { displayNote } from '../utils/recurring';
import {
  exportBackup,
  shouldShowBackupReminder,
  subscribeBackupReminder,
} from '../utils/backupExport';
import {
  closeMonthBannerText,
  dismissCloseMonthBanner,
  loadCloseMonthDismissed,
  previousPeriod,
  shouldShowCloseMonthBanner,
} from '../utils/monthlyReminder';
import { useTabNav } from '../navigation/TabNavContext';

const BASE_EXPLAIN_SHORT = `בסיס המעשר כאן = הכנסות שרשמת פחות הוצאות מותרות (מס / ביטוח / בריאות / הוצאות עסק).
לא מנכים הוצאות מחיה (שכירות, אוכל וכו'). צדקה לא מורידה מהבסיס — רק נספרת מול החובה.`;

export default function HomeScreen() {
  const {
    profile,
    ledger,
    history,
    removeEntry,
    restoreEntry,
    openAdd,
    openEdit,
    saveMonth,
    patchProfile,
  } = useApp();
  const toast = useToast();
  const { goToTab } = useTabNav();
  const [period, setPeriod] = useState(currentPeriod);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [showBackupBanner, setShowBackupBanner] = useState(false);
  const [closeMonthDismissed, setCloseMonthDismissed] = useState<string | null>(null);
  const [closeMonthReady, setCloseMonthReady] = useState(false);
  const periodScrollRef = useRef<ScrollView>(null);
  const periodLayouts = useRef<Record<string, { x: number; w: number }>>({});
  const [periodViewportW, setPeriodViewportW] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadCloseMonthDismissed().then((v) => {
      if (!cancelled) {
        setCloseMonthDismissed(v);
        setCloseMonthReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void shouldShowBackupReminder(ledger.length).then((show) => {
        if (!cancelled) setShowBackupBanner(show);
      });
    };
    refresh();
    const unsub = subscribeBackupReminder(refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [ledger.length]);

  const name = profile.displayName || t(profile.gender, 'חבר', 'חברה');
  const [greet, setGreet] = useState<GreetingResult | null>(null);

  // T-52: טעינה עצלה של hebcal אחרי המסך הראשון — לא בחבילה הראשית
  useEffect(() => {
    let alive = true;
    import('../utils/hebcalLazy')
      .then((m) => {
        if (!alive) return;
        setGreet(m.getSmartGreeting({ name, gender: profile.gender, now }));
      })
      .catch(() => {
        /* לוח עברי נכשל — נשארים בלי ברכה עד ניסיון הבא */
      });
    return () => {
      alive = false;
    };
  }, [name, profile.gender, now]);
  const journeyDays = useMemo(() => {
    if (!profile.joinedAt) return null;
    const start = new Date(profile.joinedAt).getTime();
    if (!Number.isFinite(start)) return null;
    return Math.max(1, Math.floor((Date.now() - start) / 86400000) + 1);
  }, [profile.joinedAt]);
  const monthEntries = useMemo(
    () => entriesForPeriod(ledger, period),
    [ledger, period]
  );
  const totals = useMemo(
    () =>
      resolvePeriodTotals(
        ledger,
        period,
        profile,
        !!profile.carryForwardSurplus
      ),
    [ledger, period, profile]
  );

  const ring: Ring = useMemo(() => {
    if (monthEntries.length === 0) return { kind: 'empty' };
    if (totals.obligation <= 0) return { kind: 'none' };
    const given = totals.tzedaka + (totals.carryIn || 0);
    return {
      kind: 'progress',
      percent: Math.min(100, Math.round((given / totals.obligation) * 100)),
    };
  }, [monthEntries.length, totals]);

  const ringStatusLine = useMemo(() => {
    if (ring.kind === 'empty') return 'עדיין אין תנועות החודש';
    if (ring.kind === 'none') {
      if (totals.tzedaka > 0) {
        return `אין חובה החודש · נתת ${formatMoney(totals.tzedaka)}`;
      }
      return 'אין חובה החודש';
    }
    return null;
  }, [ring, totals.tzedaka]);

  const surplusLine =
    totals.surplus > 0
      ? `נתת ${formatMoney(totals.surplus)} יותר מהחובה החודש`
      : null;
  const carryInLine =
    profile.carryForwardSurplus && totals.carryIn > 0
      ? `כולל העברה מחודש קודם: ${formatMoney(totals.carryIn)}`
      : null;
  const periods = useMemo(() => {
    const set = new Set<string>([currentPeriod()]);
    ledger.forEach((e) => set.add(e.period));
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return [...set].sort().reverse();
  }, [ledger]);

  const onSaveMonth = async () => {
    if (totals.obligation <= 0 && monthEntries.length === 0) {
      toast.warn(
        'רגע',
        t(profile.gender, 'הוסף תנועות לפני שמירה.', 'הוסיפי תנועות לפני שמירה.')
      );
      return;
    }
    setSaving(true);
    try {
      await saveMonth({
        period,
        label: formatPeriod(period),
        inputs: totals.inputs,
        result: {
          netBase: totals.netBase,
          obligation: totals.obligation,
          alreadyGiven: totals.tzedaka,
          remaining: totals.remaining,
          ratePercent: Number(formatRatePercent(profile.rate)),
        },
      });
      toast.success('נשמר בהיסטוריה ✦', noamSaveMonthToast(name, profile.gender, formatPeriod(period)));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 900);
    } catch {
      toast.error('השמירה נכשלה', 'נסה שוב בעוד רגע');
    } finally {
      setSaving(false);
    }
  };

  const companionLine = useMemo(
    () =>
      noamLedgerNudge({
        name,
        gender: profile.gender,
        totals,
        entryCount: monthEntries.length,
        rate: profile.rate,
        journeyDays,
      }),
    [name, profile.gender, profile.rate, totals, monthEntries.length, journeyDays]
  );
  const emptyCopy = useMemo(
    () => noamEmptyLedger(name, profile.gender),
    [name, profile.gender]
  );
  const insights = useMemo(
    () =>
      homeSmartInsights({
        name,
        gender: profile.gender,
        totals,
        entries: monthEntries,
        rate: profile.rate,
        period,
        isCurrentPeriod: period === currentPeriod(),
      }),
    [name, profile.gender, profile.rate, totals, monthEntries, period]
  );
  const paceInsight = useMemo(
    () => insights.find((i) => i.id === 'pace') ?? null,
    [insights]
  );
  const otherInsights = useMemo(
    () => insights.filter((i) => i.id !== 'pace'),
    [insights]
  );

  const showTuneCard = !!profile.skippedSetup && !profile.tuneCardDismissed;
  const showNoamNudge = !profile.hideNoamNudge;

  useEffect(() => {
    const layout = periodLayouts.current[period];
    if (!layout || periodViewportW <= 0) return;
    const x = Math.max(0, layout.x - (periodViewportW - layout.w) / 2);
    periodScrollRef.current?.scrollTo({ x, animated: true });
  }, [period, periodViewportW, periods]);

  const onInsightAction = (item: SmartInsight) => {
    if (item.actionKind === 'income') openAdd('income', period);
    else if (item.actionKind === 'expense') openAdd('expense', period);
    else if (item.actionKind === 'tzedaka') openAdd('tzedaka', period);
    else if (item.actionKind === 'save') void onSaveMonth();
  };

  const prevClosePeriod = useMemo(() => previousPeriod(now), [now]);
  const showCloseMonthBanner =
    closeMonthReady &&
    shouldShowCloseMonthBanner(
      history.map((h) => h.period),
      closeMonthDismissed,
      now
    );

  const onDismissCloseMonth = async () => {
    await dismissCloseMonthBanner(prevClosePeriod);
    setCloseMonthDismissed(prevClosePeriod);
  };

  const hero = (
    <View style={styles.hero}>
      <View style={styles.brandPill}>
        <Text style={styles.brandPillText}>
          מעשר ישר · {BOT_NAME}
        </Text>
      </View>
      <Text style={styles.greet}>
        {greet?.line ?? ''}
      </Text>
      <Text style={styles.sub}>
        {formatPeriod(period)} · {formatRatePercent(profile.rate)}%
        {journeyDays != null ? ` · ${daysLabel(journeyDays)}` : ''}
      </Text>
    </View>
  );

  const isEmptyMonth = monthEntries.length === 0;
  const celebrateDone = totals.remaining <= 0 && totals.obligation > 0;

  return (
    <Screen sheet hero={hero} scroll>
      <PrivacyNotice />
      {showCloseMonthBanner ? (
        <Glass dark gold style={styles.closeMonthCard}>
          <View style={styles.closeMonthRow}>
            <Pressable
              style={styles.closeMonthMain}
              onPress={() => setPeriod(prevClosePeriod)}
              accessibilityRole="button"
              accessibilityLabel={closeMonthBannerText(prevClosePeriod)}
              accessibilityHint="מעבר לחודש הקודם לשמירת סיכום"
            >
              <Text style={styles.closeMonthTitle}>
                {closeMonthBannerText(prevClosePeriod)}
              </Text>
              <Text style={styles.closeMonthHint}>
                לחצו כדי לעבור ל{formatPeriod(prevClosePeriod)} ולשמור סיכום
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void onDismissCloseMonth()}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="סגור תזכורת סגירת חודש"
              style={styles.closeMonthDismiss}
            >
              <Text style={styles.closeMonthDismissText}>×</Text>
            </Pressable>
          </View>
        </Glass>
      ) : null}
      {showBackupBanner ? (
        <Pressable
          onPress={async () => {
            try {
              await exportBackup({ includeChat: false });
              setShowBackupBanner(false);
              toast.success('הגיבוי מוכן ✦', 'הקובץ הורד / שותף מהמכשיר');
            } catch {
              toast.error('הגיבוי נכשל', 'אפשר גם מההגדרות');
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="תזכורת גיבוי — לחץ לגיבוי עכשיו"
          style={{ marginBottom: spacing.md }}
        >
          <Banner
            text="עבר יותר מחודש בלי גיבוי — מומלץ לגבות את הנתונים (לחיצה כאן)"
            tone="warn"
          />
        </Pressable>
      ) : null}

      {showTuneCard ? (
        <Glass dark gold style={styles.tuneCard}>
          <View style={styles.closeMonthRow}>
            <Pressable
              style={styles.closeMonthMain}
              onPress={() => goToTab('Settings')}
              accessibilityRole="button"
              accessibilityLabel="לכוון? מעבר להגדרות"
            >
              <Text style={styles.tuneTitle}>לכוון?</Text>
              <Text style={styles.tuneBody}>
                אפשר לעדכן שם, לשון פנייה ואחוז מעשר בהגדרות — בלחיצה אחת.
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void patchProfile({ tuneCardDismissed: true })}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="סגור כרטיס לכוון"
              style={styles.closeMonthDismiss}
            >
              <Text style={styles.closeMonthDismissText}>×</Text>
            </Pressable>
          </View>
        </Glass>
      ) : null}

      {showNoamNudge ? (
        <NoamNudge
          text={companionLine}
          onDismiss={() => void patchProfile({ hideNoamNudge: true })}
        />
      ) : null}

      {/* 1) תחזית חודשית */}
      {paceInsight ? (
        <SmartInsights
          items={[paceInsight]}
          onAction={onInsightAction}
          hideHeader
          style={{ marginBottom: spacing.sm }}
        />
      ) : null}

      <View
        style={styles.periodWrap}
        onLayout={(e) => setPeriodViewportW(e.nativeEvent.layout.width)}
      >
        <View style={styles.periodFadeStart} pointerEvents="none" />
        <ScrollView
          ref={periodScrollRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.periodRow}
          {...({ dir: 'rtl' } as object)}
        >
          {periods.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              onLayout={(e) => {
                periodLayouts.current[p] = {
                  x: e.nativeEvent.layout.x,
                  w: e.nativeEvent.layout.width,
                };
              }}
              style={[styles.periodChip, period === p && styles.periodChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p }}
              accessibilityLabel={`תקופה ${formatPeriod(p)}`}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextOn]}>
                {formatPeriod(p)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.periodFadeEnd} pointerEvents="none" />
      </View>

      {/* 2) טבעת יתרה */}
      <Glass
        dark
        gold
        style={styles.balanceCard}
        accessibilityRole="summary"
        accessibilityLabel={
          celebrateDone
            ? `החודש כוסה. חובה ${formatMoney(totals.obligation)}`
            : totals.obligation <= 0
              ? ringStatusLine || 'אין חובה החודש'
              : `יתרה לתת ${formatMoney(totals.remaining)} מתוך חובה של ${formatMoney(totals.obligation)}`
        }
      >
        {isEmptyMonth ? (
          <View style={styles.emptyHome}>
            <Text style={styles.emptyHomeTitle}>שלושה צעדים</Text>
            <Text style={styles.emptyHomeBody}>
              רשום הכנסה, רשום ניכוי חובה, רשום צדקה
            </Text>
            <PrimaryButton
              label="הוסף הכנסה ראשונה"
              onPress={() => openAdd('income', period)}
            />
          </View>
        ) : (
          <>
            <View style={styles.balanceRow}>
              <View style={styles.balanceText}>
                <Text style={styles.balanceLabel}>יתרה לתת</Text>
                <AnimatedMoney value={totals.remaining} style={styles.balanceValue} />
                {ringStatusLine ? (
                  <Text style={styles.balanceHint}>
                    <Text style={styles.balanceHintEm}>{ringStatusLine}</Text>
                  </Text>
                ) : (
                  <Text style={styles.balanceHint}>
                    מתוך חובה של{' '}
                    <Text style={styles.balanceHintEm}>{formatMoney(totals.obligation)}</Text>
                  </Text>
                )}
                {surplusLine ? (
                  <Text style={styles.surplusHint}>{surplusLine}</Text>
                ) : null}
                {carryInLine ? (
                  <Text style={styles.carryHint}>{carryInLine}</Text>
                ) : null}
              </View>
              <ProgressRing
                ring={ring}
                color={colors.gold}
                celebrate={celebrateDone || savedFlash}
                accessibilityHidden
                accessibilityLabel={
                  celebrateDone || savedFlash
                    ? `החודש כוסה. חובה ${formatMoney(totals.obligation)}`
                    : totals.obligation <= 0
                      ? ringStatusLine || 'אין חובה החודש'
                      : `יתרה לתת ${formatMoney(totals.remaining)} מתוך חובה של ${formatMoney(totals.obligation)}`
                }
              />
            </View>
            {/* 3) כרטיסי סיכום */}
            <View style={styles.balanceGrid}>
              <Stat
                label="הכנסות (+בסיס)"
                value={formatMoney(totals.income)}
                color={colors.income}
              />
              <Stat
                label="ניכויים (−בסיס)"
                value={formatMoney(totals.expenses)}
                color={colors.expense}
              />
              <Stat label="בסיס נטו" value={formatMoney(totals.netBase)} color={colors.accent} />
              <Stat label="צדקה (מול חובה)" value={formatMoney(totals.tzedaka)} color={colors.tzedaka} />
            </View>
            <Text style={styles.baseHint}>
              חובה = {formatRatePercent(profile.rate)}% × בסיס נטו · ניכוי כאן = יורד מהבסיס (לא מחיה)
            </Text>
            {(totals.lines.length > 0 || totals.warnings.length > 0) && (
              <View style={styles.howWrap}>
                <Text style={styles.howTitle}>איך חישבנו</Text>
                {totals.lines.map((line) => (
                  <View key={line.id} style={styles.howRow}>
                    <Text style={styles.howLabel} numberOfLines={2}>
                      {line.label}
                      {line.kind === 'exempt' ? ' · פטור' : ''}
                    </Text>
                    <Text
                      style={[
                        styles.howAmt,
                        {
                          color:
                            line.kind === 'deduction'
                              ? colors.expense
                              : line.kind === 'exempt'
                                ? colors.inkSoft
                                : colors.income,
                        },
                      ]}
                    >
                      {line.amount >= 0 ? '+' : ''}
                      {formatMoney(line.amount)}
                    </Text>
                  </View>
                ))}
                {totals.warnings.map((w, i) => (
                  <Text key={`w-${i}`} style={styles.howWarn}>
                    ⚠ {w}
                  </Text>
                ))}
              </View>
            )}
            <View style={styles.cardFooter}>
              <View style={styles.monthBadge}>
                <Text style={styles.monthBadgeText}>
                  ✦ {entriesLabel(monthEntries.length)} החודש
                </Text>
              </View>
            </View>
          </>
        )}
      </Glass>

      {/* 4) תובנה אחת + עוד */}
      {!isEmptyMonth && otherInsights.length > 0 ? (
        <SmartInsights items={otherInsights} onAction={onInsightAction} maxVisible={1} />
      ) : null}

      <Accordion
        items={[
          {
            id: 'base',
            question: 'מה נכנס לבסיס המעשר?',
            answer: `${BASE_EXPLAIN_SHORT}\n\n${EXPLAIN.net}`,
          },
        ]}
        style={{ marginBottom: spacing.md }}
      />

      <View style={styles.actions}>
        <Action label="הכנסה" color={colors.income} onPress={() => openAdd('income', period)} />
        <Action label="ניכוי" color={colors.expense} onPress={() => openAdd('expense', period)} />
        <Action label="צדקה" color={colors.tzedaka} onPress={() => openAdd('tzedaka', period)} primary />
      </View>

      <View style={styles.listHead}>
        <View style={styles.sectionAccent} />
        <Text style={styles.listTitle}>התחנות שלך</Text>
        <View style={styles.listCountBadge}>
          <Text style={styles.listCount}>{monthEntries.length}</Text>
        </View>
      </View>

      {monthEntries.length === 0 ? (
        <Glass dark style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
          <Text style={styles.emptySub}>{emptyCopy.body}</Text>
          <View style={styles.emptyActions}>
            <PrimaryButton label="הוסף הכנסה ראשונה" onPress={() => openAdd('income', period)} />
          </View>
        </Glass>
      ) : (
        <Glass dark style={{ marginBottom: spacing.md }}>
          {monthEntries.map((e, i) => (
            <LedgerRow
              key={e.id}
              entry={e}
              isLast={i === monthEntries.length - 1}
              onPress={() => openEdit(e)}
              onDelete={() =>
                toast.confirm({
                  title: 'למחוק את התנועה?',
                  message: `${e.category} · ${formatMoney(e.amount)}`,
                  destructive: true,
                  confirmLabel: 'מחק',
                  onConfirm: async () => {
                    const snapshot = e;
                    await removeEntry(e.id);
                    toast.undo({
                      title: 'התנועה נמחקה',
                      message: 'מחק — בטל',
                      duration: 5000,
                      onUndo: async () => {
                        await restoreEntry(snapshot);
                        toast.success('התנועה שוחזרה');
                      },
                    });
                  },
                })
              }
            />
          ))}
        </Glass>
      )}

      <Pressable
        style={[styles.saveBtn, shadow.float, saving && { opacity: 0.55 }]}
        onPress={onSaveMonth}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        accessibilityLabel={saving ? 'שומר סיכום חודש' : 'שמור סיכום חודש'}
      >
        <Text style={styles.saveText}>
          {saving ? 'שומר…' : savedFlash ? '✔ נשמר' : 'שמור סיכום חודש'}
        </Text>
      </Pressable>

      <Banner text={noamBannerTip(profile.gender)} tone="info" />
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat} accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function Action({
  label,
  color,
  onPress,
  primary,
}: {
  label: string;
  color: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`הוסף ${label}`}
      style={[
        styles.action,
        primary && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
      ]}
    >
      <View style={[styles.actionDot, { backgroundColor: color }]} />
      <Text style={[styles.actionText, primary && { color: colors.gold }]}>{label}</Text>
    </Pressable>
  );
}

function LedgerRow({
  entry,
  isLast,
  onPress,
  onDelete,
}: {
  entry: LedgerEntry;
  isLast: boolean;
  onPress?: () => void;
  onDelete: () => void;
}) {
  const isIn = entry.kind === 'income';
  const isTz = entry.kind === 'tzedaka';
  const color = isIn ? colors.income : isTz ? colors.tzedaka : colors.expense;
  const softBg = isIn
    ? 'rgba(126, 200, 227, 0.12)'
    : isTz
      ? 'rgba(255, 216, 138, 0.14)'
      : 'rgba(240, 168, 184, 0.12)';
  const kindLabel = isIn ? 'הכנסה' : isTz ? 'צדקה' : 'ניכוי';
  const sign = isIn ? '+' : '−';
  const time = formatRelativeTime(entry.date ?? entry.createdAt);
  const note = displayNote(entry.note);
  const rowLabel = [entry.category || kindLabel, formatMoney(entry.amount), time]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.row, { backgroundColor: softBg }, !isLast && styles.rowBorder]}>
      <Pressable
        onPress={onPress}
        onLongPress={onDelete}
        style={styles.rowMain}
        accessibilityRole="button"
        accessibilityLabel={rowLabel}
        accessibilityHint={onPress ? 'Enter לעריכה' : undefined}
      >
        <View style={[styles.rowAccent, { backgroundColor: color }]} />
        <View style={styles.rowMid}>
          <View style={styles.rowTop}>
            <Text style={styles.rowCat} numberOfLines={1}>
              {entry.category}
            </Text>
            <Text style={[styles.rowAmount, { color }]} numberOfLines={1}>
              {sign}
              {formatMoney(entry.amount)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={styles.rowNote} numberOfLines={1}>
              {note || kindLabel}
            </Text>
            <Text style={styles.rowDate} numberOfLines={1}>
              {time}
            </Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.rowDeleteCol}>
        <DeleteButton
          onPress={onDelete}
          size={28}
          accessibilityLabel={`מחק ${entry.category || kindLabel}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', width: '100%' },
  closeMonthCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  closeMonthRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  closeMonthMain: {
    flex: 1,
    minWidth: 0,
  },
  closeMonthTitle: {
    ...type.emphasis,
    fontFamily: fonts.semi,
    color: colors.gold,
    textAlign: 'start',
    writingDirection: 'rtl',
    lineHeight: 22,
  },
  closeMonthHint: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 4,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  closeMonthDismiss: {
    minWidth: 44,
    minHeight: 44,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeMonthDismissText: {
    fontSize: 20,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  brandPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassGoldBorder,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  brandPillText: {
    fontFamily: fonts.displayExtra,
    fontSize: 15,
    color: colors.ink,
    writingDirection: 'rtl',
    textAlign: 'center',
    ...Platform.select({
      web: { userSelect: 'none', caretColor: 'transparent' } as object,
      default: {},
    }),
  },
  greet: {
    ...type.highlight,
    fontSize: 26,
    color: colors.gold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 4,
    ...Platform.select({
      web: { userSelect: 'none', caretColor: 'transparent' } as object,
      default: {},
    }),
  },
  sub: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 6,
    textAlign: 'center',
  },
  periodWrap: {
    width: '100%',
    marginBottom: spacing.md,
    position: 'relative',
  },
  periodFadeStart: {
    position: 'absolute',
    start: 0,
    top: 0,
    bottom: 0,
    width: 18,
    zIndex: 2,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(to left, transparent, rgba(20,27,48,0.95))',
      } as object,
      default: {},
    }),
  },
  periodFadeEnd: {
    position: 'absolute',
    end: 0,
    top: 0,
    bottom: 0,
    width: 18,
    zIndex: 2,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(to right, transparent, rgba(20,27,48,0.95))',
      } as object,
      default: {},
    }),
  },
  tuneCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  tuneTitle: {
    ...type.emphasis,
    fontFamily: fonts.semi,
    color: colors.gold,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  tuneBody: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 4,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  emptyHome: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.md,
  },
  emptyHomeTitle: {
    ...type.emphasis,
    fontFamily: fonts.extra,
    color: colors.gold,
    fontSize: 17,
    textAlign: 'center',
  },
  emptyHomeBody: {
    ...type.bodySm,
    color: colors.inkMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: spacing.sm,
  },
  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.sheetBorder,
  },
  periodChipOn: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
  },
  periodText: {
    ...type.caption,
    color: colors.sheetInk,
    fontFamily: fonts.medium,
  },
  periodTextOn: { color: colors.ink, fontFamily: fonts.bold },
  balanceCard: {
    padding: spacing.lg,
    width: '100%',
    marginBottom: spacing.md,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: spacing.md,
  },
  balanceText: { flex: 1, alignItems: 'flex-start' },
  balanceLabel: {
    ...type.eyebrow,
    color: colors.gold,
  },
  balanceValue: {
    ...type.moneyHero,
    color: colors.ink,
    marginTop: 4,
  },
  balanceHint: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 6,
  },
  balanceHintEm: {
    fontFamily: fonts.bold,
    color: colors.inkMuted,
  },
  surplusHint: {
    ...type.caption,
    fontFamily: fonts.semi,
    color: colors.gold,
    marginTop: 6,
    writingDirection: 'rtl',
  },
  carryHint: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 4,
    writingDirection: 'rtl',
  },
  baseHint: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 18,
  },
  howWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
    gap: 6,
    width: '100%',
  },
  howTitle: {
    ...type.eyebrow,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 4,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  howLabel: {
    ...type.caption,
    color: colors.inkMuted,
    flex: 1,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  howAmt: {
    ...type.caption,
    fontFamily: fonts.semi,
    writingDirection: 'ltr',
  },
  howWarn: {
    ...type.caption,
    color: colors.gold,
    textAlign: 'start',
    writingDirection: 'rtl',
    marginTop: 2,
    lineHeight: 18,
  },
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  stat: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  statVal: { ...type.money, fontSize: 13, textAlign: 'center' },
  statLbl: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 2,
    textAlign: 'center',
  },
  cardFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  monthBadge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassGoldBorder,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  monthBadgeText: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.gold,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.lg,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.sheetBorder,
    ...shadow.soft,
  },
  actionDot: { width: 8, height: 8, borderRadius: 4 },
  actionText: {
    ...type.emphasis,
    fontSize: 13,
    color: colors.sheetInk,
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.goldDeep,
  },
  listTitle: {
    ...type.h3,
    color: colors.sheetInk,
    flex: 1,
  },
  listCountBadge: {
    minWidth: 28,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  listCount: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  emptyCard: { padding: spacing.xl, marginBottom: spacing.md },
  emptyTitle: {
    ...type.emphasis,
    fontFamily: fonts.extra,
    color: colors.sheetInk,
    fontSize: 17,
    textAlign: 'center',
  },
  emptySub: {
    ...type.bodySm,
    color: colors.sheetMuted,
    marginTop: 8,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyActions: { marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 10,
    minHeight: 56,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.sheetBorder,
  },
  rowAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    minHeight: 28,
  },
  rowMid: { flex: 1, minWidth: 0, gap: 4 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowCat: {
    ...type.emphasis,
    fontSize: 14,
    color: colors.sheetInk,
    textAlign: 'start',
    writingDirection: 'rtl',
    flex: 1,
    minWidth: 0,
  },
  rowNote: {
    ...type.caption,
    color: colors.sheetMuted,
    textAlign: 'start',
    writingDirection: 'rtl',
    flex: 1,
    minWidth: 0,
  },
  rowDate: {
    ...type.caption,
    color: colors.sheetMuted,
    fontFamily: fonts.regular,
    textAlign: 'end',
    writingDirection: 'rtl',
    flexShrink: 0,
  },
  rowAmount: {
    ...type.money,
    fontSize: 14,
    textAlign: 'end',
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
    minWidth: 88,
    flexShrink: 0,
  },
  rowDeleteCol: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveText: {
    ...type.button,
    color: colors.primaryOn,
  },
});
