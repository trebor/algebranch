'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSetAtom, useAtom } from 'jotai';
import {
  applyGlobalOpAtom,
  swapSidesAtom,
  radialMenuOpenAtom,
} from '../store/equation';
import { trackEvent } from '../utils/analytics';
import { ArrowLeftRight, Plus, Minus, X, Divide } from 'lucide-react';
import { Tooltip } from './Tooltip';

/**
 * Global operation types available in the radial menu.
 * These are the operations that affect both sides of the equation.
 */
type RadialAction =
  | { type: 'square' }
  | { type: 'sqrt' }
  | { type: 'power'; power: number }
  | { type: 'root'; power: number }
  | { type: 'add' }
  | { type: 'sub' }
  | { type: 'mul' }
  | { type: 'div' }
  | { type: 'swap' };

interface RadialPetal {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  action: RadialAction;
  color: string;
}

const PETALS: RadialPetal[] = [
  { icon: <ArrowLeftRight size={18} />, label: '↔', tooltip: 'Swap left and right sides (⌘⇧S)', action: { type: 'swap' }, color: 'text-amber-400' },
  { icon: <span className="text-sm font-bold">xⁿ</span>, label: 'xⁿ', tooltip: 'Raise both sides to nth power', action: { type: 'power', power: 2 }, color: 'text-teal-400' },
  { icon: <Plus size={18} />, label: '+', tooltip: 'Add term to both sides', action: { type: 'add' }, color: 'text-indigo-400' },
  { icon: <Minus size={18} />, label: '−', tooltip: 'Subtract term from both sides', action: { type: 'sub' }, color: 'text-violet-400' },
  { icon: <X size={16} />, label: '×', tooltip: 'Multiply both sides by term', action: { type: 'mul' }, color: 'text-rose-400' },
  { icon: <Divide size={18} />, label: '÷', tooltip: 'Divide both sides by term', action: { type: 'div' }, color: 'text-pink-400' },
  { icon: <span className="text-sm font-bold">ⁿ√</span>, label: 'ⁿ√', tooltip: 'Take nth root of both sides', action: { type: 'root', power: 2 }, color: 'text-emerald-400' },
];

// Radial layout
const RADIUS = 72; // px from center
const ANGLE_START = -90; // Start from top (12 o'clock)

interface RadialMenuProps {
  /** Ref to the equals sign element for positioning */
  anchorRef: React.RefObject<HTMLElement | null>;
}

/**
 * RadialMenu — A circular action menu that blooms from the equals sign.
 * Each petal represents a global operation (applies to both sides of the equation).
 */
export const RadialMenu: React.FC<RadialMenuProps> = ({ anchorRef }) => {
  const [isOpen, setIsOpen] = useAtom(radialMenuOpenAtom);
  const applyGlobalOp = useSetAtom(applyGlobalOpAtom);
  const swapSides = useSetAtom(swapSidesAtom);
  const [termInputAction, setTermInputAction] = React.useState<RadialAction | null>(null);
  const [termValue, setTermValue] = React.useState('');
  const [spinnerValue, setSpinnerValue] = React.useState(2);
  const [errorStr, setErrorStr] = React.useState<string | null>(null);
  const termInputRef = React.useRef<HTMLInputElement>(null);

  // Position state for floating menu
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);

  // Calculate position relative to anchor
  React.useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  }, [isOpen, anchorRef]);


  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setTermInputAction(null);
        setTermValue('');
        setErrorStr(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, setIsOpen]);

  // Focus term input when it appears
  React.useEffect(() => {
    if (termInputAction && termInputRef.current) {
      termInputRef.current.focus();
    }
  }, [termInputAction]);

  const handlePetalClick = (petal: RadialPetal) => {
    const { action } = petal;

    if (action.type === 'swap') {
      swapSides();
      trackEvent({ action: 'radial_swap_sides', category: 'operations' });
      setIsOpen(false);
      return;
    }

    // Operations that need input (term input or spinner)
    if (
      action.type === 'add' ||
      action.type === 'sub' ||
      action.type === 'mul' ||
      action.type === 'div' ||
      action.type === 'power' ||
      action.type === 'root'
    ) {
      setTermInputAction(action);
      if (action.type === 'power' || action.type === 'root') {
        setSpinnerValue(2); // Default spinner to 2
      }
      return;
    }
  };

  const handleTermSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termInputAction) return;

    try {
      setErrorStr(null);
      if (termInputAction.type === 'power') {
        applyGlobalOp({ type: 'power', power: spinnerValue });
        trackEvent({
          action: 'radial_power',
          category: 'operations',
          label: String(spinnerValue),
        });
      } else if (termInputAction.type === 'root') {
        applyGlobalOp({ type: 'root', power: spinnerValue });
        trackEvent({
          action: 'radial_root',
          category: 'operations',
          label: String(spinnerValue),
        });
      } else {
        if (!termValue.trim()) return;
        applyGlobalOp({ type: termInputAction.type as 'add' | 'sub' | 'mul' | 'div', term: termValue.trim() });
        trackEvent({
          action: `radial_${termInputAction.type}`,
          category: 'operations',
          label: termValue.trim(),
        });
      }
      setTermValue('');
      setSpinnerValue(2);
      setTermInputAction(null);
      setIsOpen(false);
    } catch (err) {
      setErrorStr(err instanceof Error ? err.message : String(err));
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTermInputAction(null);
    setTermValue('');
    setErrorStr(null);
  };

  if (!position && isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && position && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Radial Container — positioned at the = sign */}
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: position.x,
              top: position.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Center = sign glow */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.3 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-indigo-600/30 border-2 border-indigo-400/50 backdrop-blur-xl flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.4)] pointer-events-auto cursor-pointer z-10"
              onClick={handleClose}
            >
              <span className="text-xl font-mono font-bold text-indigo-300">=</span>
            </motion.div>

            {/* Petals */}
            {!termInputAction && PETALS.map((petal, i) => {
              const angle = ANGLE_START + (i * 360) / PETALS.length;
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * RADIUS;
              const y = Math.sin(rad) * RADIUS;

              return (
                <Tooltip
                  key={petal.label}
                  content={petal.tooltip}
                  position="top"
                >
                  <motion.button
                    initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    animate={{ scale: 1, opacity: 1, x, y }}
                    exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    transition={{
                      type: 'spring',
                      duration: 0.4,
                      bounce: 0.35,
                      delay: i * 0.03,
                    }}
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full backdrop-blur-xl bg-neutral-900/80 border border-white/15 shadow-lg shadow-black/40 flex items-center justify-center pointer-events-auto cursor-pointer hover:bg-white/10 hover:border-white/30 hover:scale-110 active:scale-95 transition-colors ${petal.color}`}
                    onClick={() => handlePetalClick(petal)}
                  >
                    {petal.icon}
                  </motion.button>
                </Tooltip>
              );
            })}

            {/* Term Input (appears when +, −, ×, ÷ is tapped) */}
            <AnimatePresence>
              {termInputAction && (
                <motion.form
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: RADIUS + 12 }}
                  exit={{ scale: 0.8, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
                  onSubmit={handleTermSubmit}
                  className="absolute left-1/2 -translate-x-1/2 top-1/2 pointer-events-auto flex flex-col items-center gap-2"
                >
                  <div className="flex items-center gap-2 bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-xl px-3 py-2 shadow-2xl shadow-black/60">
                    <span className="text-sm font-bold text-indigo-400 w-10 text-center flex items-center justify-center">
                      {termInputAction.type === 'add' ? (
                        '+'
                      ) : termInputAction.type === 'sub' ? (
                        '−'
                      ) : termInputAction.type === 'mul' ? (
                        '×'
                      ) : termInputAction.type === 'div' ? (
                        '÷'
                      ) : termInputAction.type === 'power' ? (
                        <span>( )<sup>{spinnerValue}</sup></span>
                      ) : (
                        <span><sup>{spinnerValue}</sup>√</span>
                      )}
                    </span>
                    {termInputAction.type === 'power' || termInputAction.type === 'root' ? (
                      <div className="flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-lg px-2 py-1">
                        <button
                          type="button"
                          disabled={spinnerValue <= 2}
                          onClick={() => setSpinnerValue((v) => Math.max(2, v - 1))}
                          className="w-6 h-6 rounded-md hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer"
                        >
                          <Minus size={12} className="text-white" />
                        </button>
                        <span className="w-6 text-center text-sm font-mono font-bold text-white">
                          {spinnerValue}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSpinnerValue((v) => v + 1)}
                          className="w-6 h-6 rounded-md hover:bg-white/5 flex items-center justify-center transition-all cursor-pointer"
                        >
                          <Plus size={12} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <input
                        ref={termInputRef}
                        type="text"
                        value={termValue}
                        onChange={(e) => setTermValue(e.target.value)}
                        placeholder="e.g. 5x"
                        className="w-28 px-2 py-1 text-sm bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-mono"
                      />
                    )}
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md cursor-pointer active:scale-95 transition-all"
                    >
                      Apply
                    </button>
                  </div>
                  {errorStr && (
                    <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 max-w-xs text-center">
                      {errorStr}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTermInputAction(null);
                      setTermValue('');
                      setErrorStr(null);
                    }}
                    className="text-[10px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                  >
                    Back to menu
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
