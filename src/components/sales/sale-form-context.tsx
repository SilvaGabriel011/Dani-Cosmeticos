'use client'

import { createContext, useContext } from 'react'
import { type Product } from '@/types'

export interface CartItem {
  product: Product
  quantity: number
  originalPrice: number
  unitPrice: number
  totalPrice: number
}

export interface Payment {
  method: 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT'
  amount: number
  feePercent: number
  feeAbsorber: 'SELLER' | 'CLIENT'
  installments: number
}

export interface SaleFormContextType {
  items: CartItem[]
  setItems: React.Dispatch<React.SetStateAction<CartItem[]>>
  payments: Payment[]
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>
  clientId: string
  setClientId: React.Dispatch<React.SetStateAction<string>>
  discountPercent: number
  setDiscountPercent: React.Dispatch<React.SetStateAction<number>>
  hasManualDiscount: boolean
  setHasManualDiscount: React.Dispatch<React.SetStateAction<boolean>>

  productSearch: string
  setProductSearch: React.Dispatch<React.SetStateAction<string>>
  clientSearch: string
  setClientSearch: React.Dispatch<React.SetStateAction<string>>
  isClientDropdownOpen: boolean
  setIsClientDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>
  clientInputRef: React.RefObject<HTMLInputElement>
  productListRef: React.RefObject<HTMLDivElement>
  clientDropdownRef: React.RefObject<HTMLDivElement>
  highlightedClientIndex: number
  setHighlightedClientIndex: React.Dispatch<React.SetStateAction<number>>
  highlightedProductIndex: number

  isInstallment: boolean
  setIsInstallment: React.Dispatch<React.SetStateAction<boolean>>
  paymentDay: number
  setPaymentDay: React.Dispatch<React.SetStateAction<number>>
  installmentPlan: number | ''
  setInstallmentPlan: React.Dispatch<React.SetStateAction<number | ''>>
  isFiadoMode: boolean
  setIsFiadoMode: React.Dispatch<React.SetStateAction<boolean>>
  fixedInstallmentAmount: number | null
  setFixedInstallmentAmount: React.Dispatch<React.SetStateAction<number | null>>
  startMonth: number | null
  setStartMonth: React.Dispatch<React.SetStateAction<number | null>>
  startYear: number | null
  setStartYear: React.Dispatch<React.SetStateAction<number | null>>

  existingMode: 'increase_installments' | 'increase_value' | 'increase_value_from_installment' | 'recalculate'
  setExistingMode: React.Dispatch<React.SetStateAction<'increase_installments' | 'increase_value' | 'increase_value_from_installment' | 'recalculate'>>
  startFromInstallment: number | null
  setStartFromInstallment: React.Dispatch<React.SetStateAction<number | null>>
  targetInstallmentAmount: number | null
  setTargetInstallmentAmount: React.Dispatch<React.SetStateAction<number | null>>
  targetInstallmentCount: number | null
  setTargetInstallmentCount: React.Dispatch<React.SetStateAction<number | null>>
  lastEditedField: 'value' | 'count' | null
  setLastEditedField: React.Dispatch<React.SetStateAction<'value' | 'count' | null>>

  showQuickProduct: boolean
  setShowQuickProduct: React.Dispatch<React.SetStateAction<boolean>>
  quickName: string
  setQuickName: React.Dispatch<React.SetStateAction<string>>
  quickPrice: number | ''
  setQuickPrice: React.Dispatch<React.SetStateAction<number | ''>>
  quickCost: number | ''
  setQuickCost: React.Dispatch<React.SetStateAction<number | ''>>

  showQuickClient: boolean
  setShowQuickClient: React.Dispatch<React.SetStateAction<boolean>>
  quickClientName: string
  setQuickClientName: React.Dispatch<React.SetStateAction<string>>
  quickClientPhone: string
  setQuickClientPhone: React.Dispatch<React.SetStateAction<string>>
  quickClientAddress: string
  setQuickClientAddress: React.Dispatch<React.SetStateAction<string>>

  validationErrors: {
    products?: string
    client?: string
    payment?: string
    prices?: string
  }
  shakeKey: number

  saleMode: 'new' | 'existing'
  setSaleMode: React.Dispatch<React.SetStateAction<'new' | 'existing'>>
  selectedPendingSaleId: string
  setSelectedPendingSaleId: React.Dispatch<React.SetStateAction<string>>
  existingInstallmentAmount: number | null
  setExistingInstallmentAmount: React.Dispatch<React.SetStateAction<number | null>>

  pendingSales: Array<{
    id: string
    total: number
    installmentPlan: number
    fixedInstallmentAmount: number | null
    pendingReceivablesCount: number
    remaining: number
    pendingReceivables: Array<{
      installment: number
      amount: number
      dueDate: string
    }>
  }>

  products: Product[]
  clients: Array<{ id: string; name: string; phone?: string | null; address?: string | null; discount?: number | { toNumber(): number } | null }>
  selectedClient: { id: string; name: string; phone?: string | null; address?: string | null; discount?: number | { toNumber(): number } | null } | undefined

  sortedProducts: Product[]
  filteredProducts: Product[]
  visibleProducts: Product[]
  hasMoreProducts: boolean
  filteredClients: Array<{ id: string; name: string; phone?: string | null; address?: string | null; discount?: number | { toNumber(): number } | null }>
  recentClients: Array<{ id: string; name: string; phone?: string | null; address?: string | null; discount?: number | { toNumber(): number } | null }>
  recentProducts: Product[]
  productCompletions: string[]
  clientCompletions: string[]

  effectiveDiscount: number
  subtotalOriginal: number
  subtotal: number
  promoAmount: number
  hasCustomTotal: boolean
  discountAmount: number
  total: number
  totalPayments: number
  remaining: number
  isFiado: boolean
  backorderItems: CartItem[]

  addItem: (product: Product) => void
  updateQuantity: (productId: string, delta: number) => void
  removeItem: (productId: string) => void
  updateItemPrice: (productId: string, newPrice: number) => void
  addPayment: () => void
  updatePayment: (index: number, updates: Partial<Payment>) => void
  removePayment: (index: number) => void
  handleSubmit: () => Promise<void>
  handleQuickClient: () => Promise<void>
  handleQuickProduct: () => Promise<void>
  handleProductListScroll: (e: React.UIEvent<HTMLDivElement>) => void
  handleClientKeyDown: (e: React.KeyboardEvent) => void
  handleProductKeyDown: (e: React.KeyboardEvent) => void
  applyCompletion: (currentSearch: string, completion: string) => string
  updateTotalAndRedistribute: (newTotal: number) => void
  restoreOriginalPrices: () => void
  triggerValidationError: (errors: { products?: string; client?: string; payment?: string; prices?: string }) => void
  addRecentClient: (id: string) => void
  addRecentProduct: (id: string) => void

  createProductPending: boolean
  createClientPending: boolean
  createSalePending: boolean
  addItemsToSalePending: boolean

  settings: {
    defaultFeeAbsorber?: string
    debitFeePercent?: number
    creditFeePercent?: number
    creditInstallmentFee?: number
  } | null | undefined
}

const SaleFormContext = createContext<SaleFormContextType | null>(null)

export function SaleFormProvider({ value, children }: { value: SaleFormContextType; children: React.ReactNode }) {
  return <SaleFormContext.Provider value={value}>{children}</SaleFormContext.Provider>
}

export function useSaleFormContext() {
  const ctx = useContext(SaleFormContext)
  if (!ctx) throw new Error('useSaleFormContext must be used within SaleFormProvider')
  return ctx
}
