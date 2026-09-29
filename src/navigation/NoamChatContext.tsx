import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OPENED_KEY = 'noam_chat_opened_once_v1';

type NoamChatCtx = {
  open: boolean;
  openChat: () => void;
  closeChat: () => void;
  /** אחרי פתיחה ראשונה — הבועה מפסיקה לפעום */
  hasOpenedOnce: boolean;
};

const Ctx = createContext<NoamChatCtx | null>(null);

export function NoamChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(OPENED_KEY).then((v) => {
      if (v === '1') setHasOpenedOnce(true);
    });
  }, []);

  const openChat = useCallback(() => {
    setOpen(true);
    setHasOpenedOnce((prev) => {
      if (!prev) void AsyncStorage.setItem(OPENED_KEY, '1');
      return true;
    });
  }, []);

  const closeChat = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openChat, closeChat, hasOpenedOnce }),
    [open, openChat, closeChat, hasOpenedOnce]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNoamChat(): NoamChatCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      open: false,
      openChat: () => {},
      closeChat: () => {},
      hasOpenedOnce: true,
    };
  }
  return ctx;
}
