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
import {
  currentPeriod,
  defaultDateFor,
  formatPeriod,
  lastNPeriods,
} from '../utils/history';

type SaveData = {
  kind: LedgerKind;
  category: string;
  amount: number;
  note: string;
  period: string;
  date: string;
  recurring?: { dayOfMonth: number };
};

type Props = {
  visible: boolean;
  period: string;
  onClose: () => void;
  onSave: (data: SaveData) => void;
  onInvalid?: (message: string) => void;
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
const AMOUNT_ERROR_ID = 'add-entry-amount-error';

export default function AddEntryModal({
  visible,
  period: initialPeriod,
  onClose,
  onSave,
  onInvalid,
  initialKind = 'income',
}: Props) {
  const [kind, setKind] = useState<LedgerKind>(initialKind);
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [recurringOn, setRecurringOn] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState(10);
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod || currentPeriod());
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() =>
    Number((initialPeriod || currentPeriod()).slice(0, 4))
  );

  const selectablePeriods = useMemo(() => lastNPeriods(12), []);
  const years = useMemo(() => {
    const set = new Set(selectablePeriods.map((p) => Number(p.slice(0, 4))));
    return [...set].sort((a, b) => b - a);
  }, [selectablePeriods]);

  const monthsForYear = useMemo(
    () => selectablePeriods.filter((p) => Number(p.slice(0, 4)) === pickerYear),
    [selectablePeriods, pickerYear]
  );

  useEffect(() => {
    if (visible) {
      setKind(initialKind);
      setAmount('');
      setAmountError(null);
      setNote('');
      setRecurringOn(false);
      setDayOfMonth(10);
      setPeriodPickerOpen(false);
      const p = initialPeriod || currentPeriod();
      setSelectedPeriod(p);
      setPickerYear(Number(p.slice(0, 4)));
      const cats =
        initialKind === 'income'
          ? INCOME_CATEGORIES
          : initialKind === 'expense'
            ? EXPENSE_CATEGORIES
            : TZEDAKA_CATEGORIES;
      setCategory(cats[0]);
    }
  }, [visible, initialKind, initialPeriod]);

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
    const parsed = parseMoney(amount);
    if (!parsed.ok) {
      setAmountError(parsed.error);
      onInvalid?.(parsed.error);
      return;
    }
    setAmountError(null);
    const period = selectedPeriod || currentPeriod();
    onSave({
      kind,
      category,
      amount: parsed.value,
      note: note.trim(),
      period,
      date: defaultDateFor(period),
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
        <Pressable
          onPress={() => setPeriodPickerOpen((v) => !v)}
          style={styles.periodBanner}
          accessibilityRole="button"
          accessibilityLabel={`נרשם ל ${formatPeriod(selectedPeriod)}. לחצו לבחירת חודש`}
          accessibilityState={{ expanded: periodPickerOpen }}
        >
          <Text style={styles.periodBannerText}>
            נרשם ל: {formatPeriod(selectedPeriod)}
          </Text>
          <Text style={styles.periodBannerHint}>
            {periodPickerOpen ? 'סגור בחירה' : 'החלפת חודש / שנה'}
          </Text>
        </Pressable>

        {periodPickerOpen ? (
          <View style={styles.periodPicker}>
            <View style={styles.yearRow}>
              {years.map((y) => (
                <Chip
                  key={y}
                  label={String(y)}
                  selected={pickerYear === y}
                  onPress={() => setPickerYear(y)}
                />
              ))}
            </View>
            <View style={styles.monthRow}>
              {monthsForYear.map((p) => {
                const monthIdx = Number(p.slice(5, 7)) - 1;
                const label =
                  ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יונ׳', 'יול׳', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'][
                    monthIdx
                  ] ?? p.slice(5);
                return (
                  <Chip
                    key={p}
                    label={label}
                    selected={selectedPeriod === p}
                    onPress={() => {
                      setSelectedPeriod(p);
                      setPeriodPickerOpen(false);
                    }}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

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
          style={[
            styles.amount,
            { borderColor: amountError ? colors.danger : `${active.color}88` },
          ]}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={(t) => {
            setAmount(t);
            if (amountError) setAmountError(null);
          }}
          placeholder="0"
          placeholderTextColor={colors.inkSoft}
          textAlign="start"
          autoFocus
          accessibilityLabel="סכום התנועה"
          accessibilityDescribedBy={amountError ? AMOUNT_ERROR_ID : undefined}
          {...(amountError
            ? ({ 'aria-describedby': AMOUNT_ERROR_ID } as object)
            : null)}
        />
        {amountError ? (
          <Text
            nativeID={AMOUNT_ERROR_ID}
            style={styles.amountError}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {amountError}
          </Text>
        ) : null}

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
          textAlign="start"
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
        <View style={{ height: 40 }} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  periodBanner: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,216,138,0.35)',
    backgroundColor: 'rgba(255,216,138,0.10)',
  },
  periodBannerText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.gold,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  periodBannerHint: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 4,
    textAlign: 'center',
  },
  periodPicker: {
    marginBottom: spacing.md,
    padding: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  yearRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 4,
  },
  monthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
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
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  amountError: {
    ...type.caption,
    fontFamily: fonts.medium,
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'start',
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
    textAlign: 'start',
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
    textAlign: 'start',
  },
  recurHint: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 4,
    writingDirection: 'rtl',
    textAlign: 'start',
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
    textAlign: 'start',
  },
});
