"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Children, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { defineCopy } from "../lib/i18n";
import { useLocale } from "./locale-provider";

const copy = defineCopy({
  tr: { previous: (title: string) => `${title}: önceki`, next: (title: string) => `${title}: sonraki` },
  en: { previous: (title: string) => `${title}: previous`, next: (title: string) => `${title}: next` },
});

type Edges = { overflow: boolean; atStart: boolean; atEnd: boolean; thumb: number; offset: number };

/**
 * Horizontal card rail for the overview. `perView` cards fit the width; with
 * more, arrow buttons page through them, a mouse can drag the rail, touch and
 * trackpads scroll natively, and a thin bar shows the position. Cards stay
 * ordinary links in the tab order, so keyboard focus scrolls them into view.
 */
export function Carousel({ title, titleId, action, perView = 3, children }: {
  title: string;
  titleId: string;
  action?: ReactNode;
  perView?: number;
  children: ReactNode;
}) {
  const t = copy[useLocale()];
  const track = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [edges, setEdges] = useState<Edges>({ overflow: false, atStart: true, atEnd: true, thumb: 1, offset: 0 });
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    const thumb = element.scrollWidth > 0 ? element.clientWidth / element.scrollWidth : 1;
    setEdges({
      overflow: max > 2,
      atStart: element.scrollLeft <= 2,
      atEnd: element.scrollLeft >= max - 2,
      thumb,
      offset: max > 0 ? (element.scrollLeft / max) * (1 - thumb) : 0,
    });
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", measure); };
  }, [measure]);

  function page(direction: 1 | -1) {
    const element = track.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.92, behavior: "smooth" });
  }

  function onPointerDown(event: PointerEvent<HTMLUListElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0 || !edges.overflow) return;
    drag.current = { x: event.clientX, left: track.current?.scrollLeft ?? 0, moved: false };
  }

  function onPointerMove(event: PointerEvent<HTMLUListElement>) {
    const state = drag.current;
    const element = track.current;
    if (!state || !element) return;
    const delta = event.clientX - state.x;
    if (!state.moved && Math.abs(delta) < 6) return;
    if (!state.moved) {
      state.moved = true;
      setDragging(true);
      element.setPointerCapture(event.pointerId);
    }
    // Pointer coordinates are in screen pixels; the page may be CSS-zoomed.
    const zoom = (element as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
    element.scrollLeft = state.left - delta / zoom;
  }

  function onPointerUp(event: PointerEvent<HTMLUListElement>) {
    const state = drag.current;
    drag.current = null;
    if (!state?.moved) return;
    track.current?.releasePointerCapture(event.pointerId);
    setDragging(false);
    // A drag must not also follow the link under the pointer.
    const swallow = (click: MouseEvent) => { click.preventDefault(); click.stopPropagation(); };
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
  }

  const items = Children.toArray(children);
  return (
    <section aria-labelledby={titleId} className="carousel" style={{ "--per-view": perView } as CSSProperties}>
      <div className="carousel-head">
        <h2 className="section-title" id={titleId}>{title}</h2>
        <div className="carousel-actions">
          {action}
          {edges.overflow && (
            <div className="carousel-arrows">
              <button aria-label={t.previous(title)} className="carousel-arrow" disabled={edges.atStart} onClick={() => page(-1)} type="button"><CaretLeft aria-hidden size={18} weight="bold" /></button>
              <button aria-label={t.next(title)} className="carousel-arrow" disabled={edges.atEnd} onClick={() => page(1)} type="button"><CaretRight aria-hidden size={18} weight="bold" /></button>
            </div>
          )}
        </div>
      </div>
      <ul
        aria-label={title}
        className={`carousel-track${dragging ? " dragging" : ""}${edges.overflow ? " scrollable" : ""}`}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={track}
      >
        {items.map((item, index) => <li className="carousel-item" key={index}>{item}</li>)}
      </ul>
      {edges.overflow && (
        <div aria-hidden="true" className="carousel-progress">
          <span style={{ width: `${edges.thumb * 100}%`, transform: `translateX(${(edges.offset / Math.max(edges.thumb, 0.0001)) * 100}%)` }} />
        </div>
      )}
    </section>
  );
}
