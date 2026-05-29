'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { flightStateAtom } from '../store/equation';
import { THEME_ANIMATIONS } from '../constants/theme';

export const FlightCanvas: React.FC = () => {
  const flightState = useAtomValue(flightStateAtom);
  const elementRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!flightState || !elementRef.current) return;

    const el = elementRef.current;
    const { startX, startY, endX, endY } = flightState;

    // 1. Calculate Quadratic Bezier control point (height apex at the middle)
    const controlX = (startX + endX) / 2;
    // Apex is 120px higher than the highest point, providing a natural upward arc
    const controlY = Math.min(startY, endY) - 120;

    // 2. Build mathematical Bezier trajectory keyframes (60 points for high-density curves)
    const keyframes = [];
    const steps = 60;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
      const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;

      // Premium finesse: dip scale slightly in the apex of the flight arc,
      // and apply a subtle fade-in and fade-out near endpoints
      const scale = 1 - 0.25 * Math.sin(t * Math.PI);
      const opacity = t < 0.05 ? t * 20 : t > 0.95 ? (1 - t) * 20 : 1;

      keyframes.push({
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
        opacity: opacity,
      });
    }

    // 3. Trigger hardware-accelerated Web Animations API
    const anim = el.animate(keyframes, {
      duration: THEME_ANIMATIONS.TRANSITION_DURATION_MS,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // Premium cubic ease
      fill: 'forwards',
    });

    return () => {
      anim.cancel();
    };
  }, [flightState]);

  if (!flightState) return null;

  return (
    <div className="absolute left-0 top-0 w-full h-full pointer-events-none z-50 overflow-hidden">
      <div
        ref={elementRef}
        className={flightState.className}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: flightState.width,
          height: flightState.height,
          pointerEvents: 'none',
          boxShadow: '0 0 20px rgba(99, 102, 241, 0.6), inset 0 0 10px rgba(99, 102, 241, 0.3)',
          borderColor: 'rgba(129, 140, 248, 0.8)',
          backgroundColor: 'rgba(15, 15, 20, 0.9)',
          transform: `translate(${flightState.startX}px, ${flightState.startY}px)`,
        }}
      >
        {/* Neon glow backdrop */}
        <div className="absolute -inset-2 bg-indigo-500/25 blur-lg rounded-lg -z-10 animate-pulse pointer-events-none" />
        
        {/* Mathematical term inner HTML clone */}
        <div 
          className="w-full h-full flex items-center justify-center pointer-events-none"
          dangerouslySetInnerHTML={{ __html: flightState.html }} 
        />
      </div>
    </div>
  );
};
