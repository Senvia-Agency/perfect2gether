import { motion, AnimatePresence, Variants } from "framer-motion";
import { ReactNode } from "react";

interface StepContainerProps {
  stepKey: number;
  children: ReactNode;
}

const slideVariants: Variants = {
  enter: {
    y: 40,
    opacity: 0,
  },
  center: {
    y: 0,
    opacity: 1,
  },
  exit: {
    y: -40,
    opacity: 0,
  },
};

export const StepContainer = ({ stepKey, children }: StepContainerProps) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
