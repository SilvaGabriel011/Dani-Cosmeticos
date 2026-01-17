# 08 - Arquitetura: Múltiplas Compras e Gestão de Pagamentos Fiado

## Contexto do Problema

Este documento aborda duas funcionalidades relacionadas à gestão de vendas fiado:

### Problema 1: Múltiplas Compras do Mesmo Cliente

Quando um cliente faz uma segunda compra (ou mais), existem dois cenários possíveis:

1. **Adicionar na conta atual** - O cliente quer aumentar o número de parcelas/faturas na sua dívida existente
2. **Criar nova fatura** - O cliente quer uma fatura separada com data de pagamento diferente

### Problema 2: Alteração de Data de Pagamento Após Venda

Após uma venda fiado ser criada/confirmada, deve ser possível alterar a data de vencimento das parcelas. Isso é necessário porque:

- Cliente pode pedir para mudar o dia de pagamento
- Situações financeiras mudam
- Erros na configuração inicial
- Renegociação de dívida

Este documento apresenta as opções de arquitetura para implementar essas funcionalidades.

---

## Estrutura Atual do Sistema

### Modelos Relevantes

```
Sale (Venda)
├── clientId (opcional, obrigatório para fiado)
├── status: COMPLETED | PENDING | CANCELLED
├── total, paidAmount, netTotal
├── paymentDay (dia do mês para pagamento)
├── installmentPlan (número de parcelas)
├── fixedInstallmentAmount (valor fixo por parcela)
└── receivables[] (parcelas a receber)

Receivable (Parcela)
├── saleId (vinculado a uma venda)
├── installment (número da parcela: 1, 2, 3...)
├── amount (valor da parcela)
├── dueDate (data de vencimento)
├── paidAmount (valor já pago)
└── status: PENDING | PARTIAL | PAID | OVERDUE
```

### Fluxo Atual

1. Cliente faz compra fiado (sem pagar tudo na hora)
2. Sistema cria Sale com status PENDING
3. Sistema cria Receivables baseado no `installmentPlan`
4. Pagamentos são registrados contra os Receivables
5. Quando tudo pago, Sale vira COMPLETED

---

## Opções de Arquitetura

### Opção A: Vendas Independentes com Agendamento Inteligente (Recomendada)

**Conceito**: Cada compra é uma Sale separada, mas o sistema oferece opções de como agendar as parcelas.

#### Como Funciona

Quando o cliente com dívida pendente faz nova compra:

**Cenário 1: "Adicionar na conta atual"**
- Nova Sale é criada normalmente
- Receivables da nova venda são agendados para o MESMO dia de pagamento das parcelas existentes
- Resultado: Cliente paga mais por mês, mas no mesmo dia

**Cenário 2: "Criar fatura separada"**
- Nova Sale é criada normalmente
- Receivables têm data de vencimento independente
- Resultado: Cliente tem duas "contas" separadas

#### Vantagens
- Não requer mudanças no schema do banco
- Cada venda mantém seu histórico independente
- Fácil de cancelar uma venda sem afetar outras
- Relatórios por venda continuam funcionando
- Flexível para diferentes cenários

#### Desvantagens
- Precisa de view consolidada para mostrar total por data
- UI precisa mostrar opção ao criar venda

#### Mudanças Necessárias

**Schema**: Nenhuma mudança obrigatória

**API** (`POST /api/sales`):
```typescript
// Novo parâmetro no createSaleSchema
alignWithExistingDebt: z.boolean().default(false)
```

**Lógica de Criação**:
```typescript
// Se alignWithExistingDebt = true
// 1. Buscar receivables pendentes do cliente
// 2. Usar o mesmo paymentDay das parcelas existentes
// 3. Criar receivables alinhados com as datas existentes
```

**UI**:
- Ao selecionar cliente com dívida pendente, mostrar modal:
  - "Este cliente tem R$ X em débito pendente"
  - Opção 1: "Adicionar à conta (mesmo dia de pagamento)"
  - Opção 2: "Criar fatura separada"

---

### Opção B: Adicionar Itens à Venda Existente

**Conceito**: Quando cliente quer "adicionar na conta", os novos itens são adicionados à Sale pendente existente.

#### Como Funciona

1. Buscar Sale pendente do cliente
2. Adicionar novos SaleItems à venda existente
3. Recalcular totais (subtotal, desconto, total)
4. Criar novos Receivables ou ajustar existentes

#### Vantagens
- Uma única Sale por "conta" do cliente
- Visão simplificada da dívida

#### Desvantagens
- Perde histórico de quando cada item foi comprado
- Complexo recalcular se descontos forem diferentes
- Difícil cancelar apenas parte da compra
- Pode ter problemas com preços que mudaram

#### Mudanças Necessárias

**Schema**: Adicionar campo para rastrear quando item foi adicionado
```prisma
model SaleItem {
  // ... campos existentes
  addedAt DateTime @default(now()) // Quando este item foi adicionado
}
```

**API**: Novo endpoint `POST /api/sales/{id}/add-items`

---

### Opção C: Modelo de "Conta do Cliente"

**Conceito**: Criar novo modelo `ClientAccount` que agrupa múltiplas vendas.

#### Como Funciona

```prisma
model ClientAccount {
  id        String   @id @default(uuid())
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id])
  sales     Sale[]
  status    AccountStatus // ACTIVE, PAID, DEFAULTED
  createdAt DateTime @default(now())
}

model Sale {
  // ... campos existentes
  accountId String?
  account   ClientAccount? @relation(...)
}
```

#### Vantagens
- Modelo explícito para "conta"
- Fácil agrupar vendas relacionadas
- Pode ter regras específicas por conta

#### Desvantagens
- Mudança significativa no schema
- Migração de dados existentes
- Mais complexidade no sistema

---

## Comparativo das Opções

| Critério | Opção A | Opção B | Opção C |
|----------|---------|---------|---------|
| Mudança no Schema | Nenhuma | Pequena | Grande |
| Complexidade | Baixa | Média | Alta |
| Histórico preservado | Sim | Parcial | Sim |
| Cancelamento parcial | Fácil | Difícil | Fácil |
| Migração necessária | Não | Não | Sim |
| Tempo de implementação | Curto | Médio | Longo |

---

## Decisão Final: Opção A Modificada

Baseado na discussão com o stakeholder, a implementação será uma **variação da Opção A** com as seguintes características:

1. **Adicionar itens à venda existente** - Quando cliente escolhe "adicionar na conta", os novos itens são adicionados à Sale existente
2. **Aumentar número de parcelas** - Novas parcelas são criadas APÓS as existentes para cobrir o valor adicionado
3. **Preservar histórico de compras** - Cada item tem data de quando foi adicionado, permitindo ver o histórico completo
4. **Dropdown para escolher conta** - Se cliente tem múltiplas contas, usuário escolhe qual

---

## Exemplo Detalhado do Fluxo

### Cenário: Cliente faz 3 compras em sequência

**Compra 1 - 15 de Janeiro:**
- Cliente compra: Shampoo (R$ 200) + Condicionador (R$ 200) + Creme (R$ 200)
- Total: R$ 600
- Escolhe: 3 parcelas de R$ 200 cada
- Parcelas criadas:
  - Parcela 1: R$ 200 - Vencimento 10/Fev
  - Parcela 2: R$ 200 - Vencimento 10/Mar
  - Parcela 3: R$ 200 - Vencimento 10/Abr

**Compra 2 - 16 de Janeiro (adiciona na conta):**
- Cliente compra: Perfume (R$ 400)
- Escolhe: "Adicionar na conta atual"
- Sistema calcula: R$ 400 / R$ 200 (valor da parcela) = 2 novas parcelas
- Novas parcelas criadas APÓS as existentes:
  - Parcela 4: R$ 200 - Vencimento 10/Mai
  - Parcela 5: R$ 200 - Vencimento 10/Jun

**Compra 3 - 17 de Janeiro (adiciona na conta):**
- Cliente compra: Batom (R$ 100) + Rímel (R$ 100)
- Total: R$ 200
- Escolhe: "Adicionar na conta atual"
- Sistema calcula: R$ 200 / R$ 200 = 1 nova parcela
- Nova parcela criada:
  - Parcela 6: R$ 200 - Vencimento 10/Jul

**Estado Final da Conta:**
```
Conta do Cliente Maria
├── Total: R$ 1.200,00
├── Parcelas: 6x de R$ 200,00
├── Dia de pagamento: 10
│
├── Histórico de Compras:
│   ├── 15/Jan: Shampoo, Condicionador, Creme (R$ 600)
│   ├── 16/Jan: Perfume (R$ 400)
│   └── 17/Jan: Batom, Rímel (R$ 200)
│
└── Parcelas:
    ├── 10/Fev: R$ 200 (PENDENTE)
    ├── 10/Mar: R$ 200 (PENDENTE)
    ├── 10/Abr: R$ 200 (PENDENTE)
    ├── 10/Mai: R$ 200 (PENDENTE)
    ├── 10/Jun: R$ 200 (PENDENTE)
    └── 10/Jul: R$ 200 (PENDENTE)
```

---

## Detalhamento da Implementação

### 1. Mudanças no Schema do Banco

```prisma
model SaleItem {
  id        String   @id @default(uuid())
  saleId    String
  sale      Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  quantity  Int
  unitPrice Decimal  @db.Decimal(10, 2)
  costPrice Decimal  @db.Decimal(10, 2)
  total     Decimal  @db.Decimal(10, 2)
  addedAt   DateTime @default(now())  // NOVO: Data em que o item foi adicionado

  @@index([saleId])
  @@index([productId])
  @@index([addedAt])  // NOVO: Índice para consultas por data
}
```

### 2. Mudanças no Schema de Validação

```typescript
// src/schemas/sale.ts

// Schema para adicionar itens a uma venda existente
export const addToExistingSaleSchema = z.object({
  saleId: z.string().uuid(),  // ID da venda existente
  items: z.array(saleItemSchema).min(1, "Pelo menos um item é obrigatório"),
})

// Schema para criar nova venda (atualizado)
export const createSaleSchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  items: z.array(saleItemSchema).min(1, "Pelo menos um item é obrigatório"),
  payments: z.array(paymentSchema).default([]),
  discountPercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  paymentDay: z.number().int().min(1).max(31).optional().nullable(),
  installmentPlan: z.number().int().min(1).max(12).default(1),
  fixedInstallmentAmount: z.number().positive().optional().nullable(),
  
  // NOVO: Opção para adicionar a uma conta existente
  addToExistingSaleId: z.string().uuid().optional().nullable(),
})
```

### 3. Novo Endpoint: Adicionar Itens à Venda Existente

```typescript
// POST /api/sales/{id}/add-items
// Adiciona novos itens a uma venda fiado existente

Request:
{
  items: [
    { productId: "uuid", quantity: 2 },
    { productId: "uuid", quantity: 1 }
  ]
}

Response:
{
  sale: {
    id: "sale-id",
    total: 1200.00,        // Atualizado
    installmentPlan: 6,    // Atualizado
    // ...
  },
  addedItems: [
    { id: "item-1", product: {...}, quantity: 2, total: 400 },
    { id: "item-2", product: {...}, quantity: 1, total: 200 }
  ],
  newReceivables: [
    { installment: 4, amount: 200, dueDate: "2026-05-10" },
    { installment: 5, amount: 200, dueDate: "2026-06-10" },
    { installment: 6, amount: 200, dueDate: "2026-07-10" }
  ]
}
```

### 4. Lógica de Adicionar Itens

```typescript
// src/services/sale.service.ts

async addItemsToSale(saleId: string, items: SaleItemInput[]) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { 
      receivables: { orderBy: { installment: "desc" }, take: 1 },
      items: true 
    }
  })
  
  if (!sale) throw new Error("Venda não encontrada")
  if (sale.status !== "PENDING") {
    throw new Error("Só é possível adicionar itens a vendas pendentes (fiado)")
  }
  
  // Buscar produtos e validar estoque
  const products = await prisma.product.findMany({
    where: { id: { in: items.map(i => i.productId) }, deletedAt: null }
  })
  
  // Calcular valor dos novos itens
  let newItemsTotal = 0
  const newSaleItems = items.map(item => {
    const product = products.find(p => p.id === item.productId)!
    const total = Number(product.salePrice) * item.quantity
    newItemsTotal += total
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: product.salePrice,
      costPrice: product.costPrice,
      total: new Decimal(total),
      addedAt: new Date()  // Marca quando foi adicionado
    }
  })
  
  // Calcular novas parcelas necessárias
  const installmentAmount = Number(sale.fixedInstallmentAmount) || 
    (Number(sale.total) / sale.installmentPlan)
  const newInstallmentsNeeded = Math.ceil(newItemsTotal / installmentAmount)
  
  // Última parcela existente
  const lastReceivable = sale.receivables[0]
  const lastInstallmentNumber = lastReceivable?.installment || 0
  const lastDueDate = lastReceivable?.dueDate || new Date()
  const paymentDay = sale.paymentDay || lastDueDate.getDate()
  
  // Criar novas parcelas
  const newReceivables = Array.from({ length: newInstallmentsNeeded }, (_, i) => {
    const dueDate = new Date(lastDueDate)
    dueDate.setMonth(dueDate.getMonth() + i + 1)
    dueDate.setDate(paymentDay)
    
    return {
      saleId,
      installment: lastInstallmentNumber + i + 1,
      amount: new Decimal(installmentAmount),
      dueDate
    }
  })
  
  // Executar em transação
  return prisma.$transaction(async (tx) => {
    // Adicionar itens
    await tx.saleItem.createMany({ data: newSaleItems.map(i => ({ ...i, saleId })) })
    
    // Criar novas parcelas
    await tx.receivable.createMany({ data: newReceivables })
    
    // Atualizar totais da venda
    const newTotal = Number(sale.total) + newItemsTotal
    const newSubtotal = Number(sale.subtotal) + newItemsTotal
    const newNetTotal = Number(sale.netTotal) + newItemsTotal
    
    const updatedSale = await tx.sale.update({
      where: { id: saleId },
      data: {
        subtotal: new Decimal(newSubtotal),
        total: new Decimal(newTotal),
        netTotal: new Decimal(newNetTotal),
        installmentPlan: lastInstallmentNumber + newInstallmentsNeeded
      },
      include: {
        client: true,
        items: { include: { product: true }, orderBy: { addedAt: "asc" } },
        receivables: { orderBy: { installment: "asc" } }
      }
    })
    
    // Decrementar estoque
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } }
      })
    }
    
    return updatedSale
  })
}
```

### 5. Mudanças na UI

#### 5.1 Dropdown para Escolher Conta (SaleForm)

Quando cliente com dívida é selecionado:

```tsx
// Mostrar opções de conta
{clientPendingSales && clientPendingSales.length > 0 && (
  <div className="space-y-4">
    <Alert>
      <AlertTitle>Cliente com débito pendente</AlertTitle>
      <AlertDescription>
        Este cliente possui {clientPendingSales.length} conta(s) em aberto.
      </AlertDescription>
    </Alert>
    
    <RadioGroup value={saleOption} onValueChange={setSaleOption}>
      <RadioGroupItem value="NEW">
        Criar nova conta (fatura separada)
      </RadioGroupItem>
      <RadioGroupItem value="EXISTING">
        Adicionar a uma conta existente
      </RadioGroupItem>
    </RadioGroup>
    
    {saleOption === "EXISTING" && (
      <Select value={selectedSaleId} onValueChange={setSelectedSaleId}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a conta" />
        </SelectTrigger>
        <SelectContent>
          {clientPendingSales.map(sale => (
            <SelectItem key={sale.id} value={sale.id}>
              Conta #{sale.id.slice(-6)} - Total: R$ {sale.total} - 
              {sale.installmentPlan} parcelas de R$ {sale.fixedInstallmentAmount}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )}
  </div>
)}
```

#### 5.2 Histórico de Compras na Página da Venda

```tsx
// Agrupar itens por data de adição
const itemsByDate = groupBy(sale.items, item => 
  formatDate(item.addedAt, "dd/MM/yyyy")
)

// Mostrar histórico
<Card>
  <CardHeader>
    <CardTitle>Histórico de Compras</CardTitle>
  </CardHeader>
  <CardContent>
    {Object.entries(itemsByDate).map(([date, items]) => (
      <div key={date} className="mb-4">
        <h4 className="font-semibold">{date}</h4>
        <ul className="ml-4">
          {items.map(item => (
            <li key={item.id}>
              {item.product.name} x{item.quantity} - R$ {item.total}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Subtotal: R$ {items.reduce((sum, i) => sum + Number(i.total), 0)}
        </p>
      </div>
    ))}
  </CardContent>
</Card>
```

### 6. Endpoint: Listar Contas Pendentes do Cliente

```typescript
// GET /api/clients/{id}/pending-sales

Response:
{
  pendingSales: [
    {
      id: "sale-1",
      total: 600.00,
      remaining: 400.00,
      installmentPlan: 3,
      fixedInstallmentAmount: 200.00,
      paymentDay: 10,
      createdAt: "2026-01-15",
      itemsCount: 3
    },
    {
      id: "sale-2",
      total: 300.00,
      remaining: 300.00,
      installmentPlan: 2,
      fixedInstallmentAmount: 150.00,
      paymentDay: 15,
      createdAt: "2026-01-10",
      itemsCount: 2
    }
  ]
}
```

---

## Considerações Adicionais

### Compras em Sequência Rápida

O sistema suporta múltiplas compras em sequência rápida (mesmo dia, dias consecutivos, etc.) sem problemas:
- Cada adição calcula novas parcelas baseado no valor fixo da parcela
- Novas parcelas são sempre adicionadas APÓS a última existente
- Histórico de cada compra é preservado pelo campo `addedAt`

### Pagamento Parcial

Quando cliente paga, o sistema distribui entre receivables (função `registerPaymentWithDistribution`). Funciona normalmente independente de quantas adições foram feitas.

### Cancelamento

Para cancelar uma venda com múltiplas adições:
- Toda a venda é cancelada (todos os itens)
- Estoque de todos os itens é restaurado
- Todas as parcelas são removidas

Não é possível cancelar apenas uma "adição" específica (isso seria muito complexo e poderia causar inconsistências).

### Relatórios

Os relatórios existentes continuam funcionando. Adicionalmente:
- Histórico de compras por cliente mostra cada adição separadamente
- Relatório de vendas pode agrupar por data de adição

### Migração

Necessária uma migração simples para adicionar o campo `addedAt` ao SaleItem:
```sql
ALTER TABLE "SaleItem" ADD COLUMN "addedAt" TIMESTAMP DEFAULT NOW();
```

---

## Funcionalidade 2: Alteração de Data de Pagamento Após Venda

### Requisito

Permitir que o usuário altere a data de vencimento das parcelas (receivables) de uma venda fiado mesmo após a venda ter sido criada/confirmada.

### Cenários de Uso

1. **Alterar dia de pagamento de todas as parcelas** - Cliente pede para mudar de dia 10 para dia 15
2. **Alterar data de uma parcela específica** - Adiar uma parcela específica
3. **Reagendar parcelas pendentes** - Mover todas as parcelas pendentes para novas datas
4. **Alterar paymentDay da venda** - Mudar o dia padrão de pagamento para futuras referências

### Implementação

#### 1. Novo Endpoint: Alterar Data de Parcela Individual

```typescript
// PATCH /api/receivables/{id}
// Altera uma parcela específica

Request:
{
  dueDate: "2026-03-15"  // Nova data de vencimento
}

Response:
{
  id: "receivable-id",
  installment: 2,
  amount: 100.00,
  dueDate: "2026-03-15",
  status: "PENDING",
  // ... outros campos
}
```

#### 2. Novo Endpoint: Reagendar Todas as Parcelas de uma Venda

```typescript
// PATCH /api/sales/{id}/reschedule
// Reagenda todas as parcelas pendentes de uma venda

Request:
{
  newPaymentDay: 15,           // Novo dia do mês (1-31)
  startFromNextMonth: true,    // Se true, começa do próximo mês
  // OU
  newStartDate: "2026-03-15"   // Data específica para primeira parcela
}

Response:
{
  sale: { ... },
  updatedReceivables: [
    { id: "r1", installment: 1, dueDate: "2026-03-15", status: "PENDING" },
    { id: "r2", installment: 2, dueDate: "2026-04-15", status: "PENDING" },
    // ...
  ]
}
```

#### 3. Schema de Validação

```typescript
// src/schemas/receivable.ts

export const updateReceivableSchema = z.object({
  dueDate: z.string().datetime().optional(),
})

export const rescheduleSaleSchema = z.object({
  newPaymentDay: z.number().int().min(1).max(31).optional(),
  startFromNextMonth: z.boolean().default(true),
  newStartDate: z.string().datetime().optional(),
}).refine(
  data => data.newPaymentDay || data.newStartDate,
  { message: "Informe newPaymentDay ou newStartDate" }
)
```

#### 4. Service Layer

```typescript
// src/services/receivable.service.ts

async updateDueDate(id: string, newDueDate: Date) {
  const receivable = await prisma.receivable.findUnique({ where: { id } })
  
  if (!receivable) throw new Error("Parcela não encontrada")
  if (receivable.status === "PAID") {
    throw new Error("Não é possível alterar data de parcela já paga")
  }
  
  return prisma.receivable.update({
    where: { id },
    data: { dueDate: newDueDate }
  })
}

async rescheduleSale(
  saleId: string, 
  options: { newPaymentDay?: number; newStartDate?: Date }
) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { receivables: { orderBy: { installment: "asc" } } }
  })
  
  if (!sale) throw new Error("Venda não encontrada")
  if (sale.status !== "PENDING") {
    throw new Error("Só é possível reagendar vendas pendentes")
  }
  
  const pendingReceivables = sale.receivables.filter(
    r => r.status === "PENDING" || r.status === "PARTIAL"
  )
  
  if (pendingReceivables.length === 0) {
    throw new Error("Não há parcelas pendentes para reagendar")
  }
  
  return prisma.$transaction(async (tx) => {
    const updates = []
    let currentDate = options.newStartDate || new Date()
    
    for (let i = 0; i < pendingReceivables.length; i++) {
      const receivable = pendingReceivables[i]
      
      // Calcular nova data
      let newDueDate: Date
      if (options.newPaymentDay) {
        newDueDate = new Date(currentDate)
        newDueDate.setMonth(newDueDate.getMonth() + i)
        newDueDate.setDate(options.newPaymentDay)
      } else {
        newDueDate = new Date(currentDate)
        newDueDate.setMonth(newDueDate.getMonth() + i)
      }
      
      const updated = await tx.receivable.update({
        where: { id: receivable.id },
        data: { dueDate: newDueDate }
      })
      updates.push(updated)
    }
    
    // Atualizar paymentDay da venda se informado
    if (options.newPaymentDay) {
      await tx.sale.update({
        where: { id: saleId },
        data: { paymentDay: options.newPaymentDay }
      })
    }
    
    return updates
  })
}
```

#### 5. Mudanças na UI

##### 5.1 Página de Detalhes da Venda

Adicionar botão "Reagendar Parcelas" na página de detalhes da venda:

```tsx
// src/app/(main)/vendas/[id]/page.tsx

{sale.status === "PENDING" && (
  <Button onClick={() => setShowRescheduleModal(true)}>
    Reagendar Parcelas
  </Button>
)}

<RescheduleModal
  open={showRescheduleModal}
  onClose={() => setShowRescheduleModal(false)}
  sale={sale}
  onSuccess={() => refetch()}
/>
```

##### 5.2 Modal de Reagendamento

```tsx
// src/components/sales/reschedule-modal.tsx

function RescheduleModal({ sale, onSuccess }) {
  const [mode, setMode] = useState<"day" | "date">("day")
  const [newPaymentDay, setNewPaymentDay] = useState(sale.paymentDay || 10)
  const [newStartDate, setNewStartDate] = useState<Date>()
  
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar Parcelas</DialogTitle>
          <DialogDescription>
            Altere a data de vencimento das parcelas pendentes
          </DialogDescription>
        </DialogHeader>
        
        <RadioGroup value={mode} onValueChange={setMode}>
          <RadioGroupItem value="day">
            Alterar dia do mês (todas as parcelas)
          </RadioGroupItem>
          <RadioGroupItem value="date">
            Definir nova data inicial
          </RadioGroupItem>
        </RadioGroup>
        
        {mode === "day" && (
          <Select value={newPaymentDay} onValueChange={setNewPaymentDay}>
            {/* Dias 1-31 */}
          </Select>
        )}
        
        {mode === "date" && (
          <DatePicker value={newStartDate} onChange={setNewStartDate} />
        )}
        
        <DialogFooter>
          <Button onClick={handleReschedule}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

##### 5.3 Edição Inline de Parcela Individual

Na tabela de receivables, permitir edição da data:

```tsx
// Na lista de parcelas
<Table>
  <TableBody>
    {receivables.map(receivable => (
      <TableRow key={receivable.id}>
        <TableCell>{receivable.installment}</TableCell>
        <TableCell>R$ {receivable.amount}</TableCell>
        <TableCell>
          {receivable.status === "PAID" ? (
            formatDate(receivable.dueDate)
          ) : (
            <DatePicker
              value={receivable.dueDate}
              onChange={(date) => handleUpdateDueDate(receivable.id, date)}
            />
          )}
        </TableCell>
        <TableCell>{receivable.status}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Regras de Negócio

1. **Parcelas pagas não podem ser alteradas** - Só parcelas PENDING ou PARTIAL
2. **Venda cancelada não pode ser reagendada** - Status deve ser PENDING
3. **Data não pode ser no passado** - Validar que nova data >= hoje
4. **Manter ordem das parcelas** - Parcela 1 sempre antes da 2, etc.
5. **Atualizar paymentDay da venda** - Quando reagendar todas, atualizar o campo na Sale

### Considerações de Auditoria

Opcionalmente, pode-se criar um log de alterações:

```prisma
model ReceivableHistory {
  id            String   @id @default(uuid())
  receivableId  String
  receivable    Receivable @relation(...)
  field         String   // "dueDate", "amount", etc.
  oldValue      String
  newValue      String
  changedAt     DateTime @default(now())
  reason        String?  // Motivo da alteração (opcional)
}
```

---

## Decisões Tomadas (Resumo)

### Sobre Múltiplas Compras

| Pergunta | Decisão |
|----------|---------|
| Como adicionar na conta? | Criar novas parcelas APÓS as existentes (opção c) |
| Múltiplas contas? | Dropdown para usuário escolher qual conta |
| Escolher data manualmente? | Sim, se criar nova fatura; Não, se adicionar à existente |
| Histórico de compras? | Sim, mostrar quais itens foram comprados em cada data |

### Sobre Alteração de Data

| Pergunta | Decisão |
|----------|---------|
| Exigir motivo? | Não |
| Histórico de alterações? | Não (mas manter histórico de compras/itens) |
| Notificar cliente? | Não necessário |
| Limite de reagendamentos? | Não |

---

## Próximos Passos para Implementação

### Fase 1: Preparação do Banco
1. Criar migração para adicionar campo `addedAt` ao SaleItem
2. Executar migração

### Fase 2: Backend - Múltiplas Compras
3. Criar endpoint `GET /api/clients/{id}/pending-sales`
4. Criar endpoint `POST /api/sales/{id}/add-items`
5. Atualizar lógica de criação de receivables

### Fase 3: Backend - Alteração de Data
6. Criar endpoint `PATCH /api/receivables/{id}`
7. Criar endpoint `PATCH /api/sales/{id}/reschedule`

### Fase 4: Frontend - Múltiplas Compras
8. Modificar SaleForm para mostrar dropdown de contas
9. Implementar histórico de compras na página da venda

### Fase 5: Frontend - Alteração de Data
10. Implementar modal de reagendamento
11. Adicionar edição inline na tabela de parcelas

### Fase 6: Testes e Documentação
12. Testar cenários de múltiplas compras em sequência
13. Testar reagendamento de parcelas
14. Atualizar documentação do sistema
