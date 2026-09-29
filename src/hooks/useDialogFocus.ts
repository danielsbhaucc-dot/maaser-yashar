import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** אלמנטים שניתן לנווט אליהם במקלדת בתוך דיאלוג (RN Web) */
const FOCUSABLE_SEL = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[contenteditable="true"]',
].join(',');

function listFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)).filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.hasAttribute('disabled')) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return true;
  });
}

type Options = {
  open: boolean;
  onClose: () => void;
  /** id של מיכל הדיאלוג ב־DOM (nativeID / id) */
  dialogId: string;
};

/**
 * מלכודת פוקוס + Escape + החזרת פוקוס לטריגר — לשימוש בגיליונות/מודלים ב־web.
 * ב־native אין DOM focus trap; Modal מטפל ב־back.
 */
export function useDialogFocus({ open, onClose, dialogId }: Options) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!open) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    let cancelled = false;
    const focusInitial = () => {
      if (cancelled) return;
      const root = document.getElementById(dialogId);
      if (!root) return;
      const items = listFocusable(root);
      const target = items[0] ?? root;
      try {
        target.focus({ preventScroll: true });
      } catch {
        // ignore
      }
    };

    const raf = requestAnimationFrame(() => {
      focusInitial();
      // ניסיון שני אחרי אנימציית פתיחה
      setTimeout(focusInitial, 80);
    });

    const onKey = (e: KeyboardEvent) => {
      const root = document.getElementById(dialogId);
      if (!root) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const items = listFocusable(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active ? root.contains(active) : false;

      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      const prev = triggerRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        try {
          prev.focus({ preventScroll: true });
        } catch {
          // ignore
        }
      }
    };
  }, [open, onClose, dialogId]);
}

/** props ל־View/Modal ב־web: dialog + aria-modal + focusable container */
export const dialogDomProps =
  Platform.OS === 'web'
    ? ({
        role: 'dialog',
        'aria-modal': true,
        tabIndex: -1,
      } as Record<string, string | number | boolean>)
    : ({} as Record<string, never>);
