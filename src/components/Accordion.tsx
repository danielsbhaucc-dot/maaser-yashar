import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { colors, fonts, radii, shadow, spacing, type } from '../theme';
import { DIR } from '../rtl';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type AccordionItemData = {
  id: string;
  question: string;
  answer: string;
};

type Props = {
  items: AccordionItemData[];
  /** איזה פריט פתוח בהתחלה (אופציונלי) */
  defaultOpenId?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * אקורדיון בלעדי בסגנון NuraWell — מותאם לפלטת מעשר ישר.
 * פתיחת שאלה אחת סוגרת את הקודמת.
 */
export function Accordion({ items, defaultOpenId = null, style }: Props) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((cur) => (cur === id ? null : id));
  };

  return (
    <View style={[styles.list, DIR, style]}>
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <View
            key={item.id}
            style={[styles.card, open && styles.cardOpen, shadow.soft]}
          >
            <Pressable
              onPress={() => toggle(item.id)}
              style={[styles.header, open && styles.headerOpen]}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={item.question}
            >
              <View style={styles.qMark}>
                <Text style={styles.qMarkText}>?</Text>
              </View>
              <Text style={styles.question} numberOfLines={open ? 4 : 2}>
                {item.question}
              </Text>
              <Text style={[styles.chevron, open && styles.chevronOpen]}>
                {open ? '⌃' : '⌄'}
              </Text>
            </Pressable>
            {open ? (
              <View style={styles.body}>
                <Text style={styles.answer}>{item.answer}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    gap: 12,
  },
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 155, 255, 0.22)',
    backgroundColor: 'transparent',
  },
  cardOpen: {
    borderColor: 'rgba(240, 198, 116, 0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#2A2558',
  },
  headerOpen: {
    backgroundColor: '#35307A',
  },
  qMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  qMarkText: {
    fontFamily: fonts.extra,
    fontSize: 16,
    color: '#fff',
    lineHeight: 18,
  },
  question: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#fff',
    textAlign: 'left',
    writingDirection: 'rtl',
    lineHeight: 22,
  },
  chevron: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    width: 22,
    textAlign: 'center',
  },
  chevronOpen: {
    color: colors.gold,
  },
  body: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(42, 37, 88, 0.12)',
  },
  answer: {
    ...type.bodySm,
    color: '#1E1B4B',
    lineHeight: 24,
    textAlign: 'left',
    writingDirection: 'rtl',
    fontFamily: fonts.regular,
  },
});
