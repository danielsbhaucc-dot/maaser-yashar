import React, { createContext, useCallback, useContext } from 'react';

export type TabKey = 'Home' | 'History' | 'Tax' | 'Guide' | 'Settings';

type TabNavCtx = {
  goToTab: (key: TabKey) => void;
};

const Ctx = createContext<TabNavCtx | null>(null);

export function TabNavProvider({
  children,
  goToIndex,
  tabKeys,
}: {
  children: React.ReactNode;
  goToIndex: (i: number) => void;
  tabKeys: readonly TabKey[];
}) {
  const goToTab = useCallback(
    (key: TabKey) => {
      const i = tabKeys.indexOf(key);
      if (i >= 0) goToIndex(i);
    },
    [goToIndex, tabKeys]
  );

  return <Ctx.Provider value={{ goToTab }}>{children}</Ctx.Provider>;
}

export function useTabNav(): TabNavCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      goToTab: () => {
        /* אין ניווט מחוץ ל־SwipeTabs */
      },
    };
  }
  return ctx;
}
