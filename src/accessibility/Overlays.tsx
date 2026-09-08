import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useA11y } from './AccessibilityContext';
import { colors, fonts } from '../theme';
import { DIR } from '../rtl';

function usePointerY(enabled: boolean) {
  const [y, setY] = useState(160);

  useEffect(() => {
    if (!enabled) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onMove = (e: MouseEvent) => setY(e.clientY);
      const onTouch = (e: TouchEvent) => {
        if (e.touches[0]) setY(e.touches[0].clientY);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('touchmove', onTouch, { passive: true });
      return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('touchmove', onTouch);
      };
    }
  }, [enabled]);

  const onTouchMove = (e: GestureResponderEvent) => {
    setY(e.nativeEvent.pageY);
  };

  return { y, onTouchMove };
}

/** מדריך קריאה — קו אופקי שעוקב אחרי העכבר / אצבע */
export function ReadingGuideOverlay() {
  const { settings } = useA11y();
  const { y, onTouchMove } = usePointerY(settings.readingGuide);

  if (!settings.readingGuide) return null;

  return (
    <View
      pointerEvents={Platform.OS === 'web' ? 'none' : 'box-none'}
      style={StyleSheet.absoluteFill}
      onTouchMove={Platform.OS === 'web' ? undefined : onTouchMove}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.guide, { top: y - 18 }]} pointerEvents="none" />
    </View>
  );
}

/** מסכת מיקוד קריאה — מעמעם מעל ומתחת לקו */
export function ReadingMaskOverlay() {
  const { settings } = useA11y();
  const { y, onTouchMove } = usePointerY(settings.readingMask);

  if (!settings.readingMask) return null;

  const band = 72;
  return (
    <View
      pointerEvents={Platform.OS === 'web' ? 'none' : 'box-none'}
      style={StyleSheet.absoluteFill}
      onTouchMove={Platform.OS === 'web' ? undefined : onTouchMove}
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

/** לחיצה על טקסט מקריאה אותו (Web) */
export function ClickToSpeakOverlay() {
  const { settings, speak, stopSpeak } = useA11y();

  useEffect(() => {
    const on = settings.clickToSpeak || settings.textToSpeech;
    if (!on || Platform.OS !== 'web' || typeof document === 'undefined') return;

    const onClick = (e: MouseEvent) => {
      const root = document.getElementById('maaser-a11y-root');
      if (root && root.contains(e.target as Node)) return;

      const el = e.target as HTMLElement | null;
      if (!el) return;
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const label =
        el.getAttribute?.('aria-label') ||
        el.getAttribute?.('accessibilitylabel') ||
        '';
      const text = (label || el.innerText || el.textContent || '').trim();
      if (text.length < 2) return;
      if (!settings.clickToSpeak && settings.textToSpeech) {
        // במצב TTS בלבד — רק אם יש בחירת טקסט
        const sel = window.getSelection?.()?.toString()?.trim();
        if (sel && sel.length > 1) {
          speak(sel);
        }
        return;
      }
      if (settings.clickToSpeak) {
        e.stopPropagation();
        speak(text.slice(0, 400));
      }
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [settings.clickToSpeak, settings.textToSpeech, speak, stopSpeak]);

  return null;
}

/** רמזי קורא מסך — תיאור צף ליד פוקוס / מעבר */
export function ScreenReaderHintsOverlay() {
  const { settings } = useA11y();
  const [hint, setHint] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 16, y: 80 });

  useEffect(() => {
    if (!settings.screenReaderHints || Platform.OS !== 'web' || typeof document === 'undefined') {
      setHint(null);
      return;
    }

    const describe = (el: Element | null) => {
      if (!el || !(el instanceof HTMLElement)) return null;
      const root = document.getElementById('maaser-a11y-root');
      if (root && root.contains(el)) return null;
      const label =
        el.getAttribute('aria-label') ||
        el.getAttribute('accessibilitylabel') ||
        el.getAttribute('title') ||
        '';
      const role = el.getAttribute('role') || el.getAttribute('accessibilityrole') || el.tagName;
      const text = (label || el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!text) return null;
      return `${role}: ${text}`;
    };

    const onFocus = (e: FocusEvent) => {
      const d = describe(e.target as Element);
      setHint(d);
      if (e.target instanceof HTMLElement) {
        const r = e.target.getBoundingClientRect();
        setPos({ x: Math.min(r.left, window.innerWidth - 220), y: Math.max(8, r.top - 40) });
      }
    };
    const onBlur = () => setHint(null);

    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, [settings.screenReaderHints]);

  if (!settings.screenReaderHints || !hint) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.hintBubble, { top: pos.y, left: Math.max(8, pos.x) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.hintBubbleTxt} numberOfLines={3}>
        {hint}
      </Text>
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
        document.querySelectorAll(
          'h1,h2,h3,h4,[aria-level], [accessibilityrole="header"], [role="header"]'
        )
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
      setHeadings(
        list.length
          ? list
          : [
              { text: 'בית', level: 1 },
              { text: 'היסטוריה', level: 2 },
              { text: 'מס', level: 2 },
              { text: 'מדריך', level: 2 },
              { text: 'הגדרות', level: 2 },
            ]
      );
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
              <View
                key={`${h.text}-${i}`}
                style={[styles.structRow, { paddingRight: 8 + h.level * 10 }]}
              >
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
  hintBubble: {
    position: 'absolute',
    zIndex: 9500,
    maxWidth: 240,
    backgroundColor: colors.surfaceSolid,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.glassGoldBorder,
  },
  hintBubbleTxt: {
    fontFamily: fonts.semi,
    fontSize: 12,
    color: colors.ink,
    textAlign: 'left',
    writingDirection: 'rtl',
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
    textAlign: 'left',
    writingDirection: 'rtl',
  },
});
