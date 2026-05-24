export function backendHttpUrl(host: string, port: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `http://${host}:${port}${normalized}`
}
