"use client";

import { useEffect, useRef } from "react";

const DOT_SIZES = [12, 10, 8, 6, 4] as const;
const DOT_OPACITIES = [1, 0.8, 0.6, 0.4, 0.2] as const;
const IDLE_FADE_DELAY = 100;

type Point = { x: number; y: number };

export default function CursorTrail() {
  const dotRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const supportsPointerEffect = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsPointerEffect || prefersReducedMotion) return;

    const points: Point[] = [];
    let fadeTimer: number | undefined;

    const hideTrail = () => {
      window.clearTimeout(fadeTimer);
      dotRefs.current.forEach((dot) => {
        if (dot) dot.style.opacity = "0";
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      const point = { x: event.clientX, y: event.clientY };

      if (points.length === 0) {
        DOT_SIZES.forEach(() => points.push(point));
      } else {
        points.unshift(point);
        points.length = DOT_SIZES.length;
      }

      dotRefs.current.forEach((dot, index) => {
        const position = points[index];
        if (!dot || !position) return;

        dot.style.transform = `translate(${position.x}px, ${position.y}px) translate(-50%, -50%)`;
        dot.style.opacity = String(DOT_OPACITIES[index]);
      });

      window.clearTimeout(fadeTimer);
      fadeTimer = window.setTimeout(hideTrail, IDLE_FADE_DELAY);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", hideTrail);
    document.documentElement.addEventListener("pointerleave", hideTrail);

    return () => {
      window.clearTimeout(fadeTimer);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", hideTrail);
      document.documentElement.removeEventListener("pointerleave", hideTrail);
    };
  }, []);

  return (
    <div className="home-cursor-trail" aria-hidden="true">
      {DOT_SIZES.map((size, index) => (
        <div
          className="home-cursor-trail-dot"
          key={size}
          ref={(element) => {
            dotRefs.current[index] = element;
          }}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}
