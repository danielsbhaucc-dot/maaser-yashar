import { useFonts } from 'expo-font';

const NATIVE_FONTS = {
  Heebo_400Regular: require('../assets/fonts/Heebo_400Regular.ttf'),
  Heebo_600SemiBold: require('../assets/fonts/Heebo_600SemiBold.ttf'),
  Heebo_700Bold: require('../assets/fonts/Heebo_700Bold.ttf'),
  Rubik_700Bold: require('../assets/fonts/Rubik_700Bold.ttf'),
} as const;

/** Native: טוען TTF דרך expo-font לפני רינדור האפליקציה */
export function useAppFonts(): [boolean, Error | null] {
  return useFonts(NATIVE_FONTS);
}
