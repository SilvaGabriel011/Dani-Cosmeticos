'use client'

import { ChevronLeft, ChevronRight, Check, AlertTriangle, Package } from 'lucide-react'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { useClients, useCreateClient } from '@/hooks/use-clients'
import { useDebounce } from '@/hooks/use-debounce'
import { useProducts, useProductsOnDemand, useCreateProduct } from '@/hooks/use-products'
import { useRecentSelections } from '@/hooks/use-recent-selections'
import { useCreateSale, useClientPendingSales, useAddItemsToSale } from '@/hooks/use-sales'
import { useSettings } from '@/hooks/use-settings'
import { DEFAULT_PAYMENT_DAY } from '@/lib/constants'
import Fuse from 'fuse.js'
import { cn, formatCurrency } from '@/lib/utils'
import { type Product } from '@/types'
import { SaleReceipt, type SaleReceiptData } from './sale-receipt'
import { SaleFormProvider, type CartItem, type Payment } from './sale-form-context'
import { StepCart } from './steps/step-cart'
import { StepClient } from './steps/step-client'
import { StepPayment } from './steps/step-payment'
import { StepReview } from './steps/step-review'

interface SaleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultClientId?: string | null
}

const STEPS = [
  { key: 'cart', label: 'Produtos' },
  { key: 'client', label: 'Cliente' },
  { key: 'payment', label: 'Pagamento' },
  { key: 'review', label: 'Confirmar' },
] as const

export function SaleForm({ open, onOpenChange, defaultClientId }: SaleFormProps) {
  const { toast } = useToast()
  const { data: productsData } = useProducts({ limit: 500 })
  const { data: clientsData } = useClients({ limit: 200 })
  const { data: settings } = useSettings()
  const createSale = useCreateSale()
  const addItemsToSale = useAddItemsToSale()
  const createProduct = useCreateProduct()
  const createClient = useCreateClient()

  const [items, setItems] = useState<CartItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [clientId, setClientId] = useState<string>(defaultClientId || '')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [productSearch, setProductSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const clientInputRef = useRef<HTMLInputElement>(null)
  const [visibleProductsCount, setVisibleProductsCount] = useState(20)
  const productListRef = useRef<HTMLDivElement>(null)
  const clientDropdownRef = useRef<HTMLDivElement>(null)
  const [highlightedClientIndex, setHighlightedClientIndex] = useState(-1)
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(-1)
  const { recentClientIds, recentProductIds, addRecentClient, addRecentProduct } = useRecentSelections()
  const [isInstallment, setIsInstallment] = useState(false)
  const [paymentDay, setPaymentDay] = useState<number>(new Date().getDate()) // Default to current day of month
  const [installmentPlan, setInstallmentPlan] = useState<number | ''>('')
  const [isFiadoMode, setIsFiadoMode] = useState(false) // Toggle between fiado and normal payment modes
  const [fixedInstallmentAmount, setFixedInstallmentAmount] = useState<number | null>(null) // Fixed amount for each payment
  const [startMonth, setStartMonth] = useState<number | null>(null) // 1-12, null = auto
  const [startYear, setStartYear] = useState<number | null>(null)
  const [existingMode, setExistingMode] = useState<'increase_installments' | 'increase_value' | 'increase_value_from_installment' | 'recalculate'>('recalculate')
  const [startFromInstallment, setStartFromInstallment] = useState<number | null>(null)
  const [targetInstallmentAmount, setTargetInstallmentAmount] = useState<number | null>(null)
  const [targetInstallmentCount, setTargetInstallmentCount] = useState<number | null>(null)
  const [lastEditedField, setLastEditedField] = useState<'value' | 'count' | null>(null)

  // Backorder confirmation
  const [showBackorderConfirm, setShowBackorderConfirm] = useState(false)

  // Quick product (item avulso)
  const [showQuickProduct, setShowQuickProduct] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPrice, setQuickPrice] = useState<number | ''>('')
  const [quickCost, setQuickCost] = useState<number | ''>(0)
  const [quickProductType, setQuickProductType] = useState<'encomenda' | 'fora_estoque'>('encomenda')

  // Quick client (cadastro rápido)
  const [showQuickClient, setShowQuickClient] = useState(false)
  const [quickClientName, setQuickClientName] = useState('')
  const [quickClientPhone, setQuickClientPhone] = useState('')
  const [quickClientAddress, setQuickClientAddress] = useState('')

  // Validation errors (visual feedback)
  const [validationErrors, setValidationErrors] = useState<{
    products?: string
    client?: string
    payment?: string
    prices?: string
  }>({})
  const [shakeKey, setShakeKey] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [receiptData, setReceiptData] = useState<SaleReceiptData | null>(null)

  // Multiple purchases feature - add to existing account
  const [saleMode, setSaleMode] = useState<'new' | 'existing'>('new')
  const [selectedPendingSaleId, setSelectedPendingSaleId] = useState<string>('')
  const [existingInstallmentAmount, setExistingInstallmentAmount] = useState<number | null>(null)

  // Fetch pending sales for the selected client
  const { data: pendingSalesData } = useClientPendingSales(clientId || null)
  const pendingSales = pendingSalesData?.pendingSales || []

  const products = useMemo(() => productsData?.data || [], [productsData?.data])
  const clients = useMemo(() => clientsData?.data || [], [clientsData?.data])

  useEffect(() => {
    if (open && defaultClientId) {
      setClientId(defaultClientId)
      const client = clients.find((c) => c.id === defaultClientId)
      if (client) {
        setClientSearch(client.name)
      }
    }
  }, [open, defaultClientId, clients])

  // Reset sale mode when client changes
  useEffect(() => {
    setSaleMode('new')
    setSelectedPendingSaleId('')
  }, [clientId])

  // Auto-clear validation errors when conditions are resolved
  useEffect(() => {
    if (items.length > 0 && validationErrors.products) {
      setValidationErrors((prev) => { const { products: _products, ...rest } = prev; return rest })
    }
  }, [items.length, validationErrors.products])
  useEffect(() => {
    if (clientId && validationErrors.client) {
      setValidationErrors((prev) => { const { client: _client, ...rest } = prev; return rest })
    }
  }, [clientId, validationErrors.client])
  useEffect(() => {
    if (payments.length > 0 && validationErrors.payment) {
      setValidationErrors((prev) => { const { payment: _payment, ...rest } = prev; return rest })
    }
  }, [payments.length, validationErrors.payment])
  useEffect(() => {
    if (!items.some((i) => !i.unitPrice || i.unitPrice <= 0) && validationErrors.prices) {
      setValidationErrors((prev) => { const { prices: _prices, ...rest } = prev; return rest })
    }
  }, [items, validationErrors.prices])


  const debouncedProductSearch = useDebounce(productSearch, 200)
  const { data: serverSearchData } = useProductsOnDemand(debouncedProductSearch, debouncedProductSearch.length >= 2)

  // Sort products: in-stock first, then out-of-stock
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (a.stock > 0 && b.stock <= 0) return -1
      if (a.stock <= 0 && b.stock > 0) return 1
      return 0
    })
  }, [products])

  // Fuse.js instance for products
  const productFuse = useMemo(() => {
    return new Fuse(sortedProducts, {
      keys: [
        { name: 'name', weight: 3 },
        { name: 'code', weight: 2 },
        { name: 'brand.name', weight: 0.5 },
        { name: 'category.name', weight: 0.3 },
      ],
      threshold: 0.2,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })
  }, [sortedProducts])

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return sortedProducts

    const search = productSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    // Client-side Fuse.js search on loaded products
    const localResults = productFuse.search(productSearch, { limit: 100 })

    // Merge server-side results (covers products beyond the loaded limit)
    const serverResults = serverSearchData?.data || []
    const localIds = new Set(localResults.map((r) => r.item.id))
    const extra = serverResults.filter((p) => !localIds.has(p.id))

    // Combine and sort by relevance
    const allResults = [
      ...localResults.map((r) => ({ product: r.item, score: r.score || 1 })),
      ...extra.map((p) => ({ product: p, score: 1 }))
    ]

    // Custom sorting by relevance
    return allResults.sort((a, b) => {
      const aName = a.product.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const bName = b.product.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const aCode = (a.product.code || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const bCode = (b.product.code || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      // 1. Exact match (name or code)
      const aExact = aName === search || aCode === search ? 1 : 0
      const bExact = bName === search || bCode === search ? 1 : 0
      if (aExact !== bExact) return bExact - aExact

      // 2. Starts with (name or code)
      const aStarts = aName.startsWith(search) || aCode.startsWith(search) ? 1 : 0
      const bStarts = bName.startsWith(search) || bCode.startsWith(search) ? 1 : 0
      if (aStarts !== bStarts) return bStarts - aStarts

      // 3. Contains in name
      const aContains = aName.includes(search) ? 1 : 0
      const bContains = bName.includes(search) ? 1 : 0
      if (aContains !== bContains) return bContains - aContains

      // 4. Fuse.js score (lower is better)
      return (a.score || 1) - (b.score || 1)
    }).map(({ product }) => product)
  }, [sortedProducts, productSearch, productFuse, serverSearchData])

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
    if (productListRef.current) {
      productListRef.current.scrollTop = 0
    }
  }, [productSearch])

  const selectedClient = clients.find((c) => c.id === clientId)

  // Fuse.js instance for clients
  const clientFuse = useMemo(() => {
    return new Fuse(clients, {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'phone', weight: 1 },
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 1,
    })
  }, [clients])

  // Filtered clients for autocomplete
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients
    return clientFuse.search(clientSearch, { limit: 50 }).map((r) => r.item)
  }, [clients, clientSearch, clientFuse])

  // Recent clients resolved from IDs
  const recentClients = useMemo(() => {
    if (clientSearch.trim()) return []
    return recentClientIds
      .map((id) => clients.find((c) => c.id === id))
      .filter(Boolean) as typeof clients
  }, [recentClientIds, clients, clientSearch])

  // Recent products resolved from IDs
  const recentProducts = useMemo(() => {
    if (productSearch.trim()) return []
    return recentProductIds
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean) as typeof products
  }, [recentProductIds, products, productSearch])

  // Reset highlighted index when filtered lists change
  useEffect(() => { setHighlightedClientIndex(-1) }, [filteredClients])
  useEffect(() => { setHighlightedProductIndex(-1) }, [filteredProducts])

  // Word completions (autocomplete suggestions)
  const removeAccentsSimple = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const productCompletions = useMemo(() => {
    const search = productSearch.trim()
    if (!search) return []
    const lastWord = search.split(/\s+/).pop() || ''
    if (lastWord.length < 2) return []
    const normalizedLast = removeAccentsSimple(lastWord.toLowerCase())

    // Build vocabulary from product names
    const wordCounts = new Map<string, number>()
    for (const p of products) {
      const words = p.name.split(/[\s\-–]+/)
      for (const w of words) {
        if (w.length < 3) continue
        const normalized = removeAccentsSimple(w.toLowerCase())
        if (normalized.startsWith(normalizedLast) && normalized !== normalizedLast) {
          wordCounts.set(w.toLowerCase(), (wordCounts.get(w.toLowerCase()) || 0) + 1)
        }
      }
    }

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word)
  }, [productSearch, products])

  const clientCompletions = useMemo(() => {
    const search = clientSearch.trim()
    if (!search) return []
    const lastWord = search.split(/\s+/).pop() || ''
    if (lastWord.length < 2) return []
    const normalizedLast = removeAccentsSimple(lastWord.toLowerCase())

    const wordCounts = new Map<string, number>()
    for (const c of clients) {
      const words = c.name.split(/[\s\-–]+/)
      for (const w of words) {
        if (w.length < 3) continue
        const normalized = removeAccentsSimple(w.toLowerCase())
        if (normalized.startsWith(normalizedLast) && normalized !== normalizedLast) {
          wordCounts.set(w.toLowerCase(), (wordCounts.get(w.toLowerCase()) || 0) + 1)
        }
      }
    }

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word)
  }, [clientSearch, clients])

  const applyCompletion = (currentSearch: string, completion: string): string => {
    const words = currentSearch.trim().split(/\s+/)
    words[words.length - 1] = completion
    return words.join(' ') + ' '
  }

  // Keyboard handler refs (to avoid stale closures with addItem defined later)
  const handleClientKeyDownRef = useRef<(e: React.KeyboardEvent) => void>(() => {})
  handleClientKeyDownRef.current = (e: React.KeyboardEvent) => {
    const maxIndex = Math.min(filteredClients.length, 20) - 1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIsClientDropdownOpen(true)
      setHighlightedClientIndex((prev) => (prev >= maxIndex ? 0 : prev + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedClientIndex((prev) => (prev <= 0 ? maxIndex : prev - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const displayedClients = filteredClients.slice(0, 20)
      if (highlightedClientIndex >= 0 && highlightedClientIndex < displayedClients.length) {
        const client = displayedClients[highlightedClientIndex]
        setClientId(client.id)
        setClientSearch(client.name)
        setIsClientDropdownOpen(false)
        addRecentClient(client.id)
        setHighlightedClientIndex(-1)
      }
    } else if (e.key === 'Escape') {
      setIsClientDropdownOpen(false)
      setHighlightedClientIndex(-1)
    }
  }
  const handleClientKeyDown = useCallback((e: React.KeyboardEvent) => {
    handleClientKeyDownRef.current(e)
  }, [])

  const handleProductKeyDownRef = useRef<(e: React.KeyboardEvent) => void>(() => {})
  handleProductKeyDownRef.current = (e: React.KeyboardEvent) => {
    const maxIndex = visibleProducts.length - 1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedProductIndex((prev) => (prev >= maxIndex ? 0 : prev + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedProductIndex((prev) => (prev <= 0 ? maxIndex : prev - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedProductIndex >= 0 && highlightedProductIndex < visibleProducts.length) {
        addItem(visibleProducts[highlightedProductIndex])
        addRecentProduct(visibleProducts[highlightedProductIndex].id)
        setHighlightedProductIndex(-1)
      }
    } else if (e.key === 'Escape') {
      setProductSearch('')
      setHighlightedProductIndex(-1)
    }
  }
  const handleProductKeyDown = useCallback((e: React.KeyboardEvent) => {
    handleProductKeyDownRef.current(e)
  }, [])

  // Scroll highlighted items into view
  useEffect(() => {
    if (highlightedClientIndex >= 0 && clientDropdownRef.current) {
      const items = clientDropdownRef.current.querySelectorAll('button')
      items[highlightedClientIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedClientIndex])

  useEffect(() => {
    if (highlightedProductIndex >= 0 && productListRef.current) {
      const items = productListRef.current.querySelectorAll('button')
      items[highlightedProductIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedProductIndex])

  // Update search text when client is selected
  useEffect(() => {
    if (selectedClient) {
      setClientSearch(selectedClient.name)
    }
  }, [selectedClient])
  const [hasManualDiscount, setHasManualDiscount] = useState(false)
  const effectiveDiscount = hasManualDiscount
    ? discountPercent
    : Number(selectedClient?.discount || 0)

  const subtotalOriginal = useMemo(() => items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0), [items])
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.totalPrice, 0), [items])
  const promoAmount = subtotalOriginal - subtotal
  const hasCustomTotal = items.some((item) => item.unitPrice !== item.originalPrice)

  const discountAmount = subtotal * (effectiveDiscount / 100)
  const total = subtotal - discountAmount

  const updateTotalAndRedistribute = (newTotal: number) => {
    if (items.length === 0 || newTotal < 0.01) return
    // The newTotal is post-discount, so we need to find the pre-discount subtotal
    const targetSubtotal = effectiveDiscount > 0 ? newTotal / (1 - effectiveDiscount / 100) : newTotal
    // Redistribute proportionally based on each item's original weight
    const currentOriginalSubtotal = items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0)
    if (currentOriginalSubtotal === 0) return
    setItems(
      items.map((item) => {
        const weight = (item.originalPrice * item.quantity) / currentOriginalSubtotal
        const newItemTotal = targetSubtotal * weight
        const newUnitPrice = Math.round((newItemTotal / item.quantity) * 100) / 100
        return {
          ...item,
          unitPrice: newUnitPrice,
          totalPrice: newUnitPrice * item.quantity,
        }
      })
    )
  }

  const restoreOriginalPrices = () => {
    setItems(
      items.map((item) => ({
        ...item,
        unitPrice: item.originalPrice,
        totalPrice: item.originalPrice * item.quantity,
      }))
    )
  }

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = total - totalPayments

  const addItem = (product: Product) => {
    const existing = items.find((i) => i.product.id === product.id)
    const originalPrice = Number(product.salePrice)

    if (existing) {
      // For in-stock items, limit to stock. For backorder items, allow unlimited.
      const canAdd = product.stock <= 0 || existing.quantity < product.stock
      if (canAdd) {
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
      // Notify user when adding a backorder item
      if (product.stock <= 0) {
        toast({
          title: `📦 Encomenda: ${product.name}`,
          description: 'Este produto está sem estoque e será registrado como encomenda.',
        })
      }
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
          // For in-stock items, limit to stock. For backorder items (stock=0), allow unlimited.
          if (item.product.stock > 0 && newQty > item.product.stock) return item
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
        const unitPrice = Math.max(0.01, newPrice)
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

  const backorderItems = useMemo(
    () => items.filter((i) => i.product.stock <= 0 || i.quantity > i.product.stock),
    [items]
  )

  const triggerValidationError = (errors: typeof validationErrors) => {
    setValidationErrors(errors)
    setShakeKey((k) => k + 1)
  }

  const handleSubmit = async () => {
    if (items.length === 0) {
      triggerValidationError({ products: 'Adicione pelo menos um produto' })
      toast({ title: 'Adicione pelo menos um produto', variant: 'destructive' })
      return
    }

    if (!clientId) {
      triggerValidationError({ client: 'Selecione um cliente' })
      toast({ title: 'Adicione um cliente a venda ou crie um cliente', variant: 'destructive' })
      setCurrentStep(1)
      return
    }

    // If there are backorder items and user hasn't confirmed yet, show confirmation dialog
    if (backorderItems.length > 0 && !showBackorderConfirm) {
      setShowBackorderConfirm(true)
      return
    }
    setShowBackorderConfirm(false)

    // Adding to existing sale
    if (saleMode === 'existing' && selectedPendingSaleId) {
      try {
        const result = await addItemsToSale.mutateAsync({
          saleId: selectedPendingSaleId,
          data: {
            items: items.map((i) => ({
              productId: i.product.id,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
            fixedInstallmentAmount: existingMode === 'increase_installments' ? (targetInstallmentAmount || existingInstallmentAmount || undefined) : (existingInstallmentAmount || undefined),
            mode: existingMode,
            startFromInstallment: existingMode === 'recalculate' ? startFromInstallment : undefined,
            targetInstallmentAmount: existingMode === 'recalculate' ? targetInstallmentAmount : undefined,
            targetInstallmentCount: existingMode === 'recalculate' ? targetInstallmentCount : undefined,
          },
        })

        const updatedSale = result.sale
        const serverAddedTotal = result.addedItemsTotal
        const newTotal = Number(updatedSale.total || 0)
        const saleWithRecv = updatedSale as typeof updatedSale & { receivables?: { status: string; amount: number; dueDate: string; installment: number }[] }
        const pendingRecv = (saleWithRecv.receivables || []).filter(
          (r) => r.status === 'PENDING' || r.status === 'PARTIAL'
        )
        const selectedPending = pendingSales.find((s) => s.id === selectedPendingSaleId)
        const previousTotal = selectedPending ? Number(selectedPending.total) : 0

        const existingPromoSavings = items.reduce((sum, i) => sum + (i.originalPrice - i.unitPrice) * i.quantity, 0)
        const existingDiscountAmt = Number(updatedSale.discountAmount || 0)

        setReceiptData({
          type: 'existing_fiado',
          date: new Date(),
          clientName: selectedClient?.name,
          clientPhone: selectedClient?.phone || undefined,
          items: items.map((i) => ({
            name: i.product.name,
            quantity: i.quantity,
            originalPrice: i.originalPrice,
            unitPrice: i.unitPrice,
            total: i.totalPrice,
          })),
          subtotalOriginal: items.reduce((sum, i) => sum + i.originalPrice * i.quantity, 0),
          subtotal: subtotal,
          promoSavings: existingPromoSavings,
          discountPercent: Number(updatedSale.discountPercent || 0),
          discountAmount: existingDiscountAmt,
          totalSavings: existingPromoSavings + existingDiscountAmt,
          total: newTotal,
          payments: [],
          paidAmount: Number(updatedSale.paidAmount || 0),
          remaining: newTotal - Number(updatedSale.paidAmount || 0),
          installments: pendingRecv.map((r) => ({
            number: r.installment,
            amount: Number(r.amount),
            dueDate: new Date(r.dueDate),
          })),
          previousTotal,
          addedItemsTotal: serverAddedTotal || (newTotal - previousTotal),
          existingMode: existingMode,
          paymentDay: Number(updatedSale.paymentDay) || undefined,
        })
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

    // Collect all validation errors at once
    const errors: typeof validationErrors = {}

    // For fiado sales (fiado mode or partial payment), require a client
    if (isFiado && !clientId) {
      errors.client = 'Selecione um cliente para venda fiado'
    }

    // For normal mode (not fiado), require at least one payment that covers the total
    if (!isFiadoMode && payments.length === 0 && total > 0) {
      errors.payment = 'Adicione pelo menos um pagamento ou ative o modo fiado'
    }

    // Validate item prices
    const invalidItems = items.filter((i) => !i.unitPrice || i.unitPrice <= 0)
    if (invalidItems.length > 0) {
      errors.prices = `"${invalidItems[0].product.name}" está com preço zerado`
    }

    if (Object.keys(errors).length > 0) {
      triggerValidationError(errors)
      // Show toast for the first error
      const firstError = Object.values(errors)[0]
      toast({ title: 'Falta informação para finalizar', description: firstError, variant: 'destructive' })
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
        installmentPlan: isInstallment ? (installmentPlan || 1) : 1,
        fixedInstallmentAmount:
          isFiadoMode && fixedInstallmentAmount ? fixedInstallmentAmount : null,
        startMonth: isInstallment && startMonth ? startMonth : null,
        startYear: isInstallment && startYear ? startYear : null,
      })

      const receiptInstallments: SaleReceiptData['installments'] = []
      if (isFiado) {
        const remainingAmount = remaining
        const numInstallments = isInstallment && installmentPlan ? installmentPlan : 1
        const installmentAmount = Math.floor((remainingAmount / numInstallments) * 100) / 100
        const day = isInstallment ? paymentDay : DEFAULT_PAYMENT_DAY
        const now = new Date()
        const hasCustomStart = isInstallment && startMonth && startYear

        const skipCurrentMonth = !hasCustomStart && now.getDate() >= day
        for (let i = 0; i < numInstallments; i++) {
          let targetMonth: number
          let targetYear: number

          if (hasCustomStart) {
            targetMonth = (startMonth - 1) + i
            targetYear = startYear
          } else {
            targetMonth = now.getMonth() + i + (skipCurrentMonth ? 1 : 0)
            targetYear = now.getFullYear()
          }

          while (targetMonth > 11) {
            targetMonth -= 12
            targetYear += 1
          }

          const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
          const dueDate = new Date(targetYear, targetMonth, Math.min(day, lastDayOfMonth))

          const isLast = i === numInstallments - 1
          const thisAmount = isLast
            ? Math.max(0.01, remainingAmount - installmentAmount * (numInstallments - 1))
            : installmentAmount

          receiptInstallments.push({
            number: i + 1,
            amount: Number(thisAmount.toFixed(2)),
            dueDate,
          })
        }
      }

      setReceiptData({
        type: isFiado ? 'new_fiado' : 'paid',
        date: new Date(),
        clientName: selectedClient?.name,
        clientPhone: selectedClient?.phone || undefined,
        items: items.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          originalPrice: i.originalPrice,
          unitPrice: i.unitPrice,
          total: i.totalPrice,
        })),
        subtotalOriginal,
        subtotal,
        promoSavings: promoAmount,
        discountPercent: effectiveDiscount,
        discountAmount,
        totalSavings: promoAmount + discountAmount,
        total,
        payments: validPayments.map((p) => ({
          method: p.method,
          amount: p.amount,
        })),
        paidAmount: validPayments.reduce((sum, p) => sum + p.amount, 0),
        remaining: isFiado ? remaining : 0,
        installmentPlan: isInstallment ? (installmentPlan || 1) : undefined,
        paymentDay: isInstallment ? paymentDay : undefined,
        installments: receiptInstallments,
      })
    } catch (error: unknown) {
      console.error('[SaleForm] Erro ao criar venda:', error)
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
    setClientSearch('')
    setDiscountPercent(0)
    setHasManualDiscount(false)
    setIsInstallment(false)
    setPaymentDay(new Date().getDate())
    setInstallmentPlan('')
    setIsFiadoMode(false)
    setFixedInstallmentAmount(null)
    setShowBackorderConfirm(false)
    setShowQuickProduct(false)
    setQuickName('')
    setQuickPrice('')
    setQuickCost(0)
    setQuickProductType('encomenda')
    setSaleMode('new')
    setSelectedPendingSaleId('')
    setExistingInstallmentAmount(null)
    setStartMonth(null)
    setStartYear(null)
    setExistingMode('recalculate')
    setStartFromInstallment(null)
    setTargetInstallmentAmount(null)
    setTargetInstallmentCount(null)
    setLastEditedField(null)
    setShowQuickClient(false)
    setQuickClientName('')
    setQuickClientPhone('')
    setQuickClientAddress('')
    setValidationErrors({})
    setCurrentStep(0)
    setReceiptData(null)
  }

  const handleQuickClient= async () => {
    if (!quickClientName.trim()) {
      toast({ title: 'Preencha o nome do cliente', variant: 'destructive' })
      return
    }

    try {
      const newClient = await createClient.mutateAsync({
        name: quickClientName.trim(),
        phone: quickClientPhone.trim() || null,
        address: quickClientAddress.trim() || null,
        discount: 0,
      })

      setClientId(newClient.id)
      setClientSearch(newClient.name)
      setIsClientDropdownOpen(false)
      addRecentClient(newClient.id)
      toast({
        title: `Cliente "${newClient.name}" cadastrado!`,
        description: 'Selecionado automaticamente para esta venda.',
      })

      setShowQuickClient(false)
      setQuickClientName('')
      setQuickClientPhone('')
      setQuickClientAddress('')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao cadastrar cliente'
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' })
    }
  }

  const handleQuickProduct = async () => {
    if (!quickName.trim() || !quickPrice || quickPrice <= 0) {
      toast({ title: 'Preencha nome e preço de venda', variant: 'destructive' })
      return
    }

    try {
      const costPrice = Number(quickCost) || 0
      const salePrice = Number(quickPrice)
      const profitMargin = costPrice > 0 ? ((salePrice - costPrice) / costPrice) * 100 : 100

      const newProduct = await createProduct.mutateAsync({
        name: quickName.trim(),
        costPrice,
        profitMargin: Math.round(profitMargin * 100) / 100,
        stock: 0,
        minStock: 1,
      })

      addItem(newProduct as Product)
      toast({
        title: `Produto "${quickName.trim()}" criado e adicionado!`,
        description: quickProductType === 'encomenda'
          ? 'Registrado como encomenda. Aparecerá no estoque como item a comprar.'
          : 'Registrado como fora de estoque. Aparecerá no estoque como item a comprar.',
      })

      setShowQuickProduct(false)
      setQuickName('')
      setQuickPrice('')
      setQuickCost(0)
      setQuickProductType('encomenda')

      setCurrentStep(1)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar produto'
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' })
    }
  }

  const canAdvanceStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return items.length > 0
      case 1:
        return !!clientId
      default:
        return true
    }
  }

  const handleNextStep = () => {
    if (currentStep === 0 && items.length === 0) {
      triggerValidationError({ products: 'Adicione pelo menos um produto' })
      toast({ title: 'Adicione pelo menos um produto', variant: 'destructive' })
      return
    }
    if (currentStep === 1 && !clientId) {
      triggerValidationError({ client: 'Selecione um cliente' })
      toast({ title: 'Adicione um cliente a venda ou crie um cliente', variant: 'destructive' })
      return
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const contextValue = useMemo(() => ({
    items, setItems,
    payments, setPayments,
    clientId, setClientId,
    discountPercent, setDiscountPercent,
    hasManualDiscount, setHasManualDiscount,
    productSearch, setProductSearch,
    clientSearch, setClientSearch,
    isClientDropdownOpen, setIsClientDropdownOpen,
    clientInputRef,
    productListRef,
    clientDropdownRef,
    highlightedClientIndex, setHighlightedClientIndex,
    highlightedProductIndex,
    isInstallment, setIsInstallment,
    paymentDay, setPaymentDay,
    installmentPlan, setInstallmentPlan,
    isFiadoMode, setIsFiadoMode,
    fixedInstallmentAmount, setFixedInstallmentAmount,
    startMonth, setStartMonth,
    startYear, setStartYear,
    existingMode, setExistingMode,
    startFromInstallment, setStartFromInstallment,
    targetInstallmentAmount, setTargetInstallmentAmount,
    targetInstallmentCount, setTargetInstallmentCount,
    lastEditedField, setLastEditedField,
    showQuickProduct, setShowQuickProduct,
    quickName, setQuickName,
    quickPrice, setQuickPrice,
    quickCost, setQuickCost,
    quickProductType, setQuickProductType,
    showQuickClient, setShowQuickClient,
    quickClientName, setQuickClientName,
    quickClientPhone, setQuickClientPhone,
    quickClientAddress, setQuickClientAddress,
    validationErrors, shakeKey,
    saleMode, setSaleMode,
    selectedPendingSaleId, setSelectedPendingSaleId,
    existingInstallmentAmount, setExistingInstallmentAmount,
    pendingSales,
    products, clients, selectedClient,
    sortedProducts, filteredProducts, visibleProducts, hasMoreProducts,
    filteredClients, recentClients, recentProducts,
    productCompletions, clientCompletions,
    effectiveDiscount, subtotalOriginal, subtotal, promoAmount, hasCustomTotal,
    discountAmount, total, totalPayments, remaining, isFiado, backorderItems,
    addItem, updateQuantity, removeItem, updateItemPrice,
    addPayment, updatePayment, removePayment,
    handleSubmit, handleQuickClient, handleQuickProduct,
    handleProductListScroll, handleClientKeyDown, handleProductKeyDown,
    applyCompletion, updateTotalAndRedistribute, restoreOriginalPrices,
    triggerValidationError, addRecentClient, addRecentProduct,
    createProductPending: createProduct.isPending,
    createClientPending: createClient.isPending,
    createSalePending: createSale.isPending,
    addItemsToSalePending: addItemsToSale.isPending,
    settings: settings as { defaultFeeAbsorber?: string; debitFeePercent?: number; creditFeePercent?: number; creditInstallmentFee?: number } | null | undefined,
  }), [
    items, payments, clientId, discountPercent, hasManualDiscount,
    productSearch, clientSearch, isClientDropdownOpen,
    highlightedClientIndex, highlightedProductIndex,
    isInstallment, paymentDay, installmentPlan, isFiadoMode,
    fixedInstallmentAmount, startMonth, startYear,
    existingMode, startFromInstallment, targetInstallmentAmount,
    targetInstallmentCount, lastEditedField,
    showQuickProduct, quickName, quickPrice, quickCost, quickProductType,
    showQuickClient, quickClientName, quickClientPhone, quickClientAddress,
    validationErrors, shakeKey,
    saleMode, selectedPendingSaleId, existingInstallmentAmount,
    pendingSales, products, clients, selectedClient,
    sortedProducts, filteredProducts, visibleProducts, hasMoreProducts,
    filteredClients, recentClients, recentProducts,
    productCompletions, clientCompletions,
    effectiveDiscount, subtotalOriginal, subtotal, promoAmount, hasCustomTotal,
    discountAmount, total, totalPayments, remaining, isFiado, backorderItems,
    createProduct.isPending, createClient.isPending,
    createSale.isPending, addItemsToSale.isPending,
    settings,
    addItem, updateQuantity, removeItem, updateItemPrice,
    addPayment, updatePayment, removePayment,
    handleSubmit, handleQuickClient, handleQuickProduct,
    handleProductListScroll, handleClientKeyDown, handleProductKeyDown,
    applyCompletion, updateTotalAndRedistribute, restoreOriginalPrices,
    triggerValidationError, addRecentClient, addRecentProduct,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-[98vw] max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300", currentStep === 0 ? 'md:max-w-4xl lg:max-w-5xl' : 'md:max-w-2xl lg:max-w-3xl')}>
        {receiptData ? (
          <SaleReceipt
            data={receiptData}
            onClose={() => {
              resetForm()
              onOpenChange(false)
            }}
            onNewSale={() => {
              resetForm()
            }}
          />
        ) : (
        <>
        <DialogHeader className="shrink-0 pb-0">
          <DialogTitle className="text-lg">Nova Venda</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-1 py-3 border-b shrink-0">
          {STEPS.map(({ key, label }, index) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (index < currentStep) setCurrentStep(index)
                else if (index === currentStep + 1 && canAdvanceStep(currentStep)) handleNextStep()
              }}
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 transition-all duration-200',
                currentStep === index
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : currentStep > index
                    ? 'bg-primary/15 text-primary cursor-pointer hover:bg-primary/25'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold leading-none">
                {currentStep > index ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <SaleFormProvider value={contextValue}>
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 py-4">
            <div className={cn('mx-auto px-1', currentStep === 0 ? 'max-w-full' : 'max-w-xl')}>
              {currentStep === 0 && <StepCart />}
              {currentStep === 1 && <StepClient />}
              {currentStep === 2 && <StepPayment />}
              {currentStep === 3 && <StepReview />}
            </div>
          </div>
        </SaleFormProvider>

        <div className="border-t pt-3 shrink-0 bg-background">
          <div className="flex items-center justify-between gap-3">
            {currentStep > 0 ? (
              <Button variant="outline" onClick={handlePrevStep} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {items.length > 0 && (
                <span className="bg-primary/10 text-primary font-medium px-2 py-1 rounded-full">
                  {items.reduce((sum, item) => sum + item.quantity, 0)} itens
                </span>
              )}
              {total > 0 && (
                <span className="font-semibold text-sm">{formatCurrency(total)}</span>
              )}
            </div>

            {currentStep < STEPS.length - 1 ? (
              <Button onClick={handleNextStep} className="gap-1 min-w-[120px]">
                Proximo <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <div />
            )}
          </div>
        </div>
        </>
        )}
      </DialogContent>

      <Dialog open={showBackorderConfirm} onOpenChange={setShowBackorderConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <DialogTitle>Itens sem estoque</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {backorderItems.length === 1
                ? 'O seguinte item esta sem estoque e sera registrado como encomenda:'
                : `Os seguintes ${backorderItems.length} itens estao sem estoque e serao registrados como encomenda:`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {backorderItems.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2"
              >
                <span className="font-medium">{item.product.name}</span>
                <span className="text-amber-700 dark:text-amber-400 font-semibold">{item.quantity} un.</span>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowBackorderConfirm(false)}>
              Voltar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white"
              onClick={handleSubmit}
            >
              <Package className="h-4 w-4 mr-2" />
              Confirmar Encomenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
