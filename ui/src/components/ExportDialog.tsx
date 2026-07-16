// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Copy, Check, Printer, ImageDown, FileText } from 'lucide-react';
import type { Equation } from 'math-engine-client';
import type { DerivationStep } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { EquationExportCanvas } from './EquationExportCanvas';
import { WorkedSolutionDocument } from './WorkedSolutionDocument';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { trackEvent } from '../utils/analytics';
import { revealReducer, initialRevealState } from '../utils/revealState';
import { safeCopyImage, canCopyImage } from '../utils/clipboard';
import {
  IMAGE_BACKGROUNDS,
  type ImageBackground,
  equationImageFilename,
  workedSolutionImageFilename,
  captureNodeToPng,
} from '../utils/equationImage';

/**
 * The export options surface for a single scope (#130). It is always opened
 * *pre-scoped* from the Copy control that owns it — the per-step Copy menu opens it
 * on `equation`, the derivation Copy menu on `derivation` — so there is no scope
 * switch and no degenerate "nothing to derive yet" state: the affordance you used
 * already fixed what you're exporting. Both scopes share the same White / Black /
 * Transparent background parity (#335); the derivation adds an explanations toggle
 * and a Print / PDF path for its worked-solution document.
 *
 * Print isolation is CSS-only: the scope is rendered a *second* time into an
 * off-screen holder (`.export-print-portal`) so `@media print` can pull a clean,
 * unclipped page onto paper without the modal's positioning clipping it — see
 * globals.css. Print always renders light (paper is white) regardless of the
 * on-screen background choice.
 */

type ExportScope = 'equation' | 'derivation';

const BG_LABEL: Record<ImageBackground, string> = {
  white: 'White',
  black: 'Black',
  transparent: 'Transparent',
};

// Swatch fills for the background picker. Transparent shows a checkerboard so the
// choice reads at a glance.
const BG_SWATCH: Record<ImageBackground, string> = {
  white: 'bg-white',
  black: 'bg-black',
  transparent:
    'bg-[length:8px_8px] bg-[position:0_0,4px_4px] bg-[image:linear-gradient(45deg,#9ca3af_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#9ca3af_75%)] bg-neutral-200',
};

type CopyState = 'idle' | 'copied' | 'failed';

interface ExportDialogProps {
  /** Fixed by the opener — never chosen inside the dialog. */
  readonly scope: ExportScope;
  /** The equation to render (equation scope) / the endpoint (derivation filename). */
  readonly equation: Equation;
  /** The active derivation as structured steps — required for the derivation scope. */
  readonly steps?: readonly DerivationStep[];
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ scope, equation, steps = [], isOpen, onClose }) => {
  const [bg, setBg] = React.useState<ImageBackground>('white');
  const [branding, setBranding] = React.useState(true);
  const [annotated, setAnnotated] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [copyState, setCopyState] = React.useState<CopyState>('idle');
  const [variant, setVariant] = React.useState<'solution' | 'worksheet'>('solution');
  const [revealMode, setRevealMode] = React.useState(false);
  const [revealState, dispatchReveal] = React.useReducer(revealReducer, initialRevealState());

  const [prevStepsLength, setPrevStepsLength] = React.useState(steps.length);
  const [prevScope, setPrevScope] = React.useState(scope);

  if (steps.length !== prevStepsLength || scope !== prevScope) {
    setPrevStepsLength(steps.length);
    setPrevScope(scope);
    setVariant('solution');
    setRevealMode(false);
    dispatchReveal({ type: 'RESET', count: 1 });
  }

  // Keyboard navigation for step reveal
  React.useEffect(() => {
    if (!revealMode || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        dispatchReveal({ type: 'ADVANCE', max: steps.length });
        setCopyState('idle');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        dispatchReveal({ type: 'RETREAT' });
        setCopyState('idle');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [revealMode, steps.length, isOpen]);

  const captureRef = React.useRef<HTMLDivElement | null>(null);

  const handleClose = React.useCallback(() => {
    setCopyState('idle');
    onClose();
  }, [onClose]);
  const dialogRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

  const copySupported = React.useMemo(() => canCopyImage(), []);
  const isDerivation = scope === 'derivation';
  const problem = steps[0]?.equation ?? equation;

  const actualVariant = revealMode ? 'solution' : variant;
  const actualRevealedCount = revealMode ? revealState.revealedCount : undefined;

  // Anything that alters the rendered artifact invalidates a prior copy.
  const chooseBg = (next: ImageBackground) => {
    setBg(next);
    setCopyState('idle');
  };
  const toggle = (setter: (v: boolean) => void) => (v: boolean) => {
    setter(v);
    setCopyState('idle');
  };

  const capture = async (): Promise<Blob | null> => {
    const node = captureRef.current;
    if (!node) return null;
    return captureNodeToPng(node, bg);
  };

  // Scope-appropriate analytics for the three shared export actions. The equation
  // labels keep the background prefix (#335 continuity); the derivation labels the
  // verb plainly.
  const track = (verb: 'copy' | 'download' | 'print') => {
    trackEvent({
      action: isDerivation ? 'export_worked_solution' : 'export_equation_image',
      category: 'interaction',
      label: isDerivation ? (verb === 'download' ? 'png' : verb) : `${bg}:${verb}`,
    });
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await capture();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = isDerivation ? workedSolutionImageFilename(problem) : equationImageFilename(equation);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      track('download');
    } catch (err) {
      console.error('Export download failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyImage = async () => {
    if (busy || !copySupported) return;
    setBusy(true);
    try {
      const blob = await capture();
      const ok = blob ? await safeCopyImage(blob) : false;
      setCopyState(ok ? 'copied' : 'failed');
      if (ok) track('copy');
    } catch (err) {
      console.error('Export image copy failed:', err);
      setCopyState('failed');
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    track('print');
    window.print();
  };

  if (typeof document === 'undefined') return null;

  const title = isDerivation ? 'Export worked solution' : 'Export equation';
  const TitleIcon = isDerivation ? FileText : ImageDown;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
            />

            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-dialog-title"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              className={`w-full ${isDerivation ? 'max-w-2xl' : 'max-w-md'} overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
            >
              {/* Header */}
              <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-4 select-none shrink-0`}>
                <div className="flex items-center gap-2.5">
                  <TitleIcon className="text-indigo-400 w-5 h-5" />
                  <h2 id="export-dialog-title" className="text-lg font-bold text-white tracking-wide">
                    {title}
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer`}
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-auto flex flex-col gap-5">
                {/* Live preview = the exact capture target. */}
                {isDerivation ? (
                  <div className="flex flex-col gap-3">
                    <div
                      className={`rounded-xl overflow-auto border border-white/10 flex justify-center p-4 ${bg === 'transparent' ? BG_SWATCH.transparent : 'bg-neutral-200'}`}
                    >
                      {/* self-start: without it this flex child stretches to the scroll
                          container's visible height, so its clientHeight — what
                          html-to-image measures — clips the capture to the top of a
                          tall document. self-start sizes it to the real content height. */}
                      <div ref={captureRef} className="shadow-lg self-start">
                        <WorkedSolutionDocument
                          steps={steps}
                          annotated={annotated && actualVariant !== 'worksheet'}
                          branding={branding}
                          bg={bg}
                          variant={actualVariant}
                          revealedCount={actualRevealedCount}
                        />
                      </div>
                    </div>

                    {revealMode && (
                      <div className="flex items-center justify-between px-1 select-none shrink-0">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={revealState.revealedCount <= 1}
                            onClick={() => {
                              dispatchReveal({ type: 'RETREAT' });
                              setCopyState('idle');
                            }}
                            className={`px-2.5 py-1 rounded border text-xs font-semibold transition-all cursor-pointer ${
                              revealState.revealedCount <= 1
                                ? 'border-white/5 bg-white/5 text-white/20 cursor-not-allowed'
                                : 'border-white/10 bg-white/10 text-white/80 hover:bg-white/15 hover:text-white'
                            }`}
                            aria-label="Previous step"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            disabled={revealState.revealedCount >= steps.length}
                            onClick={() => {
                              dispatchReveal({ type: 'ADVANCE', max: steps.length });
                              setCopyState('idle');
                            }}
                            className={`px-2.5 py-1 rounded border text-xs font-semibold transition-all cursor-pointer ${
                              revealState.revealedCount >= steps.length
                                ? 'border-white/5 bg-white/5 text-white/20 cursor-not-allowed'
                                : 'border-white/10 bg-white/10 text-white/80 hover:bg-white/15 hover:text-white'
                            }`}
                            aria-label="Next step"
                          >
                            Next
                          </button>
                        </div>
                        <span className="text-xs font-semibold text-white/60" role="status" aria-live="polite">
                          Step {revealState.revealedCount} of {steps.length}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`rounded-xl overflow-hidden border border-white/10 flex items-center justify-center min-h-[120px] ${bg === 'transparent' ? BG_SWATCH.transparent : 'bg-neutral-950/40'}`}
                  >
                    <EquationExportCanvas ref={captureRef} equation={equation} bg={bg} branding={branding} />
                  </div>
                )}

                {/* Background picker (shared parity across scopes) */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-white/60">Background</span>
                  <div className="flex items-center gap-2" role="radiogroup" aria-label="Background">
                    {IMAGE_BACKGROUNDS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={bg === option}
                        onClick={() => chooseBg(option)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          bg === option
                            ? 'border-indigo-400/50 bg-indigo-600/20 text-white'
                            : 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-sm border border-white/20 ${BG_SWATCH[option]}`} />
                        {BG_LABEL[option]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Document variant selector (Answer key / Worksheet) */}
                {isDerivation && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-white/60">Document variant</span>
                    <div className="flex items-center gap-2" role="radiogroup" aria-label="Document variant">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={variant === 'solution'}
                        onClick={() => {
                          setVariant('solution');
                          setCopyState('idle');
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          variant === 'solution'
                            ? 'border-indigo-400/50 bg-indigo-600/20 text-white'
                            : 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        Answer key
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={variant === 'worksheet'}
                        onClick={() => {
                          setVariant('worksheet');
                          setRevealMode(false);
                          setCopyState('idle');
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          variant === 'worksheet'
                            ? 'border-indigo-400/50 bg-indigo-600/20 text-white'
                            : 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        Worksheet
                      </button>
                    </div>
                  </div>
                )}

                {isDerivation && (
                  <label className={`flex items-center gap-2.5 select-none ${variant === 'worksheet' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={variant !== 'worksheet' && annotated}
                      disabled={variant === 'worksheet'}
                      onChange={(e) => toggle(setAnnotated)(e.target.checked)}
                      className="w-4 h-4 accent-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="text-xs font-semibold text-white/70">Show step explanations</span>
                  </label>
                )}

                {isDerivation && variant === 'solution' && (
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={revealMode}
                      onChange={(e) => {
                        setRevealMode(e.target.checked);
                        dispatchReveal({ type: 'RESET', count: 1 });
                        setCopyState('idle');
                      }}
                      className="w-4 h-4 accent-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-white/70">Reveal steps one at a time</span>
                  </label>
                )}

                {/* Branding toggle (shared) */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={branding}
                    onChange={(e) => toggle(setBranding)(e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-white/70">Show algebranch.org logo</span>
                </label>

                {isDerivation && variant === 'worksheet' && (
                  <p className="text-xs text-white/40 italic">
                    Note: The copied transcript remains the full solution; the worksheet is a visual/print artifact.
                  </p>
                )}

                {!copySupported && (
                  <p className="text-xs text-white/40">
                    Copying an image isn’t supported in this browser — use Save instead.
                  </p>
                )}
                {copyState === 'failed' && (
                  <p className="text-xs text-amber-400">Couldn’t copy the image — try Save.</p>
                )}
              </div>

              {/* Actions — the same three verbs in every scope (parity, #130). */}
              <div className={`flex justify-end items-center gap-2 mt-5 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-4 shrink-0`}>
                <button
                  onClick={handleCopyImage}
                  disabled={busy || !copySupported}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold ${THEME_GLASS.BUTTON_SECONDARY} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {copyState === 'copied' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copyState === 'copied' ? 'Copied!' : 'Copy image'}
                </button>
                <button
                  onClick={handlePrint}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold ${THEME_GLASS.BUTTON_SECONDARY}`}
                >
                  <Printer size={14} />
                  Print / PDF
                </button>
                <button
                  onClick={handleDownload}
                  disabled={busy}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold ${THEME_GLASS.BUTTON_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <Download size={14} />
                  Save as PNG
                </button>
              </div>
            </motion.div>
          </div>

          {/* Off-screen print target: a second render of the scope, laid out (so
              equation measurements are correct) but clipped to nothing on screen.
              Always light — paper is white. `@media print` (globals.css) hides the
              app and pulls this onto paper. */}
          <div className="export-print-portal" aria-hidden="true">
            {isDerivation ? (
              <WorkedSolutionDocument
                steps={steps}
                annotated={annotated && actualVariant !== 'worksheet'}
                branding={branding}
                bg="white"
                variant={actualVariant}
                revealedCount={actualRevealedCount}
              />
            ) : (
              <EquationExportCanvas equation={equation} bg="white" branding={branding} />
            )}
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};
