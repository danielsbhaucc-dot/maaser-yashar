/**
 * «החשבון המרכזי» בהגדרות (מודולים 'account' + 'account-ui' מספריית חברת האם, @core/account-kit, תבנית MAASER_ACCOUNT).
 * מוצג רק כששני המתגים דלוקים בלוח והשרת מוגדר. כרגע 'account-ui' כבוי — לכן הרכיב מחזיר null ואין כפתור.
 * להצגה: לוח הבקרה → מעשר ישר → «ניהול מודולים» → «חשבון מרכזי — כפתור כניסה גלוי» → פעיל. בלי פריסה.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAccountUi } from '../parent/accountUi';
import { fonts } from '../theme';

export function ParentAccountSection() {
  const a = useAccountUi();
  if (!a) return null;
  const primary = a.action === 'signIn';
  const label = primary ? `${a.actionLabel} לחשבון המרכזי` : `${a.actionLabel} מהחשבון המרכזי`;
  return (
    <View
      testID="parent-account"
      accessibilityRole="summary"
      style={{ backgroundColor: a.colors.surface, borderRadius: a.radius, padding: 18, gap: 10, marginBottom: 16 }}
    >
      <Text accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 16, color: a.colors.text, textAlign: 'right', writingDirection: 'rtl' }}>{a.title}</Text>
      <Text style={{ fontSize: 13, color: a.colors.muted, textAlign: 'right', writingDirection: 'rtl' }}>{a.sub}</Text>
      <Text style={{ fontSize: 15, color: a.signedIn ? a.colors.text : a.colors.muted, textAlign: 'right', writingDirection: 'rtl' }}>{a.line}</Text>
      {a.error ? (
        <Text accessibilityRole="alert" style={{ fontSize: 14, color: a.colors.text, textAlign: 'right', writingDirection: 'rtl' }}>{a.error}</Text>
      ) : null}
      {a.action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          aria-label={label}
          testID="parent-account-action"
          onPress={a.run}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            minHeight: 44,
            paddingHorizontal: 24,
            justifyContent: 'center',
            borderRadius: a.radius,
            backgroundColor: primary ? a.colors.accent : 'transparent',
            borderWidth: primary ? 0 : 1,
            borderColor: a.colors.accent,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: primary ? a.colors.onAccent : a.colors.accent }}>{a.actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
