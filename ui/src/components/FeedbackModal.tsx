'use client';

import React from 'react';
import { useAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Bug, Lightbulb, Star, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
import { feedbackModalOpenAtom } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';

type FeedbackType = 'bug' | 'feature' | 'general';

export const FeedbackModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(feedbackModalOpenAtom);
  const [type, setType] = React.useState<FeedbackType>('general');
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [rating, setRating] = React.useState<number>(0);
  const [hoveredRating, setHoveredRating] = React.useState<number>(0);
  const [email, setEmail] = React.useState('');
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
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
    setType('general');
    setSubject('');
    setMessage('');
    setRating(0);
    setEmail('');
    setIsSuccess(false);
    setErrorStr(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    // Add brief timeout to reset form only after animation completes
    setTimeout(resetForm, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setErrorStr('Subject and message are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorStr(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          subject: subject.trim(),
          message: message.trim(),
          rating: rating > 0 ? rating : undefined,
          email: email.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit feedback.');
      }

      setIsSuccess(true);
    } catch (err) {
      setErrorStr(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
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
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
                  >
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white">Thank You!</h3>
                  <p className="text-sm text-zinc-400 mt-2 max-w-sm">
                    Your feedback has been successfully submitted. We appreciate your help in refining Algebranch!
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
                        onClick={() => setType('general')}
                        className={`flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                          type === 'general'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <MessageSquare size={13} />
                        <span>General</span>
                      </button>
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
                        <span>Bug Report</span>
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
                        <span>Idea</span>
                      </button>
                    </div>
                  </div>

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
                          ? 'Describe the bug in a few words...'
                          : type === 'feature'
                          ? 'What feature would you like to see?'
                          : 'General comments or suggestions...'
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
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@example.com (so we can reply to you)"
                      className="w-full h-9 px-3 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-medium"
                    />
                  </div>

                  {errorStr && (
                    <div className="flex items-start gap-2 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 animate-[fadeIn_0.2s_ease-out]">
                      <ShieldAlert size={13} className="shrink-0 mt-0.5" />
                      <span>{errorStr}</span>
                    </div>
                  )}

                  {/* Footer Submit Buttons */}
                  <div className="flex items-center justify-end gap-3 mt-2 border-t border-white/5 pt-4">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleClose}
                      className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-xs font-semibold text-white/80 hover:text-white bg-white/0 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all duration-150 active:scale-95 cursor-pointer ${
                        type === 'bug'
                          ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
                          : type === 'feature'
                          ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                          : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send size={12} />
                          <span>Submit Feedback</span>
                        </>
                      )}
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
