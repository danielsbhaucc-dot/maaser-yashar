import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useA11y } from './AccessibilityContext';
import { A11Y_PROFILES, COLOR_SWATCHES, LEVEL_LABELS } from './profiles';
import type { ContrastMode, SaturationMode } from './types';
import { colors, fonts } from '../theme';
import { DIR } from '../rtl';
import {
  PageStructureModal,
  ReadingGuideOverlay,
  ReadingMaskOverlay,
} from './Overlays';

/** פלטת נגישות — כחול־ספיר / סגול / זהב כמו בשאר האפליקציה */
const A11Y = {
  header: colors.primaryDark,
  headerDeep: '#4F5FD6',
  soft: 'rgba(139, 155, 255, 0.14)',
  softBorder: 'rgba(139, 155, 255, 0.28)',
  active: colors.primaryDark,
  activeDeep: '#5566E0',
  accent: colors.accent,
  gold: colors.gold,
  ink: colors.inkDark,
  muted: '#64748B',
  panel: '#F4F6FF',
  card: '#FFFFFF',
  navy: '#12182C',
};

const PANEL_W = 360;

type TileProps = {
  label: string;
  icon: string;
  active?: boolean;
  onPress: () => void;
  dots?: number;
  level?: number;
};

function Tile({ label, icon, active, onPress, dots, level }: TileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      style={[styles.tile, active && styles.tileActive]}
    >
      <Text style={[styles.tileIcon, active && styles.tileIconOn]}>{icon}</Text>
      <Text style={[styles.tileLabel, active && styles.tileLabelOn]} numberOfLines={2}>
        {label}
      </Text>
      {typeof dots === 'number' && dots > 0 ? (
        <View style={styles.dotsRow}>
          {Array.from({ length: dots }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, level && i < level ? styles.dotOn : null]}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.sectionHead}
      >
        <Text style={styles.sectionChevron}>{open ? '▾' : '◂'}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
  onReset,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  onReset: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={onDec}
          accessibilityLabel={`הקטן ${label}`}
          style={styles.stepBtn}
        >
          <Text style={styles.stepBtnTxt}>−</Text>
        </Pressable>
        <Pressable onPress={onReset} style={styles.stepValue}>
          <Text style={styles.stepValueTxt}>{LEVEL_LABELS[value] ?? 'רגיל'}</Text>
          <Text style={styles.stepReset}>איפוס</Text>
        </Pressable>
        <Pressable
          onPress={onInc}
          accessibilityLabel={`הגדל ${label}`}
          style={styles.stepBtn}
        >
          <Text style={styles.stepBtnTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.segRow}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.segBtn, on && styles.segBtnOn]}
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.segTxt, on && styles.segTxtOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const STATEMENT = `הצהרת נגישות — מעשר ישר

אפליקציית מעשר ישר מחויבת להנגשה לפי תקן ישראלי ת״י 5568 ו־WCAG 2.2 ברמת AA ככל האפשר.

מה כלול בתוסף הנגישות:
• פרופילי נגישות מוכנים (ראייה, מוטוריקה, דיסלקציה, קשב, אפילפסיה ועוד)
• התאמות ניגודיות, רוויה וצבעים
• שליטה בגודל טקסט, ריווח שורות/אותיות/מילים
• הדגשת קישורים, כותרות ופוקוס
• מדריך קריאה, מסכת מיקוד ומבנה עמוד
• עצירת אנימציות והפחתת תנועה
• סמן מוגדל, כפתורים גדולים וניווט מקלדת
• קריאת טקסט (TTS) בעברית
• אפשרות להסתיר את תפריט הנגישות ולשחזר אותו

קיצורי מקלדת (באתר / Web):
• Alt + A — פתיחת תפריט נגישות
• Escape — סגירת התפריט
• Alt + R — איפוס כל ההתאמות

פניות בנושא נגישות:
ניתן לפנות דרך מסך ההגדרות באפליקציה או לשלוח דיווח מהתפריט.

עודכן לאחרונה: ספטמבר 2026`;

export function AccessibilityWidget() {
  const a11y = useA11y();
  const { settings } = a11y;
  const insets = useSafeAreaInsets();
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({
    profiles: true,
    visual: true,
    content: true,
    nav: false,
    colors: false,
    info: false,
  });
  const [colorTarget, setColorTarget] = useState<'bg' | 'text' | 'headings'>('bg');
  const [statementOpen, setStatementOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const toggleSec = (id: string) =>
    setOpenSec((s) => ({ ...s, [id]: !s[id] }));

  const bump = (key: 'fontSize' | 'lineHeight' | 'letterSpacing' | 'wordSpacing' | 'zoomLevel', delta: number) => {
    const cur = settings[key] as number;
    const next = Math.max(0, Math.min(4, cur + delta));
    a11y.setSetting(key, next);
  };

  const colorKey =
    colorTarget === 'bg' ? 'colorBg' : colorTarget === 'text' ? 'colorText' : 'colorHeadings';

  // קיצורי מקלדת ב־web
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A' || e.key === 'ש')) {
        e.preventDefault();
        if (settings.panelOpen) a11y.closePanel();
        else a11y.openPanel();
      }
      if (e.key === 'Escape' && settings.panelOpen) a11y.closePanel();
      if (e.altKey && (e.key === 'r' || e.key === 'R' || e.key === 'ר')) {
        e.preventDefault();
        a11y.resetAll();
      }
      if (e.altKey && (e.key === 'h' || e.key === 'H' || e.key === 'י')) {
        e.preventDefault();
        if (settings.widgetHidden) a11y.showWidget();
        else a11y.hideWidget();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings.panelOpen, settings.widgetHidden, a11y]);

  const fabBottom = 16 + Math.max(insets.bottom, 8);

  const contrastTiles: { id: ContrastMode; label: string; icon: string }[] = [
    { id: 'high', label: 'ניגודיות גבוהה', icon: '◐' },
    { id: 'invert', label: 'היפוך צבעים', icon: '◑' },
    { id: 'dark', label: 'מצב כהה', icon: '☾' },
    { id: 'light', label: 'מצב בהיר', icon: '☀' },
    { id: 'blackYellow', label: 'שחור־צהוב', icon: 'A' },
    { id: 'sepia', label: 'ספיה', icon: '◉' },
  ];

  const satTiles: { id: SaturationMode; label: string; icon: string }[] = [
    { id: 'grayscale', label: 'גווני אפור', icon: '○' },
    { id: 'mono', label: 'מונוכרום', icon: '◎' },
    { id: 'low', label: 'רוויה נמוכה', icon: '💧' },
    { id: 'high', label: 'רוויה גבוהה', icon: '💦' },
  ];

  const panel = (
    <View
      nativeID="maaser-a11y-root"
      style={[styles.panelWrap, DIR, { paddingTop: insets.top + 8 }]}
      accessibilityViewIsModal
    >
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={a11y.closePanel}
            accessibilityLabel="סגור תפריט נגישות"
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnTxt}>✕</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>נגישות</Text>
            <Text style={styles.headerSub}>התאמות אישיות — נשמרות במכשיר</Text>
          </View>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconTxt}>♿</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* פרופילים */}
          <Section
            title="פרופילי נגישות"
            open={!!openSec.profiles}
            onToggle={() => toggleSec('profiles')}
          >
            <View style={styles.grid2}>
              {A11Y_PROFILES.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() =>
                    a11y.setProfile(settings.profile === p.id ? 'none' : p.id)
                  }
                  style={[
                    styles.profileCard,
                    settings.profile === p.id && styles.profileCardOn,
                  ]}
                  accessibilityState={{ selected: settings.profile === p.id }}
                >
                  <Text style={styles.profileIcon}>{p.icon}</Text>
                  <Text
                    style={[
                      styles.profileTitle,
                      settings.profile === p.id && styles.onTxt,
                    ]}
                  >
                    {p.title}
                  </Text>
                  <Text style={styles.profileSub} numberOfLines={2}>
                    {p.subtitle}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>

          {/* ויזואלי */}
          <Section
            title="התאמות ויזואליות"
            open={!!openSec.visual}
            onToggle={() => toggleSec('visual')}
          >
            <View style={styles.grid3}>
              {contrastTiles.map((t) => (
                <Tile
                  key={t.id}
                  label={t.label}
                  icon={t.icon}
                  active={settings.contrast === t.id}
                  onPress={() =>
                    a11y.setSetting(
                      'contrast',
                      settings.contrast === t.id ? 'off' : t.id
                    )
                  }
                />
              ))}
              {satTiles.map((t) => (
                <Tile
                  key={t.id}
                  label={t.label}
                  icon={t.icon}
                  active={settings.saturation === t.id}
                  onPress={() =>
                    a11y.setSetting(
                      'saturation',
                      settings.saturation === t.id ? 'off' : t.id
                    )
                  }
                />
              ))}
              <Tile
                label="הדגשת קישורים"
                icon="⚭"
                active={settings.highlightLinks}
                onPress={() => a11y.toggle('highlightLinks')}
              />
              <Tile
                label="הדגשת כותרות"
                icon="H"
                active={settings.highlightHeadings}
                onPress={() => a11y.toggle('highlightHeadings')}
              />
            </View>
          </Section>

          {/* תוכן */}
          <Section
            title="התאמות תוכן וקריאה"
            open={!!openSec.content}
            onToggle={() => toggleSec('content')}
          >
            <Stepper
              label="גודל טקסט"
              value={settings.fontSize}
              onDec={() => bump('fontSize', -1)}
              onInc={() => bump('fontSize', 1)}
              onReset={() => a11y.setSetting('fontSize', 0)}
            />
            <Stepper
              label="ריווח שורות"
              value={settings.lineHeight}
              onDec={() => bump('lineHeight', -1)}
              onInc={() => bump('lineHeight', 1)}
              onReset={() => a11y.setSetting('lineHeight', 0)}
            />
            <Stepper
              label="ריווח אותיות"
              value={settings.letterSpacing}
              onDec={() => bump('letterSpacing', -1)}
              onInc={() => bump('letterSpacing', 1)}
              onReset={() => a11y.setSetting('letterSpacing', 0)}
            />
            <Stepper
              label="ריווח מילים"
              value={settings.wordSpacing}
              onDec={() => bump('wordSpacing', -1)}
              onInc={() => bump('wordSpacing', 1)}
              onReset={() => a11y.setSetting('wordSpacing', 0)}
            />
            <Stepper
              label="הגדלת תצוגה"
              value={settings.zoomLevel}
              onDec={() => bump('zoomLevel', -1)}
              onInc={() => bump('zoomLevel', 1)}
              onReset={() => a11y.setSetting('zoomLevel', 0)}
            />
            <View style={[styles.grid3, { marginTop: 8 }]}>
              <Tile
                label="גופן קריא"
                icon="Aa"
                active={settings.readableFont}
                onPress={() => a11y.toggle('readableFont')}
              />
              <Tile
                label="פונט דיסלקציה"
                icon="A↔"
                active={settings.dyslexiaFont}
                onPress={() => a11y.toggle('dyslexiaFont')}
              />
              <Tile
                label="מצב קריאה"
                icon="☰"
                active={settings.readingMode}
                onPress={() => a11y.toggle('readingMode')}
              />
              <Tile
                label="מדריך קריאה"
                icon="═"
                active={settings.readingGuide}
                onPress={() => a11y.toggle('readingGuide')}
              />
              <Tile
                label="מיקוד קריאה"
                icon="▣"
                active={settings.readingMask}
                onPress={() => a11y.toggle('readingMask')}
              />
              <Tile
                label="קורא טקסט"
                icon="🔊"
                active={settings.textToSpeech}
                onPress={() => {
                  const next = !settings.textToSpeech;
                  a11y.setSetting('textToSpeech', next);
                  if (next) a11y.speak('קורא הטקסט הופעל. סמנו טקסט או לחצו על כפתור קריאה.');
                  else a11y.stopSpeak();
                }}
              />
            </View>
            {settings.textToSpeech ? (
              <Pressable
                style={styles.ttsBar}
                onPress={() =>
                  a11y.speak(
                    'שלום. זהו קורא הטקסט של מעשר ישר. אפשר להפעיל התאמות נגישות מהתפריט.'
                  )
                }
                accessibilityLabel="הקרא הודעת בדיקה"
              >
                <Text style={styles.ttsBarTxt}>▶ הקרא הודעת בדיקה</Text>
              </Pressable>
            ) : null}
          </Section>

          {/* ניווט */}
          <Section
            title="התאמות ניווט ותנועה"
            open={!!openSec.nav}
            onToggle={() => toggleSec('nav')}
          >
            <View style={styles.grid3}>
              <Tile
                label="הדגשת פוקוס"
                icon="◎"
                active={settings.highlightFocus}
                onPress={() => a11y.toggle('highlightFocus')}
              />
              <Tile
                label="הדגש אלמנטים"
                icon="✎"
                active={settings.highlightElements}
                onPress={() => a11y.toggle('highlightElements')}
              />
              <Tile
                label="מבנה העמוד"
                icon="▤"
                active={settings.pageStructure}
                onPress={() => a11y.toggle('pageStructure')}
              />
              <Tile
                label="סמן גדול"
                icon="↖"
                active={settings.bigCursor === 'large'}
                onPress={() =>
                  a11y.setSetting(
                    'bigCursor',
                    settings.bigCursor === 'large' ? 'off' : 'large'
                  )
                }
              />
              <Tile
                label="סמן כהה"
                icon="◆"
                active={settings.bigCursor === 'largeDark' || settings.bigCursor === 'black'}
                onPress={() => {
                  const on =
                    settings.bigCursor === 'largeDark' || settings.bigCursor === 'black';
                  a11y.setSetting('bigCursor', on ? 'off' : 'largeDark');
                }}
              />
              <Tile
                label="סמן בהיר"
                icon="◇"
                active={settings.bigCursor === 'largeLight' || settings.bigCursor === 'white'}
                onPress={() => {
                  const on =
                    settings.bigCursor === 'largeLight' || settings.bigCursor === 'white';
                  a11y.setSetting('bigCursor', on ? 'off' : 'largeLight');
                }}
              />
              <Tile
                label="הפחתת תנועה"
                icon="〰"
                active={settings.reduceMotion}
                onPress={() => a11y.toggle('reduceMotion')}
              />
              <Tile
                label="עצור אנימציות"
                icon="⏸"
                active={settings.stopAnimations}
                onPress={() => a11y.toggle('stopAnimations')}
              />
              <Tile
                label="השתק מדיה"
                icon="🔇"
                active={settings.muteMedia}
                onPress={() => a11y.toggle('muteMedia')}
              />
              <Tile
                label="הסתר תמונות"
                icon="🖼"
                active={settings.hideImages}
                onPress={() => a11y.toggle('hideImages')}
              />
              <Tile
                label="כפתורים גדולים"
                icon="⬚"
                active={settings.largeButtons}
                onPress={() => a11y.toggle('largeButtons')}
              />
              <Tile
                label="ניווט מקלדת"
                icon="⌨"
                active={settings.keyboardNav}
                onPress={() => a11y.toggle('keyboardNav')}
              />
              <Tile
                label="רמזי קורא מסך"
                icon="♬"
                active={settings.screenReaderHints}
                onPress={() => a11y.toggle('screenReaderHints')}
              />
            </View>
          </Section>

          {/* צבעים */}
          <Section
            title="התאמת צבעים"
            open={!!openSec.colors}
            onToggle={() => toggleSec('colors')}
          >
            <Text style={styles.hint}>בחרו מה לצבוע, ואז בחרו גוון</Text>
            <Segmented
              value={colorTarget}
              onChange={(id) => setColorTarget(id as typeof colorTarget)}
              options={[
                { id: 'bg', label: 'רקעים' },
                { id: 'headings', label: 'כותרות' },
                { id: 'text', label: 'תכנים' },
              ]}
            />
            <View style={styles.swatchRow}>
              {COLOR_SWATCHES.map((c) => {
                const active = settings[colorKey] === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => a11y.setSetting(colorKey, active ? null : c)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      c === '#FFFFFF' && styles.swatchBorder,
                      active && styles.swatchOn,
                    ]}
                    accessibilityLabel={`צבע ${c}`}
                  />
                );
              })}
            </View>
            <Pressable
              onPress={() => {
                a11y.patch({ colorBg: null, colorText: null, colorHeadings: null });
              }}
              style={styles.linkBtn}
            >
              <Text style={styles.linkBtnTxt}>↺ איפוס צבעים</Text>
            </Pressable>
          </Section>

          {/* מידע */}
          <Section
            title="מידע ועזרה"
            open={!!openSec.info}
            onToggle={() => toggleSec('info')}
          >
            <InfoRow
              icon="📄"
              title="הצהרת נגישות"
              sub="מידע על הנגשת האפליקציה"
              onPress={() => setStatementOpen(true)}
            />
            <InfoRow
              icon="⌨"
              title="ניווט מקלדת"
              sub="מדריך מקשי קיצור"
              onPress={() => setShortcutsOpen(true)}
            />
            <InfoRow
              icon="⚠"
              title="דיווח הפרה"
              sub="דווחו על בעיית נגישות"
              onPress={() => {
                Linking.openURL(
                  'mailto:accessibility@maaser-yashar.app?subject=' +
                    encodeURIComponent('דיווח נגישות — מעשר ישר')
                ).catch(() => {});
              }}
            />
            <InfoRow
              icon="👤"
              title="מורשה נגישות"
              sub="פרטי יצירת קשר"
              onPress={() => setStatementOpen(true)}
            />
          </Section>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={a11y.resetAll}
            style={styles.resetBtn}
            accessibilityLabel="איפוס כל ההתאמות"
          >
            <Text style={styles.resetTxt}>↺  איפוס כל ההתאמות</Text>
          </Pressable>
          <View style={styles.footerRow}>
            <Pressable
              onPress={() => setStatementOpen(true)}
              style={styles.footerPill}
              accessibilityLabel="הצהרת נגישות"
            >
              <Text style={styles.footerPillTxt}>📄 הצהרת נגישות</Text>
            </Pressable>
            <Pressable
              onPress={a11y.hideWidget}
              style={styles.footerPill}
              accessibilityLabel="הסתר תפריט נגישות"
            >
              <Text style={styles.footerPillTxt}>− הסתר תפריט</Text>
            </Pressable>
          </View>
          <Text style={styles.powered}>מופעל באפליקציית מעשר ישר · תקן WCAG 2.2</Text>
        </View>
      </View>

      {/* Statement modal */}
      <Modal visible={statementOpen} animationType="slide" transparent>
        <View style={[styles.docBackdrop, DIR]}>
          <View style={[styles.docCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.docHead}>
              <Text style={styles.docTitle}>הצהרת נגישות</Text>
              <Pressable onPress={() => setStatementOpen(false)} style={styles.headerBtn}>
                <Text style={[styles.headerBtnTxt, { color: A11Y.navy }]}>✕</Text>
              </Pressable>
            </View>
            <ScrollView>
              <Text style={styles.docBody}>{STATEMENT}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={shortcutsOpen} animationType="fade" transparent>
        <View style={[styles.docBackdrop, DIR]}>
          <View style={styles.docCard}>
            <View style={styles.docHead}>
              <Text style={styles.docTitle}>מקשי קיצור</Text>
              <Pressable onPress={() => setShortcutsOpen(false)} style={styles.headerBtn}>
                <Text style={[styles.headerBtnTxt, { color: A11Y.navy }]}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.docBody}>
              {`Alt + A — פתיחה / סגירה של תפריט הנגישות\nEscape — סגירת התפריט\nAlt + R — איפוס כל ההתאמות\nAlt + H — הסתרה / הצגה של כפתור הנגישות\n\nבמובייל: לחצו על כפתור הנגישות הצף. להסתרה השתמשו ב״הסתר תפריט״, ולשחזור — בפס התחתון.`}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );

  return (
    <>
      <ReadingGuideOverlay />
      <ReadingMaskOverlay />
      <PageStructureModal />

      {/* פס שחזור כשהווידג'ט מוסתר */}
      {settings.widgetHidden ? (
        <Pressable
          onPress={a11y.showWidget}
          style={[styles.restoreBar, { bottom: fabBottom }]}
          accessibilityLabel="הצג מחדש את תפריט הנגישות"
        >
          <Text style={styles.restoreTxt}>♿ הצג נגישות</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => (settings.panelOpen ? a11y.closePanel() : a11y.openPanel())}
          style={[styles.fab, { bottom: fabBottom }, a11y.active && styles.fabActive]}
          accessibilityLabel="פתח תפריט נגישות"
          accessibilityRole="button"
        >
          <Text style={styles.fabGlyph}>♿</Text>
          {a11y.active ? (
            <View style={styles.fabBadge}>
              <Text style={styles.fabBadgeTxt}>✓</Text>
            </View>
          ) : null}
        </Pressable>
      )}

      <Modal
        visible={settings.panelOpen && !settings.widgetHidden}
        animationType="slide"
        transparent
        onRequestClose={a11y.closePanel}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={a11y.closePanel} />
          {panel}
        </View>
      </Modal>
    </>
  );
}

function InfoRow({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.infoRow} accessibilityRole="button">
      <View style={styles.infoIcon}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  panelWrap: {
    width: '100%',
    maxWidth: PANEL_W,
    height: '100%',
    zIndex: 2,
  },
  panel: {
    flex: 1,
    backgroundColor: A11Y.panel,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      } as object,
      default: {
        elevation: 16,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: -4, height: 0 },
      },
    }),
  },
  header: {
    backgroundColor: A11Y.active,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnTxt: { color: '#fff', fontSize: 16, fontFamily: fonts.bold },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontFamily: fonts.extra,
    fontSize: 20,
    color: '#fff',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  headerSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconTxt: { fontSize: 20 },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 20, gap: 10 },
  section: {
    backgroundColor: A11Y.soft,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: A11Y.softBorder,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#2A2558',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionChevron: { fontSize: 14, color: A11Y.active, fontFamily: fonts.bold },
  sectionBody: { paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
  grid3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: '31%',
    flexGrow: 1,
    minWidth: 96,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 84,
  },
  tileActive: {
    backgroundColor: A11Y.active,
    borderColor: A11Y.active,
  },
  tileIcon: { fontSize: 20, color: A11Y.active, marginBottom: 6 },
  tileIconOn: { color: '#fff' },
  tileLabel: {
    fontFamily: fonts.semi,
    fontSize: 11,
    color: '#334155',
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 15,
  },
  tileLabelOn: { color: '#fff' },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 6 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  dotOn: { backgroundColor: colors.gold },
  profileCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 100,
  },
  profileCardOn: {
    backgroundColor: A11Y.active,
    borderColor: A11Y.active,
  },
  profileIcon: { fontSize: 22, marginBottom: 6, textAlign: 'right' },
  profileTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#0F172A',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 4,
    lineHeight: 15,
  },
  onTxt: { color: '#fff' },
  stepper: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepperLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#0F172A',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: A11Y.active,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnTxt: { color: '#fff', fontSize: 22, fontFamily: fonts.bold, lineHeight: 26 },
  stepValue: { flex: 1, alignItems: 'center' },
  stepValueTxt: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: A11Y.navy,
  },
  stepReset: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  segRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segBtnOn: { backgroundColor: A11Y.navy },
  segTxt: {
    fontFamily: fonts.semi,
    fontSize: 12,
    color: '#475569',
  },
  segTxtOn: { color: '#fff' },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  swatchBorder: { borderWidth: 1, borderColor: '#CBD5E1' },
  swatchOn: {
    borderWidth: 3,
    borderColor: A11Y.active,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 6,
  },
  linkBtn: { alignSelf: 'flex-end', paddingVertical: 8 },
  linkBtnTxt: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: A11Y.active,
  },
  ttsBar: {
    backgroundColor: A11Y.navy,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  ttsBarTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 14 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: A11Y.soft,
    borderWidth: 1,
    borderColor: A11Y.softBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: A11Y.navy,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  infoSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#fff',
    gap: 8,
  },
  resetBtn: {
    backgroundColor: A11Y.navy,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetTxt: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  footerRow: { flexDirection: 'row', gap: 8 },
  footerPill: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  footerPillTxt: {
    fontFamily: fonts.semi,
    fontSize: 12,
    color: '#334155',
  },
  powered: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    start: 14,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: A11Y.active,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 80,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    ...Platform.select({
          web: { boxShadow: '0 8px 24px rgba(102, 119, 240, 0.45)' } as object,
      default: {
        elevation: 10,
        shadowColor: A11Y.active,
        shadowOpacity: 0.45,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
    }),
  },
  fabActive: { backgroundColor: A11Y.headerDeep },
  fabGlyph: { fontSize: 26, color: '#fff' },
  fabBadge: {
    position: 'absolute',
    top: -2,
    end: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: A11Y.active,
  },
  fabBadgeTxt: { fontSize: 10, color: A11Y.active, fontFamily: fonts.bold },
  restoreBar: {
    position: 'absolute',
    start: 14,
    zIndex: 80,
    backgroundColor: A11Y.navy,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  restoreTxt: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  docBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  docCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: '80%',
  },
  docHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  docTitle: {
    fontFamily: fonts.extra,
    fontSize: 18,
    color: A11Y.navy,
    writingDirection: 'rtl',
  },
  docBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 24,
    color: '#334155',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
