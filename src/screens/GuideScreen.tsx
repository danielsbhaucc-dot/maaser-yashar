import React from 'react';
import { View, Text, StyleSheet, Linking, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { Banner, SectionHeader } from '../components/ui';
import { Glass, GlassNumber, GlassPill } from '../components/Glass';
import { Accordion } from '../components/Accordion';
import { HALACHA_GUIDE, TAX_GUIDE_STEPS } from '../constants/guides';
import { colors, fonts, spacing, type } from '../theme';

const STEP_COLORS = [
  colors.primary,
  colors.success,
  colors.gold,
  colors.accent,
  colors.danger,
  colors.income,
];

export default function GuideScreen() {
  const hero = (
    <View style={styles.hero}>
      <GlassPill gold>
        <Text style={styles.heroPillText}>✦ סעיף 46 · צעד אחר צעד</Text>
      </GlassPill>
      <Text style={styles.heroTitle}>הנחיות</Text>
      <Text style={styles.heroSub}>מפת דרכים קצרה — החזר מס ומעשר</Text>
    </View>
  );

  return (
    <Screen sheet hero={hero} scroll>
      <SectionHeader title="מפת החזר מס" />
      <View style={styles.map}>
        {TAX_GUIDE_STEPS.map((step, i) => {
          const color = STEP_COLORS[i % STEP_COLORS.length];
          const title = step.title.replace(/^\d+\.\s*/, '');
          const isLast = i === TAX_GUIDE_STEPS.length - 1;
          return (
            <View key={step.title} style={styles.mapRow}>
              <View style={styles.mapRail}>
                <GlassNumber n={i + 1} color={color} size={40} />
                {!isLast ? (
                  <View style={[styles.railLine, { backgroundColor: `${color}55` }]} />
                ) : null}
              </View>
              <Glass dark gold={i === 0} style={[styles.mapCard, { borderColor: `${color}55` }]}>
                <Text style={[styles.cardTitle, { color }]}>{title}</Text>
                <Text style={styles.cardBody}>{step.body}</Text>
              </Glass>
            </View>
          );
        })}
      </View>

      <SectionHeader title="קישורים שימושיים" />
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

      <SectionHeader title="מעשר — שאלות ותשובות" />
      <Accordion
        items={HALACHA_GUIDE.map((item, i) => ({
          id: `halacha-${i}`,
          question: item.title,
          answer: item.body,
        }))}
        style={{ marginBottom: spacing.lg }}
      />

      <Banner text="לעזרה כללית בלבד — לא פסק הלכה ולא ייעוץ מס." tone="info" />
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
    fontSize: 12,
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
  map: { marginBottom: spacing.md },
  mapRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    marginBottom: 4,
  },
  mapRail: { width: 40, alignItems: 'center' },
  railLine: {
    flex: 1,
    width: 2,
    minHeight: 18,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 1,
  },
  mapCard: {
    flex: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...type.emphasis,
    fontFamily: fonts.extra,
    fontSize: 15,
    marginBottom: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cardBody: {
    ...type.bodySm,
    color: colors.sheetMuted,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  linksCard: { marginBottom: spacing.lg, paddingVertical: 4 },
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
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  linkChevron: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.sheetMuted,
  },
});
