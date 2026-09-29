import 'react-native-gesture-handler';
/** לפני App — מפעיל forceRTL ב־native מהכניסה לאפליקציה */
import './src/rtlBootstrap';
import 'expo-localization';
/** מפעיל פיצול חבילות ב־web לפי dynamic import() (T-52 / Expo Metro) */
import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
