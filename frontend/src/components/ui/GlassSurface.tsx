import { type ReactNode } from "react";

interface GlassSurfaceProps {
  children: ReactNode;
  className?: string;
  intensity?: "light" | "medium" | "heavy";
}

/**
 * Translucent glass-morphism header bar component.
 * Uses backdrop-blur + subtle border for a macOS-style glass feel.
 */
export default function GlassSurface({
  children,
  className = "",
  intensity = "medium",
}: GlassSurfaceProps) {
  const blurMap = {
    light: "backdrop-blur-md",
    medium: "backdrop-blur-xl",
    heavy: "backdrop-blur-2xl",
  };

  return (
    <div
      className={`
        ${blurMap[intensity]}
        backdrop-saturate-150        bg-card/50
        border-b border-border/30
        ${className}
      `}
    >
      {children}
    </div>
  );
}
