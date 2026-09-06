import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { colors, fonts } from '../theme';
import { DIR } from '../rtl';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TaxScreen from '../screens/TaxScreen';
import GuideScreen from '../screens/GuideScreen';
import SettingsScreen from '../screens/SettingsScreen';

const TABS = [
  { key: 'Home', title: 'בית', icon: 'home', iconOut: 'home-outline', Screen: HomeScreen },
  { key: 'History', title: 'היסטוריה', icon: 'time', iconOut: 'time-outline', Screen: HistoryScreen },
  { key: 'Tax', title: 'החזר מס', icon: 'receipt', iconOut: 'receipt-outline', Screen: TaxScreen },
  { key: 'Guide', title: 'הנחיות', icon: 'book', iconOut: 'book-outline', Screen: GuideScreen },
  { key: 'Settings', title: 'הגדרות', icon: 'settings', iconOut: 'settings-outline', Screen: SettingsScreen },
] as const;

/**
 * Web: pager ב־LTR (מתמטיקה יציבה) + טאב־בר RTL.
 * בלי direction:rtl על ה־ScrollView — אחרת scrollTo/החלקה נשברים.
 */
export function SwipeTabs() {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const indexRef = useRef(0);
  const insets = useSafeAreaInsets();
  const bottom = (Platform.OS === 'ios' ? 22 : 12) + Math.max(insets.bottom - 8, 0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

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
      const i = Math.round(x / pageWidth);
      const next = Math.max(0, Math.min(TABS.length - 1, i));
      if (next !== indexRef.current) {
        indexRef.current = next;
        setIndex(next);
      }
    },
    [pageWidth]
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
      // web לפעמים צריך tick אחרי setState
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: i * pageWidth, y: 0, animated: true });
      });
    },
    [pageWidth]
  );

  return (
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
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        scrollEventThrottle={16}
        style={[styles.pager, styles.pagerLtr]}
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
          >
            <Screen />
          </View>
        ))}
      </ScrollView>

      <View
        style={[styles.tabBar, DIR, { bottom, left: 12, right: 12 }]}
        accessibilityRole="tablist"
        pointerEvents="box-none"
      >
        <View style={styles.tabBg} pointerEvents="none">
          <View style={styles.tabTint} />
        </View>
        {TABS.map((tab, i) => {
          const focused = i === index;
          return (
            <Pressable
              key={tab.key}
              onPress={() => goTo(i)}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && styles.tabPressed,
              ]}
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: '100%', overflow: 'hidden' },
  pager: { flex: 1, width: '100%' },
  /** קריטי ל־web: בלי זה RTL הורס paging + scrollTo */
  pagerLtr: {
    direction: 'ltr',
  },
  page: { flex: 1, height: '100%', overflow: 'hidden' },
  pageFlex: { flex: 1 },
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
    backgroundColor: 'rgba(12, 16, 32, 0.92)',
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
