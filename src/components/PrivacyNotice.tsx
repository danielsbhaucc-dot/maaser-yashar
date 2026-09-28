import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PRIVACY_DETAIL_SECTIONS,
  PRIVACY_LINK_LABEL,
  PRIVACY_SHORT,
} from '../constants/privacy';
import { colors, fonts, radii, spacing, type } from '../theme';
import { Banner } from './ui';
import { GlassCloseButton } from './Glass';

export function PrivacyNotice({ light }: { light?: boolean }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.wrap}>
      <Banner light={light} text={PRIVACY_SHORT} tone="ok" />
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="link"
        accessibilityLabel={PRIVACY_LINK_LABEL}
        style={styles.linkBtn}
      >
        <Text style={[styles.linkTxt, light && styles.linkTxtLight]}>
          {PRIVACY_LINK_LABEL} ‹
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            styles.sheet,
            { paddingTop: Math.max(insets.top, spacing.md) },
          ]}
        >
          <View style={styles.sheetHeader}>
            <GlassCloseButton onPress={() => setOpen(false)} />
            <Text style={styles.sheetTitle}>פרטיות</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.sheetBody,
              { paddingBottom: Math.max(insets.bottom, spacing.xl) },
            ]}
          >
            <Text style={styles.lead}>{PRIVACY_SHORT}</Text>
            {PRIVACY_DETAIL_SECTIONS.map((section) => (
              <View key={section.title} style={styles.block}>
                <Text style={styles.blockTitle}>{section.title}</Text>
                <Text style={styles.blockBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  linkBtn: {
    alignSelf: 'center',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  linkTxt: {
    ...type.caption,
    fontFamily: fonts.semi,
    color: colors.gold,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  linkTxtLight: {
    color: colors.primary,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    ...type.h2,
    color: colors.ink,
    textAlign: 'center',
  },
  headerSpacer: { width: 38, height: 38 },
  sheetBody: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  lead: {
    ...type.body,
    fontFamily: fonts.medium,
    color: colors.ink,
    textAlign: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.success}55`,
  },
  block: {
    gap: 6,
  },
  blockTitle: {
    ...type.bodySm,
    fontFamily: fonts.bold,
    color: colors.gold,
    textAlign: 'center',
  },
  blockBody: {
    ...type.bodySm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
});
