import styles from "./styles.generated";
export function State({
  error,
  retry,
  empty = false,
}: {
  error?: string | null;
  retry?: () => void;
  empty?: boolean;
}) {
  return (
    <section className={styles.state} aria-live="polite">
      <p className={styles.eyebrow}>
        {error
          ? "TEMPORARILY UNAVAILABLE"
          : empty
            ? "A BLANK REEL"
            : "LOADING THE REEL"}
      </p>
      <h1>
        {error
          ? "暂时无法读取电影"
          : empty
            ? "下一场，还在准备"
            : "正在整理放映资料"}
      </h1>
      <p>
        {error ?? (empty ? "片库还没有公开内容，请稍后再来。" : "请稍候。")}
      </p>
      {retry && (
        <button onClick={retry} className={styles.outline}>
          重新读取
        </button>
      )}
    </section>
  );
}
