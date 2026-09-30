import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Linking, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { Banner, SectionHeader } from '../components/ui';
import { Glass, GlassNumber, GlassPill } from '../components/Glass';
import { Accordion } from '../components/Accordion';
import { SettingsFold } from '../components/SettingsFold';
import { TableOfContents } from '../components/TableOfContents';
import { RabbiReviewNote } from '../components/RabbiReviewNote';
import { SmartInsights } from '../components/SmartInsights';
import { HALACHA_GUIDE, TAX_GUIDE_STEPS } from '../constants/guides';
import { colors, fonts, spacing, type } from '../theme';
import { useApp } from '../context/AppContext';
import { BOT_NAME, t } from '../utils/copy';
import { noamGuideHero } from '../utils/noamCompanion';
import { currentPeriod } from '../utils/history';
import { resolvePeriodTotals } from '../utils/totalsAdvanced';
import { guideSmartInsights } from '../utils/smartInsights';

const TOC_ITEMS = [
  { id: 'tax-map', label: 'מפת החזר מס' },
  { id: 'links', label: 'קישורים שימושיים' },
  { id: 'halacha', label: 'מעשר — שאלות ותשובות' },
] as const;

export default function GuideScreen() {
  const { profile, ledger } = useApp();
  const name = profile.displayName || t(profile.gender, 'חבר', 'חברה');
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [halachaOpenId, setHalachaOpenId] = useState<string | null>(null);
  const [stepOpenId, setStepOpenId] = useState<string | null>(null);

  const remaining = useMemo(() => {
    return resolvePeriodTotals(
      ledger,
      currentPeriod(),
      profile,
      !!profile.carryForwardSurplus
    ).remaining;
  }, [ledger, profile]);
  const insights = useMemo(
    () => guideSmartInsights({ name, gender: profile.gender, profile, remaining }),
    [name, profile, remaining]
  );

  const selectSection = (id: string) => {
    setSectionId((cur) => {
      const next = cur === id ? null : id;
      if (next !== 'halacha') setHalachaOpenId(null);
      if (next !== 'tax-map') setStepOpenId(null);
      return next;
    });
  };

  const hero = (
    <View style={styles.hero}>
      <GlassPill gold>
        <Text style={styles.heroPillText}>✦ {BOT_NAME} · מפת דרכים</Text>
      </GlassPill>
      <Text style={styles.heroTitle}>הנחיות</Text>
      <Text style={styles.heroSub}>{noamGuideHero(name, profile.gender)}</Text>
    </View>
  );

  return (
    <Screen sheet hero={hero} scroll>
      <SmartInsights items={insights} />

      <TableOfContents
        items={[...TOC_ITEMS]}
        activeId={sectionId}
        onSelect={selectSection}
      />

      <SettingsFold
        title="מפת החזר מס"
        hint={`${TAX_GUIDE_STEPS.length} צעדים · לחצו לפתיחה`}
        open={sectionId === 'tax-map'}
        onOpenChange={(open) => {
          setSectionId(open ? 'tax-map' : null);
          if (!open) setStepOpenId(null);
        }}
      >
        <SectionHeader title="צעדים" />
        <Accordion
          items={TAX_GUIDE_STEPS.map((step, i) => ({
            id: `step-${i}`,
            question: step.title.replace(/^\d+\.\s*/, ''),
            answer: step.body,
          }))}
          openId={stepOpenId}
          onOpenChange={setStepOpenId}
          style={{ marginBottom: spacing.sm }}
        />
      </SettingsFold>

      <SettingsFold
        title="קישורים שימושיים"
        hint="רשות המסים · כל זכות"
        open={sectionId === 'links'}
        onOpenChange={(open) => setSectionId(open ? 'links' : null)}
      >
        <Glass dark style={styles.linksCard}>
          <LinkRow
            n={1}
            color={colors.primary}
            label="בדיקת אישור סעיף 46"
            url="https://www.misim.gov.il/gmishur46/frmFirstPage.aspx"
          />
          <LinkRow
            n={2}
            color={colors.gold}
            label="כל זכות — זיכוי על תרומה"
            url="https://www.kolzchut.org.il/he/%D7%96%D7%99%D7%9B%D7%95%D7%99_%D7%9E%D7%9E%D7%A1_%D7%94%D7%9B%D7%A0%D7%A1%D7%94_%D7%91%D7%A9%D7%9C_%D7%AA%D7%A8%D7%95%D7%9E%D7%94_(%D7%A1%D7%A2%D7%99%D7%A3_46)"
          />
          <LinkRow
            n={3}
            color={colors.accent}
            label="רשות המסים"
            url="https://www.gov.il/he/departments/israel_tax_authority"
            last
          />
        </Glass>
      </SettingsFold>

      <SettingsFold
        title="מעשר — שאלות ותשובות"
        hint={`${HALACHA_GUIDE.length} שאלות · הכול סגור`}
        open={sectionId === 'halacha'}
        onOpenChange={(open) => {
          setSectionId(open ? 'halacha' : null);
          if (!open) setHalachaOpenId(null);
        }}
      >
        <RabbiReviewNote />
        <Accordion
          items={HALACHA_GUIDE.map((item, i) => ({
            id: `halacha-${i}`,
            question: item.title,
            answer: item.body,
            sources: item.sources,
          }))}
          openId={halachaOpenId}
          onOpenChange={setHalachaOpenId}
          style={{ marginBottom: spacing.sm }}
        />
      </SettingsFold>

      <Banner
        text={`${BOT_NAME}: לעזרה כללית בלבד — לא פסק הלכה ולא ייעוץ מס.`}
        tone="info"
      />
    </Screen>
  );
}

function LinkRow({
  n,
  color,
  label,
  url,
  last,
}: {
  n: number;
  color: string;
  label: string;
  url: string;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={[styles.link, !last && styles.linkBorder]}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <GlassNumber n={n} color={color} size={28} />
      <Text style={styles.linkText}>{label}</Text>
      <Text style={styles.linkChevron}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', width: '100%' },
  heroPillText: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.gold,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  heroTitle: {
    ...type.h1,
    color: colors.ink,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  heroSub: {
    ...type.bodySm,
    color: colors.inkSoft,
    marginTop: 4,
    textAlign: 'center',
  },
  linksCard: { marginBottom: spacing.sm, paddingVertical: 4 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  linkBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.sheetBorder,
  },
  linkText: {
    ...type.emphasis,
    fontSize: 14,
    color: colors.sheetInk,
    flex: 1,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  linkChevron: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.sheetMuted,
  },
});
