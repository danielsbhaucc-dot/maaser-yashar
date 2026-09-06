import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../components/Screen';
import {
  Banner,
  Chip,
  MoneyField,
  SectionHeader,
  SegmentedRow,
  StatHero,
  formatMoney,
} from '../components/ui';
import { Glass, GlassNumber, GlassPill } from '../components/Glass';
import { Accordion } from '../components/Accordion';
import { colors, fonts, spacing, type } from '../theme';
import { calculateSection46, SECTION_46 } from '../utils/taxCalc';

const YEARS = [2026, 2025, 2024, 2023, 2022];
const TIP_COLORS = [colors.primary, colors.gold, colors.accent, colors.success];

const TAX_EXPLAIN = `יחיד זכאי לזיכוי של 35% מסכום התרומה למוסד עם אישור סעיף 46 (בכפוף למינימום ולתקרות).
חברה — 30%. הזיכוי מקזז מס ששולם.
שמרו קבלות תקינות. מ־2026 חשוב דיווח דיגיטלי של העמותה.`;

export default function TaxScreen() {
  const [donationsTotal, setDonations] = useState(0);
  const [taxableIncome, setTaxable] = useState(0);
  const [taxPaid, setTaxPaid] = useState(0);
  const [isCompany, setIsCompany] = useState(false);
  const [taxYear, setYear] = useState(2026);
  const [knowsIncome, setKnowsIncome] = useState(true);

  const result = useMemo(
    () =>
      calculateSection46({
        donationsTotal,
        taxableIncome: knowsIncome ? taxableIncome : 0,
        isCompany,
        taxYear,
        taxAlreadyPaid: taxPaid,
      }),
    [donationsTotal, taxableIncome, knowsIncome, isCompany, taxYear, taxPaid]
  );

  const effectiveCredit =
    taxPaid > 0 ? Math.min(result.creditAmount, taxPaid) : result.creditAmount;

  const hero = (
    <>
      <GlassPill gold>
        <Text style={styles.badgeText}>✦ זיכוי מס על צדקה</Text>
      </GlassPill>
      <Text style={styles.heroTitle}>החזר מס</Text>
      <Text style={styles.heroSub}>סעיף 46 — כמה המדינה מחזירה על התרומות</Text>
    </>
  );

  return (
    <Screen sheet hero={hero} scroll contentStyle={{ paddingTop: spacing.lg }}>
      <Accordion
        items={[
          {
            id: 'section46',
            question: 'הסבר על סעיף 46',
            answer: TAX_EXPLAIN,
          },
        ]}
        style={{ marginBottom: spacing.md }}
      />

      <View style={styles.block}>
        {result.eligible ? (
          <StatHero
            label="זיכוי משוער"
            value={formatMoney(effectiveCredit)}
            hint={`עלות אחרי זיכוי: ${formatMoney(Math.max(0, donationsTotal - effectiveCredit))}`}
          />
        ) : (
          <Glass light gold style={styles.infoGlass}>
            <Text style={styles.infoText}>
              נדרשות לפחות{' '}
              <Text style={styles.infoEm}>{result.minDonation} ₪</Text> תרומות למוסד עם אישור 46.
            </Text>
          </Glass>
        )}
      </View>

      <SectionHeader title="פרטים" light />
      <Glass light strong style={styles.card}>
        <SegmentedRow>
          <Chip fill label="יחיד" selected={!isCompany} onPress={() => setIsCompany(false)} />
          <Chip fill label="חברה" selected={isCompany} onPress={() => setIsCompany(true)} />
        </SegmentedRow>
        <Text style={styles.label}>שנת מס</Text>
        <View style={styles.yearRow}>
          {YEARS.map((y) => (
            <Chip key={y} label={String(y)} selected={taxYear === y} onPress={() => setYear(y)} />
          ))}
        </View>
      </Glass>

      <SectionHeader title="סכומים" light />
      <Glass light strong gold style={styles.card}>
        <MoneyField label="סה״כ תרומות" value={donationsTotal} onChange={setDonations} />
        <View style={{ marginTop: spacing.md }}>
          <SegmentedRow>
          <Chip
            fill
            label="יודע הכנסה חייבת"
            selected={knowsIncome}
            onPress={() => setKnowsIncome(true)}
          />
          <Chip
            fill
            label="לא בטוח"
            selected={!knowsIncome}
            onPress={() => setKnowsIncome(false)}
          />
          </SegmentedRow>
        </View>
        {knowsIncome ? (
          <MoneyField label="הכנסה חייבת" value={taxableIncome} onChange={setTaxable} />
        ) : null}
        <MoneyField
          label="מס ששולם (אופציונלי)"
          value={taxPaid}
          onChange={setTaxPaid}
          hint="הזיכוי לא עובר את המס ששילמתם"
        />
      </Glass>

      <SectionHeader title="טיפים חשובים" light />
      {result.tips.slice(0, 3).map((tip, i) => {
        const color = TIP_COLORS[i % TIP_COLORS.length];
        return (
          <View key={i} style={styles.tipRow}>
            <GlassNumber n={i + 1} color={color} />
            <Glass light style={[styles.tipCard, { borderColor: `${color}44` }]}>
              <Text style={styles.tipText}>{tip}</Text>
            </Glass>
          </View>
        );
      })}

      <Glass light style={styles.metaCard}>
        <Text style={styles.meta}>
          מינימום <Text style={styles.metaEm}>{formatMoney(result.minDonation)}</Text>
          {' · '}
          תקרה <Text style={styles.metaEm}>{formatMoney(result.absoluteCap)}</Text>
          {' · '}
          רטרו עד <Text style={styles.metaEm}>{SECTION_46.retroactiveYears} שנים</Text>
        </Text>
      </Glass>

      <Banner light text="אומדן בלבד — אינו ייעוץ מס." tone="warn" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  badgeText: {
    fontFamily: fonts.semi,
    fontSize: 12,
    color: colors.gold,
    writingDirection: 'rtl',
  },
  heroTitle: { ...type.h1, color: '#fff', marginTop: spacing.sm },
  heroSub: { ...type.bodySm, color: colors.inkSoft, marginTop: 4 },
  block: { marginTop: spacing.sm, marginBottom: spacing.sm },
  infoGlass: { padding: spacing.md, marginBottom: spacing.md },
  infoText: { ...type.bodySm, color: colors.sheetMuted },
  infoEm: { fontFamily: fonts.bold, color: colors.goldDeep },
  card: { padding: spacing.md, marginBottom: spacing.lg },
  yearRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  label: {
    ...type.caption,
    fontFamily: fonts.bold,
    color: colors.goldDeep,
    marginBottom: 8,
    marginTop: 14,
    textAlign: 'center',
    width: '100%',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md,
  },
  tipCard: { flex: 1, padding: spacing.md, borderRadius: 22 },
  tipText: {
    ...type.bodySm,
    fontFamily: fonts.medium,
    color: colors.sheetInk,
    lineHeight: 22,
    textAlign: 'center',
  },
  metaCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderColor: colors.glassGoldBorder,
  },
  meta: {
    ...type.bodySm,
    color: colors.sheetMuted,
    textAlign: 'center',
  },
  metaEm: {
    fontFamily: fonts.bold,
    color: colors.goldDeep,
  },
});
