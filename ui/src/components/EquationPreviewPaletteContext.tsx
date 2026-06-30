// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import {
  EQUATION_PREVIEW_PALETTE_DARK,
  type EquationPreviewPalette,
} from '../constants/theme';

/**
 * Palette consumed by {@link PreviewEquationNode} for its leaf glyph colours (#335).
 * Defaults to the in-app dark palette, so every existing preview renders exactly as
 * before; the image-export container overrides it with a light palette when the
 * chosen background is white or transparent.
 */
export const EquationPreviewPaletteContext =
  React.createContext<EquationPreviewPalette>(EQUATION_PREVIEW_PALETTE_DARK);

export const useEquationPreviewPalette = (): EquationPreviewPalette =>
  React.useContext(EquationPreviewPaletteContext);
