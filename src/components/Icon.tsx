import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';

/** מפת אייקונים בלי @expo/vector-icons — יציב ב-web */
const GLYPHS: Record<string, string> = {
  home: '⌂',
  'home-outline': '⌂',
  time: '◷',
  'time-outline': '◷',
  receipt: '▤',
  'receipt-outline': '▤',
  book: '◈',
  'book-outline': '◈',
  settings: '⚙',
  'settings-outline': '⚙',
  options: '☰',
  'options-outline': '☰',
  leaf: '✿',
  heart: '♥',
  'heart-outline': '♡',
  person: '☺',
  'person-outline': '☺',
  people: '☺☺',
  'people-outline': '☺☺',
  briefcase: '▣',
  'briefcase-outline': '▣',
  storefront: '⌂',
  'storefront-outline': '⌂',
  cash: '₪',
  'cash-outline': '₪',
  gift: '❀',
  'gift-outline': '❀',
  wallet: '▣',
  'wallet-outline': '▣',
  'arrow-down-circle': '↓',
  'arrow-up-circle': '↑',
  'arrow-down': '↓',
  'arrow-up': '↑',
  'arrow-back': '→',
  'chevron-back': '‹',
  'chevron-forward': '›',
  'chevron-down': '▾',
  close: '✕',
  checkmark: '✓',
  'checkmark-circle': '✓',
  bookmark: '⚑',
  trash: '⌫',
  'trash-outline': '⌫',
  'information-circle': 'ℹ',
  'alert-circle': '⚠',
  sparkles: '✦',
  'sparkles-outline': '✦',
  water: '◈',
  'water-outline': '◈',
  construct: '⚒',
  'add-circle': '+',
  link: '⚭',
  'open-outline': '↗',
  ellipse: '●',
};

type Props = {
  name: string;
  size?: number;
  color?: string;
  style?: TextStyle;
};

export default function Icon({ name, size = 18, color = '#1C1C1E', style }: Props) {
  const glyph = GLYPHS[name] ?? '•';
  return (
    <Text
      style={[
        styles.icon,
        { fontSize: size, color, lineHeight: size * 1.15, width: size * 1.2, textAlign: 'center' },
        style,
      ]}
    >
      {glyph}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontFamily: undefined,
  },
});
