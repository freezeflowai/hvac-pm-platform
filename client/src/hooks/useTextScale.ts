import { useEffect, useState } from "react";

const STORAGE_KEY = "textScale";

type TextScale = "normal" | "large";

export function useTextScale() {
  const [scale, setScale] = useState<TextScale>("normal");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved =
      window.localStorage.getItem(STORAGE_KEY) === "large" ? "large" : "normal";

    setScale(saved);
    applyClass(saved);
  }, []);

  const applyClass = (value: TextScale) => {
    if (typeof document === "undefined") return;

    const html = document.documentElement;

    if (value === "large") {
      html.classList.add("text-scale-large");
    } else {
      html.classList.remove("text-scale-large");
    }
  };

  const toggleScale = () => {
    setScale((prev) => {
      const next: TextScale = prev === "normal" ? "large" : "normal";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
      applyClass(next);
      return next;
    });
  };

  return { scale, toggleScale };
}
