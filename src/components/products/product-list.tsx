'use client'

import { Pencil, Trash2, AlertTriangle, Package } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'

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
]

export type ProductTab = 'todos' | 'faltantes' | 'sem-valor'

interface ProductListProps {
  tab?: ProductTab
}

export const ProductList = memo(function ProductList({ tab = 'todos' }: ProductListProps) {
  const { toast } = useToast()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

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
    ...(tab === 'sem-valor' && { priceStatus: 'no-price' as const }),
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
    }

    // Sort: products with pending backorders first
    return [...products].sort((a, b) => {
      const aBackorder = backordersByProduct.has(a.id) ? 1 : 0
      const bBackorder = backordersByProduct.has(b.id) ? 1 : 0
      return bBackorder - aBackorder
    })
  }, [data, filters.stockStatus, backordersByProduct, tab])

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
        <div className="text-center py-8 text-muted-foreground">
          Nenhum produto encontrado para os filtros selecionados
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filtersBar}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
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
          {filteredProducts.map((product) => {
            const stockStatus = getStockStatus(product.stock, product.minStock)
            return (
              <TableRow key={product.id} className={backordersByProduct.has(product.id) ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                <TableCell className="font-mono text-sm">{product.code || '-'}</TableCell>
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
                <TableCell className="text-right font-medium">
                  {Number(product.salePrice) === 0 ? (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                      Sem preço
                    </Badge>
                  ) : (
                    formatCurrency(Number(product.salePrice))
                  )}
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
