export function smoothScroll(): ScrollBehavior {
  const still =
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return still ? "auto" : "smooth";
}
