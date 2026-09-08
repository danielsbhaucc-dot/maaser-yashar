import { useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { A11yContext } from '../accessibility/AccessibilityContext';

/** האם מערכת ההפעלה מבקשת הפחתת תנועה */
export function useSystemReduceMotion(): boolean {
  const [system, setSystem] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setSystem(!!v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      setSystem(!!v);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return system;
}

/**
 * true = מותר להריץ אנימציות.
 * מכבד: הגדרות נגישות (עצור אנימציות / הפחתת תנועה) + מערכת.
 * עובד גם מחוץ ל־AccessibilityProvider (טעינת פונטים).
 */
export function useMotionEnabled(): boolean {
  const system = useSystemReduceMotion();
  const a11y = useContext(A11yContext);
  const settings = a11y?.settings;

  if (system) return false;
  if (settings?.stopAnimations || settings?.reduceMotion) return false;
  return true;
}
