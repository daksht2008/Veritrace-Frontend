import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useTransform,
  useScroll,
  useSpring,
} from "framer-motion";

export const TracingBeam = ({ children, className }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const contentRef = useRef(null);
  const [svgHeight, setSvgHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setSvgHeight(contentRef.current.offsetHeight);
    }
  }, []);

  const y1 = useSpring(
    useTransform(scrollYProgress, [0, 0.8], [50, svgHeight]),
    { stiffness: 500, damping: 90 }
  );
  const y2 = useSpring(
    useTransform(scrollYProgress, [0, 1], [50, svgHeight - 200]),
    { stiffness: 500, damping: 90 }
  );

  return (
    <motion.div
      ref={ref}
      className={`relative w-full ${className || ''}`}
    >
      {/* Beam rail — fixed to left viewport edge, top-aligned under the navbar */}
      <div className="fixed left-4 top-0 bottom-0 pointer-events-none z-30">
        <div className="relative h-full">
          {/* Glowing start dot — offset below navbar height (~64px) */}
          <motion.div
            transition={{ duration: 0.2, delay: 0.5 }}
            animate={{
              boxShadow:
                scrollYProgress.get() > 0
                  ? "none"
                  : "0 0 10px 3px rgba(18, 170, 255, 0.6)",
            }}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-2)] shadow-sm"
            style={{ marginTop: "68px" }}
          >
            <motion.div
              transition={{ duration: 0.2, delay: 0.5 }}
              animate={{
                backgroundColor:
                  scrollYProgress.get() > 0 ? "var(--bg-3)" : "#12AAFF",
              }}
              className="h-2 w-2 rounded-full bg-[var(--bg-3)]"
            />
          </motion.div>

          {/* Animated beam SVG line */}
          <svg
            viewBox={`0 0 20 ${svgHeight}`}
            width="20"
            height={svgHeight}
            className="ml-1.5 block"
            aria-hidden="true"
            style={{ marginTop: "2px" }}
          >
            {/* Subtle grey track */}
            <motion.path
              d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`}
              fill="none"
              stroke="#9091A0"
              strokeOpacity="0.12"
              transition={{ duration: 10 }}
            />
            {/* Glowing gradient beam */}
            <motion.path
              d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`}
              fill="none"
              stroke="url(#vt-gradient)"
              strokeWidth="1.5"
              transition={{ duration: 10 }}
            />
            <defs>
              <motion.linearGradient
                id="vt-gradient"
                gradientUnits="userSpaceOnUse"
                x1="0"
                x2="0"
                y1={y1}
                y2={y2}
              >
                <stop stopColor="#12AAFF" stopOpacity="0" />
                <stop stopColor="#12AAFF" />
                <stop offset="0.4" stopColor="#00D395" />
                <stop offset="1" stopColor="#AE48FF" stopOpacity="0" />
              </motion.linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Page content — full width, not constrained */}
      <div ref={contentRef} className="w-full">
        {children}
      </div>
    </motion.div>
  );
};
