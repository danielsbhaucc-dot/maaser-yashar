import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, fonts, spacing } from '../theme';

type State = { error: Error | null };

/** מציג את השגיאה האמיתית במקום מסך כחול גנרי */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[AppError]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>אופס — משהו נשבר 😅</Text>
          <Text style={styles.hint}>העתק את הטקסט האדום ושלח לי:</Text>
          <ScrollView style={styles.box}>
            <Text style={styles.msg} selectable>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    paddingTop: 64,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: '#fff',
    textAlign: 'left',
    writingDirection: 'rtl',
    marginBottom: 8,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'left',
    writingDirection: 'rtl',
    marginBottom: 12,
  },
  box: {
    flex: 1,
    backgroundColor: 'rgba(251,113,133,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.35)',
    padding: 12,
  },
  msg: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#FDA4AF',
    lineHeight: 18,
  },
});
