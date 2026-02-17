import { readFileSync } from 'fs'
import { join } from 'path'

interface ProductImportRow {
  marca: string
  linha?: string
  fragrancia?: string
  categoria: string
  tipoEmbalagem?: string
  quantidade: number
  valor: number
}

function parseMoneyValue(value: string): number {
  if (!value || value.trim() === '') return 0
  const cleaned = value
    .replace(/R\$\s*/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function parseCSV(text: string): ProductImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const rows: ProductImportRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[,;\t]/).map((v) => v.trim())

    if (values.length < 7 || !values[0]) continue

    const marca = values[0]
    const linha = values[1] || undefined
    const fragrancia = values[2] || undefined
    const categoria = values[3]
    const tipoEmbalagem = values[4] || undefined
    const quantidade = parseInt(values[5], 10) || 0
    const valor = parseMoneyValue(values[6])

    // Skip rows without category
    if (!categoria) continue

    rows.push({
      marca,
      linha,
      fragrancia,
      categoria,
      tipoEmbalagem,
      quantidade,
      valor,
    })
  }

  return rows
}

async function importProducts() {
  try {
    console.log('📂 Lendo arquivo CSV...')
    const csvPath = join(process.cwd(), 'Planilha estoque dani - Planilha corrigida .csv')
    const csvContent = readFileSync(csvPath, 'utf-8')
    
    console.log('📊 Parseando dados...')
    const products = parseCSV(csvContent)
    console.log(`✅ ${products.length} produtos válidos encontrados`)

    if (products.length === 0) {
      console.log('❌ Nenhum produto válido para importar')
      return
    }

    console.log('🚀 Iniciando importação via API...')
    const response = await fetch('http://localhost:3000/api/import/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products,
        defaultProfitMargin: 35,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Erro na API: ${JSON.stringify(error)}`)
    }

    const result = await response.json()
    
    console.log('\n✅ IMPORTAÇÃO CONCLUÍDA!')
    console.log(`📦 Produtos processados: ${result.created}`)
    
    if (result.brandsCreated.length > 0) {
      console.log(`🏷️  Marcas criadas: ${result.brandsCreated.length}`)
      console.log(`   ${result.brandsCreated.join(', ')}`)
    }
    
    if (result.categoriesCreated.length > 0) {
      console.log(`📁 Categorias criadas: ${result.categoriesCreated.length}`)
      console.log(`   ${result.categoriesCreated.join(', ')}`)
    }
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Erros encontrados: ${result.errors.length}`)
      result.errors.slice(0, 5).forEach((err: any) => {
        console.log(`   Linha ${err.row}: ${err.message}`)
      })
      if (result.errors.length > 5) {
        console.log(`   ... e mais ${result.errors.length - 5} erros`)
      }
    }

    console.log('\n✅ Estoque atualizado com sucesso!')
    console.log('ℹ️  Produtos reativados: aqueles que existiam e voltaram na planilha')
    console.log('ℹ️  Produtos novos: criados do zero')
    console.log('ℹ️  Produtos antigos: permanecem deletados (mas preservados para vendas antigas)')
    
  } catch (error) {
    console.error('❌ Erro durante importação:', error)
    throw error
  }
}

importProducts()
