import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
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

const TABS = [
  { key: 'Home', title: 'בית', icon: 'home', iconOut: 'home-outline', Screen: HomeScreen },
  { key: 'History', title: 'היסטוריה', icon: 'time', iconOut: 'time-outline', Screen: HistoryScreen },
  { key: 'Tax', title: 'החזר מס', icon: 'receipt', iconOut: 'receipt-outline', Screen: TaxScreen },
  { key: 'Guide', title: 'הנחיות', icon: 'book', iconOut: 'book-outline', Screen: GuideScreen },
  { key: 'Settings', title: 'הגדרות', icon: 'settings', iconOut: 'settings-outline', Screen: SettingsScreen },
] as const;

/** Web: ScrollView עם paging — בלי react-native-pager-view (native-only) */
export function SwipeTabs() {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 480);
  const bottom = (Platform.OS === 'ios' ? 22 : 12) + Math.max(insets.bottom - 8, 0);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / pageWidth);
      if (i >= 0 && i < TABS.length) setIndex(i);
    },
    [pageWidth]
  );

  const goTo = useCallback(
    (i: number) => {
      setIndex(i);
      scrollRef.current?.scrollTo({ x: i * pageWidth, animated: true });
    },
    [pageWidth]
  );

  return (
    <View style={[styles.root, DIR]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        style={styles.pager}
        contentContainerStyle={{ width: pageWidth * TABS.length }}
      >
        {TABS.map(({ key, Screen }) => (
          <View key={key} style={[styles.page, { width: pageWidth }]}>
            <Screen />
          </View>
        ))}
      </ScrollView>

      <View
        style={[styles.tabBar, { bottom, left: 12, right: 12 }]}
        accessibilityRole="tablist"
      >
        <View style={styles.tabBg}>
          <View style={styles.tabTint} />
        </View>
        {TABS.map((tab, i) => {
          const focused = i === index;
          return (
            <Pressable
              key={tab.key}
              onPress={() => goTo(i)}
              style={styles.tabItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.title}
              hitSlop={6}
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
  root: { flex: 1, width: '100%', maxWidth: '100%' },
  pager: { flex: 1, width: '100%' },
  page: { flex: 1 },
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
    zIndex: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tabBg: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    overflow: 'hidden',
  },
  tabTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 16, 32, 0.88)',
    borderRadius: 28,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 2,
  },
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
