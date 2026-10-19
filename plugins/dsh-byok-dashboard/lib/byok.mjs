import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectPluginQuota } from './routing.mjs';
export class ByokClient {
  constructor({home=process.env.IDE_BYOK_HOME || 'D:/Work/IDE BYOK',fetchImpl=fetch}={}) { this.home=home;this.fetch=fetchImpl;this.cache=new Map();this.pending=new Map(); }
  async request(path,options={}) {
    const info=JSON.parse(await readFile(join(this.home,'data/desktop-address.json'),'utf8'));
    const base=new URL(`http://${info.address}`);
    if(base.hostname!=='127.0.0.1'||!base.port||base.username||base.password||base.pathname!=='/')throw new Error('IDE BYOK 地址须为本机回环地址');
    const response=await this.fetch(new URL(`/__byok-api__/api/${path}`,base),{...options,redirect:'error',signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw new Error(`IDE BYOK HTTP ${response.status}`);
    return response.status===204?null:response.json();
  }
  async rpc(method,payload) {
    const result=await this.request('jethub/api/jet-hub',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:'jet-hub',payload:{method,payload}})});
    if(!result?.result?.ok)throw new Error(result?.result?.error?.message || 'JetHub 额度读取失败');
    return result.result.value;
  }
  async quota(supplier,force=false) {
    if(supplier.kind==='unknown')return {status:'unsupported',provider:supplier.provider,accounts:[],message:'此模型供应商尚未接入 IDE BYOK 额度。'};
    const key=supplier.key+(supplier.provider==='antigravity'?`:${/^gemini/i.test(supplier.model)?'gemini':/^claude/i.test(supplier.model)?'claude':'all'}`:'');
    const saved=this.cache.get(key);
    if(!force&&saved&&Date.now()-saved.updatedAt<60000)return {...saved,cached:true};
    if(this.pending.has(key))return this.pending.get(key);
    const task=(async()=>{
      try {
        let result;
        if(supplier.kind==='jethub') {
          const [badge,providers]=await Promise.all([this.rpc('usage.badge',{provider:supplier.provider,force}),this.request('jethub/providers')]);
          const accounts=(badge.accounts??[]).map(a=>{
            const units=[...new Set((a.balance?.packages??[]).filter(p=>p.active!==false).map(p=>p.unit).filter(Boolean))];
            const unit=units.length===1?(/token/i.test(units[0])?'Token':/credit|point|积分/i.test(units[0])?'积分':units[0]):'额度';
            return {id:a.accountId,name:a.nickname,state:a.error?'error':'ready',error:a.error,unitLabel:unit,
              metrics:typeof a.balance?.total==='number'?[{id:'balance',label:`剩余${unit}`,unit:'count',value:a.balance.total}]:[]};
          });
          const known=accounts.filter(a=>a.metrics.length);
          result={provider:providers.find(p=>p.id===supplier.provider)?.displayName || supplier.provider,accounts,
            total:known.length?known.reduce((n,a)=>n+a.metrics[0].value,0):null,unitLabel:known[0]?.unitLabel||'额度',
            partial:known.length!==accounts.length,disabledCount:badge.disabledCount??0,source:'IDE BYOK · JetHub 账号池',upstreamAt:badge.generatedAt};
        } else {
          let plugins=await this.request('plugins');
          let plugin=plugins.find(p=>p.id===supplier.pluginId);
          if(force&&plugin) {
            const outcomes=await Promise.allSettled(plugin.resources.flatMap(t=>t.canRefresh?t.resources.map(a=>this.request(`plugins/${encodeURIComponent(plugin.id)}/resources/${encodeURIComponent(t.type)}/${encodeURIComponent(a.id)}/refresh`,{method:'POST'})):[]));
            if(outcomes.some(o=>o.status==='rejected'))throw new Error('部分账号刷新失败，保留上次成功快照');
            plugins=await this.request('plugins');plugin=plugins.find(p=>p.id===supplier.pluginId);
          }
          result={provider:supplier.provider==='codex'?'ChatGPT / Codex':supplier.provider==='antigravity'?'Google / Antigravity':supplier.provider,accounts:projectPluginQuota(plugin,supplier),source:'IDE BYOK · 接入账号'};
        }
        const value={...result,status:'ready',updatedAt:Date.now(),cached:false};this.cache.set(key,value);return value;
      } catch(error) {return saved?{...saved,status:'stale',error:error.message,cached:true}:{status:'error',provider:supplier.provider,accounts:[],error:`额度读取失败：${error.message}`};}
    })().finally(()=>this.pending.delete(key));this.pending.set(key,task);return task;
  }
}
