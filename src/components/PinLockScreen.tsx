import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { usePinLock, type PinAttempt } from '../context/PinLockContext';
import { wipeAllData } from '../utils/wipeData';
import { t } from '../utils/copy';
import { colors, fonts, radii, spacing, type } from '../theme';
import { DIR, rtlDomProps } from '../rtl';
import { PrimaryButton } from './ui';
import { PinPad } from './PinPad';
import { Glass } from './Glass';

function messageFor(result: PinAttempt, gender: 'male' | 'female' | 'unspecified'): string {
  if (result === 'format') return 'הקוד צריך 4 עד 6 ספרות';
  if (result === 'wrong') return 'הקוד לא נכון';
  if (result === 'unavailable') return 'אי אפשר להפעיל נעילה במכשיר הזה';
  return t(gender, 'נסו שוב', 'נסי שוב', 'נסו שוב');
}

export default function PinLockScreen() {
  const { profile } = useApp();
  const pinLock = usePinLock();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [forgot, setForgot] = React.useState(false);
  const [shakeToken, setShakeToken] = React.useState(0);

  const onChange = (text: string) => {
    setPin(text);
    if (error) setError('');
  };

  const submit = async (code?: string) => {
    const next = code ?? pin;
    if (busy || next.length < 4) return;
    setBusy(true);
    const result = await pinLock.unlock(next);
    setBusy(false);
    if (result === 'ok') return;
    setPin('');
    setError(messageFor(result, profile.gender));
    setShakeToken((n) => n + 1);
  };

  const useNativeBlur = Platform.OS !== 'web';

  return (
    <View style={[styles.root, DIR]} {...rtlDomProps} accessibilityViewIsModal>
      <LinearGradient
        colors={[...colors.gradient]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* אורבים רכים ברקע — תחושת מסך נעילה */}
      <View pointerEvents="none" style={[styles.orb, styles.orbA]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbB]} />

      <View
        style={[
          styles.body,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
          },
        ]}
      >
        <Text style={styles.mark} accessibilityElementsHidden importantForAccessibility="no">
          ✦
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          הפנקס נעול
        </Text>
        <Text style={styles.sub}>
          {forgot
            ? t(profile.gender, 'שכחת את הקוד?', 'שכחת את הקוד?')
            : t(
                profile.gender,
                'הכנס קוד של 4 עד 6 ספרות. זו הגנה מעיניים סקרניות — לא הצפנה של הפנקס.',
                'הכניסי קוד של 4 עד 6 ספרות. זו הגנה מעיניים סקרניות — לא הצפנה של הפנקס.'
              )}
        </Text>

        {forgot ? (
          <Glass strong style={styles.card}>
            <Text style={styles.forgotTitle} accessibilityRole="header">
              {t(profile.gender, 'שכחת את הקוד?', 'שכחת את הקוד?')}
            </Text>
            <Text style={styles.forgotBody}>
              אין איפוס קוד. הקוד עצמו לא נשמר בשום מקום, רק טביעת אצבע שלו.
            </Text>
            <Text style={styles.forgotBody}>
              שתי אפשרויות: (1) לשחזר מגיבוי JSON ששמרתם בעבר — אחרי מחיקה או ממכשיר אחר דרך ההגדרות;
              (2) למחוק כאן את כל מה שנשמר במכשיר ולהתחיל מחדש.
            </Text>
            <Text style={styles.forgotBody}>
              אם ייצאתם CSV או גיבוי JSON, הם נשארים אצלכם מחוץ לאפליקציה.
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
          </Glass>
        ) : (
          <View style={styles.lockShell}>
            {useNativeBlur ? (
              <BlurView
                intensity={Platform.OS === 'ios' ? 48 : 28}
                tint="systemChromeMaterialDark"
                style={[StyleSheet.absoluteFill, styles.lockBlur]}
              />
            ) : (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.lockBlur,
                  styles.lockWebGlass,
                ]}
              />
            )}
            <View style={styles.lockInner}>
              <Text style={styles.fieldLabel}>קוד נעילה</Text>
              <PinPad
                value={pin}
                onChange={onChange}
                onSubmit={(code) => void submit(code)}
                disabled={busy}
                error={!!error}
                errorKey={shakeToken}
                accessibilityLabel="קוד נעילה"
              />
              {error ? (
                <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : (
                <Text style={styles.hint}>{busy ? 'בודק…' : '4 עד 6 ספרות · ✓ לאישור'}</Text>
              )}
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
  orb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.35,
  },
  orbA: {
    top: '8%',
    start: -80,
    backgroundColor: colors.orbA,
  },
  orbB: {
    bottom: '12%',
    end: -100,
    backgroundColor: colors.orbC,
    opacity: 0.22,
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
    color: colors.ink,
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
  lockShell: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 24px 64px rgba(0,0,0,0.45)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.35,
        shadowRadius: 28,
        elevation: 12,
      },
    }),
  },
  lockBlur: {
    borderRadius: radii.xxl,
  },
  lockWebGlass: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
        } as ViewStyle)
      : null),
  },
  lockInner: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  card: {
    padding: spacing.lg,
    borderRadius: radii.xxl,
  },
  fieldLabel: {
    ...type.eyebrow,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  hint: {
    ...type.caption,
    color: colors.sheetMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    writingDirection: 'rtl',
  },
  error: {
    ...type.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.sm,
    writingDirection: 'rtl',
  },
  textBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
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
    color: colors.ink,
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
