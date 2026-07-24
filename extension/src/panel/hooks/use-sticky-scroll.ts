import { useEffect, useRef, type PointerEvent, type TouchEvent, type WheelEvent } from "react";

const PIN_THRESHOLD_PX = 80;
const SCROLLBAR_EDGE_PX = 14;

function distanceFromBottom(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

type StickyScrollFollow = {
  messages: unknown;
  streaming: unknown;
  toolActivityText: unknown;
  isGenerating: unknown;
  hidden: unknown;
};

/**
 * Keeps a scroll container stuck to the bottom while content grows
 * (streaming markdown, loaders), without fighting user scroll-up.
 *
 * Pin updates only from user gestures — programmatic scrolls never
 * clear the pin (important for fast token streams).
 */
export function useStickyScroll({
  messages,
  streaming,
  toolActivityText,
  isGenerating,
  hidden,
}: StickyScrollFollow) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const rafRef = useRef(0);
  const touchYRef = useRef<number | null>(null);
  const scrollbarDragRef = useRef(false);

  const release = () => {
    pinnedRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  };

  const syncPin = () => {
    const el = containerRef.current;
    if (!el) return;
    pinnedRef.current = distanceFromBottom(el) < PIN_THRESHOLD_PX;
  };

  const scrollToBottom = () => {
    const el = containerRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  };

  const scheduleScroll = () => {
    if (!pinnedRef.current || rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      scrollToBottom();
      // Same burst may grow again after this paint (Streamdown / layout).
      requestAnimationFrame(scrollToBottom);
    });
  };

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(scheduleScroll);
    observer.observe(content);
    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    scheduleScroll();
  }, [messages, streaming, toolActivityText, isGenerating, hidden]);

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0) release();
    else requestAnimationFrame(syncPin);
  };

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchYRef.current = e.touches[0]?.clientY ?? null;
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    const y = e.touches[0]?.clientY;
    if (y == null || touchYRef.current == null) return;

    const delta = y - touchYRef.current;
    touchYRef.current = y;

    if (delta > 0) release();
    else requestAnimationFrame(syncPin);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    scrollbarDragRef.current = el.getBoundingClientRect().right - e.clientX <= SCROLLBAR_EDGE_PX;
  };

  const onPointerUp = () => {
    scrollbarDragRef.current = false;
  };

  const onScroll = () => {
    if (!scrollbarDragRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    if (distanceFromBottom(el) >= PIN_THRESHOLD_PX) release();
    else pinnedRef.current = true;
  };

  return {
    containerRef,
    contentRef,
    onWheel,
    onTouchStart,
    onTouchMove,
    onPointerDown,
    onPointerUp,
    onScroll,
  };
}
