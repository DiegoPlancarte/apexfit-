import { useEffect, useRef, useState } from 'react';

// Synthesizes crisp audio cues using the Web Audio API without needing external assets
const playTone = (frequency = 600, duration = 0.15, type = 'sine') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Smooth envelope ramp to prevent clicks
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn('AudioContext playback error:', err);
  }
};

export const useComponentLogic = ({ isActive, onComplete, onCancel }) => {
  const [count, setCount] = useState(3);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isActive) return undefined;

    // Play initial audio cue for count 3
    playTone(587.33, 0.16); // D5 note
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }

    const timer1 = setTimeout(() => {
      setCount(2);
      playTone(587.33, 0.16);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(80);
      }
    }, 1000);

    const timer2 = setTimeout(() => {
      setCount(1);
      playTone(587.33, 0.16);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(80);
      }
    }, 2000);

    const timer3 = setTimeout(() => {
      setCount(0); // "GO!"
      playTone(880, 0.32); // A5 high note
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 60, 160]);
      }
    }, 3000);

    const timerFinish = setTimeout(() => {
      if (onCompleteRef.current) {
        onCompleteRef.current();
      }
    }, 3600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timerFinish);
    };
  }, [isActive]);

  return {
    count,
    displayText: count > 0 ? String(count) : 'GO!',
    handleCancel: onCancel,
  };
}
