import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import Icon from '../components/Icon';
import { Glass } from '../components/Glass';
import { DeleteButton } from '../components/DeleteButton';
import { ProgressRing } from '../components/ProgressRing';
import { Screen } from '../components/Screen';
import { Banner, formatMoney, PrimaryButton } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { BOT_NAME, t } from '../utils/copy';
import {
  currentPeriod,
  formatPeriod,
  saveHistoryEntry,
} from '../utils/history';
import { computeTotals, entriesForPeriod } from '../utils/ledger';
import { getSmartGreeting } from '../utils/greeting';
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
import { defaultMaaserInputs } from '../utils/maaserCalc';
import { homeSmartInsights } from '../utils/smartInsights';
import type { SmartInsight } from '../utils/smartInsights';
import { EXPLAIN } from '../utils/chatScript';
import { daysLabel, entriesLabel } from '../utils/plural';
import { formatRelativeTime } from '../utils/relativeTime';

const BASE_EXPLAIN_SHORT = `בסיס המעשר כאן = הכנסות שרשמת פחות הוצאות מותרות (מס / ביטוח / בריאות / הוצאות עסק).
לא מנכים הוצאות מחיה (שכירות, אוכל וכו'). צדקה לא מורידה מהבסיס — רק נספרת מול החובה.`;

export default function HomeScreen() {
  const { profile, ledger, removeEntry, openAdd } = useApp();
  const toast = useToast();
  const [period, setPeriod] = useState(currentPeriod);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const name = profile.displayName || t(profile.gender, 'חבר', 'חברה');
  const greet = useMemo(
    () => getSmartGreeting({ name, gender: profile.gender, now }),
    [name, profile.gender, now]
  );
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
    () => computeTotals(monthEntries, profile.rate),
    [monthEntries, profile.rate]
  );

  const progressPct = useMemo(() => {
    if (totals.obligation <= 0) return totals.tzedaka > 0 ? 100 : 0;
    return Math.min(100, Math.round((totals.tzedaka / totals.obligation) * 100));
  }, [totals]);

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
      await saveHistoryEntry({
        period,
        label: formatPeriod(period),
        inputs: {
          ...defaultMaaserInputs(),
          rate: profile.rate,
          otherIncome: totals.income,
          incomeTax: totals.expenses,
          alreadyGivenTzedaka: totals.tzedaka,
          taxDeductionMode: 'after_mandatory',
        },
        result: {
          netBase: totals.netBase,
          obligation: totals.obligation,
          alreadyGiven: totals.tzedaka,
          remaining: totals.remaining,
          ratePercent: profile.rate * 100,
        },
      });
      toast.success('נשמר בהיסטוריה ✦', noamSaveMonthToast(name, profile.gender, formatPeriod(period)));
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

  const onInsightAction = (item: SmartInsight) => {
    if (item.actionKind === 'income') openAdd('income');
    else if (item.actionKind === 'expense') openAdd('expense');
    else if (item.actionKind === 'tzedaka') openAdd('tzedaka');
    else if (item.actionKind === 'save') void onSaveMonth();
  };

  const hero = (
    <View style={styles.hero}>
      <View style={styles.brandPill}>
        <Text style={styles.brandPillText}>מעשר ישר · {BOT_NAME}</Text>
      </View>
      <Text style={styles.greet}>{greet.line}</Text>
      <Text style={styles.sub}>
        {formatPeriod(period)} · {profile.rate * 100}%
        {journeyDays != null ? ` · ${daysLabel(journeyDays)}` : ''}
      </Text>
    </View>
  );

  return (
    <Screen sheet hero={hero} scroll>
      <Banner
        text="הנתונים נשמרים במכשיר בלבד — לא נשלחים לשרת"
        tone="ok"
      />
      <NoamNudge text={companionLine} />
      <SmartInsights items={insights} onAction={onInsightAction} />

      <View style={styles.periodWrap}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.periodRow}
        >
          {periods.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
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
      </View>

      <Glass
        dark
        gold
        style={styles.balanceCard}
        accessibilityLabel={`יתרה לתת ${formatMoney(totals.remaining)}, מתוך חובה ${formatMoney(totals.obligation)}`}
      >
        <View style={styles.balanceRow}>
          <View style={styles.balanceText}>
            <Text style={styles.balanceLabel}>יתרה לתת</Text>
            <Text style={styles.balanceValue}>{formatMoney(totals.remaining)}</Text>
            <Text style={styles.balanceHint}>
              מתוך חובה של{' '}
              <Text style={styles.balanceHintEm}>{formatMoney(totals.obligation)}</Text>
            </Text>
          </View>
          <ProgressRing percent={progressPct} color={colors.gold} />
        </View>
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
          חובה = {profile.rate * 100}% × בסיס נטו · הוצאה כאן = ניכוי מהבסיס (לא מחיה)
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.monthBadge}>
            <Text style={styles.monthBadgeText}>
              ✦ {entriesLabel(monthEntries.length)} החודש
            </Text>
          </View>
        </View>
      </Glass>

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
        <Action label="הכנסה" color={colors.income} onPress={() => openAdd('income')} />
        <Action label="ניכוי" color={colors.expense} onPress={() => openAdd('expense')} />
        <Action label="צדקה" color={colors.tzedaka} onPress={() => openAdd('tzedaka')} primary />
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
            <PrimaryButton label="הוסף תנועה ✦" onPress={() => openAdd('income')} />
          </View>
        </Glass>
      ) : (
        <Glass dark style={{ marginBottom: spacing.md }}>
          {monthEntries.map((e, i) => (
            <LedgerRow
              key={e.id}
              entry={e}
              isLast={i === monthEntries.length - 1}
              onDelete={() =>
                toast.confirm({
                  title: 'למחוק את התנועה?',
                  message: 'לא ניתן לשחזר אחר כך',
                  destructive: true,
                  confirmLabel: 'מחק',
                  onConfirm: async () => {
                    await removeEntry(e.id);
                    toast.success('התנועה נמחקה');
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
        <Text style={styles.saveText}>{saving ? 'שומר…' : 'שמור סיכום חודש'}</Text>
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
  onDelete,
}: {
  entry: LedgerEntry;
  isLast: boolean;
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
  const time = formatRelativeTime(entry.createdAt);

  return (
    <Pressable
      onLongPress={onDelete}
      style={[styles.row, { backgroundColor: softBg }, !isLast && styles.rowBorder]}
      accessibilityRole="button"
      accessibilityLabel={`${kindLabel}, ${entry.category}, ${sign}${formatMoney(entry.amount)}${entry.note ? `, ${entry.note}` : ''}`}
      accessibilityHint="לחיצה ארוכה למחיקה"
    >
      <View style={[styles.rowAccent, { backgroundColor: color }]} />
      <View style={styles.rowMid}>
        <View style={styles.rowKindRow}>
          <View style={[styles.rowKindPill, { borderColor: `${color}88`, backgroundColor: `${color}22` }]}>
            <Text style={[styles.rowKindText, { color }]}>{kindLabel}</Text>
          </View>
          <Text style={styles.rowCat}>{entry.category}</Text>
        </View>
        {entry.note ? <Text style={styles.rowNote}>{entry.note}</Text> : null}
        <Text style={styles.rowDate}>{time}</Text>
      </View>
      <View style={styles.rowAmountCol}>
        <Text style={[styles.rowAmount, { color }]} numberOfLines={1}>
          {sign}
          {formatMoney(entry.amount)}
        </Text>
      </View>
      <View style={styles.rowDeleteCol}>
        <DeleteButton onPress={onDelete} size={28} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', width: '100%' },
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
  },
  greet: {
    ...type.highlight,
    fontSize: 26,
    color: colors.gold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 4,
  },
  sub: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 6,
    textAlign: 'center',
  },
  periodWrap: { width: '100%', marginBottom: spacing.md },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  baseHint: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    textAlign: 'center',
    writingDirection: 'rtl',
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
    fontSize: 12,
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
    fontSize: 12,
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
    paddingVertical: 12,
    gap: 12,
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
  rowMid: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  rowKindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rowKindPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rowKindText: {
    fontFamily: fonts.semi,
    fontSize: 11,
  },
  rowCat: {
    ...type.emphasis,
    fontSize: 14,
    color: colors.sheetInk,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  rowNote: {
    ...type.caption,
    color: colors.sheetMuted,
    marginTop: 2,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  rowDate: {
    ...type.caption,
    color: colors.sheetMuted,
    marginTop: 2,
    fontFamily: fonts.regular,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  rowAmountCol: {
    minWidth: 96,
    maxWidth: 120,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rowAmount: {
    ...type.money,
    fontSize: 14,
    textAlign: 'left',
    writingDirection: 'ltr',
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
