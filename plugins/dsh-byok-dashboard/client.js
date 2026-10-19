window.__ModuleLoader__.load({
  id: 'dsh-byok-dashboard',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const REFRESH_MS = 60000;

    const CSS = `
[data-composer-stat="byok-quota"]{position:relative;display:inline-flex}
.byok-q-pill{display:inline-flex;align-items:center;gap:4px;height:22px;padding:1px 8px;border-radius:8px;border:none;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:13px;cursor:pointer;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis}
.byok-q-pill:hover,.byok-q-pill[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.byok-q-pill[data-state="error"]{color:var(--dsw-alias-state-error-primary)}
.byok-q-num{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.byok-q-pop{position:absolute;left:0;bottom:calc(100% + 8px);z-index:50;width:340px;max-height:420px;overflow:auto;padding:16px 18px 14px;border-radius:14px;background:var(--dsw-menu-surface-fill,var(--dsw-specific-menu));box-shadow:var(--dsw-elevation-panel);color:var(--dsw-alias-label-primary);font-size:14px}
.byok-q-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:2px}
.byok-q-pop h4{margin:0;font-size:15px;font-weight:600}
.byok-q-muted{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:2px 0 0}
.byok-q-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;line-height:22px}
.byok-q-row span{font-weight:500}
.byok-q-row b{font-weight:400;color:var(--dsw-alias-label-tertiary);font-size:13px;font-variant-numeric:tabular-nums}
.byok-q-total{margin-top:12px}
.byok-q-total b{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500}
.byok-q-acc{margin-top:14px}
.byok-q-sub{display:flex;justify-content:space-between;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.byok-q-bar{height:6px;border-radius:3px;background:var(--byok-track,var(--dsw-alias-border-l2));overflow:hidden;margin:6px 0 4px}
.byok-q-bar i{display:block;height:100%;border-radius:3px;background:var(--byok-bar,#2c84db)}
.byok-q-bar.low i{background:var(--dsw-alias-state-error-primary)}
.byok-q-btn{height:26px;padding:0 10px;border-radius:8px;border:none;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px}
.byok-q-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}
.byok-q-btn:disabled{opacity:.5;cursor:default}
`;

    const fmt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
    const stateText = (s) => (s === 'invalid' ? '授权失效' : s === 'cooling' ? '冷却中' : s === 'error' ? '读取异常' : '已接入');
    const reset = (ms) => {
      if (!ms) return '上游未提供重置时间';
      const d = ms - Date.now();
      if (d <= 0) return '即将重置';
      const m = Math.round(d / 60000);
      return m >= 1440 ? `重置：${Math.floor(m / 1440)} 天后` : m >= 60 ? `重置：${Math.floor(m / 60)} 小时后` : `重置：${m} 分钟后`;
    };

    function summary(q) {
      if (!q) return { text: '读取中…', state: 'loading' };
      if (q.status === 'unsupported') return null;
      if (q.status === 'error') return { text: '额度读取失败', state: 'error' };
      const label = q.provider || '额度';
      if (typeof q.total === 'number') return { label, num: fmt(q.total), unit: q.unitLabel || '额度', state: q.status };
      const pct = q.accounts?.flatMap((a) => a.metrics).find((m) => m.unit === 'percent');
      if (pct) return { label, num: `${Math.round(pct.value)}%`, unit: pct.label || '剩余', state: q.status };
      return { label, num: '—', unit: '', state: q.status };
    }

    function Popover({ q, busy, onRefresh }) {
      const rows = [];
      rows.push(h('div', { key: 'h', className: 'byok-q-head' },
        h('h4', null, q.provider || '供应商额度'),
        h('button', { className: 'byok-q-btn', disabled: busy, onClick: onRefresh }, busy ? '刷新中…' : '刷新')));
      if (q.source) rows.push(h('p', { key: 's', className: 'byok-q-muted' }, q.source + (q.disabledCount ? ` · ${q.disabledCount} 个停用账号未计入` : '')));
      if (typeof q.total === 'number') {
        rows.push(h('div', { key: 't', className: 'byok-q-row byok-q-total' }, h('span', null, `账号池剩余${q.unitLabel || '额度'}${q.partial ? '（部分账号）' : ''}`), h('b', null, fmt(q.total))));
      }
      (q.accounts || []).forEach((a, i) => {
        const metrics = a.metrics || [];
        const single = metrics.length === 1 && metrics[0].unit !== 'percent' ? metrics[0] : null;
        const kids = [h('div', { key: 'n', className: 'byok-q-row' }, h('span', null, a.name),
          h('b', null, a.state !== 'ready' && a.state !== 'unknown' ? stateText(a.state) : single ? fmt(single.value) : ''))];
        if (a.error) kids.push(h('p', { key: 'e', className: 'byok-q-muted' }, a.error));
        else if (!metrics.length) kids.push(h('p', { key: 'x', className: 'byok-q-muted' }, '上游暂未提供额度数据'));
        if (!single) metrics.forEach((m, j) => {
          const pct = m.unit === 'percent';
          if (pct) {
            kids.push(h('div', { key: 'b' + j, className: 'byok-q-bar' + (m.value <= 20 ? ' low' : '') }, h('i', { style: { width: `${Math.max(0, Math.min(100, m.value))}%` } })));
            kids.push(h('div', { key: 'r' + j, className: 'byok-q-sub' }, h('span', null, `${m.label} · ${reset(m.resetAtMs)}`), h('span', null, `剩余 ${fmt(m.value)}%`)));
          } else {
            kids.push(h('div', { key: 'm' + j, className: 'byok-q-sub' }, h('span', null, m.label), h('span', null, fmt(m.value))));
          }
        });
        rows.push(h('div', { key: 'a' + i, className: 'byok-q-acc' }, kids));
      });
      if (!q.accounts?.length) rows.push(h('p', { key: 'empty', className: 'byok-q-muted' }, q.message || q.error || '此供应商尚无可展示的接入账号'));
      else if (q.error) rows.push(h('p', { key: 'err', className: 'byok-q-muted' }, q.error));
      return h('div', { className: 'byok-q-pop', role: 'dialog', 'aria-label': 'BYOK 额度' }, rows);
    }

    function QuotaPill({ directory, rpc }) {
      const sel = React.useSyncExternalStore((fn) => directory.subscribe(fn), () => directory.getSnapshot());
      const current = sel?.current;
      const modelId = current?.model ?? '';
      const providerId = current?.provider ?? '';
      const [quota, setQuota] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [open, setOpen] = React.useState(false);
      const root = React.useRef(null);
      const seq = React.useRef(0);

      const load = React.useCallback(async (force) => {
        if (!modelId) return;
        const mine = ++seq.current;
        setBusy(true);
        try {
          const res = await rpc({ modelId, providerId, refresh: force === true });
          if (mine === seq.current) setQuota(res.quota);
        } catch (error) {
          if (mine === seq.current) {
            setQuota((prev) => (prev ? { ...prev, status: 'stale', error: error.message } : { status: 'error', accounts: [], error: error.message }));
          }
        } finally {
          if (mine === seq.current) setBusy(false);
        }
      }, [modelId, providerId, rpc]);

      React.useEffect(() => {
        setQuota(null);
        load(false);
        const timer = setInterval(() => { if (document.visibilityState === 'visible') load(false); }, REFRESH_MS);
        return () => { seq.current++; clearInterval(timer); };
      }, [load]);

      React.useEffect(() => {
        if (!open) return undefined;
        const away = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
        const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', away, true);
        document.addEventListener('keydown', esc);
        return () => {
          document.removeEventListener('pointerdown', away, true);
          document.removeEventListener('keydown', esc);
        };
      }, [open]);

      const s = summary(quota);
      if (!modelId || s === null) return null;
      const label = s.text
        ? s.text
        : h(React.Fragment, null, s.label, ' · ', h('span', { className: 'byok-q-num' }, s.num), s.unit ? ' ' + s.unit : '');
      return h('span', { ref: root, 'data-composer-stat': 'byok-quota' },
        h('button', { type: 'button', className: 'byok-q-pill', 'data-state': s.state, 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: () => setOpen(!open) }, label),
        open && quota ? h(Popover, { q: quota, busy, onRefresh: () => load(true) }) : null);
    }

    return {
      inject: ['slots', 'connection', 'remote', 'remote.session', 'modelDirectories'],
      apply(ctx) {
        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-byok-dashboard';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => tag.remove();
        }, 'dsh-byok-dashboard: style');

        const rpc = async (payload) => {
          const raw = await ctx.connection.rpc.call('/api', 'byok-dashboard', { method: 'quota', payload });
          if (raw?.ok === true) return raw.value;
          throw new Error(raw?.error?.message || '额度读取失败');
        };

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'byok-quota',
          order: 2,
          inject: (sessionId) => ({ directory: ctx.modelDirectories.directoryFor(sessionId).store, rpc })
        }, QuotaPill));
      }
    };
  }
});
