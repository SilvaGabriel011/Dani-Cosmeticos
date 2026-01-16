# Revisão de Código - Dani Cosméticos

Este documento contém uma análise completa da base de código, identificando problemas de lógica, incongruências e propostas de melhorias para as próximas iterações.

---

## Sumário

1. [Problemas Críticos de Lógica](#1-problemas-críticos-de-lógica)
2. [Inconsistências de Dados](#2-inconsistências-de-dados)
3. [Problemas de Validação](#3-problemas-de-validação)
4. [Problemas de UI/UX](#4-problemas-de-uiux)
5. [Problemas de Arquitetura](#5-problemas-de-arquitetura)
6. [Melhorias Propostas](#6-melhorias-propostas)

---

## 1. Problemas Críticos de Lógica

### 1.1 Cálculo de Taxa Quando Cliente Paga (CRÍTICO)

**Arquivo:** `src/app/api/sales/route.ts` (linhas 173-191)

**Problema:** Quando `feeAbsorber === "CLIENT"`, a taxa deveria ser ADICIONADA ao total que o cliente paga. Atualmente, o código apenas ignora a taxa quando o cliente é o absorvedor, resultando em perda financeira para o vendedor.

**Código Atual:**
```typescript
let totalFees = 0
const salePayments = payments.map((payment) => {
  const feeAmount = payment.amount * (payment.feePercent / 100)
  if (payment.feeAbsorber === "SELLER") {
    totalFees += feeAmount
  }
  // Quando CLIENT, a taxa não é adicionada ao total!
  return { ... }
})

const total = subtotalAfterDiscount  // Taxa do cliente não incluída
const netTotal = total - totalFees
```

**Solução:**
```typescript
let totalSellerFees = 0
let totalClientFees = 0

const salePayments = payments.map((payment) => {
  const feeAmount = payment.amount * (payment.feePercent / 100)
  if (payment.feeAbsorber === "SELLER") {
    totalSellerFees += feeAmount
  } else {
    totalClientFees += feeAmount
  }
  return { ... }
})

const total = subtotalAfterDiscount + totalClientFees  // Cliente paga sua taxa
const netTotal = subtotalAfterDiscount - totalSellerFees  // Vendedor absorve sua taxa
```

---

### 1.2 Query de Estoque Baixo Incorreta

**Arquivo:** `src/app/api/products/route.ts` (linhas 24-26)

**Problema:** A query usa `prisma.product.fields.minStock` que é uma referência de campo, não um valor comparável. Isso faz com que o filtro de estoque baixo não funcione.

**Código Atual:**
```typescript
...(lowStock && {
  stock: { lte: prisma.product.fields.minStock },
}),
```

**Solução:** Usar raw query ou filtrar no lado do servidor:
```typescript
// Opção 1: Raw query
if (lowStock) {
  const products = await prisma.$queryRaw`
    SELECT p.*, c.name as "categoryName"
    FROM "Product" p
    LEFT JOIN "Category" c ON p."categoryId" = c.id
    WHERE p."deletedAt" IS NULL
    AND p."stock" <= p."minStock"
    ORDER BY p.name ASC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `
}

// Opção 2: Filtrar após busca (menos eficiente para grandes volumes)
const allProducts = await prisma.product.findMany({ where: { deletedAt: null } })
const lowStockProducts = allProducts.filter(p => p.stock <= p.minStock)
```

---

### 1.3 Estoque Pode Ficar Negativo (Condição de Corrida)

**Arquivo:** `src/app/api/sales/route.ts`

**Problema:** A verificação de estoque é feita antes da transação, mas requisições concorrentes podem causar estoque negativo.

**Solução:** Adicionar constraint no banco ou usar locking otimista:
```typescript
// Na transação, verificar novamente com lock
const sale = await prisma.$transaction(async (tx) => {
  // Verificar estoque com lock FOR UPDATE
  for (const item of items) {
    const product = await tx.$queryRaw`
      SELECT * FROM "Product" 
      WHERE id = ${item.productId} 
      FOR UPDATE
    `
    if (product[0].stock < item.quantity) {
      throw new Error(`Estoque insuficiente para ${product[0].name}`)
    }
  }
  
  // Continuar com a criação...
})
```

**Alternativa:** Adicionar CHECK constraint no schema:
```prisma
model Product {
  stock Int @default(0) @db.Check("stock >= 0")
}
```

---

## 2. Inconsistências de Dados

### 2.1 Valores de Filtro de Pagamento Incorretos

**Arquivo:** `src/components/sales/sale-list.tsx` (linhas 38-43)

**Problema:** Os valores do filtro de método de pagamento não correspondem aos valores do enum no banco de dados.

**Código Atual:**
```typescript
const paymentOptions = [
  { value: "MONEY", label: "Dinheiro" },      // Deveria ser "CASH"
  { value: "PIX", label: "PIX" },              // OK
  { value: "CREDIT_CARD", label: "Cartão Crédito" },  // Deveria ser "CREDIT"
  { value: "DEBIT_CARD", label: "Cartão Débito" },    // Deveria ser "DEBIT"
]
```

**Solução:**
```typescript
const paymentOptions = [
  { value: "CASH", label: "Dinheiro" },
  { value: "PIX", label: "PIX" },
  { value: "CREDIT", label: "Cartão Crédito" },
  { value: "DEBIT", label: "Cartão Débito" },
]

// Ou melhor ainda, usar as constantes existentes:
import { PAYMENT_METHOD_LABELS } from "@/lib/constants"

const paymentOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  value,
  label,
}))
```

---

### 2.2 Lógica de Desconto Inconsistente

**Arquivo:** `src/components/sales/sale-form.tsx` (linha 75)

**Problema:** Se o usuário definir desconto como 0 explicitamente, o sistema usa o desconto do cliente em vez de respeitar a escolha do usuário.

**Código Atual:**
```typescript
const effectiveDiscount = discountPercent || Number(selectedClient?.discount || 0)
```

**Solução:**
```typescript
// Usar undefined check em vez de falsy check
const effectiveDiscount = discountPercent !== 0 
  ? discountPercent 
  : (discountPercent === 0 ? 0 : Number(selectedClient?.discount || 0))

// Ou melhor: adicionar estado para "usar desconto do cliente"
const [useClientDiscount, setUseClientDiscount] = useState(true)
const effectiveDiscount = useClientDiscount 
  ? Number(selectedClient?.discount || 0) 
  : discountPercent
```

---

## 3. Problemas de Validação

### 3.1 Falta Validação Server-Side do Total de Pagamentos

**Arquivo:** `src/app/api/sales/route.ts`

**Problema:** Não há validação no servidor de que a soma dos pagamentos é igual ao total da venda. Isso é validado apenas no frontend.

**Solução:** Adicionar validação no backend:
```typescript
// Após calcular o total
const totalPaymentsAmount = payments.reduce((sum, p) => sum + p.amount, 0)
const expectedTotal = subtotalAfterDiscount + totalClientFees // considerando a correção do item 1.1

if (Math.abs(totalPaymentsAmount - expectedTotal) > 0.01) {
  return NextResponse.json(
    { 
      error: { 
        code: "PAYMENT_MISMATCH", 
        message: "O valor dos pagamentos não confere com o total da venda" 
      } 
    },
    { status: 400 }
  )
}
```

---

### 3.2 Falta Validação de Email/Telefone do Cliente

**Arquivo:** `src/schemas/client.ts`

**Problema:** O telefone é apenas validado como string não vazia, sem formato específico.

**Solução:**
```typescript
export const createClientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string()
    .min(1, "Telefone é obrigatório")
    .regex(
      /^\(?[1-9]{2}\)?\s?(?:9\d{4}|\d{4})-?\d{4}$/,
      "Formato de telefone inválido. Use (XX) XXXXX-XXXX ou (XX) XXXX-XXXX"
    ),
  address: z.string().min(1, "Endereço é obrigatório"),
  discount: z.number().min(0).max(100).default(0),
})
```

---

### 3.3 Deleção Sem Verificação de Dependências

**Arquivos:** 
- `src/app/api/products/[id]/route.ts`
- `src/app/api/clients/[id]/route.ts`

**Problema:** Produtos e clientes podem ser deletados mesmo tendo vendas ativas/recentes, o que pode causar confusão.

**Solução:** Adicionar verificação antes de deletar:
```typescript
// Para produtos
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const recentSales = await prisma.saleItem.findFirst({
    where: {
      productId: params.id,
      sale: {
        status: "COMPLETED",
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 dias
      }
    }
  })
  
  if (recentSales) {
    return NextResponse.json(
      { 
        error: { 
          code: "PRODUCT_HAS_RECENT_SALES", 
          message: "Produto possui vendas nos últimos 30 dias. Deseja continuar?" 
        },
        requiresConfirmation: true
      },
      { status: 409 }
    )
  }
  
  // Continuar com soft delete...
}
```

---

## 4. Problemas de UI/UX

### 4.1 Formulários Não Resetam Corretamente

**Arquivos:**
- `src/components/products/product-form.tsx`
- `src/components/clients/client-form.tsx`

**Problema:** Quando o formulário é aberto para criar um novo item após editar um existente, os valores antigos podem permanecer.

**Solução:** Usar `key` para forçar remontagem ou `reset` no `useEffect`:
```typescript
// Opção 1: Usar key no Dialog
<Dialog open={open} onOpenChange={onOpenChange} key={product?.id || 'new'}>

// Opção 2: Reset no useEffect
useEffect(() => {
  if (open) {
    reset(product ? {
      code: product.code || "",
      name: product.name,
      // ...
    } : {
      code: "",
      name: "",
      // valores padrão
    })
  }
}, [open, product, reset])
```

---

### 4.2 Toggle de Alerta de Estoque Baixo Ausente

**Arquivo:** `src/app/(main)/configuracoes/page.tsx`

**Problema:** O estado `lowStockAlert` é carregado e salvo, mas não há UI para o usuário modificá-lo.

**Solução:** Adicionar toggle na página de configurações:
```tsx
<div className="grid gap-2">
  <Label htmlFor="lowStockAlert">Alertas de Estoque Baixo</Label>
  <div className="flex items-center space-x-2">
    <Switch
      id="lowStockAlert"
      checked={lowStockAlert}
      onCheckedChange={setLowStockAlert}
    />
    <Label htmlFor="lowStockAlert" className="text-sm text-muted-foreground">
      {lowStockAlert ? "Ativado" : "Desativado"}
    </Label>
  </div>
</div>
```

---

### 4.3 Filtro do Dashboard Não Afeta Cards de Resumo

**Arquivo:** `src/app/(main)/dashboard/page.tsx`

**Problema:** O filtro de período afeta apenas os gráficos, mas os cards sempre mostram dados de hoje/semana/mês fixos.

**Solução:** Modificar o hook `useDashboard` para aceitar parâmetros de data ou criar cards dinâmicos:
```typescript
// Opção 1: Modificar useDashboard
export function useDashboard(dateRange?: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ["dashboard", dateRange],
    queryFn: () => fetchDashboard(dateRange),
    refetchInterval: 30000,
  })
}

// Opção 2: Usar dados dos relatórios para os cards
const { data: summary } = useReportSummary(dateRange)
// E mostrar summary.totalRevenue, summary.totalSales nos cards
```

---

## 5. Problemas de Arquitetura

### 5.1 Código Duplicado - getDateRange

**Arquivos:**
- `src/components/sales/sale-list.tsx`
- `src/app/(main)/dashboard/page.tsx`
- `src/app/(main)/relatorios/page.tsx`

**Problema:** A função `getDateRange` está duplicada em três arquivos.

**Solução:** Centralizar em `src/lib/utils.ts`:
```typescript
// src/lib/utils.ts
export function getDateRange(period: string): { startDate: string; endDate: string } {
  const today = new Date()
  switch (period) {
    case "today":
      return {
        startDate: format(today, "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
      }
    case "week":
      return {
        startDate: format(subDays(today, 7), "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
      }
    case "month":
    default:
      return {
        startDate: format(startOfMonth(today), "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
      }
  }
}
```

---

### 5.2 Sistema de Erros Não Utilizado

**Arquivo:** `src/lib/errors.ts`

**Problema:** Existe um sistema completo de tratamento de erros (`AppError`, `ErrorCodes`, `handleApiError`), mas não está sendo usado nas rotas da API.

**Solução:** Refatorar as rotas para usar o sistema:
```typescript
// Antes (atual)
catch (error) {
  console.error("Error creating sale:", error)
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Erro ao criar venda" } },
    { status: 500 }
  )
}

// Depois (usando o sistema)
import { handleApiError, AppError, ErrorCodes } from "@/lib/errors"

catch (error) {
  const { message, code, status } = handleApiError(error)
  return NextResponse.json(
    { error: { code, message } },
    { status }
  )
}

// E para erros específicos:
if (product.stock < item.quantity) {
  throw new AppError(ErrorCodes.PRODUCT_INSUFFICIENT_STOCK, 400, {
    productName: product.name,
    available: product.stock,
    requested: item.quantity
  })
}
```

---

### 5.3 Falta Endpoint para Deletar Categorias

**Arquivo:** `src/app/api/categories/route.ts`

**Problema:** Categorias podem ser criadas mas não deletadas, mesmo existindo códigos de erro para isso.

**Solução:** Criar arquivo `src/app/api/categories/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar se tem produtos
    const productsCount = await prisma.product.count({
      where: { categoryId: params.id, deletedAt: null }
    })
    
    if (productsCount > 0) {
      return NextResponse.json(
        { 
          error: { 
            code: "CATEGORY_HAS_PRODUCTS", 
            message: `Categoria possui ${productsCount} produto(s). Remova-os primeiro.` 
          } 
        },
        { status: 400 }
      )
    }
    
    await prisma.category.delete({
      where: { id: params.id }
    })
    
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting category:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao excluir categoria" } },
      { status: 500 }
    )
  }
}
```

---

### 5.4 Tipos `any` em Uso

**Arquivos:**
- `src/hooks/use-dashboard.ts` (linhas 18-19)
- `src/app/(main)/dashboard/page.tsx` (linhas 180, 217)

**Problema:** Uso de `any[]` e `any` reduz a segurança de tipos.

**Solução:** Definir tipos apropriados:
```typescript
// src/hooks/use-dashboard.ts
interface LowStockProduct {
  id: string
  name: string
  stock: number
  minStock: number
}

interface RecentSale {
  id: string
  total: string | number
  createdAt: string
  client: { name: string } | null
}

interface DashboardData {
  sales: {
    today: { total: number; count: number }
    week: { total: number; count: number }
    month: { total: number; count: number }
  }
  products: {
    total: number
    stockValue: number
  }
  clients: {
    total: number
  }
  lowStockProducts: LowStockProduct[]
  recentSales: RecentSale[]
}
```

---

### 5.5 Cache do Dashboard Não Invalidado ao Cancelar Venda

**Arquivo:** `src/hooks/use-sales.ts`

**Problema:** `useCancelSale` não invalida o cache do dashboard.

**Solução:**
```typescript
export function useCancelSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelSale,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }) // Adicionar
      queryClient.invalidateQueries({ queryKey: ["reports"] })   // Adicionar
      queryClient.setQueryData(["sale", data.id], data)
    },
  })
}
```

---

## 6. Melhorias Propostas

### 6.1 Adicionar Auditoria de Vendas

Criar tabela de auditoria para rastrear alterações em vendas:

```prisma
model SaleAudit {
  id        String   @id @default(uuid())
  saleId    String
  sale      Sale     @relation(fields: [saleId], references: [id])
  action    String   // "CREATED", "CANCELLED"
  details   Json?
  createdAt DateTime @default(now())
  
  @@index([saleId])
}
```

---

### 6.2 Exportação de Relatórios

Adicionar funcionalidade para exportar relatórios em CSV/PDF:

```typescript
// src/app/api/reports/export/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "csv"
  const type = searchParams.get("type") || "summary"
  
  // Gerar dados...
  
  if (format === "csv") {
    const csv = generateCSV(data)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=relatorio-${type}-${Date.now()}.csv`
      }
    })
  }
}
```

---

### 6.3 Suporte a Imagens de Produtos

Adicionar campo de imagem ao produto:

```prisma
model Product {
  // ... campos existentes
  imageUrl String?
}
```

E integrar com upload de arquivos (Cloudinary, S3, etc.).

---

### 6.4 Operações em Lote para Produtos

Adicionar endpoints para atualização em massa:

```typescript
// PATCH /api/products/batch
export async function PATCH(request: NextRequest) {
  const { ids, updates } = await request.json()
  
  await prisma.product.updateMany({
    where: { id: { in: ids } },
    data: updates
  })
  
  return NextResponse.json({ updated: ids.length })
}
```

---

### 6.5 Paginação nas Vendas do Cliente

Modificar endpoint para suportar paginação:

```typescript
// GET /api/clients/[id]?salesPage=1&salesLimit=10
const salesPage = parseInt(searchParams.get("salesPage") || "1")
const salesLimit = parseInt(searchParams.get("salesLimit") || "10")

const client = await prisma.client.findFirst({
  where: { id: params.id, deletedAt: null },
  include: {
    sales: {
      where: { status: "COMPLETED" },
      skip: (salesPage - 1) * salesLimit,
      take: salesLimit,
      orderBy: { createdAt: "desc" },
      include: { items: true, payments: true }
    },
    _count: { select: { sales: { where: { status: "COMPLETED" } } } }
  }
})
```

---

### 6.6 Notificações de Estoque Baixo

Implementar sistema de notificações:

```typescript
// src/lib/notifications.ts
export async function checkLowStockNotifications() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } })
  if (!settings?.lowStockAlertEnabled) return
  
  const lowStockProducts = await prisma.$queryRaw`
    SELECT * FROM "Product"
    WHERE "deletedAt" IS NULL
    AND "stock" <= "minStock"
  `
  
  if (lowStockProducts.length > 0) {
    // Enviar notificação (email, push, etc.)
  }
}
```

---

### 6.7 Melhorar Performance com Índices

Adicionar índices compostos para queries frequentes:

```prisma
model Sale {
  // ... campos existentes
  
  @@index([status, createdAt])
  @@index([clientId, status])
}

model SaleItem {
  // ... campos existentes
  
  @@index([saleId, productId])
}
```

---

## Priorização de Correções

### Alta Prioridade (Corrigir Imediatamente)
1. **1.1** - Cálculo de taxa quando cliente paga (impacto financeiro)
2. **1.2** - Query de estoque baixo incorreta (funcionalidade quebrada)
3. **2.1** - Valores de filtro de pagamento incorretos (funcionalidade quebrada)

### Média Prioridade (Próxima Sprint)
4. **3.1** - Validação server-side do total de pagamentos
5. **4.1** - Formulários não resetam corretamente
6. **5.1** - Código duplicado getDateRange
7. **5.5** - Cache do dashboard não invalidado

### Baixa Prioridade (Backlog)
8. **1.3** - Estoque pode ficar negativo (edge case)
9. **2.2** - Lógica de desconto inconsistente
10. **3.2** - Validação de telefone
11. **3.3** - Verificação de dependências na deleção
12. **4.2** - Toggle de alerta ausente
13. **4.3** - Filtro do dashboard
14. **5.2** - Sistema de erros não utilizado
15. **5.3** - Endpoint para deletar categorias
16. **5.4** - Tipos any em uso

---

## Conclusão

A base de código está bem estruturada e segue boas práticas de desenvolvimento. Os principais problemas identificados são:

1. **Bug crítico** no cálculo de taxas quando o cliente é o absorvedor
2. **Inconsistências** nos valores de filtros que não correspondem ao banco
3. **Código duplicado** que pode ser centralizado
4. **Sistema de erros** implementado mas não utilizado

Recomenda-se priorizar as correções de alta prioridade antes de adicionar novas funcionalidades, pois impactam diretamente a operação financeira do sistema.

---

*Documento gerado em: Janeiro 2026*
*Revisão realizada por: Devin AI*
