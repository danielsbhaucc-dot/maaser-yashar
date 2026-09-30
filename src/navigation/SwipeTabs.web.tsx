import React, { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { colors, fonts } from '../theme';
import { DIR, ltrDomProps, rtlDomProps } from '../rtl';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { TabNavProvider, type TabKey } from './TabNavContext';
import {
  documentTitleForTab,
  pathForTab,
  tabFromPathname,
} from './tabRoutes';
import { useApp } from '../context/AppContext';

const TaxScreen = React.lazy(() => import('../screens/TaxScreen'));
const GuideScreen = React.lazy(() => import('../screens/GuideScreen'));
const SettingsScreen = React.lazy(() => import('../screens/SettingsScreen'));

function LazyScreenGate({
  armed,
  children,
}: {
  armed: boolean;
  children: React.ReactNode;
}) {
  if (!armed) return null;
  return (
    <Suspense
      fallback={
        <View style={styles.chunkFallback}>
          <ActivityIndicator color={colors.gold} />
        </View>
      }
    >
      {children}
    </Suspense>
  );
}

function TaxScreenGate({ armed }: { armed: boolean }) {
  return (
    <LazyScreenGate armed={armed}>
      <TaxScreen />
    </LazyScreenGate>
  );
}

function GuideScreenGate({ armed }: { armed: boolean }) {
  return (
    <LazyScreenGate armed={armed}>
      <GuideScreen />
    </LazyScreenGate>
  );
}

function SettingsScreenGate({ armed }: { armed: boolean }) {
  return (
    <LazyScreenGate armed={armed}>
      <SettingsScreen />
    </LazyScreenGate>
  );
}

const TABS = [
  {
    key: 'Home' as const,
    title: 'בית',
    shortTitle: 'בית',
    icon: 'home',
    iconOut: 'home-outline',
    Screen: HomeScreen as React.ComponentType,
  },
  {
    key: 'History' as const,
    title: 'היסטוריה',
    shortTitle: 'ארכיון',
    icon: 'time',
    iconOut: 'time-outline',
    Screen: HistoryScreen as React.ComponentType,
  },
  {
    key: 'Tax' as const,
    title: 'החזר מס',
    shortTitle: 'מס',
    icon: 'receipt',
    iconOut: 'receipt-outline',
    Screen: null,
  },
  {
    key: 'Guide' as const,
    title: 'הנחיות',
    shortTitle: 'מדריך',
    icon: 'book',
    iconOut: 'book-outline',
    Screen: null,
  },
  {
    key: 'Settings' as const,
    title: 'הגדרות',
    shortTitle: 'עוד',
    icon: 'settings',
    iconOut: 'settings-outline',
    Screen: null,
  },
] as const;

const TAB_KEYS: TabKey[] = TABS.map((t) => t.key);
/** מתחת לרוחב זה — תוויות מקוצרות (תמיד גלויות, גם ב־320) */
const SHORT_LABEL_MAX = 430;
const TAX_TAB_INDEX = TABS.findIndex((t) => t.key === 'Tax');
const GUIDE_TAB_INDEX = TABS.findIndex((t) => t.key === 'Guide');
const SETTINGS_TAB_INDEX = TABS.findIndex((t) => t.key === 'Settings');

function initialIndexFromLocation(): number {
  if (typeof window === 'undefined') return 0;
  const tab = tabFromPathname(window.location.pathname);
  if (!tab) return 0;
  const i = TAB_KEYS.indexOf(tab);
  return i >= 0 ? i : 0;
}

export function SwipeTabs() {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(initialIndexFromLocation);
  const [pageWidth, setPageWidth] = useState(0);
  const indexRef = useRef(initialIndexFromLocation());
  const skipPushRef = useRef(true);
  /** עד יישור גלילה ראשוני — לא לסנכרן index מ־onScroll (מונע איפוס ל־Home ב־deep link) */
  const scrollReadyRef = useRef(false);
  /** נשמר עד אחרי יישור הגלילה הראשון — onScroll מוקדם לא ידרוס deep link */
  const bootIndexRef = useRef<number | null>(initialIndexFromLocation());
  const initial = initialIndexFromLocation();
  const [taxVisited, setTaxVisited] = useState(() => initial === TAX_TAB_INDEX);
  const [guideVisited, setGuideVisited] = useState(() => initial === GUIDE_TAB_INDEX);
  const [settingsVisited, setSettingsVisited] = useState(
    () => initial === SETTINGS_TAB_INDEX
  );
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { openAdd } = useApp();
  const bottom = 12 + insets.bottom;
  const useShortLabels = windowWidth <= SHORT_LABEL_MAX;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (index === TAX_TAB_INDEX) setTaxVisited(true);
    if (index === GUIDE_TAB_INDEX) setGuideVisited(true);
    if (index === SETTINGS_TAB_INDEX) setSettingsVisited(true);
  }, [index]);

  const setIndexSafe = useCallback((i: number) => {
    const next = Math.max(0, Math.min(TABS.length - 1, i));
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
  }, []);

  const onRootLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = Math.round(e.nativeEvent.layout.width);
      if (w <= 0) return;
      if (Math.abs(w - pageWidth) < 1) return;
      scrollReadyRef.current = false;
      const boot = bootIndexRef.current;
      if (boot != null) {
        indexRef.current = boot;
        setIndex(boot);
      }
      const targetIndex = boot ?? indexRef.current;
      setPageWidth(w);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          x: targetIndex * w,
          y: 0,
          animated: false,
        });
        // setTimeout אמין יותר מ־rAF כפול תחת עומס workers ב־e2e
        setTimeout(() => {
          scrollRef.current?.scrollTo({
            x: targetIndex * w,
            y: 0,
            animated: false,
          });
          bootIndexRef.current = null;
          scrollReadyRef.current = true;
        }, 64);
      });
    },
    [pageWidth]
  );

  const syncIndexFromOffset = useCallback(
    (x: number) => {
      if (!scrollReadyRef.current) return;
      if (pageWidth <= 0) return;
      setIndexSafe(Math.round(x / pageWidth));
    },
    [pageWidth, setIndexSafe]
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncIndexFromOffset(e.nativeEvent.contentOffset.x);
    },
    [syncIndexFromOffset]
  );

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncIndexFromOffset(e.nativeEvent.contentOffset.x);
    },
    [syncIndexFromOffset]
  );

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= TABS.length) return;
      // בזמן אנימציית גלילה — לא לסנכרן מ־onScroll (מונע דחיפת `/` להיסטוריה)
      scrollReadyRef.current = false;
      indexRef.current = i;
      setIndex(i);
      if (pageWidth <= 0) {
        scrollReadyRef.current = true;
        return;
      }
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: i * pageWidth, y: 0, animated: true });
        setTimeout(() => {
          scrollReadyRef.current = true;
        }, 420);
      });
    },
    [pageWidth]
  );

  /** Deep link + back/forward: sync URL ↔ טאב */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tab = TAB_KEYS[index] ?? 'Home';
    const path = pathForTab(tab);
    const title = documentTitleForTab(tab);
    document.title = title;

    const current =
      window.location.pathname.replace(/\/+$/, '') || '/';
    const normalizedCurrent = current === '' ? '/' : current;
    if (normalizedCurrent === path) {
      skipPushRef.current = false;
      return;
    }
    if (skipPushRef.current) {
      skipPushRef.current = false;
      window.history.replaceState({ tab }, title, path);
      return;
    }
    window.history.pushState({ tab }, title, path);
  }, [index]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      const tab = tabFromPathname(window.location.pathname) ?? 'Home';
      const i = TAB_KEYS.indexOf(tab);
      if (i < 0 || i === indexRef.current) {
        document.title = documentTitleForTab(tab);
        return;
      }
      skipPushRef.current = true;
      goTo(i);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [goTo]);

  const renderTab = (tab: (typeof TABS)[number], i: number) => {
    const focused = i === index;
    const label = useShortLabels ? tab.shortTitle : tab.title;
    const testIdByKey: Record<string, string> = {
      Home: 'tab-home',
      History: 'tab-history',
      Tax: 'tab-tax',
      Guide: 'tab-guide',
      Settings: 'tab-settings',
    };
    return (
      <Pressable
        key={tab.key}
        onPress={() => goTo(i)}
        testID={testIdByKey[tab.key]}
        style={({ pressed }) => [styles.tabItem, pressed && styles.tabPressed]}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.title}
        // RN-web coerces boolean aria-selected to "" — use "true"|"false" strings
        {...({ 'aria-selected': focused ? 'true' : 'false' } as object)}
        hitSlop={4}
      >
        <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
          <Icon
            name={focused ? tab.icon : tab.iconOut}
            size={20}
            color={focused ? colors.gold : colors.inkSoft}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            useShortLabels && styles.tabLabelShort,
            focused && styles.tabLabelActive,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <TabNavProvider goToIndex={goTo} tabKeys={TAB_KEYS}>
      <View style={styles.root} onLayout={onRootLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          disableIntervalMomentum
          // Avoid continuous onScroll→index on web (programmatic scrollTo races)
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          scrollEventThrottle={16}
          {...ltrDomProps}
          style={styles.pager}
          contentContainerStyle={
            pageWidth > 0
              ? { width: pageWidth * TABS.length, flexDirection: 'row' }
              : { flexDirection: 'row' }
          }
        >
          {TABS.map(({ key, Screen }) => (
            <View
              key={key}
              style={[styles.page, pageWidth > 0 ? { width: pageWidth } : styles.pageFlex, DIR]}
              collapsable={false}
              {...rtlDomProps}
            >
              {key === 'Tax' ? (
                <TaxScreenGate armed={taxVisited} />
              ) : key === 'Guide' ? (
                <GuideScreenGate armed={guideVisited} />
              ) : key === 'Settings' ? (
                <SettingsScreenGate armed={settingsVisited} />
              ) : Screen ? (
                <Screen />
              ) : null}
            </View>
          ))}
        </ScrollView>

        <View
          style={[styles.tabBar, DIR, { bottom, left: 12, right: 12 }]}
          accessibilityRole="tablist"
          pointerEvents="box-none"
          {...rtlDomProps}
        >
          <View style={styles.tabBg} pointerEvents="none">
            <View style={styles.tabTint} />
          </View>
          <View style={styles.tabsRow}>
            {TABS.slice(0, 2).map((tab, i) => renderTab(tab, i))}
            <View style={styles.fabNotch} pointerEvents="box-none">
              <Pressable
                onPress={() => openAdd('tzedaka')}
                testID="fab-add"
                style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel="הוסף תנועה ✦"
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
            </View>
            {TABS.slice(2).map((tab, i) => renderTab(tab, i + 2))}
          </View>
        </View>
      </View>
    </TabNavProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: '100%', overflow: 'hidden' },
  pager: { flex: 1, width: '100%' },
  page: { flex: 1, height: '100%', overflow: 'hidden' },
  pageFlex: { flex: 1 },
  chunkFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    position: 'absolute',
    height: 64,
    borderRadius: 28,
    zIndex: 100,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    elevation: 12,
  },
  tabBg: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    overflow: 'hidden',
  },
  tabTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 16, 32, 0.92)',
    borderRadius: 28,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    gap: 2,
    zIndex: 2,
    paddingHorizontal: 1,
  },
  tabPressed: { opacity: 0.75 },
  tabIconWrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    minWidth: 36,
    alignItems: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.primarySoft,
  },
  tabLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 16,
    color: colors.inkSoft,
    writingDirection: 'rtl',
    textAlign: 'center',
    maxWidth: '100%',
  },
  tabLabelShort: {
    fontSize: 11,
    lineHeight: 14,
  },
  tabLabelActive: {
    color: colors.gold,
    fontFamily: fonts.semi,
  },
  tabLabelSpacer: {
    height: 16,
  },
  /** notch מרכזי ל־✦ — לא גוזל מ־flex של הטאבים */
  fabNotch: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    marginTop: -18,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  fabGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontFamily: fonts.displayExtra,
    fontSize: 20,
    color: '#fff',
    lineHeight: 24,
  },
});
