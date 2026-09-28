import { Platform } from 'react-native';

/** ב־web אין native driver — מונע אזהרות בקונסול */
export const NATIVE_DRIVER = Platform.OS !== 'web';
