# 01 - Visão Geral

## Objetivo

App web para controle de vendas e estoque de itens cosméticos.

- **Plataforma**: Web responsivo (tablet)
- **Hospedagem**: Vercel
- **Usuário**: Single-user (sem autenticação)

---

## Stack Tecnológica

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

## Módulos do Sistema

### Dashboard

- Resumo de vendas (hoje/semana/mês)
- Valor total em estoque
- Alertas de estoque baixo
- Últimas vendas

### Estoque (Produtos)

- CRUD de produtos
- Campos: código, nome, categoria, custo, margem, preço venda, estoque, estoque mínimo
- Preço de venda = custo × (1 + margem/100)
- Alerta quando estoque ≤ estoque mínimo
- Soft delete (deletedAt)

### Clientes

- CRUD de clientes
- Campos: nome, telefone, endereço, desconto fixo (%)
- Histórico de compras do cliente
- Soft delete (deletedAt)

### Vendas

- Criar venda com múltiplos itens
- Cliente opcional (se selecionado, aplica desconto fixo)
- Múltiplas formas de pagamento (dividir)
- Formas: Dinheiro, PIX, Débito, Crédito
- Taxa de cartão configurável
- Quem absorve taxa: vendedor ou cliente
- Parcelas apenas para crédito (1-12x)
- Cancelar venda devolve estoque
- Status: COMPLETED, CANCELLED

### Relatórios

- Filtro por período (data início/fim)
- Resumo geral (total vendido, lucro, ticket médio)
- Vendas por produto (ranking)
- Vendas por forma de pagamento

### Configurações

- Taxa débito (%)
- Taxa crédito à vista (%)
- Taxa crédito parcelado (%)
- Quem absorve taxa por padrão (vendedor/cliente)
- Alerta de estoque baixo (on/off)
