import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { Screen } from '../components/Screen';
import {
  Banner,
  Chip,
  PrimaryButton,
  SegmentedRow,
} from '../components/ui';
import { Glass, GlassPill } from '../components/Glass';
import { Accordion } from '../components/Accordion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useA11y } from '../accessibility';
import { BOT_NAME, type Gender, t } from '../utils/copy';
import { EXPLAIN } from '../utils/chatScript';
import { noamSettingsHero } from '../utils/noamCompanion';
import { NoamNudge } from '../components/NoamNudge';
import { SmartInsights } from '../components/SmartInsights';
import { settingsSmartInsights } from '../utils/smartInsights';
import { colors, fonts, radii, spacing, type } from '../theme';
import type { MaaserRate } from '../types';

function FieldLabel({ children }: { children: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      <View style={styles.fieldAccent} />
      <Text style={styles.fieldLabel}>{children}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { profile, patchProfile } = useApp();
  const toast = useToast();
  const { openPanel, showWidget } = useA11y();
  const [saved, setSaved] = React.useState(false);
  const initial = (profile.displayName?.trim()?.[0] || 'מ').toUpperCase();
  const ratePct = Math.round(profile.rate * 100);
  const name = profile.displayName || t(profile.gender, 'חבר', 'חברה');
  const insights = React.useMemo(
    () => settingsSmartInsights({ name, gender: profile.gender, profile }),
    [name, profile]
  );

  const hero = (
    <>
      <GlassPill gold>
        <Text style={styles.badgeText}>✦ הפרופיל שלך עם {BOT_NAME}</Text>
      </GlassPill>
      <View style={styles.avatarWrap}>
        <Glass dark gold style={styles.avatar}>
          <View style={styles.avatarInner}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
        </Glass>
      </View>
      <Text style={styles.heroTitle}>הגדרות</Text>
      <Text style={styles.heroSub}>{noamSettingsHero(name, profile.gender)}</Text>
    </>
  );

  return (
    <Screen sheet hero={hero} scroll contentStyle={{ paddingTop: spacing.lg }}>
      <NoamNudge
        text={t(
          profile.gender,
          `שלום ${name}. כל שינוי כאן משפיע על איך אני מדבר איתך ועל חישוב המעשר.`,
          `שלום ${name}. כל שינוי כאן משפיע על איך אני מדבר איתך ועל חישוב המעשר.`
        )}
      />
      <SmartInsights items={insights} />
      <Glass light strong style={styles.panel}>
        <FieldLabel>שם</FieldLabel>
        <TextInput
          style={styles.input}
          value={profile.displayName}
          onChangeText={(txt) => patchProfile({ displayName: txt })}
          textAlign="center"
          placeholderTextColor={colors.sheetMuted}
          placeholder="השם שלך"
          accessibilityLabel="שם לתצוגה"
        />

        <View style={styles.divider} />

        <FieldLabel>מגדר</FieldLabel>
        <SegmentedRow>
          <Chip
            fill
            label="זכר"
            selected={profile.gender === 'male'}
            onPress={() => patchProfile({ gender: 'male' as Gender })}
          />
          <Chip
            fill
            label="נקבה"
            selected={profile.gender === 'female'}
            onPress={() => patchProfile({ gender: 'female' as Gender })}
          />
        </SegmentedRow>

        <View style={styles.divider} />

        <FieldLabel>מצב משפחתי</FieldLabel>
        <SegmentedRow>
          <Chip
            fill
            label={t(profile.gender, 'רווק', 'רווקה')}
            selected={profile.maritalStatus === 'single'}
            onPress={() => patchProfile({ maritalStatus: 'single', includeSpouse: false })}
          />
          <Chip
            fill
            label={t(profile.gender, 'נשוי', 'נשואה')}
            selected={profile.maritalStatus === 'married'}
            onPress={() => patchProfile({ maritalStatus: 'married' })}
          />
        </SegmentedRow>
        {profile.maritalStatus === 'married' ? (
          <View style={styles.nestedSeg}>
            <SegmentedRow>
              <Chip
                fill
                label="חישוב ביחד"
                selected={profile.includeSpouse}
                onPress={() => patchProfile({ includeSpouse: true })}
              />
              <Chip
                fill
                label="רק שלי"
                selected={!profile.includeSpouse}
                onPress={() => patchProfile({ includeSpouse: false })}
              />
            </SegmentedRow>
          </View>
        ) : null}
      </Glass>

      <Glass light gold strong style={styles.ratePanel}>
        <FieldLabel>שיעור נתינה</FieldLabel>
        <Text style={styles.rateHero}>{ratePct}%</Text>
        <Text style={styles.rateCaption}>
          {profile.rate === 0.1 ? 'מעשר — אחד מעשרה' : 'חומש — אחד מחמישה'}
        </Text>
        <SegmentedRow>
          <Chip
            fill
            label="מעשר 10%"
            selected={profile.rate === 0.1}
            onPress={() => patchProfile({ rate: 0.1 as MaaserRate })}
          />
          <Chip
            fill
            label="חומש 20%"
            selected={profile.rate === 0.2}
            onPress={() => patchProfile({ rate: 0.2 as MaaserRate })}
          />
        </SegmentedRow>
        <View style={styles.explainRow}>
          <Accordion
            items={[
              {
                id: 'rate',
                question: 'הסבר על 10% / 20%',
                answer: EXPLAIN.rate,
              },
              {
                id: 'net',
                question: 'למה מחשבים מהנטו?',
                answer: EXPLAIN.net,
              },
            ]}
          />
        </View>
      </Glass>

      <Banner light text={`${BOT_NAME} תמיד מחשב מהנטו — פחות כאב ראש`} tone="ok" />

      <PrimaryButton
        label="תפריט נגישות ✦"
        onPress={() => {
          showWidget();
          openPanel();
        }}
      />

      <PrimaryButton
        label={saved ? 'נשמר ✓' : 'שמור הגדרות'}
        onPress={() => {
          setSaved(true);
          toast.success('ההגדרות נשמרו ✦');
          setTimeout(() => setSaved(false), 1400);
        }}
      />

      <Pressable
        style={styles.resetWrap}
        onPress={() =>
          toast.confirm({
            title: 'להתחיל מחדש עם נועם?',
            message: 'תעברו שוב את ההיכרות',
            destructive: false,
            confirmLabel: 'יאללה',
            cancelLabel: 'ביטול',
            onConfirm: async () => {
              await patchProfile({ onboardingDone: false });
              setSaved(false);
              toast.info('חוזרים להיכרות…');
            },
          })
        }
        accessibilityRole="button"
        accessibilityLabel="התחל מחדש את ההיכרות"
      >
        <Text style={styles.reset}>
          {t(
            profile.gender,
            'רוצה להכיר את נועם מחדש? לחץ כאן',
            'רוצה להכיר את נועם מחדש? לחצי כאן'
          )}
        </Text>
      </Pressable>
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
  avatarWrap: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarInner: {
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.extra,
    fontSize: 30,
    color: colors.gold,
    textAlign: 'center',
    lineHeight: 36,
  },
  heroTitle: {
    ...type.h1,
    color: '#fff',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  heroSub: {
    ...type.bodySm,
    color: colors.inkSoft,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  panel: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radii.xxl,
  },
  ratePanel: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    borderRadius: radii.xxl,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  fieldAccent: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  fieldLabel: {
    ...type.eyebrow,
    color: colors.gold,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.semi,
    fontSize: 17,
    color: colors.sheetInk,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    writingDirection: 'rtl',
    textAlign: 'center',
    width: '100%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: spacing.lg,
    width: '100%',
  },
  nestedSeg: {
    marginTop: 10,
    width: '100%',
  },
  rateHero: {
    ...type.moneyHero,
    fontSize: 48,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 2,
  },
  rateCaption: {
    ...type.bodySm,
    color: colors.sheetMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  explainRow: {
    width: '100%',
    marginTop: 4,
    alignItems: 'center',
  },
  resetWrap: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.sheetBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reset: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
