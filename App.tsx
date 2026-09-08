import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  I18nManager,
  Pressable,
  Text,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { reloadAppAsync } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Rubik_400Regular,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from '@expo-google-fonts/rubik';
import {
  Assistant_600SemiBold,
  Assistant_700Bold,
  Assistant_800ExtraBold,
} from '@expo-google-fonts/assistant';
import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_600SemiBold,
  Heebo_700Bold,
  Heebo_800ExtraBold,
} from '@expo-google-fonts/heebo';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppProvider, useApp } from './src/context/AppContext';
import { ToastProvider, useToast } from './src/context/ToastContext';
import {
  AccessibilityProvider,
  AccessibilityWidget,
  AccessibilityRoot,
} from './src/accessibility';
import OnboardingScreen from './src/screens/OnboardingScreen';import ErrorBoundary from './src/components/ErrorBoundary';
import AddEntryModal from './src/components/AddEntryModal';
import NoamChat from './src/components/NoamChat';
import { LoadingScreen } from './src/components/LoadingScreen';
import { SwipeTabs } from './src/navigation/SwipeTabs';
import { colors, fonts, shadow } from './src/theme';
import { DIR } from './src/rtl';
import { currentPeriod } from './src/utils/history';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.lang = 'he';
  document.documentElement.dir = 'rtl';
  document.documentElement.style.overflowX = 'hidden';
  document.documentElement.style.width = '100%';
  document.body.style.direction = 'rtl';
  document.body.style.backgroundColor = colors.bg;
  document.body.style.overflowX = 'hidden';
  document.body.style.width = '100%';
  document.body.style.maxWidth = '100%';
  document.body.style.margin = '0';
  document.body.style.position = 'relative';
  const root = document.getElementById('root');
  if (root) {
    root.style.overflowX = 'hidden';
    root.style.width = '100%';
    root.style.maxWidth = '100%';
    root.style.margin = '0 auto';
    root.setAttribute('dir', 'rtl');
    root.setAttribute('lang', 'he');
  }
  // מובייל־פירסט: viewport צפוף
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    document.head.appendChild(meta);
  }
  meta.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
  );
}
/**
 * RTL חייב להיות פעיל ב־I18nManager — אחרת textAlign:'left' נשאר שמאל פיזי
 * (ההיפוך מול Web, שבו forceRTL נכנס לתוקף מיד).
 * ב־native השינוי נשמר רק אחרי reload. פעם אחת בלבד (בלי לולאה).
 */
const RTL_RELOAD_KEY = '__maaser_rtl_reload_v1';
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  if (typeof I18nManager.swapLeftAndRightInRTL === 'function') {
    I18nManager.swapLeftAndRightInRTL(true);
  }
  if (Platform.OS !== 'web' && !I18nManager.isRTL) {
    void (async () => {
      try {
        const attempted = await AsyncStorage.getItem(RTL_RELOAD_KEY);
        if (attempted === '1') return;
        await AsyncStorage.setItem(RTL_RELOAD_KEY, '1');
        await reloadAppAsync('force-hebrew-rtl');
      } catch {
        // ignore
      }
    })();
  } else if (I18nManager.isRTL) {
    void AsyncStorage.removeItem(RTL_RELOAD_KEY);
  }
} catch {
  // Expo Go / סביבות בלי native RTL prefs
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.tabBar,
    text: colors.ink,
    border: colors.border,
    primary: colors.primary,
  },
};

function FloatingFab() {
  const { openAdd, profile } = useApp();
  const insets = useSafeAreaInsets();
  if (!profile.onboardingDone) return null;
  const bottom = (Platform.OS === 'ios' ? 22 : 12) + 64 + Math.max(insets.bottom - 8, 0) - 28;

  return (
    <Pressable
      onPress={() => openAdd('tzedaka')}
      style={[styles.fab, shadow.fab, { bottom }]}
      accessibilityLabel="תנועה חדשה"
    >
      <LinearGradient
        colors={[...colors.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabGrad}
      >
        <Text style={styles.fabIcon}>✦</Text>
      </LinearGradient>
    </Pressable>
  );
}

function GlobalAddModal() {
  const { addOpen, addKind, closeAdd, addEntry, addRecurring } = useApp();
  const toast = useToast();
  return (
    <AddEntryModal
      visible={addOpen}
      period={currentPeriod()}
      initialKind={addKind}
      onClose={closeAdd}
      onSave={async (data) => {
        const kindLabel =
          data.kind === 'income' ? 'הכנסה' : data.kind === 'expense' ? 'הוצאה' : 'צדקה';
        if (data.recurring) {
          await addRecurring({
            kind: data.kind,
            category: data.category,
            amount: data.amount,
            note: data.note,
            dayOfMonth: data.recurring.dayOfMonth,
          });
          toast.success(
            'הוראת קבע נשמרה ✦',
            `${kindLabel} · כל ${data.recurring.dayOfMonth} בחודש`
          );
          return;
        }
        await addEntry({
          period: currentPeriod(),
          kind: data.kind,
          category: data.category,
          amount: data.amount,
          note: data.note,
        });
        toast.success('נשמרה תנועה ✦', `${kindLabel} · ${data.category}`);
      }}
      onInvalid={() => toast.warn('רגע', 'צריך סכום גדול מאפס')}
    />
  );
}

function Root() {
  const { ready, profile } = useApp();
  if (!ready) {
    return <LoadingScreen variant="app" message="מכין את המעשר שלך…" />;
  }
  if (!profile.onboardingDone) {
    return (
      <AccessibilityRoot>
        <OnboardingScreen />
        <AccessibilityWidget />
      </AccessibilityRoot>
    );
  }
  return (
    <AccessibilityRoot>
      <View style={styles.mainShell}>
        <SwipeTabs />
        <FloatingFab />
        <NoamChat />
        <GlobalAddModal />
        <AccessibilityWidget />
      </View>
    </AccessibilityRoot>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Rubik_400Regular,
    Rubik_600SemiBold,
    Rubik_700Bold,
    Assistant_600SemiBold,
    Assistant_700Bold,
    Assistant_800ExtraBold,
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
    Heebo_800ExtraBold,
  });

  if (fontError) {
    console.warn('Font load error', fontError);
  }

  if (!fontsLoaded && !fontError) {
    return <LoadingScreen variant="boot" message="מעשר ישר נטען…" />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaProvider>
          <View style={[styles.appRoot, DIR]} {...({ dir: 'rtl' } as object)}>
            <View style={styles.phoneFrame} {...({ dir: 'rtl' } as object)}>
              <AppProvider>
                <ToastProvider>
                  <AccessibilityProvider>
                    <NavigationContainer theme={navTheme}>
                      <StatusBar style="light" />
                      <Root />
                    </NavigationContainer>
                  </AccessibilityProvider>
                </ToastProvider>
              </AppProvider>
            </View>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  appRoot: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'center',
  },
  /** מובייל־פירסט: על דסקטופ נשארים ברוחב טלפון */
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  mainShell: { flex: 1, width: '100%' },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    zIndex: 50,
  },
  fabGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontFamily: fonts.displayExtra,
    fontSize: 22,
    color: '#fff',
    lineHeight: 26,
  },
});
