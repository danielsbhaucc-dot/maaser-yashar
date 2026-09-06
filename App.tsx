import React from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  I18nManager,
  Pressable,
  Text,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
try {
  I18nManager.allowRTL(true);
  if (!I18nManager.isRTL) {
    I18nManager.forceRTL(true);
  }
} catch {
  // web / Expo Go
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
  const { addOpen, addKind, closeAdd, addEntry } = useApp();
  const toast = useToast();
  return (
    <AddEntryModal
      visible={addOpen}
      period={currentPeriod()}
      initialKind={addKind}
      onClose={closeAdd}
      onSave={(data) => {
        addEntry({
          period: currentPeriod(),
          kind: data.kind,
          category: data.category,
          amount: data.amount,
          note: data.note,
        });
        const kindLabel =
          data.kind === 'income' ? 'הכנסה' : data.kind === 'expense' ? 'הוצאה' : 'צדקה';
        toast.success('נשמרה תנועה ✦', `${kindLabel} · ${data.category}`);
      }}
      onInvalid={() => toast.warn('רגע', 'צריך סכום גדול מאפס')}
    />
  );
}

function Root() {
  const { ready, profile } = useApp();
  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
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
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaProvider>
          <View style={[styles.appRoot, DIR]}>
            <View style={styles.phoneFrame}>
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
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
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
