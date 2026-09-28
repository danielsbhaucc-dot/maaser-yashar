import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import PagerView, {
  type PagerViewOnPageSelectedEvent,
  type PagerViewOnPageScrollEvent,
} from 'react-native-pager-view';
import { BlurView } from 'expo-blur';
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

const TABS = [
  { key: 'Home' as const, title: 'בית', icon: 'home', iconOut: 'home-outline', Screen: HomeScreen },
  { key: 'History' as const, title: 'היסטוריה', icon: 'time', iconOut: 'time-outline', Screen: HistoryScreen },
  { key: 'Tax' as const, title: 'החזר מס', icon: 'receipt', iconOut: 'receipt-outline', Screen: TaxScreen },
  { key: 'Guide' as const, title: 'הנחיות', icon: 'book', iconOut: 'book-outline', Screen: GuideScreen },
  { key: 'Settings' as const, title: 'הגדרות', icon: 'settings', iconOut: 'settings-outline', Screen: SettingsScreen },
] as const;

const TAB_KEYS: TabKey[] = TABS.map((t) => t.key);

/**
 * Native swipe:
 * האפליקציה כבר ב־RTL (I18nManager). PagerView עם layoutDirection="rtl"
 * עושה היפוך כפול — החלקה הפוכה. לכן ה־pager ב־LTR מבודד,
 * והטאב־בר נשאר RTL (בית מימין).
 * החלקה שמאלה → מסך הבא (היסטוריה וכו') — תואם למיקום הטאבים.
 */
export function SwipeTabs() {
  const pagerRef = useRef<PagerView>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const insets = useSafeAreaInsets();
  const bottom = (Platform.OS === 'ios' ? 22 : 12) + Math.max(insets.bottom - 8, 0);

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

  /** עדכון טאב גם תוך כדי החלקה — לא רק בסוף */
  const onPageScroll = useCallback(
    (e: PagerViewOnPageScrollEvent) => {
      const { position, offset } = e.nativeEvent;
      setIndexSafe(Math.round(position + offset));
    },
    [setIndexSafe]
  );

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= TABS.length) return;
      indexRef.current = i;
      setIndex(i);
      requestAnimationFrame(() => {
        pagerRef.current?.setPage(i);
      });
    },
    []
  );

  return (
    <TabNavProvider goToIndex={goTo} tabKeys={TAB_KEYS}>
    <View style={styles.root}>
      {/* מבודד מ־RTL של האפליקציה — מונע היפוך כיוון החלקה */}
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
        {TABS.map((tab, i) => {
          const focused = i === index;
          return (
            <Pressable
              key={tab.key}
              onPress={() => goTo(i)}
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabPressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.title}
              hitSlop={8}
            >
              <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
                <Icon
                  name={focused ? tab.icon : tab.iconOut}
                  size={20}
                  color={focused ? colors.gold : colors.inkSoft}
                />
              </View>
              <Text
                style={[styles.tabLabel, focused && styles.tabLabelActive]}
                numberOfLines={1}
              >
                {tab.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
    </TabNavProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: '100%' },
  /** LTR מפורש — בלי direction:rtl מההורה */
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 4,
    zIndex: 100,
    overflow: 'hidden',
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
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    gap: 2,
    zIndex: 2,
  },
  tabPressed: { opacity: 0.75 },
  tabIconWrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    minWidth: 40,
    alignItems: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.primarySoft,
  },
  tabLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.inkSoft,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.gold,
  },
});
