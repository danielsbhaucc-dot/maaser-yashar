import React, { useCallback, useId, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { colors, fonts, radii, spacing, type } from '../theme';
import { DIR, rtlDomProps } from '../rtl';
import { dialogDomProps, useDialogFocus } from '../hooks/useDialogFocus';
import { useShellLayout } from '../hooks/useShellLayout';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

/**
 * חלון אישור ממורכז עם רקע מעומעם — למחיקות ופעולות הרסניות.
 * תומך Esc, מלכודת פוקוס והחזרת פוקוס ב־web; מוכרז כ־dialog.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'מחק',
  cancelLabel = 'ביטול',
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<View>(null);
  const busy = useRef(false);
  const reactId = useId().replace(/:/g, '');
  const dialogId = `maaser-confirm-${reactId}`;
  const shell = useShellLayout();
  const dialogMax = shell.mode === 'compact' ? 480 : shell.sheetMaxWidth;

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  useDialogFocus({ open: visible, onClose: handleCancel, dialogId });

  const handleConfirm = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await onConfirm();
    } finally {
      busy.current = false;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={[styles.root, DIR]} {...rtlDomProps}>
        <Pressable
          style={styles.backdrop}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="סגור"
        />
        <View
          nativeID={dialogId}
          {...dialogDomProps}
          style={[styles.dialog, { maxWidth: dialogMax }]}
          accessibilityRole="summary"
          accessibilityViewIsModal
          accessibilityLabel={title}
        >
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              ref={cancelRef}
              style={[styles.btn, styles.btnCancel]}
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={styles.btnCancelTxt}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.btnConfirm,
                destructive ? styles.btnDanger : styles.btnPrimary,
              ]}
              onPress={() => void handleConfirm()}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              <Text style={styles.btnConfirmTxt}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sheetSolidAlpha,
    padding: spacing.lg,
    gap: 10,
    zIndex: 2,
    ...Platform.select({
      web: { boxShadow: '0 20px 48px rgba(0,0,0,0.45)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 16,
      },
    }),
  },
  title: {
    ...type.h3,
    color: colors.ink,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  message: {
    ...type.bodySm,
    color: colors.inkMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  btnCancel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  btnCancelTxt: {
    fontFamily: fonts.semi,
    fontSize: 15,
    color: colors.inkMuted,
  },
  btnConfirm: {},
  btnDanger: {
    backgroundColor: 'rgba(220, 80, 100, 0.88)',
    borderColor: 'rgba(255,160,170,0.45)',
  },
  btnPrimary: {
    backgroundColor: 'rgba(139, 155, 255, 0.85)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  btnConfirmTxt: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
  },
});
