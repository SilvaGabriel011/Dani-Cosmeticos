'use client'

import { Plus, Upload } from 'lucide-react'
import { useState, useMemo } from 'react'

import { ProductCSVImport } from '@/components/import/product-csv-import'
import { PageHeader } from '@/components/layout/page-header'
import { ProductForm } from '@/components/products/product-form'
import { ProductList, type ProductTab } from '@/components/products/product-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBackorders } from '@/hooks/use-backorders'
import { useProducts } from '@/hooks/use-products'

export default function EstoquePage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ProductTab>('todos')

  const { data: allProducts } = useProducts({ limit: 200 })
  const { data: noPriceProducts } = useProducts({ limit: 1, priceStatus: 'no-price' })

  const faltantesCount = useMemo(() => {
    if (!allProducts?.data) return 0
    return allProducts.data.filter((p) => p.stock <= p.minStock).length
  }, [allProducts])

  const semValorCount = noPriceProducts?.pagination?.total ?? 0

  const { data: backordersData } = useBackorders()
  const encomendasCount = backordersData?.byProduct?.length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque" description="Gerencie seus produtos e controle o estoque">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-5 w-5" />
            Importar CSV
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-5 w-5" />
            Adicionar Produto
          </Button>
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProductTab)}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="faltantes" className="gap-1.5">
            Faltantes
            {faltantesCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700 text-xs px-1.5 py-0">
                {faltantesCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sem-valor" className="gap-1.5">
            Sem Valor
            {semValorCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0">
                {semValorCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="encomendas" className="gap-1.5">
            Encomendas
            {encomendasCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5 py-0">
                {encomendasCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos">
          <Card>
            <CardContent className="p-6">
              <ProductList tab="todos" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faltantes">
          <Card>
            <CardContent className="p-6">
              <ProductList tab="faltantes" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sem-valor">
          <Card>
            <CardContent className="p-6">
              <ProductList tab="sem-valor" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="encomendas">
          <Card>
            <CardContent className="p-6">
              <ProductList tab="encomendas" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProductForm open={isFormOpen} onOpenChange={setIsFormOpen} />
      <ProductCSVImport open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  )
}
