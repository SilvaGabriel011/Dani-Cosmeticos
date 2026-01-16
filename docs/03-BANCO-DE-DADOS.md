# 03 - Banco de Dados

## Diagrama ER

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   CATEGORY   │       │   PRODUCT    │       │    CLIENT    │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)      │       │ id (PK)      │
│ name         │  └───▶│ categoryId   │       │ name         │
│ createdAt    │       │ name         │       │ phone        │
└──────────────┘       │ code         │       │ address      │
                       │ costPrice    │       │ discount     │
                       │ profitMargin │       │ createdAt    │
                       │ salePrice    │       │ updatedAt    │
                       │ stock        │       │ deletedAt    │
                       │ minStock     │       └──────┬───────┘
                       │ isActive     │              │
                       │ createdAt    │              │
                       │ updatedAt    │              │
                       │ deletedAt    │              │
                       └──────┬───────┘              │
                              │                      │
                              │                      │
                       ┌──────▼───────┐              │
                       │    SALE      │◀─────────────┘
                       ├──────────────┤
                       │ id (PK)      │
                       │ clientId(FK) │ ← nullable
                       │ subtotal     │
                       │ discountPct  │
                       │ discountAmt  │
                       │ totalFees    │
                       │ total        │
                       │ netTotal     │
                       │ status       │
                       │ notes        │
                       │ createdAt    │
                       └──────┬───────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
       ┌──────▼──────┐                 ┌──────▼──────┐
       │  SALE_ITEM  │                 │  PAYMENT    │
       ├─────────────┤                 ├─────────────┤
       │ id (PK)     │                 │ id (PK)     │
       │ saleId (FK) │                 │ saleId (FK) │
       │ productId   │                 │ method      │
       │ quantity    │                 │ amount      │
       │ unitPrice   │                 │ feePercent  │
       │ costPrice   │                 │ feeAmount   │
       │ total       │                 │ feeAbsorber │
       └─────────────┘                 │ installments│
                                       └─────────────┘

┌──────────────┐
│   SETTINGS   │
├──────────────┤
│ id           │
│ debitFee     │
│ creditFee    │
│ creditInstFee│
│ feeAbsorber  │
│ lowStockAlert│
│ updatedAt    │
└──────────────┘
```

---

## Enums

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

---

## Models

### Category

```prisma
model Category {
  id        String    @id @default(uuid())
  name      String    @unique
  createdAt DateTime  @default(now())
  products  Product[]
}
```

### Product

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

### Client

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

### Sale

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

### SaleItem

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

### Payment

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

### Settings

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

## Índices

| Tabela | Campo | Motivo |
|--------|-------|--------|
| Product | categoryId | Filtro por categoria |
| Product | isActive | Filtro produtos ativos |
| Product | deletedAt | Soft delete |
| Client | deletedAt | Soft delete |
| Sale | clientId | Histórico do cliente |
| Sale | status | Filtro por status |
| Sale | createdAt | Ordenação e filtro por data |
| SaleItem | saleId | Join com Sale |
| SaleItem | productId | Relatório por produto |
| Payment | saleId | Join com Sale |
| Payment | method | Relatório por forma pgto |
