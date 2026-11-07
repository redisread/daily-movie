import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Movie } from "../shared/model";
import { durationLabel, movieHref } from "../shared/format";
import { useResource, type ListResult } from "./data";
import { Carousel } from "./Carousel";
import { State } from "./State";
import { reelWindow } from "./walk/catalogue";
import { useRandomWalk } from "./walk/useRandomWalk";
import { WalkControls } from "./walk/WalkControls";
import styles from "./styles.generated";
function MovieInfo({ movie }: { movie: Movie }) {
  return (
    <>
      <p className={styles.eyebrow}>
        {movie.publishedDate?.replaceAll("-", ".")} ·{" "}
        {movie.type === "tv" ? "剧集" : "电影"}
      </p>
      <h1>{movie.title}</h1>
      {movie.titleOriginal && (
        <p className={styles.original}>{movie.titleOriginal}</p>
      )}
      <p className={styles.facts}>
        {movie.year} <span>/</span> {movie.director.name} <span>/</span>{" "}
        {durationLabel(movie)}
      </p>
      <blockquote className={styles.heroQuote}>
        {movie.quotes[0]?.text}
      </blockquote>
      {movie.quotes[0]?.speaker && (
        <p className={styles.speaker}>出自 {movie.quotes[0].speaker}</p>
      )}
      <Link to={movieHref(movie.id)} className={styles.primary}>
        查看电影 <span aria-hidden="true">↗</span>
      </Link>
    </>
  );
}
function HomeLoaded({ movies }: { movies: Movie[] }) {
  const [params, setParams] = useSearchParams(),
    [extras, setExtras] = useState<Record<string, Movie>>({});
  const requested = params.get("movie"),
    selected =
      (requested &&
        (extras[requested] ?? movies.find((m) => m.id === requested))) ||
      movies[0];
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const ordered = reelWindow(movies, selected),
    index = ordered.findIndex((m) => m.id === selected.id);
  const [outgoing, setOutgoing] = useState<Movie | null>(null),
    [animate, setAnimate] = useState(false),
    [externalSequence, setExternalSequence] = useState(0);
  const focusAfterSelection = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function selection(
    movie: Movie,
    motion: boolean,
    walking: boolean,
    external = true,
  ) {
    focusAfterSelection.current =
      !motion &&
      (document.activeElement as HTMLElement | null)?.dataset.poster === "true";
    const actual =
      motion &&
      !document.hidden &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (timer.current) clearTimeout(timer.current);
    setAnimate(actual);
    setOutgoing(
      actual && movie.id !== selectedRef.current.id
        ? selectedRef.current
        : null,
    );
    if (actual) timer.current = setTimeout(() => setOutgoing(null), 80);
    if (external) setExternalSequence((n) => n + 1);
    setExtras((prev) => ({ ...prev, [movie.id]: movie }));
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("movie", movie.id);
        if (walking) p.set("mode", "walk");
        else p.delete("mode");
        return p;
      },
      { replace: true, preventScrollReset: true },
    );
  }
  const walk = useRandomWalk({
    current: selected,
    urlId: requested,
    urlMode: params.get("mode") === "walk",
    onSelect: selection,
  });
  useEffect(() => {
    document.title = `${selected.title} | 每日电影`;
    if (focusAfterSelection.current) {
      document
        .querySelector<HTMLElement>('[data-poster="true"][aria-pressed="true"]')
        ?.focus({ preventScroll: true });
      focusAfterSelection.current = false;
    }
  }, [selected.title]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function ordinary(i: number, motion: boolean) {
    walk.stop(ordered[i]);
    selection(ordered[i], motion, false, false);
  }
  return (
    <>
      <div className={styles.homeIntro}>
        <p>一部电影，一句留在心里的话。</p>
        <Link to="/library">探索完整片库 ↗</Link>
      </div>
      <div className={styles.home}>
        <Carousel
          movies={ordered}
          index={index}
          onSelect={ordinary}
          externalSequence={externalSequence}
          externalMotion={animate}
        >
          <WalkControls walk={walk} reelSize={ordered.length} />
        </Carousel>
        <section className={styles.selection} aria-label="选中影片">
          <div className={styles.infoWrap}>
            <div
              key={selected.id}
              className={animate ? styles.incoming : undefined}
            >
              <MovieInfo movie={selected} />
            </div>
            {outgoing && (
              <div className={styles.outgoing} aria-hidden="true" inert>
                <MovieInfo movie={outgoing} />
              </div>
            )}
          </div>
          <div className={styles.catalogNote}>
            <span>FILM SELECTION</span>
            <p>
              转盘预览 {ordered.length} 部选片。
              <br />
              每一句台词，都有它的来处。
            </p>
          </div>
        </section>
      </div>
      <span className={styles.srOnly} role="status">
        {walk.snapshot?.active
          ? ""
          : `已选择《${selected.title}》，第 ${index + 1} 部，共 ${ordered.length} 部`}
      </span>
    </>
  );
}
export function Home() {
  const r = useResource<ListResult<Movie>>("/api/v1/movies?limit=12");
  if (r.error) return <State error={r.error} retry={r.retry} />;
  if (!r.data) return <State />;
  if (!r.data.data.length) return <State empty />;
  return <HomeLoaded movies={r.data.data} />;
}
