# 📋 Instruções para Importação da Planilha

## Status Atual
✅ **1143 produtos marcados como deletados**  
✅ **Código de importação atualizado** (reativa produtos automaticamente)  
✅ **Vendas históricas 100% preservadas**

## Como Importar

### 1. Acesse a aplicação
```bash
# Se não estiver rodando, inicie o servidor
npm run dev
```

### 2. Navegue até Estoque
- Acesse: http://localhost:3000/estoque
- Clique no botão **"Importar CSV"**

### 3. Configure a importação
- **Margem padrão para novas marcas:** 35% (ou ajuste conforme necessário)
- Selecione o arquivo: `Planilha estoque dani - Planilha corrigida.csv`

### 4. Revise os dados
A interface mostrará:
- ✅ Produtos válidos (serão importados)
- ⚠️ Produtos com problemas (serão ignorados)
- 📊 Total de produtos encontrados

### 5. Confirme a importação
- Clique em **"Importar X produtos"**
- Aguarde o processamento

## O Que Vai Acontecer

### Produtos que estão na nova planilha:
- ✅ Serão **reativados** automaticamente
- ✅ Estoque será **atualizado** (quantidade somada)
- ✅ Preço será atualizado se o novo for maior
- ✅ Voltam a aparecer no sistema como ativos

### Produtos que NÃO estão na nova planilha:
- 📦 Permanecem com `deletedAt` preenchido
- 🔒 Não aparecem no estoque ativo
- ✅ **Vendas antigas continuam funcionando normalmente**

### Produtos totalmente novos:
- ➕ Serão criados do zero
- 📊 Com estoque, preço e informações da planilha

## Verificação Pós-Importação

Após importar, verifique:

1. **Estoque atualizado:**
   - Acesse `/estoque`
   - Deve mostrar apenas produtos da nova planilha

2. **Vendas preservadas:**
   - Acesse `/vendas`
   - Vendas antigas devem mostrar produtos normalmente
   - Mesmo que o produto esteja deletado, aparece nas vendas antigas

3. **Dashboard:**
   - Métricas de vendas devem estar corretas
   - Gráficos funcionando normalmente

## Rollback (se necessário)

Se algo der errado, execute:

```bash
npx tsx scripts/reactivate-all-products.ts
```

(Criar este script se necessário - reativa todos os produtos deletados)

## Arquivos Modificados

✅ `src/app/api/import/products/route.ts` - busca produtos deletados e os reativa  
✅ `scripts/soft-delete-all-products.ts` - script de soft delete executado
