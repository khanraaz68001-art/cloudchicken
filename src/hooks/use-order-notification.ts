import { useRef, useCallback } from 'react';
import { generateBellSound } from '@/utils/bell-sound';

interface UseOrderNotificationOptions {
  enabled?: boolean;
  volume?: number;
  loop?: boolean;
}

export const useOrderNotification = (options: UseOrderNotificationOptions = {}) => {
  const {
    enabled = true,
    loop = true
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  const playNotification = useCallback(() => {
    if (!enabled || isPlayingRef.current) {
      return;
    }

    try {
      // Play the initial bell sound
      generateBellSound();
      isPlayingRef.current = true;

      if (loop) {
        // Set up looping with a 3-second interval
        intervalRef.current = setInterval(() => {
          if (isPlayingRef.current) {
            generateBellSound();
          }
        }, 3000);
      }
    } catch (err) {
      console.warn('Could not play notification sound:', err);
    }
  }, [enabled, loop]);

  const stopNotification = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  const isPlaying = useCallback(() => {
    return isPlayingRef.current;
  }, []);

  return {
    playNotification,
    stopNotification,
    isPlaying
  };
};