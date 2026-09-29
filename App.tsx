import React, { Suspense, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  I18nManager,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { reloadAppAsync } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppFonts } from './src/fonts';
import { AppProvider, useApp } from './src/context/AppContext';
import { PinLockProvider, usePinLock } from './src/context/PinLockContext';
import { ToastProvider, useToast } from './src/context/ToastContext';
import { NoamChatProvider, useNoamChat } from './src/navigation/NoamChatContext';
import {
  AccessibilityProvider,
  AccessibilityWidget,
  AccessibilityRoot,
} from './src/accessibility';
import OnboardingScreen from './src/screens/OnboardingScreen';
import PinLockScreen from './src/components/PinLockScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import AddEntryModal from './src/components/AddEntryModal';
import { LoadingScreen } from './src/components/LoadingScreen';
import { SwipeTabs } from './src/navigation/SwipeTabs';
import { documentTitleFromLocation } from './src/navigation/tabRoutes';
import PwaInstallBanner from './src/components/PwaInstallBanner';
import { colors } from './src/theme';
import { DIR, rtlDomProps } from './src/rtl';
import { isNativeRtlActive } from './src/rtlBootstrap';
import { currentPeriod } from './src/utils/history';
import { registerWebPwa } from './src/pwa/registerWebPwa';
import { APP_URL } from './src/utils/monthlyReminderCore';

/** Deep-link paths for tabs (SwipeTabs syncs history; config documents the routes) */
const linking = {
  prefixes: [APP_URL, 'https://maaser-yashar.netlify.app', 'http://localhost:8081'],
  config: {
    screens: {
      Home: '',
      History: 'history',
      Tax: 'tax',
      Guide: 'guide',
      Settings: 'settings',
    },
  },
};

const NoamChat = React.lazy(() => import('./src/components/NoamChat'));

/** טוען את הצ'אט רק אחרי פתיחה ראשונה */
function LazyNoamChat() {
  const { open } = useNoamChat();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (open) setArmed(true);
  }, [open]);
  if (!armed) return null;
  return (
    <Suspense fallback={null}>
      <LazyNoamChat />
    </Suspense>
  );
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  registerWebPwa();
  // html: נגישות. ה־RTL האמיתי של RN-web מגיע מ־dir על View (ראה rtlDomProps).
  document.documentElement.lang = 'he';
  document.documentElement.dir = 'rtl';
  document.title = 'מעשר ישר';
  document.documentElement.style.overflowX = 'hidden';
  document.documentElement.style.width = '100%';
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
    root.setAttribute('lang', 'he');
    root.setAttribute('dir', 'rtl');
  }
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    document.head.appendChild(meta);
  }
  meta.setAttribute(
    'content',
    'width=device-width, initial-scale=1, viewport-fit=cover'
  );
}

/**
 * Native: forceRTL כבר ב־rtlBootstrap (לפני הרינדור).
 * אם עדיין לא isRTL — reload חד־פעמי (Android/iOS דורשים restart אחרי forceRTL).
 */
const RTL_RELOAD_KEY = '__maaser_rtl_reload_v3';
if (Platform.OS !== 'web' && !isNativeRtlActive()) {
  void (async () => {
    try {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
      if (typeof I18nManager.swapLeftAndRightInRTL === 'function') {
        I18nManager.swapLeftAndRightInRTL(true);
      }
      const attempted = await AsyncStorage.getItem(RTL_RELOAD_KEY);
      if (attempted === '1') return;
      await AsyncStorage.setItem(RTL_RELOAD_KEY, '1');
      await reloadAppAsync('force-hebrew-rtl');
    } catch {
      // ignore
    }
  })();
} else if (Platform.OS !== 'web') {
  void AsyncStorage.removeItem(RTL_RELOAD_KEY);
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

function StorageAlertBridge() {
  const { ready, corrupt, acknowledgeCorrupt } = useApp();
  const toast = useToast();
  const shown = React.useRef(false);

  React.useEffect(() => {
    if (!ready || shown.current) return;
    const keys = (Object.keys(corrupt) as (keyof typeof corrupt)[]).filter((k) => corrupt[k]);
    if (!keys.length) return;
    shown.current = true;
    const labels: Record<string, string> = {
      ledger: 'פנקס התנועות',
      profile: 'הפרופיל',
      recurring: 'הוראות קבע',
      history: 'היסטוריית החודשים',
    };
    const list = keys.map((k) => labels[k] ?? k).join(', ');
    toast.confirm({
      title: 'נתונים פגומים זוהו',
      message: `${list} נשמרו בצד כגיבוי חירום. מומלץ לשחזר מגיבוי בהגדרות. שמירה אוטומטית חסומה עד אישור.`,
      confirmLabel: 'התחל מחדש',
      cancelLabel: 'הבנתי',
      destructive: true,
      onConfirm: () => void acknowledgeCorrupt(),
    });
  }, [ready, corrupt, toast, acknowledgeCorrupt]);

  return null;
}

function entryKindLabel(kind: 'income' | 'expense' | 'tzedaka'): string {
  if (kind === 'income') return 'הכנסה';
  if (kind === 'expense') return 'ניכוי מהבסיס';
  return 'צדקה';
}

function GlobalAddModal() {
  const {
    addOpen,
    addKind,
    addPeriod,
    editingEntry,
    closeAdd,
    addEntry,
    updateEntry,
    removeEntry,
    addRecurring,
    corrupt,
    acknowledgeCorrupt,
    ledger,
  } = useApp();
  const toast = useToast();
  const sheetPeriod = addPeriod ?? currentPeriod();

  const orgSuggestions = React.useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const e of ledger) {
      if (e.kind !== 'tzedaka' || !e.org?.trim()) continue;
      const key = e.org.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(e.org.trim());
    }
    return names;
  }, [ledger]);

  const ensureWritable = async (): Promise<boolean> => {
    if (!corrupt.ledger && !corrupt.recurring) return true;
    return new Promise((resolve) => {
      toast.confirm({
        title: 'שמירה על נתונים פגומים',
        message:
          'נמצא גיבוי חירום של נתונים פגומים. שמירה תדרוס את הקובץ הפגום (העותק נשמר בצד). להמשיך?',
        confirmLabel: 'כן, שמור',
        cancelLabel: 'ביטול',
        destructive: true,
        onConfirm: async () => {
          if (corrupt.ledger) await acknowledgeCorrupt('ledger');
          if (corrupt.recurring) await acknowledgeCorrupt('recurring');
          resolve(true);
        },
        onCancel: () => resolve(false),
      });
    });
  };

  const saveRecurringRule = async (
    data: {
      kind: 'income' | 'expense' | 'tzedaka';
      category: string;
      amount: number;
      note: string;
      dayOfMonth: number;
    },
    skipThisMonth: boolean
  ) => {
    if (!(await ensureWritable())) return;
    const kindLabel = entryKindLabel(data.kind);
    await addRecurring({
      kind: data.kind,
      category: data.category,
      amount: data.amount,
      note: data.note,
      dayOfMonth: data.dayOfMonth,
      ...(skipThisMonth ? { lastAppliedPeriod: currentPeriod() } : {}),
    });
    toast.success(
      'הוראת קבע נשמרה ✦',
      skipThisMonth
        ? `${kindLabel} · כל ${data.dayOfMonth} בחודש · מהחודש הבא`
        : `${kindLabel} · כל ${data.dayOfMonth} בחודש`
    );
  };

  return (
    <AddEntryModal
      visible={addOpen}
      period={sheetPeriod}
      initialKind={addKind}
      editEntry={editingEntry}
      orgSuggestions={orgSuggestions}
      onClose={closeAdd}
      onDelete={
        editingEntry
          ? () => {
              const id = editingEntry.id;
              toast.confirm({
                title: 'למחוק את התנועה?',
                message: 'לא ניתן לשחזר אחר כך',
                destructive: true,
                confirmLabel: 'מחק',
                onConfirm: async () => {
                  if (!(await ensureWritable())) return;
                  closeAdd();
                  await removeEntry(id);
                  toast.success('התנועה נמחקה');
                },
              });
            }
          : undefined
      }
      onSave={async (data) => {
        const kindLabel = entryKindLabel(data.kind);
        const editing = editingEntry;
        const receiptFields =
          data.kind === 'tzedaka'
            ? {
                org: data.org,
                has46: data.has46,
                receiptNo: data.receiptNo,
              }
            : { org: undefined, has46: undefined, receiptNo: undefined };
        if (editing) {
          if (!(await ensureWritable())) return;
          await updateEntry(editing.id, {
            kind: data.kind,
            category: data.category,
            amount: data.amount,
            note: data.note,
            period: data.period,
            date: data.date,
            ...receiptFields,
          });
          toast.success('התנועה עודכנה ✦', `${kindLabel} · ${data.category}`);
          return;
        }
        if (data.recurring) {
          const day = data.recurring.dayOfMonth;
          const dayAlreadyPassed = new Date().getDate() > day;
          if (dayAlreadyPassed) {
            toast.confirm({
              title: 'לרשום גם לחודש הזה?',
              message: `היום כבר עבר ה־${day} בחודש. לרשום את ההוראה גם לחודש הנוכחי?`,
              confirmLabel: 'כן, לרשום',
              cancelLabel: 'לא',
              onConfirm: () =>
                void saveRecurringRule(
                  {
                    kind: data.kind,
                    category: data.category,
                    amount: data.amount,
                    note: data.note,
                    dayOfMonth: day,
                  },
                  false
                ),
              onCancel: () =>
                void saveRecurringRule(
                  {
                    kind: data.kind,
                    category: data.category,
                    amount: data.amount,
                    note: data.note,
                    dayOfMonth: day,
                  },
                  true
                ),
            });
            return;
          }
          await saveRecurringRule(
            {
              kind: data.kind,
              category: data.category,
              amount: data.amount,
              note: data.note,
              dayOfMonth: day,
            },
            false
          );
          return;
        }
        if (!(await ensureWritable())) return;
        await addEntry({
          period: data.period,
          date: data.date,
          kind: data.kind,
          category: data.category,
          amount: data.amount,
          note: data.note,
          ...receiptFields,
        });
        toast.success('נשמרה תנועה ✦', `${kindLabel} · ${data.category}`);
      }}
      onInvalid={(message) => toast.warn('רגע', message)}
    />
  );
}

function Root() {
  const { ready, profile } = useApp();
  const pin = usePinLock();
  if (!ready || !pin.ready) {
    return <LoadingScreen variant="app" message="מכין את המעשר שלך…" />;
  }
  if (pin.locked) {
    return (
      <AccessibilityRoot>
        <View style={[styles.mainShell, DIR]} {...rtlDomProps}>
          <PinLockScreen />
          <AccessibilityWidget />
          <StorageAlertBridge />
        </View>
      </AccessibilityRoot>
    );
  }
  if (!profile.onboardingDone) {
    return (
      <AccessibilityRoot>
        <View style={[styles.mainShell, DIR]} {...rtlDomProps}>
          <OnboardingScreen />
          <AccessibilityWidget />
          <StorageAlertBridge />
        </View>
      </AccessibilityRoot>
    );
  }
  return (
    <AccessibilityRoot>
      <View style={[styles.mainShell, DIR]} {...rtlDomProps}>
        <SwipeTabs />
        <NoamChat />
        <GlobalAddModal />
        <PwaInstallBanner />
        <AccessibilityWidget />
        <StorageAlertBridge />
      </View>
    </AccessibilityRoot>
  );
}

export default function App() {
  // Web: CSS preload + font-display:swap — לא חוסמים רינדור.
  // Native: useFonts רק ל-Heebo 400/600/700 + Rubik 700.
  const [fontsLoaded, fontError] = useAppFonts();

  if (fontError) {
    console.warn('Font load error', fontError);
  }

  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) {
    return <LoadingScreen variant="boot" message="מעשר ישר נטען…" />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={[styles.flex, DIR]} {...rtlDomProps}>
        <SafeAreaProvider>
          <View style={[styles.appRoot, DIR]} {...rtlDomProps}>
            <View style={[styles.phoneFrame, DIR]} {...rtlDomProps}>
              <AppProvider>
                <ToastProvider>
                  <NoamChatProvider>
                    <PinLockProvider>
                      <AccessibilityProvider>
                        <NavigationContainer
                          theme={navTheme}
                          linking={linking}
                          documentTitle={{
                            enabled: true,
                            formatter: () => documentTitleFromLocation(),
                          }}
                        >
                          <StatusBar style="light" />
                          <Root />
                        </NavigationContainer>
                      </AccessibilityProvider>
                    </PinLockProvider>
                  </NoamChatProvider>
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
  /** מובייל־פירסט: על דסקטופ נשארים ברוחב טלפון ממורכז */
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  mainShell: { flex: 1, width: '100%' },
});
