// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

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

  // Handle drag end — close or snap
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const draggedDistance = info.offset.y;
      const velocity = info.velocity.y;
 
      if (fitContent) {
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
    [onClose, sortedSnaps, activeSnapIndex, fitContent],
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
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl backdrop-blur-2xl bg-[#110f22]/95 border-t border-white/10 flex flex-col"
            style={{ height: fitContent ? 'auto' : sheetHeight, maxHeight: '95vh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 bg-white/30 rounded-full" />
            </div>

            {/* Title bar */}
            {title && (
              <div
                onClick={onClose}
                className="flex items-center px-5 pb-3 border-b border-white/10 mb-3 cursor-pointer hover:opacity-80 active:scale-[0.98] transition-all select-none"
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
              className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+3.5rem)]"
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
