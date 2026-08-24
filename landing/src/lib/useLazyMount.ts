import { useEffect, useRef, useState } from 'react';

/**
 * Mounts heavy content (e.g. a WebGL scene) only once the element scrolls
 * near the viewport, then stays mounted — keeps first paint light.
 */
export function useLazyMount<T extends HTMLElement>(rootMargin = '200px') {
  const ref = useRef<T | null>(null);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || shouldMount) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldMount(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, shouldMount]);

  return { ref, shouldMount };
}
