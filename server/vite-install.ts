import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Plugin } from 'vite-plus'

/** Install metadata is project-specific even before the browser runs the client. */
export function installMetadata(ultimateRoot: string, projectRoot: string): Plugin {
  const project = basename(projectRoot)
  return {
    name: 'ultimate:install',
    transformIndexHtml() {
      // Vite escapes descriptor attributes when serializing the tag.
      return [{ tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: project } }]
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (
          request.url?.split('?')[0] !== '/manifest.webmanifest' ||
          (request.method !== 'GET' && request.method !== 'HEAD')
        ) {
          next()
          return
        }
        // Read the existing template each time so icon/theme edits still apply without a core restart.
        try {
          const source = await readFile(
            join(ultimateRoot, 'web/public/manifest.webmanifest'),
            'utf8',
          )
          const body = JSON.stringify({
            ...JSON.parse(source),
            name: `${project} · Ultimate`,
            short_name: project,
          })
          const etag = `"${createHash('sha256').update(body).digest('hex')}"`
          response.setHeader('Content-Type', 'application/manifest+json')
          response.setHeader('Cache-Control', 'no-cache')
          response.setHeader('ETag', etag)
          if (request.headers['if-none-match'] === etag) {
            response.statusCode = 304
            response.end()
          } else {
            response.end(body)
          }
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
