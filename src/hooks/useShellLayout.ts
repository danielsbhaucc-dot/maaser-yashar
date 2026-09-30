import { Platform, useWindowDimensions } from 'react-native';
import { shellModeForWidth, type ShellMode } from './shellLayout';

export type { ShellMode } from './shellLayout';
export { shellModeForWidth } from './shellLayout';

export type ShellLayout = {
  width: number;
  mode: ShellMode;
  /** תוויות טאב מקוצרות — רק ב־compact */
  useShortLabels: boolean;
  /** עמודת תוכן מרכזית */
  contentMaxWidth: number;
  /** מגירות / דיאלוגים */
  sheetMaxWidth: number;
  /** שדות טופס */
  inputMaxWidth: number;
  /** פאנל נועם בצד (medium sheet / wide dock) */
  chatPaneWidth: number;
  /** שני פאנלים זה לצד זה */
  sideBySide: boolean;
  isWeb: boolean;
};

export function useShellLayout(): ShellLayout {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const mode = shellModeForWidth(width, isWeb);

  if (mode === 'wide') {
    return {
      width,
      mode,
      useShortLabels: false,
      contentMaxWidth: 760,
      sheetMaxWidth: 520,
      inputMaxWidth: 560,
      chatPaneWidth: 400,
      sideBySide: true,
      isWeb,
    };
  }
  if (mode === 'medium') {
    return {
      width,
      mode,
      useShortLabels: false,
      contentMaxWidth: 720,
      sheetMaxWidth: 520,
      inputMaxWidth: 560,
      chatPaneWidth: 420,
      sideBySide: false,
      isWeb,
    };
  }
  return {
    width,
    mode,
    useShortLabels: true,
    contentMaxWidth: 480,
    sheetMaxWidth: 480,
    inputMaxWidth: 560,
    chatPaneWidth: 480,
    sideBySide: false,
    isWeb,
  };
}
