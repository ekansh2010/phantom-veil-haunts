import { useEffect, useCallback } from "react";

const FlashlightCursor = () => {
  const handleMouseMove = useCallback((e: MouseEvent) => {
    document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
    document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 hidden md:block"
      style={{
        background: `radial-gradient(circle 240px at var(--mouse-x, 50vw) var(--mouse-y, 50vh), rgba(160, 0, 0, 0.05) 0%, rgba(10, 0, 0, 0.02) 40%, transparent 100%)`,
      }}
    />
  );
};

export default FlashlightCursor;
