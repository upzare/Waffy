import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type TouchEvent,
  type WheelEvent,
} from "react";

const PIN_THRESHOLD_PX = 80;
const SCROLLBAR_EDGE_PX = 14;
const SMOOTH_JUMP_FALLBACK_MS = 2000;

function distanceFromBottom(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

function nearBottom(el: HTMLElement) {
  return distanceFromBottom(el) < PIN_THRESHOLD_PX;
}

function afterPaint(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

type StickyScrollFollow = {
  conversationId: string | null;
  messages: readonly { id: string }[];
  streaming: unknown;
  toolActivityText: unknown;
  isGenerating: unknown;
  hidden: unknown;
};

/**
 * Sticky bottom follow while content grows, without fighting user scroll-up.
 *
 * - Auto-follow is always instant (streaming, chat load, layout).
 * - Smooth scrolling is opt-in via `jumpToBottom()` (send prompt, jump button).
 * - Conversation switches re-pin and snap instantly (no animation).
 */
export function useStickyScroll({
  conversationId,
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
  const retargetRafRef = useRef(0);
  const touchYRef = useRef<number | null>(null);
  const scrollbarDragRef = useRef(false);
  const smoothJumpRef = useRef(false);
  const smoothTimerRef = useRef(0);
  const onScrollEndRef = useRef<(() => void) | null>(null);
  const conversationIdRef = useRef(conversationId);
  const seenUserIdsRef = useRef(new Set<string>());
  const [atBottom, setAtBottom] = useState(true);

  const snapBottom = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  };

  const clearRaf = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (retargetRafRef.current) cancelAnimationFrame(retargetRafRef.current);
    rafRef.current = 0;
    retargetRafRef.current = 0;
  };

  const clearSmoothListeners = () => {
    if (smoothTimerRef.current) {
      clearTimeout(smoothTimerRef.current);
      smoothTimerRef.current = 0;
    }
    if (onScrollEndRef.current && containerRef.current) {
      containerRef.current.removeEventListener("scrollend", onScrollEndRef.current);
      onScrollEndRef.current = null;
    }
  };

  const endSmoothJump = (settle = false) => {
    if (!smoothJumpRef.current) return;
    smoothJumpRef.current = false;
    clearSmoothListeners();

    if (!settle || !pinnedRef.current) {
      const el = containerRef.current;
      setAtBottom(!el || nearBottom(el));
      return;
    }

    snapBottom();
    afterPaint(() => {
      if (pinnedRef.current) snapBottom();
    });
  };

  const release = () => {
    pinnedRef.current = false;
    endSmoothJump();
    clearRaf();
  };

  const syncPin = () => {
    const el = containerRef.current;
    if (!el) return;
    const pinned = nearBottom(el);
    pinnedRef.current = pinned;
    setAtBottom(pinned);
  };

  const followBottom = () => {
    if (!pinnedRef.current || smoothJumpRef.current) return;
    snapBottom();
  };

  const scheduleFollow = () => {
    if (!pinnedRef.current || rafRef.current || smoothJumpRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      followBottom();
      // Same burst may grow again after this paint (Streamdown / layout).
      requestAnimationFrame(followBottom);
    });
  };

  const retargetSmooth = () => {
    if (retargetRafRef.current || !smoothJumpRef.current || !pinnedRef.current) return;

    retargetRafRef.current = requestAnimationFrame(() => {
      retargetRafRef.current = 0;
      const el = containerRef.current;
      if (!smoothJumpRef.current || !pinnedRef.current || !el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  };

  const jumpToBottom = () => {
    const el = containerRef.current;
    if (!el) return;

    pinnedRef.current = true;
    setAtBottom(true);
    clearSmoothListeners();
    smoothJumpRef.current = true;

    afterPaint(() => {
      if (!containerRef.current || !smoothJumpRef.current) return;
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
      const onScrollEnd = () => endSmoothJump(true);
      onScrollEndRef.current = onScrollEnd;
      containerRef.current.addEventListener("scrollend", onScrollEnd, { once: true });
      smoothTimerRef.current = window.setTimeout(() => endSmoothJump(true), SMOOTH_JUMP_FALLBACK_MS);
    });
  };

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(() => {
      if (smoothJumpRef.current) retargetSmooth();
      else if (pinnedRef.current) scheduleFollow();
      else if (containerRef.current) setAtBottom(nearBottom(containerRef.current));
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      clearRaf();
      clearSmoothListeners();
    };
  }, []);

  useEffect(() => {
    scheduleFollow();
    if (!pinnedRef.current && containerRef.current) {
      setAtBottom(nearBottom(containerRef.current));
    }
  }, [messages, streaming, toolActivityText, isGenerating, hidden]);

  useEffect(() => {
    pinnedRef.current = true;
    setAtBottom(true);
    endSmoothJump();
    clearRaf();
    afterPaint(() => {
      snapBottom();
    });
  }, [conversationId]);

  useEffect(() => {
    const userIds = messages.filter((msg) => msg.id.startsWith("user-")).map((msg) => msg.id);
    const conversationChanged = conversationIdRef.current !== conversationId;
    conversationIdRef.current = conversationId;

    if (conversationChanged) {
      seenUserIdsRef.current = new Set(userIds);
      return;
    }

    const sentUserId = userIds.find((id) => !seenUserIdsRef.current.has(id));
    seenUserIdsRef.current = new Set(userIds);
    if (sentUserId) jumpToBottom();
  }, [conversationId, messages]);

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
    if (!smoothJumpRef.current) {
      const el = containerRef.current;
      setAtBottom(!el || nearBottom(el));
    }
    if (!scrollbarDragRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    if (nearBottom(el)) pinnedRef.current = true;
    else release();
  };

  return {
    containerRef,
    contentRef,
    atBottom,
    jumpToBottom,
    onWheel,
    onTouchStart,
    onTouchMove,
    onPointerDown,
    onPointerUp,
    onScroll,
  };
}
