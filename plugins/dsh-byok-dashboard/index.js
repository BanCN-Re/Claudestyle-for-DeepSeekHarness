/**
 * 宿主半边：把 IDE BYOK 的额度读取暴露成 `/api/byok-dashboard`。
 *
 * 浏览器端不能直接请求 IDE BYOK 的本机回环端口（跨源），所以由宿主进程读取
 * `<IDE BYOK 目录>/data/desktop-address.json` 并代为请求。只读：不签到、不换号、
 * 不改设置；`refresh` 仅触发 IDE BYOK 已有的额度刷新接口。
 */
import { ByokClient } from './lib/byok.mjs'
import { resolveSupplier } from './lib/routing.mjs'

export const name = 'dsh-byok-dashboard'

const PATH = '/api/byok-dashboard'
const ENDPOINT = 'byok-dashboard'

const reply = (rpcId, result) => Response.json({ type: 'server-response', rpcId, result })
const fail = (code, message) => ({ ok: false, error: { code, message, details: {} } })

export function apply(ctx, config = {}) {
  const home = config.byokHome || process.env.IDE_BYOK_HOME || 'D:/Work/IDE BYOK'
  const byok = new ByokClient({ home })

  ctx.inject(['connection'], (scope) => {
    const connection = scope.connection ?? scope.get?.('connection')
    if (typeof connection?.fetch?.register !== 'function') {
      scope.logger?.warn?.('[byok-dashboard] connection.fetch unavailable, endpoint not registered')
      return
    }
    connection.fetch.register({
      path: PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })
        let message
        try { message = await request.json() } catch { return new Response('body is not JSON', { status: 400 }) }
        const rpcId = typeof message?.rpcId === 'string' ? message.rpcId : 'invalid-request'
        const call = message?.payload
        if (message?.type !== 'client-request' || message.method !== ENDPOINT || typeof call?.method !== 'string') {
          return reply(rpcId, fail('gateway/bad-request', 'Invalid byok-dashboard request.'))
        }
        try {
          if (call.method !== 'quota') return reply(rpcId, fail('byok-dashboard/unknown-method', call.method))
          const { modelId = '', providerId = '', refresh = false } = call.payload ?? {}
          const supplier = resolveSupplier({ modelId: String(modelId), providerId: String(providerId) })
          const quota = await byok.quota(supplier, refresh === true)
          return reply(rpcId, { ok: true, value: { supplier, quota } })
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error)
          scope.logger?.warn?.(`[byok-dashboard] ${call.method} failed: ${text}`)
          return reply(rpcId, fail('byok-dashboard/handler-failed', text))
        }
      },
    })
  })
}
