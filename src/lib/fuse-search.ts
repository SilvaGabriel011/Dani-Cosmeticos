import Fuse, { type IFuseOptions } from 'fuse.js'

export function createFuseSearch<T>(
  items: T[],
  keys: string[],
  options?: IFuseOptions<T>
) {
  return new Fuse(items, {
    keys,
    threshold: 0.3,
    includeScore: true,
    minMatchCharLength: 2,
    ...options,
  })
}

export function fuseSearch<T>(
  fuse: Fuse<T>,
  query: string,
  limit = 50
): T[] {
  if (!query.trim()) return []
  
  const results = fuse.search(query, { limit })
  return results.map((r) => r.item)
}
