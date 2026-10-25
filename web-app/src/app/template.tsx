"use client";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

// App Router owns the route lifetime. Animate entries without retaining stale routes.
export default function Template({ children }: { children: React.ReactNode }) {
  // MotionConfig in the root also applies the explicit in-app preference.
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.div
      initial={reduced || !mounted ? false : { opacity: 1, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced || !mounted
          ? { duration: 0 }
          : { type: "spring", stiffness: 340, damping: 32 }
      }
    >
      {children}
    </motion.div>
  );
}
