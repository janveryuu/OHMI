"use client";
import { motion, useReducedMotion } from "motion/react";

// App Router owns the route lifetime. Animate entries without retaining stale routes.
export default function Template({ children }: { children: React.ReactNode }) {
  // MotionConfig in the root also applies the explicit in-app preference.
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 1, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 340, damping: 32 }
      }
    >
      {children}
    </motion.div>
  );
}
