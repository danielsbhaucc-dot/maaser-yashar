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
import { NoamNudge } from '../components/NoamNudge';
import { SmartInsights } from '../components/SmartInsights';
import { colors, fonts, spacing, type } from '../theme';
import { calculateSection46, SECTION_46, getMinDonation } from '../utils/taxCalc';
import { useApp } from '../context/AppContext';
import { BOT_NAME, t } from '../utils/copy';
import { noamTaxHero } from '../utils/noamCompanion';
import {
  currentPeriod,
} from '../utils/history';
import { computeTotals, entriesForPeriod } from '../utils/ledger';
import {
  suggestTaxDonationsFromLedger,
  taxSmartInsights,
} from '../utils/smartInsights';
import type { SmartInsight } from '../utils/smartInsights';
import { useToast } from '../context/ToastContext';

const YEARS = [2026, 2025, 2024, 2023, 2022];
const TIP_COLORS = [colors.primary, colors.gold, colors.accent, colors.success];

const TAX_EXPLAIN_SHORT = `יחיד: זיכוי 35% מתרומה למוסד עם אישור 46 (בכפוף למינימום ותקרות). חברה: 30%. הזיכוי מקזז מס ששולם — בלי מס ששולם אין החזר.`;

const TAX_EXPLAIN_DETAIL = `שמרו קבלות תקינות. מ־2026 חשוב דיווח דיגיטלי של העמותה («תרומות ישראל»).
אומדן בלבד — לא ייעוץ מס.`;

export default function TaxScreen() {
  const { profile, ledger } = useApp();
  const toast = useToast();
  const name = profile.displayName || t(profile.gender, 'חבר', 'חברה');
  const [donationsTotal, setDonations] = useState(0);
  const [taxableIncome, setTaxable] = useState(0);
  const [taxPaid, setTaxPaid] = useState(0);
  const [isCompany, setIsCompany] = useState(false);
  const [taxYear, setYear] = useState(2026);
  const [knowsIncome, setKnowsIncome] = useState(true);

  const hasDonations = donationsTotal > 0;
  const missingIncome = knowsIncome && taxableIncome <= 0;
  const canShowEstimate = hasDonations && (!knowsIncome || taxableIncome > 0);

  const ledgerTzedaka = useMemo(() => {
    const month = entriesForPeriod(ledger, currentPeriod());
    return computeTotals(month, profile.rate).tzedaka;
  }, [ledger, profile.rate]);

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

  const insights = useMemo(
    () =>
      taxSmartInsights({
        name,
        gender: profile.gender,
        donationsTotal,
        taxableIncome: knowsIncome ? taxableIncome : 0,
        taxPaid,
        taxYear,
        ledgerTzedaka,
        eligible: result.eligible,
        creditAmount: result.creditAmount,
        minDonation: getMinDonation(taxYear),
      }),
    [
      name,
      profile.gender,
      donationsTotal,
      taxableIncome,
      knowsIncome,
      taxPaid,
      taxYear,
      ledgerTzedaka,
      result.eligible,
      result.creditAmount,
    ]
  );

  const onInsightAction = (item: SmartInsight) => {
    if (item.actionKind === 'tax_fill') {
      const v = suggestTaxDonationsFromLedger(ledgerTzedaka);
      setDonations(v);
      toast.success('מילוי חכם ✦', `תרומות: ${v.toLocaleString('he-IL')} ₪ מהפנקס`);
    }
  };

  const hero = (
    <>
      <GlassPill gold>
        <Text style={styles.badgeText}>✦ {BOT_NAME} על סעיף 46</Text>
      </GlassPill>
      <Text style={styles.heroTitle}>החזר מס</Text>
      <Text style={styles.heroSub}>{noamTaxHero(name, profile.gender)}</Text>
    </>
  );

  return (
    <Screen sheet hero={hero} scroll contentStyle={{ paddingTop: spacing.lg }}>
      <Banner
        light
        text="הסכומים נשמרים במכשיר בלבד — לא נשלחים לשרת"
        tone="ok"
      />
      <NoamNudge
        text={t(
          profile.gender,
          'תזין תרומות והכנסה חייבת — ואני אעזור לך להבין את האומדן. זה לא ייעוץ מס.',
          'תזיני תרומות והכנסה חייבת — ואני אעזור לך להבין את האומדן. זה לא ייעוץ מס.'
        )}
      />
      <SmartInsights items={insights} onAction={onInsightAction} />
      <Accordion
        items={[
          {
            id: 'section46',
            question: 'סעיף 46 בקצרה',
            answer: `${TAX_EXPLAIN_SHORT}\n\n${TAX_EXPLAIN_DETAIL}`,
          },
        ]}
        style={{ marginBottom: spacing.lg }}
      />

      <View style={styles.block}>
        {!canShowEstimate ? (
          <Glass light gold style={styles.missingGlass}>
            <Text style={styles.missingTitle}>חסר נתון</Text>
            <Text style={styles.missingText}>
              {!hasDonations
                ? 'הזינו סה״כ תרומות כדי לראות אומדן זיכוי — בלי זה לא מציגים 0 מטעה.'
                : 'הזינו הכנסה חייבת, או בחרו «לא בטוח» אם אין לכם את המספר.'}
            </Text>
          </Glass>
        ) : result.eligible ? (
          <>
            {taxPaid <= 0 ? (
              <Glass light gold style={styles.missingGlass}>
                <Text style={styles.missingTitle}>חסר נתון</Text>
                <Text style={styles.missingText}>
                  הזינו מס ששולם — בלי זה האומדן עלול להיות גבוה מדי (הזיכוי לא עובר את המס ששילמתם).
                </Text>
              </Glass>
            ) : null}
            <StatHero
              label="זיכוי משוער"
              value={formatMoney(effectiveCredit)}
              hint={`עלות אחרי זיכוי: ${formatMoney(Math.max(0, donationsTotal - effectiveCredit))}${
                taxPaid <= 0 ? ' · אומדן בלי תקרת מס ששולם' : ''
              }`}
            />
          </>
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
        <View style={{ marginTop: spacing.lg }}>
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
          <View style={{ marginTop: spacing.md }}>
            <MoneyField label="הכנסה חייבת" value={taxableIncome} onChange={setTaxable} />
            {missingIncome ? (
              <Text style={styles.fieldWarn}>חסר נתון — בלי הכנסה חייבת האומדן מוסתר</Text>
            ) : null}
          </View>
        ) : null}
        <View style={{ marginTop: spacing.md }}>
          <MoneyField
            label="מס ששולם (מומלץ)"
            value={taxPaid}
            onChange={setTaxPaid}
            hint="הזיכוי לא עובר את המס ששילמתם — בלי מס ששולם האומדן עלול להיות גבוה מדי"
          />
        </View>
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

      <Banner
        light
        text={`${BOT_NAME}: אומדן בלבד — אינו ייעוץ מס. לשאלות מורכבות פנו לרו״ח.`}
        tone="warn"
      />
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
  block: { marginTop: spacing.md, marginBottom: spacing.lg },
  infoGlass: { padding: spacing.lg, marginBottom: spacing.md },
  infoText: { ...type.bodySm, color: colors.sheetMuted },
  infoEm: { fontFamily: fonts.bold, color: colors.goldDeep },
  missingGlass: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderColor: colors.glassGoldBorder,
  },
  missingTitle: {
    fontFamily: fonts.extra,
    fontSize: 16,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 8,
    writingDirection: 'rtl',
  },
  missingText: {
    ...type.bodySm,
    color: colors.sheetMuted,
    textAlign: 'center',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  fieldWarn: {
    ...type.caption,
    color: colors.danger,
    marginTop: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  card: { padding: spacing.lg, marginBottom: spacing.xl },
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
    marginBottom: spacing.lg,
  },
  tipCard: { flex: 1, padding: spacing.lg, borderRadius: 22 },
  tipText: {
    ...type.bodySm,
    fontFamily: fonts.medium,
    color: colors.sheetInk,
    lineHeight: 22,
    textAlign: 'center',
  },
  metaCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
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
