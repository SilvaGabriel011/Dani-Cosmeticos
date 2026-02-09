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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useBackorders } from '@/hooks/use-backorders'
import { useProducts } from '@/hooks/use-products'

export default function EstoquePage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ProductTab>('todos')

  const { data: allProducts } = useProducts({ limit: 200 })
  const { data: noPriceProducts } = useProducts({ limit: 1, priceStatus: 'no-price' })
  const { data: zeradosProducts } = useProducts({ limit: 1, stockStatus: 'zeroed' })

  const faltantesCount = useMemo(() => {
    if (!allProducts?.data) return 0
    return allProducts.data.filter((p) => p.stock <= p.minStock).length
  }, [allProducts])

  const semValorCount = noPriceProducts?.pagination?.total ?? 0
  const zeradosCount = zeradosProducts?.pagination?.total ?? 0

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

      <TooltipProvider>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProductTab)}>
          <TabsList>
            <Tooltip>
              <TooltipTrigger asChild>
                <div><TabsTrigger value="todos">Todos</TabsTrigger></div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Exibe todos os produtos cadastrados no sistema</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                <TabsTrigger value="faltantes" className="gap-1.5">
                  Faltantes
                  {faltantesCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700 text-xs px-1.5 py-0">
                      {faltantesCount}
                    </Badge>
                  )}
                </TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Produtos com estoque atual abaixo ou igual ao estoque mínimo configurado</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                <TabsTrigger value="sem-valor" className="gap-1.5">
                  Sem Valor
                  {semValorCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0">
                      {semValorCount}
                    </Badge>
                  )}
                </TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Produtos que não possuem preço de venda cadastrado (R$ 0,00)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                <TabsTrigger value="encomendas" className="gap-1.5">
                  Encomendas
                  {encomendasCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5 py-0">
                      {encomendasCount}
                    </Badge>
                  )}
                </TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Produtos com pedidos pendentes (backorders) aguardando reposição de estoque</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                <TabsTrigger value="zerados" className="gap-1.5">
                  Itens Zerados
                  {zeradosCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-700 text-xs px-1.5 py-0">
                      {zeradosCount}
                    </Badge>
                  )}
                </TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Produtos com estoque zerado que já tiveram movimentação de vendas</p>
              </TooltipContent>
            </Tooltip>
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

          <TabsContent value="zerados">
            <Card>
              <CardContent className="p-6">
                <ProductList tab="zerados" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </TooltipProvider>

      <ProductForm open={isFormOpen} onOpenChange={setIsFormOpen} />
      <ProductCSVImport open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  )
}
