import { PrismaClient, Prisma } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

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

    const defaultProfitMargin = 35
    let created = 0
    let reactivated = 0
    const errors: Array<{ row: number; message: string }> = []
    const brandsCreated: string[] = []
    const categoriesCreated: string[] = []

    const brandCache = new Map<string, { id: string; defaultProfitMargin: number }>()
    const categoryCache = new Map<string, string>()

    console.log('🔍 Carregando marcas e categorias existentes...')
    const existingBrands = await prisma.brand.findMany()
    for (const brand of existingBrands) {
      brandCache.set(brand.name.toLowerCase(), {
        id: brand.id,
        defaultProfitMargin: Number(brand.defaultProfitMargin),
      })
    }

    const existingCategories = await prisma.category.findMany()
    for (const category of existingCategories) {
      categoryCache.set(category.name.toLowerCase(), category.id)
    }

    console.log('🚀 Iniciando importação direta...')
    
    for (let i = 0; i < products.length; i++) {
      const row = products[i]
      const rowNumber = i + 1

      try {
        let brandId: string | null = null
        let brandMargin = defaultProfitMargin

        if (row.marca) {
          const brandKey = row.marca.toLowerCase()
          let brand = brandCache.get(brandKey)

          if (!brand) {
            const newBrand = await prisma.brand.create({
              data: {
                name: row.marca,
                defaultProfitMargin: new Prisma.Decimal(defaultProfitMargin),
              },
            })
            brand = {
              id: newBrand.id,
              defaultProfitMargin: Number(newBrand.defaultProfitMargin),
            }
            brandCache.set(brandKey, brand)
            brandsCreated.push(row.marca)
          }
          brandId = brand.id
          brandMargin = brand.defaultProfitMargin
        }

        let categoryId: string | null = null
        if (row.categoria) {
          const categoryKey = row.categoria.toLowerCase()
          categoryId = categoryCache.get(categoryKey) || null

          if (!categoryId) {
            const newCategory = await prisma.category.create({
              data: { name: row.categoria },
            })
            categoryId = newCategory.id
            categoryCache.set(categoryKey, categoryId)
            categoriesCreated.push(row.categoria)
          }
        }

        const linhaVal = row.linha || null
        const fragVal = row.fragrancia || null
        const packVal = row.tipoEmbalagem || null

        const nameParts = [row.marca, row.linha, row.fragrancia].filter(Boolean)
        const productName = nameParts.length > 0 ? nameParts.join(' - ') : `Produto ${rowNumber}`

        const salePrice = row.valor || 0
        const profitMargin = brandMargin
        const costPrice = 0
        const stock = row.quantidade || 0

        // Check if product exists (including soft-deleted)
        const existing = await prisma.product.findFirst({
          where: {
            brandId: brandId,
            linha: linhaVal,
            fragrancia: fragVal,
            categoryId: categoryId,
            packagingType: packVal,
          },
        })

        if (existing) {
          const newSalePrice = salePrice > Number(existing.salePrice) ? salePrice : Number(existing.salePrice)
          const newCostPrice = newSalePrice > 0 ? newSalePrice / (1 + profitMargin / 100) : 0
          const wasDeleted = existing.deletedAt !== null
          
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              stock: { increment: stock },
              salePrice: new Prisma.Decimal(newSalePrice),
              costPrice: new Prisma.Decimal(newCostPrice),
              deletedAt: null,
              isActive: true,
            },
          })
          
          if (wasDeleted) {
            reactivated++
          }
          created++
        } else {
          await prisma.product.create({
            data: {
              name: productName,
              brandId: brandId,
              categoryId: categoryId,
              linha: linhaVal,
              fragrancia: fragVal,
              salePrice: new Prisma.Decimal(salePrice),
              costPrice: new Prisma.Decimal(costPrice),
              profitMargin: new Prisma.Decimal(profitMargin),
              stock,
              minStock: 5,
              packagingType: packVal,
            },
          })
          created++
        }

        if ((i + 1) % 100 === 0) {
          console.log(`   Processados: ${i + 1}/${products.length}`)
        }
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        })
      }
    }

    console.log('\n✅ IMPORTAÇÃO CONCLUÍDA!')
    console.log(`📦 Produtos processados: ${created}`)
    console.log(`🔄 Produtos reativados: ${reactivated}`)
    console.log(`➕ Produtos novos: ${created - reactivated}`)
    
    if (brandsCreated.length > 0) {
      console.log(`\n🏷️  Marcas criadas: ${brandsCreated.length}`)
      console.log(`   ${brandsCreated.slice(0, 10).join(', ')}${brandsCreated.length > 10 ? '...' : ''}`)
    }
    
    if (categoriesCreated.length > 0) {
      console.log(`\n📁 Categorias criadas: ${categoriesCreated.length}`)
      console.log(`   ${categoriesCreated.slice(0, 10).join(', ')}${categoriesCreated.length > 10 ? '...' : ''}`)
    }
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Erros encontrados: ${errors.length}`)
      errors.slice(0, 5).forEach((err) => {
        console.log(`   Linha ${err.row}: ${err.message}`)
      })
      if (errors.length > 5) {
        console.log(`   ... e mais ${errors.length - 5} erros`)
      }
    }

    console.log('\n✅ Estoque atualizado com sucesso!')
    console.log('ℹ️  Vendas antigas preservadas (produtos deletados ainda aparecem nas vendas)')
    
  } catch (error) {
    console.error('❌ Erro durante importação:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

importProducts()
