export function resolveSupplier(selection) {
  const id = String(selection?.modelId || '');
  const jet = id.match(/^jethub\/([^/]+)\/(.+)$/i);
  if (jet) return {kind:'jethub', provider:jet[1] === 'codebuddy' ? 'buddy' : jet[1], model:jet[2], key:`jethub:${jet[1]}`};
  const plugin = id.match(/^plugin:(.+):([^/]+)\/(.+)$/);
  if (plugin && ['codex','antigravity','grok','doubao'].includes(plugin[2])) return {kind:'plugin', pluginId:plugin[1], provider:plugin[2], model:plugin[3], key:`${plugin[1]}:${plugin[2]}`};
  if (plugin && /jethub/.test(plugin[1])) return {kind:'jethub',provider:plugin[2] === 'codebuddy' ? 'buddy' : plugin[2],model:plugin[3],key:`jethub:${plugin[2]}`};
  return {kind:'unknown', provider:selection?.providerId || '', model:id, key:`unknown:${selection?.providerId || ''}:${id}`};
}
export function projectPluginQuota(plugin, supplier) {
  if (!plugin || !plugin.providers?.some(p=>p.id===supplier.provider)) return [];
  return plugin.resources.flatMap(type=>type.resources.map(account=>({
    id:account.id,name:account.displayName,state:account.state?.status || 'unknown',
    metrics:(account.metrics ?? []).filter(metric=>Number.isFinite(metric.value)).filter(metric=>{
      if (supplier.provider !== 'antigravity') return true;
      if (/^gemini/i.test(supplier.model)) return metric.id !== 'claude';
      if (/^claude/i.test(supplier.model)) return metric.id !== 'gemini';
      return true;
    }).map(metric=>({id:metric.id,label:typeof metric.label==='string'?metric.label:metric.label?.['zh-CN']||metric.label?.['en-US']||metric.id,value:metric.value,unit:metric.unit,resetAtMs:metric.resetAtMs ?? null})),
  })));
}
