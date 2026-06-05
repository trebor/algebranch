'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';

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
  title?: string;
  snapPoints?: number[];  // Default [0.5, 0.92] (50% and 92% of viewport)
  children: React.ReactNode;
}

const DEFAULT_SNAP_POINTS = [0.5, 0.92];

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  snapPoints = DEFAULT_SNAP_POINTS,
  children,
}) => {
  const [activeSnapIndex, setActiveSnapIndex] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Sorted snap points (ascending) for consistent behavior
  const sortedSnaps = [...snapPoints].sort((a, b) => a - b);

  // Current snap height in viewport pixels
  const getSnapHeight = (index: number) => {
    const snap = sortedSnaps[Math.min(index, sortedSnaps.length - 1)] ?? sortedSnaps[0];
    return typeof window !== 'undefined' ? window.innerHeight * snap : 500;
  };

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
      const sheetHeight = getSnapHeight(activeSnapIndex);
      const draggedDistance = info.offset.y;
      const velocity = info.velocity.y;

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
    [onClose, sortedSnaps, activeSnapIndex],
  );

  // Reset snap index when opening
  useEffect(() => {
    if (isOpen) {
      setActiveSnapIndex(0);
    }
  }, [isOpen]);

  // Compute the y offset from bottom for the initial snap point
  // The sheet height = snap fraction * viewport height
  // We position with bottom:0 and animate y from 100% to 0
  const sheetHeight =
    typeof window !== 'undefined'
      ? window.innerHeight * sortedSnaps[activeSnapIndex]
      : 500;

  if (typeof window === 'undefined') return null;

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
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl backdrop-blur-2xl bg-gradient-to-br from-[#1b183a]/90 via-[#0e0c1f]/95 to-[#07070b]/98 border-t border-white/10 flex flex-col"
            style={{ height: sheetHeight, maxHeight: '95vh' }}
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
              <div className="flex items-center justify-between px-5 py-2">
                <h2 className="text-base font-semibold text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Content */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[env(safe-area-inset-bottom)]"
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
