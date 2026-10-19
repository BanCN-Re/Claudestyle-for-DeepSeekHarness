window.__ModuleLoader__.load({
  id: 'dsh-claude-ui',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    let ReactDOM = null;
    try { ReactDOM = require('react-dom'); } catch { ReactDOM = null; }

    const OVERVIEW_ID = 'dsh-claude-ui/overview';
    const OVERVIEW_KIND = 'claude-overview';
    const RECENT_KEY = 'dsh-claude-ui.recent-models';
    const OPENED_KEY = 'dsh-claude-ui.overview-opened';
    const PINNED = 5;

    // ---------- 小工具 ----------
    const noopSubscribe = () => () => {};
    function useStore(store) {
      return React.useSyncExternalStore(
        store ? (fn) => store.subscribe(fn) : noopSubscribe,
        () => (store ? store.getSnapshot() : undefined),
      );
    }
    const portal = (node) => (ReactDOM?.createPortal ? ReactDOM.createPortal(node, document.body) : node);
    const fmtK = (n) => {
      if (!Number.isFinite(n)) return '—';
      if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
      if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k`;
      return String(Math.round(n));
    };
    const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—');
    const baseName = (p) => (p ? String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop() : '');
    const keyOf = (s) => `${s.provider}\u0000${s.model}`;
    function readRecent() {
      try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x) => x && x.provider && x.model); } catch { return []; }
    }
    function pushRecent(sel) {
      const list = [{ provider: sel.provider, model: sel.model }, ...readRecent().filter((x) => keyOf(x) !== keyOf(sel))].slice(0, 12);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* 配额满时忽略 */ }
    }

    const svg = (d, size = 16, extra = {}) => h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...extra },
      (Array.isArray(d) ? d : [d]).map((p, i) => h('path', { key: i, d: p })));
    const Icon = {
      check: () => svg('M3.5 8.5l3 3 6-7'),
      chevronR: () => svg('M6 3.5L10.5 8 6 12.5', 14),
      chevronD: () => svg('M4 6l4 4 4-4', 12),
      search: () => svg(['M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10z', 'M10.8 10.8L14 14'], 14),
      computer: () => svg(['M2 3.5h12v7.5H2z', 'M5.5 13.5h5', 'M8 11v2.5']),
      folder: () => svg('M1.8 4.2c0-.6.5-1 1-1h3.3l1.6 1.5h5.5c.6 0 1 .4 1 1v6.6c0 .6-.4 1-1 1H2.8c-.5 0-1-.4-1-1z'),
      model: () => svg(['M8 1.8l5.4 3.1v6.2L8 14.2l-5.4-3.1V4.9z', 'M2.6 4.9L8 8l5.4-3.1', 'M8 8v6.2']),
      file: () => svg(['M4 1.8h5l3 3v9.4H4z', 'M9 1.8v3h3']),
      panel: () => svg(['M2 3h12v10H2z', 'M10 3v10']),
      terminal: () => svg(['M3 4.5l3.5 3.5L3 11.5', 'M8 12h5']),
      files: () => svg(['M2 4.5h4l1.3 1.3H14V13H2z']),
      trajectory: () => svg(['M3 4h10', 'M3 8h7', 'M3 12h4', 'M12 10.5l1.5 1.5-1.5 1.5']),
      globe: () => svg(['M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4z', 'M1.8 8h12.4', 'M8 1.8c1.8 1.8 2.6 4 2.6 6.2S9.8 12.4 8 14.2C6.2 12.4 5.4 10.2 5.4 8S6.2 3.6 8 1.8z']),
    };

    // ---------- 浮层：定位 + 外部点击关闭 ----------
    function usePopover(open, setOpen, refs) {
      React.useEffect(() => {
        if (!open) return undefined;
        const away = (e) => { if (!refs.some((r) => r.current && r.current.contains(e.target))) setOpen(false); };
        const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', away, true);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', esc); };
      }, [open]);
    }

    // ---------- 额度小圆圈：Claude 式用量环 ----------
    // Codex / OpenCode Go 显示限额窗口进度；Jet Hub 渠道（含 IDE BYOK 里的 JetHub/* 模型）显示积分；其他模型不显示。
    // 数据都来自已装插件的宿主接口：codex-subscription、opencode-go-usage、jet-hub（usage.badge）、byok-dashboard。
    const JETHUB_PROVIDERS = new Set(['codearts', 'buddy', 'workbuddy', 'lobsterai', 'qoder', 'qodercn', 'trae', 'cline', 'loomy', 'raccoon', 'minimax', 'minimaxintl', 'zcode', 'opencode', 'gemini', 'officeace', 'accio', 'autoclaw', 'modelscope', 'jet-hub-auto', 'aggregate']);
    function usageKind(sel) {
      if (!sel?.provider) return null;
      if (sel.provider === 'codex') return 'codex';
      if (sel.provider === 'opencode-go') return 'opencode';
      if (/^jethub\//i.test(String(sel.model || ''))) return 'byok';
      if (JETHUB_PROVIDERS.has(sel.provider)) return 'jethub';
      return null;
    }
    const fmtPts = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—');
    function resetText(atMs) {
      if (!Number.isFinite(atMs) || atMs <= 0) return '';
      const d = atMs - Date.now();
      if (d <= 0) return '即将重置';
      const min = Math.round(d / 60000);
      if (min < 60) return `${min} 分钟后重置`;
      if (min < 24 * 60) return `${Math.floor(min / 60)} 小时 ${min % 60} 分钟后重置`;
      const at = new Date(atMs);
      if (d > 6 * 86400000) return `${at.getMonth() + 1}月${at.getDate()}日 ${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')} 重置`;
      const wd = '日一二三四五六'[at.getDay()];
      return `周${wd} ${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')} 重置`;
    }
    function untilText(atMs) {
      const d = atMs - Date.now();
      if (!Number.isFinite(d) || d <= 0) return '';
      const hrs = Math.floor(d / 3600000);
      return hrs >= 24 ? `${Math.floor(hrs / 24)} 天 ${hrs % 24} 小时` : `${hrs} 小时`;
    }
    const tone = (pct) => (pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok');

    // 把四种接口的返回统一成 { title, bars:[{label,pct,reset}], points:{total,unit,plan,accounts}, error }
    async function readUsage(kind, sel, call, force) {
      if (kind === 'codex') {
        const v = await call('codex-subscription', { method: force ? 'quota.refresh' : 'quota.status', payload: {} });
        const rl = v?.usage?.rateLimit;
        const win = (w, label) => (w && Number.isFinite(w.usedPercent) ? { label, pct: w.usedPercent, reset: resetText(w.resetAt * 1000) } : null);
        const bars = [win(rl?.primary, '5 小时限额'), win(rl?.secondary, '每周')].filter(Boolean);
        const plan = v?.usage?.planType || v?.account?.planType;
        return { title: 'Codex' + (plan ? ` · ${plan}` : ''), bars, error: bars.length ? '' : (v?.error || '没有读到额度窗口') };
      }
      if (kind === 'opencode') {
        const v = await call('opencode-go-usage', { method: force ? 'quota.refresh' : 'quota.status', payload: {} });
        const acc = (v?.accounts || []).find((a) => a.ok) || v?.accounts?.[0];
        const bars = (acc?.windows || []).map((w) => ({ label: w.label, pct: w.percentUsed, reset: resetText(Date.parse(w.resetsAt)) }));
        return { title: 'OpenCode Go', bars, error: bars.length ? '' : (acc?.error || v?.error || '没有读到用量窗口') };
      }
      if (kind === 'byok') {
        const v = await call('byok-dashboard', { method: 'quota', payload: { modelId: sel.model, providerId: sel.provider, refresh: force === true } });
        const q = v?.quota || {};
        const accounts = (q.accounts || []).map((a) => {
          const m = (a.metrics || []).find((x) => x.unit !== 'percent');
          return { name: a.name, total: m ? m.value : NaN, note: a.error || '' };
        });
        return { title: q.provider || 'IDE BYOK', points: { total: q.total, unit: q.unitLabel || '积分', accounts }, error: q.status === 'error' ? (q.error || '额度读取失败') : '' };
      }
      // Jet Hub：聚合渠道先换成上次实际转发的渠道
      let provider = sel.provider;
      if (provider === 'aggregate') {
        const act = await call('jet-hub', { method: 'aggregate.activeProvider', payload: {} });
        if (!act?.provider) return { title: '聚合（跨渠道）', points: null, error: '还没发出过请求，暂不知道会走哪个渠道' };
        provider = act.provider;
      }
      const v = await call('jet-hub', { method: 'usage.badge', payload: { provider, ...(force ? { force: true } : {}) } });
      const days = Number(v?.windowDays);
      const now = Date.now();
      const accounts = (v?.accounts || []).map((a) => {
        const b = a.balance;
        let soon = 0; let soonAt = 0;
        if (b && Number.isFinite(days)) {
          for (const p of b.packages || []) {
            const end = Number(p.deductionEndTime);
            if (p.active && p.remaining > 0 && end > now && end - now < days * 86400000) { soon += p.remaining; if (!soonAt || end < soonAt) soonAt = end; }
          }
        }
        return { name: a.nickname || a.accountId, total: b ? b.total : NaN, soon, soonAt, note: a.error || '' };
      }).sort((x, y) => (y.total || 0) - (x.total || 0));
      const total = accounts.reduce((s, a) => s + (Number.isFinite(a.total) ? a.total : 0), 0);
      let plan = null;
      if (v?.subscription?.kind === 'plan') {
        const ps = v.subscription.accounts.map((a) => a.plan).filter(Boolean);
        if (ps.length) plan = { name: ps[0].name, remaining: ps.reduce((s, p) => s + p.remaining, 0), total: ps.reduce((s, p) => s + p.total, 0), count: ps.length };
      }
      const via = v?.autoActual?.provider ? ` → ${v.autoActual.provider}` : '';
      return { title: (provider === 'jet-hub-auto' ? 'Jet Hub 自动' : provider) + via, points: { total, unit: '积分', plan, accounts, disabled: v?.disabledCount || 0 }, error: accounts.length ? '' : '这个渠道还没有接入账号' };
    }

    function UsageRing({ sel, call, onOpen }) {
      const kind = usageKind(sel);
      const [data, setData] = React.useState(null);
      const [err, setErr] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [open, setOpen] = React.useState(false);
      const [expanded, setExpanded] = React.useState(false);
      const [pos, setPos] = React.useState(null);
      const btnRef = React.useRef(null);
      const popRef = React.useRef(null);
      const seq = React.useRef(0);
      usePopover(open, setOpen, [btnRef, popRef]);
      const selKey = sel ? `${sel.provider}\u0000${sel.model}` : '';

      const load = React.useCallback(async (force) => {
        if (!kind) return;
        const mine = ++seq.current;
        if (force) setBusy(true);
        try {
          const d = await readUsage(kind, sel, call, force);
          if (mine === seq.current) { setData(d); setErr(''); }
        } catch (e) {
          if (mine === seq.current) setErr(e?.message || '额度读取失败');
        } finally {
          if (mine === seq.current) setBusy(false);
        }
      }, [kind, selKey]);

      React.useEffect(() => {
        setData(null); setErr(''); setExpanded(false);
        if (!kind) return undefined;
        load(false);
        const t = setInterval(() => { if (document.visibilityState === 'visible') load(false); }, 60000);
        return () => { seq.current++; clearInterval(t); };
      }, [load]);

      if (!kind) return null;
      const top = data?.bars?.length ? Math.max(...data.bars.map((b) => b.pct || 0)) : null;
      const pct = top == null ? 0 : Math.max(0, Math.min(100, top));
      const R = 6.5; const C = 2 * Math.PI * R;
      const isPoints = kind === 'jethub' || kind === 'byok';
      const tip = isPoints ? (data?.points ? `${fmtPts(data.points.total)} ${data.points.unit}` : '积分') : top == null ? '用量' : `已用 ${Math.round(pct)}%`;

      const toggle = () => {
        if (!open) {
          const r = btnRef.current.getBoundingClientRect();
          setPos({ right: Math.max(8, window.innerWidth - r.right - 8), bottom: window.innerHeight - r.top + 8 });
          load(false);
          onOpen?.();
        }
        setOpen(!open);
      };

      const bars = (data?.bars || []).map((b, i) => h('div', { key: i, className: 'cui-u-sec' },
        h('div', { className: 'cui-u-row' }, h('span', { className: 'cui-u-name' }, b.label), h('span', { className: 'cui-u-dim' }, `已用 ${Math.round(b.pct)}%`)),
        h('div', { className: 'cui-u-bar', 'data-tone': tone(b.pct) }, h('i', { style: { width: `${Math.max(0, Math.min(100, b.pct))}%` } })),
        b.reset ? h('div', { className: 'cui-u-dim cui-u-small' }, b.reset) : null));

      const pts = data?.points;
      const shown = pts ? (expanded ? pts.accounts : pts.accounts.slice(0, 5)) : [];
      const points = pts ? h('div', { className: 'cui-u-sec' },
        pts.plan ? h('div', { className: 'cui-u-row cui-u-plan' }, h('span', { className: 'cui-u-dim' }, pts.plan.name + (pts.plan.count > 1 ? ` · ${pts.plan.count} 个账号` : '')), h('span', null, `${fmtPts(pts.plan.remaining)} / ${fmtPts(pts.plan.total)}`)) : null,
        h('div', { className: 'cui-u-row cui-u-total' }, h('span', { className: 'cui-u-name' }, '可用' + pts.unit), h('span', { className: 'cui-u-big' }, fmtPts(pts.total))),
        shown.length ? h('div', { className: 'cui-u-accs' }, shown.map((a, i) => h('div', { key: i, className: 'cui-u-acc' },
          h('div', { className: 'cui-u-row' }, h('span', { className: 'cui-u-accname', title: a.name }, a.name), h('span', { className: 'cui-u-num' }, a.note && !Number.isFinite(a.total) ? '读取失败' : fmtPts(a.total))),
          a.soon > 0 ? h('div', { className: 'cui-u-dim cui-u-small' }, `其中 ${fmtPts(a.soon)} 将在 ${untilText(a.soonAt)} 内过期`) : null))) : null,
        pts.accounts.length > 5 ? h('button', { type: 'button', className: 'cui-u-link', onClick: () => setExpanded(!expanded) }, expanded ? '收起' : `展开其余 ${pts.accounts.length - 5} 个账号`) : null,
        pts.disabled ? h('div', { className: 'cui-u-dim cui-u-small' }, `${pts.disabled} 个停用账号未计入`) : null) : null;

      const pop = open && pos ? portal(h('div', { ref: popRef, className: 'cui-menu cui-u-pop', role: 'dialog', 'aria-label': '用量', style: { position: 'fixed', right: pos.right, bottom: pos.bottom } },
        h('div', { className: 'cui-u-head' },
          h('span', { className: 'cui-u-title' }, '用量'),
          h('button', { type: 'button', className: 'cui-u-refresh', disabled: busy, title: '刷新', onClick: () => load(true) }, svg(['M13 8a5 5 0 1 1-1.5-3.6', 'M13 2.8v2.6h-2.6'], 14))),
        data?.title ? h('div', { className: 'cui-u-dim cui-u-small cui-u-src' }, data.title) : null,
        !data && !err ? h('div', { className: 'cui-u-dim cui-u-small' }, '读取中…') : null,
        bars, points,
        (err || data?.error) ? h('div', { className: 'cui-u-err' }, err || data.error) : null)) : null;

      return h(React.Fragment, null,
        h('button', { ref: btnRef, type: 'button', className: 'cui-ring', 'data-tone': isPoints ? 'pts' : tone(pct), 'aria-label': tip, title: tip, 'aria-expanded': open, onClick: toggle },
          h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true },
            h('circle', { cx: 8, cy: 8, r: R, className: 'cui-ring-track' }),
            isPoints ? null : h('circle', { cx: 8, cy: 8, r: R, className: 'cui-ring-fill', strokeDasharray: C, strokeDashoffset: C * (1 - pct / 100), transform: 'rotate(-90 8 8)' }))),
        pop);
    }

    // ---------- 模型切换器 ----------
    function modelName(m) { return m?.name || m?.id || ''; }

    function ModelSwitcher({ available, directory, load, select, call }) {
      const state = useStore(directory) || { groups: [], current: null };
      const [open, setOpen] = React.useState(false);
      // 主菜单右侧展开的子菜单：'effort'（推理强度）| { prov: 服务商 id } | null
      const [sub, setSub] = React.useState(null);
      const [query, setQuery] = React.useState('');
      const [pos, setPos] = React.useState(null);
      const rootRef = React.useRef(null);
      const menuRef = React.useRef(null);
      const subRef = React.useRef(null);
      // 斜着划向子菜单时会掠过别的服务商，已有子菜单时稍等一下再切换，避免误切
      const hoverTimer = React.useRef(0);
      const hoverSub = (next) => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setSub(next), sub ? 140 : 0); };
      const close = () => { clearTimeout(hoverTimer.current); setOpen(false); setSub(null); setQuery(''); };
      usePopover(open, (v) => { if (v) setOpen(true); else close(); }, [rootRef, menuRef, subRef]);

      const groups = state.groups || [];
      const all = React.useMemo(() => groups.flatMap((g) => (g.models || []).map((m) => ({ group: g, model: m, sel: { provider: g.id, model: m.id } }))), [groups]);
      const find = (s) => s && all.find((c) => c.sel.provider === s.provider && c.sel.model === s.model);
      const current = find(state.current);
      const reasoning = current?.model.reasoning;
      const effort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
      const effortName = reasoning?.efforts?.find((e) => e.id === effort)?.name ?? (reasoning ? effort : state.retainedEffort);

      const choose = async (c, extra = {}) => {
        if (!c || !available) return;
        const sel = { ...c.sel, ...(c.model.reasoning?.defaultEffort !== undefined ? { reasoningEffort: c.model.reasoning.defaultEffort } : {}), ...extra };
        close();
        pushRecent(sel);
        try { await select(sel); } catch (error) { console.warn('[dsh-claude-ui] 切换模型失败', error); }
      };
      const chooseEffort = async (id) => {
        if (!current) return;
        close();
        try { await select({ ...current.sel, ...(id === undefined ? {} : { reasoningEffort: id }) }); } catch (error) { console.warn('[dsh-claude-ui] 切换推理强度失败', error); }
      };

      const toggle = () => {
        if (open) { close(); return; }
        load?.();
        const r = rootRef.current.getBoundingClientRect();
        setPos({ right: Math.max(8, window.innerWidth - r.right), bottom: window.innerHeight - r.top + 6 });
        setOpen(true);
      };

      const q = query.trim().toLowerCase();
      const filtered = q ? groups.map((g) => ({ g, models: (g.models || []).filter((m) => modelName(m).toLowerCase().includes(q) || String(m.id).toLowerCase().includes(q)) })).filter((x) => x.models.length) : [];

      const isCur = (c) => state.current && keyOf(c.sel) === keyOf(state.current);
      const row = (c) => h('button', {
        key: keyOf(c.sel), type: 'button', role: 'menuitemradio', 'aria-checked': isCur(c), className: 'cui-item', onClick: () => choose(c), title: `${c.group.name || c.group.id} · ${c.model.id}`,
      },
      h('span', { className: 'cui-item-label' }, modelName(c.model)),
      h('span', { className: 'cui-item-tail' }, isCur(c) ? h('span', { className: 'cui-check' }, Icon.check()) : null));

      const provOpen = sub && typeof sub === 'object' ? sub.prov : null;
      // 子菜单：贴着主菜单里触发它的那一行展开，右边放不下就放左边
      const subMenu = () => {
        if (!sub || !menuRef.current) return null;
        const m = menuRef.current.getBoundingClientRect();
        const sel = sub === 'effort' ? '[data-sub="effort"]' : `[data-prov="${window.CSS.escape(provOpen)}"]`;
        const anchor = menuRef.current.querySelector(sel)?.getBoundingClientRect() || m;
        const width = sub === 'effort' ? 220 : 300;
        let items;
        if (sub === 'effort') {
          const levels = reasoning ? [...(reasoning.defaultEffort === undefined ? [{ id: undefined, name: '默认' }] : []), ...(reasoning.efforts || [])] : [];
          items = levels.length ? levels.map((lv) => h('button', { key: String(lv.id), type: 'button', className: 'cui-item', onClick: () => chooseEffort(lv.id) },
            h('span', { className: 'cui-item-label' }, lv.name),
            h('span', { className: 'cui-item-tail' }, effort === lv.id ? h('span', { className: 'cui-check' }, Icon.check()) : null)))
            : [h('div', { key: 'none', className: 'cui-empty' }, '当前模型没有推理强度选项')];
        } else {
          const g = groups.find((x) => x.id === provOpen);
          if (!g) return null;
          items = (g.models || []).length ? g.models.map((md) => row({ group: g, model: md, sel: { provider: g.id, model: md.id } }))
            : [h('div', { key: 'none', className: 'cui-empty' }, '这个服务商没有可用模型')];
        }
        const height = Math.min(436, 16 + items.length * 32);
        const fitsRight = m.right + 6 + width <= window.innerWidth - 8;
        const style = { position: 'fixed', width, top: Math.max(8, Math.min(anchor.top - 6, window.innerHeight - height - 8)), ...(fitsRight ? { left: m.right + 6 } : { right: Math.max(8, window.innerWidth - m.left + 6) }) };
        return h('div', { ref: subRef, className: 'cui-menu cui-prov', role: 'menu', style, onMouseEnter: () => clearTimeout(hoverTimer.current) },
          h('div', { className: 'cui-scroll cui-scroll-tall' }, items));
      };

      // 主菜单：搜索框 + 服务商列表（可滚动），底部固定推理强度
      const list = q
        ? (filtered.length ? filtered.map(({ g, models }) => h(React.Fragment, { key: g.id },
          h('div', { className: 'cui-group' }, g.name || g.id),
          models.map((md) => row({ group: g, model: md, sel: { provider: g.id, model: md.id } }))))
          : h('div', { className: 'cui-empty' }, '没有匹配的模型'))
        : groups.length ? groups.map((g) => h('button', {
          key: g.id, type: 'button', 'data-prov': g.id, className: 'cui-item' + (provOpen === g.id ? ' cui-active' : ''),
          onMouseEnter: () => hoverSub({ prov: g.id }), onMouseLeave: () => clearTimeout(hoverTimer.current), onClick: () => setSub(provOpen === g.id ? null : { prov: g.id }),
        },
        h('span', { className: 'cui-item-label' }, g.name || g.id),
        state.current?.provider === g.id ? h('span', { className: 'cui-cur-dot', title: '当前模型所在服务商' }) : null,
        h('span', { className: 'cui-item-tail cui-dim' }, String((g.models || []).length), Icon.chevronR())))
          : h('div', { className: 'cui-empty' }, '暂无可用模型');

      const label = current ? modelName(current.model) : state.current ? state.current.model : '选择模型';
      return h('span', { ref: rootRef, className: 'cui-switch' },
        h('button', { type: 'button', className: 'cui-trigger', 'aria-haspopup': 'menu', 'aria-expanded': open, disabled: !available, onClick: toggle },
          h('span', { className: 'cui-trigger-model' }, label),
          effortName ? h('span', { className: 'cui-trigger-effort' }, effortName) : null),
        call ? h(UsageRing, { sel: state.current, call, onOpen: close }) : null,
        open && pos ? portal(h(React.Fragment, null,
          h('div', { ref: menuRef, className: 'cui-menu cui-more', role: 'menu', style: { position: 'fixed', right: pos.right, bottom: pos.bottom } },
            h('label', { className: 'cui-search' }, Icon.search(), h('input', { autoFocus: true, value: query, placeholder: '搜索模型', onFocus: () => setSub(null), onChange: (e) => { setQuery(e.target.value); setSub(null); } })),
            h('div', { className: 'cui-scroll', onScroll: () => setSub(null) }, list),
            h('div', { className: 'cui-sep' }),
            h('button', { type: 'button', 'data-sub': 'effort', className: 'cui-item' + (sub === 'effort' ? ' cui-active' : ''), onMouseEnter: () => hoverSub('effort'), onMouseLeave: () => clearTimeout(hoverTimer.current), onClick: () => setSub(sub === 'effort' ? null : 'effort') },
              h('span', { className: 'cui-item-label' }, '推理强度'),
              h('span', { className: 'cui-item-tail cui-dim' }, effortName || '—', Icon.chevronR()))),
          subMenu())) : null);
    }

    // ---------- 产出：从每轮的 deliverables 记录收集 ----------
    const outputs = new Map(); // sessionId -> { seqs:Set, presented:Map, listeners:Set, files:Map, loading:Set }
    function outputsOf(sessionId) {
      let o = outputs.get(sessionId);
      if (!o) { o = { seqs: new Set(), presented: new Map(), files: new Map(), listeners: new Set(), version: 0 }; outputs.set(sessionId, o); }
      return o;
    }
    const bump = (o) => { o.version++; o.listeners.forEach((fn) => fn()); };
    async function loadSummary(sessionId, seq) {
      const o = outputsOf(sessionId);
      try {
        const url = new URL(`api/changes.summary?${new URLSearchParams({ sessionId, seq: String(seq) })}`, document.baseURI);
        const res = await fetch(url);
        if (!res.ok) return;
        const body = await res.json();
        for (const f of body?.files || []) {
          const prev = o.files.get(f.path);
          o.files.set(f.path, { path: f.path, display: f.display || f.path, added: (prev?.added || 0) + (f.added || 0), deleted: (prev?.deleted || 0) + (f.deleted || 0), seq });
        }
        bump(o);
      } catch { /* 宿主不再提供该轮摘要时忽略 */ }
    }
    function TurnProbe(props) {
      const sessionId = props.sessionId;
      const data = props.turn?.data?.get?.('deliverables');
      const seq = data?.changes?.seq;
      const presented = data?.presented;
      React.useEffect(() => {
        if (!sessionId) return;
        const o = outputsOf(sessionId);
        let changed = false;
        if (Number.isSafeInteger(seq) && !o.seqs.has(seq)) { o.seqs.add(seq); loadSummary(sessionId, seq); }
        for (const f of presented || []) {
          if (f?.path && !o.presented.has(f.path)) { o.presented.set(f.path, { path: f.path, display: baseName(f.path) }); changed = true; }
        }
        if (changed) bump(o);
      }, [sessionId, seq, presented]);
      return null;
    }
    function useOutputs(sessionId) {
      const o = outputsOf(sessionId);
      React.useSyncExternalStore((fn) => { o.listeners.add(fn); return () => o.listeners.delete(fn); }, () => o.version);
      const map = new Map(o.files);
      for (const [p, f] of o.presented) if (!map.has(p)) map.set(p, f);
      return [...map.values()].reverse();
    }

    // ---------- 右侧概览栏 ----------
    const ORDER_KEY = 'dsh-claude-ui.card-order';
    const FOLD_KEY = 'dsh-claude-ui.card-folded';
    const DEFAULT_ORDER = ['env', 'ctx', 'usage', 'stats', 'out'];
    const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
    const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 配额满时忽略 */ } };

    function fmtDuration(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return '—';
      const s = Math.round(ms / 1000);
      if (s < 60) return `${s}秒`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}分${s % 60}秒`;
      return `${Math.floor(m / 60)}小时${m % 60}分`;
    }
    const fmtExact = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');

    function Card({ id, title, children, defaultOpen = true, count, dragProps }) {
      const [open, setOpen] = React.useState(() => {
        const folded = readJson(FOLD_KEY, {});
        return id in folded ? !folded[id] : defaultOpen;
      });
      const toggle = () => {
        if (dragProps?.consumeClick()) return;
        const next = !open;
        setOpen(next);
        writeJson(FOLD_KEY, { ...readJson(FOLD_KEY, {}), [id]: !next });
      };
      return h('section', { className: 'cui-card' + (dragProps?.dragging ? ' cui-dragging' : ''), ref: dragProps?.ref, style: dragProps?.style, onPointerDown: dragProps?.onPointerDown },
        h('button', { type: 'button', className: 'cui-card-head', onClick: toggle, 'aria-expanded': open },
          h('span', null, title), h('span', { className: 'cui-card-chev' + (open ? '' : ' cui-closed') }, Icon.chevronD()),
          count !== undefined ? h('span', { className: 'cui-card-count' }, String(count)) : null),
        open ? h('div', { className: 'cui-card-body' }, children) : null);
    }

    // 卡片拖拽排序：按住卡片任意空白处或标题拖动，卡片跟随指针，其余卡片平滑让位；顺序存进 localStorage
    function useSortable(keys) {
      const [order, setOrder] = React.useState(() => {
        const saved = readJson(ORDER_KEY, []).filter((k) => keys.includes(k));
        return [...saved, ...keys.filter((k) => !saved.includes(k))];
      });
      const [drag, setDrag] = React.useState(null); // { key, dy }
      const els = React.useRef({});
      const before = React.useRef(null);
      const state = React.useRef(null);
      const suppressClick = React.useRef(false);

      React.useLayoutEffect(() => {
        const rects = before.current;
        if (!rects) return;
        before.current = null;
        for (const key of order) {
          const el = els.current[key];
          if (!el || key === state.current?.key) continue;
          const old = rects[key];
          if (!old) continue;
          const delta = old - el.offsetTop;
          if (delta) el.animate([{ translate: `0 ${delta}px` }, { translate: '0 0' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
      }, [order]);

      const onPointerDown = (key) => (e) => {
        if (e.button !== 0 || e.target.closest('a, input, textarea, .cui-out')) return;
        const el = els.current[key];
        state.current = { key, startY: e.clientY, grab: e.clientY - el.getBoundingClientRect().top, started: false };
        const move = (ev) => {
          const st = state.current;
          if (!st) return;
          if (!st.started) {
            if (Math.abs(ev.clientY - st.startY) < 5) return;
            st.started = true;
            document.body.classList.add('cui-sorting');
          }
          ev.preventDefault();
          const me = els.current[st.key];
          const parentTop = me.parentElement.getBoundingClientRect().top - me.parentElement.scrollTop;
          const y = ev.clientY - parentTop - st.grab; // 卡片顶部应处的位置（相对容器）
          const center = y + me.offsetHeight / 2;
          setOrder((current) => {
            const others = current.filter((k) => k !== st.key);
            let index = others.length;
            for (let i = 0; i < others.length; i++) {
              const o = els.current[others[i]];
              if (o && center < o.offsetTop + o.offsetHeight / 2) { index = i; break; }
            }
            const next = [...others.slice(0, index), st.key, ...others.slice(index)];
            if (next.join() === current.join()) return current;
            before.current = Object.fromEntries(current.map((k) => [k, els.current[k]?.offsetTop ?? 0]));
            return next;
          });
          setDrag({ key: st.key, y });
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          document.body.classList.remove('cui-sorting');
          const st = state.current;
          state.current = null;
          if (st?.started) {
            suppressClick.current = true;
            setTimeout(() => { suppressClick.current = false; }, 0);
            setOrder((current) => { writeJson(ORDER_KEY, current); return current; });
          }
          setDrag(null);
        };
        window.addEventListener('pointermove', move, { passive: false });
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      };

      const propsFor = (key) => {
        const dragging = drag?.key === key;
        const el = els.current[key];
        const dy = dragging && el ? drag.y - el.offsetTop : 0;
        return {
          ref: (node) => { els.current[key] = node; },
          dragging,
          style: dragging ? { translate: `0 ${dy}px` } : undefined,
          onPointerDown: onPointerDown(key),
          consumeClick: () => suppressClick.current,
        };
      };
      return { order, propsFor };
    }

    function useFace(binding, name) {
      const face = React.useMemo(() => { try { return binding?.session?.projections?.faceOf(name); } catch { return undefined; } }, [binding, name]);
      return useStore(face);
    }

    function OverviewPane({ sessionId, getBinding, sessionsList, directory, openFiles, narrow }) {
      // 概览出现时把右栏收窄到 Claude 信息栏的宽度（之后用户拖宽也不再干预）
      React.useEffect(() => { narrow?.(); }, []);
      const binding = getBinding();
      const sessions = useStore(sessionsList);
      const info = sessions?.byId?.[sessionId];
      const cwd = info?.cwd;
      const pressure = useFace(binding, 'contextPressure');
      const breakdown = useFace(binding, 'contextBreakdown');
      const usage = useFace(binding, 'tokenUsage');
      const stats = useFace(binding, 'sessionStats');
      const sel = useStore(directory);
      const files = useOutputs(sessionId);
      const { order, propsFor } = useSortable(DEFAULT_ORDER);

      const curModel = (() => {
        const s = sel?.current;
        if (!s) return '未选择';
        for (const g of sel.groups || []) for (const m of g.models || []) if (g.id === s.provider && m.id === s.model) return `${m.name || m.id}`;
        return s.model;
      })();

      const reported = pressure?.projectedTokens ?? pressure?.pressureTokens;
      const win = pressure?.contextWindow;
      const rows = breakdown ? [
        { key: 'msg', label: '对话消息', value: breakdown.messageTokens || 0, color: 'var(--cui-c-msg)' },
        { key: 'tool', label: '工具定义', value: breakdown.toolsTokens || 0, color: 'var(--cui-c-tool)' },
        { key: 'sys', label: '系统提示词', value: breakdown.systemTokens || 0, color: 'var(--cui-c-sys)' },
      ] : [];
      const known = rows.reduce((n, r) => n + r.value, 0);
      // 首轮尚未回报用量时 pressure 为 0，用分项之和兜底，避免出现「0% 已用」却列出分项
      const used = reported === undefined && !known ? undefined : Math.max(reported || 0, known);
      const free = win && used !== undefined ? Math.max(0, win - used) : undefined;

      const billed = usage ? (usage.uncachedInputTokens || 0) + (usage.cacheReadTokens || 0) + (usage.cacheWriteTokens || 0) : 0;
      const total = usage ? billed + (usage.outputTokens || 0) : 0;
      const hit = billed > 0 ? (usage.cacheReadTokens || 0) / billed : null;
      const tps = stats && stats.decodeMs > 0 ? stats.decodeTokens / (stats.decodeMs / 1000) : null;
      const ttft = stats && stats.ttftSteps > 0 ? stats.ttftMs / stats.ttftSteps : null;
      const kv = (label, value, strong) => h('div', { className: 'cui-kv' }, h('span', null, label), h(strong ? 'strong' : 'b', null, value));

      const cards = {
        env: () => h(Card, { id: 'env', title: '环境', dragProps: propsFor('env') },
          h('div', { className: 'cui-env' }, Icon.computer(), h('span', null, '本机')),
          h('div', { className: 'cui-env', title: cwd || '' }, Icon.folder(), h('span', { className: 'cui-env-main' }, baseName(cwd) || '未选择工作区'), cwd ? h('span', { className: 'cui-env-sub' }, ' · ', cwd) : null),
          h('div', { className: 'cui-env' }, Icon.model(), h('span', { className: 'cui-env-main' }, curModel))),
        ctx: () => h(Card, { id: 'ctx', title: '上下文', dragProps: propsFor('ctx') },
          win && used !== undefined ? h(React.Fragment, null,
            h('div', { className: 'cui-ctx-head' }, h('span', null, `${Math.min(100, Math.round((used / win) * 100))}% 已用`), h('span', { className: 'cui-dim' }, `${fmtK(used)} / ${fmtK(win)}`)),
            h('div', { className: 'cui-ctx-bar' },
              (known ? rows : [{ key: 'all', value: used, color: 'var(--cui-c-msg)' }]).map((r) => h('i', { key: r.key, style: { width: `${(r.value / win) * 100}%`, background: r.color } }))),
            h('div', { className: 'cui-ctx-rows' },
              rows.map((r) => h('div', { key: r.key, className: 'cui-ctx-row' }, h('i', { style: { background: r.color } }), h('span', null, r.label), h('b', null, fmtK(r.value)), h('em', null, pct(r.value, win)))),
              free !== undefined ? h('div', { className: 'cui-ctx-row' }, h('i', { style: { background: 'var(--cui-c-free)' } }), h('span', null, '可用空间'), h('b', null, fmtK(free)), h('em', null, pct(free, win))) : null))
            : h('div', { className: 'cui-empty' }, '发送第一条消息后显示上下文占用')),
        usage: () => h(Card, { id: 'usage', title: 'Token 用量', dragProps: propsFor('usage') },
          total > 0 ? h(React.Fragment, null,
            h('div', { className: 'cui-ctx-head' }, h('span', null, hit === null ? `${fmtK(total)} tok` : `缓存命中 ${(hit * 100).toFixed(hit >= .995 || hit === 0 ? 0 : 1)}%`), h('span', { className: 'cui-dim' }, `${fmtK(total)} tok`)),
            hit !== null ? h('div', { className: 'cui-ctx-bar' }, h('i', { style: { width: `${hit * 100}%`, background: 'var(--cui-c-msg)' } })) : null,
            kv('未缓存输入', `${fmtExact(usage.uncachedInputTokens)}`),
            kv('缓存读取', `${fmtExact(usage.cacheReadTokens)}`),
            usage.cacheWriteTokens ? kv('缓存写入', `${fmtExact(usage.cacheWriteTokens)}`) : null,
            kv('输出', `${fmtExact(usage.outputTokens)}`),
            kv('合计', `${fmtExact(total)}`, true))
            : h('div', { className: 'cui-empty' }, '暂无用量')),
        stats: () => h(Card, { id: 'stats', title: '会话统计', dragProps: propsFor('stats') },
          stats && stats.steps > 0 ? h(React.Fragment, null,
            kv('轮次 / 步数', `${stats.turns} 轮 · ${stats.steps} 步`),
            stats.llmMs > 0 ? kv('模型用时', fmtDuration(stats.llmMs)) : null,
            stats.toolMs > 0 ? kv('工具调用用时', fmtDuration(stats.toolMs)) : null,
            ttft !== null ? kv('首 token 平均', ttft >= 1000 ? `${(ttft / 1000).toFixed(ttft >= 10000 ? 0 : 1)}秒` : `${Math.round(ttft)}毫秒`) : null,
            tps !== null ? kv('输出速度', `${tps.toFixed(tps >= 100 ? 0 : 1)} tok/s`) : null)
            : h('div', { className: 'cui-empty' }, '暂无统计')),
        out: () => h(Card, { id: 'out', title: '产出', defaultOpen: false, count: files.length, dragProps: propsFor('out') },
          files.length ? files.slice(0, 40).map((f) => h('button', { key: f.path, type: 'button', className: 'cui-out', title: f.path, onClick: openFiles },
            Icon.file(), h('span', { className: 'cui-out-name' }, baseName(f.display || f.path)),
            f.added || f.deleted ? h('span', { className: 'cui-out-diff' }, h('ins', null, `+${f.added || 0}`), h('del', null, `-${f.deleted || 0}`)) : null))
            : h('div', { className: 'cui-empty' }, '本会话暂未改动文件')),
      };

      return h('div', { className: 'cui-overview' }, order.map((key) => h(React.Fragment, { key }, cards[key]())));
    }
    const OverviewTitle = () => '概览';

    // ---------- 会话顶栏工具按钮（Claude 右上角那排图标） ----------
    // 对话 / 轨迹 两个原生标签被收起后，用这个按钮在两者之间切换
    function toggleTrajectory() {
      const tabs = [...document.querySelectorAll('[class~="Dc7zOa_tabs"] button')];
      const active = tabs.find((b) => /Active/.test(b.className));
      const target = tabs.find((b) => b !== active);
      target?.click();
    }
    function HeaderTools({ open }) {
      const [, force] = React.useReducer((n) => n + 1, 0);
      const btn = (key, title, icon, onClick, pressed) => h('button', {
        key, type: 'button', className: 'cui-tool', title, 'aria-label': title, 'aria-pressed': pressed ? 'true' : undefined,
        onClick: () => { (onClick || (() => open(key)))(); setTimeout(force, 60); },
      }, icon());
      const overviewOpen = !!document.querySelector('.cui-overview');
      const onTrajectory = /轨迹/.test(document.querySelector('[class~="Dc7zOa_tabs"] [class*="tabActive"]')?.textContent || '');
      return h('span', { className: 'cui-tools' },
        btn('overview', '概览', Icon.panel, null, overviewOpen),
        btn('trajectory', onTrajectory ? '返回对话' : '轨迹', Icon.trajectory, toggleTrajectory, onTrajectory),
        h('span', { className: 'cui-tools-sep' }),
        btn('terminal', '终端', Icon.terminal),
        btn('browser', '浏览器', Icon.globe),
        btn('files', '文件', Icon.files));
    }

    // ---------- 运行中状态行：Claude 式「•• 1m 7s · 442 tokens · 思考中」 ----------
    // DSH 的「深度求索中，用时 …」不是插槽，只能保留它的容器、藏起原内容，再把我们的一行放进去。
    // 用时取自原标签（它按本轮真实开始时间计时，刷新也不会归零），token 取本轮输出增量，活动取当前运行中的步骤组标题。
    function toClaudeDuration(text) {
      const n = (re) => Number((text.match(re) || [])[1] || 0);
      const h2 = n(/(\d+)\s*(?:小时|h)/), m = n(/(\d+)\s*(?:分|m(?!s))/), s = n(/(\d+)\s*(?:秒|s)/);
      if (!h2 && !m && !s) return '';
      return h2 ? `${h2}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
    }
    function RunningLine({ useProjection }) {
      const anchor = React.useRef(null);
      const usage = typeof useProjection === 'function' ? useProjection('tokenUsage') : undefined;
      const outRef = React.useRef(0);
      outRef.current = usage?.outputTokens || 0;
      React.useEffect(() => {
        const root = anchor.current?.closest('[class*="Dc7zOa_root"]') || document;
        let host = null; let line = null; let base = null; let timer = 0;
        const render = () => {
          if (!host || !line) return;
          const native = host.querySelector('[class*="runningText"]')?.textContent || '';
          const dur = toClaudeDuration(native.replace(/^[^，,]*[，,]/, ''));
          const tokens = Math.max(0, outRef.current - (base ?? outRef.current));
          const live = [...root.querySelectorAll('[class~="WW4l1q_title"]')].reverse().find((t) => t.querySelector('[data-shimmer="true"]'));
          // 标准模式的标签后面会接上实时细节（模型的推理原文），只取分隔符前的简短活动名
          const rawActivity = live?.querySelector('[class~="WW4l1q_label"]')?.textContent?.trim() || '';
          const activity = rawActivity.split(/\s*[·•]\s*/)[0].slice(0, 16) || '思考中';
          const parts = [dur || '0s', `${tokens.toLocaleString('en-US')} tokens`, activity];
          line.querySelector('.cui-run-text').textContent = parts.join(' · ');
        };
        const attach = () => {
          const el = root.querySelector('[data-chat-running]');
          if (el === host) return;
          host = el;
          if (!host) { clearInterval(timer); timer = 0; base = null; line = null; return; }
          base = outRef.current;
          line = document.createElement('span');
          line.className = 'cui-run';
          line.innerHTML = '<span class="cui-run-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="cui-run-text"></span>';
          host.appendChild(line);
          render();
          clearInterval(timer);
          timer = setInterval(render, 500);
        };
        attach();
        const mo = new MutationObserver(attach);
        mo.observe(root, { childList: true, subtree: true });
        return () => { mo.disconnect(); clearInterval(timer); line?.remove(); };
      }, []);
      return h('span', { ref: anchor, hidden: true });
    }

    // ---------- 侧栏顶部：去掉大 Logo ----------
    const Nothing = () => null;
    // 品牌名位置换成 Claude 式搜索框：点击后触发 DSH 自带的会话搜索
    function SearchBox() {
      // 渲染在原品牌按钮内部，所以不能再嵌一个 button；在捕获阶段拦下点击，改为打开会话搜索
      const open = (e) => {
        e.preventDefault(); e.stopPropagation();
        const btn = document.querySelector('[class~="_9lTDKa_search"] button, [class~="_9lTDKa_searchButton"]');
        btn?.click();
      };
      return h('span', { className: 'cui-searchbox', role: 'search', onClickCapture: open }, Icon.search(), h('span', { className: 'cui-searchbox-text' }, '搜索'));
    }

    const CSS = `
:root{--cui-c-msg:#2c84db;--cui-c-tool:#e5683c;--cui-c-sys:#2aa876;--cui-c-free:#e8e6dc}
body[data-ds-dark-theme]{--cui-c-free:#3a3936}
/* 隐藏 DSH 自带的上下文圆环（改由右侧概览栏展示） */
[class^="_2WTFBq_root"]{display:none!important}

.cui-switch{display:inline-flex;align-items:center;gap:2px;min-width:0}
.cui-trigger{display:inline-flex;align-items:center;gap:6px;max-width:360px;height:28px;padding:0 8px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:14px;cursor:pointer;white-space:nowrap;overflow:hidden}
.cui-trigger:hover,.cui-trigger[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover)}
.cui-trigger:disabled{opacity:.5;cursor:default}
.cui-trigger-model{overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}
.cui-trigger-effort{color:var(--dsw-alias-label-tertiary)}

.cui-menu{z-index:2000;min-width:260px;max-width:380px;padding:6px;border-radius:14px;background:var(--dsw-menu-surface-fill,#fff);box-shadow:var(--dsw-elevation-panel,0 0 0 .5px #0002,0 4px 20px #0001);color:var(--dsw-alias-label-primary);font-size:14px}
.cui-more{width:300px;padding:6px}
.cui-prov{padding:6px}
.cui-scroll-tall{max-height:408px}
.cui-cur-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#d97757)}
.cui-item{display:flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:4px 10px;border:none;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.cui-item:hover,.cui-item.cui-active{background:var(--dsw-alias-interactive-bg-hover)}
.cui-item-label{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cui-item-tail{margin-left:auto;display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-tertiary);font-size:13px;font-variant-numeric:tabular-nums}
.cui-dim{color:var(--dsw-alias-label-tertiary)}
.cui-check{color:var(--cui-c-msg);display:inline-flex}
.cui-badge{flex:none;padding:1px 6px;border-radius:5px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cui-sep{height:.5px;margin:4px 8px;background:var(--dsw-alias-border-l2)}
.cui-group{padding:8px 10px 2px;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:500}
.cui-search{display:flex;align-items:center;gap:6px;margin:2px 4px 4px;padding:0 8px;height:32px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary)}
.cui-search input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px}
.cui-scroll{max-height:360px;overflow-y:auto}
/* ---------- 设置窗口：Claude 式的大面板 ----------
   不依赖 DSH 的哈希类名前缀（每次升级都会变），只按「带 _navList 的对话框」和类名后缀定位。 */
[role="dialog"]:has([class*="_navList"]) {
  width: min(1600px, calc(100vw - 160px)) !important;
  max-width: none !important;
  height: min(1080px, calc(100vh - 96px)) !important;
  max-height: none !important;
  border-radius: 16px !important;
  overflow: hidden;
}
/* 左侧导航 */
[role="dialog"]:has([class*="_navList"]) > [class*="_nav"]:not([class*="_navList"]) {
  flex: 0 0 264px !important;
  width: 264px !important;
  padding: 16px 14px 16px !important;
  gap: 10px !important;
  border-right: .5px solid var(--dsw-alias-border-l2);
  overflow-y: auto;
}
[role="dialog"]:has([class*="_navList"]) [class*="_navTitle"] {
  order: 1;
  padding: 6px 10px 0 !important;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px !important;
  font-weight: 400 !important;
}
[role="dialog"]:has([class*="_navList"]) [class*="_navList"] { order: 2; gap: 2px !important; }
[role="dialog"]:has([class*="_navList"]) [class*="_navCell"] {
  min-height: 40px;
  padding: 8px 12px !important;
  gap: 12px !important;
  border-radius: 10px !important;
  font-size: 15px !important;
  color: var(--dsw-alias-label-primary);
}
[role="dialog"]:has([class*="_navList"]) [class*="_navCell"] svg { width: 18px; height: 18px; flex: none; color: var(--dsw-alias-label-secondary); }
[role="dialog"]:has([class*="_navList"]) [class*="_navLabel"] { font-size: 15px !important; }
[role="dialog"]:has([class*="_navList"]) [class*="_navCell"][hidden] { display: none !important; }
/* 导航搜索框（cui-settings-search，由插件注入） */
/* 账号页里嵌入的开放平台用量页：占位块，原生子视图会盖在它上面 */
.cui-usage-embed { position: relative; margin-top: 16px; border: .5px solid var(--dsw-alias-border-l2); border-radius: 12px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
.cui-usage-status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-tertiary); font-size: 13px; }
.cui-usage-embed[data-state="failed"] .cui-usage-status::after { content: "（载入失败，切换一下左侧页面再回来重试）"; }
.cui-settings-search {
  order: 0;
  display: flex; align-items: center; gap: 8px;
  height: 38px; margin: 0 0 2px; padding: 0 12px;
  border: .5px solid var(--dsw-alias-border-l3); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-tertiary);
}
.cui-settings-search input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 15px; }
.cui-settings-search:focus-within { border-color: var(--dsw-alias-border-l4); }
/* 右侧内容 */
[role="dialog"]:has([class*="_navList"]) > [class*="_content"] { flex: 1 1 auto !important; min-width: 0; }
[role="dialog"]:has([class*="_navList"]) [class*="_header"]:has([class*="_close"]) { padding: 18px 20px 4px 32px !important; }
[role="dialog"]:has([class*="_navList"]) [class*="_options"] { padding: 4px 48px 48px 32px !important; }
[role="dialog"]:has([class*="_navList"]) [class*="_options"] > * { max-width: 1120px; }
/* 设置行：标题 15px、说明 13.5px，行距放宽 */
[role="dialog"]:has([class*="_navList"]) [class*="_options"] :is([class$="_row"], [class*="_row "], [class$="_group"], [class*="_group "]) { padding-top: 18px !important; padding-bottom: 18px !important; }
[role="dialog"]:has([class*="_navList"]) [class*="_options"] :is([class$="_title"], [class*="_title "]) { font-size: 15px !important; line-height: 22px; color: var(--dsw-alias-label-primary); }
[role="dialog"]:has([class*="_navList"]) [class*="_options"] :is([class$="_desc"], [class*="_desc "], [class$="_description"], [class*="_description "]) { font-size: 13.5px !important; line-height: 20px; color: var(--dsw-alias-label-tertiary); }
[role="dialog"]:has([class*="_navList"]) [class*="_options"] :is([class$="_rowText"], [class*="_rowText "]) { padding-right: 64px !important; }

/* 额度小圆圈与浮层（Claude 的 Usage 卡片） */
.cui-ring{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin:0;padding:0;border:none;border-radius:7px;background:transparent;cursor:pointer;flex:none}
.cui-ring:hover,.cui-ring[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover)}
.cui-ring circle{fill:none;stroke-width:2}
.cui-ring-track{stroke:var(--dsw-alias-border-l3)}
.cui-ring-fill{stroke:#2c84db;stroke-linecap:round;transition:stroke-dashoffset .4s ease}
.cui-ring[data-tone="warn"] .cui-ring-fill{stroke:#e5a50a}
.cui-ring[data-tone="bad"] .cui-ring-fill{stroke:#d64545}
.cui-ring[data-tone="pts"] .cui-ring-track{stroke:#e5a50a}
.cui-u-pop{width:340px;max-height:min(520px,70vh);overflow:auto;padding:14px 16px 12px;font-size:14px}
.cui-u-head{display:flex;align-items:center;justify-content:space-between}
.cui-u-title{font-weight:600;font-size:15px}
.cui-u-refresh{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.cui-u-refresh:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.cui-u-refresh:disabled svg{animation:cui-spin .8s linear infinite}
@keyframes cui-spin{to{transform:rotate(360deg)}}
.cui-u-src{margin-top:1px}
.cui-u-sec{margin-top:12px}
.cui-u-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;line-height:22px}
.cui-u-name{font-weight:500}
.cui-u-dim{color:var(--dsw-alias-label-tertiary)}
.cui-u-small{font-size:12.5px;line-height:18px}
.cui-u-bar{height:8px;margin:5px 0 4px;border-radius:4px;background:var(--dsw-alias-border-l2);overflow:hidden}
.cui-u-bar i{display:block;height:100%;border-radius:4px;background:#2c84db;transition:width .4s ease}
.cui-u-bar[data-tone="warn"] i{background:#e5a50a}
.cui-u-bar[data-tone="bad"] i{background:#d64545}
.cui-u-plan{font-size:13px;font-variant-numeric:tabular-nums}
.cui-u-total{padding-bottom:6px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.cui-u-big{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
.cui-u-accs{margin-top:4px}
.cui-u-acc{padding:4px 0}
.cui-u-accname{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}
.cui-u-num{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.cui-u-link{margin-top:4px;padding:0;border:none;background:none;color:var(--dsw-alias-link);font:inherit;font-size:13px;cursor:pointer}
.cui-u-err{margin-top:10px;color:var(--dsw-alias-state-error-primary,#d64545);font-size:12.5px;line-height:18px}
/* 积分已合并进圆圈：隐藏 Jet Hub 与 IDE BYOK 的积分胶囊 */
.dim-jh-badge,.dim-jh-badgePending,[data-composer-stat="byok-quota"]{display:none!important}
.cui-empty{padding:8px 10px;color:var(--dsw-alias-label-tertiary);font-size:13px}

.cui-overview{display:flex;flex-direction:column;gap:12px;padding:12px;height:100%;overflow-y:auto;box-sizing:border-box;background:var(--dsw-alias-bg-base)}
.cui-card{border:.5px solid var(--dsw-alias-border-l2);border-radius:14px;padding:4px 14px 12px;background:var(--dsw-alias-bg-layer-1,transparent)}
.cui-card-head{display:flex;align-items:center;gap:4px;width:100%;height:36px;padding:0;border:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;font-weight:500;cursor:pointer}
.cui-card-chev{display:inline-flex;color:var(--dsw-alias-label-tertiary);transition:transform .15s}
.cui-card-chev.cui-closed{transform:rotate(-90deg)}
.cui-card-body{display:flex;flex-direction:column;gap:6px;font-size:14px}
.cui-env{display:flex;align-items:center;gap:10px;min-height:26px;color:var(--dsw-alias-label-primary);min-width:0}
.cui-env svg{flex:none;color:var(--dsw-alias-label-secondary)}
.cui-env-main{flex:none;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cui-env-sub{min-width:0;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cui-ctx-head{display:flex;justify-content:space-between;font-size:14px}
.cui-ctx-bar{display:flex;gap:1px;height:6px;margin:6px 0 8px;border-radius:3px;overflow:hidden;background:var(--cui-c-free)}
.cui-ctx-bar i{display:block;height:100%;min-width:2px}
.cui-ctx-rows{display:flex;flex-direction:column;gap:2px}
.cui-ctx-row{display:grid;grid-template-columns:12px 1fr auto 56px;align-items:center;gap:8px;min-height:26px;font-size:14px}
.cui-ctx-row i{width:10px;height:10px;border-radius:2px}
.cui-ctx-row b{font-weight:400;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.cui-ctx-row em{font-style:normal;text-align:right;font-variant-numeric:tabular-nums}
.cui-out{display:flex;align-items:center;gap:10px;min-height:28px;padding:0 4px;margin:0 -4px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;text-align:left;cursor:pointer}
.cui-out:hover{background:var(--dsw-alias-interactive-bg-hover)}
.cui-out svg{flex:none;color:var(--dsw-alias-label-secondary)}
.cui-out-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cui-out-diff{margin-left:auto;display:inline-flex;gap:6px;font-size:12px;font-variant-numeric:tabular-nums}
.cui-out-diff ins{text-decoration:none;color:var(--dsw-alias-state-success-primary)}
.cui-out-diff del{text-decoration:none;color:var(--dsw-alias-state-error-primary)}

/* ===================== 布局：一比一对齐 Claude 桌面版 ===================== */
/* ---- 侧栏 ---- */
[class~="BynINW_sidebarCol"]{border-right:.5px solid var(--dsw-alias-border-l3)!important}
[class~="_2H3hWW_root"]{padding:6px 10px 8px!important}
[class~="_2H3hWW_logoRow"]{flex-wrap:wrap!important;align-items:center!important;height:auto!important;padding:2px 0 4px!important;margin:0 0 6px!important;gap:8px!important}
[class~="_2H3hWW_logoRow"] [class~="_2H3hWW_toggle"]{order:-1;margin:0 auto 0 0!important;width:28px!important;height:28px!important;border-radius:7px!important;color:var(--dsw-alias-label-secondary)}
button[class~="_2H3hWW_brand"][class~="_2H3hWW_wide"]{order:1;flex:1 0 100%!important;width:100%!important;height:32px!important;margin:0!important;padding:0 9px!important;border:.5px solid var(--dsw-alias-border-l3)!important;border-radius:8px!important;background:var(--dsw-alias-bg-layer-1,#fff)!important;box-shadow:0 1px 1px #1f1e1d08!important;cursor:text!important}
button[class~="_2H3hWW_brand"][class~="_2H3hWW_wide"]:hover{border-color:var(--dsw-alias-border-l4)!important}
[class~="_2H3hWW_brandIdentity"]{width:100%!important;height:100%!important}
[class~="_2H3hWW_brandMark"]{display:none!important}
[class~="_2H3hWW_brandName"]{flex:1!important;width:auto!important;height:100%!important;display:flex!important;align-items:center}
.cui-searchbox{display:flex;align-items:center;gap:8px;width:100%;height:100%;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:20px}
.cui-searchbox svg{width:15px;height:15px;flex:none}
button[class~="_2H3hWW_newSession"]{height:28px!important;margin:0!important;padding:0 8px!important;justify-content:flex-start!important;border-radius:7px!important;background:transparent!important;border:none!important;box-shadow:none!important}
button[class~="_2H3hWW_newSession"]:hover{background:var(--dsw-specific-sidebar-nav-item-hover)!important}
[class~="_2H3hWW_newSessionLabelMask"]{width:auto!important;flex:1!important;justify-content:flex-start!important;-webkit-mask-image:none!important;mask-image:none!important}
[class~="_2H3hWW_newSessionContent"]{width:auto!important;justify-content:flex-start!important;gap:9px!important}
[class~="_2H3hWW_newSessionContent"]>svg{display:none!important}
[class~="_2H3hWW_newSessionContent"]::before{content:"+";flex:none;display:inline-grid;place-items:center;width:20px;height:20px;margin-left:-2px;border-radius:50%;background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-secondary);font-size:15px;line-height:1}
[class~="_2H3hWW_newSessionLabel"],[class~="_2H3hWW_panelTitle"]{font-size:14px!important;font-weight:400!important;color:var(--dsw-alias-label-primary)!important}
[class~="_2H3hWW_newSessionShortcut"]{display:none!important}
[class~="_2H3hWW_panelList"]{gap:0!important;margin:0 0 16px!important}
button[class~="_2H3hWW_panelRow"]{height:28px!important;margin:0!important;padding:0 8px!important;gap:9px!important;border-radius:7px!important}
[class~="_2H3hWW_panelGlyph"]{width:16px!important;height:16px!important;display:inline-grid!important;place-items:center;color:var(--dsw-alias-label-secondary)}
[class~="_2H3hWW_panelGlyph"] svg{width:16px!important;height:16px!important}
/* 「工作区」标题：Claude 没有这一行，只保留右侧小图标 */
[class~="_9lTDKa_sectionHeader"]{height:24px!important;min-height:24px!important;margin:0 -4px 2px 0!important}
[class~="_9lTDKa_sectionLabel"]{visibility:hidden}
[class~="_9lTDKa_sectionHeader"] button{width:24px!important;height:24px!important;color:var(--dsw-alias-label-tertiary)!important;opacity:.85}
[class~="_9lTDKa_sectionHeader"] button svg{width:15px!important;height:15px!important}
/* 工作区分组标题：小号灰字，不缩进 */
[class^="hIlkoa_projectRow"]{height:28px!important;padding:0 8px!important;border-radius:7px!important}
[class^="hIlkoa_projectRow"][aria-expanded="true"]{margin-top:10px}
[class^="hIlkoa_projectRow"] [class*="hIlkoa_folder"]{display:none!important}
[class^="hIlkoa_projectRow"] [class^="hIlkoa_title"],[class^="hIlkoa_projectRow"] [class^="hIlkoa_projectText"]{font-size:12.5px!important;font-weight:400!important;color:var(--dsw-alias-label-tertiary)!important}
/* 会话行：14px 主色，与分组标题左对齐 */
[class^="hIlkoa_sessionRow"]{height:28px!important;padding:0 8px!important;border-radius:7px!important;font-size:14px!important;color:var(--dsw-alias-label-primary)!important}
[class^="hIlkoa_sessionRow"] [class^="hIlkoa_time"]{font-size:11px!important;color:var(--dsw-alias-label-caption)!important}
[class^="hIlkoa_sessionRow"]>[class~="hIlkoa_slot"]:not(:has(svg,img,[role=status])){display:none!important}
[class~="_9lTDKa_sessionOverflowButton"]{padding-left:8px!important;font-size:12.5px!important;height:26px!important;color:var(--dsw-alias-label-tertiary)!important}

/* ---- 会话顶栏：一行 44px，标题 14px，无分隔线；对话/轨迹标签收进右侧图标 ---- */
[class~="Dc7zOa_header"]:not([class~="Dc7zOa_headerBlank"]){min-height:44px!important;padding:6px 14px 0 20px!important;border-bottom:none!important}
[class~="Dc7zOa_tabs"]{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;margin:0!important}
[class~="Dc7zOa_crumbCurrent"]{font-size:14px!important;font-weight:400!important;color:var(--dsw-alias-label-primary)!important}
[class~="Dc7zOa_crumb"]{font-size:14px!important}
[class~="Dc7zOa_headerActions"] *{font-size:12px!important;color:var(--dsw-alias-label-tertiary)!important}
[class~="Dc7zOa_headerUtilities"]{gap:2px!important}

/* ---- 输入框：单行卡片，权限与模型移到卡片下方的页脚行 ---- */
[class~="RlGAzG_root"]{position:relative!important;padding-bottom:34px!important;margin-bottom:6px!important}
[class~="RlGAzG_card"]{position:relative!important;display:grid!important;grid-template-columns:30px minmax(0,1fr) 30px!important;grid-template-rows:auto auto auto!important;align-items:center!important;gap:0 4px!important;row-gap:0!important;min-height:44px!important;padding:7px 7px 7px 6px!important;border-radius:14px!important;border:none!important;background:var(--dsw-specific-input-major)!important;box-shadow:0 0 0 .5px var(--dsw-alias-border-l3),0 1px 3px #1f1e1d0d!important}
/* 插槽包装是 display:contents，真正进网格的是里面的元素：附件条必须独占上方一整行，否则会撑宽第一列把输入框挤走 */
[class~="RlGAzG_card"]>[data-slot="conversation.input.attachments"],[class~="RlGAzG_card"]>[data-slot="conversation.input.attachments"]>*{grid-column:1/-1!important;grid-row:2!important;min-width:0!important;max-width:100%!important}
[class~="RlGAzG_card"]>[data-slot="conversation.input.attachments"]>*{margin:0 0 6px!important;overflow-x:auto}
[class~="RlGAzG_card"]>[data-slot="conversation.input.overlay"]>*,[class~="RlGAzG_overlayAnchor"]>*{grid-column:1/-1!important;grid-row:1!important}
[class~="RlGAzG_card"]>[data-slot="conversation.input.attachments"]:has(*:not(:empty)){margin-bottom:6px}
[class~="RlGAzG_scroll"]{grid-column:2;grid-row:3;align-self:center;margin:0!important}
[class~="RlGAzG_row"],[class~="RlGAzG_tools"],[class~="RlGAzG_trailing"]{display:contents!important}
button[class~="RlGAzG_add"]{grid-column:1;grid-row:3;align-self:center;width:30px!important;height:30px!important;border-radius:8px!important;background:transparent!important;color:var(--dsw-alias-label-secondary)!important;box-shadow:none!important;border:none!important}
button[class~="RlGAzG_add"]:hover{background:var(--dsw-alias-interactive-bg-hover)!important}
button[class^="RlGAzG_primary"]{grid-column:3;grid-row:3;align-self:center;width:30px!important;height:30px!important;border-radius:8px!important;background:#d97757!important;color:#fff!important;transform:none!important}
button[class^="RlGAzG_primary"]:disabled{opacity:0!important;pointer-events:none!important}
/* 单行输入：去掉新会话输入框的 52px 最小高度和上内边距 */
[class~="RlGAzG_input"],[class~="RlGAzG_hero"] [class~="RlGAzG_input"]{min-height:24px!important;padding:1px 8px 1px 6px!important;font-size:14px!important;line-height:22px!important}
[class~="RlGAzG_placeholder"]{inset:1px 8px auto 6px!important;font-size:14px!important;line-height:22px!important;color:var(--dsw-alias-label-tertiary)!important;white-space:nowrap!important;display:block!important}
/* 页脚：左侧权限 → 紧接扩展槽；右侧扩展徽标 + 模型；统计紧贴在右侧这组的左边，互不重叠 */
[class~="RlGAzG_modes"]{position:absolute!important;left:2px;top:calc(100% + 5px);display:flex;align-items:center;gap:2px;white-space:nowrap;anchor-name:--cui-footer-left}
[class~="RlGAzG_card"] [data-slot="conversation.input.left"]{position:absolute!important;left:150px;top:calc(100% + 5px);white-space:nowrap}
@supports (anchor-name: --a){[class~="RlGAzG_card"] [data-slot="conversation.input.left"]{position-anchor:--cui-footer-left;left:calc(anchor(right) + 6px);top:anchor(top)}}
[class~="RlGAzG_standardControls"]{position:absolute!important;right:2px;top:calc(100% + 4px);display:flex!important;align-items:center;gap:6px!important;white-space:nowrap;anchor-name:--cui-footer-right}
[class~="RlGAzG_activity"]{position:absolute!important;right:44px;top:50%;translate:0 -50%}
[class~="RlGAzG_modes"] button,[class~="RlGAzG_modes"] [role="button"]{font-size:13px!important;color:var(--dsw-alias-label-tertiary)!important;background:transparent!important;box-shadow:none!important;border:none!important;height:24px!important;padding:0 6px!important;border-radius:6px!important}
[class~="RlGAzG_modes"] button:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-secondary)!important}
[class~="RlGAzG_dock"]{position:absolute!important;left:auto;right:50%;bottom:6px;margin:0!important;padding:0!important;width:auto!important;gap:10px!important;white-space:nowrap}
@supports (anchor-name: --a){[class~="RlGAzG_dock"]{position-anchor:--cui-footer-right;right:calc(anchor(left) + 10px);top:anchor(top);bottom:auto;height:24px;align-items:center}}
[class~="RlGAzG_dock"] [data-composer-stat] *,[class~="RlGAzG_dock"] .byok-q-pill{font-size:12.5px!important;color:var(--dsw-alias-label-caption)!important}
[class~="RlGAzG_standardControls"] [data-slot="conversation.input.right"] *{font-size:12.5px!important}
.cui-trigger{height:24px!important;font-size:13px!important;padding:0 6px!important;border-radius:6px!important}
.cui-trigger-model{color:var(--dsw-alias-label-secondary)!important}
.cui-trigger-effort{color:var(--dsw-alias-label-tertiary)!important}

/* ---- 右栏：Claude 式常驻信息栏 ---- */
/* 主区与右栏之间不画分隔线（Claude 两栏同底色、无边框） */
[class~="BynINW_rightbarCol"] [class*="_tabHost_"],[class~="BynINW_rightbarCol"] [class*="_pane_"]{border-left:none!important;box-shadow:none!important}
[data-slot="rightbar"]:has(.cui-overview) [role="tablist"]{display:none!important}
.cui-overview{gap:10px!important;padding:10px 12px!important;background:var(--dsw-alias-bg-base)!important}
.cui-card{border:.5px solid var(--dsw-alias-border-l3)!important;border-radius:12px!important;padding:2px 12px 10px!important;background:transparent!important}
.cui-card-head{height:34px!important;font-size:13px!important;font-weight:600!important;justify-content:flex-start}
.cui-card-count{margin-left:auto;font-weight:400;color:var(--dsw-alias-label-tertiary)}
.cui-card-body{font-size:13px!important;gap:4px!important}
.cui-env{min-height:24px!important;gap:9px!important;font-size:13px}
.cui-env svg{width:15px;height:15px}
.cui-ctx-head{font-size:13.5px!important}
.cui-ctx-head span:first-child{font-weight:500}
.cui-ctx-bar{height:4px!important;border-radius:2px!important;margin:6px 0 8px!important}
.cui-ctx-row{grid-template-columns:10px 1fr auto 48px!important;gap:8px!important;min-height:23px!important;font-size:13px!important}
.cui-ctx-row span{color:var(--dsw-alias-label-secondary)}
.cui-ctx-row i{width:9px!important;height:9px!important;border-radius:2px!important}
.cui-out{min-height:24px!important;font-size:13px!important}

/* 统计移到右栏后，页脚不再显示这两个药丸 */
[data-composer-stat="activity"],[data-composer-stat="usage"]{display:none!important}
.cui-kv{display:flex;align-items:baseline;justify-content:space-between;gap:12px;min-height:23px;font-size:13px}
.cui-kv span{color:var(--dsw-alias-label-secondary)}
.cui-kv b{font-weight:400;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.cui-kv strong{font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.cui-overview{position:relative}
.cui-card{position:relative;touch-action:none;user-select:none}
.cui-card.cui-dragging{z-index:5;cursor:grabbing;scale:1.015;box-shadow:0 10px 30px #1f1e1d26,0 0 0 .5px var(--dsw-alias-border-l4)!important;background:var(--dsw-alias-bg-base)!important;transition:scale .15s,box-shadow .15s!important;animation:none!important}
body.cui-sorting,body.cui-sorting *{cursor:grabbing!important;user-select:none!important}
/* ---- 工作步骤：Claude 式折叠行（配合「工作步骤展示：标准」） ---- */
@keyframes cui-dots{0%,100%{box-shadow:-5px 0 0 #d9775766,5px 0 0 #d9775733;background:#d97757}33%{box-shadow:-5px 0 0 #d97757,5px 0 0 #d9775766;background:#d9775766}66%{box-shadow:-5px 0 0 #d9775733,5px 0 0 #d97757;background:#d9775799}}
[class~="WW4l1q_title"]{display:inline-flex!important;gap:8px!important;padding:2px 0!important;font-size:14px!important;color:var(--dsw-alias-label-secondary)!important}
[class~="WW4l1q_title"]:hover{color:var(--dsw-alias-label-primary)!important}
[class~="WW4l1q_title"][aria-expanded="true"]{padding-bottom:6px!important}
/* 原本悬停时图标换成前置箭头；改成 Claude 那样：箭头放到行尾 */
[class~="WW4l1q_title"] [class~="WW4l1q_chevron"]{display:none!important}
[class~="WW4l1q_title"]:is(:hover,:focus-visible,[aria-expanded="true"]) [class~="WW4l1q_activityIcon"]{opacity:1!important}
[class~="WW4l1q_title"]::after{content:"";flex:none;width:7px;height:7px;margin-left:2px;border-right:1.4px solid currentColor;border-bottom:1.4px solid currentColor;rotate:-45deg;translate:0 -1px;opacity:.7;transition:rotate .2s cubic-bezier(.2,.8,.2,1),translate .2s}
[class~="WW4l1q_title"][aria-expanded="true"]::after{rotate:45deg;translate:0 -3px}
/* 运行中：用三个跳动的橙点代替图标 */
[class~="WW4l1q_title"]:has([data-shimmer="true"]) [class~="WW4l1q_activityIcon"]{opacity:0!important}
[class~="WW4l1q_title"]:has([data-shimmer="true"]) [class~="WW4l1q_leading"]::before{content:"";position:absolute;left:50%;top:50%;width:3.5px;height:3.5px;margin:-1.75px 0 0 -1.75px;border-radius:50%;animation:cui-dots 1.2s ease-in-out infinite}
/* 展开后的步骤列表：圆角描边框，行间细分隔线 */
[class~="WW4l1q_body"]{margin:0 0 4px!important}
[class~="WW4l1q_content"]{border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;padding:2px 0;background:var(--dsw-alias-bg-layer-1)}
[class~="WW4l1q_content"]>*{margin:0!important;padding:5px 12px}
[class~="WW4l1q_content"]>:not([hidden]):not(:empty)~:not([hidden]):not(:empty){border-top:.5px solid var(--dsw-alias-border-l2)}
[class~="WW4l1q_content"] [data-disclosure-row]{font-size:13.5px}
/* 完成后的「已完成，用时 N 秒」行：同样风格，并补上工具调用次数 */
button[class^="_4AI11G_root"]{display:inline-flex!important;align-items:center;gap:6px;font-size:14px!important;color:var(--dsw-alias-label-secondary)!important}
button[class^="_4AI11G_root"]:hover{color:var(--dsw-alias-label-primary)!important}
button[class^="_4AI11G_root"]>svg{order:2;width:14px;height:14px;opacity:.7}
button[class^="_4AI11G_root"]:not([data-turn-process-tool-calls="0"])::after{order:1;content:"· " attr(data-turn-process-tool-calls) " 次工具调用";color:var(--dsw-alias-label-tertiary)}

/* ---- 运行中状态行：Claude 式，替换「深度求索中」与鲸鱼图标、分隔线 ---- */
[data-chat-running]>[class*="runningDivider"],[data-chat-running]>[class*="runningContent"]{display:none!important}
[data-chat-running]{color:var(--dsw-alias-label-tertiary)!important;padding:4px 0 2px}
.cui-run{display:inline-flex;align-items:center;gap:10px;max-width:100%;white-space:nowrap;font-size:14px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.cui-run-text{min-width:0;overflow:hidden;text-overflow:ellipsis}
.cui-run-dots{flex:none;display:inline-flex;gap:3px;align-items:center}
.cui-run-dots i{width:4px;height:4px;border-radius:50%;background:#d97757;animation:cui-run-dot 1.2s ease-in-out infinite}
.cui-run-dots i:nth-child(2){animation-delay:.2s}.cui-run-dots i:nth-child(3){animation-delay:.4s}
@keyframes cui-run-dot{0%,80%,100%{opacity:.25;scale:.8}40%{opacity:1;scale:1}}
/* ---- 顶栏右侧图标 ---- */
.cui-tools{display:inline-flex;align-items:center;gap:2px}
.cui-tool{display:inline-grid;place-items:center;width:28px;height:28px;border:none;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.cui-tool svg{width:16px;height:16px}
.cui-tool:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.cui-tool[aria-pressed="true"]{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}
.cui-tools-sep{width:.5px;height:16px;margin:0 4px;background:var(--dsw-alias-border-l3)}

/* ===================== 动效层 ===================== */
:root{--cui-ease:cubic-bezier(.2,.8,.2,1);--cui-ease-out:cubic-bezier(.16,1,.3,1);--cui-fast:.14s;--cui-mid:.22s;--cui-slow:.32s}
@keyframes cui-pop-in{from{opacity:0;translate:0 6px;scale:.97}to{opacity:1;translate:0 0;scale:1}}
@keyframes cui-pop-down{from{opacity:0;translate:0 -6px;scale:.97}to{opacity:1;translate:0 0;scale:1}}
@keyframes cui-fade-in{from{opacity:0}to{opacity:1}}
@keyframes cui-rise-in{from{opacity:0;translate:0 10px}to{opacity:1;translate:0 0}}
@keyframes cui-slide-left{from{opacity:0;translate:16px 0}to{opacity:1;translate:0 0}}
@keyframes cui-slide-right{from{opacity:0;translate:-10px 0}to{opacity:1;translate:0 0}}
@keyframes cui-modal-in{from{opacity:0;scale:.96}to{opacity:1;scale:1}}
@keyframes cui-toast-in{from{opacity:0;translate:0 14px;scale:.98}to{opacity:1;translate:0 0;scale:1}}
@keyframes cui-pulse{0%,100%{opacity:1}50%{opacity:.55}}

/* 所有可交互控件：颜色、边框、阴影、位移平滑过渡；按下时轻微回弹 */
button,[role="button"],[role="tab"],[role="menuitem"],[role="menuitemradio"],[role="option"],[role="treeitem"],a,summary,label,input,textarea,select,[contenteditable="true"]{
  transition:background-color var(--cui-fast) var(--cui-ease),color var(--cui-fast) var(--cui-ease),border-color var(--cui-fast) var(--cui-ease),box-shadow var(--cui-mid) var(--cui-ease),opacity var(--cui-fast) var(--cui-ease),scale var(--cui-fast) var(--cui-ease),translate var(--cui-fast) var(--cui-ease),outline-color var(--cui-fast) var(--cui-ease);
}
button:not(:disabled):active,[role="button"]:active,[role="menuitem"]:active,[role="option"]:active,[role="treeitem"]:active{scale:.97;transition-duration:.06s}
svg{transition:rotate var(--cui-mid) var(--cui-ease),transform var(--cui-mid) var(--cui-ease),color var(--cui-fast) var(--cui-ease),opacity var(--cui-fast) var(--cui-ease)}

/* 发送按钮：悬停微抬、按下回弹 */
button[class^="RlGAzG_primary"]:not(:disabled):hover{translate:0 -1px;box-shadow:0 4px 12px #d977574d}
button[class^="RlGAzG_primary"]:not(:disabled):active{translate:0 0;scale:.92}
/* 输入框卡片：聚焦时阴影渐变 */
[class*="RlGAzG_card"]{transition:box-shadow var(--cui-mid) var(--cui-ease),border-color var(--cui-mid) var(--cui-ease)!important}
[class*="RlGAzG_card"]:focus-within{box-shadow:0 0 0 .5px var(--dsw-alias-border-l4,#0003),0 6px 24px #1f1e1d1a!important}

/* 弹层、菜单、下拉、提示：从锚点方向弹出 */
[role="menu"],[role="listbox"],[class$="_menu"],[class*="_menu "],.cui-menu,.byok-q-pop,[role="dialog"]:not([aria-modal="true"]){animation:cui-pop-in var(--cui-mid) var(--cui-ease-out) both;transform-origin:bottom center}
[role="tooltip"]{animation:cui-fade-in var(--cui-fast) var(--cui-ease) both}
/* 模态对话框（设置等）：缩放淡入 */
[role="dialog"][aria-modal="true"],[role="alertdialog"]{animation:cui-modal-in var(--cui-slow) var(--cui-ease-out) both}
[class*="_backdrop"],[class*="_overlay"]:not([data-slot]),[class*="_scrim"]{animation:cui-fade-in var(--cui-mid) var(--cui-ease) both}
/* 提示条 / 通知 */
[data-slot="workspace.toast"]>*,[role="status"],[role="alert"]{animation:cui-toast-in var(--cui-slow) var(--cui-ease-out) both}

/* 对话：每条消息上浮淡入 */
[data-slot="conversation.chat.node"]>*,[data-slot="conversation.user.text.node"]>*,[data-slot="conversation.chat.turnTail"]>*{animation:cui-rise-in var(--cui-slow) var(--cui-ease-out) both}
[class$="_bubble"]{transition:background-color var(--cui-mid) var(--cui-ease)}
/* 输入框上方的停靠条（目标、待办、队列）与下方统计药丸 */
[data-slot="conversation.input.dock"]>*,[data-slot="conversation.composer.dock"]>*,[data-composer-stat]{animation:cui-rise-in var(--cui-mid) var(--cui-ease-out) both}

/* 右侧栏：内容从右侧滑入；标签切换淡入 */
[data-slot="rightbar"]>*{animation:cui-slide-left var(--cui-slow) var(--cui-ease-out) both}
[data-slot="sidebar.right.pane.tab"]>*{animation:cui-fade-in var(--cui-mid) var(--cui-ease) both}
.cui-card{animation:cui-rise-in var(--cui-slow) var(--cui-ease-out) both}
.cui-card:nth-child(2){animation-delay:.04s}.cui-card:nth-child(3){animation-delay:.08s}
.cui-card-body{animation:cui-fade-in var(--cui-mid) var(--cui-ease) both}
.cui-ctx-bar i{transition:width .5s var(--cui-ease-out)}
.byok-q-bar i{transition:width .5s var(--cui-ease-out)}

/* 左侧栏：会话行出现时左滑淡入，悬停背景渐变 */
[class^="hIlkoa_sessionRow"],[class^="hIlkoa_projectRow"],[class^="_2H3hWW_panelRow"],button[class~="_2H3hWW_newSession"]{transition:background-color var(--cui-fast) var(--cui-ease),color var(--cui-fast) var(--cui-ease)!important}
[class^="hIlkoa_sessionRow"]{animation:cui-slide-right var(--cui-mid) var(--cui-ease-out) both}
[class~="_9lTDKa_list"]{transition:opacity var(--cui-mid) var(--cui-ease)}

/* 开关、复选框 */
[role="switch"],[role="switch"] *,input[type="checkbox"],input[type="radio"]{transition:background-color var(--cui-mid) var(--cui-ease),translate var(--cui-mid) var(--cui-ease-out),transform var(--cui-mid) var(--cui-ease-out),left var(--cui-mid) var(--cui-ease-out),right var(--cui-mid) var(--cui-ease-out)!important}

/* 标签页下划线（对话 / 轨迹） */
[role="tab"]::after,[class*="_tab"]::after{transition:background-color var(--cui-mid) var(--cui-ease),opacity var(--cui-mid) var(--cui-ease),scale var(--cui-mid) var(--cui-ease-out)}

/* 运行中状态轻微呼吸 */
[class*="_running"] svg,[aria-busy="true"]>svg{animation:cui-pulse 1.4s ease-in-out infinite}

/* 系统设置了「减少动态效果」时全部关闭 */
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}

`;

    return {
      inject: ['slots', 'sessions', 'remote', 'remote.session', 'modelDirectories', 'sidebarRight', 'sidebarRightTabs', 'layout', 'connection'],
      apply(ctx) {
        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-claude-ui';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => tag.remove();
        }, 'dsh-claude-ui: style');

        // 设置窗口左栏的搜索框：按名称筛选导航项（设置窗口不是插槽，只能在它出现时插进去）
        ctx.effect(() => {
          const attach = () => {
            // 每次 DOM 变动都会进来，只做一次选择器查询
            const list = document.querySelector('[role="dialog"] [class*="_navList"]');
            if (!list || list.parentElement.querySelector('.cui-settings-search')) return;
            const nav = list.parentElement;
            const box = document.createElement('label');
            box.className = 'cui-settings-search';
            box.innerHTML = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10z"/><path d="M10.8 10.8L14 14"/></svg><input type="search" placeholder="搜索设置">';
            const input = box.querySelector('input');
            input.addEventListener('input', () => {
              const q = input.value.trim().toLowerCase();
              list.querySelectorAll('[class*="_navCell"]').forEach((cell) => {
                cell.hidden = !!q && !cell.textContent.toLowerCase().includes(q);
              });
            });
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') list.querySelector('[class*="_navCell"]:not([hidden])')?.click();
            });
            nav.insertBefore(box, nav.firstChild);
          };
          const mo = new MutationObserver(attach);
          mo.observe(document.body, { childList: true, subtree: true });
          attach();
          return () => { mo.disconnect(); document.querySelectorAll('.cui-settings-search').forEach((n) => n.remove()); };
        }, 'dsh-claude-ui: settings search');

        // 「账号与余额」页：把开放平台的用量页直接嵌在余额卡片下面。
        // 用量页是桌面端的原生子视图（window.dshPlatform，DSH 自己的「查询用量」也走它），
        // 只能按矩形摆放、盖在页面之上，所以这里放一个占位块，把子视图的矩形跟着它同步。
        ctx.effect(() => {
          // 只有桌面端主窗口有 dshPlatform；每次用时再取，Web 版里整段不生效
          const bridge = { open: (...a) => globalThis.dshPlatform.open(...a), setBounds: (b) => globalThis.dshPlatform.setBounds(b), close: () => globalThis.dshPlatform.close() };
          let slot = null; let opened = false; let failed = false; let frame = 0; let ro = null; let scroller = null;
          const usageLink = (root) => [...root.querySelectorAll('a')].find((a) => /^(查询用量|View usage)$/.test(a.textContent.trim()) && a.getAttribute('aria-disabled') !== 'true');
          // DSH 自己的全屏用量/充值页打开时会顶掉同一个子视图；它关掉后再把嵌入页开回来
          const nativeOverlay = () => !!document.querySelector('[role="dialog"][aria-modal="true"] header[data-window-drag]');
          const rect = () => {
            const r = slot.getBoundingClientRect();
            const clip = (scroller || slot.parentElement).getBoundingClientRect();
            const top = Math.max(r.top, clip.top); const bottom = Math.min(r.bottom, clip.bottom);
            return { x: Math.max(0, r.left), y: Math.max(0, top), width: Math.max(0, r.width), height: Math.max(0, bottom - top) };
          };
          const fit = () => {
            if (!slot || !scroller) return;
            const r = slot.getBoundingClientRect(); const c = scroller.getBoundingClientRect();
            slot.style.height = `${Math.max(420, Math.round(c.bottom - r.top - 24 + scroller.scrollTop))}px`;
          };
          const sync = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => { if (slot && opened) bridge.setBounds(rect()).catch(() => {}); });
          };
          const open = () => {
            if (!slot || opened || failed || nativeOverlay()) return;
            opened = true;
            slot.dataset.state = 'loading';
            bridge.open('usage', rect()).then(() => { if (slot) slot.dataset.state = 'loaded'; }, () => { opened = false; failed = true; if (slot) slot.dataset.state = 'failed'; });
          };
          const teardown = () => {
            if (opened) bridge.close().catch(() => {});
            opened = false; failed = false;
            ro?.disconnect(); ro = null;
            scroller?.removeEventListener('scroll', sync);
            window.removeEventListener('resize', onResize);
            slot?.remove(); slot = null; scroller = null;
          };
          const onResize = () => { fit(); sync(); };
          const check = () => {
            const dialog = document.querySelector('[role="dialog"]:has([class*="_navList"])');
            const link = globalThis.dshPlatform?.open && dialog && usageLink(dialog);
            if (!link) { if (slot) teardown(); return; }
            if (nativeOverlay()) { if (opened) opened = false; return; }
            if (slot && slot.isConnected) { if (!opened) open(); return; }
            const section = link.closest('section') || link.parentElement;
            scroller = dialog.querySelector('[class*="_options"]');
            slot = document.createElement('div');
            slot.className = 'cui-usage-embed';
            slot.innerHTML = '<div class="cui-usage-status">正在载入用量…</div>';
            section.appendChild(slot);
            fit();
            ro = new ResizeObserver(sync); ro.observe(slot); if (scroller) ro.observe(scroller);
            scroller?.addEventListener('scroll', sync, { passive: true });
            window.addEventListener('resize', onResize);
            // 设置窗口有展开动画，等它停稳再定位
            setTimeout(() => { fit(); open(); sync(); }, 360);
          };
          const mo = new MutationObserver(() => { if (slot || document.querySelector('[role="dialog"] [class*="_navList"]')) check(); });
          mo.observe(document.body, { childList: true, subtree: true });
          return () => { mo.disconnect(); teardown(); };
        }, 'dsh-claude-ui: embedded usage');

        // 额度圆圈用的宿主接口调用（各插件的 /api/<endpoint>）
        const usageCall = async (endpoint, payload) => {
          const raw = await ctx.connection.rpc.call('/api', endpoint, payload);
          if (raw?.ok === true) return raw.value;
          throw new Error(raw?.error?.message || '接口请求失败');
        };
        // 模型切换器：以更低 priority 遮蔽原生的 conversation.input.model（最低者渲染）
        ctx.slots.inject('conversation.input.model', () => ctx.slots.register({
          name: 'conversation.input.model',
          priority: -10,
          inject: (sessionId) => {
            const directory = ctx.modelDirectories.directoryFor(sessionId);
            const available = ctx.sessions.subagentAddress(sessionId) === undefined;
            return {
              available,
              directory: directory.store,
              load: () => { if (available) directory.load().catch(() => {}); },
              call: usageCall,
              select: (selection) => (available ? directory.select(selection) : Promise.resolve(undefined)),
            };
          },
        }, ModelSwitcher));

        // 右侧概览栏
        ctx.effect(() => ctx.sidebarRightTabs.register({ id: OVERVIEW_ID, kind: OVERVIEW_KIND, title: () => '概览' }), 'dsh-claude-ui: overview type');
        const openIn = (sessionId, kind) => {
          try { ctx.sidebarRight.openTabIn(sessionId, kind); } catch (error) { console.warn('[dsh-claude-ui] 打开右栏失败', kind, error); }
          // Claude 的右侧信息栏约 300px 宽；DSH 的下限正好是 300
          if (kind === OVERVIEW_KIND) { try { ctx.layout.panels.setRightbar(300); } catch { /* 旧版没有该接口时忽略 */ } }
        };
        ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: OVERVIEW_ID,
          inject: (sessionId) => ({
            sessionId,
            getBinding: () => ctx.sessions.binding(sessionId),
            sessionsList: ctx.sessions.list,
            directory: (() => { try { return ctx.modelDirectories.directoryFor(sessionId).store; } catch { return undefined; } })(),
            openFiles: () => openIn(sessionId, 'files'),
            narrow: () => { try { ctx.layout.panels.setRightbar(300); } catch { /* 忽略 */ } },
          }),
        }, OverviewPane));
        ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab.title',
          key: OVERVIEW_ID,
        }, OverviewTitle));

        // 每个会话第一次打开时自动展开概览栏，接近 Claude 常驻右栏的体验
        ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'claude-ui-tools',
          order: 100,
          inject: (sessionId) => {
            let opened = {};
            try { opened = JSON.parse(localStorage.getItem(OPENED_KEY) || '{}'); } catch { opened = {}; }
            if (!opened[sessionId]) {
              opened[sessionId] = 1;
              try { localStorage.setItem(OPENED_KEY, JSON.stringify(opened)); } catch { /* 忽略 */ }
              setTimeout(() => openIn(sessionId, OVERVIEW_KIND), 300);
            }
            return { open: (key) => openIn(sessionId, key === 'overview' ? OVERVIEW_KIND : key) };
          },
        }, HeaderTools));

        // 运行中状态行（替换「深度求索中」）
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'cui-running',
          order: 99,
        }, RunningLine));

        // 收集每轮产出的文件
        ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
          name: 'conversation.chat.turnTail',
          id: 'dsh-claude-ui/outputs-probe',
          order: 1000,
        }, TurnProbe));

        // 侧栏顶部的大 Logo 和品牌名
        ctx.slots.inject('sidebar.brand.mark', () => ctx.slots.register({ name: 'sidebar.brand.mark', priority: -10 }, Nothing));
        ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({ name: 'sidebar.brand.name', priority: -10 }, SearchBox));
      }
    };
  }
});
