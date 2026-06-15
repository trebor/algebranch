'use client';

import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Bug, Lightbulb, Star, Send, CheckCircle2, Paperclip } from 'lucide-react';
import { feedbackModalOpenAtom, feedbackContextAtom, historyTreeAtom, HistoryNode, currentNodeIdAtom } from '../store/equation';
import { equationToString } from 'math-engine-client';
import { trackEvent } from '../utils/analytics';
import { THEME_GLASS } from '../constants/theme';

type FeedbackType = 'bug' | 'feature' | 'other';

const formatHistoryTree = (tree: Record<string, HistoryNode>, currentNodeId: string | null): string => {
  const root = tree["0"];
  if (!root) return "Empty history";

  // Build temporary indices map based on sorted timestamp
  const sortedNodes = Object.values(tree).sort((a, b) => a.timestamp - b.timestamp);
  const stepIndices = new Map<string, number>();
  sortedNodes.forEach((n, idx) => stepIndices.set(n.id, idx));

  const formatNode = (nodeId: string, depth: number): string => {
    const node = tree[nodeId];
    if (!node) return "";
    
    const stepNum = stepIndices.get(nodeId) ?? 0;
    const eqStr = equationToString(node.equation);
    const indent = "  ".repeat(depth);
    const isSelected = nodeId === currentNodeId ? " <- Current Selected Step" : "";
    let line = `${indent}- Step ${stepNum} (${node.label}): ${eqStr}${isSelected}\n`;
    
    const children = node.childrenIds
      .map(cid => tree[cid])
      .filter(Boolean)
      .sort((a, b) => a!.timestamp - b!.timestamp);

    for (const child of children) {
      line += formatNode(child!.id, depth + 1);
    }
    return line;
  };

  return formatNode("0", 0);
};

export const FeedbackModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(feedbackModalOpenAtom);
  const context = useAtomValue(feedbackContextAtom);
  const tree = useAtomValue(historyTreeAtom);
  const currentNodeId = useAtomValue(currentNodeIdAtom);
  
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [rating, setRating] = React.useState<number>(0);
  const [hoveredRating, setHoveredRating] = React.useState<number>(0);
  
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [successTypeLabel, setSuccessTypeLabel] = React.useState('');
  const [errorStr, setErrorStr] = React.useState<string | null>(null);

  const resetForm = React.useCallback(() => {
    setSubject('');
    setMessage('');
    setRating(0);
    setIsSuccess(false);
    setSuccessTypeLabel('');
    setErrorStr(null);
  }, []);

  // Focus trap and escape key handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, setIsOpen]);

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

  const handleSubmitType = (e: React.FormEvent, feedbackType: FeedbackType) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setErrorStr('Subject and message are required.');
      return;
    }

    try {
      const typeLabel = feedbackType === 'bug' ? 'Bug Report' : feedbackType === 'feature' ? 'Feature Request' : 'General/Other';
      setSuccessTypeLabel(typeLabel);
      
      const formattedTree = formatHistoryTree(tree, currentNodeId);
      const bodyText = `Feedback Type: ${typeLabel}
Rating: ${rating > 0 ? `${rating}/5` : 'Not rated'}

Message:
${message.trim()}

--------------------------------------
App Context:
${context || 'No specific context attached'}

--------------------------------------
History Tree:
${formattedTree}
`;

      const mailtoUrl = `mailto:feedback@algebranch.com?subject=${encodeURIComponent(
        `[Algebranch Feedback] ${typeLabel}: ${subject.trim()}`
      )}&body=${encodeURIComponent(bodyText)}`;

      // Launch the email client in a new tab/window
      window.open(mailtoUrl, '_blank');

      trackEvent({
        action: 'submit_feedback',
        category: 'feedback',
        label: feedbackType,
      });

      // Show success step explaining that their mail client has been opened
      setIsSuccess(true);
    } catch (err) {
      setErrorStr('Failed to open your mail client. Please try again.');
    }
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
                <h2 className="text-lg font-bold text-white tracking-wide">Share Feedback</h2>
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
                  <h3 className="text-xl font-bold text-white">{successTypeLabel} Drafted!</h3>
                  <p className="text-sm text-zinc-400 mt-2 max-w-sm">
                    We&apos;ve opened your mail client with your feedback pre-written. Please press <strong>Send</strong> in your mail application to complete the submission.
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
                  {/* Context Attachment Display */}
                  {context && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-300 select-none">
                      <Paperclip size={13} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] uppercase tracking-wider font-bold text-indigo-400">
                          Including Context
                        </div>
                        <div className="text-[11px] font-mono truncate font-semibold">
                          {context}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subject Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-[10px] ${THEME_GLASS.TEXT_MUTED} uppercase tracking-wider font-semibold select-none`}>
                      Subject
                    </label>
                    <input
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
                      placeholder="Explain your thoughts, steps to reproduce, or details about your request..."
                      className={`w-full p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-medium resize-none ${THEME_GLASS.FIELD_SELECT}`}
                    />
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
                        onClick={(e) => handleSubmitType(e, 'bug')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 h-9 text-xs font-bold text-center ${THEME_GLASS.BUTTON_DANGER_FILL}`}
                      >
                        <Bug size={12} />
                        <span>Report Bug</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={(e) => handleSubmitType(e, 'feature')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 h-9 text-xs font-bold text-center ${THEME_GLASS.BUTTON_WARNING_FILL}`}
                      >
                        <Lightbulb size={12} />
                        <span>Idea</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={(e) => handleSubmitType(e, 'other')}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 h-9 text-xs font-bold text-center ${THEME_GLASS.BUTTON_PRIMARY}`}
                      >
                        <MessageSquare size={12} />
                        <span>Other</span>
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
