'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X, RefreshCw, Loader2, Package } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useBrands, useCreateBrand } from '@/hooks/use-brands'
import { useCategories, useCreateCategory } from '@/hooks/use-categories'
import { useCreateProduct, useUpdateProduct, useProducts } from '@/hooks/use-products'
import { generateProductCode } from '@/lib/code-generator'
import { formatCurrency, calculateProfitMargin, calculateProfit } from '@/lib/utils'
import { createProductSchema, type CreateProductInput } from '@/schemas/product'
import { type Product } from '@/types'

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
  const { data: productsData } = useProducts({ limit: 1000 })
  const createCategory = useCreateCategory()
  const { data: brands } = useBrands()
  const createBrand = useCreateBrand()
  const isEditing = !!product
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isCreatingBrand, setIsCreatingBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [pricingMode, setPricingMode] = useState<'margin' | 'salePrice'>('margin')
  const [inputSalePrice, setInputSalePrice] = useState(0)

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
          code: product.code || '',
          name: product.name,
          categoryId: product.categoryId,
          brandId: product.brandId,
          costPrice: Number(product.costPrice),
          profitMargin: Number(product.profitMargin),
          stock: product.stock,
          minStock: product.minStock,
        }
      : {
          code: '',
          name: '',
          categoryId: null,
          brandId: null,
          costPrice: 0,
          profitMargin: 100,
          stock: 0,
          minStock: 5,
        },
  })

  const costPrice = watch('costPrice')
  const profitMargin = watch('profitMargin')

  const calculatedSalePrice =
    pricingMode === 'margin' ? costPrice * (1 + profitMargin / 100) : inputSalePrice

  const calculatedMargin =
    pricingMode === 'salePrice' ? calculateProfitMargin(costPrice, inputSalePrice) : profitMargin

  const profit = calculateProfit(costPrice, calculatedSalePrice)

  const handleGenerateCode = () => {
    const name = watch('name')
    if (!name) {
      toast({ title: 'Digite o nome do produto primeiro', variant: 'destructive' })
      return
    }
    const existingCodes =
      productsData?.data?.map((p) => p.code).filter((c): c is string => !!c) || []
    const code = generateProductCode(name, existingCodes)
    setValue('code', code)
    toast({ title: 'Codigo gerado!', description: code })
  }

  useEffect(() => {
    if (product) {
      reset({
        code: product.code || '',
        name: product.name,
        categoryId: product.categoryId,
        brandId: product.brandId,
        costPrice: Number(product.costPrice),
        profitMargin: Number(product.profitMargin),
        stock: product.stock,
        minStock: product.minStock,
      })
      setInputSalePrice(Number(product.salePrice))
      setPricingMode('margin')
    } else {
      reset({
        code: '',
        name: '',
        categoryId: null,
        brandId: null,
        costPrice: 0,
        profitMargin: 100,
        stock: 0,
        minStock: 5,
      })
      setInputSalePrice(0)
      setPricingMode('margin')
    }
  }, [product, reset])

  const onSubmit = async (data: CreateProductInput) => {
    try {
      const submitData = { ...data }
      if (pricingMode === 'salePrice') {
        submitData.profitMargin = calculatedMargin
      }

      if (isEditing && product) {
        await updateProduct.mutateAsync({ id: product.id, data: submitData })
        toast({ title: 'Produto atualizado com sucesso!' })
      } else {
        await createProduct.mutateAsync(submitData)
        toast({ title: 'Produto criado com sucesso!' })
      }
      reset()
      onOpenChange(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            {isEditing ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" placeholder="Nome do produto" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Codigo</Label>
            <div className="flex gap-2">
              <Input id="code" placeholder="Ex: SHP15" {...register('code')} className="flex-1" />
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateCode}
                title="Gerar codigo automaticamente"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Gerar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Clique em &quot;Gerar&quot; para criar um codigo baseado no nome do produto
            </p>
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
                      setValue('categoryId', category.id)
                      setNewCategoryName('')
                      setIsCreatingCategory(false)
                      toast({ title: 'Categoria criada!' })
                    } catch (error: any) {
                      toast({
                        title: 'Erro ao criar categoria',
                        description: error.message,
                        variant: 'destructive',
                      })
                    }
                  }}
                >
                  {createCategory.isPending ? '...' : 'Salvar'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingCategory(false)
                    setNewCategoryName('')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={watch('categoryId') || ''}
                  onValueChange={(value) => setValue('categoryId', value || null)}
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
                      setValue('brandId', brand.id)
                      setNewBrandName('')
                      setIsCreatingBrand(false)
                      toast({ title: 'Marca criada!' })
                    } catch (error: any) {
                      toast({
                        title: 'Erro ao criar marca',
                        description: error.message,
                        variant: 'destructive',
                      })
                    }
                  }}
                >
                  {createBrand.isPending ? '...' : 'Salvar'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingBrand(false)
                    setNewBrandName('')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={watch('brandId') || ''}
                  onValueChange={(value) => setValue('brandId', value || null)}
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

          <div className="space-y-2">
            <Label htmlFor="costPrice">Valor Produto (Custo) *</Label>
            <Input
              id="costPrice"
              type="number"
              step="0.01"
              min="0"
              {...register('costPrice', { valueAsNumber: true })}
            />
            {errors.costPrice && (
              <p className="text-sm text-destructive">{errors.costPrice.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Modo de Precificacao</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pricingMode"
                  checked={pricingMode === 'margin'}
                  onChange={() => setPricingMode('margin')}
                  className="h-4 w-4"
                />
                <span className="text-sm">Definir Margem de Lucro</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pricingMode"
                  checked={pricingMode === 'salePrice'}
                  onChange={() => setPricingMode('salePrice')}
                  className="h-4 w-4"
                />
                <span className="text-sm">Definir Preco de Venda</span>
              </label>
            </div>
          </div>

          {pricingMode === 'margin' ? (
            <div className="space-y-2">
              <Label htmlFor="profitMargin">Margem de Lucro (%)</Label>
              <Input
                id="profitMargin"
                type="number"
                step="0.1"
                min="0"
                {...register('profitMargin', { valueAsNumber: true })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="inputSalePrice">Preco de Venda</Label>
              <Input
                id="inputSalePrice"
                type="number"
                step="0.01"
                min="0"
                value={inputSalePrice}
                onChange={(e) => setInputSalePrice(Number(e.target.value))}
              />
            </div>
          )}

          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4 space-y-2 border border-primary/20">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Preço de Venda:</span>
              <span className="font-bold text-lg text-primary">
                {formatCurrency(calculatedSalePrice || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Margem de Lucro:</span>
              <span className="font-semibold text-foreground">{calculatedMargin.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lucro por unidade:</span>
              <span className="font-bold text-green-600">{formatCurrency(profit || 0)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock">Estoque Atual</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                {...register('stock', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStock">Estoque Mínimo</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                {...register('minStock', { valueAsNumber: true })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="transition-all duration-200 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="min-w-[100px] transition-all duration-200"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </span>
              ) : isEditing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
