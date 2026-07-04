/**
 * Robust poster image loader
 * 多层 fallback 链：主源 → 替换源 → 本地占位 SVG
 * - 监听 load/error 自动切换数据源
 * - onerror 触发后自动加 `.loaded` 类，避免被 CSS opacity:0 永久隐藏
 * - 暴露为 `data-fallback-src` 链式查找
 */

type FallbackEntry = { sel: string; primary: string; fallback?: string };

const FALLBACK_CHAIN: FallbackEntry[] = [
  // 如果主 URL 失败，尝试的替代源（例：Wikimedia main → commons）
  // 当前只有 poster URL，无法预先硬编码，所以这里只做兜底
];

// 静态 fallback SVG 路径
const FALLBACK_SVG = '/fallback-poster.svg';

/**
 * 处理单个 img 元素的多层 fallback
 */
function attachFallback(img: HTMLImageElement) {
  // 记录原始 src 用于诊断
  if (!img.dataset.originalSrc) {
    img.dataset.originalSrc = img.src;
  }

  const tried = new Set<string>([img.src]);

  const onError = () => {
    // 第一级：换 fallback SVG
    if (!tried.has(FALLBACK_SVG)) {
      tried.add(FALLBACK_SVG);
      img.classList.add('loaded');
      img.src = FALLBACK_SVG;
      return;
    }
    // 已无更多 fallback：标记 loaded 让 CSS 显示（虽然显示的还是 fallback svg）
    img.classList.add('loaded');
  };

  const onLoad = () => {
    img.classList.add('loaded');
    // 加载成功后清理 listener
    img.removeEventListener('error', onError);
  };

  img.addEventListener('error', onError, { once: false });
  img.addEventListener('load', onLoad, { once: true });
}

/**
 * 初始化所有需要 fallback 的图片
 * 选择器：所有有 onerror 属性的 img 或带 .poster-img / .past-poster-img / .similar-cover img / .lib-cover img 的元素
 */
function init() {
  const selectors = [
    '.poster-img',
    '.past-poster img',
    '.hero-cover img',
    '.similar-cover img',
    '.lib-cover img',
    'img[onerror*="fallback-poster"]'
  ];

  document.querySelectorAll<HTMLImageElement>(selectors.join(',')).forEach(attachFallback);
}

// 兼容 Astro 视图切换
document.addEventListener('astro:page-load', init);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}