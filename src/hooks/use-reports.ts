import { useQuery } from '@tanstack/react-query'

interface ReportFilters {
  startDate?: string
  endDate?: string
}

interface ReportSummary {
  period: { startDate: string; endDate: string }
  totalSales: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  totalFees: number
  netProfit: number
  averageTicket: number
  profitMargin: number
}

interface ProductReport {
  productId: string
  productName: string
  productCode: string | null
  quantitySold: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
}

interface ProductsReportResponse {
  period: { startDate: string; endDate: string }
  products: ProductReport[]
}

interface PaymentMethodReport {
  method: string
  count: number
  totalAmount: number
  totalFees: number
  netAmount: number
  percentage: number
}

interface PaymentsReportResponse {
  period: { startDate: string; endDate: string }
  methods: PaymentMethodReport[]
  totalAmount: number
}

interface CollectionByMethod {
  method: string
  total: number
  count: number
  percentage: number
}

interface CollectionReport {
  period: { startDate: string; endDate: string }
  totalCollection: number
  paymentCount: number
  totalFees: number
  netCollection: number
  averagePayment: number
  byMethod: CollectionByMethod[]
  comparison: {
    previousPeriod: { startDate: string; endDate: string }
    previousCollection: number
    change: number
    trend: 'up' | 'down' | 'stable'
  }
}

export function useCollection(
  filters: ReportFilters & { period?: string; enabled?: boolean } = {}
) {
  const { enabled = true, period, ...restFilters } = filters
  const params = new URLSearchParams()
  if (period) params.append('period', period)
  if (restFilters.startDate) params.append('startDate', restFilters.startDate)
  if (restFilters.endDate) params.append('endDate', restFilters.endDate)

  return useQuery<CollectionReport>({
    queryKey: ['reports', 'collection', { period, ...restFilters }],
    queryFn: async () => {
      const res = await fetch(`/api/reports/collection?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar arrecadação')
      return res.json()
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutos - arrecadação muda mais frequentemente
    refetchOnWindowFocus: true,
  })
}

export function useReportSummary(filters: ReportFilters = {}) {
  const params = new URLSearchParams()
  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)

  return useQuery<ReportSummary>({
    queryKey: ['reports', 'summary', filters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/summary?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar resumo')
      return res.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

export function useReportByProduct(
  filters: ReportFilters & { limit?: number; enabled?: boolean } = {}
) {
  const { enabled = true, ...restFilters } = filters
  const params = new URLSearchParams()
  if (restFilters.startDate) params.append('startDate', restFilters.startDate)
  if (restFilters.endDate) params.append('endDate', restFilters.endDate)
  if (restFilters.limit) params.append('limit', restFilters.limit.toString())

  return useQuery<ProductsReportResponse>({
    queryKey: ['reports', 'by-product', restFilters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/by-product?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar relatório por produto')
      return res.json()
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

export function useReportByPayment(filters: ReportFilters & { enabled?: boolean } = {}) {
  const { enabled = true, ...restFilters } = filters
  const params = new URLSearchParams()
  if (restFilters.startDate) params.append('startDate', restFilters.startDate)
  if (restFilters.endDate) params.append('endDate', restFilters.endDate)

  return useQuery<PaymentsReportResponse>({
    queryKey: ['reports', 'by-payment', restFilters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/by-payment?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar relatório por pagamento')
      return res.json()
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

interface TopClientReport {
  id: string
  nome: string
  totalCompras: number
  quantidadeVendas: number
  ticketMedio: number
  ultimaCompra: string
}

export function useTopClientes(
  filters: ReportFilters & { limit?: number; enabled?: boolean } = {}
) {
  const { enabled = true, limit = 10, ...restFilters } = filters
  const params = new URLSearchParams()
  if (restFilters.startDate) params.append('startDate', restFilters.startDate)
  if (restFilters.endDate) params.append('endDate', restFilters.endDate)
  if (limit) params.append('limit', limit.toString())

  return useQuery<TopClientReport[]>({
    queryKey: ['reports', 'top-clientes', { ...restFilters, limit }],
    queryFn: async () => {
      const res = await fetch(`/api/reports/top-clientes?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar top clientes')
      return res.json()
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}
