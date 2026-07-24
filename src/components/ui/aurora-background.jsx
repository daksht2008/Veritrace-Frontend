import { cn } from "@/lib/utils";
import React from "react";

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}) => {
  return (
    <div
      className={cn("transition-bg relative flex flex-col", className)}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary aurora layer */}
        <div
          style={{
            position: "absolute",
            inset: "-10px",
            backgroundImage: [
              "repeating-linear-gradient(100deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%)",
              "repeating-linear-gradient(100deg, #12AAFF 10%, #00D395 15%, #5135d9 20%, #12AAFF 25%, #AE48FF 30%)",
            ].join(", "),
            backgroundSize: "300% 200%",
            backgroundPosition: "50% 50%",
            opacity: 0.35,
            filter: "blur(10px)",
            willChange: "transform",
            animation: "aurora-flow 60s linear infinite",
            ...(showRadialGradient
              ? {
                  maskImage:
                    "radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)",
                  WebkitMaskImage:
                    "radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)",
                }
              : {}),
          }}
        />
        {/* Secondary aurora layer (after pseudo-element equivalent) */}
        <div
          style={{
            position: "absolute",
            inset: "-10px",
            backgroundImage: [
              "repeating-linear-gradient(100deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%)",
              "repeating-linear-gradient(100deg, #12AAFF 10%, #00D395 15%, #5135d9 20%, #12AAFF 25%, #AE48FF 30%)",
            ].join(", "),
            backgroundSize: "200% 100%",
            backgroundAttachment: "fixed",
            mixBlendMode: "difference",
            opacity: 0.4,
            animation: "aurora-flow 60s linear infinite",
            ...(showRadialGradient
              ? {
                  maskImage:
                    "radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)",
                  WebkitMaskImage:
                    "radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)",
                }
              : {}),
          }}
        />
      </div>
      {children}
    </div>
  );
};
