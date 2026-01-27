# 🚀 Melhorias de Performance - Cosméticos App

Este documento lista as oportunidades de otimização identificadas na aplicação, organizadas por prioridade e impacto.

---

## 📊 Resumo Executivo

| Categoria | Itens | Impacto Estimado |
|-----------|-------|------------------|
| 🔴 Alta Prioridade | 5 | Alto |
| 🟡 Média Prioridade | 6 | Médio |
| 🟢 Baixa Prioridade | 4 | Baixo |

---

## 🔴 Alta Prioridade

### 1. Componente `SaleForm` muito grande (~1000 linhas)

**Arquivo:** `src/components/sales/sale-form.tsx`

**Problema:** Componente monolítico com muita lógica e estado, difícil de manter e pode causar re-renders desnecessários.

**Solução:**
```tsx
// Extrair sub-componentes:
// - ProductSelector (busca e seleção de produtos)
// - CartItems (lista de itens no carrinho)
// - PaymentSection (formas de pagamento)
// - FiadoConfig (configuração de fiado/parcelas)
// - ClientSelector (seleção de cliente)

// Exemplo de extração:
// src/components/sales/product-selector.tsx
export function ProductSelector({ 
  onAddItem, 
  products 
}: ProductSelectorProps) {
  // Lógica de busca e seleção isolada
}
```

**Impacto:** Melhor manutenibilidade, menos re-renders, code splitting mais eficiente.

---

### 2. Carregamento de 1000 produtos/clientes no `SaleForm`

**Arquivo:** `src/components/sales/sale-form.tsx` (linhas 60-61)

**Problema:**
```tsx
const { data: productsData } = useProducts({ limit: 1000 })
const { data: clientsData } = useClients({ limit: 1000 })
```

Carrega todos os dados de uma vez, mesmo que o usuário não precise de todos.

**Solução:**
```tsx
// Opção 1: Busca sob demanda com debounce
const [productSearch, setProductSearch] = useState('')
const debouncedSearch = useDebounce(productSearch, 300)

const { data: productsData } = useProducts({ 
  search: debouncedSearch,
  limit: 50 // Carregar apenas o necessário
})

// Opção 2: Usar React Query com infinite scroll
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['products', search],
  queryFn: ({ pageParam = 1 }) => fetchProducts({ page: pageParam, limit: 20 }),
  getNextPageParam: (lastPage) => lastPage.pagination.page + 1,
})
```

**Impacto:** Redução significativa no tempo de carregamento inicial e uso de memória.

---

### 3. Falta de virtualização em listas longas

**Arquivos:**
- `src/components/products/product-list.tsx`
- `src/components/sales/sale-list.tsx`
- `src/components/clients/client-list.tsx`

**Problema:** Renderiza todos os itens da lista no DOM, mesmo os não visíveis.

**Solução:**
```tsx
// Instalar: npm install @tanstack/react-virtual

import { useVirtualizer } from '@tanstack/react-virtual'

function ProductList() {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: filteredProducts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // altura estimada de cada linha
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const product = filteredProducts[virtualRow.index]
          return (
            <TableRow
              key={product.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* conteúdo da linha */}
            </TableRow>
          )
        })}
      </div>
    </div>
  )
}
```

**Impacto:** Performance muito melhor com listas de 100+ itens.

---

### 4. Gráficos Recharts carregados sincronamente

**Arquivo:** `src/components/charts/bar-chart.tsx`

**Problema:** Recharts é uma biblioteca pesada (~200KB) carregada no bundle principal.

**Solução:**
```tsx
// src/components/charts/bar-chart.tsx
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const RechartsBarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  { 
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />
  }
)

// Ou criar um wrapper lazy:
// src/components/charts/lazy-bar-chart.tsx
export const LazyBarChart = dynamic(
  () => import('./bar-chart').then((mod) => mod.BarChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px]" /> }
)
```

**Impacto:** Redução de ~200KB no bundle inicial, melhor LCP.

---

### 5. Fuzzy Search pode ser lento com muitos itens

**Arquivo:** `src/lib/fuzzy-search.ts`

**Problema:** Algoritmo Levenshtein é O(n*m) e roda no main thread.

**Solução:**
```tsx
// Opção 1: Usar Web Worker
// src/workers/search.worker.ts
self.onmessage = (e) => {
  const { items, query } = e.data
  const results = fuzzySearch(items, query, ...)
  self.postMessage(results)
}

// Opção 2: Usar biblioteca otimizada como Fuse.js
import Fuse from 'fuse.js'

const fuse = new Fuse(products, {
  keys: ['name', 'code'],
  threshold: 0.3,
})

const results = fuse.search(query)

// Opção 3: Debounce + limite de resultados
const debouncedSearch = useDebouncedCallback((query) => {
  const results = fuzzySearch(items.slice(0, 500), query, ...)
  setResults(results.slice(0, 50))
}, 150)
```

**Impacto:** Melhor INP (Interaction to Next Paint), UI mais responsiva.

---

## 🟡 Média Prioridade

### 6. Memoização incompleta em componentes

**Arquivos:** Vários componentes

**Problema:** Funções inline criadas a cada render.

**Solução:**
```tsx
// Antes (cria nova função a cada render):
<Button onClick={() => handleDelete(product)}>

// Depois (memoizado):
const handleDeleteClick = useCallback((product: Product) => {
  handleDelete(product)
}, [handleDelete])

// Ou usar data attributes:
<Button 
  data-product-id={product.id} 
  onClick={handleDeleteWithId}
>

const handleDeleteWithId = useCallback((e: React.MouseEvent) => {
  const id = e.currentTarget.dataset.productId
  handleDelete(id)
}, [handleDelete])
```

---

### 7. Dashboard faz múltiplas requisições paralelas

**Arquivo:** `src/app/(main)/dashboard/page.tsx`

**Problema:** 3 hooks de dados carregam em paralelo, mas poderiam ser otimizados.

**Solução:**
```tsx
// Já está parcialmente otimizado com `enabled: !isLoading`
// Melhorar com prefetch:

// Em src/hooks/use-dashboard.ts
export function useDashboard() {
  const queryClient = useQueryClient()
  
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    onSuccess: (data) => {
      // Prefetch dados relacionados
      queryClient.prefetchQuery({
        queryKey: ['reports', 'products'],
        queryFn: () => fetchReportByProduct({ limit: 5 }),
      })
    }
  })
}
```

---

### 8. Imagens sem otimização

**Problema:** Se houver imagens de produtos, não estão usando `next/image`.

**Solução:**
```tsx
import Image from 'next/image'

// Usar next/image para otimização automática
<Image
  src={product.imageUrl}
  alt={product.name}
  width={100}
  height={100}
  loading="lazy"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

---

### 9. Falta de Error Boundaries

**Problema:** Erros em componentes podem quebrar toda a aplicação.

**Solução:**
```tsx
// src/components/error-boundary.tsx
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

export class ErrorBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-center text-destructive">
          Algo deu errado. Recarregue a página.
        </div>
      )
    }
    return this.props.children
  }
}

// Uso:
<ErrorBoundary fallback={<ChartError />}>
  <BarChart data={data} />
</ErrorBoundary>
```

---

### 10. Select de clientes sem busca

**Arquivo:** `src/components/sales/sale-form.tsx` (linhas 590-605)

**Problema:** Com muitos clientes, o Select fica difícil de usar.

**Solução:**
```tsx
// Usar Combobox com busca (shadcn/ui)
import { Combobox } from '@/components/ui/combobox'

<Combobox
  options={clients.map(c => ({ value: c.id, label: c.name }))}
  value={clientId}
  onValueChange={setClientId}
  placeholder="Buscar cliente..."
  searchPlaceholder="Digite para buscar..."
/>
```

---

### 11. Falta de skeleton loading consistente

**Problema:** Alguns componentes não têm loading states adequados.

**Solução:**
```tsx
// Criar skeletons específicos para cada tipo de conteúdo
// src/components/skeletons/table-skeleton.tsx
export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
```

---

## 🟢 Baixa Prioridade

### 12. Console logs em produção

**Verificar:** Remover `console.log` e `console.error` em produção.

**Solução:**
```tsx
// next.config.js
module.exports = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}
```

---

### 13. Bundle analyzer para identificar dependências pesadas

**Solução:**
```bash
npm install @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({
  // config
})

# Executar
ANALYZE=true npm run build
```

---

### 14. Preload de fontes

**Arquivo:** `src/app/layout.tsx`

**Problema:** Fonte Inter pode causar FOUT (Flash of Unstyled Text).

**Solução:**
```tsx
// Já está usando next/font, mas pode adicionar preload
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap', // Garante que texto apareça enquanto fonte carrega
  preload: true,
})
```

---

### 15. Adicionar monitoramento de Web Vitals

**Solução:**
```tsx
// src/app/layout.tsx ou providers.tsx
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Enviar para analytics
    console.log(metric)
    
    // Ou enviar para serviço externo
    // analytics.track('web-vitals', metric)
  })
  
  return null
}
```

---

## 📋 Checklist de Implementação

### Fase 1 - Quick Wins (1-2 dias)
- [ ] Lazy load dos gráficos Recharts
- [ ] Adicionar debounce na busca de produtos
- [ ] Reduzir limite de produtos/clientes no SaleForm
- [ ] Remover console.logs em produção

### Fase 2 - Melhorias Estruturais (3-5 dias)
- [ ] Extrair sub-componentes do SaleForm
- [ ] Implementar virtualização nas listas
- [ ] Adicionar Error Boundaries
- [ ] Combobox com busca para clientes

### Fase 3 - Otimizações Avançadas (1 semana)
- [ ] Web Worker para fuzzy search
- [ ] Prefetch de dados no dashboard
- [ ] Bundle analyzer e otimização
- [ ] Monitoramento de Web Vitals

---

## 🎯 Métricas Alvo

| Métrica | Atual (estimado) | Alvo |
|---------|------------------|------|
| LCP | ~3s | < 2.5s |
| INP | ~300ms | < 200ms |
| CLS | ~0.15 | < 0.1 |
| Bundle Size | ~500KB | < 300KB |
| Time to Interactive | ~4s | < 3s |

---

## 📚 Recursos

- [Next.js Performance](https://nextjs.org/docs/pages/building-your-application/optimizing)
- [React Query Best Practices](https://tanstack.com/query/latest/docs/react/guides/performance)
- [Web Vitals](https://web.dev/vitals/)
- [TanStack Virtual](https://tanstack.com/virtual/latest)

---

*Documento gerado em: Janeiro 2026*
*Última atualização: Revisão inicial*
