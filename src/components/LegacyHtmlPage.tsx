"use client";

import { useEffect, useRef } from "react";

type LegacyHtmlPageProps = {
  html: string;
  script?: string;
  className?: string;
};

export default function LegacyHtmlPage({
  html,
  script,
  className,
}: LegacyHtmlPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!script?.trim()) return;

    const run = () => {
      try {
        const fn = new Function(script);
        fn();
      } catch (err) {
        console.error("[LegacyHtmlPage] script error:", err);
      }
    };

    const id = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(id);
  }, [script]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
