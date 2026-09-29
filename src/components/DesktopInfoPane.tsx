import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';
import { DIR, rtlDomProps } from '../rtl';
import { ABOUT_LINK_LABEL, aboutPageUrl } from '../constants/about';
import { PRIVACY_LINK_LABEL, privacyPageUrl } from '../constants/privacy';

/** פאנל מידע בפאנל המשני בדסקטופ רחב — כשהצ׳אט סגור */
export function DesktopInfoPane() {
  return (
    <View style={[styles.root, DIR]} {...rtlDomProps} accessibilityRole="summary">
      <Text style={styles.title}>מה זה?</Text>
      <Text style={styles.body}>
        מעשר ישר — פנקס אישי למעשר וצדקה. חישוב פשוט של כמה נותר לתת החודש.
      </Text>
      <Text style={styles.title}>הנתונים נשמרים אצלך</Text>
      <Text style={styles.body}>
        הפנקס נשמר במכשיר/בדפדפן שלך בלבד. בלי הרשמה ובלי ענן שלנו.
      </Text>
      <Pressable
        onPress={() => void Linking.openURL(privacyPageUrl())}
        accessibilityRole="link"
        accessibilityLabel={PRIVACY_LINK_LABEL}
        style={styles.linkBtn}
      >
        <Text style={styles.link}>{PRIVACY_LINK_LABEL}</Text>
      </Pressable>
      <Pressable
        onPress={() => void Linking.openURL(aboutPageUrl())}
        accessibilityRole="link"
        accessibilityLabel={ABOUT_LINK_LABEL}
        style={styles.linkBtn}
      >
        <Text style={styles.link}>{ABOUT_LINK_LABEL}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: spacing.lg,
    gap: 10,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(14,18,34,0.72)',
  },
  title: {
    fontFamily: fonts.semi,
    fontSize: 16,
    color: colors.gold,
    writingDirection: 'rtl',
    textAlign: 'start',
    marginTop: 6,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  linkBtn: {
    minHeight: 44,
    justifyContent: 'center',
  },
  link: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: colors.primary,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
});
