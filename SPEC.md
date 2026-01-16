# Cosméticos App - Especificação Técnica

> **Documento de referência para implementação. NÃO ALTERAR durante o desenvolvimento.**

---

## 1. Visão Geral

**Objetivo**: App web para controle de vendas e estoque de itens cosméticos.

**Plataforma**: Web responsivo (tablet), hospedado na Vercel.

**Usuário**: Single-user (sem autenticação).

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Framework | Next.js (App Router) | 14.x |
| Linguagem | TypeScript | 5.x |
| Estilização | TailwindCSS | 3.x |
| Componentes | shadcn/ui | latest |
| ORM | Prisma | 5.x |
| Banco de Dados | PostgreSQL (Neon) | - |
| Validação | Zod | 3.x |
| Estado/Cache | TanStack React Query | 5.x |
| Ícones | Lucide React | latest |
| Datas | date-fns | 3.x |
| Deploy | Vercel | - |

---

## 3. Módulos do Sistema

### 3.1 Dashboard
- Resumo de vendas (hoje/semana/mês)
- Valor total em estoque
- Alertas de estoque baixo
- Últimas vendas

### 3.2 Estoque (Produtos)
- CRUD de produtos
- Campos: código, nome, categoria, custo, margem, preço venda, estoque, estoque mínimo
- Preço de venda = custo × (1 + margem/100)
- Alerta quando estoque ≤ estoque mínimo
- Soft delete (deletedAt)

### 3.3 Clientes
- CRUD de clientes
- Campos: nome, telefone, endereço, desconto fixo (%)
- Histórico de compras do cliente
- Soft delete (deletedAt)

### 3.4 Vendas
- Criar venda com múltiplos itens
- Cliente opcional (se selecionado, aplica desconto fixo)
- Múltiplas formas de pagamento (dividir)
- Formas: Dinheiro, PIX, Débito, Crédito
- Taxa de cartão configurável
- Quem absorve taxa: vendedor ou cliente
- Parcelas apenas para crédito (1-12x)
- Cancelar venda devolve estoque
- Status: COMPLETED, CANCELLED

### 3.5 Relatórios
- Filtro por período (data início/fim)
- Resumo geral (total vendido, lucro, ticket médio)
- Vendas por produto (ranking)
- Vendas por forma de pagamento

### 3.6 Configurações
- Taxa débito (%)
- Taxa crédito à vista (%)
- Taxa crédito parcelado (%)
- Quem absorve taxa por padrão (vendedor/cliente)
- Alerta de estoque baixo (on/off)

---

## 4. Modelo de Dados (Prisma Schema)

### 4.1 Enums

```prisma
enum PaymentMethod {
  CASH      // Dinheiro
  PIX
  DEBIT     // Cartão Débito
  CREDIT    // Cartão Crédito
}

enum FeeAbsorber {
  SELLER    // Vendedor absorve
  CLIENT    // Cliente paga
}

enum SaleStatus {
  COMPLETED
  CANCELLED
}
```

### 4.2 Category

```prisma
model Category {
  id        String    @id @default(uuid())
  name      String    @unique
  createdAt DateTime  @default(now())
  products  Product[]
}
```

### 4.3 Product

```prisma
model Product {
  id           String     @id @default(uuid())
  code         String?    @unique
  name         String
  categoryId   String?
  category     Category?  @relation(fields: [categoryId], references: [id])
  costPrice    Decimal    @db.Decimal(10, 2)
  profitMargin Decimal    @db.Decimal(5, 2)
  salePrice    Decimal    @db.Decimal(10, 2)
  stock        Int        @default(0)
  minStock     Int        @default(5)
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  deletedAt    DateTime?
  saleItems    SaleItem[]

  @@index([categoryId])
  @@index([isActive])
  @@index([deletedAt])
}
```

### 4.4 Client

```prisma
model Client {
  id        String    @id @default(uuid())
  name      String
  phone     String
  address   String
  discount  Decimal   @default(0) @db.Decimal(5, 2)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  sales     Sale[]

  @@index([deletedAt])
}
```

### 4.5 Sale

```prisma
model Sale {
  id              String     @id @default(uuid())
  clientId        String?
  client          Client?    @relation(fields: [clientId], references: [id])
  subtotal        Decimal    @db.Decimal(10, 2)
  discountPercent Decimal    @default(0) @db.Decimal(5, 2)
  discountAmount  Decimal    @default(0) @db.Decimal(10, 2)
  totalFees       Decimal    @default(0) @db.Decimal(10, 2)
  total           Decimal    @db.Decimal(10, 2)
  netTotal        Decimal    @db.Decimal(10, 2)
  status          SaleStatus @default(COMPLETED)
  notes           String?
  createdAt       DateTime   @default(now())
  items           SaleItem[]
  payments        Payment[]

  @@index([clientId])
  @@index([status])
  @@index([createdAt])
}
```

### 4.6 SaleItem

```prisma
model SaleItem {
  id        String  @id @default(uuid())
  saleId    String
  sale      Sale    @relation(fields: [saleId], references: [id], onDelete: Cascade)
  productId String
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  unitPrice Decimal @db.Decimal(10, 2)
  costPrice Decimal @db.Decimal(10, 2)
  total     Decimal @db.Decimal(10, 2)

  @@index([saleId])
  @@index([productId])
}
```

### 4.7 Payment

```prisma
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

  @@index([saleId])
  @@index([method])
}
```

### 4.8 Settings

```prisma
model Settings {
  id                   String      @id @default("default")
  debitFeePercent      Decimal     @default(1.5) @db.Decimal(5, 2)
  creditFeePercent     Decimal     @default(3.0) @db.Decimal(5, 2)
  creditInstallmentFee Decimal     @default(4.0) @db.Decimal(5, 2)
  defaultFeeAbsorber   FeeAbsorber @default(SELLER)
  lowStockAlertEnabled Boolean     @default(true)
  updatedAt            DateTime    @updatedAt
}
```

---

## 5. Estrutura de Pastas

```
cosmeticos-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Redirect para /dashboard
│   │   ├── globals.css
│   │   ├── providers.tsx               # QueryClientProvider
│   │   │
│   │   ├── (main)/                     # Layout com sidebar
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── estoque/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── vendas/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── nova/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── clientes/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── relatorios/page.tsx
│   │   │   └── configuracoes/page.tsx
│   │   │
│   │   └── api/
│   │       ├── products/
│   │       │   ├── route.ts
│   │       │   ├── [id]/route.ts
│   │       │   └── low-stock/route.ts
│   │       ├── categories/route.ts
│   │       ├── clients/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── sales/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── cancel/route.ts
│   │       ├── reports/
│   │       │   ├── summary/route.ts
│   │       │   ├── by-product/route.ts
│   │       │   └── by-payment/route.ts
│   │       └── settings/route.ts
│   │
│   ├── components/
│   │   ├── ui/                         # shadcn/ui
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── page-header.tsx
│   │   ├── products/
│   │   │   ├── product-form.tsx
│   │   │   ├── product-table.tsx
│   │   │   └── low-stock-alert.tsx
│   │   ├── clients/
│   │   │   ├── client-form.tsx
│   │   │   ├── client-table.tsx
│   │   │   └── client-select.tsx
│   │   ├── sales/
│   │   │   ├── sale-form/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── item-selector.tsx
│   │   │   │   ├── payment-form.tsx
│   │   │   │   └── summary.tsx
│   │   │   ├── sale-table.tsx
│   │   │   └── sale-details.tsx
│   │   └── dashboard/
│   │       ├── summary-cards.tsx
│   │       ├── recent-sales.tsx
│   │       └── low-stock-list.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── utils.ts
│   │   └── constants.ts
│   │
│   ├── schemas/
│   │   ├── product.schema.ts
│   │   ├── client.schema.ts
│   │   ├── sale.schema.ts
│   │   └── settings.schema.ts
│   │
│   ├── services/
│   │   ├── product.service.ts
│   │   ├── client.service.ts
│   │   ├── sale.service.ts
│   │   ├── report.service.ts
│   │   └── settings.service.ts
│   │
│   ├── hooks/
│   │   ├── use-products.ts
│   │   ├── use-clients.ts
│   │   ├── use-sales.ts
│   │   ├── use-categories.ts
│   │   ├── use-settings.ts
│   │   └── use-reports.ts
│   │
│   └── types/
│       └── index.ts
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── .env.example
├── package.json
├── tailwind.config.ts
├── components.json                     # shadcn config
└── README.md
```

---

## 6. API Endpoints

### 6.1 Products

| Método | Endpoint | Params | Descrição |
|--------|----------|--------|-----------|
| GET | `/api/products` | `?page&limit&search&categoryId&active` | Lista paginada |
| POST | `/api/products` | body: ProductCreate | Criar produto |
| GET | `/api/products/:id` | - | Buscar produto |
| PUT | `/api/products/:id` | body: ProductUpdate | Atualizar |
| DELETE | `/api/products/:id` | - | Soft delete |
| GET | `/api/products/low-stock` | - | Produtos com estoque baixo |

### 6.2 Categories

| Método | Endpoint | Params | Descrição |
|--------|----------|--------|-----------|
| GET | `/api/categories` | - | Lista todas |
| POST | `/api/categories` | body: { name } | Criar categoria |

### 6.3 Clients

| Método | Endpoint | Params | Descrição |
|--------|----------|--------|-----------|
| GET | `/api/clients` | `?page&limit&search` | Lista paginada |
| POST | `/api/clients` | body: ClientCreate | Criar cliente |
| GET | `/api/clients/:id` | `?includeSales` | Buscar + histórico |
| PUT | `/api/clients/:id` | body: ClientUpdate | Atualizar |
| DELETE | `/api/clients/:id` | - | Soft delete |

### 6.4 Sales

| Método | Endpoint | Params | Descrição |
|--------|----------|--------|-----------|
| GET | `/api/sales` | `?page&limit&startDate&endDate&status` | Lista paginada |
| POST | `/api/sales` | body: SaleCreate | Criar venda |
| GET | `/api/sales/:id` | - | Detalhes completos |
| POST | `/api/sales/:id/cancel` | - | Cancelar + devolver estoque |

### 6.5 Reports

| Método | Endpoint | Params | Descrição |
|--------|----------|--------|-----------|
| GET | `/api/reports/summary` | `?startDate&endDate` | Totais gerais |
| GET | `/api/reports/by-product` | `?startDate&endDate&limit` | Ranking produtos |
| GET | `/api/reports/by-payment` | `?startDate&endDate` | Por forma pagamento |

### 6.6 Settings

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/settings` | Buscar configurações |
| PUT | `/api/settings` | Atualizar configurações |

---

## 7. Regras de Negócio

### 7.1 Produto

```
salePrice = costPrice × (1 + profitMargin / 100)
```

- Soft delete: marca `deletedAt`, não exclui fisicamente
- Filtros padrão excluem `deletedAt != null`
- Alerta quando `stock <= minStock`

### 7.2 Venda - Criação

```
1. Validar estoque (alerta se zerado, mas permite)
2. Para cada item:
   - Guardar unitPrice e costPrice do momento
   - total = unitPrice × quantity
   - Decrementar stock do produto
3. subtotal = Σ(item.total)
4. Se cliente:
   - discountPercent = cliente.discount
   - discountAmount = subtotal × (discountPercent / 100)
5. Para cada pagamento:
   - Se DEBIT/CREDIT: pegar feePercent da config ou input
   - feeAmount = amount × (feePercent / 100)
   - Se feeAbsorber = SELLER: soma em totalFees
   - Se feeAbsorber = CLIENT: adiciona ao total cobrado
6. total = subtotal - discountAmount + fees(se cliente paga)
7. netTotal = subtotal - discountAmount - totalFees
```

### 7.3 Venda - Cancelamento

```
1. Marcar status = CANCELLED
2. Para cada item: product.stock += item.quantity
```

### 7.4 Pagamento

- Taxa só aplicada se `method = DEBIT ou CREDIT`
- Parcelas só se `method = CREDIT` (default = 1)
- PIX e CASH: `feePercent = 0`, `feeAmount = 0`

---

## 8. Schemas de Validação (Zod)

### 8.1 Product

```typescript
const productCreateSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Nome obrigatório"),
  categoryId: z.string().uuid().optional().nullable(),
  costPrice: z.number().positive("Custo deve ser positivo"),
  profitMargin: z.number().min(0).max(1000),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(5),
});

const productUpdateSchema = productCreateSchema.partial();
```

### 8.2 Client

```typescript
const clientCreateSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  phone: z.string().min(1, "Telefone obrigatório"),
  address: z.string().min(1, "Endereço obrigatório"),
  discount: z.number().min(0).max(100).default(0),
});

const clientUpdateSchema = clientCreateSchema.partial();
```

### 8.3 Sale

```typescript
const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const paymentSchema = z.object({
  method: z.enum(["CASH", "PIX", "DEBIT", "CREDIT"]),
  amount: z.number().positive(),
  feePercent: z.number().min(0).default(0),
  feeAbsorber: z.enum(["SELLER", "CLIENT"]).default("SELLER"),
  installments: z.number().int().min(1).max(12).default(1),
});

const saleCreateSchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1, "Adicione ao menos um item"),
  payments: z.array(paymentSchema).min(1, "Adicione ao menos uma forma de pagamento"),
});
```

### 8.4 Settings

```typescript
const settingsUpdateSchema = z.object({
  debitFeePercent: z.number().min(0).max(100),
  creditFeePercent: z.number().min(0).max(100),
  creditInstallmentFee: z.number().min(0).max(100),
  defaultFeeAbsorber: z.enum(["SELLER", "CLIENT"]),
  lowStockAlertEnabled: z.boolean(),
});
```

---

## 9. Componentes UI (shadcn)

Instalar via CLI:
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input label card dialog select table badge alert toast form tabs separator dropdown-menu popover calendar command scroll-area sheet skeleton
```

---

## 10. Checklist de Implementação

### Fase 1: Setup
- [ ] Criar projeto Next.js
- [ ] Configurar Tailwind
- [ ] Instalar dependências
- [ ] Configurar Prisma
- [ ] Instalar shadcn/ui
- [ ] Criar layout base

### Fase 2: Backend
- [ ] API Products (CRUD)
- [ ] API Categories
- [ ] API Clients (CRUD)
- [ ] API Sales (Create, List, Cancel)
- [ ] API Reports
- [ ] API Settings

### Fase 3: Frontend
- [ ] Dashboard
- [ ] Tela Estoque
- [ ] Tela Clientes
- [ ] Tela Nova Venda
- [ ] Tela Lista Vendas
- [ ] Tela Relatórios
- [ ] Tela Configurações

### Fase 4: Polish
- [ ] Alertas de estoque
- [ ] Loading states
- [ ] Error handling
- [ ] Responsividade tablet
- [ ] Seed inicial

---

## 11. Variáveis de Ambiente

```env
# .env.example
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

---

## 12. Comandos de Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar migrations
npx prisma migrate dev

# Seed do banco
npx prisma db seed

# Rodar dev server
npm run dev

# Build
npm run build
```

---

**FIM DA ESPECIFICAÇÃO**
