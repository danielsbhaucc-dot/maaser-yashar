import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { DIR, rtlDomProps } from '../rtl';
import {
  getDeferredInstall,
  isIosSafari,
  isStandaloneDisplay,
  subscribeInstallPrompt,
  type BeforeInstallPromptLike,
} from '../pwa/registerWebPwa';

const DISMISS_KEY = 'maaser_pwa_banner_dismissed_v1';

function readDismissed(): boolean {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // ignore
  }
}

/**
 * באנר «התקן אפליקציה» — Android (beforeinstallprompt) + iPhone (הוראות Share).
 */
export default function PwaInstallBanner() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptLike | null>(null);
  const ios = Platform.OS === 'web' && isIosSafari();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isStandaloneDisplay() || readDismissed()) return;

    setDeferred(getDeferredInstall());
    const unsub = subscribeInstallPrompt((e) => {
      setDeferred(e);
      if (e) setVisible(true);
    });

    // iOS: אין beforeinstallprompt — מציגים אחרי קצת עיכוב
    const t = setTimeout(() => {
      if (isStandaloneDisplay() || readDismissed()) return;
      if (isIosSafari() || getDeferredInstall()) setVisible(true);
    }, 1800);

    return () => {
      unsub();
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (deferred && !readDismissed() && !isStandaloneDisplay()) {
      setVisible(true);
    }
  }, [deferred]);

  const dismiss = useCallback(() => {
    writeDismissed();
    setVisible(false);
    setIosHelp(false);
  }, []);

  const onInstall = useCallback(async () => {
    if (ios) {
      setIosHelp(true);
      return;
    }
    const promptEvent = deferred ?? getDeferredInstall();
    if (!promptEvent) {
      setIosHelp(true);
      return;
    }
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      // ignore
    }
    dismiss();
  }, [deferred, dismiss, ios]);

  if (Platform.OS !== 'web' || !visible) return null;

  return (
    <>
      <View
        style={[styles.banner, DIR, { bottom: 88 + insets.bottom }]}
        {...rtlDomProps}
      >
        <View style={styles.copy}>
          <Text style={styles.title}>התקן אפליקציה</Text>
          <Text style={styles.sub}>
            {ios
              ? 'הוסף למסך הבית לגישה מהירה ולשמירת נתונים יציבה יותר'
              : 'מסך מלא, אייקון במסך הבית, ועבודה גם בלי רשת'}
          </Text>
        </View>
        <Pressable
          onPress={() => void onInstall()}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="התקן אפליקציה"
        >
          <Text style={styles.ctaText}>{ios ? 'איך?' : 'התקן'}</Text>
        </Pressable>
        <Pressable
          onPress={dismiss}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="סגור"
          hitSlop={4}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <Modal visible={iosHelp} transparent animationType="fade" onRequestClose={dismiss}>
        <Pressable style={styles.modalBg} onPress={dismiss}>
          <View style={[styles.sheet, DIR]} {...rtlDomProps}>
            <Text style={styles.sheetTitle}>הוספה למסך הבית באייפון</Text>
            <Text style={styles.sheetStep}>1. לחצו על כפתור «שתף» ⎋ בתחתית Safari</Text>
            <Text style={styles.sheetStep}>2. גללו ובחרו «הוסף למסך הבית»</Text>
            <Text style={styles.sheetStep}>3. אשרו — יופיע האייקון «מעשר ישר»</Text>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [styles.sheetBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="הבנתי"
            >
              <Text style={styles.sheetBtnText}>הבנתי</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(18, 24, 44, 0.96)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: colors.ink,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 16,
    color: colors.inkSoft,
    marginTop: 2,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  cta: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    minHeight: 44,
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.primaryOn,
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 22,
    color: colors.inkSoft,
    lineHeight: 24,
  },
  pressed: { opacity: 0.8 },
  modalBg: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.sheet,
    borderRadius: radii.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.sheetBorder,
    gap: 10,
  },
  sheetTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    color: colors.sheetInk,
    writingDirection: 'rtl',
    textAlign: 'right',
    marginBottom: 4,
  },
  sheetStep: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.sheetMuted,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  sheetBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  sheetBtnText: {
    fontFamily: fonts.semi,
    fontSize: 15,
    color: colors.primaryOn,
  },
});
