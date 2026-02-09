'use client'

import Fuse from 'fuse.js'
import { Search, Loader2, Package } from 'lucide-react'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { formatCurrency } from '@/lib/utils'
import { type Product } from '@/types'

interface ProductSelectorProps {
  products: Product[]
  isLoading?: boolean
  onSelect: (product: Product) => void
}

export function ProductSelector({ products, isLoading, onSelect }: ProductSelectorProps) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 150)
  const parentRef = useRef<HTMLDivElement>(null)

  // Sort: in-stock first, then out-of-stock
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (a.stock > 0 && b.stock <= 0) return -1
      if (a.stock <= 0 && b.stock > 0) return 1
      return 0
    })
  }, [products])

  const fuse = useMemo(() => {
    return new Fuse(sortedProducts, {
      keys: [
        { name: 'name', weight: 3 },
        { name: 'code', weight: 2 },
      ],
      threshold: 0.2,
      includeScore: true,
      minMatchCharLength: 2,
    })
  }, [sortedProducts])

  const filteredProducts = useMemo(() => {
    if (!debouncedSearch.trim()) return sortedProducts

    const search = debouncedSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const results = fuse.search(debouncedSearch, { limit: 100 })

    // Custom sorting by relevance
    return results.sort((a, b) => {
      const aName = a.item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const bName = b.item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const aCode = (a.item.code || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const bCode = (b.item.code || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      // 1. Exact match (name or code)
      const aExact = aName === search || aCode === search ? 1 : 0
      const bExact = bName === search || bCode === search ? 1 : 0
      if (aExact !== bExact) return bExact - aExact

      // 2. Starts with (name or code)
      const aStarts = aName.startsWith(search) || aCode.startsWith(search) ? 1 : 0
      const bStarts = bName.startsWith(search) || bCode.startsWith(search) ? 1 : 0
      if (aStarts !== bStarts) return bStarts - aStarts

      // 3. Contains in name
      const aContains = aName.includes(search) ? 1 : 0
      const bContains = bName.includes(search) ? 1 : 0
      if (aContains !== bContains) return bContains - aContains

      // 4. Fuse.js score (lower is better)
      return (a.score || 1) - (b.score || 1)
    }).map((r) => r.item)
  }, [fuse, debouncedSearch, sortedProducts])

  const virtualizer = useVirtualizer({
    count: filteredProducts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  })

  const handleSelect = useCallback((product: Product) => {
    onSelect(product)
    setSearch('')
  }, [onSelect])

  useEffect(() => {
    if (parentRef.current) {
      virtualizer.scrollToIndex(0)
    }
  }, [debouncedSearch, virtualizer])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          ref={parentRef}
          className="max-h-60 overflow-y-auto border rounded-md"
        >
          {filteredProducts.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {search ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
            </p>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const product = filteredProducts[virtualRow.index]
                return (
                  <button
                    key={product.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`px-3 py-2 text-left text-sm flex justify-between items-center transition-all duration-200 hover:pl-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset active:bg-primary/20 ${
                      product.stock <= 0
                        ? 'bg-amber-50/60 hover:bg-amber-100/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/40'
                        : 'hover:bg-primary/10'
                    }`}
                    onClick={() => handleSelect(product)}
                  >
                    <span className="flex items-center gap-1.5 truncate mr-2">
                      <span className="font-medium truncate">{product.name}</span>
                      {product.stock <= 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full shrink-0">
                          <Package className="h-2.5 w-2.5" />
                          Encomenda
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {product.stock > 0 && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          product.stock <= product.minStock
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                            : product.stock <= product.minStock * 2
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                        }`}>
                          {product.stock} un.
                        </span>
                      )}
                      <span className="text-muted-foreground font-semibold">
                        {formatCurrency(Number(product.salePrice))}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {filteredProducts.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
