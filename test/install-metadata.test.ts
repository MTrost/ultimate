import { cp, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { fixture } from './server-fixture.ts'

it('serves project install names before client boot and revalidates the manifest', async () => {
  const { server, options } = await fixture()
  const template = JSON.parse(await readFile('web/public/manifest.webmanifest', 'utf8'))
  await mkdir(join(options.ultimateRoot, 'web/public'))
  await cp(
    'web/public/manifest.webmanifest',
    join(options.ultimateRoot, 'web/public/manifest.webmanifest'),
  )

  const response = await fetch(server.url + '/manifest.webmanifest')
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('application/manifest+json')
  expect(response.headers.get('cache-control')).toBe('no-cache')
  expect(await response.json()).toEqual({
    ...template,
    name: 'repo · Ultimate',
    short_name: 'repo',
  })
  const cached = await fetch(server.url + '/manifest.webmanifest', {
    headers: { 'if-none-match': response.headers.get('etag')! },
  })
  expect(cached.status).toBe(304)
  expect(cached.headers.get('cache-control')).toBe('no-cache')
  const html = await (await fetch(server.url)).text()
  expect(html.match(/<meta name="apple-mobile-web-app-title" content="repo">/g)).toHaveLength(1)
})
