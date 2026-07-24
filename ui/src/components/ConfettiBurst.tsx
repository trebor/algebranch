// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { motion } from 'framer-motion';

const CONFETTI_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#38bdf8', '#fb7185'];

function makeConfettiPieces() {
  return Array.from({ length: 28 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.8 + Math.random() * 1.4,
    size: 5 + Math.random() * 5,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    drift: (Math.random() - 0.5) * 120,
    rotate: 360 + Math.random() * 540,
  }));
}

export const ConfettiBurst: React.FC = () => {
  const pieces = React.useMemo(() => makeConfettiPieces(), []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-50" aria-hidden="true">
      {pieces.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-[2px]"
          style={{
            left: `${p.left}%`,
            top: '-3%',
            width: p.size,
            height: p.size * 0.45,
            backgroundColor: p.color,
          }}
          initial={{ y: 0, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '108vh', x: p.drift, opacity: [1, 1, 0.85, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
};
