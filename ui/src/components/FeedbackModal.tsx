// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Bug, Lightbulb, Star, CheckCircle2, Layers, Variable, Ban } from 'lucide-react';
import { feedbackModalOpenAtom, feedbackContextAtom, historyTreeAtom, HistoryNode, currentNodeIdAtom, currentTabNameAtom, serializeWorkspaceState } from '../store/equation';
import { Equation, equationToString } from 'math-engine-client';
import { trackEvent } from '../utils/analytics';
import { THEME_GLASS } from '../constants/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { RELATION_DISPLAY } from '../constants/mathSymbols';
import { buildWorkspaceUrl, buildEquationUrl, buildGithubIssueUrl, parseUserAgent, ShareMode } from '../utils/feedbackUrl';
import { WorkspaceTreeView } from './WorkspaceTreeView';
import { PreviewEquationNode } from './PreviewEquationNode';

type FeedbackType = 'bug' | 'feature';

// Read-only render of a full equation (lhs <rel> rhs), reusing the workspace's
// own equation renderer so the preview matches what the user sees in the app.
const EquationPreviewRow: React.FC<{ eq: Equation }> = ({ eq }) => (
  <div className="flex items-center justify-center gap-1.5 flex-nowrap text-2xl text-white w-max mx-auto">
    <PreviewEquationNode path="lhs" customEquation={eq} />
    <span className="font-mono px-1 select-none text-indigo-300">{RELATION_DISPLAY[eq.relation ?? '='] ?? '='}</span>
    <PreviewEquationNode path="rhs" customEquation={eq} />
  </div>
);

const SHARE_OPTIONS: { mode: ShareMode; label: string; Icon: React.ElementType }[] = [
  { mode: 'workspace', label: 'Workspace', Icon: Layers },
  { mode: 'equation', label: 'Equation', Icon: Variable },
  { mode: 'none', label: 'Nothing', Icon: Ban },
];

const SHARE_HINT: Record<ShareMode, string> = {
  workspace: 'Attaches a link that reloads this exact derivation only — not your other saved workspaces.',
  equation: 'Attaches a link to just the current equation.',
  none: 'No link is attached. Only your message and device info are sent.',
};

// Security reports must stay private — route them to GitHub's private advisory
// form rather than a public issue (see SECURITY.md).
const SECURITY_ADVISORY_URL = 'https://github.com/trebor/algebranch/security/advisories/new';

// Flat, linear list of the steps the user took to reach the current equation
// (root → active node). Orthogonal to the full workspace share: it captures the
// path without the branches, so it's helpful even when the user shares nothing.
const formatActivePathSteps = (tree: Record<string, HistoryNode>, currentNodeId: string | null): string => {
  if (!currentNodeId || !tree[currentNodeId]) return '';

  const path: HistoryNode[] = [];
  let id: string | null = currentNodeId;
  while (id !== null && tree[id]) {
    path.unshift(tree[id]);
    id = tree[id].parentId;
  }

  return path
    .map((node, i) => `${i + 1}. (${node.label}) ${equationToString(node.equation)}`)
    .join('\n');
};

export const FeedbackModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(feedbackModalOpenAtom);
  const context = useAtomValue(feedbackContextAtom);
  const tree = useAtomValue(historyTreeAtom);
  const currentNodeId = useAtomValue(currentNodeIdAtom);
  const currentTabName = useAtomValue(currentTabNameAtom);

  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [rating, setRating] = React.useState<number>(0);
  const [hoveredRating, setHoveredRating] = React.useState<number>(0);
  const [shareMode, setShareMode] = React.useState<ShareMode>('workspace');

  const [isSuccess, setIsSuccess] = React.useState(false);
  const [successTypeLabel, setSuccessTypeLabel] = React.useState('');
  const [successIsSecurity, setSuccessIsSecurity] = React.useState(false);
  const [errorStr, setErrorStr] = React.useState<string | null>(null);

  const activeEquation = currentNodeId ? tree[currentNodeId]?.equation ?? null : null;
  const hasWorkspace = !!(currentNodeId && tree[currentNodeId]);
  const canSubmit = subject.trim().length > 0 && message.trim().length > 0;

  const resetForm = React.useCallback(() => {
    setSubject('');
    setMessage('');
    setRating(0);
    setShareMode('workspace');
    setIsSuccess(false);
    setSuccessTypeLabel('');
    setSuccessIsSecurity(false);
    setErrorStr(null);
  }, []);

  // Reset form state when the modal opens. Done during render via the
  // previous-prop pattern (React's "adjust state when a prop changes") rather
  // than an effect, so the reset is applied before paint.
  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) resetForm();
  }

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(resetForm, 300);
  };

  // Focus trap + scroll lock + Escape-to-close + focus restore. Initial focus
  // lands on the Subject field so the user can start typing immediately.
  const subjectInputRef = React.useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose: handleClose,
    initialFocusRef: subjectInputRef,
  });

  const handleSubmitType = async (e: React.FormEvent, feedbackType: FeedbackType) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setErrorStr('Subject and message are required.');
      return;
    }

    try {
      const typeLabel = feedbackType === 'bug' ? 'Bug Report' : feedbackType === 'feature' ? 'Feature Request' : 'General/Other';

      // Resolve the single share link from the user's explicit choice: the full
      // workspace (?ws=, #170), just the current equation (?eq=), or nothing.
      let shareLink = '';
      if (shareMode === 'workspace') {
        const compressed = await serializeWorkspaceState(tree, currentNodeId, currentTabName);
        shareLink = buildWorkspaceUrl(window.location.origin, compressed);
      } else if (shareMode === 'equation') {
        shareLink = buildEquationUrl(window.location.origin, activeEquation ? equationToString(activeEquation) : '');
      }

      const clientEnv = parseUserAgent(navigator.userAgent, window.innerWidth, navigator.maxTouchPoints);

      const issueUrl = buildGithubIssueUrl({
        type: feedbackType,
        subject: subject.trim(),
        message: message.trim(),
        rating,
        context,
        steps: formatActivePathSteps(tree, currentNodeId),
        shareLink,
        device: clientEnv.device,
        browser: clientEnv.browser,
        os: clientEnv.os,
        userAgent: navigator.userAgent,
      });

      // Open the pre-populated GitHub new-issue page in a new tab.
      window.open(issueUrl, '_blank', 'noopener,noreferrer');

      trackEvent({
        action: 'submit_feedback',
        category: 'feedback',
        label: feedbackType,
      });

      setSuccessTypeLabel(typeLabel);
      setSuccessIsSecurity(false);
      // Show success step explaining that GitHub has been opened.
      setIsSuccess(true);
    } catch {
      setErrorStr('Failed to open GitHub. Please try again.');
    }
  };

  // Security issues skip the public-issue flow entirely: open GitHub's private
  // vulnerability advisory form so the report never lands in a public issue.
  const handleSecurity = () => {
    window.open(SECURITY_ADVISORY_URL, '_blank', 'noopener,noreferrer');
    trackEvent({ action: 'submit_feedback', category: 'feedback', label: 'security' });
    setSuccessTypeLabel('Security Report');
    setSuccessIsSecurity(true);
    setIsSuccess(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`w-full max-w-lg overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} ${THEME_GLASS.TOOLTIP_DETAILS}`}
          >
            {/* Glow orb */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none -z-10" />

            {/* Header */}
            <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-4 select-none`}>
              <div>
                <h2 id="feedback-modal-title" className="text-lg font-bold text-white tracking-wide">Share Feedback</h2>
                <p className="text-xs text-indigo-300 font-semibold tracking-wider uppercase mt-0.5">
                  Help us improve Algebranch
                </p>
              </div>
              <button
                onClick={handleClose}
                className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer`}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Switcher */}
            <div className="flex-1 overflow-y-auto pr-1">
              {isSuccess ? (
                /* Success View */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-10 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
                  >
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white">{successTypeLabel} {successIsSecurity ? 'Started' : 'Ready'}!</h3>
                  <p className="text-sm text-zinc-400 mt-2 max-w-sm">
                    {successIsSecurity ? (
                      <>
                        We&apos;ve opened GitHub&apos;s <strong>private security advisory</strong> form in a new tab. Please describe the vulnerability there — security reports are kept private and must never be filed as public issues.
                      </>
                    ) : (
                      <>
                        We&apos;ve opened a new GitHub issue in a fresh tab with your feedback pre-filled. Review it and press <strong>Create</strong> on GitHub to post it publicly. A free GitHub account is required.
                      </>
                    )}
                  </p>
                  <button
                    onClick={handleClose}
                    className={`mt-8 px-6 py-2 text-sm font-semibold ${THEME_GLASS.BUTTON_PRIMARY}`}
                  >
                    Close Window
                  </button>
                </motion.div>
              ) : (
                /* Form View */
                <form className="flex flex-col gap-4">
                  {/* Subject Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} uppercase tracking-wider font-semibold select-none`}>
                      Subject
                    </label>
                    <input
                      ref={subjectInputRef}
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="What is this feedback about?"
                      className={`w-full h-9 px-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-medium ${THEME_GLASS.FIELD_SELECT}`}
                    />
                  </div>

                  {/* Message Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} uppercase tracking-wider font-semibold select-none`}>
                      Description & Details
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe what happened, what you expected, and anything that seems off. (Your algebra steps are captured automatically.)"
                      className={`w-full p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-medium resize-none ${THEME_GLASS.FIELD_SELECT}`}
                    />
                  </div>

                  {/* Share selector — the live preview sits ABOVE the choice so the
                      user sees exactly what (if anything) a link would attach. */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} uppercase tracking-wider font-semibold select-none`}>
                      What to attach
                    </label>

                    {/* Preview */}
                    {shareMode === 'workspace' ? (
                      hasWorkspace ? (
                        <WorkspaceTreeView
                          interactive={false}
                          className={`max-h-40 overflow-auto relative ${THEME_GLASS.TREE_BG}`}
                        />
                      ) : (
                        <div className={`h-20 flex items-center justify-center text-center px-4 ${THEME_GLASS.TREE_BG}`}>
                          <span className={`text-[11px] ${THEME_GLASS.TEXT_MUTED}`}>No workspace to preview yet.</span>
                        </div>
                      )
                    ) : shareMode === 'equation' ? (
                      activeEquation ? (
                        <div className={`max-h-40 overflow-auto p-4 flex items-center justify-center ${THEME_GLASS.TREE_BG}`}>
                          <EquationPreviewRow eq={activeEquation} />
                        </div>
                      ) : (
                        <div className={`h-20 flex items-center justify-center text-center px-4 ${THEME_GLASS.TREE_BG}`}>
                          <span className={`text-[11px] ${THEME_GLASS.TEXT_MUTED}`}>No equation to preview yet.</span>
                        </div>
                      )
                    ) : (
                      <div className={`h-20 flex items-center justify-center text-center px-4 ${THEME_GLASS.TREE_BG}`}>
                        <span className={`text-[11px] ${THEME_GLASS.TEXT_MUTED}`}>Nothing from your workspace will be attached.</span>
                      </div>
                    )}

                    {/* Choice (horizontal segmented control) */}
                    <div role="radiogroup" aria-label="What to attach" className="grid grid-cols-3 gap-2">
                      {SHARE_OPTIONS.map(({ mode, label, Icon }) => {
                        const active = shareMode === mode;
                        const disabled = mode !== 'none' && !hasWorkspace;
                        return (
                          <button
                            key={mode}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={disabled}
                            onClick={() => setShareMode(mode)}
                            className={`flex items-center justify-center gap-1.5 px-2 py-2 h-9 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${active ? THEME_GLASS.BUTTON_SECONDARY_ACCENT : THEME_GLASS.BUTTON_SECONDARY}`}
                          >
                            <Icon size={12} />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <p className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} leading-snug`}>{SHARE_HINT[shareMode]}</p>
                  </div>

                  {/* Rating Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} uppercase tracking-wider font-semibold select-none`}>
                      Rate Your Experience (Optional)
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isGold = star <= (hoveredRating || rating);
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star === rating ? 0 : star)}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="p-1 text-zinc-600 hover:text-yellow-400 active:scale-90 transition-all cursor-pointer"
                            aria-label={`Rate ${star} out of 5 stars`}
                          >
                            <Star
                              size={18}
                              className={
                                isGold
                                  ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]'
                                  : 'text-zinc-600'
                              }
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {errorStr && (
                    <div className={`flex items-start gap-2 text-[10px] p-2.5 animate-[fadeIn_0.2s_ease-out] ${THEME_GLASS.BUTTON_DANGER}`}>
                      <X size={13} className="shrink-0 mt-0.5" />
                      <span>{errorStr}</span>
                    </div>
                  )}

                  {/* Footer Submit Buttons */}
                  <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-2 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE} pt-4`}>
                    <button
                      type="button"
                      onClick={handleClose}
                      className={`px-4 py-2 h-9 text-xs font-semibold cursor-pointer text-center ${THEME_GLASS.BUTTON_SECONDARY}`}
                    >
                      Cancel
                    </button>
                    
                    <div className="grid grid-cols-3 gap-2 flex-1 sm:flex-none">
                      <button
                        type="button"
                        onClick={handleSecurity}
                        disabled={!canSubmit}
                        title="Report a security vulnerability privately"
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 h-9 text-xs font-bold text-center disabled:opacity-40 disabled:cursor-not-allowed ${THEME_GLASS.BUTTON_PRIMARY}`}
                      >
                        <ShieldAlert size={12} />
                        <span>Security</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { void handleSubmitType(e, 'feature'); }}
                        disabled={!canSubmit}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 h-9 text-xs font-bold text-center disabled:opacity-40 disabled:cursor-not-allowed ${THEME_GLASS.BUTTON_WARNING_FILL}`}
                      >
                        <Lightbulb size={12} />
                        <span>Feature</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { void handleSubmitType(e, 'bug'); }}
                        disabled={!canSubmit}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 h-9 text-xs font-bold text-center disabled:opacity-40 disabled:cursor-not-allowed ${THEME_GLASS.BUTTON_DANGER_FILL}`}
                      >
                        <Bug size={12} />
                        <span>Bug</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
