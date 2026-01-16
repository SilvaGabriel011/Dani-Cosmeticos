# 04 - Backend API

## Endpoints

### Products

| Método | Endpoint | Query Params | Body | Descrição |
|--------|----------|--------------|------|-----------|
| GET | `/api/products` | `page`, `limit`, `search`, `categoryId`, `active` | - | Lista paginada |
| POST | `/api/products` | - | ProductCreate | Criar produto |
| GET | `/api/products/:id` | - | - | Buscar produto |
| PUT | `/api/products/:id` | - | ProductUpdate | Atualizar |
| DELETE | `/api/products/:id` | - | - | Soft delete |
| GET | `/api/products/low-stock` | - | - | Produtos com estoque baixo |

### Categories

| Método | Endpoint | Body | Descrição |
|--------|----------|------|-----------|
| GET | `/api/categories` | - | Lista todas |
| POST | `/api/categories` | `{ name }` | Criar categoria |

### Clients

| Método | Endpoint | Query Params | Body | Descrição |
|--------|----------|--------------|------|-----------|
| GET | `/api/clients` | `page`, `limit`, `search` | - | Lista paginada |
| POST | `/api/clients` | - | ClientCreate | Criar cliente |
| GET | `/api/clients/:id` | `includeSales` | - | Buscar + histórico |
| PUT | `/api/clients/:id` | - | ClientUpdate | Atualizar |
| DELETE | `/api/clients/:id` | - | - | Soft delete |

### Sales

| Método | Endpoint | Query Params | Body | Descrição |
|--------|----------|--------------|------|-----------|
| GET | `/api/sales` | `page`, `limit`, `startDate`, `endDate`, `status` | - | Lista paginada |
| POST | `/api/sales` | - | SaleCreate | Criar venda |
| GET | `/api/sales/:id` | - | - | Detalhes completos |
| POST | `/api/sales/:id/cancel` | - | - | Cancelar + devolver estoque |

### Reports

| Método | Endpoint | Query Params | Descrição |
|--------|----------|--------------|-----------|
| GET | `/api/reports/summary` | `startDate`, `endDate` | Totais gerais |
| GET | `/api/reports/by-product` | `startDate`, `endDate`, `limit` | Ranking produtos |
| GET | `/api/reports/by-payment` | `startDate`, `endDate` | Por forma pagamento |

### Settings

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/settings` | Buscar configurações |
| PUT | `/api/settings` | Atualizar configurações |

---

## Services

### product.service.ts

```typescript
// Funções
async function listProducts(params: ListParams): Promise<PaginatedResult<Product>>
async function getProduct(id: string): Promise<Product | null>
async function createProduct(data: ProductCreate): Promise<Product>
async function updateProduct(id: string, data: ProductUpdate): Promise<Product>
async function deleteProduct(id: string): Promise<void>  // soft delete
async function getLowStockProducts(): Promise<Product[]>
```

### client.service.ts

```typescript
// Funções
async function listClients(params: ListParams): Promise<PaginatedResult<Client>>
async function getClient(id: string, includeSales?: boolean): Promise<Client | null>
async function createClient(data: ClientCreate): Promise<Client>
async function updateClient(id: string, data: ClientUpdate): Promise<Client>
async function deleteClient(id: string): Promise<void>  // soft delete
```

### sale.service.ts

```typescript
// Funções
async function listSales(params: SaleListParams): Promise<PaginatedResult<Sale>>
async function getSale(id: string): Promise<Sale | null>
async function createSale(data: SaleCreate): Promise<Sale>
async function cancelSale(id: string): Promise<Sale>  // devolve estoque
```

### report.service.ts

```typescript
// Funções
async function getSummary(startDate: Date, endDate: Date): Promise<Summary>
async function getByProduct(startDate: Date, endDate: Date, limit?: number): Promise<ProductReport[]>
async function getByPayment(startDate: Date, endDate: Date): Promise<PaymentReport[]>
```

### settings.service.ts

```typescript
// Funções
async function getSettings(): Promise<Settings>
async function updateSettings(data: SettingsUpdate): Promise<Settings>
```

---

## Resposta Padrão

### Sucesso

```typescript
// Lista paginada
{
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}

// Item único
{
  data: T
}
```

### Erro

```typescript
{
  error: {
    code: string,
    message: string,
    details?: Record<string, string[]>  // erros de validação
  }
}
```

---

## Status Codes

| Código | Uso |
|--------|-----|
| 200 | Sucesso (GET, PUT) |
| 201 | Criado (POST) |
| 204 | Sem conteúdo (DELETE) |
| 400 | Erro de validação |
| 404 | Não encontrado |
| 500 | Erro interno |
