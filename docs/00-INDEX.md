# Cosméticos App - Documentação

> Índice de documentação técnica do projeto.

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| [01-VISAO-GERAL.md](./01-VISAO-GERAL.md) | Objetivo, stack tecnológica e módulos |
| [02-ARQUITETURA.md](./02-ARQUITETURA.md) | Estrutura de pastas e camadas |
| [03-BANCO-DE-DADOS.md](./03-BANCO-DE-DADOS.md) | Schema Prisma, entidades e relacionamentos |
| [04-BACKEND-API.md](./04-BACKEND-API.md) | Endpoints REST e services |
| [05-FRONTEND.md](./05-FRONTEND.md) | Páginas, componentes e hooks |
| [06-REGRAS-NEGOCIO.md](./06-REGRAS-NEGOCIO.md) | Regras de cálculo e validações Zod |
| [07-CHECKLIST.md](./07-CHECKLIST.md) | Checklist de implementação |

## Comandos Rápidos

```bash
# Instalar dependências
npm install

# Rodar migrations
npx prisma migrate dev

# Seed do banco
npx prisma db seed

# Dev server
npm run dev

# Build
npm run build
```

## Variáveis de Ambiente

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```
