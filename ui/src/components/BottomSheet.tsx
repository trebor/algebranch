// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useIsShortScreen } from '../hooks/useIsShortScreen';

/**
 * How the sheet presents itself (#325):
 * - `fullscreen`: a short (mobile-landscape) viewport — an edge-to-edge panel
 *   with an explicit close control, no resize snap (dragging only dismisses).
 * - `fit`: a roomy viewport with `fitContent` — height sized to its content.
 * - `snap`: a roomy viewport — the classic draggable bottom sheet with snap points.
 *
 * Below the short-screen breakpoint we switch metaphors rather than merely
 * enlarge the sheet: at that height a drag handle advertises a resize that has no
 * useful partial state to land on, so full-screen is the honest affordance.
 */
export type SheetMode = 'fullscreen' | 'fit' | 'snap';

export function resolveSheetMode(isShort: boolean, fitContent: boolean): SheetMode {
  if (isShort) return 'fullscreen';
  return fitContent ? 'fit' : 'snap';
}

/**
 * BottomSheet — A draggable bottom sheet component with snap points.
 *
 * Features:
 * - Drag-to-dismiss with velocity & distance thresholds
 * - Multiple snap points (fraction of viewport height)
 * - Glass-morphic dark theme styling
 * - Body scroll lock when open
 * - Rendered via React portal to document.body
 */

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  snapPoints?: number[];  // Default [0.5, 0.92] (50% and 92% of viewport)
  children: React.ReactNode;
  fitContent?: boolean;
}

const DEFAULT_SNAP_POINTS = [0.5, 0.92];

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  snapPoints = DEFAULT_SNAP_POINTS,
  children,
  fitContent = false,
}) => {
  const [activeSnapIndex, setActiveSnapIndex] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const isShort = useIsShortScreen();
  const mode = resolveSheetMode(isShort, fitContent);
  // In fullscreen and fit modes the sheet doesn't resize — a drag only dismisses.
  const dismissOnly = mode !== 'snap';

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  // Sorted snap points (ascending) for consistent behavior
  const sortedSnaps = [...snapPoints].sort((a, b) => a - b);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  // Escape closes the sheet — the standard modal affordance (#325). Scoped like
  // useFocusTrap: only act when the Escape originated inside the sheet (or from
  // the body), so a layered surface with its own Escape isn't overridden. Escape
  // is otherwise free here — the global shortcut handler only uses it to cancel a
  // pending leader sequence.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as Node | null;
      const container = sheetRef.current;
      if (!container || container.contains(target) || target === document.body || target === null) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Move focus into the sheet when it opens (#325). Without this the trigger
  // (a bottom-nav button, now slid away and inert) keeps focus, so the first
  // Escape lands outside the sheet and is ignored until the user clicks inside.
  useEffect(() => {
    if (isOpen && mounted) {
      sheetRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen, mounted]);

  // Handle drag end — close or snap
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const draggedDistance = info.offset.y;
      const velocity = info.velocity.y;

      // Fullscreen and fit modes don't snap — a sufficient downward drag dismisses,
      // anything less springs back (framer resets y to 0).
      if (dismissOnly) {
        const height = sheetRef.current?.offsetHeight || 300;
        if (velocity > 500 || draggedDistance > height * 0.3) {
          onClose();
        }
        return;
      }

      // Current snap height in viewport pixels
      const getSnapHeight = (index: number) => {
        const snap = sortedSnaps[Math.min(index, sortedSnaps.length - 1)] ?? sortedSnaps[0];
        return typeof window !== 'undefined' ? window.innerHeight * snap : 500;
      };

      const sheetHeight = getSnapHeight(activeSnapIndex);
      // Close if velocity is high or dragged past 30% of sheet height
      if (velocity > 500 || draggedDistance > sheetHeight * 0.3) {
        onClose();
        return;
      }
 
      // Snap to nearest snap point based on where the sheet ended up
      const currentFraction =
        typeof window !== 'undefined'
          ? (sheetHeight - draggedDistance) / window.innerHeight
          : sortedSnaps[0];
 
      let closestIndex = 0;
      let closestDist = Infinity;
      sortedSnaps.forEach((snap, idx) => {
        const dist = Math.abs(snap - currentFraction);
        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = idx;
        }
      });
 
      setActiveSnapIndex(closestIndex);
    },
    [onClose, sortedSnaps, activeSnapIndex, dismissOnly],
  );

  // Reset snap index when the sheet opens. Done during render via the
  // previous-prop pattern (React's "adjust state when a prop changes") rather
  // than an effect.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) setActiveSnapIndex(0);
  }

  // Compute the y offset from bottom for the initial snap point
  // The sheet height = snap fraction * viewport height
  // We position with bottom:0 and animate y from 100% to 0
  const sheetHeight =
    typeof window !== 'undefined'
      ? window.innerHeight * sortedSnaps[activeSnapIndex]
      : 500;

  // Fullscreen fills the viewport edge-to-edge (no rounded top); fit sizes to its
  // content; snap holds the current snap-point height. All cap at the viewport.
  const panelStyle =
    mode === 'fullscreen'
      ? { height: '100dvh', maxHeight: '100dvh' }
      : { height: mode === 'fit' ? 'auto' : sheetHeight, maxHeight: '95vh' };
  const panelClass = `fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl bg-[#110f22]/95 border-t border-white/10 flex flex-col outline-none ${
    mode === 'fullscreen' ? '' : 'rounded-t-2xl'
  }`;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            tabIndex={-1}
            className={panelClass}
            style={panelStyle}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
          >
            {/* Grab handle — the one consistent swipe-to-dismiss grip across every
                sheet and mode (#325). History has no title bar to grab, so the
                handle alone must be a comfortable target; the content below stops
                pointer-down propagation, so dragging can only start up here.
                Fullscreen overlays an explicit ✕ (swipe still works, but the
                resize affordance the handle implies has no partial state to hit). */}
            <div className="relative flex justify-center pt-3 pb-2.5 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 bg-white/30 rounded-full" />
              {mode === 'fullscreen' && (
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Title bar — a plain label, not a dismiss control. Clicking a header
                to close surprised on the titled sheets and did nothing on History
                (whose header is its own component); dismissal is uniform via the
                handle / ✕ / backdrop / Escape instead (#325). */}
            {title && (
              <div
                className={`flex items-center px-5 border-b border-white/10 select-none ${
                  mode === 'fullscreen' ? 'pb-2 mb-2' : 'pb-3 mb-3'
                }`}
              >
                {typeof title === 'string' ? (
                  <h2 className="text-base font-semibold text-white">{title}</h2>
                ) : (
                  <div className="text-base font-semibold text-white flex items-center gap-2 select-none">
                    {title}
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div
              // The BottomNav slides away while any sheet is open (#325), so the
              // content no longer reserves the old ~3.5rem nav band — just the
              // safe-area inset plus a small breathing gap.
              className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
              onPointerDownCapture={(e) => {
                // Prevent drag from starting inside scrollable content
                e.stopPropagation();
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};
