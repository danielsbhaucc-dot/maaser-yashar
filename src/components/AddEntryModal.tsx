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

type Props = {
  visible: boolean;
  period: string;
  onClose: () => void;
  onSave: (data: {
    kind: LedgerKind;
    category: string;
    amount: number;
    note: string;
  }) => void;
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

  useEffect(() => {
    if (visible) {
      setKind(initialKind);
      setAmount('');
      setNote('');
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
    onSave({ kind, category, amount: n, note: note.trim() });
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
          textAlign="right"
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
          textAlign="right"
          accessibilityLabel="הערה לתנועה"
        />

        <PrimaryButton
          label={
            kind === 'income'
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
    textAlign: 'right',
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
    textAlign: 'right',
  },
});
