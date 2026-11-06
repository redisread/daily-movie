# Daily Movie / 电影转盘

1. **Theme**: 白色档案台，不再沿用暗色放映厅。真实电影海报围绕稳定的大编号旋转，右侧只讲一部电影。
2. **Palette**: src/tokens.css 为唯一全局色彩真源。精确对应 Steven v1.2 的 #FAFAF7 / #191A17 / #5B5D55 / #D9DAD2 / #BF451E / #B42318，采用等值 OKLCH。色彩重点来自原海报。
3. **Typography**: 系统 sans，中文 PingFang SC/Noto Sans SC。编号 Helvetica Neue/Arial 112px、手机72px。片名40/28px，正文16px，金句22px。不下载新字体。
4. **Components**: 海报4px圆角，按钮8px，控件至少44px；只在海报上用轻阴影。信息和金句不套卡片。CSS Modules，禁止混入 Tailwind。
5. **Layout**: 1440px 上限、48px 桌面边距，60/40 双栏；768–1023单列；手机16px边距、340px转盘。片库4/3/2列，320降为1列。
6. **Depth / motion**: 转盘420ms cubic-bezier(.16,1,.3,1)，逆向旋转海报以保持竖直。快速反向点击读当前矩阵并重定向，不排队。释放吸附280ms。键盘和reduced-motion瞬时切换。文案80ms退/120ms入，旧层inert和aria-hidden。
7. **Do / don't**: 不自动轮播、不拦截整页滚轮、不播放视频、不复制参考品牌模型、不制造占位电影。保留原始内容，图片失败用仓库fallback-poster.svg。
8. **Responsive / accessibility**: 手机仅显示当前及前后各2项，布局索引不复制；真实0/1/2–4项有效。左右/Home/End/Enter，roving tabindex，清晰焦点和选片播报。拖动只在水平意图明确后接管，取消时复位。转盘绘制区裁切变换溢出，不对整页隐藏横向内容。
9. **Implementation guide**: API为唯一运行时内容源。图片、演员和金句通过API更新，不改前端样例。规范见 docs/rebuild-spec-v1.2.md。关键帧已由设计方检视；白底、大编号、彩色环和顶部指示为可核验映射。屏幕阅读器实机、指定设备网络LCP/CLS仍需独立验收，不能用单测代替。
