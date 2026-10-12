export function isCircuitEditorUrl(url: URL): boolean {
  return url.protocol === 'https:'
    && url.hostname === 'www.tinkercad.com'
    && /^\/things\/[^/]+\/editel\/?$/.test(url.pathname);
}
