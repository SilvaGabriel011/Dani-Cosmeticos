"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/page-header"
import { ProductList } from "@/components/products/product-list"
import { ProductForm } from "@/components/products/product-form"

export default function EstoquePage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [search, setSearch] = useState("")

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
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ProductList search={search} />
        </CardContent>
      </Card>

      <ProductForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  )
}
