import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  Linking,
  LayoutAnimation,
  UIManager,
  Animated,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useA11y } from './AccessibilityContext';
import {
  A11Y_PROFILES,
  COLOR_SWATCHES,
  LEVEL_LABELS,
  SPEECH_RATE_LABELS,
  TEXT_ALIGN_OPTIONS,
} from './profiles';
import type { ContrastMode, SaturationMode } from './types';
import { colors, fonts, radii, shadow } from '../theme';
import { DIR } from '../rtl';
import { fontScale, listActiveChips, smartTips } from './effects';
import {
  PageStructureModal,
  ReadingGuideOverlay,
  ReadingMaskOverlay,
  ClickToSpeakOverlay,
  ScreenReaderHintsOverlay,
} from './Overlays';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PANEL_W = 380;

const animConfig = {
  duration: 280,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

/** אייקון נגישות גיאומטרי — בלי אימוג'י */
function A11yMark({ size = 22, color = colors.ink }: { size?: number; color?: string }) {
  const arm = size * 0.22;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: size,
          backgroundColor: color,
          marginBottom: size * 0.06,
        }}
      />
      <View
        style={{
          width: size * 0.55,
          height: size * 0.12,
          borderRadius: 4,
          backgroundColor: color,
          marginBottom: size * 0.04,
        }}
      />
      <View style={{ flexDirection: 'row', gap: arm * 0.35, alignItems: 'flex-end' }}>
        <View
          style={{
            width: size * 0.12,
            height: size * 0.32,
            borderRadius: 3,
            backgroundColor: color,
            transform: [{ rotate: '-12deg' }],
          }}
        />
        <View
          style={{
            width: size * 0.12,
            height: size * 0.32,
            borderRadius: 3,
            backgroundColor: color,
            transform: [{ rotate: '12deg' }],
          }}
        />
      </View>
    </View>
  );
}

function GlassCard({
  children,
  style,
  gold,
}: {
  children: React.ReactNode;
  style?: object;
  gold?: boolean;
}) {
  return (
    <View
      style={[
        styles.glassCard,
        gold && styles.glassCardGold,
        style,
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            } as object)
          : null,
      ]}
    >
      {Platform.OS !== 'web' ? (
        <BlurView
          intensity={36}
          tint="systemChromeMaterialDark"
          style={[StyleSheet.absoluteFill, { borderRadius: radii.lg }]}
        />
      ) : null}
      <View style={styles.glassShine} pointerEvents="none" />
      <View style={styles.glassInner}>{children}</View>
    </View>
  );
}

type TileProps = {
  label: string;
  icon: string;
  active?: boolean;
  onPress: () => void;
  hint?: string;
  dots?: number;
  level?: number;
};

function Tile({ label, icon, active, onPress, hint, dots, level }: TileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [
        styles.tile,
        active && styles.tileActive,
        pressed && styles.tilePressed,
      ]}
    >
      <View style={[styles.tileIconWrap, active && styles.tileIconWrapOn]}>
        <Text style={[styles.tileIcon, active && styles.tileIconOn]}>{icon}</Text>
      </View>
      <Text style={[styles.tileLabel, active && styles.tileLabelOn]} numberOfLines={2}>
        {label}
      </Text>
      {hint ? (
        <Text style={[styles.tileHint, active && styles.tileHintOn]} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
      {typeof dots === 'number' && dots > 0 ? (
        <View style={styles.dotsRow}>
          {Array.from({ length: dots }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, (level ?? 0) > i ? styles.dotOn : null]}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function AccordionSection({
  id,
  title,
  subtitle,
  glyph,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  glyph: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  const rot = useRef(new Animated.Value(open ? 1 : 0)).current;
  const { settings } = useA11y();
  const motionOk = !settings.stopAnimations && !settings.reduceMotion;

  useEffect(() => {
    if (!motionOk) {
      rot.setValue(open ? 1 : 0);
      return;
    }
    Animated.timing(rot, {
      toValue: open ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, rot, motionOk]);

  const spin = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <GlassCard style={styles.sectionCard}>
      <Pressable
        onPress={() => onToggle(id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}. ${open ? 'סגור' : 'פתח'}`}
        style={({ pressed }) => [styles.sectionHead, pressed && { opacity: 0.85 }]}
      >
        <Animated.View style={[styles.chevronWrap, { transform: [{ rotate: spin }] }]}>
          <Text style={styles.chevronGlyph}>⌃</Text>
        </Animated.View>
        <View style={styles.sectionHeadText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSub}>{subtitle}</Text>
        </View>
        <View style={styles.sectionGlyphWrap}>
          <Text style={styles.sectionGlyph}>{glyph}</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.sectionBody}>
          <View style={styles.sectionDivider} />
          {children}
        </View>
      ) : null}
    </GlassCard>
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
      <View style={styles.stepperTop}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <View style={styles.levelPills}>
          {LEVEL_LABELS.map((_, i) => (
            <View key={i} style={[styles.levelPip, i <= value && styles.levelPipOn]} />
          ))}
        </View>
      </View>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={onDec}
          accessibilityLabel={`הקטן ${label}`}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
        >
          <Text style={styles.stepBtnTxt}>−</Text>
        </Pressable>
        <Pressable
          onPress={onReset}
          style={styles.stepValue}
          accessibilityLabel={`איפוס ${label}`}
        >
          <Text style={styles.stepValueTxt}>{LEVEL_LABELS[value] ?? 'רגיל'}</Text>
          <Text style={styles.stepReset}>הקש לאיפוס</Text>
        </Pressable>
        <Pressable
          onPress={onInc}
          accessibilityLabel={`הגדל ${label}`}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
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
    <View style={styles.segRow} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.segBtn, on && styles.segBtnOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <Text style={[styles.segTxt, on && styles.segTxtOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InfoRow({
  glyph,
  title,
  sub,
  onPress,
}: {
  glyph: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.infoRow, pressed && { opacity: 0.88 }]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
    >
      <Text style={styles.infoChevron}>‹</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoSub}>{sub}</Text>
      </View>
      <View style={styles.infoIcon}>
        <Text style={styles.infoIconTxt}>{glyph}</Text>
      </View>
    </Pressable>
  );
}

const STATEMENT = `הצהרת נגישות — מעשר ישר

אפליקציית מעשר ישר מחויבת להנגשה לפי תקן ישראלי ת״י 5568 ו־WCAG 2.2 ברמת AA ככל האפשר.

מה כלול בתוסף הנגישות:
• פרופילי נגישות מוכנים (ראייה, מוטוריקה, דיסלקציה, קשב, אפילפסיה ועוד)
• התאמות ניגודיות, רוויה וצבעים מותאמים
• שליטה מדויקת בגודל טקסט וריווחים
• הדגשת קישורים, כותרות, פוקוס ואלמנטים
• מדריך קריאה, מסכת מיקוד ומבנה עמוד
• עצירת אנימציות והפחתת תנועה
• סמן מוגדל, כפתורים גדולים וניווט מקלדת
• קריאת טקסט (TTS) בעברית
• הסתרה ושחזור של תפריט הנגישות

קיצורי מקלדת (Web):
• Alt + A — פתיחה / סגירה
• Escape — סגירה
• Alt + R — איפוס
• Alt + H — הסתרה / הצגה

עודכן: ספטמבר 2026`;

export function AccessibilityWidget() {
  const a11y = useA11y();
  const { settings } = a11y;
  const insets = useSafeAreaInsets();
  const [openId, setOpenId] = useState<string | null>('profiles');
  const [colorTarget, setColorTarget] = useState<'bg' | 'text' | 'headings'>('bg');
  const [statementOpen, setStatementOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [metricTab, setMetricTab] = useState<
    'fontSize' | 'lineHeight' | 'letterSpacing' | 'wordSpacing'
  >('fontSize');

  const toggleSec = (id: string) => {
    if (!settings.stopAnimations && !settings.reduceMotion) {
      LayoutAnimation.configureNext(animConfig);
    }
    setOpenId((cur) => (cur === id ? null : id));
  };

  const bump = (
    key: 'fontSize' | 'lineHeight' | 'letterSpacing' | 'wordSpacing' | 'zoomLevel',
    delta: number
  ) => {
    const cur = settings[key] as number;
    a11y.setSetting(key, Math.max(0, Math.min(4, cur + delta)));
  };

  const colorKey =
    colorTarget === 'bg' ? 'colorBg' : colorTarget === 'text' ? 'colorText' : 'colorHeadings';

  useEffect(() => {
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

  const fabBottom =
    (Platform.OS === 'ios' ? 22 : 12) + 64 + Math.max(insets.bottom - 8, 0) + 10;
  const activeCount = [
    settings.contrast !== 'off',
    settings.saturation !== 'off',
    settings.highlightLinks,
    settings.highlightHeadings,
    settings.highlightFocus,
    settings.highlightElements,
    settings.fontSize > 0,
    settings.lineHeight > 0,
    settings.letterSpacing > 0,
    settings.wordSpacing > 0,
    settings.readableFont,
    settings.dyslexiaFont,
    settings.readingGuide,
    settings.readingMask,
    settings.readingMode,
    settings.stopAnimations,
    settings.reduceMotion,
    settings.largeButtons,
    settings.hideImages,
    settings.bigCursor !== 'off',
    settings.keyboardNav,
    settings.textToSpeech,
    settings.muteMedia,
    settings.zoomLevel > 0,
    !!settings.colorBg,
    !!settings.colorText,
    !!settings.colorHeadings,
    settings.profile !== 'none',
  ].filter(Boolean).length;

  const contrastTiles: { id: ContrastMode; label: string; icon: string; hint: string }[] = [
    { id: 'high', label: 'ניגודיות גבוהה', icon: '◐', hint: 'חיזוק ניגודיות' },
    { id: 'invert', label: 'היפוך צבעים', icon: '◑', hint: 'החלפת בהיר/כהה' },
    { id: 'dark', label: 'מצב כהה', icon: '☾', hint: 'רקע כהה' },
    { id: 'light', label: 'מצב בהיר', icon: '☀', hint: 'רקע בהיר' },
    { id: 'blackYellow', label: 'שחור־צהוב', icon: '▣', hint: 'ניגודיות קיצונית' },
    { id: 'sepia', label: 'ספיה', icon: '◉', hint: 'גוון חם' },
  ];

  const satTiles: { id: SaturationMode; label: string; icon: string; hint: string }[] = [
    { id: 'grayscale', label: 'גווני אפור', icon: '○', hint: 'ללא צבע' },
    { id: 'mono', label: 'מונוכרום', icon: '◎', hint: 'חד־גוני' },
    { id: 'low', label: 'רוויה נמוכה', icon: '◌', hint: 'הפחתת צבע' },
    { id: 'high', label: 'רוויה גבוהה', icon: '●', hint: 'הגברת צבע' },
  ];

  const metricLabel: Record<typeof metricTab, string> = {
    fontSize: 'גודל טקסט',
    lineHeight: 'ריווח שורות',
    letterSpacing: 'ריווח אותיות',
    wordSpacing: 'ריווח מילים',
  };

  const panel = (
    <View
      nativeID="maaser-a11y-root"
      style={[styles.panelWrap, DIR, { paddingTop: insets.top + 6 }]}
      accessibilityViewIsModal
    >
      <View style={styles.panel}>
        {Platform.OS !== 'web' ? (
          <BlurView
            intensity={55}
            tint="systemChromeMaterialDark"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <LinearGradient
          colors={['rgba(42, 37, 88, 0.92)', 'rgba(11, 16, 32, 0.96)', 'rgba(22, 19, 56, 0.98)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Header */}
        <LinearGradient
          colors={[colors.primaryDark, colors.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable
            onPress={a11y.closePanel}
            accessibilityLabel="סגור תפריט נגישות"
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.headerBtnTxt}>✕</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>נגישות</Text>
            <Text style={styles.headerSub}>
              {activeCount > 0
                ? `${activeCount} התאמות פעילות · נשמרות במכשיר`
                : 'התאמות אישיות · נשמרות במכשיר'}
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <A11yMark size={20} color={colors.ink} />
          </View>
        </LinearGradient>

        {/* Quick bar */}
        <View style={styles.quickBar}>
          <Pressable
            onPress={a11y.resetAll}
            style={styles.quickPill}
            accessibilityLabel="איפוס הגדרות"
          >
            <Text style={styles.quickPillTxt}>↺ איפוס</Text>
          </Pressable>
          <Pressable
            onPress={() => setStatementOpen(true)}
            style={styles.quickPill}
            accessibilityLabel="הצהרת נגישות"
          >
            <Text style={styles.quickPillTxt}>▤ הצהרה</Text>
          </Pressable>
          <Pressable
            onPress={a11y.closePanel}
            style={styles.quickPill}
            accessibilityLabel="סגור תפריט נגישות"
          >
            <Text style={styles.quickPillTxt}>× סגור</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AccordionSection
            id="profiles"
            title="פרופילי נגישות"
            subtitle="הגדרות מוכנות לפי צורך"
            glyph="✦"
            open={openId === 'profiles'}
            onToggle={toggleSec}
          >
            <View style={styles.grid2}>
              {A11Y_PROFILES.map((p) => {
                const on = settings.profile === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => a11y.setProfile(on ? 'none' : p.id)}
                    style={[styles.profileCard, on && styles.profileCardOn]}
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${p.title}. ${p.subtitle}`}
                  >
                    <View style={[styles.profileIconWrap, on && styles.profileIconWrapOn]}>
                      <Text style={[styles.profileIcon, on && { color: colors.primaryOn }]}>
                        {p.icon}
                      </Text>
                    </View>
                    <Text style={[styles.profileTitle, on && styles.onTxt]}>{p.title}</Text>
                    <Text style={[styles.profileSub, on && styles.onTxtSoft]} numberOfLines={2}>
                      {p.subtitle}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </AccordionSection>

          <AccordionSection
            id="visual"
            title="מראה, צבעים וניגודיות"
            subtitle="ניגודיות, רוויה והדגשות"
            glyph="◐"
            open={openId === 'visual'}
            onToggle={toggleSec}
          >
            <Text style={styles.groupLabel}>מצבי ניגודיות</Text>
            <View style={styles.grid3}>
              {contrastTiles.map((t) => (
                <Tile
                  key={t.id}
                  label={t.label}
                  icon={t.icon}
                  hint={t.hint}
                  active={settings.contrast === t.id}
                  onPress={() =>
                    a11y.setSetting('contrast', settings.contrast === t.id ? 'off' : t.id)
                  }
                />
              ))}
            </View>
            <Text style={[styles.groupLabel, { marginTop: 10 }]}>רוויית צבע</Text>
            <View style={styles.grid3}>
              {satTiles.map((t) => (
                <Tile
                  key={t.id}
                  label={t.label}
                  icon={t.icon}
                  hint={t.hint}
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
                hint="מסגרת ברורה"
                active={settings.highlightLinks}
                onPress={() => a11y.toggle('highlightLinks')}
              />
              <Tile
                label="הדגשת כותרות"
                icon="H"
                hint="סימון H1–H6"
                active={settings.highlightHeadings}
                onPress={() => a11y.toggle('highlightHeadings')}
              />
            </View>
          </AccordionSection>

          <AccordionSection
            id="content"
            title="טקסט, קריאה ועיצוב תוכן"
            subtitle="גודל, ריווח ומצבי קריאה"
            glyph="Aa"
            open={openId === 'content'}
            onToggle={toggleSec}
          >
            <Segmented
              value={metricTab}
              onChange={(id) => setMetricTab(id as typeof metricTab)}
              options={[
                { id: 'fontSize', label: 'גודל' },
                { id: 'lineHeight', label: 'שורות' },
                { id: 'letterSpacing', label: 'אותיות' },
                { id: 'wordSpacing', label: 'מילים' },
              ]}
            />
            <View style={{ height: 8 }} />
            <Stepper
              label={metricLabel[metricTab]}
              value={settings[metricTab]}
              onDec={() => bump(metricTab, -1)}
              onInc={() => bump(metricTab, 1)}
              onReset={() => a11y.setSetting(metricTab, 0)}
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
                hint="סנס־סריף פשוט"
                active={settings.readableFont}
                onPress={() => a11y.toggle('readableFont')}
              />
              <Tile
                label="פונט דיסלקציה"
                icon="A↔"
                hint="ריווח מוגבר"
                active={settings.dyslexiaFont}
                onPress={() => a11y.toggle('dyslexiaFont')}
              />
              <Tile
                label="מצב קריאה"
                icon="☰"
                hint="מיקוד תוכן"
                active={settings.readingMode}
                onPress={() => a11y.toggle('readingMode')}
              />
              <Tile
                label="מדריך קריאה"
                icon="═"
                hint="קו עוקב"
                active={settings.readingGuide}
                onPress={() => a11y.toggle('readingGuide')}
              />
              <Tile
                label="מיקוד קריאה"
                icon="▣"
                hint="מסכה סביב השורה"
                active={settings.readingMask}
                onPress={() => a11y.toggle('readingMask')}
              />
              <Tile
                label="קורא טקסט"
                icon="♪"
                hint="הקראה בעברית"
                active={settings.textToSpeech}
                onPress={() => {
                  const next = !settings.textToSpeech;
                  a11y.setSetting('textToSpeech', next);
                  if (next) {
                    a11y.speak('קורא הטקסט הופעל');
                  } else a11y.stopSpeak();
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
                <LinearGradient
                  colors={[...colors.primaryGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ttsGrad}
                >
                  <Text style={styles.ttsBarTxt}>▶  הקרא הודעת בדיקה</Text>
                </LinearGradient>
              </Pressable>
            ) : null}
          </AccordionSection>

          <AccordionSection
            id="nav"
            title="ניווט, סמן ותנועה"
            subtitle="מקלדת, סמן, אנימציות ומדיה"
            glyph="↗"
            open={openId === 'nav'}
            onToggle={toggleSec}
          >
            <View style={styles.grid3}>
              <Tile
                label="הדגשת פוקוס"
                icon="◎"
                hint="מסגרת ספיר"
                active={settings.highlightFocus}
                onPress={() => a11y.toggle('highlightFocus')}
              />
              <Tile
                label="הדגש אלמנטים"
                icon="✎"
                hint="כפתורים ושדות"
                active={settings.highlightElements}
                onPress={() => a11y.toggle('highlightElements')}
              />
              <Tile
                label="מבנה העמוד"
                icon="▤"
                hint="רשימת כותרות"
                active={settings.pageStructure}
                onPress={() => a11y.toggle('pageStructure')}
              />
              <Tile
                label="סמן גדול"
                icon="↖"
                hint="מצביע מוגדל"
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
                hint="ניגודיות גבוהה"
                active={
                  settings.bigCursor === 'largeDark' || settings.bigCursor === 'black'
                }
                onPress={() => {
                  const on =
                    settings.bigCursor === 'largeDark' || settings.bigCursor === 'black';
                  a11y.setSetting('bigCursor', on ? 'off' : 'largeDark');
                }}
              />
              <Tile
                label="סמן בהיר"
                icon="◇"
                hint="מצביע בהיר"
                active={
                  settings.bigCursor === 'largeLight' || settings.bigCursor === 'white'
                }
                onPress={() => {
                  const on =
                    settings.bigCursor === 'largeLight' || settings.bigCursor === 'white';
                  a11y.setSetting('bigCursor', on ? 'off' : 'largeLight');
                }}
              />
              <Tile
                label="הפחתת תנועה"
                icon="〰"
                hint="פחות תזוזה"
                active={settings.reduceMotion}
                onPress={() => a11y.toggle('reduceMotion')}
              />
              <Tile
                label="כיבוי אנימציות"
                icon="⏸"
                hint="טעינה ומעברים"
                active={settings.stopAnimations}
                onPress={() => a11y.toggle('stopAnimations')}
              />
              <Tile
                label="השתק מדיה"
                icon="⊘"
                hint="וידאו ואודיו"
                active={settings.muteMedia}
                onPress={() => a11y.toggle('muteMedia')}
              />
              <Tile
                label="הסתר תמונות"
                icon="▢"
                hint="פחות עומס חזותי"
                active={settings.hideImages}
                onPress={() => a11y.toggle('hideImages')}
              />
              <Tile
                label="כפתורים גדולים"
                icon="⬚"
                hint="יעדי מגע 48px"
                active={settings.largeButtons}
                onPress={() => a11y.toggle('largeButtons')}
                dots={2}
                level={settings.largeButtons ? 2 : 0}
              />
              <Tile
                label="ניווט מקלדת"
                icon="⌨"
                hint="פוקוס מודגש"
                active={settings.keyboardNav}
                onPress={() => a11y.toggle('keyboardNav')}
              />
              <Tile
                label="רמזי קורא מסך"
                icon="♬"
                hint="תיאורים מורחבים"
                active={settings.screenReaderHints}
                onPress={() => a11y.toggle('screenReaderHints')}
              />
            </View>
          </AccordionSection>

          <AccordionSection
            id="colors"
            title="התאמת צבעים"
            subtitle="צביעה נפרדת לרקע, כותרות ותוכן"
            glyph="◈"
            open={openId === 'colors'}
            onToggle={toggleSec}
          >
            <Text style={styles.hint}>בחרו שכבה, ואז גוון מהפלטה</Text>
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
                      active && styles.swatchOn,
                    ]}
                    accessibilityLabel={`צבע ${c}`}
                  />
                );
              })}
            </View>
            <Pressable
              onPress={() =>
                a11y.patch({ colorBg: null, colorText: null, colorHeadings: null })
              }
              style={styles.linkBtn}
              accessibilityLabel="איפוס צבעים"
            >
              <Text style={styles.linkBtnTxt}>↺  איפוס צבעים</Text>
            </Pressable>
          </AccordionSection>

          <AccordionSection
            id="info"
            title="מידע ועזרה"
            subtitle="הצהרה, קיצורים ודיווח"
            glyph="ℹ"
            open={openId === 'info'}
            onToggle={toggleSec}
          >
            <InfoRow
              glyph="▤"
              title="הצהרת נגישות"
              sub="מידע על הנגשת האפליקציה והתקן"
              onPress={() => setStatementOpen(true)}
            />
            <InfoRow
              glyph="⌨"
              title="ניווט מקלדת"
              sub="מדריך מקשי קיצור מלא"
              onPress={() => setShortcutsOpen(true)}
            />
            <InfoRow
              glyph="⚠"
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
              glyph="☺"
              title="מורשה נגישות"
              sub="פרטי יצירת קשר"
              onPress={() => setStatementOpen(true)}
            />
          </AccordionSection>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={a11y.resetAll}
            style={styles.resetBtn}
            accessibilityLabel="איפוס כל ההתאמות"
          >
            <LinearGradient
              colors={['#1A2038', '#12182C']}
              style={styles.resetGrad}
            >
              <Text style={styles.resetTxt}>↺  איפוס כל ההתאמות</Text>
            </LinearGradient>
          </Pressable>
          <View style={styles.footerRow}>
            <Pressable
              onPress={() => setStatementOpen(true)}
              style={styles.footerPill}
              accessibilityLabel="הצהרת נגישות"
            >
              <Text style={styles.footerPillTxt}>▤  הצהרת נגישות</Text>
            </Pressable>
            <Pressable
              onPress={a11y.hideWidget}
              style={styles.footerPill}
              accessibilityLabel="הסתר תפריט נגישות"
            >
              <Text style={styles.footerPillTxt}>−  הסתר תפריט</Text>
            </Pressable>
          </View>
          <Text style={styles.powered}>מעשר ישר · זכוכית כהה · WCAG 2.2</Text>
        </View>
      </View>

      <DocModal
        visible={statementOpen}
        title="הצהרת נגישות"
        body={STATEMENT}
        onClose={() => setStatementOpen(false)}
        bottomInset={insets.bottom}
      />
      <DocModal
        visible={shortcutsOpen}
        title="מקשי קיצור"
        body={`Alt + A — פתיחה / סגירה של תפריט הנגישות\nEscape — סגירת התפריט\nAlt + R — איפוס כל ההתאמות\nAlt + H — הסתרה / הצגה של כפתור הנגישות\n\nבמובייל: כפתור הנגישות הצף. להסתרה — «הסתר תפריט», לשחזור — פס התחתון או הגדרות.`}
        onClose={() => setShortcutsOpen(false)}
        bottomInset={insets.bottom}
      />
    </View>
  );

  return (
    <>
      <ReadingGuideOverlay />
      <ReadingMaskOverlay />
      <PageStructureModal />

      {settings.widgetHidden ? null : (
        <Pressable
          onPress={() => (settings.panelOpen ? a11y.closePanel() : a11y.openPanel())}
          style={[styles.fab, { bottom: fabBottom }, a11y.active && styles.fabActive]}
          accessibilityLabel="פתח תפריט נגישות"
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[...colors.primaryGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGrad}
          >
            <A11yMark size={24} color={colors.ink} />
          </LinearGradient>
          {a11y.active ? (
            <View style={styles.fabBadge}>
              <Text style={styles.fabBadgeTxt}>✓</Text>
            </View>
          ) : null}
        </Pressable>
      )}

      <Modal
        visible={settings.panelOpen}
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

function DocModal({
  visible,
  title,
  body,
  onClose,
  bottomInset,
}: {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
  bottomInset: number;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.docBackdrop, DIR]}>
        <View style={[styles.docCard, { paddingBottom: bottomInset + 16 }]}>
          <LinearGradient
            colors={['rgba(42,37,88,0.98)', 'rgba(18,24,44,0.99)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.docHead}>
            <Text style={styles.docTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.headerBtn} accessibilityLabel="סגור">
              <Text style={styles.headerBtnTxt}>✕</Text>
            </Pressable>
          </View>
          <ScrollView>
            <Text style={styles.docBody}>{body}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    backgroundColor: colors.overlay,
  },
  panelWrap: {
    width: '100%',
    maxWidth: PANEL_W,
    height: '100%',
    zIndex: 2,
  },
  panel: {
    flex: 1,
    overflow: 'hidden',
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.bg,
    ...Platform.select({
      web: { boxShadow: '0 16px 48px rgba(0,0,0,0.45)' } as object,
      default: { ...shadow.card },
    }),
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnTxt: { color: colors.ink, fontSize: 15, fontFamily: fonts.bold },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  headerSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'left',
    writingDirection: 'rtl',
    marginTop: 3,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  quickPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  quickPillTxt: {
    fontFamily: fonts.semi,
    fontSize: 11,
    color: colors.inkMuted,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 22, gap: 12 },
  glassCard: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassDark,
  },
  glassCardGold: {
    borderColor: colors.glassGoldBorder,
  },
  glassShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  glassInner: { position: 'relative' },
  sectionCard: {},
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(139,155,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronGlyph: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
    marginTop: 2,
  },
  sectionHeadText: { flex: 1 },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  sectionSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.inkSoft,
    textAlign: 'left',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  sectionGlyphWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionGlyph: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.gold,
  },
  sectionBody: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 8,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  groupLabel: {
    fontFamily: fonts.semi,
    fontSize: 11,
    color: colors.gold,
    textAlign: 'left',
    writingDirection: 'rtl',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minHeight: 96,
  },
  tileActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  tilePressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  tileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(139,155,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(139,155,255,0.2)',
  },
  tileIconWrapOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tileIcon: { fontSize: 15, color: colors.primary, fontFamily: fonts.bold },
  tileIconOn: { color: colors.primaryOn },
  tileLabel: {
    fontFamily: fonts.semi,
    fontSize: 11,
    color: colors.inkMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 15,
  },
  tileLabelOn: { color: colors.ink },
  tileHint: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 2,
  },
  tileHintOn: { color: 'rgba(255,255,255,0.65)' },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 6 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotOn: { backgroundColor: colors.gold },
  profileCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minHeight: 108,
  },
  profileCardOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  profileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(240,198,116,0.12)',
    borderWidth: 1,
    borderColor: colors.glassGoldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'flex-end',
  },
  profileIconWrapOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  profileIcon: { fontSize: 14, color: colors.gold, fontFamily: fonts.bold },
  profileTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  profileSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.inkSoft,
    textAlign: 'left',
    writingDirection: 'rtl',
    marginTop: 4,
    lineHeight: 15,
  },
  onTxt: { color: colors.ink },
  onTxtSoft: { color: 'rgba(255,255,255,0.72)' },
  stepper: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  stepperTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  stepperLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    textAlign: 'left',
    writingDirection: 'rtl',
    flex: 1,
  },
  levelPills: { flexDirection: 'row', gap: 3 },
  levelPip: {
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  levelPipOn: { backgroundColor: colors.primary },
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
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: 'rgba(139,155,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: { opacity: 0.8 },
  stepBtnTxt: {
    color: colors.ink,
    fontSize: 22,
    fontFamily: fonts.bold,
    lineHeight: 26,
  },
  stepValue: { flex: 1, alignItems: 'center' },
  stepValueTxt: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
  },
  stepReset: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 2,
  },
  segRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segBtnOn: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  segTxt: {
    fontFamily: fonts.semi,
    fontSize: 11,
    color: colors.inkSoft,
  },
  segTxtOn: { color: colors.ink },
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  swatchOn: {
    borderWidth: 3,
    borderColor: colors.gold,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'left',
    writingDirection: 'rtl',
    marginBottom: 6,
  },
  linkBtn: { alignSelf: 'flex-end', paddingVertical: 8 },
  linkBtnTxt: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.primary,
  },
  ttsBar: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  ttsGrad: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ttsBarTxt: { color: colors.primaryOn, fontFamily: fonts.bold, fontSize: 14 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(139,155,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconTxt: { fontSize: 15, color: colors.primary, fontFamily: fonts.bold },
  infoTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  infoSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'left',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  infoChevron: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.inkSoft,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    backgroundColor: 'rgba(11,16,32,0.72)',
    gap: 8,
  },
  resetBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  resetGrad: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetTxt: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  footerRow: { flexDirection: 'row', gap: 8 },
  footerPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  footerPillTxt: {
    fontFamily: fonts.semi,
    fontSize: 12,
    color: colors.inkMuted,
  },
  powered: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    start: 14,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    zIndex: 80,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(102, 119, 240, 0.45)' } as object,
      default: { ...shadow.fab },
    }),
  },
  fabGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabActive: { borderColor: colors.gold },
  fabBadge: {
    position: 'absolute',
    top: -2,
    end: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.bg,
  },
  fabBadgeTxt: { fontSize: 10, color: colors.primaryOn, fontFamily: fonts.bold },
  restoreBar: {
    position: 'absolute',
    start: 14,
    zIndex: 80,
    backgroundColor: colors.surfaceSolid,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glassGoldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restoreTxt: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  docBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  docCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: '80%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.sheet,
  },
  docHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  docTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: 18,
    color: colors.ink,
    writingDirection: 'rtl',
  },
  docBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 24,
    color: colors.inkMuted,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
});
