import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform } from 'react-native';
import { Glass } from './Glass';
import { PrimaryButton } from './ui';
import { usePinLock, type PinAttempt } from '../context/PinLockContext';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { t } from '../utils/copy';
import { colors, fonts, radii, spacing, type } from '../theme';

type Mode = 'idle' | 'create' | 'change' | 'remove';

function digitsOnly(text: string) {
  return text.replace(/\D/g, '').slice(0, 6);
}

function PinField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(txt) => onChange(digitsOnly(txt))}
        keyboardType="number-pad"
        inputMode="numeric"
        secureTextEntry
        maxLength={6}
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        textAlign="center"
        placeholder="4–6 ספרות"
        placeholderTextColor={colors.sheetMuted}
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function PinLockSettings() {
  const pinLock = usePinLock();
  const { profile } = useApp();
  const toast = useToast();
  const [mode, setMode] = React.useState<Mode>('idle');
  const [a, setA] = React.useState('');
  const [b, setB] = React.useState('');
  const [c, setC] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setMode('idle');
    setA('');
    setB('');
    setC('');
    setError('');
  };

  const edit = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    if (error) setError('');
  };

  const fail = (result: PinAttempt) => {
    if (result === 'format') setError('הקוד צריך 4 עד 6 ספרות');
    else if (result === 'mismatch') setError('שני הקודים לא זהים');
    else if (result === 'wrong') setError('הקוד הנוכחי לא נכון');
    else if (result === 'unavailable') setError('אי אפשר להפעיל נעילה במכשיר הזה');
    else setError('');
  };

  const onCreate = async () => {
    setBusy(true);
    const result = await pinLock.enable(a, b);
    setBusy(false);
    if (result !== 'ok') {
      fail(result);
      return;
    }
    reset();
    toast.success('נעילת הקוד פעילה ✦', 'רענון הדף יציג את מסך הנעילה');
  };

  const onChange = async () => {
    setBusy(true);
    const result = await pinLock.change(a, b, c);
    setBusy(false);
    if (result !== 'ok') {
      fail(result);
      return;
    }
    reset();
    toast.success('הקוד עודכן ✦');
  };

  const onRemove = async () => {
    setBusy(true);
    const result = await pinLock.disable(a);
    setBusy(false);
    if (result !== 'ok') {
      fail(result);
      return;
    }
    reset();
    toast.info('נעילת הקוד כבויה');
  };

  return (
    <Glass light strong style={styles.panel}>
      <View style={styles.labelRow}>
        <View style={styles.accent} />
        <Text style={styles.eyebrow}>נעילת קוד</Text>
      </View>
      <Text style={styles.intro}>
        כבויה כברירת מחדל. אם מפעילים, מסך נעילה מופיע בכל פתיחה ואחרי 5 דקות ברקע. נשמרת רק טביעת
        אצבע של הקוד עם מלח אקראי — אף פעם לא הקוד עצמו. זו הגנה מעיניים סקרניות בטלפון משפחתי, לא
        הצפנה.
      </Text>
      <Text style={styles.status}>
        {pinLock.enabled ? 'סטטוס: פעילה' : 'סטטוס: כבויה'}
      </Text>

      {mode === 'idle' ? (
        <View style={styles.actions}>
          {pinLock.enabled ? (
            <>
              <PrimaryButton label="שינוי קוד" onPress={() => { setError(''); setMode('change'); }} />
              <Pressable
                onPress={() => { setError(''); setMode('remove'); }}
                style={styles.quietBtn}
                accessibilityRole="button"
                accessibilityLabel="ביטול נעילת הקוד"
              >
                <Text style={styles.quietTxt}>ביטול הנעילה</Text>
              </Pressable>
            </>
          ) : (
            <PrimaryButton
              label={t(profile.gender, 'הפעל נעילת קוד ✦', 'הפעילי נעילת קוד ✦')}
              onPress={() => { setError(''); setMode('create'); }}
            />
          )}
        </View>
      ) : null}

      {mode === 'create' ? (
        <View style={styles.form}>
          <PinField label="קוד חדש" value={a} onChange={edit(setA)} />
          <PinField label="אימות הקוד" value={b} onChange={edit(setB)} />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <PrimaryButton
            label={busy ? 'שומר…' : 'שמור קוד'}
            disabled={busy || a.length < 4 || b.length < 4}
            onPress={() => void onCreate()}
          />
          <Pressable onPress={reset} style={styles.quietBtn} accessibilityRole="button">
            <Text style={styles.quietTxt}>ביטול</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'change' ? (
        <View style={styles.form}>
          <PinField label="קוד נוכחי" value={a} onChange={edit(setA)} />
          <PinField label="קוד חדש" value={b} onChange={edit(setB)} />
          <PinField label="אימות הקוד החדש" value={c} onChange={edit(setC)} />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <PrimaryButton
            label={busy ? 'מעדכן…' : 'עדכן קוד'}
            disabled={busy || a.length < 4 || b.length < 4 || c.length < 4}
            onPress={() => void onChange()}
          />
          <Pressable onPress={reset} style={styles.quietBtn} accessibilityRole="button">
            <Text style={styles.quietTxt}>ביטול</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'remove' ? (
        <View style={styles.form}>
          <Text style={styles.intro}>כדי לכבות את הנעילה צריך את הקוד הנוכחי.</Text>
          <PinField label="קוד נוכחי" value={a} onChange={edit(setA)} />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <PrimaryButton
            label={busy ? 'מכבה…' : 'כבה נעילה'}
            disabled={busy || a.length < 4}
            onPress={() => void onRemove()}
          />
          <Pressable onPress={reset} style={styles.quietBtn} accessibilityRole="button">
            <Text style={styles.quietTxt}>ביטול</Text>
          </Pressable>
        </View>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radii.xxl,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  accent: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.gold,
    textAlign: 'center',
  },
  intro: {
    ...type.bodySm,
    color: colors.sheetMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
    writingDirection: 'rtl',
  },
  status: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.sheetInk,
    textAlign: 'center',
    marginBottom: spacing.md,
    writingDirection: 'rtl',
  },
  actions: { gap: 4 },
  form: { gap: 4 },
  field: { marginBottom: spacing.sm },
  inputLabel: {
    ...type.caption,
    color: colors.sheetMuted,
    textAlign: 'center',
    marginBottom: 6,
    writingDirection: 'rtl',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontFamily: fonts.num,
    fontSize: 22,
    letterSpacing: 4,
    color: colors.sheetInk,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    width: '100%',
  },
  error: {
    ...type.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
    writingDirection: 'rtl',
  },
  quietBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  quietTxt: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.gold,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
