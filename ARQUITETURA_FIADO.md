# Arquitetura de Dados - Sistema de Fiado

Este documento analisa a implementação atual do sistema de vendas fiado, identifica problemas de lógica, over-engineering, slop code e bugs, e propõe uma arquitetura robusta para as próximas iterações.

---

## Sumário

1. [Problema Principal: Sistema Dual de Pagamentos](#1-problema-principal-sistema-dual-de-pagamentos)
2. [Bugs e Problemas de Lógica](#2-bugs-e-problemas-de-lógica)
3. [Over-Engineering e Slop Code](#3-over-engineering-e-slop-code)
4. [Impacto nos Relatórios e Dados](#4-impacto-nos-relatórios-e-dados)
5. [Proposta de Arquitetura Unificada](#5-proposta-de-arquitetura-unificada)
6. [Guia de Implementação](#6-guia-de-implementação)

---

## 1. Problema Principal: Sistema Dual de Pagamentos

### Situação Atual

O sistema possui **duas formas independentes** de registrar pagamentos para vendas fiado:

| Sistema | Endpoint | Modelo | Usado em |
|---------|----------|--------|----------|
| Pagamentos | `POST /api/sales/[id]/payments` | `Payment` | `ReceivePaymentDialog` (lista de vendas) |
| Parcelas | `POST /api/receivables/[id]/pay` | `Receivable` | `ClientReceivables` (página do cliente) |

### Por que isso é um problema?

Esses dois sistemas **não se comunicam**, criando inconsistência de dados:

```
CENÁRIO DE PROBLEMA:

1. Usuário cria venda fiado de R$100 com 2 parcelas
   → Sistema cria 2 Receivables: R$50 cada
   → sale.paidAmount = 0
   → sale.status = "PENDING"

2. Usuário vai na lista de vendas e clica "Receber Pagamento"
   → Usa ReceivePaymentDialog → POST /api/sales/[id]/payments
   → Cria Payment de R$50
   → sale.paidAmount = 50
   → Receivables NÃO são atualizados! Ainda mostram R$50 + R$50 pendentes

3. Usuário vai na página do cliente e vê "Contas a Receber"
   → Vê R$100 pendentes (os Receivables não foram atualizados)
   → Paga R$50 via ClientReceivables → POST /api/receivables/[id]/pay
   → Receivable atualizado, sale.paidAmount = 100

4. RESULTADO: Cliente pagou R$100, mas sistema tem:
   - 1 Payment de R$50
   - 1 Receivable pago de R$50
   - 1 Receivable pendente de R$50 (ERRO!)
   - Dados inconsistentes e confusos
```

### Diagrama do Fluxo Atual (Problemático)

```
┌─────────────────────────────────────────────────────────────────┐
│                        VENDA FIADO                               │
│                     (status: PENDING)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   ReceivePaymentDialog  │     │    ClientReceivables    │
│   (Lista de Vendas)     │     │   (Página do Cliente)   │
└─────────────────────────┘     └─────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ POST /sales/[id]/payments│    │ POST /receivables/[id]/pay│
└─────────────────────────┘     └─────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   Cria Payment record   │     │ Atualiza Receivable     │
│   Atualiza sale.paidAmount│   │ Atualiza sale.paidAmount│
│   NÃO atualiza Receivables│   │ NÃO cria Payment        │
└─────────────────────────┘     └─────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  INCONSISTÊNCIA │
                    │   DE DADOS!     │
                    └─────────────────┘
```

---

## 2. Bugs e Problemas de Lógica

### 2.1 Receivables Não Criados para Fiado Simples (CRÍTICO)

**Arquivo:** `src/app/api/sales/route.ts` (linha 243)

**Problema:** Receivables só são criados quando `isInstallment` está marcado no formulário:

```typescript
// Só cria receivables se tiver dueDate E installmentPlan
if (dueDate && installmentPlan && installmentPlan >= 1 && !isPaid) {
  // ...cria receivables
}
```

**Cenário de bug:**
1. Usuário cria venda fiado SEM marcar "Venda parcelada"
2. Venda fica com status PENDING
3. Nenhum Receivable é criado
4. Não há como rastrear quando o cliente deve pagar
5. Não aparece em "Contas a Receber" do cliente

**Solução:** Sempre criar Receivable para vendas não pagas:

```typescript
// Criar receivable para QUALQUER venda não totalmente paga
if (!isPaid) {
  const installments = installmentPlan || 1
  const installmentAmount = total / installments
  const baseDate = dueDate ? new Date(dueDate) : new Date()
  
  // Se não tem dueDate, usar data atual + 30 dias como padrão
  if (!dueDate) {
    baseDate.setDate(baseDate.getDate() + 30)
  }

  const receivables = Array.from({ length: installments }, (_, i) => {
    const installmentDueDate = new Date(baseDate)
    installmentDueDate.setMonth(installmentDueDate.getMonth() + i)
    return {
      saleId: newSale.id,
      installment: i + 1,
      amount: new Decimal(installmentAmount),
      dueDate: installmentDueDate,
    }
  })

  await tx.receivable.createMany({ data: receivables })
}
```

---

### 2.2 Valores de Filtro de Pagamento Incorretos

**Arquivo:** `src/components/sales/sale-list.tsx` (linhas 41-46)

**Problema:** Os valores não correspondem ao enum do banco:

```typescript
// ERRADO - valores não batem com PaymentMethod enum
const paymentOptions = [
  { value: "MONEY", label: "Dinheiro" },        // Deveria ser "CASH"
  { value: "PIX", label: "PIX" },                // OK
  { value: "CREDIT_CARD", label: "Cartão Crédito" },  // Deveria ser "CREDIT"
  { value: "DEBIT_CARD", label: "Cartão Débito" },    // Deveria ser "DEBIT"
]
```

**Solução:** Usar as constantes existentes:

```typescript
import { PAYMENT_METHOD_LABELS } from "@/lib/constants"

const paymentOptions = Object.entries(PAYMENT_METHOD_LABELS).map(
  ([value, label]) => ({ value, label })
)
```

---

### 2.3 Lógica de Desconto Falha com Zero

**Arquivo:** `src/components/sales/sale-form.tsx` (linha 85)

**Problema:** Se usuário define desconto como 0, o sistema usa o desconto do cliente:

```typescript
// ERRADO - 0 é falsy, então usa desconto do cliente
const effectiveDiscount = discountPercent || Number(selectedClient?.discount || 0)
```

**Solução:**

```typescript
// CORRETO - verificar undefined/null explicitamente
const effectiveDiscount = discountPercent !== undefined && discountPercent !== null
  ? discountPercent
  : Number(selectedClient?.discount || 0)
```

---

### 2.4 Pagamento de Receivable Não Cria Payment Record

**Arquivo:** `src/services/receivable.service.ts` (linha 111)

**Problema:** Quando paga via Receivable, não há registro de COMO foi pago:

```typescript
async registerPayment(id: string, amount: number, paidAt?: Date) {
  // Atualiza receivable.paidAmount
  // Atualiza sale.paidAmount
  // MAS NÃO CRIA Payment record!
  // Não registra método de pagamento, taxas, etc.
}
```

**Impacto:**
- Relatórios por método de pagamento ficam incompletos
- Não há auditoria de como o fiado foi quitado
- Taxas de cartão não são calculadas

---

### 2.5 Status da Venda Não Atualiza ao Quitar Receivables

**Arquivo:** `src/services/receivable.service.ts` (linha 144)

**Problema:** `updateSalePaidAmount` só atualiza o valor, não o status:

```typescript
async updateSalePaidAmount(saleId: string) {
  const totalPaid = receivables.reduce(...)
  
  await prisma.sale.update({
    where: { id: saleId },
    data: { paidAmount: totalPaid },
    // FALTA: atualizar status para COMPLETED se totalPaid >= total
  })
}
```

**Solução:**

```typescript
async updateSalePaidAmount(saleId: string) {
  const sale = await prisma.sale.findUnique({ where: { id: saleId } })
  const receivables = await prisma.receivable.findMany({ where: { saleId } })
  
  const totalPaid = receivables.reduce(
    (sum, r) => sum + Number(r.paidAmount),
    0
  )
  
  const isPaid = totalPaid >= Number(sale.total) - 0.01
  
  await prisma.sale.update({
    where: { id: saleId },
    data: { 
      paidAmount: totalPaid,
      status: isPaid ? "COMPLETED" : "PENDING"
    },
  })
}
```

---

### 2.6 Status OVERDUE Nunca é Definido Automaticamente

**Problema:** O enum tem `OVERDUE` mas nunca é usado no banco:

```typescript
// Em client-receivables.tsx - só calcula na exibição
const isOverdue = new Date(receivable.dueDate) < new Date() && receivable.status !== "PAID"
const displayStatus = isOverdue ? "OVERDUE" : receivable.status
```

**Solução:** Criar job agendado ou verificar no GET:

```typescript
// Opção 1: Atualizar no GET da API
async function updateOverdueStatus() {
  await prisma.receivable.updateMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: new Date() }
    },
    data: { status: "OVERDUE" }
  })
}

// Opção 2: Criar cron job (recomendado para produção)
// Executar diariamente às 00:00
```

---

## 3. Over-Engineering e Slop Code

### 3.1 Dois Diálogos de Pagamento Fazendo a Mesma Coisa

**Arquivos:**
- `src/components/sales/receive-payment-dialog.tsx`
- `src/components/clients/client-receivables.tsx` (diálogo interno)

**Problema:** Dois componentes diferentes para registrar pagamento, cada um usando um endpoint diferente. Isso confunde o usuário e o desenvolvedor.

**Solução:** Unificar em um único componente que:
1. Mostra as parcelas pendentes (Receivables)
2. Permite pagar uma ou mais parcelas
3. Registra o método de pagamento
4. Cria Payment record E atualiza Receivable

---

### 3.2 Uso Excessivo de `any`

**Arquivos afetados:**

```typescript
// client-receivables.tsx
const [paymentDialog, setPaymentDialog] = useState<{
  open: boolean
  receivable: any | null  // SLOP
}>({ open: false, receivable: null })

const handleOpenPayment = (receivable: any) => { ... }  // SLOP

const pendingReceivables = receivables?.filter(
  (r: any) => r.status !== "PAID"  // SLOP
) || []

// receivables-card.tsx
receivables.slice(0, 5).map((receivable: any) => { ... })  // SLOP

// dashboard/page.tsx
data.recentSales.map((sale: any) => { ... })  // SLOP
```

**Solução:** Definir tipos apropriados:

```typescript
// src/types/receivable.ts
export interface Receivable {
  id: string
  saleId: string
  installment: number
  amount: string | number
  dueDate: string
  paidAmount: string | number
  paidAt: string | null
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE"
  createdAt: string
  sale?: {
    id: string
    client?: { name: string } | null
  }
}

// Usar nos componentes
const [paymentDialog, setPaymentDialog] = useState<{
  open: boolean
  receivable: Receivable | null
}>({ open: false, receivable: null })
```

---

### 3.3 Função `getDateRange` Duplicada em 3 Arquivos

**Arquivos:**
- `src/components/sales/sale-list.tsx`
- `src/app/(main)/dashboard/page.tsx`
- `src/app/(main)/relatorios/page.tsx`

**Solução:** Mover para `src/lib/utils.ts`:

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

## 4. Impacto nos Relatórios e Dados

### 4.1 Receita Inflada por Vendas Fiado

**Problema:** Relatórios somam `sale.total` incluindo vendas não pagas:

```
Exemplo:
- Venda 1: R$100 (COMPLETED, pago)
- Venda 2: R$200 (PENDING, fiado)
- Venda 3: R$150 (COMPLETED, pago)

Relatório atual mostra: R$450 de receita
Receita REAL recebida: R$250
```

**Solução:** Separar métricas nos relatórios:

```typescript
// Receita efetiva (dinheiro em caixa)
const actualRevenue = sales
  .filter(s => s.status !== "CANCELLED")
  .reduce((sum, s) => sum + Number(s.paidAmount), 0)

// Receita pendente (fiado a receber)
const pendingRevenue = sales
  .filter(s => s.status === "PENDING")
  .reduce((sum, s) => sum + (Number(s.total) - Number(s.paidAmount)), 0)

// Receita total esperada
const expectedRevenue = actualRevenue + pendingRevenue
```

### 4.2 Gráfico de Métodos de Pagamento Incompleto

**Problema:** Pagamentos feitos via Receivable não aparecem no gráfico porque não criam Payment record.

**Solução:** Incluir na proposta de arquitetura unificada.

---

## 5. Proposta de Arquitetura Unificada

### Princípio: Um Único Fluxo de Pagamento

```
┌─────────────────────────────────────────────────────────────────┐
│                        VENDA FIADO                               │
│                     (status: PENDING)                            │
│                                                                  │
│  Sempre cria Receivables (mesmo sem parcelamento)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RECEIVABLES                                   │
│  - Parcela 1: R$50, vence 15/02                                 │
│  - Parcela 2: R$50, vence 15/03                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              ÚNICO DIÁLOGO DE PAGAMENTO                          │
│                                                                  │
│  Selecione a(s) parcela(s) a pagar:                             │
│  [x] Parcela 1 - R$50                                           │
│  [ ] Parcela 2 - R$50                                           │
│                                                                  │
│  Forma de pagamento: [PIX ▼]                                    │
│  Valor: [R$ 50,00]                                              │
│                                                                  │
│  [Confirmar Pagamento]                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              ENDPOINT UNIFICADO                                  │
│         POST /api/receivables/[id]/pay                          │
│                                                                  │
│  1. Valida valor e parcela                                      │
│  2. Cria Payment record (método, taxa, etc)                     │
│  3. Atualiza Receivable (paidAmount, status)                    │
│  4. Atualiza Sale (paidAmount, status se quitado)               │
└─────────────────────────────────────────────────────────────────┘
```

### Mudanças no Schema

```prisma
model Receivable {
  id          String           @id @default(uuid())
  saleId      String
  sale        Sale             @relation(fields: [saleId], references: [id], onDelete: Cascade)
  installment Int
  amount      Decimal          @db.Decimal(10, 2)
  dueDate     DateTime
  paidAmount  Decimal          @default(0) @db.Decimal(10, 2)
  paidAt      DateTime?
  status      ReceivableStatus @default(PENDING)
  createdAt   DateTime         @default(now())
  
  // NOVO: Relacionamento com pagamentos
  payments    ReceivablePayment[]

  @@index([saleId])
  @@index([dueDate])
  @@index([status])
}

// NOVO: Tabela de junção para rastrear pagamentos de parcelas
model ReceivablePayment {
  id           String      @id @default(uuid())
  receivableId String
  receivable   Receivable  @relation(fields: [receivableId], references: [id], onDelete: Cascade)
  paymentId    String
  payment      Payment     @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  amount       Decimal     @db.Decimal(10, 2)
  createdAt    DateTime    @default(now())

  @@index([receivableId])
  @@index([paymentId])
}

model Payment {
  id           String        @id @default(uuid())
  saleId       String
  sale         Sale          @relation(fields: [saleId], references: [id], onDelete: Cascade)
  method       PaymentMethod
  amount       Decimal       @db.Decimal(10, 2)
  feePercent   Decimal       @default(0) @db.Decimal(5, 2)
  feeAmount    Decimal       @default(0) @db.Decimal(10, 2)
  feeAbsorber  FeeAbsorber   @default(SELLER)
  installments Int           @default(1)
  paidAt       DateTime      @default(now())
  
  // NOVO: Relacionamento com parcelas pagas
  receivablePayments ReceivablePayment[]

  @@index([saleId])
  @@index([method])
  @@index([paidAt])
}
```

### Novo Serviço Unificado

```typescript
// src/services/payment.service.ts
export const paymentService = {
  async payReceivable(
    receivableId: string,
    data: {
      amount: number
      method: PaymentMethod
      feePercent?: number
      feeAbsorber?: FeeAbsorber
      installments?: number
    }
  ) {
    const receivable = await prisma.receivable.findUnique({
      where: { id: receivableId },
      include: { sale: true }
    })
    
    if (!receivable) throw new Error("Parcela não encontrada")
    if (receivable.status === "PAID") throw new Error("Parcela já está paga")
    
    const remaining = Number(receivable.amount) - Number(receivable.paidAmount)
    if (data.amount > remaining + 0.01) {
      throw new Error(`Valor máximo: R$ ${remaining.toFixed(2)}`)
    }
    
    const feePercent = data.feePercent || 0
    const feeAmount = data.amount * (feePercent / 100)
    const feeAbsorber = data.feeAbsorber || "SELLER"
    
    return prisma.$transaction(async (tx) => {
      // 1. Criar Payment record
      const payment = await tx.payment.create({
        data: {
          saleId: receivable.saleId,
          method: data.method,
          amount: data.amount,
          feePercent,
          feeAmount,
          feeAbsorber,
          installments: data.installments || 1,
        }
      })
      
      // 2. Criar vínculo Receivable-Payment
      await tx.receivablePayment.create({
        data: {
          receivableId,
          paymentId: payment.id,
          amount: data.amount,
        }
      })
      
      // 3. Atualizar Receivable
      const newPaidAmount = Number(receivable.paidAmount) + data.amount
      const isParcPaid = newPaidAmount >= Number(receivable.amount) - 0.01
      
      await tx.receivable.update({
        where: { id: receivableId },
        data: {
          paidAmount: newPaidAmount,
          paidAt: isParcPaid ? new Date() : null,
          status: isParcPaid ? "PAID" : newPaidAmount > 0 ? "PARTIAL" : "PENDING",
        }
      })
      
      // 4. Atualizar Sale
      const allReceivables = await tx.receivable.findMany({
        where: { saleId: receivable.saleId }
      })
      
      const totalPaid = allReceivables.reduce(
        (sum, r) => sum + (r.id === receivableId ? newPaidAmount : Number(r.paidAmount)),
        0
      )
      
      const sale = receivable.sale
      const isSalePaid = totalPaid >= Number(sale.total) - 0.01
      
      // Atualizar taxas se vendedor absorve
      let newTotalFees = Number(sale.totalFees)
      if (feeAbsorber === "SELLER") {
        newTotalFees += feeAmount
      }
      
      await tx.sale.update({
        where: { id: receivable.saleId },
        data: {
          paidAmount: totalPaid,
          totalFees: newTotalFees,
          netTotal: Number(sale.total) - newTotalFees,
          status: isSalePaid ? "COMPLETED" : "PENDING",
        }
      })
      
      return payment
    })
  }
}
```

---

## 6. Guia de Implementação

### Fase 1: Correções Urgentes (1-2 dias)

1. **Corrigir valores do filtro de pagamento**
   - Arquivo: `src/components/sales/sale-list.tsx`
   - Usar constantes de `PAYMENT_METHOD_LABELS`

2. **Corrigir lógica de desconto**
   - Arquivo: `src/components/sales/sale-form.tsx`
   - Usar verificação explícita de undefined

3. **Sempre criar Receivables para fiado**
   - Arquivo: `src/app/api/sales/route.ts`
   - Remover condição de `dueDate && installmentPlan`

### Fase 2: Unificação de Pagamentos (3-5 dias)

1. **Criar migration para ReceivablePayment**
   - Adicionar tabela de junção
   - Manter compatibilidade com dados existentes

2. **Criar paymentService unificado**
   - Implementar `payReceivable` conforme proposto
   - Deprecar endpoint `/api/sales/[id]/payments`

3. **Unificar componente de pagamento**
   - Criar `PayReceivableDialog` único
   - Mostrar parcelas pendentes
   - Registrar método de pagamento

### Fase 3: Melhorias de Relatórios (2-3 dias)

1. **Separar métricas de receita**
   - Receita efetiva vs pendente
   - Adicionar cards no dashboard

2. **Adicionar relatório de fiado**
   - Clientes com maior débito
   - Parcelas vencidas
   - Previsão de recebimentos

### Fase 4: Qualidade de Código (1-2 dias)

1. **Remover todos os `any`**
   - Criar tipos para Receivable, Sale, etc.
   - Tipar todos os componentes

2. **Centralizar funções duplicadas**
   - Mover `getDateRange` para utils
   - Criar constantes compartilhadas

3. **Adicionar job de atualização de status**
   - Marcar Receivables como OVERDUE automaticamente

---

## Resumo das Prioridades

| Prioridade | Item | Impacto |
|------------|------|---------|
| CRÍTICA | Unificar sistema de pagamentos | Evita inconsistência de dados |
| CRÍTICA | Sempre criar Receivables para fiado | Permite rastrear débitos |
| ALTA | Corrigir filtro de pagamento | Funcionalidade quebrada |
| ALTA | Corrigir lógica de desconto | Bug de UX |
| MÉDIA | Separar métricas de receita | Relatórios enganosos |
| MÉDIA | Remover tipos `any` | Qualidade de código |
| BAIXA | Centralizar funções | Manutenibilidade |

---

## Conclusão

O sistema atual de fiado tem um problema arquitetural fundamental: dois caminhos independentes para registrar pagamentos que não se comunicam. Isso causa:

1. **Dados inconsistentes** - Pagamentos podem ser registrados em um sistema mas não no outro
2. **Confusão do usuário** - Dois lugares diferentes para fazer a mesma coisa
3. **Relatórios incorretos** - Pagamentos via Receivable não aparecem em relatórios por método

A solução proposta unifica o fluxo em torno do modelo Receivable, garantindo que:
- Todo fiado tenha parcelas rastreáveis
- Todo pagamento registre o método usado
- Relatórios reflitam a realidade do negócio
- Usuário tenha uma experiência consistente

---

*Documento gerado em: Janeiro 2026*
*Análise realizada por: Devin AI*
