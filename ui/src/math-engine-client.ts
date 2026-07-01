// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// math-engine-client: thin re-export of the single source-of-truth engine.
//
// This file used to be a ~569-line verbatim copy of `math-engine/src` (a
// duplication that risked silent drift). Every exported function and type was
// verified byte-for-byte identical to the engine (#44), so it is now just an
// alias. The 12 client import sites keep importing from 'math-engine-client'
// unchanged; importing the real engine adds ~zero bundle weight because the
// client already ships mathjs and the engine is mathjs + pure TS.
//
// Only the client-relevant (parse / format / AST-helper) surface is re-exported
// here — the heavier solving functions (generateValidMoves, getReducibleOptions,
// …) stay engine/backend-only and are imported directly from 'math-engine' where
// genuinely needed.

export type { Equation, SerializedEquation, SerializedNode, RelationOperator, EquationStatus } from 'math-engine';

export {
  parseEquation,
  equationToString,
  equationToLatex,
  equationToLatexAligned,
  equationToUnicode,
  equationToSpeech,
  nodeToSpeech,
  isCommutativeChainLink,
  formatNumber,
  flipRelation,
  ensureNodeIds,
  getChildren,
  getNodeByPath,
  getAllPaths,
  getAllPathsInTree,
  getFunctionName,
  cloneWithChildren,
  removeNodeAtPath,
  replaceNodeAtPath,
  stripRedundantParentheses,
  serializeEquation,
  serializeNode,
  deserializeEquation,
  deserializeNode,
  getEquationStatus,
  compressString,
  decompressString,
} from 'math-engine';
