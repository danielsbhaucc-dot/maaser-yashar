import 'react-native-gesture-handler';
/** לפני App — מפעיל forceRTL ב־native מהכניסה לאפליקציה */
import './src/rtlBootstrap';
import 'expo-localization';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
