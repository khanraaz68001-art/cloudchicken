// Simple bell sound generator using Web Audio API
export const generateBellSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const createBellTone = (frequency: number, startTime: number, duration: number) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gainNode.gain.setValueAtTime(0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };
  
  const now = audioContext.currentTime;
  
  // Create a bell-like sound with multiple harmonics
  createBellTone(800, now, 1.0);        // Fundamental
  createBellTone(1200, now, 0.8);       // First harmonic
  createBellTone(1600, now, 0.6);       // Second harmonic
  createBellTone(2000, now, 0.4);       // Third harmonic
  
  // Add a slight delay for the second chime
  setTimeout(() => {
    const now2 = audioContext.currentTime;
    createBellTone(800, now2, 1.0);
    createBellTone(1200, now2, 0.8);
    createBellTone(1600, now2, 0.6);
    createBellTone(2000, now2, 0.4);
  }, 300);
};