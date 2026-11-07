import { constants } from 'node:fs'
import { access, readdir, stat } from 'node:fs/promises'
import { afterEach, expect, it, vi } from 'vitest'
import { browserBinary } from '../extensions/browser/server.ts'

vi.mock('node:os', () => ({ homedir: () => '/home/test', platform: () => 'darwin' }))
vi.mock('node:fs/promises', async (original) => ({
  ...(await original<typeof import('node:fs/promises')>()),
  access: vi.fn<typeof access>(),
  readdir: vi.fn<typeof readdir>(),
  stat: vi.fn<typeof stat>(),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

it('discovers macOS Chromium without an override or Linux paths', async () => {
  vi.stubEnv('ULTIMATE_CHROMIUM', '')
  vi.mocked(readdir).mockResolvedValue(['chromium-1243'] as never)
  vi.mocked(access).mockResolvedValue(undefined)
  const cache = '/home/test/Library/Caches/ms-playwright'
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const paths = [
    chrome,
    ...['chrome-mac-arm64', 'chrome-mac-x64', 'chrome-mac'].map(
      (directory) =>
        `${cache}/chromium-1243/${directory}/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
    ),
  ]
  for (const installed of paths) {
    vi.mocked(stat).mockImplementation(async (path) => {
      if (path !== installed) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      return { isFile: () => true } as Awaited<ReturnType<typeof stat>>
    })
    expect(await browserBinary()).toBe(installed)
    expect(access).toHaveBeenLastCalledWith(installed, constants.X_OK)
  }
  expect(readdir).toHaveBeenCalledWith(cache)
  expect(vi.mocked(stat).mock.calls.every(([path]) => paths.includes(String(path)))).toBe(true)
})
