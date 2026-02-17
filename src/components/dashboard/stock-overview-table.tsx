'use client'

import { AlertTriangle, Package, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useBackorders } from '@/hooks/use-backorders'
import { useProducts } from '@/hooks/use-products'
import { getStockStatus } from '@/lib/utils'

export function StockOverviewTable() {
  const { data: productsData, isLoading: loadingProducts } = useProducts({ limit: 2000 })
  const { data: backordersData, isLoading: loadingBackorders } = useBackorders()

  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const backordersByProduct = useMemo(() => {
    const map = new Map<string, number>()
    if (backordersData?.byProduct) {
      for (const bp of backordersData.byProduct) {
        map.set(bp.productId, bp.totalPending)
      }
    }
    return map
  }, [backordersData])

  const sortedProducts = useMemo(() => {
    if (!productsData?.data) return []

    let products = productsData.data

    // Filter by search
    if (search) {
      const q = search.toLowerCase()
      products = products.filter((p) => p.name.toLowerCase().includes(q))
    }

    // Sort: backorders first, then low stock, then rest
    return [...products].sort((a, b) => {
      const aBackorder = backordersByProduct.get(a.id) || 0
      const bBackorder = backordersByProduct.get(b.id) || 0

      // Backorders first
      if (aBackorder > 0 && bBackorder === 0) return -1
      if (aBackorder === 0 && bBackorder > 0) return 1
      if (aBackorder > 0 && bBackorder > 0) return bBackorder - aBackorder

      // Then low stock
      const aLow = a.stock <= a.minStock
      const bLow = b.stock <= b.minStock
      if (aLow && !bLow) return -1
      if (!aLow && bLow) return 1

      // Then by stock ascending
      return a.stock - b.stock
    })
  }, [productsData, search, backordersByProduct])

  // Pagination
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage)
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return sortedProducts.slice(start, start + itemsPerPage)
  }, [sortedProducts, currentPage, itemsPerPage])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const isLoading = loadingProducts || loadingBackorders

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            Estoque de Itens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px]" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-6 w-6" />
          Estoque de Itens
          {backordersData && backordersData.totalPendingItems > 0 && (
            <Badge variant="destructive" className="ml-2">
              {backordersData.totalPendingQuantity} enc. pendentes
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-center">Estoque</TableHead>
                <TableHead className="text-center">Mín.</TableHead>
                <TableHead className="text-center">Encomendas</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {sortedProducts.length === 0
                      ? 'Nenhum produto cadastrado.'
                      : 'Nenhum produto encontrado.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => {
                  const backorderCount = backordersByProduct.get(product.id) || 0
                  const stockStatus = getStockStatus(product.stock, product.minStock)
                  const needsBuy = backorderCount > 0
                  const isLow = product.stock <= product.minStock

                  return (
                    <TableRow
                      key={product.id}
                      className={
                        needsBuy
                          ? 'bg-amber-50/60 dark:bg-amber-950/20'
                          : isLow
                            ? 'bg-red-50/40 dark:bg-red-950/10'
                            : ''
                      }
                    >
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isLow && <AlertTriangle className="h-4 w-4 text-red-500" />}
                          <Badge variant={stockStatus.color}>{product.stock}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {product.minStock}
                      </TableCell>
                      <TableCell className="text-center">
                        {backorderCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
                            <Package className="h-3.5 w-3.5" />
                            {backorderCount} enc.
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {needsBuy ? (
                          <Badge variant="destructive">COMPRAR</Badge>
                        ) : (
                          <Badge variant={stockStatus.color}>{stockStatus.label}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {(currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, sortedProducts.length)} de{' '}
              {sortedProducts.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-sm font-medium px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
