import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  PRIVACY_LINK_LABEL,
  PRIVACY_SHORT,
  privacyPageUrl,
} from '../constants/privacy';
import { colors, fonts, spacing, type } from '../theme';
import { Banner } from './ui';

export function PrivacyNotice({ light }: { light?: boolean }) {
  const openPrivacy = () => {
    void Linking.openURL(privacyPageUrl());
  };

  return (
    <View style={styles.wrap}>
      <Banner light={light} text={PRIVACY_SHORT} tone="ok" />
      <Pressable
        onPress={openPrivacy}
        accessibilityRole="link"
        accessibilityLabel={PRIVACY_LINK_LABEL}
        style={styles.linkBtn}
      >
        <Text style={[styles.linkTxt, light && styles.linkTxtLight]}>
          {PRIVACY_LINK_LABEL} ‹
        </Text>
      </Pressable>
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
});
