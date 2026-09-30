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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { colors, fonts, layout } from '../theme';
import { DIR, ltrDomProps, rtlDomProps } from '../rtl';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import GuideScreen from '../screens/GuideScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { TabNavProvider, type TabKey } from './TabNavContext';
import {
  documentTitleForTab,
  pathForTab,
  tabFromPathname,
  tabLabel,
  TAB_LABELS_LONG,
} from './tabRoutes';
import { useApp } from '../context/AppContext';
import { useShellLayout } from '../hooks/useShellLayout';

const TaxScreen = React.lazy(() => import('../screens/TaxScreen'));

function TaxScreenGate() {
  return (
    <Suspense
      fallback={
        <View style={styles.chunkFallback}>
          <ActivityIndicator color={colors.gold} />
        </View>
      }
    >
      <TaxScreen />
    </Suspense>
  );
}

const TAB_META = [
  { key: 'Home' as const, icon: 'home', iconOut: 'home-outline', Screen: HomeScreen },
  { key: 'History' as const, icon: 'time', iconOut: 'time-outline', Screen: HistoryScreen },
  { key: 'Tax' as const, icon: 'receipt', iconOut: 'receipt-outline', Screen: TaxScreenGate },
  { key: 'Guide' as const, icon: 'book', iconOut: 'book-outline', Screen: GuideScreen },
  { key: 'Settings' as const, icon: 'settings', iconOut: 'settings-outline', Screen: SettingsScreen },
] as const;

const TAB_KEYS: TabKey[] = TAB_META.map((t) => t.key);
const TAX_TAB_INDEX = TAB_META.findIndex((t) => t.key === 'Tax');

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
  const [taxVisited, setTaxVisited] = useState(
    () => initialIndexFromLocation() === TAX_TAB_INDEX
  );
  const insets = useSafeAreaInsets();
  const shell = useShellLayout();
  const { openAdd } = useApp();
  const bottom = 12 + insets.bottom;
  const useShortLabels = shell.useShortLabels;
  const flatBar = shell.mode !== 'compact';

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (index === TAX_TAB_INDEX) setTaxVisited(true);
  }, [index]);

  const setIndexSafe = useCallback((i: number) => {
    const next = Math.max(0, Math.min(TAB_META.length - 1, i));
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
  }, []);

  const onRootLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = Math.round(e.nativeEvent.layout.width);
      if (w <= 0) return;
      if (Math.abs(w - pageWidth) < 1) return;
      setPageWidth(w);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          x: indexRef.current * w,
          y: 0,
          animated: false,
        });
      });
    },
    [pageWidth]
  );

  const syncIndexFromOffset = useCallback(
    (x: number) => {
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
      if (i < 0 || i >= TAB_META.length) return;
      indexRef.current = i;
      setIndex(i);
      if (pageWidth <= 0) return;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: i * pageWidth, y: 0, animated: true });
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

  const renderTab = (tab: (typeof TAB_META)[number], i: number) => {
    const focused = i === index;
    const label = tabLabel(tab.key, useShortLabels);
    const a11y = TAB_LABELS_LONG[tab.key];
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
        accessibilityLabel={a11y}
        // RN-web omits aria-selected from accessibilityState alone — e2e needs strings
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

  const tabBarPos = flatBar
    ? {
        bottom: insets.bottom,
        start: 0,
        end: 0,
        borderRadius: 0,
        height: layout.tabBarHeight + Math.max(insets.bottom, 0),
        paddingBottom: insets.bottom,
      }
    : { bottom, start: 12, end: 12 };

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
          onScroll={onScroll}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          scrollEventThrottle={16}
          {...ltrDomProps}
          style={styles.pager}
          contentContainerStyle={
            pageWidth > 0
              ? { width: pageWidth * TAB_META.length, flexDirection: 'row' }
              : { flexDirection: 'row' }
          }
        >
          {TAB_META.map(({ key, Screen }) => (
            <View
              key={key}
              style={[styles.page, pageWidth > 0 ? { width: pageWidth } : styles.pageFlex, DIR]}
              collapsable={false}
              {...rtlDomProps}
            >
              {key === 'Tax' && !taxVisited ? null : <Screen />}
            </View>
          ))}
        </ScrollView>

        <View
          style={[
            styles.tabBar,
            flatBar && styles.tabBarFlat,
            DIR,
            tabBarPos,
          ]}
          accessibilityRole="tablist"
          testID="tab-bar"
          pointerEvents="box-none"
          {...rtlDomProps}
        >
          <View style={[styles.tabBg, flatBar && styles.tabBgFlat]} pointerEvents="none">
            <View style={[styles.tabTint, flatBar && styles.tabTintFlat]} />
          </View>
          <View style={styles.tabsRow}>
            {TAB_META.slice(0, 2).map((tab, i) => renderTab(tab, i))}
            <View style={styles.fabNotch} pointerEvents="box-none">
              <Pressable
                onPress={() => openAdd('tzedaka')}
                testID="fab-add"
                style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
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
            </View>
            {TAB_META.slice(2).map((tab, i) => renderTab(tab, i + 2))}
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
  tabBarFlat: {
    borderRadius: 0,
    borderWidth: 0,
    borderTopWidth: 1,
    elevation: 0,
    maxWidth: '100%',
    alignSelf: 'center',
  },
  tabBg: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    overflow: 'hidden',
  },
  tabBgFlat: {
    borderRadius: 0,
  },
  tabTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 16, 32, 0.92)',
    borderRadius: 28,
  },
  tabTintFlat: {
    borderRadius: 0,
    backgroundColor: 'rgba(12, 16, 32, 0.96)',
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
