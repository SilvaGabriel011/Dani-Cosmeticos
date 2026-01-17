"use client"

import { useState, useMemo, useEffect } from "react"
import { Plus, Minus, Trash2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { useProducts } from "@/hooks/use-products"
import { useClients } from "@/hooks/use-clients"
import { useSettings } from "@/hooks/use-settings"
import { useCreateSale } from "@/hooks/use-sales"
import { Product } from "@/types"
import { formatCurrency } from "@/lib/utils"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants"

interface SaleItem {
  product: Product
  quantity: number
}

interface Payment {
  method: "CASH" | "PIX" | "DEBIT" | "CREDIT"
  amount: number
  feePercent: number
  feeAbsorber: "SELLER" | "CLIENT"
  installments: number
}

interface SaleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultClientId?: string | null
}

export function SaleForm({ open, onOpenChange, defaultClientId }: SaleFormProps) {
  const { toast } = useToast()
  const { data: productsData } = useProducts({ limit: 20 })
  const { data: clientsData } = useClients({ limit: 20 })
  const { data: settings } = useSettings()
  const createSale = useCreateSale()

  const [items, setItems] = useState<SaleItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [clientId, setClientId] = useState<string>(defaultClientId || "")
  const [discountPercent, setDiscountPercent] = useState(0)
  const [productSearch, setProductSearch] = useState("")
  const [isInstallment, setIsInstallment] = useState(false)
  const [paymentDay, setPaymentDay] = useState<number>(new Date().getDate()) // Default to current day of month
  const [installmentPlan, setInstallmentPlan] = useState(1)

  const products = productsData?.data || []
  const clients = clientsData?.data || []

  useEffect(() => {
    if (open && defaultClientId) {
      setClientId(defaultClientId)
    }
  }, [open, defaultClientId])

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

  const filteredProducts = products.filter(
    (p) =>
      p.stock > 0 &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.code?.toLowerCase().includes(productSearch.toLowerCase()))
  )

  const selectedClient = clients.find((c) => c.id === clientId)
  const [hasManualDiscount, setHasManualDiscount] = useState(false)
  const effectiveDiscount = hasManualDiscount ? discountPercent : Number(selectedClient?.discount || 0)

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.product.salePrice) * item.quantity, 0),
    [items]
  )

  const discountAmount = subtotal * (effectiveDiscount / 100)
  const total = subtotal - discountAmount

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = total - totalPayments

  const addItem = (product: Product) => {
    const existing = items.find((i) => i.product.id === product.id)
    if (existing) {
      if (existing.quantity < product.stock) {
        setItems(
          items.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        )
      }
    } else {
      setItems([...items, { product, quantity: 1 }])
    }
    setProductSearch("")
  }

  const updateQuantity = (productId: string, delta: number) => {
    setItems(
      items
        .map((item) => {
          if (item.product.id !== productId) return item
          const newQty = item.quantity + delta
          if (newQty <= 0) return null
          if (newQty > item.product.stock) return item
          return { ...item, quantity: newQty }
        })
        .filter(Boolean) as SaleItem[]
    )
  }

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.product.id !== productId))
  }

  const addPayment = () => {
    setPayments([
      ...payments,
      {
        method: "PIX",
        amount: remaining > 0 ? remaining : 0,
        feePercent: 0,
        feeAbsorber: settings?.defaultFeeAbsorber || "SELLER",
        installments: 1,
      },
    ])
  }

  const updatePayment = (index: number, updates: Partial<Payment>) => {
    const newPayments = [...payments]
    const payment = { ...newPayments[index], ...updates }

    if (updates.method) {
      switch (updates.method) {
        case "DEBIT":
          payment.feePercent = Number(settings?.debitFeePercent || 1.5)
          break
        case "CREDIT":
          payment.feePercent =
            payment.installments > 1
              ? Number(settings?.creditInstallmentFee || 4)
              : Number(settings?.creditFeePercent || 3)
          break
        default:
          payment.feePercent = 0
      }
    }

    if (updates.installments && payment.method === "CREDIT") {
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

  const isFiado = remaining > 0.01

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({ title: "Adicione pelo menos um produto", variant: "destructive" })
      return
    }

    // For fiado sales (partial or no payment), require a client
    if (isFiado && !clientId) {
      toast({ 
        title: "Cliente obrigatório para fiado", 
        description: "Selecione um cliente para vendas sem pagamento completo",
        variant: "destructive" 
      })
      return
    }

    // Don't allow overpayment
    if (remaining < -0.01) {
      toast({
        title: "Pagamento excede o total",
        variant: "destructive",
      })
      return
    }

    try {
      // Filter out payments with 0 or negative amounts (they would fail validation)
      const validPayments = payments.filter((p) => p.amount > 0)
      
      await createSale.mutateAsync({
        clientId: clientId || null,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
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
      })

      toast({ 
        title: isFiado ? "Venda fiado registrada!" : "Venda realizada com sucesso!",
        description: isFiado ? `Saldo pendente: ${formatCurrency(remaining)}` : undefined
      })
      setItems([])
      setPayments([])
      setClientId("")
      setDiscountPercent(0)
      setHasManualDiscount(false)
      setIsInstallment(false)
      setPaymentDay(new Date().getDate())
      setInstallmentPlan(1)
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Erro ao realizar venda",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Venda</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Products Section */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Produtos</span>
                  {products.length > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {products.filter(p => p.stock > 0).length} disponíveis
                    </span>
                  )}
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
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    {filteredProducts.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhum produto encontrado
                      </p>
                    ) : (
                      filteredProducts.slice(0, 10).map((product) => (
                        <button
                          key={product.id}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex justify-between items-center text-sm"
                          onClick={() => addItem(product)}
                        >
                          <span>{product.name}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(Number(product.salePrice))}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                <Separator />

                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum produto adicionado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex-1 truncate">{item.product.name}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.product.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.product.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="w-20 text-right">
                          {formatCurrency(Number(item.product.salePrice) * item.quantity)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeItem(item.product.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
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
                      <SelectValue placeholder={clients.length > 0 ? "Selecione um cliente" : "Nenhum cliente cadastrado"} />
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
                <Separator className="my-3" />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="installment-toggle"
                      checked={isInstallment}
                      onChange={(e) => setIsInstallment(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="installment-toggle" className="cursor-pointer">
                      Venda parcelada / a prazo
                    </Label>
                  </div>
                  {isInstallment && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Dia do Pagamento</Label>
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
                                  Dia {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Parcelas</Label>
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
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {installmentPlan}x de {formatCurrency(total / installmentPlan)} - todo dia {paymentDay}
                          </p>
                          <div className="border rounded-md p-2 space-y-1 text-xs text-muted-foreground">
                            <p className="font-medium">Previsao de pagamentos:</p>
                            {getPaymentDatesPreview().map((date, index) => (
                              <p key={index}>
                                {index + 1}a parcela: {date.toLocaleDateString('pt-BR')}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Pagamentos</CardTitle>
                <Button variant="outline" size="sm" onClick={addPayment}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {payments.map((payment, index) => (
                  <div key={index} className="space-y-2 p-3 border rounded-md">
                    <div className="flex gap-2">
                      <Select
                        value={payment.method}
                        onValueChange={(v) =>
                          updatePayment(index, { method: v as Payment["method"] })
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
                    {payment.method === "CREDIT" && (
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
                              {n}x {n === 1 ? "à vista" : ""}
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
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {effectiveDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto ({effectiveDiscount}%):</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Restante (Fiado):</span>
                    <span>{formatCurrency(remaining)}</span>
                  </div>
                )}
                {remaining < 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Excedente:</span>
                    <span>{formatCurrency(Math.abs(remaining))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createSale.isPending || items.length === 0}
            variant={isFiado ? "secondary" : "default"}
          >
            {createSale.isPending ? "Finalizando..." : isFiado ? "Registrar Fiado" : "Finalizar Venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
