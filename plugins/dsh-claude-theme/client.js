window.__ModuleLoader__.load({
  id: 'dsh-claude-theme',
  factory() {
    // 配色与字体取自 Claude 桌面版：色值来自其 CSS 设计令牌并按截图实测校准，字体栈与其一致。
    // DSH 的配色几乎都经由 neutral-bluish（中性灰）与 deepseek（强调色）两条色阶，
    // 这里把两条色阶连同少量专用别名一起换掉，组件本身不动。
    // 选择器都比 DSH 自己的 `body` / `body[data-ds-dark-theme]` 多一级，保证覆盖生效。
    const SANS = `"Anthropic Sans", "anthropic-sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "PingFang TC", "Hiragino Sans", "Microsoft YaHei UI", "Microsoft YaHei", "Apple SD Gothic Neo", "Nirmala UI", "Leelawadee UI", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`;
    const SERIF = `"Anthropic Serif", "anthropic-serif", ui-serif, Georgia, "Times New Roman", serif`;
    const MONO = `"Anthropic Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;

    // 字体文件由宿主半边 /api/claude-fonts 提供；只有常规体，粗体由浏览器合成。中文仍回退到系统字体（与 Claude 相同）。
    const fontUrl = (key) => new URL(`api/claude-fonts?f=${key}`, document.baseURI).href;
    const FACES = [['Anthropic Sans', 'sans'], ['Anthropic Serif', 'serif'], ['Anthropic Mono', 'mono'], ['Inter', 'sans']]
      .map(([family, key]) => `@font-face{font-family:"${family}";src:url("${fontUrl(key)}") format("truetype");font-weight:100 900;font-style:normal;font-display:swap}`).join(String.fromCharCode(10));

    const CSS = FACES + `
/* ---------- 字体：Anthropic Sans / Serif / Mono（DSH 里写死的 Inter 也指向 Anthropic Sans） ---------- */
html, html body {
  --dsh-font-family-text: ${SANS};
  --dsh-font-family-text-default: ${SANS};
  --dsw-font-family: ${SANS};
  --ds-font-family-code: ${MONO};
  --cui-font-serif: ${SERIF};
  font-family: ${SANS};
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
html body code, html body pre, html body kbd, html body samp { font-family: ${MONO}; }

/* ---------- 色阶（浅色 / 深色共用的静态值） ---------- */
html body, html body[data-ds-dark-theme] {
  --dsw-static-neutral-bluish-00: #ffffff;
  --dsw-static-neutral-bluish-50: #fcfcfb;
  --dsw-static-neutral-bluish-60: #fbfbf9;
  --dsw-static-neutral-bluish-75: #f6f6f4;
  --dsw-static-neutral-bluish-100: #f0efec;
  --dsw-static-neutral-bluish-150: #ebeae9;
  --dsw-static-neutral-bluish-200: #e3e2de;
  --dsw-static-neutral-bluish-300: #cfcdc6;
  --dsw-static-neutral-bluish-400: #a8a69e;
  --dsw-static-neutral-bluish-500: #9c9a92;
  --dsw-static-neutral-bluish-600: #87857d;
  --dsw-static-neutral-bluish-700: #73726c;
  --dsw-static-neutral-bluish-750: #4a4945;
  --dsw-static-neutral-bluish-800: #3a3936;
  --dsw-static-neutral-bluish-850: #30302e;
  --dsw-static-neutral-bluish-875: #2a2a28;
  --dsw-static-neutral-bluish-900: #1f1e1d;
  --dsw-static-neutral-bluish-950: #262624;
  --dsw-static-neutral-bluish-1000: #141413;

  /* 强调色：Claude 的品牌陶土橙 */
  --dsw-static-deepseek-50: #fbf1ec;
  --dsw-static-deepseek-100: #f6e1d7;
  --dsw-static-deepseek-200: #efcab9;
  --dsw-static-deepseek-300: #e6a98f;
  --dsw-static-deepseek-400: #d97757;
  --dsw-static-deepseek-450: #d97757;
  --dsw-static-deepseek-500: #c6613f;
  --dsw-static-deepseek-600: #ae5332;
  --dsw-static-deepseek-800: #5a3324;
  --dsw-static-deepseek-900: #3d241a;
  --dsw-static-blue-450: #2a78d6;

  --dsw-menu-backdrop-filter: none;
}

/* ---------- 浅色 ---------- */
html body:not([data-ds-dark-theme]) {
  --dsw-alias-bg-base: #fcfcfb;
  --dsw-alias-bg-layer-1: #ffffff;
  --dsw-alias-bg-layer-2: #ffffff;
  --dsw-alias-bg-layer-3: #ffffff;
  --dsw-specific-sidebar-fill: #fbfbf9;
  --dsw-specific-sidebar-nav-item-hover: #f3f2ef;
  --dsw-specific-sidebar-nav-item-active: #f0efec;
  --dsw-specific-sidebar-nav-item-active-accent: #f0efec;
  --dsw-specific-input-major: #ffffff;
  --dsw-specific-bubble: #f0efec;
  --dsw-specific-bubble-highlight: #e8e7e3;
  --dsw-specific-selector: #f0efec;
  --dsw-alias-label-primary: #141413;
  --dsw-alias-label-primary-bluish: #141413;
  --dsw-alias-label-primary-dimmed: #1f1e1d;
  --dsw-alias-label-secondary: #3d3d3a;
  --dsw-alias-label-tertiary: #73726c;
  --dsw-alias-label-caption: #9c9a92;
  --dsw-alias-border-l1: #1f1e1d0f;
  --dsw-alias-border-l2: #1f1e1d17;
  --dsw-alias-border-l3: #1f1e1d1f;
  --dsw-alias-border-l4: #1f1e1d33;
  --dsw-alias-interactive-bg-hover: #1f1e1d0a;
  --dsw-alias-interactive-bg-active: #1f1e1d12;
  --dsw-alias-interactive-bg-hover-solid: #f3f2ef;
  --dsw-menu-surface-fill: #ffffff;
  --dsw-specific-menu: #ffffff;
  --dsw-alias-menu-group-header-fill: #fffffff2;
  --dsw-elevation-panel: 0 0 0 .5px #1f1e1d26, 0 4px 16px #1f1e1d14;
  --dsw-elevation-prominent: 0 0 0 .5px #1f1e1d26, 0 8px 28px #1f1e1d1f;
  --dsw-alias-link: #1b65b1;
  --dsw-alias-state-business-primary: #d97757;
  --dsw-alias-markdown-code-block: #f6f6f4;
  --dsw-alias-markdown-code-block-banner: #f0efec;
  --dsw-alias-markdown-inline-code: #f0f0ef;
  --dsw-alias-markdown-tag: #f0efec;
  --dsw-alias-scrollbar-bg-l1: #1f1e1d26;
  --dsw-alias-scrollbar-bg-l2: #1f1e1d26;
  --dsw-alias-scrollbar-hover-l1: #1f1e1d40;
  --dsw-alias-scrollbar-hover-l2: #1f1e1d40;
  --cui-code-fg: #8a2424;
  --cui-code-bd: #1f1e1d1a;
}

/* ---------- 深色 ---------- */
html body[data-ds-dark-theme] {
  --dsw-alias-bg-base: #262624;
  --dsw-alias-bg-layer-1: #30302e;
  --dsw-alias-bg-layer-2: #30302e;
  --dsw-alias-bg-layer-3: #3a3936;
  --dsw-specific-sidebar-fill: #1f1e1d;
  --dsw-specific-sidebar-nav-item-hover: #2a2a28;
  --dsw-specific-sidebar-nav-item-active: #141413;
  --dsw-specific-sidebar-nav-item-active-accent: #141413;
  --dsw-specific-input-major: #30302e;
  --dsw-specific-bubble: #141413;
  --dsw-specific-bubble-highlight: #3a3936;
  --dsw-specific-selector: #30302e;
  --dsw-alias-label-primary: #faf9f5;
  --dsw-alias-label-primary-bluish: #faf9f5;
  --dsw-alias-label-primary-dimmed: #ece9df;
  --dsw-alias-label-secondary: #c2c0b6;
  --dsw-alias-label-tertiary: #9c9a92;
  --dsw-alias-label-caption: #87857d;
  --dsw-alias-border-l1: #dedcd10f;
  --dsw-alias-border-l2: #dedcd11a;
  --dsw-alias-border-l3: #dedcd126;
  --dsw-alias-border-l4: #dedcd140;
  --dsw-alias-interactive-bg-hover: #faf9f50f;
  --dsw-alias-interactive-bg-active: #faf9f51c;
  --dsw-alias-interactive-bg-hover-solid: #2a2a28;
  --dsw-menu-surface-fill: #30302e;
  --dsw-specific-menu: #30302e;
  --dsw-alias-menu-group-header-fill: #30302ef2;
  --dsw-elevation-panel: 0 0 0 .5px #dedcd126, 0 8px 28px #00000059;
  --dsw-elevation-prominent: 0 0 0 .5px #dedcd126, 0 12px 36px #00000066;
  --dsw-alias-link: #6fa8e6;
  --dsw-alias-state-business-primary: #d97757;
  --dsw-alias-markdown-code-block: #1f1e1d;
  --dsw-alias-markdown-code-block-banner: #2a2a28;
  --dsw-alias-markdown-inline-code: #3a3936;
  --dsw-alias-markdown-tag: #30302e;
  --cui-code-fg: #ff8a8a;
  --cui-code-bd: #dedcd11f;
}

/* ---------- 正文排版：Claude 式的克制 —— 标题不过粗、段距紧凑、表格和行内代码都收敛 ---------- */
html body {
  --dsh-chat-user-width: min(700px, calc(100vw - 120px));
  --dsh-content-font-size: 14px;
}
[data-slot="conversation.chat.node"] { line-height: 1.7; }
[data-slot="conversation.chat.node"] a { color: var(--dsw-alias-link); text-decoration: none; }
[data-slot="conversation.chat.node"] a:hover { text-decoration: underline; text-underline-offset: 2px; }

/* 段落与列表 */
html body [class*="_markdown_"] p { margin: 10px 0; }
html body [class*="_markdown_"] li:not(:first-child) { margin-top: 4px; }
html body [class*="_markdown_"] li > p { margin: 4px 0; }
html body [class*="_markdown_"] :where(ul, ol) { padding-left: 1.4em; margin: 8px 0; }
html body [class*="_markdown_"] strong { font-weight: 600; }

/* 标题：字号只比正文略大，600 字重，上方留白减半 */
html body [class*="_markdown_"] :is(h1, h2, h3, h4) { font-weight: 600; letter-spacing: 0; margin: 20px 0 8px; }
html body [class*="_markdown_"] h1 { font-size: 1.3em; line-height: 1.45; }
html body [class*="_markdown_"] h2 { font-size: 1.18em; line-height: 1.5; }
html body [class*="_markdown_"] h3 { font-size: 1.07em; line-height: 1.55; }
html body [class*="_markdown_"] h4 { font-size: 1em; line-height: 1.6; margin: 14px 0 6px; }

/* 行内代码：普通行内文本，不再是带边框的胶囊块 */
html body [class*="_markdown_"] :not(pre) > code,
[data-slot="conversation.user.text.node"] :not(pre) > code {
  display: inline;
  padding: .1em .35em;
  border: .5px solid var(--cui-code-bd);
  border-radius: 4px;
  background: var(--dsw-alias-markdown-inline-code);
  color: var(--cui-code-fg);
  font-size: .86em;
  line-height: inherit;
  white-space: break-spaces;
  overflow-wrap: anywhere;
}

/* 代码块 */
[data-slot="conversation.chat.node"] pre {
  border-radius: 10px;
  border: .5px solid var(--dsw-alias-border-l2);
  font-size: 12.5px;
  line-height: 1.6;
}

/* 表格：行高收紧、单元格不再强制最小宽度，代码不画框 */
html body [class*="_tableScroll_"] :is(th, td) {
  padding: 6px 12px;
  font-size: .9em;
  line-height: 1.5;
  min-width: 0;
  max-width: min(36vw, 420px);
  vertical-align: top;
}
html body [class*="_tableScroll_"] th { font-weight: 600; color: var(--dsw-alias-label-secondary); }
html body [class*="_tableScroll_"] :is(th, td):first-child { padding-left: 0; }
html body [class*="_tableScroll_"] table code { font-size: .88em; padding: 0 .25em; border: none; background: transparent; }
html body [class*="_markdown_"] [class*="_tableScroll_"] { margin: 10px 0; }

/* 宽表格（≥4 列）：DSH 会把它向两侧"出血"并按容器宽度算偏移，在列表里会算错而整体右移；
   悬停时还在隐藏/显示滚动条之间切换，带着 5px 留白跳动。这里改回普通表格：不出血、滚动条状态固定。 */
html body [class*="_tableScroll_"].md-table-wide {
  width: auto !important;
  max-width: 100% !important;
  margin-left: 0 !important;
  padding-left: 0 !important;
  padding-bottom: 0 !important;
  overflow-x: auto !important;
}
html body [class*="_tableScroll_"].md-table-wide > table { z-index: auto; }
/* 表格宽度跟随正文栏，放不下就在单元格里换行，而不是撑出横向滚动 */
html body [class*="_tableScroll_"] > table { width: auto; max-width: 100%; }
html body [class*="_tableScroll_"] :is(th, td) { overflow-wrap: anywhere; }
/* 滚动条：细而淡 */
html body ::-webkit-scrollbar { width: 10px; height: 10px; }
html body ::-webkit-scrollbar-thumb { border: 3px solid transparent; border-radius: 10px; background-clip: padding-box; }
`;

    return {
      apply(ctx) {
        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-claude-theme';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => tag.remove();
        }, 'dsh-claude-theme: style');
      }
    };
  }
});
