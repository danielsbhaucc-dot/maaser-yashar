import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
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

/**
 * טאבים עם החלקה ימינה/שמאלה (Pager) — RTL מלא, מובייל־פירסט.
 */
export function SwipeTabs() {
  const pagerRef = useRef<PagerView>(null);
  const [index, setIndex] = useState(0);
  const insets = useSafeAreaInsets();
  const bottom = (Platform.OS === 'ios' ? 22 : 12) + Math.max(insets.bottom - 8, 0);

  const onPageSelected = useCallback((e: PagerViewOnPageSelectedEvent) => {
    setIndex(e.nativeEvent.position);
  }, []);

  const goTo = useCallback((i: number) => {
    setIndex(i);
    pagerRef.current?.setPage(i);
  }, []);

  return (
    <View style={[styles.root, DIR]}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={onPageSelected}
        layoutDirection="rtl"
        overdrag
      >
        {TABS.map(({ key, Screen }) => (
          <View key={key} style={styles.page} collapsable={false}>
            <Screen />
          </View>
        ))}
      </PagerView>

      <View
        style={[
          styles.tabBar,
          {
            bottom,
            left: 12,
            right: 12,
          },
        ]}
        accessibilityRole="tablist"
      >
        <View style={styles.tabBg}>
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
    backgroundColor: Platform.OS === 'web' ? 'rgba(12, 16, 32, 0.88)' : 'rgba(12, 16, 32, 0.72)',
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
