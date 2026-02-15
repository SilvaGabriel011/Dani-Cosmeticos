'use client'

import { Plus, Minus, Trash2, Search, Loader2, Wallet, Handshake, ShoppingCart, Package, AlertTriangle, Pencil, UserPlus, CalendarDays, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useClients, useCreateClient } from '@/hooks/use-clients'
import { useDebounce } from '@/hooks/use-debounce'
import { useProducts, useProductsOnDemand, useCreateProduct } from '@/hooks/use-products'
import { useRecentSelections } from '@/hooks/use-recent-selections'
import { useCreateSale, useClientPendingSales, useAddItemsToSale } from '@/hooks/use-sales'
import { useSettings } from '@/hooks/use-settings'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import Fuse from 'fuse.js'
import { cn, formatCurrency } from '@/lib/utils'
import { type Product } from '@/types'
import { SaleReceipt, type SaleReceiptData } from './sale-receipt'
import { DEFAULT_PAYMENT_DAY } from '@/lib/constants'

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
  const [existingMode, setExistingMode] = useState<'increase_installments' | 'increase_value'>('increase_installments')

  // Backorder confirmation
  const [showBackorderConfirm, setShowBackorderConfirm] = useState(false)

  // Quick product (item avulso)
  const [showQuickProduct, setShowQuickProduct] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPrice, setQuickPrice] = useState<number | ''>('')
  const [quickCost, setQuickCost] = useState<number | ''>(0)

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
  const [mobileStep, setMobileStep] = useState(1)
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
            fixedInstallmentAmount: existingInstallmentAmount || undefined,
            mode: existingMode,
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

        for (let i = 0; i < numInstallments; i++) {
          let targetMonth: number
          let targetYear: number

          if (hasCustomStart) {
            targetMonth = (startMonth - 1) + i
            targetYear = startYear
          } else {
            targetMonth = now.getMonth() + i
            targetYear = now.getFullYear()
            if (i === 0 && now.getDate() >= day) {
              targetMonth += 1
            }
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
    setSaleMode('new')
    setSelectedPendingSaleId('')
    setExistingInstallmentAmount(null)
    setStartMonth(null)
    setStartYear(null)
    setExistingMode('increase_installments')
    setShowQuickClient(false)
    setQuickClientName('')
    setQuickClientPhone('')
    setQuickClientAddress('')
    setValidationErrors({})
    setMobileStep(1)
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
        description: 'Aparecerá no estoque como item a comprar.',
      })

      setShowQuickProduct(false)
      setQuickName('')
      setQuickPrice('')
      setQuickCost(0)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar produto'
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] md:max-w-5xl lg:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
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
        <DialogHeader className="shrink-0">
          <DialogTitle>Nova Venda - Carrinho</DialogTitle>
        </DialogHeader>

        {/* Mobile Step Indicator */}
        <div className="md:hidden flex items-center justify-center gap-1 py-2.5 border-b shrink-0">
          {[
            { step: 1, label: 'Produtos' },
            { step: 2, label: 'Cliente' },
            { step: 3, label: 'Pagamento' },
          ].map(({ step, label }) => (
            <button
              key={step}
              type="button"
              onClick={() => { if (step < mobileStep) setMobileStep(step) }}
              className={cn(
                'flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 transition-colors',
                mobileStep === step
                  ? 'bg-primary text-primary-foreground'
                  : mobileStep > step
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none">
                {mobileStep > step ? <Check className="h-3 w-3" /> : step}
              </span>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {/* Products Section */}
          <div className={cn('space-y-4', mobileStep !== 1 && 'hidden md:block')}>
            <Card key={`products-${shakeKey}`} className={`transition-all duration-300 ${validationErrors.products ? 'border-2 border-red-400 shadow-sm shadow-red-100 dark:shadow-red-900/30 animate-shake' : items.length > 0 ? 'border-2 border-green-400 shadow-sm shadow-green-100 dark:shadow-green-900/30' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Produtos</span>
                  <div className="flex items-center gap-2">
                    {items.length > 0 && (
                      <span className="bg-primary text-primary-foreground text-sm px-2 py-1 rounded-full">
                        {items.reduce((sum, item) => sum + item.quantity, 0)} itens
                      </span>
                    )}
                    {products.length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {products.filter((p) => p.stock > 0).length} disponíveis
                      </span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={handleProductKeyDown}
                    className="pl-9 h-11 text-base"
                  />
                </div>

                {productCompletions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {productCompletions.map((word) => (
                      <button
                        key={word}
                        type="button"
                        className="text-sm bg-muted hover:bg-muted/80 text-muted-foreground rounded-full px-3 py-1.5 min-h-[36px] transition-colors"
                        onClick={() => setProductSearch(applyCompletion(productSearch, word))}
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                )}

                {validationErrors.products && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {validationErrors.products}
                  </div>
                )}

                {(productSearch || filteredProducts.length > 0) && (
                  <div
                    ref={productListRef}
                    className="max-h-60 md:max-h-[50vh] overflow-y-auto border rounded-md"
                    onScroll={handleProductListScroll}
                  >
                    {/* Recent products section */}
                    {!productSearch.trim() && recentProducts.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/50">
                          Recentes
                        </div>
                        {recentProducts.map((product) => (
                          <button
                            key={`recent-${product.id}`}
                            className="w-full px-3 py-3 text-left text-sm flex justify-between items-center min-h-[44px] hover:bg-primary/10 focus:outline-none active:bg-primary/20"
                            onClick={() => { addItem(product); addRecentProduct(product.id) }}
                          >
                            <span className="font-medium">{product.name}</span>
                            <span className="flex items-center gap-2">
                              {product.stock > 0 ? (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                  product.stock <= product.minStock
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                    : product.stock <= product.minStock * 2
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                                      : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                                }`}>
                                  {product.stock} un.
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full">
                                  <Package className="h-2.5 w-2.5" />
                                  Enc.
                                </span>
                              )}
                              <span className="text-muted-foreground font-semibold">
                                {formatCurrency(Number(product.salePrice))}
                              </span>
                            </span>
                          </button>
                        ))}
                        <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/50">
                          Todos
                        </div>
                      </>
                    )}
                    {filteredProducts.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhum produto encontrado
                      </p>
                    ) : (
                      <>
                        {visibleProducts.map((product, index) => (
                          <button
                            key={product.id}
                            className={`w-full px-3 py-3 text-left text-sm flex justify-between items-center min-h-[44px] transition-all duration-200 hover:pl-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset active:bg-primary/20 active:scale-[0.99] ${
                              index === highlightedProductIndex
                                ? 'bg-primary/10 pl-4'
                                : product.stock <= 0
                                  ? 'bg-amber-50/60 hover:bg-amber-100/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/40'
                                  : 'hover:bg-primary/10'
                            }`}
                            onClick={() => { addItem(product); addRecentProduct(product.id) }}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="font-medium">{product.name}</span>
                              {product.stock <= 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full shrink-0">
                                  <Package className="h-2.5 w-2.5" />
                                  Encomenda
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-2">
                              {product.stock > 0 && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                                  product.stock <= product.minStock
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                    : product.stock <= product.minStock * 2
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                                      : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                                }`}>
                                  {product.stock} un.
                                </span>
                              )}
                              <span className="text-muted-foreground font-semibold">
                                {formatCurrency(Number(product.salePrice))}
                              </span>
                            </span>
                          </button>
                        ))}
                        {hasMoreProducts && (
                          <div className="px-3 py-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Role para carregar mais ({filteredProducts.length - visibleProductsCount} restantes)
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Item Avulso - Quick product creation */}
                {showQuickProduct ? (
                  <div className="border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Package className="h-4 w-4" />
                        Item Avulso
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setShowQuickProduct(false)
                          setQuickName('')
                          setQuickPrice('')
                          setQuickCost(0)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Nome do produto"
                      value={quickName}
                      onChange={(e) => setQuickName(e.target.value)}
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Preço de venda *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0,00"
                          value={quickPrice}
                          onChange={(e) => setQuickPrice(e.target.value ? Number(e.target.value) : '')}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Custo (opcional)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={quickCost}
                          onChange={(e) => setQuickCost(e.target.value ? Number(e.target.value) : '')}
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white"
                      onClick={handleQuickProduct}
                      disabled={createProduct.isPending}
                    >
                      {createProduct.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Criando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Criar e Adicionar
                        </span>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-800 dark:hover:text-amber-300"
                    onClick={() => {
                      setShowQuickProduct(true)
                      if (productSearch.trim() && filteredProducts.length === 0) {
                        setQuickName(productSearch.trim())
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Item Avulso (sem cadastro)
                  </Button>
                )}

                {items.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                      <ShoppingCart className="h-4 w-4" />
                      <span>{items.reduce((sum, item) => sum + item.quantity, 0)} itens no carrinho — edite preços no resumo ao lado</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Client & Summary Section */}
          <div className={cn('space-y-4', mobileStep !== 2 && 'hidden md:block')}>
            <Card key={`client-${shakeKey}`}className={`transition-all duration-300 ${validationErrors.client ? 'border-2 border-red-400 shadow-sm shadow-red-100 dark:shadow-red-900/30 animate-shake' : selectedClient ? 'border-2 border-green-400 shadow-sm shadow-green-100 dark:shadow-green-900/30' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Cliente e Desconto</span>
                  {clients.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {clients.length} clientes
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {validationErrors.client && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {validationErrors.client}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Cliente {isFiado && <span className="text-destructive">*</span>}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={clientInputRef}
                      placeholder={
                        clients.length > 0 ? 'Buscar cliente...' : 'Nenhum cliente cadastrado'
                      }
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value)
                        setClientId('')
                        setIsClientDropdownOpen(true)
                      }}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      onBlur={() => {
                        setTimeout(() => setIsClientDropdownOpen(false), 150)
                      }}
                      onKeyDown={handleClientKeyDown}
                      className="pl-9 h-11 text-base"
                    />
                    {isClientDropdownOpen && !clientId && (
                      <div ref={clientDropdownRef} className="absolute z-50 w-full mt-1 max-h-48 md:max-h-72 overflow-y-auto border rounded-md bg-popover text-popover-foreground shadow-lg">
                        {clientCompletions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b bg-muted/30">
                            {clientCompletions.map((word) => (
                              <button
                                key={word}
                                type="button"
                                className="text-sm bg-background hover:bg-muted text-muted-foreground rounded-full px-3 py-1 border transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  setClientSearch(applyCompletion(clientSearch, word))
                                }}
                              >
                                {word}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Recent clients section */}
                        {!clientSearch.trim() && recentClients.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/50">
                              Recentes
                            </div>
                            {recentClients.map((client) => (
                              <button
                                key={`recent-${client.id}`}
                                type="button"
                                className="w-full px-3 py-3 text-left text-sm min-h-[44px] hover:bg-primary/10 focus:outline-none active:bg-primary/20"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  setClientId(client.id)
                                  setClientSearch(client.name)
                                  setIsClientDropdownOpen(false)
                                  addRecentClient(client.id)
                                }}
                              >
                                {client.name}
                              </button>
                            ))}
                            <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/50">
                              Todos
                            </div>
                          </>
                        )}
                        {filteredClients.length === 0 ? (
                          <div className="px-3 py-2">
                            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                            <button
                              type="button"
                              className="w-full mt-1 px-3 py-2.5 text-left text-sm min-h-[44px] hover:bg-blue-50 dark:hover:bg-blue-950/30 focus:outline-none active:bg-blue-100 dark:active:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-medium flex items-center gap-2 rounded-md"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setShowQuickClient(true)
                                setQuickClientName(clientSearch.trim())
                                setIsClientDropdownOpen(false)
                              }}
                            >
                              <UserPlus className="h-4 w-4" />
                              Cadastrar &ldquo;{clientSearch.trim()}&rdquo;
                            </button>
                          </div>
                        ) : (
                          filteredClients.slice(0, 20).map((client, index) => (
                            <button
                              key={client.id}
                              type="button"
                              className={`w-full px-3 py-3 text-left text-sm min-h-[44px] focus:outline-none active:bg-primary/20 ${
                                index === highlightedClientIndex
                                  ? 'bg-primary/10'
                                  : 'hover:bg-primary/10'
                              }`}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setClientId(client.id)
                                setClientSearch(client.name)
                                setIsClientDropdownOpen(false)
                                addRecentClient(client.id)
                              }}
                            >
                              {client.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick client registration */}
                {showQuickClient ? (
                  <div className="border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                        <UserPlus className="h-4 w-4" />
                        Novo Cliente
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setShowQuickClient(false)
                          setQuickClientName('')
                          setQuickClientPhone('')
                          setQuickClientAddress('')
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Nome do cliente *"
                      value={quickClientName}
                      onChange={(e) => setQuickClientName(e.target.value)}
                      autoFocus
                    />
                    <Input
                      placeholder="Telefone (opcional)"
                      value={quickClientPhone}
                      onChange={(e) => setQuickClientPhone(e.target.value)}
                    />
                    <Input
                      placeholder="Endereço (opcional)"
                      value={quickClientAddress}
                      onChange={(e) => setQuickClientAddress(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
                      onClick={handleQuickClient}
                      disabled={createClient.isPending}
                    >
                      {createClient.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Cadastrando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4" />
                          Cadastrar e Selecionar
                        </span>
                      )}
                    </Button>
                  </div>
                ) : (
                  !clientId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-800 dark:hover:text-blue-300"
                      onClick={() => {
                        setShowQuickClient(true)
                        if (clientSearch.trim()) {
                          setQuickClientName(clientSearch.trim())
                        }
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      Novo Cliente
                    </Button>
                  )
                )}

                {/* Multiple purchases feature - add to existing account */}
                {clientId && pendingSales.length > 0 && (
                  <div className="space-y-3 p-3 border rounded-md border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
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
                        <Label className="text-sm">Selecione a conta</Label>
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
                        {selectedPendingSaleId && (() => {
                          const selectedSale = pendingSales.find((s) => s.id === selectedPendingSaleId)
                          const currentInstallment = selectedSale?.fixedInstallmentAmount || (selectedSale ? selectedSale.total / selectedSale.installmentPlan : 0)
                          const pendingCount = selectedSale?.pendingReceivablesCount || 0

                          // Preview for increase_installments
                          const installmentAmountForPreview = existingInstallmentAmount || currentInstallment
                          const extraInstallments = installmentAmountForPreview > 0 ? Math.ceil(total / installmentAmountForPreview) : 0
                          const lastExtraAmount = installmentAmountForPreview > 0 ? total - (installmentAmountForPreview * (extraInstallments - 1)) : 0

                          // Preview for increase_value
                          const newRemaining = (selectedSale?.remaining || 0) + total
                          const newValuePerInstallment = pendingCount > 0 ? newRemaining / pendingCount : 0

                          return (
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold">Como adicionar à conta?</Label>
                              <RadioGroup
                                value={existingMode}
                                onValueChange={(v) => setExistingMode(v as 'increase_installments' | 'increase_value')}
                                className="space-y-2"
                              >
                                <div className={`flex items-start space-x-2 p-2.5 rounded-md border transition-colors ${existingMode === 'increase_installments' ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}>
                                  <RadioGroupItem value="increase_installments" id="mode-increase-installments" className="mt-0.5" />
                                  <div className="flex-1">
                                    <Label htmlFor="mode-increase-installments" className="cursor-pointer text-sm font-medium">
                                      Aumentar parcelas (manter valor)
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Mantém parcela de {formatCurrency(currentInstallment)}, adiciona {extraInstallments > 0 ? extraInstallments : '?'} parcela(s) no fim
                                    </p>
                                    {existingMode === 'increase_installments' && extraInstallments > 0 && (
                                      <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold mt-1">
                                        +{extraInstallments}x de {formatCurrency(installmentAmountForPreview)}
                                        {lastExtraAmount > 0 && Math.abs(lastExtraAmount - installmentAmountForPreview) > 0.01 && (
                                          <> (última: {formatCurrency(lastExtraAmount)})</>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className={`flex items-start space-x-2 p-2.5 rounded-md border transition-colors ${existingMode === 'increase_value' ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}>
                                  <RadioGroupItem value="increase_value" id="mode-increase-value" className="mt-0.5" />
                                  <div className="flex-1">
                                    <Label htmlFor="mode-increase-value" className="cursor-pointer text-sm font-medium">
                                      Aumentar valor da parcela (manter qtd)
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Mantém {pendingCount} parcela(s), aumenta valor de cada
                                    </p>
                                    {existingMode === 'increase_value' && pendingCount > 0 && (
                                      <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold mt-1">
                                        {pendingCount}x de {formatCurrency(newValuePerInstallment)} (era {formatCurrency(currentInstallment)})
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </RadioGroup>

                              {existingMode === 'increase_installments' && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">Valor da parcela (opcional, alterar)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder={currentInstallment > 0 ? `Atual: ${currentInstallment.toFixed(2)}` : '0,00'}
                                    value={existingInstallmentAmount ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? Number(e.target.value) : null
                                      setExistingInstallmentAmount(val && val > 0 ? val : null)
                                    }}
                                    className="h-9"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })()}
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

            <Card key={`prices-${shakeKey}`} className={`border-2 bg-gradient-to-br from-primary/5 to-transparent transition-all duration-300 ${validationErrors.prices ? 'border-red-400 shadow-sm shadow-red-100 dark:shadow-red-900/30 animate-shake' : items.length > 0 ? 'border-green-400 shadow-sm shadow-green-100 dark:shadow-green-900/30' : 'border-primary/20'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Resumo da Venda
                  </span>
                  {hasCustomTotal && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => restoreOriginalPrices()}
                      className="h-7 px-2 text-xs hover:bg-primary/10 rounded-md"
                      title="Restaurar preços originais"
                    >
                      ↩ Restaurar preços
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {/* Lista de itens do carrinho com preço editável */}
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Carrinho vazio</p>
                    <p className="text-xs opacity-70">Adicione produtos na lista ao lado</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {items.map((item) => (
                      <div
                        key={item.product.id}
                        className={`p-2 border rounded-lg animate-in fade-in duration-200 ${
                          item.unitPrice !== item.originalPrice
                            ? item.unitPrice < item.originalPrice
                              ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20'
                              : 'border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/20'
                            : 'bg-gray-50/50 dark:bg-gray-900/50'
                        }`}
                      >
                        {/* Linha 1: Nome + Remover */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-medium text-sm leading-tight truncate flex-1">{item.product.name}</span>
                          {(item.product.stock <= 0 || item.quantity > item.product.stock) && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded-full shrink-0">
                              <Package className="h-2 w-2" />
                              Enc.
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                            onClick={() => removeItem(item.product.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        {/* Linha 2: Qty + Total */}
                        <div className="flex items-center justify-between gap-2">
                          {/* Quantidade compacta */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 disabled:opacity-40"
                              onClick={() => updateQuantity(item.product.id, -1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center font-bold text-sm tabular-nums">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-600 disabled:opacity-40"
                              onClick={() => updateQuantity(item.product.id, 1)}
                              disabled={item.product.stock > 0 && item.quantity >= item.product.stock}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {/* Total do item */}
                          <span className="text-sm font-bold text-primary shrink-0 min-w-[70px] text-right">
                            {formatCurrency(item.totalPrice)}
                          </span>
                        </div>
                        {/* Bloco de preço editável - mini-card */}
                        <div className={`mt-2 p-2.5 rounded-lg border-2 border-dashed transition-all ${
                          item.unitPrice !== item.originalPrice
                            ? item.unitPrice < item.originalPrice
                              ? 'border-green-400 dark:border-green-600 bg-green-50/60 dark:bg-green-950/30'
                              : 'border-orange-400 dark:border-orange-600 bg-orange-50/60 dark:bg-orange-950/30'
                            : 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/20 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-50/60 dark:hover:bg-red-950/30'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <label className={`text-xs font-semibold flex items-center gap-1 ${
                              item.unitPrice !== item.originalPrice
                                ? item.unitPrice < item.originalPrice ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              <Pencil className="h-3 w-3" />
                              Preço unitário
                            </label>
                            {item.unitPrice !== item.originalPrice && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                item.unitPrice < item.originalPrice
                                  ? 'bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                                  : 'bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300'
                              }`}>
                                {item.unitPrice < item.originalPrice
                                  ? `-${((1 - item.unitPrice / item.originalPrice) * 100).toFixed(0)}%`
                                  : `+${((item.unitPrice / item.originalPrice - 1) * 100).toFixed(0)}%`}
                              </span>
                            )}
                          </div>
                          <div className="relative mt-1.5 group/price">
                            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium ${
                              item.unitPrice !== item.originalPrice
                                ? item.unitPrice < item.originalPrice ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                                : 'text-red-400 dark:text-red-500'
                            }`}>R$</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className={`h-10 pl-9 pr-3 text-right text-base font-bold rounded-md transition-all cursor-pointer border-2 ${
                                item.unitPrice !== item.originalPrice
                                  ? item.unitPrice < item.originalPrice
                                    ? 'border-green-300 dark:border-green-700 bg-background focus:border-green-500 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800'
                                    : 'border-orange-300 dark:border-orange-700 bg-background focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800'
                                  : 'border-red-200 dark:border-red-800 bg-background hover:border-red-300 dark:hover:border-red-700 focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800'
                              }`}
                              value={item.unitPrice}
                              onChange={(e) => updateItemPrice(item.product.id, Number(e.target.value))}
                              title="Altere o preço para aplicar promoção"
                            />
                          </div>
                          {item.unitPrice !== item.originalPrice && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Preço original: {formatCurrency(item.originalPrice)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Totais */}
                {promoAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-600 dark:text-purple-400 font-medium">Promoção:</span>
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">-{formatCurrency(promoAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {effectiveDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 dark:text-green-400 font-medium">Desconto ({effectiveDiscount}%):</span>
                    <span className="text-green-600 dark:text-green-400 font-semibold">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total:</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={total}
                      onChange={(e) => {
                        const value = Number(e.target.value)
                        if (value >= 0) {
                          updateTotalAndRedistribute(value)
                        }
                      }}
                      className="w-36 text-right text-xl font-bold text-primary border-2 border-primary/30 focus:border-primary rounded-lg"
                      step="0.01"
                      min="0"
                      aria-label="Total da venda"
                    />
                  </div>
                </div>
                {(isFiadoMode || remaining > 0) && (
                  <div className="flex justify-between text-sm bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                    <span className="text-amber-700 dark:text-amber-400 font-medium">Restante (Fiado):</span>
                    <span className="text-amber-700 dark:text-amber-400 font-bold">{formatCurrency(isFiadoMode ? total : remaining)}</span>
                  </div>
                )}
                {remaining < 0 && (
                  <div className="flex justify-between text-sm bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-200 dark:border-red-800">
                    <span className="text-red-600 dark:text-red-400 font-medium">Excedente:</span>
                    <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrency(Math.abs(remaining))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Section */}
          <div className={cn('space-y-4', mobileStep !== 3 && 'hidden md:block')}>
            <Card key={`payment-${shakeKey}`}className={`transition-all duration-300 ${validationErrors.payment ? 'border-2 border-red-400 shadow-sm shadow-red-100 dark:shadow-red-900/30 animate-shake' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {validationErrors.payment && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {validationErrors.payment}
                  </div>
                )}

                {/* Resumo do valor */}
                <div className={`p-4 rounded-xl text-center border ${isFiadoMode ? 'bg-gradient-to-br from-amber-100 dark:from-amber-950/40 to-amber-50 dark:to-amber-950/20 border-amber-300 dark:border-amber-700' : 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20'}`}>
                  <p className="text-sm text-muted-foreground font-medium">Total da compra</p>
                  <p className={`text-3xl font-bold mt-1 ${isFiadoMode ? 'text-amber-700 dark:text-amber-400' : 'text-primary'}`}>{formatCurrency(total)}</p>
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
                    className={`h-auto py-4 px-5 justify-start transition-all duration-200 ${isFiadoMode ? 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-background text-white' : 'hover:bg-amber-50 dark:hover:bg-amber-950/30'}`}
                    onClick={() => {
                      setIsFiadoMode(true)
                      setPayments([])
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-full ${isFiadoMode ? 'bg-white/20' : 'bg-muted'}`}>
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
                  <div className="bg-green-50/80 dark:bg-green-950/20 p-4 rounded-xl space-y-3 border border-green-200 dark:border-green-800">
                    <p className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Forma de pagamento:
                    </p>

                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={addPayment}>
                        <Plus className="h-5 w-5 mr-1" />
                        Adicionar Pagamento
                      </Button>
                    </div>
                    {payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Nenhum pagamento adicionado
                      </p>
                    ) : (
                      payments.map((payment, index) => (
                        <div key={index} className="space-y-2 p-3 border rounded-md bg-background">
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
                              <Trash2 className="h-5 w-5 text-destructive" />
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
                            <p className="text-sm text-muted-foreground">
                              Taxa: {payment.feePercent}%
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50/80 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                    <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-2">
                      <Handshake className="h-5 w-5" />
                      Fiado selecionado
                    </p>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                      <strong>{formatCurrency(total)}</strong> será registrado como fiado.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        </div>

        <div className="border-t pt-3 mt-0 shrink-0 bg-background">
          {/* Mobile step navigation (steps 1-2) */}
          <div className={cn('flex items-center justify-between gap-3 md:hidden', mobileStep === 3 && 'hidden')}>
            {mobileStep > 1 ? (
              <Button variant="outline" onClick={() => setMobileStep((s) => s - 1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            )}
            <Button onClick={() => {
              if (mobileStep === 1 && items.length === 0) {
                triggerValidationError({ products: 'Adicione pelo menos um produto' })
                toast({ title: 'Adicione pelo menos um produto', variant: 'destructive' })
                return
              }
              setMobileStep((s) => s + 1)
            }} className="gap-1 min-w-[120px]">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {/* Full footer: desktop always, mobile step 3 only */}
          <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-3', mobileStep !== 3 && 'hidden md:flex')}>
            {isFiado ? (
              <div className="flex flex-wrap items-center gap-4 text-base w-full sm:w-auto bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="footer-installment-toggle"
                    checked={isInstallment}
                    onChange={(e) => {
                      setIsInstallment(e.target.checked)
                      if (e.target.checked) {
                        setIsFiadoMode(true)
                        setPayments([])
                        if (!installmentPlan) {
                          setInstallmentPlan(3)
                          if (total > 0) {
                            setFixedInstallmentAmount(Number((total / 3).toFixed(2)))
                          }
                        }
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  <Label htmlFor="footer-installment-toggle" className="cursor-pointer text-base font-semibold whitespace-nowrap">
                    Dividir em parcelas
                  </Label>
                </div>
                {isInstallment && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-base text-muted-foreground whitespace-nowrap">Parcelas:</Label>
                      <Input
                        type="number"
                        min="1"
                        max="48"
                        value={installmentPlan}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') {
                            setInstallmentPlan('')
                            setFixedInstallmentAmount(null)
                            return
                          }
                          const value = Math.min(48, Number(raw) || 0)
                          setInstallmentPlan(value)
                          if (value > 0 && total > 0) {
                            setFixedInstallmentAmount(Number((total / value).toFixed(2)))
                          }
                        }}
                        onBlur={() => {
                          if (!installmentPlan || installmentPlan < 1) setInstallmentPlan(1)
                        }}
                        className="w-18 h-9 text-center text-base"
                        placeholder="3"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-base text-muted-foreground whitespace-nowrap">Dia:</Label>
                      <Select
                        value={String(paymentDay)}
                        onValueChange={(v) => setPaymentDay(Number(v))}
                      >
                        <SelectTrigger className="w-24 h-9 text-base">
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
                    <div className="flex items-center gap-1.5">
                      <Label className="text-base text-muted-foreground whitespace-nowrap">Início:</Label>
                      <Select
                        value={startMonth && startYear ? `${startMonth}-${startYear}` : 'auto'}
                        onValueChange={(v) => {
                          if (v === 'auto') {
                            setStartMonth(null)
                            setStartYear(null)
                          } else {
                            const [m, y] = v.split('-').map(Number)
                            setStartMonth(m)
                            setStartYear(y)
                          }
                        }}
                      >
                        <SelectTrigger className="w-32 h-9 text-base">
                          <SelectValue placeholder="Auto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automático</SelectItem>
                          {Array.from({ length: 12 }, (_, i) => {
                            const d = new Date()
                            d.setMonth(d.getMonth() + i)
                            const m = d.getMonth() + 1
                            const y = d.getFullYear()
                            const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                            return (
                              <SelectItem key={`${m}-${y}`} value={`${m}-${y}`}>
                                {label.charAt(0).toUpperCase() + label.slice(1)}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-base text-muted-foreground whitespace-nowrap">Valor fixo:</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={total > 0 && Number(installmentPlan) > 0 ? String((total / Number(installmentPlan)).toFixed(2)) : '0'}
                        value={fixedInstallmentAmount || ''}
                        onChange={(e) =>
                          setFixedInstallmentAmount(e.target.value ? Number(e.target.value) : null)
                        }
                        className="w-28 h-9 text-base"
                      />
                    </div>
                    {total > 0 && Number(installmentPlan) > 0 && (
                      <span className="text-base text-amber-700 dark:text-amber-400 font-semibold whitespace-nowrap">
                        {installmentPlan}x de {formatCurrency(fixedInstallmentAmount || total / Number(installmentPlan))}
                      </span>
                    )}
                    {Number(installmentPlan) > 0 && (
                      <div className="w-full flex flex-wrap items-center gap-1.5 text-sm text-amber-700 mt-1">
                        <span className="font-medium flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Vencimentos:
                        </span>
                        {Array.from({ length: Math.min(Number(installmentPlan), 6) }, (_, i) => {
                          const now = new Date()
                          let date: Date
                          if (startMonth && startYear) {
                            date = new Date(startYear, startMonth - 1 + i, paymentDay)
                          } else {
                            date = new Date(now.getFullYear(), now.getMonth() + i, paymentDay)
                            if (i === 0 && date <= now) {
                              date.setMonth(date.getMonth() + 1)
                            }
                          }
                          const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
                          if (paymentDay > lastDay) {
                            date.setDate(lastDay)
                          }
                          return (
                            <span key={i} className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded text-xs font-medium">
                              {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )
                        })}
                        {Number(installmentPlan) > 6 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">+{Number(installmentPlan) - 6} mais</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div />
            )}
            <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="hidden md:inline-flex transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancelar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setMobileStep(2)}
                className="md:hidden transition-all duration-200 gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createSale.isPending ||
                  addItemsToSale.isPending ||
                  items.length === 0 ||
                  (saleMode === 'existing' && !selectedPendingSaleId)
                }
                className={`min-w-[160px] transition-all duration-200 disabled:opacity-50 ${
                  isFiado
                    ? 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white'
                    : ''
                }`}
              >
                {createSale.isPending || addItemsToSale.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Finalizando...
                  </span>
                ) : saleMode === 'existing' ? (
                  'Adicionar na Conta'
                ) : isFiado ? (
                  <span className="flex items-center gap-2">
                    <Handshake className="h-5 w-5" />
                    Registrar Fiado
                  </span>
                ) : (
                  'Finalizar Venda'
                )}
              </Button>
            </div>
          </div>
        </div>
        </>
        )}
      </DialogContent>

      {/* Backorder confirmation dialog */}
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
                ? 'O seguinte item está sem estoque e será registrado como encomenda:'
                : `Os seguintes ${backorderItems.length} itens estão sem estoque e serão registrados como encomenda:`}
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
