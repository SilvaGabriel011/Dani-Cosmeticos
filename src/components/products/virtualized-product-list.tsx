'use client'

import { Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { useState, useMemo, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterBar, type FilterConfig } from '@/components/ui/filter-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useBrands } from '@/hooks/use-brands'
import { useCategories } from '@/hooks/use-categories'
import { useFilters } from '@/hooks/use-filters'
import { useProducts, useDeleteProduct } from '@/hooks/use-products'
import { formatCurrency, getStockStatus } from '@/lib/utils'
import { type Product } from '@/types'

import { ProductForm } from './product-form'

const stockStatusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'baixo', label: 'Estoque Baixo' },
  { value: 'medio', label: 'Estoque Médio' },
  { value: 'bom', label: 'Estoque Bom' },
]

export function VirtualizedProductList() {
  const { toast } = useToast()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

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
    limit: 200,
  })

  const filteredProducts = useMemo(() => {
    if (!data?.data) return []
    let products = data.data

    if (filters.stockStatus === 'baixo') {
      products = products.filter((p) => p.stock <= p.minStock)
    } else if (filters.stockStatus === 'medio') {
      products = products.filter((p) => p.stock > p.minStock && p.stock <= p.minStock * 2)
    } else if (filters.stockStatus === 'bom') {
      products = products.filter((p) => p.stock > p.minStock * 2)
    }

    return products
  }, [data, filters.stockStatus])

  const virtualizer = useVirtualizer({
    count: filteredProducts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  })

  const deleteProduct = useDeleteProduct()

  const handleDelete = useCallback(async () => {
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
  }, [deleteProduct, toast, deletingProduct])

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
        <div className="text-center py-8 text-muted-foreground">
          Nenhum produto encontrado para os filtros selecionados
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filtersBar}
      
      <div className="text-sm text-muted-foreground">
        {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
      </div>

      <div className="border rounded-md">
        <div className="grid grid-cols-[80px_1fr_120px_120px_80px_80px_100px_80px] gap-2 p-3 bg-muted/50 font-medium text-sm border-b">
          <div>Código</div>
          <div>Nome</div>
          <div>Categoria</div>
          <div>Marca</div>
          <div className="text-right">Custo</div>
          <div className="text-right">Venda</div>
          <div className="text-center">Estoque</div>
          <div className="text-right">Ações</div>
        </div>

        <div
          ref={parentRef}
          className="h-[500px] overflow-auto"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const product = filteredProducts[virtualRow.index]
              const stockStatus = getStockStatus(product.stock, product.minStock)
              
              return (
                <div
                  key={product.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="grid grid-cols-[80px_1fr_120px_120px_80px_80px_100px_80px] gap-2 p-3 items-center text-sm border-b hover:bg-muted/30 transition-colors"
                >
                  <div className="font-mono text-sm truncate">{product.code || '-'}</div>
                  <div className="font-medium truncate">{product.name}</div>
                  <div className="truncate text-muted-foreground">
                    {product.category?.name || '-'}
                  </div>
                  <div className="truncate text-muted-foreground">
                    {product.brand?.name || '-'}
                  </div>
                  <div className="text-right">
                    {formatCurrency(Number(product.costPrice))}
                  </div>
                  <div className="text-right font-medium">
                    {formatCurrency(Number(product.salePrice))}
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {stockStatus.status === 'baixo' && (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                    <Badge variant={stockStatus.color} className="text-sm">
                      {product.stock}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingProduct(product)}
                    >
                      <Pencil className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDeletingProduct(product)}
                    >
                      <Trash2 className="h-5 w-5 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

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
}
