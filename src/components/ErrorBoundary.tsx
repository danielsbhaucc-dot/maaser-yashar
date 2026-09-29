import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { reloadAppAsync } from 'expo';
import { colors, fonts, radii, spacing } from '../theme';
import { DIR, rtlDomProps } from '../rtl';
import { exportDeviceBackupJson } from '../utils/backupExport';

type State = {
  error: Error | null;
  backingUp: boolean;
  backupMsg: string | null;
};

/** תופס קריסות ומציג מסך התאוששות — הנתונים נשארים במכשיר */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null, backingUp: false, backupMsg: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[AppError]', error);
  }

  private reload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    void reloadAppAsync('error-boundary-reload');
  };

  private downloadBackup = async () => {
    this.setState({ backingUp: true, backupMsg: null });
    try {
      await exportDeviceBackupJson();
      this.setState({ backupMsg: 'הגיבוי הורד / שותף בהצלחה' });
    } catch (e) {
      console.error('[Backup]', e);
      this.setState({ backupMsg: 'לא הצלחתי לייצא גיבוי — נסו שוב' });
    } finally {
      this.setState({ backingUp: false });
    }
  };

  render() {
    if (this.state.error) {
      return (
        <View style={[styles.wrap, DIR]} {...rtlDomProps}>
          <Text style={styles.title}>משהו השתבש</Text>
          <Text style={styles.safe}>
            הנתונים שלך בטוחים במכשיר. אפשר לרענן את האפליקציה או להוריד גיבוי.
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={this.reload}
              style={[styles.btn, styles.btnPrimary]}
              accessibilityRole="button"
              accessibilityLabel="רענון"
            >
              <Text style={styles.btnPrimaryText}>רענון</Text>
            </Pressable>
            <Pressable
              onPress={() => void this.downloadBackup()}
              disabled={this.state.backingUp}
              style={[styles.btn, styles.btnGhost, this.state.backingUp && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="הורדת גיבוי"
            >
              {this.state.backingUp ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.btnGhostText}>הורדת גיבוי</Text>
              )}
            </Pressable>
          </View>

          {this.state.backupMsg ? (
            <Text style={styles.backupMsg}>{this.state.backupMsg}</Text>
          ) : null}

          <Text style={styles.hint}>פרטי שגיאה (לדיווח):</Text>
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
    fontSize: 24,
    color: '#fff',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 10,
  },
  safe: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.inkMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 22,
    marginBottom: 20,
  },
  actions: {
    gap: 10,
    marginBottom: 16,
  },
  btn: {
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    fontFamily: fonts.semi,
    fontSize: 16,
    color: colors.primaryOn,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  btnGhostText: {
    fontFamily: fonts.semi,
    fontSize: 16,
    color: colors.ink,
  },
  backupMsg: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.success,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 12,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 8,
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
    fontSize: 13,
    color: '#FDA4AF',
    lineHeight: 18,
  },
});
