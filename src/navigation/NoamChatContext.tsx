import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';

/** מפתח ישן — נשמר לתאימות לאחור; המקור החדש הוא profile.noamPulseSeen */
const OPENED_KEY = 'noam_chat_opened_once_v1';

type NoamChatCtx = {
  open: boolean;
  openChat: () => void;
  closeChat: () => void;
  /** אחרי פתיחה ראשונה — הבועה מפסיקה לפעום */
  hasOpenedOnce: boolean;
  /** אלמנט שפתח את הצ׳אט — להחזרת פוקוס */
  openerRef: React.MutableRefObject<HTMLElement | null>;
};

const Ctx = createContext<NoamChatCtx | null>(null);

export function NoamChatProvider({ children }: { children: React.ReactNode }) {
  const { profile, patchProfile, ready } = useApp();
  const [open, setOpen] = useState(false);
  const [legacyOpened, setLegacyOpened] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(OPENED_KEY).then((v) => {
      if (v === '1') setLegacyOpened(true);
    });
  }, []);

  const hasOpenedOnce =
    !!profile.noamPulseSeen || legacyOpened;

  const openChat = useCallback(() => {
    if (typeof document !== 'undefined') {
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
    setOpen(true);
    if (!profile.noamPulseSeen) {
      void patchProfile({ noamPulseSeen: true });
    }
    if (!legacyOpened) {
      setLegacyOpened(true);
      void AsyncStorage.setItem(OPENED_KEY, '1');
    }
  }, [legacyOpened, patchProfile, profile.noamPulseSeen]);

  const closeChat = useCallback(() => {
    setOpen(false);
    const el = openerRef.current;
    if (el && typeof el.focus === 'function') {
      requestAnimationFrame(() => {
        try {
          el.focus({ preventScroll: true });
        } catch {
          // ignore
        }
      });
    }
  }, []);

  const value = useMemo(
    () => ({
      open,
      openChat,
      closeChat,
      hasOpenedOnce: ready ? hasOpenedOnce : true,
      openerRef,
    }),
    [open, openChat, closeChat, hasOpenedOnce, ready]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNoamChat(): NoamChatCtx {
  const ctx = useContext(Ctx);
  const fallbackOpener = useRef<HTMLElement | null>(null);
  if (!ctx) {
    return {
      open: false,
      openChat: () => {},
      closeChat: () => {},
      hasOpenedOnce: true,
      openerRef: fallbackOpener,
    };
  }
  return ctx;
}
