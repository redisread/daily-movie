import type { useRandomWalk } from "./useRandomWalk";
import styles from "../styles.generated";
type Controller = ReturnType<typeof useRandomWalk>;
export function WalkControls({
  walk,
  reelSize,
}: {
  walk: Controller;
  reelSize: number;
}) {
  const active = walk.snapshot?.active,
    complete =
      !!active &&
      walk.snapshot!.cursor === walk.snapshot!.history.length - 1 &&
      !walk.snapshot!.unseen.length;
  const onlyOne =
    walk.poolSize === 1 || (walk.poolSize === null && reelSize === 1);
  return (
    <div className={styles.walkControls} aria-label="随机漫步控制">
      {onlyOne ? (
        <p className={styles.walkHint}>目前只有这一部</p>
      ) : (
        <button
          type="button"
          className={styles.walkNext}
          aria-busy={walk.busy}
          aria-disabled={walk.preparing}
          onClick={(e) => {
            if (!walk.preparing) void walk.next(e.detail === 0);
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M3 6h3c5 0 7 12 12 12h3m-3-3 3 3-3 3M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-3-3 3 3-3 3" />
          </svg>
          {walk.preparing
            ? "正在准备…"
            : walk.busy
              ? "正在遇见…"
              : active
                ? complete
                  ? "再走一轮"
                  : "再遇见一部"
                : "随机漫步"}
        </button>
      )}
      {active && (
        <>
          <p className={styles.walkStatus}>
            随机漫步 · 已遇见 {walk.snapshot!.seen.length} 部
            {complete && <span> · 这一轮都见过了</span>}
          </p>
          <div className={styles.walkActions}>
            <button
              type="button"
              disabled={!walk.snapshot!.cursor}
              onClick={(e) => void walk.back(e.detail === 0)}
            >
              回看上一部
            </button>
            <button type="button" onClick={walk.end}>
              结束漫步
            </button>
            <button type="button" onClick={walk.restart}>
              重新开始
            </button>
          </div>
          <p className={styles.walkHint}>
            转盘预览 {reelSize} 部 · 随机范围 {walk.poolSize ?? "…"} 部
          </p>
        </>
      )}
      {walk.error && (
        <p className={styles.walkError} role="status">
          {walk.error}{" "}
          <button type="button" onClick={walk.retry}>
            重试
          </button>
        </p>
      )}
      {walk.warning && <p className={styles.walkHint}>{walk.warning}</p>}
      <span className={styles.srOnly} role="status">
        {walk.announcement}
      </span>
    </div>
  );
}
