import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type NoamChatCtx = {
  open: boolean;
  openChat: () => void;
  closeChat: () => void;
};

const Ctx = createContext<NoamChatCtx | null>(null);

export function NoamChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openChat = useCallback(() => setOpen(true), []);
  const closeChat = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ open, openChat, closeChat }),
    [open, openChat, closeChat]
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
    };
  }
  return ctx;
}
