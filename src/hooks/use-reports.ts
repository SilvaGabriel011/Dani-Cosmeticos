import { useQuery } from "@tanstack/react-query"

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

export function useReportSummary(filters: ReportFilters = {}) {
  const params = new URLSearchParams()
  if (filters.startDate) params.append("startDate", filters.startDate)
  if (filters.endDate) params.append("endDate", filters.endDate)

  return useQuery<ReportSummary>({
    queryKey: ["reports", "summary", filters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/summary?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar resumo")
      return res.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutos - relatórios são dados históricos
    refetchOnWindowFocus: false,
  })
}

export function useReportByProduct(filters: ReportFilters & { limit?: number; enabled?: boolean } = {}) {
  const { enabled = true, ...restFilters } = filters
  const params = new URLSearchParams()
  if (restFilters.startDate) params.append("startDate", restFilters.startDate)
  if (restFilters.endDate) params.append("endDate", restFilters.endDate)
  if (restFilters.limit) params.append("limit", restFilters.limit.toString())

  return useQuery<ProductsReportResponse>({
    queryKey: ["reports", "by-product", restFilters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/by-product?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar relatório por produto")
      return res.json()
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  })
}

export function useReportByPayment(filters: ReportFilters & { enabled?: boolean } = {}) {
  const { enabled = true, ...restFilters } = filters
  const params = new URLSearchParams()
  if (restFilters.startDate) params.append("startDate", restFilters.startDate)
  if (restFilters.endDate) params.append("endDate", restFilters.endDate)

  return useQuery<PaymentsReportResponse>({
    queryKey: ["reports", "by-payment", restFilters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/by-payment?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar relatório por pagamento")
      return res.json()
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  })
}
