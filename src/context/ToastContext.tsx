import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GlassToastHost, type ToastItem, type ToastTone } from '../components/GlassToast';
import { ConfirmDialog } from '../components/ConfirmDialog';

type ShowOpts = {
  title: string;
  message?: string;
  tone?: ToastTone;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
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

type UndoOpts = {
  title: string;
  message?: string;
  duration?: number;
  onUndo: () => void | Promise<void>;
};

type ToastApi = {
  show: (opts: ShowOpts) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warn: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  confirm: (opts: ConfirmOpts) => void;
  /** התראת מחיקה עם ביטול ל־5 שניות */
  undo: (opts: UndoOpts) => void;
};

const Ctx = createContext<ToastApi | null>(null);

let idSeq = 0;

type DialogState = ConfirmOpts & { id: string };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
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
        {
          id,
          kind: 'toast',
          title: opts.title,
          message: opts.message,
          tone,
          confirmLabel: opts.actionLabel,
          onConfirm: opts.onAction
            ? async () => {
                dismiss(id);
                await opts.onAction?.();
              }
            : undefined,
        },
      ]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const confirm = useCallback((opts: ConfirmOpts) => {
    setDialog({ ...opts, id: `c-${++idSeq}` });
  }, []);

  const undo = useCallback(
    (opts: UndoOpts) => {
      show({
        title: opts.title,
        message: opts.message ?? 'מחק — בטל',
        tone: 'warn',
        duration: opts.duration ?? 5000,
        actionLabel: 'בטל',
        onAction: opts.onUndo,
      });
    },
    [show]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, message) => show({ title, message, tone: 'success' }),
      error: (title, message) => show({ title, message, tone: 'error' }),
      warn: (title, message) => show({ title, message, tone: 'warn' }),
      info: (title, message) => show({ title, message, tone: 'info' }),
      confirm,
      undo,
    }),
    [show, confirm, undo]
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <GlassToastHost items={items} onDismiss={dismiss} />
      <ConfirmDialog
        visible={!!dialog}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel ?? 'מחק'}
        cancelLabel={dialog?.cancelLabel ?? 'ביטול'}
        destructive={dialog?.destructive ?? true}
        onCancel={() => {
          const d = dialog;
          setDialog(null);
          d?.onCancel?.();
        }}
        onConfirm={async () => {
          const d = dialog;
          setDialog(null);
          if (d) await d.onConfirm();
        }}
      />
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}
