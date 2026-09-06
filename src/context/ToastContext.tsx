import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GlassToastHost, type ToastItem, type ToastTone } from '../components/GlassToast';

type ShowOpts = {
  title: string;
  message?: string;
  tone?: ToastTone;
  duration?: number;
};

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

type ToastApi = {
  show: (opts: ShowOpts) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warn: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  confirm: (opts: ConfirmOpts) => void;
};

const Ctx = createContext<ToastApi | null>(null);

let idSeq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (opts: ShowOpts) => {
      const id = `t-${++idSeq}`;
      const tone = opts.tone ?? 'info';
      const duration = opts.duration ?? (tone === 'error' ? 4200 : 3200);
      setItems((prev) => [
        ...prev.filter((x) => x.kind !== 'confirm').slice(-2),
        { id, kind: 'toast', title: opts.title, message: opts.message, tone },
      ]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const confirm = useCallback((opts: ConfirmOpts) => {
    const id = `c-${++idSeq}`;
    setItems((prev) => [
      ...prev.filter((x) => x.kind !== 'confirm'),
      {
        id,
        kind: 'confirm',
        title: opts.title,
        message: opts.message,
        tone: opts.destructive ? 'error' : 'warn',
        confirmLabel: opts.confirmLabel ?? 'מחק',
        cancelLabel: opts.cancelLabel ?? 'ביטול',
        onConfirm: async () => {
          dismiss(id);
          await opts.onConfirm();
        },
        onCancel: () => {
          dismiss(id);
          opts.onCancel?.();
        },
      },
    ]);
  }, [dismiss]);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, message) => show({ title, message, tone: 'success' }),
      error: (title, message) => show({ title, message, tone: 'error' }),
      warn: (title, message) => show({ title, message, tone: 'warn' }),
      info: (title, message) => show({ title, message, tone: 'info' }),
      confirm,
    }),
    [show, confirm]
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <GlassToastHost items={items} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}
