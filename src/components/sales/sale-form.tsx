'use client'

import { Plus, Minus, Trash2, Search, Loader2, Wallet, Handshake, ShoppingCart } from 'lucide-react'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { useClients } from '@/hooks/use-clients'
import { useProducts } from '@/hooks/use-products'
import { useCreateSale, useClientPendingSales, useAddItemsToSale } from '@/hooks/use-sales'
import { useSettings } from '@/hooks/use-settings'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { fuzzySearch } from '@/lib/fuzzy-search'
import { formatCurrency } from '@/lib/utils'
import { type Product } from '@/types'

interface CartItem {
  product: Product
  quantity: number
  originalPrice: number
  unitPrice: number
  totalPrice: number
}

interface Payment {
  method: 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT'
  amount: number
  feePercent: number
  feeAbsorber: 'SELLER' | 'CLIENT'
  installments: number
}

interface SaleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultClientId?: string | null
}

export function SaleForm({ open, onOpenChange, defaultClientId }: SaleFormProps) {
  const { toast } = useToast()
  const { data: productsData } = useProducts({ limit: 1000 })
  const { data: clientsData } = useClients({ limit: 1000 })
  const { data: settings } = useSettings()
  const createSale = useCreateSale()
  const addItemsToSale = useAddItemsToSale()

  const [items, setItems] = useState<CartItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [clientId, setClientId] = useState<string>(defaultClientId || '')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [productSearch, setProductSearch] = useState('')
  const [visibleProductsCount, setVisibleProductsCount] = useState(20)
  const productListRef = useRef<HTMLDivElement>(null)
  const [isInstallment, setIsInstallment] = useState(false)
  const [paymentDay, setPaymentDay] = useState<number>(new Date().getDate()) // Default to current day of month
  const [installmentPlan, setInstallmentPlan] = useState(1)
  const [isFiadoMode, setIsFiadoMode] = useState(false) // Toggle between fiado and normal payment modes
  const [fixedInstallmentAmount, setFixedInstallmentAmount] = useState<number | null>(null) // Fixed amount for each payment
  const [manualTotal, setManualTotal] = useState<number | null>(null)

  // Multiple purchases feature - add to existing account
  const [saleMode, setSaleMode] = useState<'new' | 'existing'>('new')
  const [selectedPendingSaleId, setSelectedPendingSaleId] = useState<string>('')

  // Fetch pending sales for the selected client
  const { data: pendingSalesData } = useClientPendingSales(clientId || null)
  const pendingSales = pendingSalesData?.pendingSales || []

  const products = useMemo(() => productsData?.data || [], [productsData?.data])
  const clients = clientsData?.data || []

  useEffect(() => {
    if (open && defaultClientId) {
      setClientId(defaultClientId)
    }
  }, [open, defaultClientId])

  // Reset sale mode when client changes
  useEffect(() => {
    setSaleMode('new')
    setSelectedPendingSaleId('')
  }, [clientId])

  // Generate preview of payment dates based on day of month
  const getPaymentDatesPreview = () => {
    const dates: Date[] = []
    const now = new Date()

    for (let i = 0; i < installmentPlan; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, paymentDay)
      // If the day is in the past for the first month, start from next month
      if (i === 0 && date <= now) {
        date.setMonth(date.getMonth() + 1)
      }
      // Adjust for months with fewer days (e.g., Feb 30 -> Feb 28)
      if (date.getDate() !== paymentDay) {
        date.setDate(0) // Last day of previous month
      }
      dates.push(date)
    }
    return dates
  }

  const filteredProducts = useMemo(() => {
    const inStock = products.filter((p) => p.stock > 0)
    if (!productSearch.trim()) return inStock

    return fuzzySearch(inStock, productSearch, (p) => [p.name, p.code || ''])
  }, [products, productSearch])

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleProductsCount)
  }, [filteredProducts, visibleProductsCount])

  const hasMoreProducts = visibleProductsCount < filteredProducts.length

  const handleProductListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 50 && hasMoreProducts) {
      setVisibleProductsCount(prev => Math.min(prev + 20, filteredProducts.length))
    }
  }, [hasMoreProducts, filteredProducts.length])

  useEffect(() => {
    setVisibleProductsCount(20)
  }, [productSearch])

  const selectedClient = clients.find((c) => c.id === clientId)
  const [hasManualDiscount, setHasManualDiscount] = useState(false)
  const effectiveDiscount = hasManualDiscount
    ? discountPercent
    : Number(selectedClient?.discount || 0)

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.totalPrice, 0), [items])

  const discountAmount = subtotal * (effectiveDiscount / 100)
  const calculatedTotal = subtotal - discountAmount
  const total = manualTotal !== null ? manualTotal : calculatedTotal

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = total - totalPayments

  const addItem = (product: Product) => {
    const existing = items.find((i) => i.product.id === product.id)
    const originalPrice = Number(product.salePrice)

    if (existing) {
      if (existing.quantity < product.stock) {
        setItems(
          items.map((i) => {
            if (i.product.id === product.id) {
              const newQuantity = i.quantity + 1
              return {
                ...i,
                quantity: newQuantity,
                totalPrice: i.unitPrice * newQuantity,
              }
            }
            return i
          })
        )
      }
    } else {
      setItems([
        ...items,
        {
          product,
          quantity: 1,
          originalPrice,
          unitPrice: originalPrice,
          totalPrice: originalPrice,
        },
      ])
    }
    setProductSearch('')
  }

  const updateQuantity = (productId: string, delta: number) => {
    setItems(
      items
        .map((item) => {
          if (item.product.id !== productId) return item
          const newQty = item.quantity + delta
          if (newQty <= 0) return null
          if (newQty > item.product.stock) return item
          return {
            ...item,
            quantity: newQty,
            totalPrice: item.unitPrice * newQty,
          }
        })
        .filter(Boolean) as CartItem[]
    )
  }

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.product.id !== productId))
  }

  const updateItemPrice = (productId: string, newPrice: number) => {
    setItems(
      items.map((item) => {
        if (item.product.id !== productId) return item
        const unitPrice = Math.max(0, newPrice)
        return {
          ...item,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
        }
      })
    )
  }

  const addPayment = () => {
    setPayments([
      ...payments,
      {
        method: 'PIX',
        amount: remaining > 0 ? remaining : 0,
        feePercent: 0,
        feeAbsorber: settings?.defaultFeeAbsorber || 'SELLER',
        installments: 1,
      },
    ])
  }

  const updatePayment = (index: number, updates: Partial<Payment>) => {
    const newPayments = [...payments]
    const payment = { ...newPayments[index], ...updates }

    if (updates.method) {
      switch (updates.method) {
        case 'DEBIT':
          payment.feePercent = Number(settings?.debitFeePercent || 1.5)
          break
        case 'CREDIT':
          payment.feePercent =
            payment.installments > 1
              ? Number(settings?.creditInstallmentFee || 4)
              : Number(settings?.creditFeePercent || 3)
          break
        default:
          payment.feePercent = 0
      }
    }

    if (updates.installments && payment.method === 'CREDIT') {
      payment.feePercent =
        updates.installments > 1
          ? Number(settings?.creditInstallmentFee || 4)
          : Number(settings?.creditFeePercent || 3)
    }

    newPayments[index] = payment
    setPayments(newPayments)
  }

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index))
  }

  const isFiado = isFiadoMode || remaining > 0.01

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({ title: 'Adicione pelo menos um produto', variant: 'destructive' })
      return
    }

    // Adding to existing sale
    if (saleMode === 'existing' && selectedPendingSaleId) {
      try {
        await addItemsToSale.mutateAsync({
          saleId: selectedPendingSaleId,
          data: {
            items: items.map((i) => ({
              productId: i.product.id,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          },
        })

        const selectedSale = pendingSales.find((s) => s.id === selectedPendingSaleId)
        toast({
          title: 'Itens adicionados à conta!',
          description: `Valor adicionado: ${formatCurrency(total)}. Total da conta: ${formatCurrency((selectedSale?.total || 0) + total)}`,
        })
        resetForm()
        onOpenChange(false)
        return
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao adicionar itens'
        toast({
          title: 'Erro ao adicionar itens',
          description: errorMessage,
          variant: 'destructive',
        })
        return
      }
    }

    // For fiado sales (fiado mode or partial payment), require a client
    if (isFiado && !clientId) {
      toast({
        title: 'Cliente obrigatório para fiado',
        description: 'Selecione um cliente para vendas fiado',
        variant: 'destructive',
      })
      return
    }

    // For normal mode (not fiado), require at least one payment that covers the total
    if (!isFiadoMode && payments.length === 0 && total > 0) {
      toast({
        title: 'Adicione pelo menos um pagamento',
        description: 'Ou ative o modo fiado para venda a prazo',
        variant: 'destructive',
      })
      return
    }

    // Don't allow overpayment
    if (remaining < -0.01) {
      toast({
        title: 'Pagamento excede o total',
        variant: 'destructive',
      })
      return
    }

    try {
      // Filter out payments with 0 or negative amounts (they would fail validation)
      // In fiado mode, we may have no payments at all
      const validPayments = isFiadoMode ? [] : payments.filter((p) => p.amount > 0)

      await createSale.mutateAsync({
        clientId: clientId || null,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        payments: validPayments.map((p) => ({
          method: p.method,
          amount: p.amount,
          feePercent: p.feePercent,
          feeAbsorber: p.feeAbsorber,
          installments: p.installments,
        })),
        discountPercent: effectiveDiscount,
        paymentDay: isInstallment ? paymentDay : null,
        installmentPlan: isInstallment ? installmentPlan : 1,
        fixedInstallmentAmount:
          isFiadoMode && fixedInstallmentAmount ? fixedInstallmentAmount : null,
      })

      toast({
        title: isFiado ? 'Venda fiado registrada!' : 'Venda realizada com sucesso!',
        description: isFiado ? `Saldo pendente: ${formatCurrency(remaining)}` : undefined,
      })
      resetForm()
      onOpenChange(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao realizar venda'
      toast({
        title: 'Erro ao realizar venda',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setItems([])
    setPayments([])
    setClientId('')
    setDiscountPercent(0)
    setHasManualDiscount(false)
    setIsInstallment(false)
    setPaymentDay(new Date().getDate())
    setInstallmentPlan(1)
    setIsFiadoMode(false)
    setFixedInstallmentAmount(null)
    setManualTotal(null)
    setSaleMode('new')
    setSelectedPendingSaleId('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Nova Venda - Carrinho</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full overflow-hidden">
          {/* Products Section */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Produtos</span>
                  <div className="flex items-center gap-2">
                    {items.length > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                        {items.reduce((sum, item) => sum + item.quantity, 0)} itens
                      </span>
                    )}
                    {products.length > 0 && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {products.filter((p) => p.stock > 0).length} disponíveis
                      </span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {(productSearch || filteredProducts.length > 0) && (
                  <div 
                    ref={productListRef}
                    className="max-h-60 overflow-y-auto border rounded-md"
                    onScroll={handleProductListScroll}
                  >
                    {filteredProducts.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhum produto encontrado
                      </p>
                    ) : (
                      <>
                        {visibleProducts.map((product) => (
                          <button
                            key={product.id}
                            className="w-full px-3 py-2 text-left text-sm flex justify-between items-center transition-all duration-200 hover:bg-primary/10 hover:pl-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset active:bg-primary/20 active:scale-[0.99]"
                            onClick={() => addItem(product)}
                          >
                            <span className="font-medium">{product.name}</span>
                            <span className="text-muted-foreground font-semibold">
                              {formatCurrency(Number(product.salePrice))}
                            </span>
                          </button>
                        ))}
                        {hasMoreProducts && (
                          <div className="px-3 py-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Role para carregar mais ({filteredProducts.length - visibleProductsCount} restantes)
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <Separator />

                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <div className="p-4 rounded-full bg-muted/50 mb-4">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Carrinho vazio
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Busque e adicione produtos acima
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.product.id} className="p-3 border rounded-lg bg-gray-50/50 space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                        {/* Header: Nome + Remover */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm leading-tight">{item.product.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-lg hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all duration-150"
                            onClick={() => removeItem(item.product.id)}
                            aria-label={`Remover ${item.product.name} do carrinho`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        {/* Controles: Quantidade + Preço Unitário */}
                        <div className="flex items-center justify-between gap-3">
                          {/* Quantidade */}
                          <div className="flex items-center gap-1 bg-white rounded-xl border-2 border-gray-100 p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-lg hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => updateQuantity(item.product.id, -1)}
                              disabled={item.quantity <= 1}
                              aria-label="Diminuir quantidade"
                            >
                              <Minus className="h-5 w-5" />
                            </Button>
                            <span className="w-12 text-center font-bold text-xl tabular-nums">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-lg hover:bg-green-50 hover:text-green-600 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => updateQuantity(item.product.id, 1)}
                              disabled={item.quantity >= item.product.stock}
                              aria-label="Aumentar quantidade"
                            >
                              <Plus className="h-5 w-5" />
                            </Button>
                          </div>

                          {/* Preço Unitário - Editável */}
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Valor un.:</span>
                              <div className="relative group">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className={`w-32 h-11 pl-9 pr-3 text-right text-base font-medium border-2 rounded-lg transition-all duration-200 hover:border-gray-300 focus:ring-2 focus:ring-primary/20 ${
                                    item.unitPrice !== item.originalPrice
                                      ? item.unitPrice < item.originalPrice
                                        ? 'border-green-300 bg-green-50/50 focus:border-green-500'
                                        : 'border-orange-300 bg-orange-50/50 focus:border-orange-500'
                                      : 'border-gray-200 bg-white focus:border-primary'
                                  }`}
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    updateItemPrice(item.product.id, Number(e.target.value))
                                  }
                                  aria-label={`Preço unitário de ${item.product.name}`}
                                />
                              </div>
                            </div>
                            {item.unitPrice !== item.originalPrice && (
                              <span className={`text-xs font-medium ${item.unitPrice < item.originalPrice ? 'text-green-600' : 'text-orange-600'}`}>
                                {item.unitPrice < item.originalPrice 
                                  ? `-${((1 - item.unitPrice / item.originalPrice) * 100).toFixed(0)}% desc.`
                                  : `+${((item.unitPrice / item.originalPrice - 1) * 100).toFixed(0)}% acrés.`
                                }
                                <span className="text-muted-foreground ml-1">(era {formatCurrency(item.originalPrice)})</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Total do Item */}
                        <div className="flex items-center justify-end pt-2 border-t border-dashed">
                          <span className="text-xs text-muted-foreground mr-2">Total:</span>
                          <span className="text-lg font-bold text-primary">
                            {formatCurrency(item.totalPrice)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Section */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Cliente e Desconto</span>
                  {clients.length > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {clients.length} clientes
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Cliente {isFiado && <span className="text-destructive">*</span>}</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          clients.length > 0 ? 'Selecione um cliente' : 'Nenhum cliente cadastrado'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Multiple purchases feature - add to existing account */}
                {clientId && pendingSales.length > 0 && (
                  <div className="space-y-3 p-3 border rounded-md border-blue-200 bg-blue-50">
                    <p className="text-sm font-medium text-blue-800">
                      Este cliente tem {pendingSales.length} conta(s) em aberto
                    </p>
                    <RadioGroup
                      value={saleMode}
                      onValueChange={(v) => {
                        setSaleMode(v as 'new' | 'existing')
                        if (v === 'new') {
                          setSelectedPendingSaleId('')
                        }
                      }}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="new" id="sale-mode-new" />
                        <Label htmlFor="sale-mode-new" className="cursor-pointer text-sm">
                          Criar nova conta/fatura
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="existing" id="sale-mode-existing" />
                        <Label htmlFor="sale-mode-existing" className="cursor-pointer text-sm">
                          Adicionar na conta existente
                        </Label>
                      </div>
                    </RadioGroup>

                    {saleMode === 'existing' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Selecione a conta</Label>
                        <Select
                          value={selectedPendingSaleId}
                          onValueChange={setSelectedPendingSaleId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma conta" />
                          </SelectTrigger>
                          <SelectContent>
                            {pendingSales.map((sale) => (
                              <SelectItem key={sale.id} value={sale.id}>
                                {formatCurrency(sale.total)} - {sale.installmentPlan}x de{' '}
                                {formatCurrency(
                                  sale.fixedInstallmentAmount || sale.total / sale.installmentPlan
                                )}{' '}
                                - {sale.pendingReceivablesCount} parcelas restantes
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedPendingSaleId && (
                          <p className="text-xs text-blue-600">
                            Os itens serao adicionados a esta conta e novas parcelas serao criadas
                            automaticamente.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Desconto (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => {
                      setDiscountPercent(Number(e.target.value))
                      setHasManualDiscount(true)
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resumo do valor */}
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-xl text-center border border-primary/20">
                  <p className="text-sm text-muted-foreground font-medium">Total da compra</p>
                  <p className="text-3xl font-bold text-primary mt-1">{formatCurrency(total)}</p>
                </div>

                {/* Escolha principal: Pagar Agora vs Fiado */}
                <div className="grid gap-3">
                  <Button
                    variant={!isFiadoMode ? 'default' : 'outline'}
                    className={`h-auto py-4 px-5 justify-start transition-all duration-200 ${!isFiadoMode ? 'ring-2 ring-primary ring-offset-2' : 'hover:bg-primary/5'}`}
                    onClick={() => {
                      setIsFiadoMode(false)
                      if (payments.length === 0) {
                        addPayment()
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-full ${!isFiadoMode ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                        <Wallet className="h-6 w-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-base">Pagar Agora</div>
                        <div className="text-sm opacity-70 font-normal">Dinheiro, PIX ou cartão</div>
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant={isFiadoMode ? 'default' : 'outline'}
                    className={`h-auto py-4 px-5 justify-start transition-all duration-200 ${isFiadoMode ? 'ring-2 ring-primary ring-offset-2' : 'hover:bg-primary/5'}`}
                    onClick={() => {
                      setIsFiadoMode(true)
                      setPayments([])
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-full ${isFiadoMode ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                        <Handshake className="h-6 w-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-base">Fiado</div>
                        <div className="text-sm opacity-70 font-normal">Pagar depois em parcelas</div>
                      </div>
                    </div>
                  </Button>
                </div>

                {/* Campos específicos baseados na escolha */}
                {!isFiadoMode ? (
                  <div className="bg-green-50/80 p-4 rounded-xl space-y-3 border border-green-200">
                    <p className="font-semibold text-green-800 flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Forma de pagamento:
                    </p>

                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={addPayment}>
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar Pagamento
                      </Button>
                    </div>
                    {payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Nenhum pagamento adicionado
                      </p>
                    ) : (
                      payments.map((payment, index) => (
                        <div key={index} className="space-y-2 p-3 border rounded-md bg-white">
                          <div className="flex gap-2">
                            <Select
                              value={payment.method}
                              onValueChange={(v) =>
                                updatePayment(index, { method: v as Payment['method'] })
                              }
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={payment.amount}
                              onChange={(e) =>
                                updatePayment(index, { amount: Number(e.target.value) })
                              }
                              className="w-28"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePayment(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          {payment.method === 'CREDIT' && (
                            <Select
                              value={payment.installments.toString()}
                              onValueChange={(v) =>
                                updatePayment(index, { installments: Number(v) })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                                  <SelectItem key={n} value={n.toString()}>
                                    {n}x {n === 1 ? 'à vista' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {payment.feePercent > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Taxa: {payment.feePercent}%
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50/80 p-4 rounded-xl space-y-4 border border-amber-200">
                    <div className="text-center">
                      <p className="font-semibold text-amber-800 flex items-center justify-center gap-2">
                        <Handshake className="h-4 w-4" />
                        Como vai ser o fiado?
                      </p>
                      <p className="text-sm text-amber-600 mt-1">
                        O valor total de <strong>{formatCurrency(total)}</strong> será registrado
                        como fiado.
                      </p>
                    </div>

                    {/* Configurações do fiado */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="installment-toggle-simple"
                          checked={isInstallment}
                          onChange={(e) => setIsInstallment(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="installment-toggle-simple" className="cursor-pointer">
                          Dividir em parcelas mensais
                        </Label>
                      </div>

                      {isInstallment && (
                        <div className="space-y-3 pl-6">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Dia do pagamento</Label>
                              <Select
                                value={String(paymentDay)}
                                onValueChange={(v) => setPaymentDay(Number(v))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Dia" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                                    <SelectItem key={day} value={String(day)}>
                                      Todo dia {day}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Número de parcelas</Label>
                              <Select
                                value={String(installmentPlan)}
                                onValueChange={(v) => setInstallmentPlan(Number(v))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6, 12].map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n}x
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {total > 0 && (
                            <div className="bg-white p-3 rounded-md border border-amber-200">
                              <p className="text-sm font-medium text-amber-800">
                                {installmentPlan}x de {formatCurrency(total / installmentPlan)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Primeiro pagamento:{' '}
                                {getPaymentDatesPreview()[0]?.toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-sm">Valor fixo da parcela (opcional)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={
                            total > 0 && installmentPlan > 0
                              ? formatCurrency(total / installmentPlan)
                              : 'Ex: 50.00'
                          }
                          value={fixedInstallmentAmount || ''}
                          onChange={(e) =>
                            setFixedInstallmentAmount(
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          💡 Este valor será sugerido ao registrar pagamentos
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {effectiveDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-medium">Desconto ({effectiveDiscount}%):</span>
                    <span className="text-green-600 font-semibold">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total:</span>
                  <div className="flex items-center gap-2">
                    {manualTotal !== null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setManualTotal(null)}
                        className="h-7 w-7 p-0 hover:bg-primary/10 rounded-full"
                        title="Usar valor calculado"
                        aria-label="Restaurar valor calculado"
                      >
                        <span className="text-xs">↩</span>
                      </Button>
                    )}
                    <Input
                      type="number"
                      value={manualTotal !== null ? manualTotal : calculatedTotal}
                      onChange={(e) => {
                        const value = Number(e.target.value)
                        if (value >= 0) {
                          setManualTotal(value)
                        }
                      }}
                      className="w-36 text-right text-xl font-bold text-primary border-2 border-primary/30 focus:border-primary rounded-lg"
                      step="0.01"
                      min="0"
                      placeholder={formatCurrency(calculatedTotal)}
                      aria-label="Total da venda"
                    />
                  </div>
                </div>
                {(isFiadoMode || remaining > 0) && (
                  <div className="flex justify-between text-sm bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <span className="text-amber-700 font-medium">Restante (Fiado):</span>
                    <span className="text-amber-700 font-bold">{formatCurrency(isFiadoMode ? total : remaining)}</span>
                  </div>
                )}
                {remaining < 0 && (
                  <div className="flex justify-between text-sm bg-red-50 p-2 rounded-lg border border-red-200">
                    <span className="text-red-600 font-medium">Excedente:</span>
                    <span className="text-red-600 font-bold">{formatCurrency(Math.abs(remaining))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="transition-all duration-200 hover:bg-gray-100"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              createSale.isPending ||
              addItemsToSale.isPending ||
              items.length === 0 ||
              (saleMode === 'existing' && !selectedPendingSaleId)
            }
            variant={saleMode === 'existing' ? 'default' : isFiado ? 'secondary' : 'default'}
            className="min-w-[140px] transition-all duration-200 disabled:opacity-50"
          >
            {createSale.isPending || addItemsToSale.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Finalizando...
              </span>
            ) : saleMode === 'existing' ? (
              'Adicionar na Conta'
            ) : isFiado ? (
              'Registrar Fiado'
            ) : (
              'Finalizar Venda'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
