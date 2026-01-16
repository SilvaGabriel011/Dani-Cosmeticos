"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { ProductList } from "@/components/products/product-list"
import { ProductForm } from "@/components/products/product-form"

export default function EstoquePage() {
  const [isFormOpen, setIsFormOpen] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        description="Gerencie seus produtos e controle o estoque"
      >
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Produto
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-6">
          <ProductList />
        </CardContent>
      </Card>

      <ProductForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  )
}
