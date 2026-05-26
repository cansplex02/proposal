"use client";

import { useEffect, useRef } from "react";
import ResponsiveEnhancer from "@/components/ResponsiveEnhancer";

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

    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      try {
        const fn = new Function(script);
        fn();
      } catch (err) {
        console.error("[LegacyHtmlPage] script error:", err);
      }
    };

    const id = window.requestAnimationFrame(run);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
      const teardown = (
        window as Window & { __proposalScrollTeardown?: () => void }
      ).__proposalScrollTeardown;
      if (teardown) teardown();
    };
  }, [script]);

  return (
    <>
      <ResponsiveEnhancer />
      <div
        ref={containerRef}
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
