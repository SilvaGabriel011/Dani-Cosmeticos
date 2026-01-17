"use client"

import { useState } from "react"
import { Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { ProductList } from "@/components/products/product-list"
import { ProductForm } from "@/components/products/product-form"
import { ProductCSVImport } from "@/components/import/product-csv-import"

export default function EstoquePage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        description="Gerencie seus produtos e controle o estoque"
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Produto
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="p-6">
          <ProductList />
        </CardContent>
      </Card>

      <ProductForm open={isFormOpen} onOpenChange={setIsFormOpen} />
      <ProductCSVImport open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  )
}
