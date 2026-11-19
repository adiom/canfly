export function requireE2eDatabaseUrl(env: Partial<NodeJS.ProcessEnv> = process.env): string {
  const value = env.CANFLY_E2E_DATABASE_URL
  if (!value) {
    throw new Error('Set CANFLY_E2E_DATABASE_URL explicitly to a disposable local database before running browser tests')
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Invalid CANFLY_E2E_DATABASE_URL')
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    Number(url.port) < 1 ||
    !url.username ||
    !/^\/canfly_e2e_[a-z0-9_]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new Error('CANFLY_E2E_DATABASE_URL must name a canfly_e2e_* PostgreSQL database on 127.0.0.1 with an explicit port and no URL options')
  }
  return url.href
}

export function e2eEnvironment(env: Partial<NodeJS.ProcessEnv>) {
  const databaseUrl = requireE2eDatabaseUrl(env)
  const port = Number(env.PORT ?? '3100')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Playwright PORT must be an integer from 1 to 65535')
  }

  const baseURL = `http://127.0.0.1:${port}`
  if (env.BASE_URL !== undefined && env.BASE_URL !== baseURL) {
    throw new Error('Playwright BASE_URL must match its own local web server')
  }

  return {
    baseURL,
    databaseUrl,
    webServer: {
      command: `pnpm ${env.CI ? 'start' : 'dev'} --hostname 127.0.0.1 --port ${port}`,
      env: {
        DATABASE_URL: databaseUrl,
        AUTH_URL: baseURL,
        NEXTAUTH_URL: baseURL,
      },
      reuseExistingServer: false,
      // Wait for our own process to bind the exact port. HTTP or TCP probes
      // alone could accept a different process that just bound the port.
      wait: { stdout: new RegExp(`^\\s*- Local:\\s+http://127\\.0\\.0\\.1:${port}\\s*$[\\s\\S]*?^\\s*✓ Ready in .+$`, 'm') },
      timeout: 120_000,
      stdout: 'ignore' as const,
      stderr: 'pipe' as const,
    },
  }
}
