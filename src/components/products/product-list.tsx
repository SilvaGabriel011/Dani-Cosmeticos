"use client"

import { useState, useMemo, useCallback, memo } from "react"
import { Pencil, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { FilterBar, FilterConfig } from "@/components/ui/filter-bar"
import { useProducts, useDeleteProduct } from "@/hooks/use-products"
import { useCategories } from "@/hooks/use-categories"
import { useBrands } from "@/hooks/use-brands"
import { useFilters } from "@/hooks/use-filters"
import { ProductForm } from "./product-form"
import { Product } from "@/types"
import { formatCurrency, getStockStatus } from "@/lib/utils"

const stockStatusOptions = [
  { value: "all", label: "Todos" },
  { value: "baixo", label: "Estoque Baixo" },
  { value: "medio", label: "Estoque Médio" },
  { value: "bom", label: "Estoque Bom" },
]

export const ProductList = memo(function ProductList() {
  const { toast } = useToast()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const { filters, setFilter, resetFilters } = useFilters({
    initialValues: {
      search: "",
      categoryId: "",
      brandId: "",
      stockStatus: "all",
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
    { type: "search", name: "search", placeholder: "Buscar produto..." },
    { type: "select", name: "categoryId", label: "Categoria", options: categoryOptions },
    { type: "select", name: "brandId", label: "Marca", options: brandOptions },
    { type: "select", name: "stockStatus", label: "Estoque", options: stockStatusOptions },
  ]

    const { data, isLoading, error } = useProducts({
      search: filters.search || undefined,
      categoryId: filters.categoryId || undefined,
      brandId: filters.brandId || undefined,
    })

    const filteredProducts = useMemo(() => {
      if (!data?.data) return []
      let products = data.data

      if (filters.stockStatus === "baixo") {
        products = products.filter((p) => p.stock <= p.minStock)
      } else if (filters.stockStatus === "medio") {
        products = products.filter((p) => p.stock > p.minStock && p.stock <= p.minStock * 2)
      } else if (filters.stockStatus === "bom") {
        products = products.filter((p) => p.stock > p.minStock * 2)
      }

      return products
    }, [data, filters.stockStatus])

  const deleteProduct = useDeleteProduct()

  const handleDelete = async (product: Product) => {
    if (!confirm(`Excluir "${product.name}"?`)) return
    try {
      await deleteProduct.mutateAsync(product.id)
      toast({ title: "Produto excluído com sucesso!" })
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      })
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
        <div className="text-center py-8 text-destructive">
          Erro ao carregar produtos
        </div>
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
              <TableRow key={product.id}>
                <TableCell className="font-mono text-sm">
                  {product.code || "-"}
                </TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  {product.category?.name || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {product.brand?.name || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(product.costPrice))}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(product.salePrice))}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {stockStatus.status === "baixo" && (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={stockStatus.color}>
                      {product.stock}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={stockStatus.color}>
                    {stockStatus.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingProduct(product)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(product)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
    </div>
  )
})
