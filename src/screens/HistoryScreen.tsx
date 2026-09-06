import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { StatHero, formatMoney, PrimaryButton } from '../components/ui';
import { Glass, GlassPill } from '../components/Glass';
import { DeleteButton } from '../components/DeleteButton';
import { SmartInsights } from '../components/SmartInsights';
import { colors, fonts, radii, spacing, type } from '../theme';
import {
  clearHistory,
  deleteHistoryEntry,
  formatPeriod,
  loadHistory,
  type HistoryEntry,
} from '../utils/history';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { BOT_NAME, t } from '../utils/copy';
import { noamHistoryEmpty, noamHistoryHero } from '../utils/noamCompanion';
import { NoamNudge } from '../components/NoamNudge';
import { historySmartInsights } from '../utils/smartInsights';

export default function HistoryScreen() {
  const { openAdd, profile } = useApp();
  const toast = useToast();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setEntries);
    }, [])
  );

  const totalRemaining = entries.reduce((s, e) => s + e.result.remaining, 0);
  const name = profile.displayName || t(profile.gender, 'חבר', 'חברה');
  const empty = noamHistoryEmpty(name, profile.gender);
  const insights = useMemo(
    () => historySmartInsights({ name, gender: profile.gender, entries }),
    [name, profile.gender, entries]
  );

  const hero = (
    <View style={styles.hero}>
      <GlassPill gold>
        <Text style={styles.badgeText}>✦ ארכיון עם {BOT_NAME}</Text>
      </GlassPill>
      <Text style={styles.heroTitle}>היסטוריה</Text>
      <Text style={styles.heroSub}>{noamHistoryHero(name, profile.gender, entries.length)}</Text>
    </View>
  );

  return (
    <Screen sheet hero={hero} scroll>
      {entries.length > 0 ? (
        <>
          <NoamNudge
            text={t(
              profile.gender,
              `${name}, יש כאן ${entries.length} חודשים שסגרנו יחד. יתרות פתוחות: ${formatMoney(totalRemaining)}.`,
              `${name}, יש כאן ${entries.length} חודשים שסגרנו יחד. יתרות פתוחות: ${formatMoney(totalRemaining)}.`
            )}
          />
          <SmartInsights items={insights} />
          <StatHero
            label="סה״כ יתרות לתת"
            value={formatMoney(totalRemaining)}
            hint={`${entries.length} חודשים`}
          />
        </>
      ) : (
        <Glass dark style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{empty.title}</Text>
          <Text style={styles.emptySub}>{empty.body}</Text>
          <PrimaryButton label="הוסף תנועה ✦" onPress={() => openAdd('tzedaka')} />
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
                      setEntries(await deleteHistoryEntry(e.id));
                      toast.success('החודש נמחק');
                    },
                  })
                }
              />
            </View>
            <View style={styles.cardHeadText}>
              <Text style={styles.cardTitle}>{e.label || formatPeriod(e.period)}</Text>
              <Text style={styles.cardMeta}>
                {new Date(e.savedAt).toLocaleDateString('he-IL')} · {e.result.ratePercent}%
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
                setEntries([]);
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
    fontSize: 12,
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
