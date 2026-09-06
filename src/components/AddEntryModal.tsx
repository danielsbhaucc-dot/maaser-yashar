import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TZEDAKA_CATEGORIES,
  type LedgerKind,
} from '../types/ledger';
import { colors, fonts, radii, spacing, type } from '../theme';
import { parseMoney, PrimaryButton, Chip } from './ui';
import { BottomSheet } from './BottomSheet';

type SaveData = {
  kind: LedgerKind;
  category: string;
  amount: number;
  note: string;
  recurring?: { dayOfMonth: number };
};

type Props = {
  visible: boolean;
  period: string;
  onClose: () => void;
  onSave: (data: SaveData) => void;
  onInvalid?: () => void;
  initialKind?: LedgerKind;
};

const KIND_META: Record<
  LedgerKind,
  { label: string; color: string; soft: string; on: string }
> = {
  income: {
    label: 'הכנסה',
    color: colors.success,
    soft: colors.successSoft,
    on: '#062028',
  },
  expense: {
    label: 'הוצאה',
    color: colors.danger,
    soft: colors.dangerSoft,
    on: '#2A1018',
  },
  tzedaka: {
    label: 'צדקה',
    color: colors.gold,
    soft: colors.goldSoft,
    on: '#2A1E08',
  },
};

const DAY_PRESETS = [1, 2, 5, 10, 15, 20, 25, 28];

export default function AddEntryModal({
  visible,
  onClose,
  onSave,
  onInvalid,
  initialKind = 'income',
}: Props) {
  const [kind, setKind] = useState<LedgerKind>(initialKind);
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recurringOn, setRecurringOn] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState(10);

  useEffect(() => {
    if (visible) {
      setKind(initialKind);
      setAmount('');
      setNote('');
      setRecurringOn(false);
      setDayOfMonth(10);
      const cats =
        initialKind === 'income'
          ? INCOME_CATEGORIES
          : initialKind === 'expense'
            ? EXPENSE_CATEGORIES
            : TZEDAKA_CATEGORIES;
      setCategory(cats[0]);
    }
  }, [visible, initialKind]);

  const categories = useMemo(() => {
    if (kind === 'income') return [...INCOME_CATEGORIES];
    if (kind === 'expense') return [...EXPENSE_CATEGORIES];
    return [...TZEDAKA_CATEGORIES];
  }, [kind]);

  const active = KIND_META[kind];

  const selectKind = (k: LedgerKind) => {
    setKind(k);
    const cats =
      k === 'income'
        ? INCOME_CATEGORIES
        : k === 'expense'
          ? EXPENSE_CATEGORIES
          : TZEDAKA_CATEGORIES;
    setCategory(cats[0]);
  };

  const submit = () => {
    const n = parseMoney(amount);
    if (n <= 0) {
      onInvalid?.();
      return;
    }
    onSave({
      kind,
      category,
      amount: n,
      note: note.trim(),
      recurring: recurringOn ? { dayOfMonth } : undefined,
    });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="תנועה חדשה">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.kindRow}>
          {(Object.keys(KIND_META) as LedgerKind[]).map((k) => {
            const meta = KIND_META[k];
            const on = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => selectKind(k)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={meta.label}
                style={[
                  styles.kindBtn,
                  {
                    borderColor: on ? meta.color : `${meta.color}55`,
                    backgroundColor: on ? meta.color : meta.soft,
                  },
                ]}
              >
                <View style={[styles.kindDot, { backgroundColor: meta.color }]} />
                <Text style={[styles.kindText, { color: on ? meta.on : '#fff' }]}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: active.color }]}>סכום</Text>
        <TextInput
          style={[styles.amount, { borderColor: `${active.color}88` }]}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={colors.inkSoft}
          textAlign="left"
          autoFocus
          accessibilityLabel="סכום התנועה"
        />

        <Text style={styles.label}>קטגוריה</Text>
        <View style={styles.cats} accessibilityRole="radiogroup">
          {categories.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>

        <Text style={styles.label}>הערה</Text>
        <TextInput
          style={styles.note}
          value={note}
          onChangeText={setNote}
          placeholder="אופציונלי"
          placeholderTextColor={colors.inkSoft}
          textAlign="left"
          accessibilityLabel="הערה לתנועה"
        />

        <Pressable
          onPress={() => setRecurringOn((v) => !v)}
          style={[styles.recurToggle, recurringOn && styles.recurToggleOn]}
          accessibilityRole="switch"
          accessibilityState={{ checked: recurringOn }}
          accessibilityLabel="הוראת קבע חודשית"
        >
          <View style={styles.recurToggleText}>
            <Text style={styles.recurTitle}>הוראת קבע חודשית</Text>
            <Text style={styles.recurHint}>
              הפקדה / תרומה אוטומטית ביום קבוע בכל חודש
            </Text>
          </View>
          <View style={[styles.switchTrack, recurringOn && styles.switchTrackOn]}>
            <View style={[styles.switchThumb, recurringOn && styles.switchThumbOn]} />
          </View>
        </Pressable>

        {recurringOn ? (
          <View style={styles.dayBlock}>
            <Text style={styles.label}>יום בחודש</Text>
            <View style={styles.days}>
              {DAY_PRESETS.map((d) => (
                <Chip
                  key={d}
                  label={String(d)}
                  selected={dayOfMonth === d}
                  onPress={() => setDayOfMonth(d)}
                />
              ))}
            </View>
            <Text style={styles.dayCaption}>
              כל {dayOfMonth} בחודש · עד ה־28 כדי שיעבוד גם בפברואר
            </Text>
          </View>
        ) : null}

        <PrimaryButton
          label={
            recurringOn
              ? kind === 'income'
                ? 'שמור הוראת קבע · הכנסה'
                : kind === 'expense'
                  ? 'שמור הוראת קבע · הוצאה'
                  : 'שמור הוראת קבע · צדקה'
              : kind === 'income'
                ? 'הוסף הכנסה'
                : kind === 'expense'
                  ? 'הוסף הוצאה'
                  : 'רשום צדקה'
          }
          onPress={submit}
        />
        <View style={{ height: 28 }} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  kindBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderWidth: 1.5,
  },
  kindDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kindText: {
    ...type.caption,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  label: {
    ...type.caption,
    fontFamily: fonts.bold,
    color: colors.gold,
    marginBottom: 8,
  },
  amount: {
    fontFamily: fonts.numBold,
    fontSize: 36,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  cats: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  note: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: spacing.md,
    writingDirection: 'rtl',
    textAlign: 'left',
  },
  recurToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: spacing.md,
  },
  recurToggleOn: {
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  recurToggleText: { flex: 1 },
  recurTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#fff',
    writingDirection: 'rtl',
    textAlign: 'left',
  },
  recurHint: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 4,
    writingDirection: 'rtl',
    textAlign: 'left',
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchTrackOn: { backgroundColor: colors.gold },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  dayBlock: { marginBottom: spacing.md },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCaption: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 4,
    writingDirection: 'rtl',
    textAlign: 'left',
  },
});
