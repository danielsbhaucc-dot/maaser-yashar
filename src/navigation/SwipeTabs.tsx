import React, { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import PagerView, {
  type PagerViewOnPageSelectedEvent,
  type PagerViewOnPageScrollEvent,
} from 'react-native-pager-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { colors, fonts } from '../theme';
import { DIR } from '../rtl';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { TabNavProvider, type TabKey } from './TabNavContext';
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
/** מתחת לרוחב זה — תוויות מקוצרות (תמיד גלויות) */
const SHORT_LABEL_MAX = 430;
const TAX_TAB_INDEX = TABS.findIndex((t) => t.key === 'Tax');
const GUIDE_TAB_INDEX = TABS.findIndex((t) => t.key === 'Guide');
const SETTINGS_TAB_INDEX = TABS.findIndex((t) => t.key === 'Settings');

/**
 * Native swipe:
 * טאב־בר ב־RTL (בית מימין). ה־pager ב־LTR עם סדר עמודים הפוך
 * (בית בקצה הימני) — כך החלקה ימינה עוברת להיסטוריה וכו'.
 */
export function SwipeTabs() {
  const pagerRef = useRef<PagerView>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const [taxVisited, setTaxVisited] = useState(false);
  const [guideVisited, setGuideVisited] = useState(false);
  const [settingsVisited, setSettingsVisited] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { openAdd } = useApp();
  /** ריווח מעל פס הבית באייפון */
  const bottom = 12 + insets.bottom;
  const useShortLabels = windowWidth <= SHORT_LABEL_MAX;
  const pageCount = TABS.length;
  const toScroll = useCallback((tabIndex: number) => pageCount - 1 - tabIndex, [pageCount]);
  const toTab = useCallback((scrollIndex: number) => pageCount - 1 - scrollIndex, [pageCount]);

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

  const onPageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      setIndexSafe(toTab(e.nativeEvent.position));
    },
    [setIndexSafe, toTab]
  );

  const onPageScroll = useCallback(
    (e: PagerViewOnPageScrollEvent) => {
      const { position, offset } = e.nativeEvent;
      setIndexSafe(toTab(Math.round(position + offset)));
    },
    [setIndexSafe, toTab]
  );

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= TABS.length) return;
      indexRef.current = i;
      setIndex(i);
      requestAnimationFrame(() => {
        pagerRef.current?.setPage(toScroll(i));
      });
    },
    [toScroll]
  );

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
        {...(Platform.OS === 'web'
          ? ({ 'aria-selected': focused ? 'true' : 'false' } as object)
          : {})}
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

  const pagesRtl = [...TABS].reverse();

  return (
    <TabNavProvider goToIndex={goTo} tabKeys={TAB_KEYS}>
      <View style={styles.root}>
        <View style={styles.pagerHost}>
          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={toScroll(0)}
            onPageSelected={onPageSelected}
            onPageScroll={onPageScroll}
            layoutDirection="ltr"
            overdrag
            offscreenPageLimit={1}
          >
            {pagesRtl.map(({ key, Screen }) => (
              <View key={key} style={[styles.page, DIR]} collapsable={false}>
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
          </PagerView>
        </View>

        <View
          style={[styles.tabBar, DIR, { bottom, left: 12, right: 12 }]}
          accessibilityRole="tablist"
          pointerEvents="box-none"
        >
          <View style={styles.tabBg} pointerEvents="none">
            {Platform.OS !== 'web' ? (
              <BlurView
                intensity={Platform.OS === 'ios' ? 70 : 40}
                tint="systemChromeMaterialDark"
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View style={styles.tabTint} />
          </View>
          <View style={styles.tabsRow}>
            {TABS.map((tab, i) => renderTab(tab, i))}
          </View>
          <View style={styles.fabCenter} pointerEvents="box-none">
            <Pressable
              onPress={() => openAdd('tzedaka')}
              testID="fab-add"
              style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel="הוסף תנועה"
            >
              <LinearGradient
                colors={[...colors.primaryGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabGrad}
              >
                <Text style={styles.fabIcon}>+</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </TabNavProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: '100%' },
  pagerHost: {
    flex: 1,
    width: '100%',
    direction: 'ltr',
  },
  pager: { flex: 1, width: '100%' },
  page: { flex: 1, width: '100%' },
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
    backgroundColor: Platform.OS === 'web' ? 'rgba(12, 16, 32, 0.88)' : 'rgba(12, 16, 32, 0.72)',
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
  /** FAB ממורכז לחלוטין — בוקע מעל מרכז הטאב־בר */
  fabCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  fabGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontFamily: fonts.displayExtra,
    fontSize: 32,
    color: '#fff',
    lineHeight: 34,
    marginTop: -2,
  },
});
