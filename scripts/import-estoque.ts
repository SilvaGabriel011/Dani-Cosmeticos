import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface EstoqueRow {
  marca: string
  linha: string
  fragrancia: string
  categoria: string
  packagingType: string
  qtde: number
  valor: number | null
}

function parseCSV(filePath: string): EstoqueRow[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter((line) => line.trim())

  // Pular header
  const dataLines = lines.slice(1)

  return dataLines.map((line) => {
    // Parse CSV considerando campos com aspas (para valores com vírgula como "34,9")
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    fields.push(current.trim())

    // Parsear valor brasileiro (ex: "34,9" -> 34.9)
    const valorStr = fields[6]?.replace(',', '.') || ''
    const valor = valorStr ? parseFloat(valorStr) : null

    return {
      marca: fields[0] || '',
      linha: fields[1] || '',
      fragrancia: fields[2] || '',
      categoria: fields[3] || '',
      packagingType: fields[4] || '',
      qtde: parseInt(fields[5] || '0', 10) || 0,
      valor: isNaN(valor as number) ? null : valor,
    }
  })
}

async function findOrCreateBrand(name: string): Promise<string | null> {
  if (!name || name === '—' || name === '-') return null

  const normalizedName = name.trim()
  let brand = await prisma.brand.findFirst({
    where: { name: { equals: normalizedName, mode: 'insensitive' } },
  })

  if (!brand) {
    brand = await prisma.brand.create({
      data: { name: normalizedName },
    })
    console.log(`  ✓ Marca criada: ${normalizedName}`)
  }

  return brand.id
}

async function findOrCreateCategory(name: string): Promise<string | null> {
  if (!name || name === '—' || name === '-') return null

  const normalizedName = name.trim()
  let category = await prisma.category.findFirst({
    where: { name: { equals: normalizedName, mode: 'insensitive' } },
  })

  if (!category) {
    category = await prisma.category.create({
      data: { name: normalizedName },
    })
    console.log(`  ✓ Categoria criada: ${normalizedName}`)
  }

  return category.id
}

async function importEstoque(filePath: string) {
  console.log('='.repeat(60))
  console.log('IMPORTAÇÃO DE ESTOQUE')
  console.log('='.repeat(60))
  console.log(`Arquivo: ${filePath}`)
  console.log('')

  const rows = parseCSV(filePath)
  console.log(`Total de linhas no CSV: ${rows.length}`)
  console.log('')

  let created = 0
  let updated = 0
  let errors = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const lineNum = i + 2 // +2 porque pulamos header e arrays são 0-indexed

    try {
      // Buscar ou criar marca e categoria
      const brandId = await findOrCreateBrand(row.marca)
      const categoryId = await findOrCreateCategory(row.categoria)

      // Normalizar campos vazios
      const linha = row.linha && row.linha !== '—' && row.linha !== '-' ? row.linha.trim() : null
      const fragrancia =
        row.fragrancia && row.fragrancia !== '—' && row.fragrancia !== '-'
          ? row.fragrancia.trim()
          : null
      const packagingType =
        row.packagingType && row.packagingType !== '—' && row.packagingType !== '-'
          ? row.packagingType.trim()
          : null

      // Gerar nome do produto
      const nameParts = [row.marca, row.linha, row.fragrancia, row.categoria].filter(
        (p) => p && p !== '—' && p !== '-'
      )
      const productName = nameParts.join(' - ')

      // Buscar produto existente pela combinação única
      const existingProduct = await prisma.product.findFirst({
        where: {
          brandId,
          linha,
          fragrancia,
          categoryId,
          packagingType,
        },
      })

      if (existingProduct) {
        // Atualizar produto existente
        const updateData: Record<string, unknown> = {
          stock: row.qtde,
        }

        // Só atualiza o preço se vier valor novo e válido
        if (row.valor !== null && row.valor > 0) {
          updateData.salePrice = row.valor
          // Calcular custo estimado (margem padrão de 35%)
          updateData.costPrice = parseFloat((row.valor / 1.35).toFixed(2))
        }

        await prisma.product.update({
          where: { id: existingProduct.id },
          data: updateData,
        })

        updated++
        console.log(`[${lineNum}] Atualizado: ${productName} (qtde: ${row.qtde})`)
      } else {
        // Criar novo produto
        const salePrice = row.valor ?? 0
        const costPrice = salePrice > 0 ? parseFloat((salePrice / 1.35).toFixed(2)) : 0

        await prisma.product.create({
          data: {
            name: productName,
            brandId,
            categoryId,
            linha,
            fragrancia,
            packagingType,
            stock: row.qtde,
            salePrice,
            costPrice,
            profitMargin: 35,
            isActive: true,
          },
        })

        created++
        console.log(`[${lineNum}] Criado: ${productName} (qtde: ${row.qtde}, valor: ${salePrice})`)
      }
    } catch (error) {
      errors++
      console.error(`[${lineNum}] ERRO: ${row.marca} - ${row.linha} - ${row.fragrancia}`)
      console.error(`  Detalhe: ${error instanceof Error ? error.message : error}`)
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('RESUMO DA IMPORTAÇÃO')
  console.log('='.repeat(60))
  console.log(`✓ Produtos criados: ${created}`)
  console.log(`✓ Produtos atualizados: ${updated}`)
  console.log(`✗ Erros: ${errors}`)
  console.log(`Total processado: ${created + updated + errors}`)
  console.log('')
}

async function main() {
  const csvPath =
    process.argv[2] ||
    path.join(process.cwd(), 'Dani Cosméticos - ESTOQUE DE ITENS.csv')

  if (!fs.existsSync(csvPath)) {
    console.error(`Arquivo não encontrado: ${csvPath}`)
    console.error('')
    console.error('Uso: npx tsx scripts/import-estoque.ts [caminho-do-csv]')
    process.exit(1)
  }

  try {
    await importEstoque(csvPath)
  } catch (error) {
    console.error('Erro fatal:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
