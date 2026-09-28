import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { usePinLock, type PinAttempt } from '../context/PinLockContext';
import { wipeAllData } from '../utils/wipeData';
import { t } from '../utils/copy';
import { colors, fonts, radii, spacing, type } from '../theme';
import { DIR, rtlDomProps } from '../rtl';
import { PrimaryButton } from './ui';

function messageFor(result: PinAttempt, gender: 'male' | 'female'): string {
  if (result === 'format') return 'הקוד צריך 4 עד 6 ספרות';
  if (result === 'wrong') return 'הקוד לא נכון';
  if (result === 'unavailable') return 'אי אפשר להפעיל נעילה במכשיר הזה';
  return t(gender, 'נסו שוב', 'נסי שוב');
}

export default function PinLockScreen() {
  const { profile } = useApp();
  const pinLock = usePinLock();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [forgot, setForgot] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);

  const onChange = (text: string) => {
    setPin(text.replace(/\D/g, '').slice(0, 6));
    if (error) setError('');
  };

  const submit = async () => {
    if (busy || pin.length < 4) return;
    setBusy(true);
    const result = await pinLock.unlock(pin);
    setBusy(false);
    if (result === 'ok') return;
    setPin('');
    setError(messageFor(result, profile.gender));
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.root, DIR]} {...rtlDomProps} accessibilityViewIsModal>
      <LinearGradient
        colors={[...colors.gradient]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.body,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <Text style={styles.mark} accessibilityElementsHidden importantForAccessibility="no">
          ✦
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          הפנקס נעול
        </Text>
        <Text style={styles.sub}>
          {t(
            profile.gender,
            'הכנס קוד של 4 עד 6 ספרות. זו הגנה מעיניים סקרניות — לא הצפנה של הפנקס.',
            'הכניסי קוד של 4 עד 6 ספרות. זו הגנה מעיניים סקרניות — לא הצפנה של הפנקס.'
          )}
        </Text>

        {forgot ? (
          <View style={styles.card}>
            <Text style={styles.forgotTitle} accessibilityRole="header">
              {t(profile.gender, 'שכחת את הקוד?', 'שכחת את הקוד?')}
            </Text>
            <Text style={styles.forgotBody}>
              אין שחזור. הקוד עצמו לא נשמר בשום מקום, רק טביעת אצבע שלו, ולכן אי אפשר לאפס אותו.
            </Text>
            <Text style={styles.forgotBody}>
              כדי להיכנס בלי הקוד צריך למחוק את כל מה שנשמר במכשיר — הפנקס, הפרופיל, השיחות והנעילה — ולהתחיל מחדש.
            </Text>
            <Text style={styles.forgotBody}>
              אם ייצאת בעבר קובץ CSV, הוא נשאר אצלך מחוץ לאפליקציה. אין כאן שחזור אוטומטי ממנו.
            </Text>
            <PrimaryButton
              label={busy ? 'מוחק…' : 'מחק את כל הנתונים'}
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void wipeAllData();
              }}
            />
            <Pressable
              onPress={() => setForgot(false)}
              style={styles.textBtn}
              accessibilityRole="button"
              accessibilityLabel="חזרה להזנת הקוד"
            >
              <Text style={styles.textBtnLabel}>חזרה להזנת הקוד</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>קוד נעילה</Text>
            <TextInput
              ref={inputRef}
              value={pin}
              onChangeText={onChange}
              onSubmitEditing={() => void submit()}
              keyboardType="number-pad"
              inputMode="numeric"
              secureTextEntry
              maxLength={6}
              autoFocus
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              textAlign="center"
              placeholder="••••"
              placeholderTextColor={colors.sheetMuted}
              style={styles.input}
              accessibilityLabel="קוד נעילה, 4 עד 6 ספרות"
              accessibilityHint="הקלד את הקוד ולחץ על פתיחה"
              returnKeyType="done"
            />
            {error ? (
              <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : (
              <Text style={styles.hint}>4 עד 6 ספרות</Text>
            )}
            <PrimaryButton
              label={busy ? 'בודק…' : 'פתח'}
              disabled={busy || pin.length < 4}
              onPress={() => void submit()}
            />
            <Pressable
              onPress={() => {
                setForgot(true);
                setError('');
                setPin('');
              }}
              style={styles.textBtn}
              accessibilityRole="button"
              accessibilityLabel="שכחתי את הקוד"
            >
              <Text style={styles.textBtnLabel}>שכחתי את הקוד</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  mark: {
    fontFamily: fonts.displayExtra,
    fontSize: 28,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...type.h1,
    color: '#fff',
    textAlign: 'center',
  },
  sub: {
    ...type.bodySm,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    writingDirection: 'rtl',
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.xxl,
    padding: spacing.lg,
  },
  fieldLabel: {
    ...type.eyebrow,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontFamily: fonts.num,
    fontSize: 28,
    letterSpacing: 6,
    color: colors.sheetInk,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: spacing.sm,
  },
  hint: {
    ...type.caption,
    color: colors.sheetMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  error: {
    ...type.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
    writingDirection: 'rtl',
  },
  textBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  textBtnLabel: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: colors.gold,
    textAlign: 'center',
    textDecorationLine: 'underline',
    writingDirection: 'rtl',
  },
  forgotTitle: {
    ...type.h2,
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  forgotBody: {
    ...type.bodySm,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.sm,
    writingDirection: 'rtl',
  },
});
