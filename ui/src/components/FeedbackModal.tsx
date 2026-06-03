'use client';

import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Bug, Lightbulb, Star, Send, CheckCircle2, Paperclip } from 'lucide-react';
import { feedbackModalOpenAtom, feedbackContextAtom } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';

type FeedbackType = 'bug' | 'feature' | 'other';

export const FeedbackModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(feedbackModalOpenAtom);
  const context = useAtomValue(feedbackContextAtom);
  
  const [type, setType] = React.useState<FeedbackType>('other');
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [rating, setRating] = React.useState<number>(0);
  const [hoveredRating, setHoveredRating] = React.useState<number>(0);
  const [email, setEmail] = React.useState('');
  
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [errorStr, setErrorStr] = React.useState<string | null>(null);

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

  const resetForm = () => {
    setType('other');
    setSubject('');
    setMessage('');
    setRating(0);
    setEmail('');
    setIsSuccess(false);
    setErrorStr(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(resetForm, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setErrorStr('Subject and message are required.');
      return;
    }

    try {
      const typeLabel = type === 'bug' ? 'Bug Report' : type === 'feature' ? 'Feature Request' : 'General/Other';
      
      const bodyText = `Feedback Type: ${typeLabel}
Rating: ${rating > 0 ? `${rating}/5` : 'Not rated'}
Contact Email: ${email.trim() || 'Not provided'}

Message:
${message.trim()}

--------------------------------------
App Context:
${context || 'No specific context attached'}
`;

      const mailtoUrl = `mailto:feedback@algebranch.com?subject=${encodeURIComponent(
        `[Algebranch Feedback] ${typeLabel}: ${subject.trim()}`
      )}&body=${encodeURIComponent(bodyText)}`;

      // Launch the email client in a new tab/window
      window.open(mailtoUrl, '_blank');

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
            className={`w-full max-w-lg overflow-hidden relative z-10 flex flex-col p-6 max-h-[90vh] ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            {/* Glow orb */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -z-10 animate-pulse" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none -z-10" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 select-none">
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">Share Feedback</h2>
                <p className="text-xs text-indigo-300 font-semibold tracking-wider uppercase mt-0.5">
                  Help us improve Algebranch
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer"
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
                  <h3 className="text-xl font-bold text-white">Email Drafted!</h3>
                  <p className="text-sm text-zinc-400 mt-2 max-w-sm">
                    We've opened your mail client with your feedback pre-written. Please press <strong>Send</strong> in your mail application to complete the submission.
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-8 px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all duration-150 active:scale-95 shadow-lg shadow-indigo-600/25 cursor-pointer"
                  >
                    Close Window
                  </button>
                </motion.div>
              ) : (
                /* Form View */
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Type Selector (Segmented control) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold select-none">
                      Feedback Type
                    </label>
                    <div className="grid grid-cols-3 gap-2 bg-neutral-950 p-1 rounded-xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => setType('bug')}
                        className={`flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                          type === 'bug'
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Bug size={13} />
                        <span>Report Bug</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('feature')}
                        className={`flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                          type === 'feature'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Lightbulb size={13} />
                        <span>Request Feature</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('other')}
                        className={`flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                          type === 'other'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <MessageSquare size={13} />
                        <span>Other</span>
                      </button>
                    </div>
                  </div>

                  {/* Context Attachment Display */}
                  {context && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl border border-indigo-500/10 bg-indigo-500/5 text-indigo-300 select-none">
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
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold select-none">
                      Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder={
                        type === 'bug'
                          ? 'Describe the issue briefly...'
                          : type === 'feature'
                          ? 'What feature would you like to see?'
                          : 'General comments, questions, or ideas...'
                      }
                      className="w-full h-9 px-3 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-medium"
                    />
                  </div>

                  {/* Message Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold select-none">
                      Description & Details
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        type === 'bug'
                          ? 'What steps did you take? What was the expected result vs. actual result?'
                          : type === 'feature'
                          ? 'Explain how this feature would work and why it would be useful.'
                          : 'Tell us what is on your mind, how we can make this better, etc...'
                      }
                      className="w-full p-3 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-medium resize-none"
                    />
                  </div>

                  {/* Rating Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold select-none">
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

                  {/* Optional Email Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold select-none">
                      Your Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@example.com (if you would like us to follow up)"
                      className="w-full h-9 px-3 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-medium"
                    />
                  </div>

                  {errorStr && (
                    <div className="flex items-start gap-2 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 animate-[fadeIn_0.2s_ease-out]">
                      <X size={13} className="shrink-0 mt-0.5" />
                      <span>{errorStr}</span>
                    </div>
                  )}

                  {/* Footer Submit Buttons */}
                  <div className="flex items-center justify-end gap-3 mt-2 border-t border-white/5 pt-4">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-xs font-semibold text-white/80 hover:text-white bg-white/0 hover:bg-white/5 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all duration-150 active:scale-95 cursor-pointer ${
                        type === 'bug'
                          ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
                          : type === 'feature'
                          ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                          : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25'
                      }`}
                    >
                      <Send size={12} />
                      <span>Draft Email</span>
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
