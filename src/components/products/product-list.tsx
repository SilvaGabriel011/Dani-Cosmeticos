'use client'

import { Pencil, Trash2, AlertTriangle, Package, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useState, useMemo, useCallback, useEffect, memo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterBar, type FilterConfig } from '@/components/ui/filter-bar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { useBrands } from '@/hooks/use-brands'
import { useCategories } from '@/hooks/use-categories'
import { useFilters } from '@/hooks/use-filters'
import { useBackorders } from '@/hooks/use-backorders'
import { useProducts, useDeleteProduct } from '@/hooks/use-products'
import { formatCurrency, getStockStatus } from '@/lib/utils'
import { type Product } from '@/types'

import { ProductForm } from './product-form'


const stockStatusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'baixo', label: 'Estoque Baixo' },
  { value: 'medio', label: 'Estoque Médio' },
  { value: 'bom', label: 'Estoque Bom' },
  { value: 'encomenda', label: 'Encomenda' },
]

export type ProductTab = 'todos' | 'faltantes' | 'sem-valor' | 'encomendas' | 'zerados'

interface ProductListProps {
  tab?: ProductTab
}

const ITEMS_PER_PAGE = 20

export const ProductList = memo(function ProductList({ tab = 'todos' }: ProductListProps) {
  const { toast } = useToast()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const { filters, setFilter, resetFilters } = useFilters({
    initialValues: {
      search: '',
      categoryId: '',
      brandId: '',
      stockStatus: 'all',
    },
  })

  const { data: categoriesData } = useCategories()
  const { data: brandsData } = useBrands()

  const categoryOptions = useMemo(
    () => categoriesData?.map((c) => ({ value: c.id, label: c.name })) || [],
    [categoriesData]
  )

  const brandOptions = useMemo(
    () => brandsData?.map((b) => ({ value: b.id, label: b.name })) || [],
    [brandsData]
  )

  const filterConfigs: FilterConfig[] = [
    { type: 'search', name: 'search', placeholder: 'Buscar produto...' },
    { type: 'select', name: 'categoryId', label: 'Categoria', options: categoryOptions },
    { type: 'select', name: 'brandId', label: 'Marca', options: brandOptions },
    { type: 'select', name: 'stockStatus', label: 'Estoque', options: stockStatusOptions },
  ]

  const { data, isLoading, error } = useProducts({
    search: filters.search || undefined,
    categoryId: filters.categoryId || undefined,
    brandId: filters.brandId || undefined,
    limit: 500,
    ...(tab === 'sem-valor' && { priceStatus: 'no-price' as const }),
    ...(tab === 'zerados' && { stockStatus: 'zeroed' as const }),
  })

  const { data: backordersData } = useBackorders()
  const backordersByProduct = useMemo(() => {
    const map = new Map<string, number>()
    if (backordersData?.byProduct) {
      for (const bp of backordersData.byProduct) {
        map.set(bp.productId, bp.totalPending)
      }
    }
    return map
  }, [backordersData])

  const filteredProducts = useMemo(() => {
    // Para tab encomendas, se não há produtos carregados mas há backorders,
    // criar lista a partir dos dados de backorder
    if (tab === 'encomendas' && backordersData?.byProduct) {
      // Mapear backorders para formato Product (simplificado)
      const backorderProducts = backordersData.byProduct.map((bp) => ({
        id: bp.productId,
        name: bp.productName,
        code: bp.productCode,
        stock: bp.currentStock,
        minStock: 0,
        salePrice: 0,
        costPrice: 0,
        profitMargin: 0,
        isActive: true,
        fragrancia: null,
        linha: null,
        packagingType: null,
        brand: bp.brandName ? { id: '', name: bp.brandName, createdAt: new Date(), defaultProfitMargin: 0 } : null,
        category: bp.categoryName ? { id: '', name: bp.categoryName, createdAt: new Date() } : null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        categoryId: null,
        brandId: null,
      }))
      
      // Aplicar filtros adicionais se houver
      let filtered = backorderProducts
      if (filters.search) {
        const search = filters.search.toLowerCase()
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(search) ||
            p.code?.toLowerCase().includes(search) ||
            p.brand?.name.toLowerCase().includes(search)
        )
      }
      return filtered as unknown as Product[]
    }

    if (!data?.data) return []
    let products = data.data

    if (tab === 'faltantes') {
      products = products.filter((p) => p.stock <= p.minStock)
    }

    if (filters.stockStatus === 'baixo') {
      products = products.filter((p) => p.stock <= p.minStock)
    } else if (filters.stockStatus === 'medio') {
      products = products.filter((p) => p.stock > p.minStock && p.stock <= p.minStock * 2)
    } else if (filters.stockStatus === 'bom') {
      products = products.filter((p) => p.stock > p.minStock * 2)
    } else if (filters.stockStatus === 'encomenda') {
      products = products.filter((p) => backordersByProduct.has(p.id))
    }

    // Sort: products with pending backorders first
    return [...products].sort((a, b) => {
      const aBackorder = backordersByProduct.has(a.id) ? 1 : 0
      const bBackorder = backordersByProduct.has(b.id) ? 1 : 0
      return bBackorder - aBackorder
    })
  }, [data, filters.stockStatus, filters.search, backordersByProduct, backordersData?.byProduct, tab])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE))
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredProducts, currentPage]
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [filters.search, filters.categoryId, filters.brandId, filters.stockStatus, tab])

  const deleteProduct = useDeleteProduct()

  const handleDelete = async () => {
    if (!deletingProduct) return
    try {
      await deleteProduct.mutateAsync(deletingProduct.id)
      toast({ title: 'Produto excluído com sucesso!' })
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setDeletingProduct(null)
    }
  }

  const handleFilterChange = useCallback(
    (name: string, value: string) => {
      setFilter(name as keyof typeof filters, value)
    },
    [setFilter]
  )

  const filtersBar = (
    <FilterBar
      filters={filterConfigs}
      values={filters}
      onChange={handleFilterChange}
      onReset={resetFilters}
    />
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {filtersBar}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        {filtersBar}
        <div className="text-center py-8 text-destructive">Erro ao carregar produtos</div>
      </div>
    )
  }

  if (!filteredProducts.length) {
    return (
      <div className="space-y-4">
        {filtersBar}
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-base font-medium">Nenhum produto encontrado</p>
          <p className="text-sm opacity-70 mt-1">Tente ajustar os filtros ou cadastre um novo produto</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filtersBar}
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {paginatedProducts.map((product) => {
          const stockStatus = getStockStatus(product.stock, product.minStock)
          return (
            <div key={`mobile-${product.id}`} className={`border rounded-xl p-3.5 bg-card ${backordersByProduct.has(product.id) ? 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm leading-tight truncate">{product.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {product.category?.name && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{product.category.name}</span>}
                    {product.brand?.name && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{product.brand.name}</span>}
                  </div>
                </div>
                <Badge variant={stockStatus.color} className="shrink-0">
                  {stockStatus.label} ({product.stock})
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Custo</p>
                    <p className="text-sm font-medium">{formatCurrency(Number(product.costPrice))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Venda</p>
                    <p className="text-sm font-bold text-primary">
                      {Number(product.salePrice) === 0 ? (
                        <span className="text-yellow-600">Sem preco</span>
                      ) : (
                        formatCurrency(Number(product.salePrice))
                      )}
                    </p>
                  </div>
                  {backordersByProduct.has(product.id) && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full">
                      <Package className="h-2.5 w-2.5" />
                      {backordersByProduct.get(product.id)} encomendas
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditingProduct(product)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setDeletingProduct(product)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop Table View */}
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead className="text-right">Custo</TableHead>
            <TableHead className="text-right">Venda</TableHead>
            <TableHead className="text-center">Estoque</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedProducts.map((product) => {
            const stockStatus = getStockStatus(product.stock, product.minStock)
            return (
              <TableRow key={product.id} className={backordersByProduct.has(product.id) ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  {product.category?.name || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>
                  {product.brand?.name || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(product.costPrice))}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex justify-end">
                    {Number(product.salePrice) === 0 ? (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                        Sem preço
                      </Badge>
                    ) : (
                      formatCurrency(Number(product.salePrice))
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {stockStatus.status === 'baixo' && (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                    <Badge variant={stockStatus.color}>{product.stock}</Badge>
                    {backordersByProduct.has(product.id) && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full">
                        <Package className="h-2.5 w-2.5" />
                        {backordersByProduct.get(product.id)} enc.
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={stockStatus.color}>{stockStatus.label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditingProduct(product)}>
                      <Pencil className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingProduct(product)}>
                      <Trash2 className="h-5 w-5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">
            {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} &middot; Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ProductForm
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
        product={editingProduct}
      />

      <ConfirmDialog
        open={!!deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir "${deletingProduct?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  )
})
