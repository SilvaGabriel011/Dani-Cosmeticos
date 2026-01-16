"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { useCategories, useCreateCategory } from "@/hooks/use-categories"
import { useBrands, useCreateBrand } from "@/hooks/use-brands"
import { Plus, X } from "lucide-react"
import { useCreateProduct, useUpdateProduct } from "@/hooks/use-products"
import { createProductSchema, CreateProductInput } from "@/schemas/product"
import { Product } from "@/types"
import { formatCurrency } from "@/lib/utils"

interface ProductFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
}

export function ProductForm({ open, onOpenChange, product }: ProductFormProps) {
  const { toast } = useToast()
  const { data: categories } = useCategories()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const createCategory = useCreateCategory()
  const { data: brands } = useBrands()
  const createBrand = useCreateBrand()
  const isEditing = !!product
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isCreatingBrand, setIsCreatingBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState("")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: product
      ? {
          code: product.code || "",
          name: product.name,
          categoryId: product.categoryId,
          brandId: product.brandId,
          costPrice: Number(product.costPrice),
          profitMargin: Number(product.profitMargin),
          stock: product.stock,
          minStock: product.minStock,
        }
      : {
          code: "",
          name: "",
          categoryId: null,
          brandId: null,
          costPrice: 0,
          profitMargin: 100,
          stock: 0,
          minStock: 5,
        },
  })

  const costPrice = watch("costPrice")
  const profitMargin = watch("profitMargin")
  const salePrice = costPrice * (1 + profitMargin / 100)

  const onSubmit = async (data: CreateProductInput) => {
    try {
      if (isEditing && product) {
        await updateProduct.mutateAsync({ id: product.id, data })
        toast({ title: "Produto atualizado com sucesso!" })
      } else {
        await createProduct.mutateAsync(data)
        toast({ title: "Produto criado com sucesso!" })
      }
      reset()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                placeholder="Ex: SKU001"
                {...register("code")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Nome do produto"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            {isCreatingCategory ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da nova categoria"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!newCategoryName.trim() || createCategory.isPending}
                  onClick={async () => {
                    try {
                      const category = await createCategory.mutateAsync(newCategoryName.trim())
                      setValue("categoryId", category.id)
                      setNewCategoryName("")
                      setIsCreatingCategory(false)
                      toast({ title: "Categoria criada!" })
                    } catch (error: any) {
                      toast({
                        title: "Erro ao criar categoria",
                        description: error.message,
                        variant: "destructive",
                      })
                    }
                  }}
                >
                  {createCategory.isPending ? "..." : "Salvar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingCategory(false)
                    setNewCategoryName("")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={watch("categoryId") || ""}
                  onValueChange={(value) =>
                    setValue("categoryId", value || null)
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setIsCreatingCategory(true)}
                  title="Criar nova categoria"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">Marca</Label>
            {isCreatingBrand ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da nova marca"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!newBrandName.trim() || createBrand.isPending}
                  onClick={async () => {
                    try {
                      const brand = await createBrand.mutateAsync(newBrandName.trim())
                      setValue("brandId", brand.id)
                      setNewBrandName("")
                      setIsCreatingBrand(false)
                      toast({ title: "Marca criada!" })
                    } catch (error: any) {
                      toast({
                        title: "Erro ao criar marca",
                        description: error.message,
                        variant: "destructive",
                      })
                    }
                  }}
                >
                  {createBrand.isPending ? "..." : "Salvar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingBrand(false)
                    setNewBrandName("")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={watch("brandId") || ""}
                  onValueChange={(value) =>
                    setValue("brandId", value || null)
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands?.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setIsCreatingBrand(true)}
                  title="Criar nova marca"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costPrice">Valor Produto *</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                {...register("costPrice", { valueAsNumber: true })}
              />
              {errors.costPrice && (
                <p className="text-sm text-destructive">
                  {errors.costPrice.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profitMargin">Margem de Lucro (%)</Label>
              <Input
                id="profitMargin"
                type="number"
                step="0.1"
                min="0"
                {...register("profitMargin", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="rounded-md bg-muted p-3">
            <p className="text-sm text-muted-foreground">
              Preço de Venda Calculado:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(salePrice || 0)}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock">Estoque Atual</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                {...register("stock", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStock">Estoque Mínimo</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                {...register("minStock", { valueAsNumber: true })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : isEditing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
