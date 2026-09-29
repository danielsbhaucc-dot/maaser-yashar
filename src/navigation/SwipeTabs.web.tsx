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
import GuideScreen from '../screens/GuideScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { TabNavProvider, type TabKey } from './TabNavContext';
import { useApp } from '../context/AppContext';

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

const TABS = [
  { key: 'Home' as const, title: 'בית', icon: 'home', iconOut: 'home-outline', Screen: HomeScreen },
  { key: 'History' as const, title: 'היסטוריה', icon: 'time', iconOut: 'time-outline', Screen: HistoryScreen },
  { key: 'Tax' as const, title: 'החזר מס', icon: 'receipt', iconOut: 'receipt-outline', Screen: TaxScreenGate },
  { key: 'Guide' as const, title: 'הנחיות', icon: 'book', iconOut: 'book-outline', Screen: GuideScreen },
  { key: 'Settings' as const, title: 'הגדרות', icon: 'settings', iconOut: 'settings-outline', Screen: SettingsScreen },
] as const;

const TAB_KEYS: TabKey[] = TABS.map((t) => t.key);
/** רוחב מתחתיו מציגים תווית רק לטאב הפעיל */
const LABEL_ACTIVE_ONLY_MAX = 360;
const TAX_TAB_INDEX = TABS.findIndex((t) => t.key === 'Tax');

export function SwipeTabs() {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const indexRef = useRef(0);
  const [taxVisited, setTaxVisited] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { openAdd } = useApp();
  const bottom = 12 + insets.bottom;
  const activeOnlyLabels = windowWidth <= LABEL_ACTIVE_ONLY_MAX;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (index === TAX_TAB_INDEX) setTaxVisited(true);
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
      if (i < 0 || i >= TABS.length) return;
      indexRef.current = i;
      setIndex(i);
      if (pageWidth <= 0) return;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: i * pageWidth, y: 0, animated: true });
      });
    },
    [pageWidth]
  );

  const renderTab = (tab: (typeof TABS)[number], i: number) => {
    const focused = i === index;
    const showLabel = focused || !activeOnlyLabels;
    return (
      <Pressable
        key={tab.key}
        onPress={() => goTo(i)}
        style={({ pressed }) => [styles.tabItem, pressed && styles.tabPressed]}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.title}
        hitSlop={4}
      >
        <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
          <Icon
            name={focused ? tab.icon : tab.iconOut}
            size={20}
            color={focused ? colors.gold : colors.inkSoft}
          />
        </View>
        {showLabel ? (
          <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
            {tab.title}
          </Text>
        ) : (
          <View style={styles.tabLabelSpacer} />
        )}
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
          onScroll={onScroll}
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
              {key === 'Tax' && !taxVisited ? null : <Screen />}
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
  tabLabelActive: {
    color: colors.gold,
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
