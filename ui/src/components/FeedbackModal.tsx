// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Bug, Lightbulb, Star, CheckCircle2, Layers, Variable, Ban, Github } from 'lucide-react';
import { feedbackModalOpenAtom, feedbackContextAtom, historyTreeAtom, HistoryNode, currentNodeIdAtom, currentTabNameAtom, serializeWorkspaceState } from '../store/equation';
import { Equation, equationToString } from 'math-engine-client';
import { trackEvent } from '../utils/analytics';
import { THEME_GLASS } from '../constants/theme';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { RELATION_DISPLAY } from '../constants/mathSymbols';
import { buildWorkspaceUrl, buildEquationUrl, buildGithubIssueUrl, parseUserAgent, ShareMode, FeedbackPayload } from '../utils/feedbackUrl';
import { submitFeedback } from '../utils/feedbackSubmit';
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

  // Destination mode, orthogonal to the bug/feature type carried by the submit
  // buttons: off (default) sends in-app with no account; on opens a GitHub issue.
  const [postToGithub, setPostToGithub] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [rating, setRating] = React.useState<number>(0);
  const [hoveredRating, setHoveredRating] = React.useState<number>(0);
  const [shareMode, setShareMode] = React.useState<ShareMode>('workspace');

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [successTypeLabel, setSuccessTypeLabel] = React.useState('');
  // Which path produced the success screen — they explain different next steps:
  // 'app' sent it for us, 'github' opened a draft issue, 'security' the advisory.
  const [successMode, setSuccessMode] = React.useState<'app' | 'github' | 'security'>('app');
  const [errorStr, setErrorStr] = React.useState<string | null>(null);

  const activeEquation = currentNodeId ? tree[currentNodeId]?.equation ?? null : null;
  const hasWorkspace = !!(currentNodeId && tree[currentNodeId]);
  const canSubmit = subject.trim().length > 0 && message.trim().length > 0;

  const resetForm = React.useCallback(() => {
    setPostToGithub(false);
    setSubject('');
    setMessage('');
    setRating(0);
    setShareMode('workspace');
    setIsSubmitting(false);
    setIsSuccess(false);
    setSuccessTypeLabel('');
    setSuccessMode('app');
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

  // Assemble the report payload once — shared verbatim by both the in-app POST
  // and the GitHub-issue route, so the two paths always carry identical context.
  const buildPayload = async (feedbackType: FeedbackType): Promise<FeedbackPayload> => {
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

    return {
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
    };
  };

  // The two colored buttons carry the type; the GitHub switch carries the
  // destination. This one handler resolves both: off → send in-app (no account,
  // the #519 default), on → open a pre-filled GitHub issue for contributors.
  const handleSubmit = async (feedbackType: FeedbackType) => {
    if (!canSubmit || isSubmitting) {
      setErrorStr('Subject and message are required.');
      return;
    }
    const label = feedbackType === 'bug' ? 'Bug Report' : 'Feature Request';

    if (postToGithub) {
      try {
        window.open(buildGithubIssueUrl(await buildPayload(feedbackType)), '_blank', 'noopener,noreferrer');
        trackEvent({ action: 'submit_feedback', category: 'feedback', label: 'github' });
        setSuccessTypeLabel(label);
        setSuccessMode('github');
        setIsSuccess(true);
      } catch {
        setErrorStr('Failed to open GitHub. Please try again.');
      }
      return;
    }

    setErrorStr(null);
    setIsSubmitting(true);
    try {
      const result = await submitFeedback(await buildPayload(feedbackType));
      if (result.ok) {
        trackEvent({ action: 'submit_feedback', category: 'feedback', label: 'app' });
        setSuccessTypeLabel(label);
        setSuccessMode('app');
        setIsSuccess(true);
      } else {
        setErrorStr(
          result.rateLimited
            ? "We're getting a lot of feedback right now. Please try again in a little while, or switch on “Open on GitHub” above."
            : "We couldn't send your feedback just now. Please try again, or switch on “Open on GitHub” above.",
        );
      }
    } catch {
      setErrorStr("We couldn't send your feedback just now. Please try again, or switch on “Open on GitHub” above.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Security issues skip the public flow entirely: open GitHub's private
  // vulnerability advisory form so the report never lands in a public issue.
  const handleSecurity = () => {
    window.open(SECURITY_ADVISORY_URL, '_blank', 'noopener,noreferrer');
    trackEvent({ action: 'submit_feedback', category: 'feedback', label: 'security' });
    setSuccessTypeLabel('Security Report');
    setSuccessMode('security');
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
            className={`w-full max-w-lg overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} ${THEME_GLASS.MODAL_GLOW}`}
          >
            {/* Glow orb */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none -z-10" />

            {/* Header */}
            <div className={`flex items-center justify-between border-b ${THEME_GLASS.PANEL_BORDER_SUBTLE} pb-4 mb-4 select-none`}>
              <div className="min-w-0">
                <h2 id="feedback-modal-title" className="text-lg font-bold text-white tracking-wide">Share Feedback</h2>
                <p className="text-xs text-indigo-300 font-semibold tracking-wider mt-0.5">
                  Help us improve Algebranch
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {/* Ambient optional rating. Lives in the always-visible header —
                    outside the scrolling body — so it can never be scrolled past
                    and missed. Unlabeled by design: an optional sentiment tap, not
                    a form field; aria + tooltip carry the meaning, no clunky
                    "(Optional)" prose. Hidden on the success screen. */}
                {!isSuccess && (
                  <div
                    role="group"
                    aria-label="Optional rating — how was your experience?"
                    title="Optional rating"
                    className="flex items-center gap-0.5"
                  >
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isGold = star <= (hoveredRating || rating);
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star === rating ? 0 : star)}
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="p-0.5 text-zinc-600 hover:text-yellow-400 active:scale-90 transition-all cursor-pointer"
                          aria-label={`Rate ${star} out of 5 stars`}
                          aria-pressed={star <= rating}
                        >
                          <Star
                            size={16}
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
                )}
                <button
                  onClick={handleClose}
                  className={`p-1.5 rounded-lg border ${THEME_GLASS.PANEL_BORDER_SUBTLE} bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer`}
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content Switcher. A non-scrolling flex column so the form can pin
                its footer while only the fields scroll under it. */}
            <div className="flex-1 min-h-0 flex flex-col">
              {isSuccess ? (
                /* Success View */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center py-10 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
                  >
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white">
                    {successTypeLabel} {successMode === 'security' ? 'Started' : successMode === 'github' ? 'Ready' : 'Sent'}!
                  </h3>
                  <p className="text-sm text-zinc-400 mt-2 max-w-sm">
                    {successMode === 'security' ? (
                      <>
                        We&apos;ve opened GitHub&apos;s <strong>private security advisory</strong> form in a new tab. Please describe the vulnerability there — security reports are kept private and must never be filed as public issues.
                      </>
                    ) : successMode === 'github' ? (
                      <>
                        We&apos;ve opened a new GitHub issue in a fresh tab with your feedback pre-filled. Review it and press <strong>Create</strong> on GitHub to post it publicly. A free GitHub account is required.
                      </>
                    ) : (
                      <>
                        Thanks — your feedback went straight to us, no account needed. We read every note and use it to decide what to build next.
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
                /* Form View. The form is a flex column filling the modal; only
                   the inner field region scrolls, so the footer stays pinned. */
                <form className="flex-1 min-h-0 flex flex-col">
                  {/* Scrolling field region — cuts off under the pinned footer,
                      which signals there is more form above/below. */}
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4">
                  {/* Subject Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-xs ${THEME_GLASS.TEXT_MUTED} tracking-wider font-semibold select-none`}>
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
                    <label className={`text-xs ${THEME_GLASS.TEXT_MUTED} tracking-wider font-semibold select-none`}>
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
                    <label className={`text-xs ${THEME_GLASS.TEXT_MUTED} tracking-wider font-semibold select-none`}>
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
                          <span className={`text-xs ${THEME_GLASS.TEXT_MUTED}`}>No workspace to preview yet.</span>
                        </div>
                      )
                    ) : shareMode === 'equation' ? (
                      activeEquation ? (
                        <div className={`max-h-40 overflow-auto p-4 flex items-center justify-center ${THEME_GLASS.TREE_BG}`}>
                          <EquationPreviewRow eq={activeEquation} />
                        </div>
                      ) : (
                        <div className={`h-20 flex items-center justify-center text-center px-4 ${THEME_GLASS.TREE_BG}`}>
                          <span className={`text-xs ${THEME_GLASS.TEXT_MUTED}`}>No equation to preview yet.</span>
                        </div>
                      )
                    ) : (
                      <div className={`h-20 flex items-center justify-center text-center px-4 ${THEME_GLASS.TREE_BG}`}>
                        <span className={`text-xs ${THEME_GLASS.TEXT_MUTED}`}>Nothing from your workspace will be attached.</span>
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
                            className={`flex items-center justify-center gap-1.5 px-2 py-2 h-9 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${active ? THEME_GLASS.BUTTON_SECONDARY_ACCENT : THEME_GLASS.BUTTON_SECONDARY}`}
                          >
                            <Icon size={12} />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <p className={`text-xs ${THEME_GLASS.TEXT_MUTED} leading-snug`}>{SHARE_HINT[shareMode]}</p>
                  </div>

                  {errorStr && (
                    <div className={`flex items-start gap-2 text-xs p-2.5 animate-[fadeIn_0.2s_ease-out] ${THEME_GLASS.BUTTON_DANGER}`}>
                      <X size={13} className="shrink-0 mt-0.5" />
                      <span>{errorStr}</span>
                    </div>
                  )}
                  </div>
                  {/* End scrolling field region. */}

                  {/* Pinned footer — stays put while the fields scroll under it.
                      Two orthogonal axes: the GitHub switch chooses the
                      destination, the two colored buttons choose the type + submit. */}
                  <div className={`flex flex-col gap-3 pt-4 border-t ${THEME_GLASS.PANEL_BORDER_SUBTLE}`}>
                    {/* Destination switch — off by default (account-free path). */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-white/85 flex items-center gap-1.5 select-none">
                          <Github size={12} /> Open on GitHub instead
                        </span>
                        <span className={`text-xs leading-snug ${THEME_GLASS.TEXT_MUTED}`}>
                          {postToGithub
                            ? 'Opens a pre-filled issue for you to submit — needs a GitHub account.'
                            : 'Off: sent straight to us, no account needed.'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPostToGithub((v) => !v)}
                        role="switch"
                        aria-checked={postToGithub}
                        aria-label="Open feedback as a GitHub issue instead of sending it directly"
                        className={`${THEME_GLASS.TOGGLE_TRACK} ${postToGithub ? THEME_GLASS.TOGGLE_TRACK_ON : THEME_GLASS.TOGGLE_TRACK_OFF}`}
                      >
                        <span className={`${THEME_GLASS.TOGGLE_KNOB} ${postToGithub ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Submit row: Cancel + the two colored type buttons. The
                        leading icon flips to GitHub when the switch is on, so the
                        destination is never a hidden mode. */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleClose}
                        className={`px-4 py-2 h-9 text-xs font-semibold cursor-pointer text-center ${THEME_GLASS.BUTTON_SECONDARY}`}
                      >
                        Cancel
                      </button>

                      <div className="grid grid-cols-2 gap-2 flex-1">
                        <button
                          type="button"
                          onClick={() => { void handleSubmit('feature'); }}
                          disabled={!canSubmit || isSubmitting}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 h-9 text-xs font-bold text-center disabled:opacity-40 disabled:cursor-not-allowed ${THEME_GLASS.BUTTON_WARNING_FILL}`}
                        >
                          {postToGithub ? <Github size={12} /> : <Lightbulb size={12} />}
                          <span>Feature</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { void handleSubmit('bug'); }}
                          disabled={!canSubmit || isSubmitting}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 h-9 text-xs font-bold text-center disabled:opacity-40 disabled:cursor-not-allowed ${THEME_GLASS.BUTTON_DANGER_FILL}`}
                        >
                          {postToGithub ? <Github size={12} /> : <Bug size={12} />}
                          <span>Bug</span>
                        </button>
                      </div>
                    </div>

                    {/* Security is a distinct, rarely-used private route. */}
                    <button
                      type="button"
                      onClick={handleSecurity}
                      title="Report a security vulnerability privately"
                      className={`self-start flex items-center gap-1.5 ${THEME_GLASS.TEXT_BUTTON_MUTED}`}
                    >
                      <ShieldAlert size={12} />
                      <span>Found a security issue? Report it privately</span>
                    </button>
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
