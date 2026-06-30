// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Copy, Check, ImageDown } from 'lucide-react';
import type { Equation } from 'math-engine-client';
import {
  THEME_GLASS,
  EQUATION_PREVIEW_PALETTE_DARK,
  EQUATION_PREVIEW_PALETTE_LIGHT,
} from '../constants/theme';
import { EquationPreviewPaletteContext } from './EquationPreviewPaletteContext';
import { PreviewEquationNode } from './PreviewEquationNode';
import { RELATION_DISPLAY } from '../constants/mathSymbols';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { trackEvent } from '../utils/analytics';
import { safeCopyImage, canCopyImage } from '../utils/clipboard';
import {
  IMAGE_BACKGROUNDS,
  type ImageBackground,
  backgroundColorFor,
  foregroundColorFor,
  equationImageFilename,
  captureNodeToPng,
} from '../utils/equationImage';

interface ImageExportDialogProps {
  /** The single equation to render and export. */
  equation: Equation;
  isOpen: boolean;
  onClose: () => void;
}

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

export const ImageExportDialog: React.FC<ImageExportDialogProps> = ({
  equation,
  isOpen,
  onClose,
}) => {
  const [bg, setBg] = React.useState<ImageBackground>('white');
  const [branding, setBranding] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [copyState, setCopyState] = React.useState<CopyState>('idle');

  const captureRef = React.useRef<HTMLDivElement | null>(null);

  // Clear transient feedback on the way out so the next open starts clean — avoids a
  // reset effect entirely.
  const handleClose = React.useCallback(() => {
    setCopyState('idle');
    onClose();
  }, [onClose]);
  const dialogRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: handleClose });

  // Image copy needs a secure context + ClipboardItem; otherwise offer download only.
  const copySupported = React.useMemo(() => canCopyImage(), []);

  // Changing the look invalidates a prior copy, so clear its confirmation.
  const chooseBg = (next: ImageBackground) => {
    setBg(next);
    setCopyState('idle');
  };
  const toggleBranding = (next: boolean) => {
    setBranding(next);
    setCopyState('idle');
  };

  // Black background reads with the in-app dark palette; white/transparent (usually
  // dropped onto light surfaces) need the dark-glyph light palette.
  const palette = bg === 'black' ? EQUATION_PREVIEW_PALETTE_DARK : EQUATION_PREVIEW_PALETTE_LIGHT;
  const fg = foregroundColorFor(bg);
  const relationSymbol = RELATION_DISPLAY[equation.relation ?? '='] ?? '=';

  const capture = async (): Promise<Blob | null> => {
    const node = captureRef.current;
    if (!node) return null;
    return captureNodeToPng(node, bg);
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
      a.download = equationImageFilename(equation);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      trackEvent({ action: 'export_equation_image', category: 'interaction', label: `${bg}:download` });
    } catch (err) {
      console.error('Equation image download failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (busy || !copySupported) return;
    setBusy(true);
    try {
      const blob = await capture();
      const ok = blob ? await safeCopyImage(blob) : false;
      setCopyState(ok ? 'copied' : 'failed');
      if (ok) {
        trackEvent({ action: 'export_equation_image', category: 'interaction', label: `${bg}:copy` });
      }
    } catch (err) {
      console.error('Equation image copy failed:', err);
      setCopyState('failed');
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
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
            aria-labelledby="image-export-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-md overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-4 select-none shrink-0`}>
              <div className="flex items-center gap-2.5">
                <ImageDown className="text-indigo-400 w-5 h-5" />
                <h2 id="image-export-title" className="text-lg font-bold text-white tracking-wide">
                  Save as image
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

            <div className="flex-1 overflow-y-auto flex flex-col gap-5">
              {/* Live preview = the exact capture target. The checkerboard frame only
                  shows through where the chosen background is transparent. */}
              <div
                className={`rounded-xl overflow-hidden border border-white/10 flex items-center justify-center min-h-[120px] ${bg === 'transparent' ? BG_SWATCH.transparent : 'bg-neutral-950/40'}`}
              >
                <div
                  ref={captureRef}
                  data-testid="equation-export-canvas"
                  style={{
                    backgroundColor: backgroundColorFor(bg),
                    color: fg,
                    // The equation row carries lineHeight 1.1, so ~0.65rem of phantom
                    // leading sits below its glyphs. With branding that leading lands
                    // in the gap, making "above" read larger than the 1rem bottom the
                    // user liked — so shrink the gap to cancel it (above ≈ below).
                    // Without branding the same leading pushes the equation visually
                    // high, so trim the bottom padding to re-centre it (#335 feedback).
                    padding: branding ? '2.5rem 2rem 1rem' : '2.5rem 2rem 1.9rem',
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: branding ? '0.35rem' : '1rem',
                  }}
                >
                  <EquationPreviewPaletteContext.Provider value={palette}>
                    <div
                      className="flex items-center justify-center gap-[0.35em] flex-nowrap"
                      style={{ fontSize: '2.75rem', lineHeight: 1.1 }}
                    >
                      <PreviewEquationNode path="lhs" customEquation={equation} />
                      <span className={`font-mono ${palette.relation}`}>{relationSymbol}</span>
                      <PreviewEquationNode path="rhs" customEquation={equation} />
                    </div>
                  </EquationPreviewPaletteContext.Provider>
                  {branding && (
                    <div className="flex items-center gap-1 select-none" style={{ color: fg, opacity: 0.55 }}>
                      <Image
                        src="/logo-mark.png"
                        alt=""
                        width={24}
                        height={24}
                        unoptimized
                        priority
                        style={{ display: 'block', width: '1.6rem', height: '1.6rem' }}
                      />
                      <span className="font-semibold" style={{ fontSize: '0.9rem', letterSpacing: '0.04em' }}>
                        algebranch.org
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Background picker */}
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

              {/* Branding toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={branding}
                  onChange={(e) => toggleBranding(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-white/70">Show algebranch.org logo</span>
              </label>

              {!copySupported && (
                <p className="text-xs text-white/40">
                  Copying an image isn’t supported in this browser — use Download instead.
                </p>
              )}
              {copyState === 'failed' && (
                <p className="text-xs text-amber-400">Couldn’t copy the image — try Download.</p>
              )}
            </div>

            {/* Actions */}
            <div className={`flex justify-end items-center gap-2 mt-5 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-4 shrink-0`}>
              <button
                onClick={handleCopy}
                disabled={busy || !copySupported}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold ${THEME_GLASS.BUTTON_SECONDARY} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {copyState === 'copied' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copyState === 'copied' ? 'Copied!' : 'Copy image'}
              </button>
              <button
                onClick={handleDownload}
                disabled={busy}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold ${THEME_GLASS.BUTTON_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Download size={14} />
                Download PNG
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
