/**
 * Simple in-memory cache for API responses
 * TTL-based cache that automatically expires entries
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map()

  /**
   * Get a value from cache
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    
    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      // Entry expired, remove it
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Set a value in cache with TTL (in milliseconds)
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    })
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate all entries matching a prefix
   */
  invalidatePrefix(prefix: string): void {
    const keys = Array.from(this.cache.keys())
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats for debugging
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

// Singleton instance
export const cache = new MemoryCache()

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  DASHBOARD: 2 * 60 * 1000,      // 2 minutes
  COUNTS: 5 * 60 * 1000,         // 5 minutes  
  REPORTS: 5 * 60 * 1000,        // 5 minutes
  SETTINGS: 10 * 60 * 1000,      // 10 minutes
} as const

// Cache keys
export const CACHE_KEYS = {
  DASHBOARD: 'dashboard',
  RECEIVABLES_SUMMARY: 'receivables_summary',
} as const
