import React from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, Variants } from 'framer-motion';

type AnimationType = 'fade' | 'slide' | 'zoom';

const variants: Record<AnimationType, Variants> = {
  fade: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  slide: {
    initial: { x: 120, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -120, opacity: 0 },
  },
  zoom: {
    initial: { scale: 0.98, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.98, opacity: 0 },
  },
};

const PageTransition: React.FC<{ children: React.ReactNode; animation?: AnimationType; duration?: number }> = ({
  children,
  animation = 'fade',
  duration = 0.35,
}) => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname + location.search}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants[animation]}
        transition={{ duration }}
        style={{ minHeight: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
