import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Glass } from './Glass';
import { PrimaryButton } from './ui';
import { PinPad } from './PinPad';
import { usePinLock, type PinAttempt } from '../context/PinLockContext';
import { verifyPinLock } from '../utils/pinLock';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { t } from '../utils/copy';
import { colors, fonts, radii, spacing, type } from '../theme';

type Mode = 'idle' | 'create' | 'change' | 'remove';

type Step =
  | 'new'
  | 'confirm'
  | 'current'
  | 'change-new'
  | 'change-confirm'
  | 'remove-current';

function failMessage(result: PinAttempt): string {
  if (result === 'format') return 'הקוד צריך 4 עד 6 ספרות';
  if (result === 'mismatch') return 'שני הקודים לא זהים';
  if (result === 'wrong') return 'הקוד הנוכחי לא נכון';
  if (result === 'unavailable') return 'אי אפשר להפעיל נעילה במכשיר הזה';
  return '';
}

function stepTitle(step: Step): string {
  switch (step) {
    case 'new':
      return 'בחרו קוד חדש';
    case 'confirm':
      return 'אמתו את הקוד';
    case 'current':
    case 'remove-current':
      return 'הקוד הנוכחי';
    case 'change-new':
      return 'קוד חדש';
    case 'change-confirm':
      return 'אימות הקוד החדש';
    default:
      return 'קוד נעילה';
  }
}

export function PinLockSettings() {
  const pinLock = usePinLock();
  const { profile } = useApp();
  const toast = useToast();
  const [mode, setMode] = React.useState<Mode>('idle');
  const [step, setStep] = React.useState<Step>('new');
  const [draft, setDraft] = React.useState('');
  const [a, setA] = React.useState('');
  const [b, setB] = React.useState('');
  const [error, setError] = React.useState('');
  const [errorKey, setErrorKey] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setMode('idle');
    setStep('new');
    setDraft('');
    setA('');
    setB('');
    setError('');
    setErrorKey(0);
  };

  const bumpError = (msg: string) => {
    setError(msg);
    setErrorKey((n) => n + 1);
    setDraft('');
  };

  const start = (next: Mode) => {
    setError('');
    setErrorKey(0);
    setDraft('');
    setA('');
    setB('');
    setMode(next);
    if (next === 'create') setStep('new');
    else if (next === 'change') setStep('current');
    else if (next === 'remove') setStep('remove-current');
  };

  const onCreateSubmit = async (pin: string) => {
    if (step === 'new') {
      if (pin.length < 4) {
        bumpError('הקוד צריך 4 עד 6 ספרות');
        return;
      }
      setA(pin);
      setDraft('');
      setError('');
      setStep('confirm');
      return;
    }
    setBusy(true);
    const result = await pinLock.enable(a, pin);
    setBusy(false);
    if (result !== 'ok') {
      bumpError(failMessage(result));
      if (result === 'mismatch') {
        setA('');
        setStep('new');
      }
      return;
    }
    reset();
    toast.success('נעילת הקוד פעילה ✦', 'רענון הדף יציג את מסך הנעילה');
  };

  const onChangeSubmit = async (pin: string) => {
    if (step === 'current') {
      setBusy(true);
      const ok = await verifyPinLock(pin);
      setBusy(false);
      if (!ok) {
        bumpError('הקוד הנוכחי לא נכון');
        return;
      }
      setA(pin);
      setDraft('');
      setError('');
      setStep('change-new');
      return;
    }
    if (step === 'change-new') {
      if (pin.length < 4) {
        bumpError('הקוד צריך 4 עד 6 ספרות');
        return;
      }
      setB(pin);
      setDraft('');
      setError('');
      setStep('change-confirm');
      return;
    }
    setBusy(true);
    const result = await pinLock.change(a, b, pin);
    setBusy(false);
    if (result !== 'ok') {
      bumpError(failMessage(result));
      if (result === 'wrong') {
        setA('');
        setB('');
        setStep('current');
      } else if (result === 'mismatch') {
        setB('');
        setStep('change-new');
      }
      return;
    }
    reset();
    toast.success('הקוד עודכן ✦');
  };

  const onRemoveSubmit = async (pin: string) => {
    setBusy(true);
    const result = await pinLock.disable(pin);
    setBusy(false);
    if (result !== 'ok') {
      bumpError(failMessage(result));
      return;
    }
    reset();
    toast.info('נעילת הקוד כבויה');
  };

  const handleSubmit = (pin: string) => {
    if (busy) return;
    if (mode === 'create') void onCreateSubmit(pin);
    else if (mode === 'change') void onChangeSubmit(pin);
    else if (mode === 'remove') void onRemoveSubmit(pin);
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
              <PrimaryButton label="שינוי קוד" onPress={() => start('change')} />
              <Pressable
                onPress={() => start('remove')}
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
              onPress={() => start('create')}
            />
          )}
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.stepTitle} accessibilityRole="header">
            {stepTitle(step)}
          </Text>
          {mode === 'remove' ? (
            <Text style={styles.stepHint}>כדי לכבות את הנעילה צריך את הקוד הנוכחי.</Text>
          ) : null}
          <PinPad
            value={draft}
            onChange={(v) => {
              setDraft(v);
              if (error) setError('');
            }}
            onSubmit={handleSubmit}
            disabled={busy}
            error={!!error}
            errorKey={errorKey}
            compact
            accessibilityLabel={stepTitle(step)}
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : (
            <Text style={styles.stepHint}>{busy ? 'שומר…' : '4 עד 6 ספרות · ✓ לאישור'}</Text>
          )}
          <Pressable
            onPress={reset}
            style={styles.quietBtn}
            accessibilityRole="button"
            accessibilityLabel="ביטול"
          >
            <Text style={styles.quietTxt}>ביטול</Text>
          </Pressable>
        </View>
      )}
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
  form: {
    gap: 4,
    alignItems: 'center',
  },
  stepTitle: {
    ...type.h3,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  stepHint: {
    ...type.caption,
    color: colors.sheetMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
    writingDirection: 'rtl',
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
    minHeight: 44,
    justifyContent: 'center',
  },
  quietTxt: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.gold,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
