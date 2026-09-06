import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useA11y } from './AccessibilityContext';
import { colors, fonts } from '../theme';
import { DIR } from '../rtl';

/** מדריך קריאה — קו אופקי שעוקב אחרי העכבר / אצבע */
export function ReadingGuideOverlay() {
  const { settings } = useA11y();
  const [y, setY] = useState(120);

  useEffect(() => {
    if (!settings.readingGuide || Platform.OS !== 'web') return;
    const onMove = (e: MouseEvent) => setY(e.clientY);
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [settings.readingGuide]);

  if (!settings.readingGuide) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.guide, { top: y - 18 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** מסכת מיקוד קריאה — מעמעם מעל ומתחת לקו */
export function ReadingMaskOverlay() {
  const { settings } = useA11y();
  const [y, setY] = useState(200);

  useEffect(() => {
    if (!settings.readingMask || Platform.OS !== 'web') return;
    const onMove = (e: MouseEvent) => setY(e.clientY);
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [settings.readingMask]);

  if (!settings.readingMask) return null;

  const band = 64;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.maskPart, { top: 0, height: Math.max(0, y - band / 2) }]} />
      <View
        style={[
          styles.maskPart,
          { top: y + band / 2, bottom: 0, height: undefined },
        ]}
      />
    </View>
  );
}

/** מבנה העמוד — רשימת כותרות לדילוג */
export function PageStructureModal() {
  const { settings, setSetting } = useA11y();
  const insets = useSafeAreaInsets();
  const [headings, setHeadings] = useState<{ text: string; level: number }[]>([]);

  useEffect(() => {
    if (!settings.pageStructure) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const nodes = Array.from(
        document.querySelectorAll('h1,h2,h3,h4,[aria-level], [accessibilityrole="header"]')
      );
      const list = nodes
        .map((n) => {
          const tag = n.tagName?.toLowerCase?.() || '';
          const level = tag.startsWith('h')
            ? parseInt(tag[1], 10)
            : Number(n.getAttribute('aria-level') || 2);
          return { text: (n.textContent || '').trim().slice(0, 80), level };
        })
        .filter((h) => h.text.length > 0);
      setHeadings(list.length ? list : [
        { text: 'בית', level: 1 },
        { text: 'היסטוריה', level: 2 },
        { text: 'מס', level: 2 },
        { text: 'מדריך', level: 2 },
        { text: 'הגדרות', level: 2 },
      ]);
    } else {
      setHeadings([
        { text: 'בית', level: 1 },
        { text: 'היסטוריה', level: 2 },
        { text: 'מס / מעשר', level: 2 },
        { text: 'מדריך', level: 2 },
        { text: 'הגדרות', level: 2 },
      ]);
    }
  }, [settings.pageStructure]);

  if (!settings.pageStructure) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => setSetting('pageStructure', false)}
    >
      <View style={[styles.structBackdrop, DIR]}>
        <View style={[styles.structCard, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.structHead}>
            <Text style={styles.structTitle}>מבנה העמוד</Text>
            <Pressable
              onPress={() => setSetting('pageStructure', false)}
              accessibilityRole="button"
              accessibilityLabel="סגור מבנה עמוד"
              style={styles.structClose}
            >
              <Text style={styles.structCloseTxt}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 360 }}>
            {headings.map((h, i) => (
              <View key={`${h.text}-${i}`} style={[styles.structRow, { paddingRight: 8 + h.level * 10 }]}>
                <Text style={styles.structLevel}>H{h.level}</Text>
                <Text style={styles.structText}>{h.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  guide: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: 'rgba(250, 204, 21, 0.28)',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: 'rgba(202, 138, 4, 0.85)',
    zIndex: 9000,
  },
  maskPart: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 8990,
  },
  structBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  structCard: {
    backgroundColor: colors.sheet,
    borderRadius: 20,
    padding: 16,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  structHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  structTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink,
    writingDirection: 'rtl',
  },
  structClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  structCloseTxt: { fontSize: 16, color: colors.inkMuted },
  structRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  structLevel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  structText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.inkMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
