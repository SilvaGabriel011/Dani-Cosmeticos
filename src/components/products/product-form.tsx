'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, X, Loader2, Package, History, Trash2 } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { useBrands, useCreateBrand } from '@/hooks/use-brands'
import { useCategories, useCreateCategory } from '@/hooks/use-categories'
import { useCreateProduct, useUpdateProduct, useProducts, useCostEntries, useAddCostEntry, useDeleteCostEntry } from '@/hooks/use-products'
import { generateProductCode } from '@/lib/code-generator'
import { formatCurrency, calculateProfitMargin, calculateProfit } from '@/lib/utils'
import { useMemo } from 'react'
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
  const { data: productsData } = useProducts({ limit: 200 }, { enabled: open })
  const createCategory = useCreateCategory()
  const { data: brands } = useBrands()
  const createBrand = useCreateBrand()
  const isEditing = !!product
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isCreatingBrand, setIsCreatingBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [pricingMode, setPricingMode] = useState<'margin' | 'salePrice'>('salePrice')
  const [inputSalePrice, setInputSalePrice] = useState(0)
  const [showCostForm, setShowCostForm] = useState(false)
  const [newCostPrice, setNewCostPrice] = useState('')
  const [newCostQty, setNewCostQty] = useState('1')
  const [newCostNotes, setNewCostNotes] = useState('')
  const { data: costEntries, isLoading: loadingEntries } = useCostEntries(product?.id || '')
  const addCostEntry = useAddCostEntry()
  const deleteCostEntry = useDeleteCostEntry()

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
  const watchedName = watch('name')
  const watchedBrandId = watch('brandId')

  const calculatedSalePrice =
    pricingMode === 'margin' ? costPrice * (1 + profitMargin / 100) : inputSalePrice

  const calculatedMargin =
    pricingMode === 'salePrice' ? calculateProfitMargin(costPrice, inputSalePrice) : profitMargin

  const profit = calculateProfit(costPrice, calculatedSalePrice)

  const existingCodes = useMemo(
    () => productsData?.data?.map((p) => p.code).filter((c): c is string => !!c) || [],
    [productsData]
  )

  const selectedBrandName = useMemo(
    () => brands?.find((b) => b.id === watchedBrandId)?.name,
    [brands, watchedBrandId]
  )

  const autoGenerateCode = useCallback(() => {
    if (!watchedName) {
      setValue('code', '')
      return
    }
    const codesToCheck =
      isEditing && product?.code ? existingCodes.filter((c) => c !== product.code) : existingCodes
    const code = generateProductCode(
      watchedName,
      codesToCheck,
      selectedBrandName,
      calculatedSalePrice
    )
    setValue('code', code)
  }, [
    watchedName,
    selectedBrandName,
    calculatedSalePrice,
    existingCodes,
    setValue,
    isEditing,
    product,
  ])

  useEffect(() => {
    if (!isEditing) {
      autoGenerateCode()
    }
  }, [autoGenerateCode, isEditing])

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
      setPricingMode('salePrice')
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
      setPricingMode('salePrice')
    }
  }, [product, reset])

  const onSubmit = async (data: CreateProductInput) => {
    try {
      const submitData = { ...data }
      if (pricingMode === 'salePrice') {
        submitData.profitMargin = calculatedMargin
        submitData.salePrice = inputSalePrice
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
      <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[90vh] landscape:max-h-[95vh] overflow-y-auto landscape:gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            {isEditing ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-2 landscape:gap-3"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" placeholder="Nome do produto" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="costPrice">Valor Produto (Custo){isEditing && costEntries && costEntries.length > 0 ? ' — Média' : ''}</Label>
            {isEditing && costEntries && costEntries.length > 0 ? (
              <div className="flex items-center gap-2">
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('costPrice', { valueAsNumber: true })}
                  readOnly
                  className="bg-muted cursor-default"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setShowCostForm(!showCostForm)}
                  title="Histórico de custos"
                >
                  <History className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                {...register('costPrice', { valueAsNumber: true })}
              />
            )}
            {errors.costPrice && (
              <p className="text-sm text-destructive">{errors.costPrice.message}</p>
            )}
          </div>

          <input type="hidden" {...register('code')} />

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
                  <X className="h-5 w-5" />
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
                  <Plus className="h-5 w-5" />
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
                  <X className="h-5 w-5" />
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
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>

          {isEditing && showCostForm && (
            <div className="md:col-span-2 space-y-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Preços de Custo
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowCostForm(false)
                    setNewCostPrice('')
                    setNewCostQty('1')
                    setNewCostNotes('')
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Fechar
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[100px]">
                  <Label className="text-xs">Preço *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={newCostPrice}
                    onChange={(e) => setNewCostPrice(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="w-20">
                  <Label className="text-xs">Qtd</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newCostQty}
                    onChange={(e) => setNewCostQty(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Label className="text-xs">Obs</Label>
                  <Input
                    placeholder="Ex: Promoção"
                    value={newCostNotes}
                    onChange={(e) => setNewCostNotes(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  disabled={!newCostPrice || Number(newCostPrice) <= 0 || addCostEntry.isPending}
                  onClick={async () => {
                    if (!product) return
                    try {
                      const result = await addCostEntry.mutateAsync({
                        productId: product.id,
                        price: Number(newCostPrice),
                        quantity: Math.max(1, Math.round(Number(newCostQty) || 1)),
                        notes: newCostNotes || undefined,
                      })
                      setValue('costPrice', Number(result.product.costPrice))
                      setValue('profitMargin', Number(result.product.profitMargin))
                      setNewCostPrice('')
                      setNewCostQty('1')
                      setNewCostNotes('')
                      toast({ title: 'Preço de custo adicionado!' })
                    } catch (error: any) {
                      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
                    }
                  }}
                >
                  {addCostEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Adicionar
                </Button>
              </div>

              {loadingEntries ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : costEntries && costEntries.length > 0 ? (
                <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                  {costEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between text-sm bg-background rounded-lg px-3 py-2 border">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="font-medium">{formatCurrency(Number(entry.price))}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5">{entry.quantity}x</Badge>
                        {entry.notes && <span className="text-xs text-muted-foreground truncate">{entry.notes}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(entry.createdAt), "dd/MM/yy", { locale: ptBR })}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          disabled={deleteCostEntry.isPending}
                          onClick={async () => {
                            if (!product) return
                            try {
                              const updated = await deleteCostEntry.mutateAsync({
                                productId: product.id,
                                entryId: entry.id,
                              })
                              setValue('costPrice', Number(updated.costPrice))
                              setValue('profitMargin', Number(updated.profitMargin))
                              toast({ title: 'Entrada removida' })
                            } catch (error: any) {
                              toast({ title: 'Erro', description: error.message, variant: 'destructive' })
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma entrada de custo registrada.</p>
              )}
            </div>
          )}

          <div className="space-y-3 md:col-span-2">
            <Label>Modo de Precificacao</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
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

          <div className="grid grid-cols-2 gap-4 landscape:gap-3">
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

          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4 landscape:p-3 space-y-2 landscape:space-y-1.5 border border-primary/20 md:col-span-2">
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

          <DialogFooter className="gap-2 sm:gap-0 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Salvando...
                </span>
              ) : isEditing ? (
                'Atualizar'
              ) : (
                'Criar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
