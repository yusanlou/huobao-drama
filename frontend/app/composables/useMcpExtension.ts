export function useMcpExtension() {
  const base = '/mcp-extension'
  async function request<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`${base}/control${path}`, {
      method, credentials: 'omit', headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12_000),
    })
    const value = await response.json()
    if (!response.ok) {
      const error = new Error(value.error?.message || 'MCP extension unavailable') as Error & { code?: string }
      error.code = value.error?.code
      throw error
    }
    return value
  }
  return { request }
}
