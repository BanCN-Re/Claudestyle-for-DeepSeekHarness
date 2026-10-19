/**
 * 宿主半边：只负责把 fonts/ 下的字体文件以 GET /api/claude-fonts?f=<名字> 提供给浏览器端。
 * 只认白名单里的三个文件名，不接受任意路径。
 */
import { readFile } from 'node:fs/promises'

export const name = 'dsh-claude-theme'

const FONTS = {
  sans: 'AnthropicSansWebText.ttf',
  serif: 'AnthropicSerifWebText.ttf',
  mono: 'AnthropicMonoVariable.ttf',
}

export function apply(ctx) {
  ctx.inject(['connection'], (scope) => {
    const connection = scope.connection ?? scope.get?.('connection')
    if (typeof connection?.fetch?.register !== 'function') return
    connection.fetch.register({
      path: '/api/claude-fonts',
      methods: ['GET'],
      requestBody: 'buffered',
      async fetch(request) {
        const key = new URL(request.url).searchParams.get('f')
        const file = FONTS[key]
        if (!file) return new Response('unknown font', { status: 404 })
        try {
          const bytes = await readFile(new URL(`./fonts/${file}`, import.meta.url))
          return new Response(bytes, { headers: { 'content-type': 'font/ttf', 'cache-control': 'public, max-age=31536000, immutable' } })
        } catch {
          return new Response('font missing', { status: 404 })
        }
      },
    })
  })
}
