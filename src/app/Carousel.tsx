import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { Movie } from "../shared/model";
import { movieHref } from "../shared/format";
import styles from "./styles.generated";
import { imageVariant, imageSet } from "../shared/media";
function readAngle(node: HTMLElement | null, fallback: number) {
  const transform = node ? getComputedStyle(node).transform : "none";
  if (transform === "none") return fallback;
  const matrix = new DOMMatrixReadOnly(transform);
  return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
}
export function MediaImage(
  props: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string },
) {
  const image = useRef<HTMLImageElement>(null);
  function fallback(el: HTMLImageElement) {
    if (!el.src.endsWith("/fallback-poster.svg")) {
      el.removeAttribute("srcset");
      el.removeAttribute("sizes");
      el.src = "/fallback-poster.svg";
    }
  }
  useEffect(() => {
    const el = image.current;
    if (el?.complete && el.naturalWidth === 0) fallback(el);
  }, [props.src]);
  return (
    <img {...props} ref={image} onError={(e) => fallback(e.currentTarget)} />
  );
}
export function PosterImage({
  movie,
  priority = false,
  kind = "reel",
}: {
  movie: Movie;
  priority?: boolean;
  kind?: "reel" | "detail" | "library";
}) {
  const source = movie.cover?.url ?? "/fallback-poster.svg";
  const widths = kind === "reel" ? [96, 144, 216] : [320, 640, 960];
  return (
    <MediaImage
      src={imageVariant(source, kind === "reel" ? 144 : 640)}
      srcSet={imageSet(source, widths)}
      sizes={
        kind === "reel"
          ? "(max-width:767px) 48px, 72px"
          : kind === "detail"
            ? "(max-width:1023px) 280px, 350px"
            : "(max-width:340px) 288px, (max-width:767px) 44vw, 25vw"
      }
      alt={`《${movie.title}》海报`}
      width="144"
      height="216"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
export function Carousel({
  movies,
  index,
  onSelect,
  children,
  externalSequence = 0,
  externalMotion = false,
}: {
  movies: Movie[];
  index: number;
  onSelect: (index: number, animate: boolean) => void;
  children?: ReactNode;
  externalSequence?: number;
  externalMotion?: boolean;
}) {
  const step = 360 / movies.length;
  const [rotation, setRotation] = useState(-index * step);
  const [duration, setDuration] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const ring = useRef<HTMLDivElement>(null),
    buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const lastExternal = useRef(externalSequence);
  const last = useRef(index),
    focusNext = useRef(false),
    dragged = useRef(false);
  const pointer = useRef<{
    x: number;
    y: number;
    angle: number;
    active: boolean;
    id: number;
  } | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(mq.matches);
    change();
    mq.addEventListener("change", change);
    const visible = () => setHidden(document.hidden);
    visible();
    document.addEventListener("visibilitychange", visible);
    return () => {
      mq.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    if (last.current !== index || lastExternal.current !== externalSequence) {
      const from = readAngle(ring.current, -index * step);
      const target = -index * step;
      const delta = ((((target - from + 540) % 360) + 360) % 360) - 180;
      setDuration(externalMotion && !reduced && !hidden ? 420 : 0);
      setRotation(from + delta);
      last.current = index;
      lastExternal.current = externalSequence;
    }
    if (focusNext.current) {
      buttons.current[index]?.focus();
      focusNext.current = false;
    }
  }, [index, step, externalSequence, externalMotion, reduced, hidden]);
  function currentAngle() {
    const transform = ring.current
      ? getComputedStyle(ring.current).transform
      : "none";
    if (transform === "none") return rotation;
    const m = new DOMMatrixReadOnly(transform);
    return (Math.atan2(m.b, m.a) * 180) / Math.PI;
  }
  function choose(i: number, keyboard = false, release = false) {
    const target = (i + movies.length) % movies.length;
    const animate = !keyboard && !reduced && !hidden;
    const from = currentAngle();
    const delta = ((((-target * step - from + 540) % 360) + 360) % 360) - 180;
    setDuration(animate ? (release ? 280 : 420) : 0);
    setRotation(from + delta);
    last.current = target;
    onSelect(target, animate);
    if (keyboard) focusNext.current = true;
  }
  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || movies.length < 2) return;
    dragged.current = false;
    pointer.current = {
      x: e.clientX,
      y: e.clientY,
      angle: currentAngle(),
      active: false,
      id: e.pointerId,
    };
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    if (!p.active && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
      pointer.current = null;
      return;
    }
    if (!p.active && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      p.active = true;
      dragged.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (p.active && !reduced) {
      e.preventDefault();
      setDuration(0);
      setRotation(p.angle + dx * 0.4);
    }
  }
  function release(e: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    pointer.current = null;
    if (!p) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (p.active) {
      const target = Math.round(-(p.angle + (e.clientX - p.x) * 0.4) / step);
      choose(target, false, true);
    }
  }
  const sole = movies.length === 1;
  return (
    <section
      className={styles.reel}
      aria-label="电影转盘"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          choose(index + (e.key === "ArrowRight" ? 1 : -1), true);
        } else if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          choose(e.key === "Home" ? 0 : movies.length - 1, true);
        } else if (
          e.key === "Enter" &&
          (e.target as HTMLElement).dataset.poster === "true"
        ) {
          e.preventDefault();
          navigate(movieHref(movies[index].id));
        }
      }}
    >
      <div className={styles.reelLabel}>
        <span>THE REEL</span>
        <span>选一部，把时间交给电影</span>
      </div>
      <div
        className={styles.wheelStage}
        data-testid="wheel-stage"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={(e) => {
          pointer.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          setDuration(0);
          setRotation(-index * step);
        }}
      >
        {!sole && <span className={styles.indicator} aria-hidden="true" />}
        {!sole && (
          <div className={styles.center} aria-hidden="true">
            <strong data-testid="reel-number">
              {String(index + 1).padStart(2, "0")}
            </strong>
            <span>选片 / {String(movies.length).padStart(2, "0")}</span>
          </div>
        )}
        <div
          ref={ring}
          className={`${styles.ring} ${sole ? styles.single : ""}`}
          data-testid="reel-ring"
          style={
            {
              "--rotation": `${rotation}deg`,
              "--duration": `${hidden || reduced ? 0 : duration}ms`,
              transform: `rotate(${rotation}deg)`,
            } as CSSProperties
          }
        >
          {movies.map((movie, i) => {
            const offset = Math.min(
              (i - index + movies.length) % movies.length,
              (index - i + movies.length) % movies.length,
            );
            return (
              <div
                key={movie.id}
                className={`${styles.posterPosition} ${offset > 2 ? styles.mobileHidden : ""}`}
                style={{ "--base": `${i * step}deg` } as CSSProperties}
              >
                <button
                  ref={(el) => {
                    buttons.current[i] = el;
                  }}
                  type="button"
                  data-poster="true"
                  className={styles.posterButton}
                  tabIndex={i === index ? 0 : -1}
                  aria-label={`选择《${movie.title}》，第 ${i + 1} 部，共 ${movies.length} 部`}
                  aria-pressed={i === index}
                  style={{ transform: `rotate(${-i * step - rotation}deg)` }}
                  onClick={(e) => {
                    if (dragged.current) {
                      dragged.current = false;
                      return;
                    }
                    choose(i, e.detail === 0);
                  }}
                >
                  <span
                    className={
                      i === index ? styles.selectedPoster : styles.poster
                    }
                  >
                    <PosterImage movie={movie} priority={i === index} />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {!sole && (
        <div
          className={`${styles.reelControls} ${movies.length >= 6 ? styles.compactControls : ""}`}
        >
          <button
            type="button"
            aria-label="上一部"
            onClick={(e) => choose(index - 1, e.detail === 0)}
          >
            ←
          </button>
          <p>
            <span>转动海报，遇见下一部</span>
            <small>也可使用左右方向键</small>
          </p>
          <button
            type="button"
            aria-label="下一部"
            onClick={(e) => choose(index + 1, e.detail === 0)}
          >
            →
          </button>
        </div>
      )}
      {children}
    </section>
  );
}
