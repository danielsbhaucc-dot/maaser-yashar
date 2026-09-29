import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
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
import TaxScreen from '../screens/TaxScreen';
import GuideScreen from '../screens/GuideScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { TabNavProvider, type TabKey } from './TabNavContext';
import { useApp } from '../context/AppContext';

const TABS = [
  { key: 'Home' as const, title: 'בית', icon: 'home', iconOut: 'home-outline', Screen: HomeScreen },
  { key: 'History' as const, title: 'היסטוריה', icon: 'time', iconOut: 'time-outline', Screen: HistoryScreen },
  { key: 'Tax' as const, title: 'החזר מס', icon: 'receipt', iconOut: 'receipt-outline', Screen: TaxScreen },
  { key: 'Guide' as const, title: 'הנחיות', icon: 'book', iconOut: 'book-outline', Screen: GuideScreen },
  { key: 'Settings' as const, title: 'הגדרות', icon: 'settings', iconOut: 'settings-outline', Screen: SettingsScreen },
] as const;

const TAB_KEYS: TabKey[] = TABS.map((t) => t.key);
const LABEL_ACTIVE_ONLY_MAX = 360;

/**
 * Native swipe:
 * האפליקציה כבר ב־RTL (I18nManager). PagerView עם layoutDirection="rtl"
 * עושה היפוך כפול — החלקה הפוכה. לכן ה־pager ב־LTR מבודד,
 * והטאב־בר נשאר RTL (בית מימין).
 */
export function SwipeTabs() {
  const pagerRef = useRef<PagerView>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { openAdd } = useApp();
  /** ריווח מעל פס הבית באייפון */
  const bottom = 12 + insets.bottom;
  const activeOnlyLabels = windowWidth <= LABEL_ACTIVE_ONLY_MAX;

  const setIndexSafe = useCallback((i: number) => {
    const next = Math.max(0, Math.min(TABS.length - 1, i));
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
  }, []);

  const onPageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      setIndexSafe(e.nativeEvent.position);
    },
    [setIndexSafe]
  );

  const onPageScroll = useCallback(
    (e: PagerViewOnPageScrollEvent) => {
      const { position, offset } = e.nativeEvent;
      setIndexSafe(Math.round(position + offset));
    },
    [setIndexSafe]
  );

  const goTo = useCallback((i: number) => {
    if (i < 0 || i >= TABS.length) return;
    indexRef.current = i;
    setIndex(i);
    requestAnimationFrame(() => {
      pagerRef.current?.setPage(i);
    });
  }, []);

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
      <View style={styles.root}>
        <View style={styles.pagerHost}>
          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={0}
            onPageSelected={onPageSelected}
            onPageScroll={onPageScroll}
            layoutDirection="ltr"
            overdrag
            offscreenPageLimit={1}
          >
            {TABS.map(({ key, Screen }) => (
              <View key={key} style={[styles.page, DIR]} collapsable={false}>
                <Screen />
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
  root: { flex: 1, width: '100%', maxWidth: '100%' },
  pagerHost: {
    flex: 1,
    width: '100%',
    direction: 'ltr',
  },
  pager: { flex: 1, width: '100%' },
  page: { flex: 1, width: '100%' },
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
  tabLabelActive: {
    color: colors.gold,
  },
  tabLabelSpacer: {
    height: 16,
  },
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
