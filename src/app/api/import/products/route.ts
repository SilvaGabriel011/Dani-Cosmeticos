import { Decimal } from '@prisma/client/runtime/library'
import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { productImportSchema } from '@/schemas/import'

export const dynamic = 'force-dynamic'

interface ImportResult {
  created: number
  errors: Array<{ row: number; message: string }>
  brandsCreated: string[]
  categoriesCreated: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = productImportSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { products, defaultProfitMargin = 35 } = validation.data
    const result: ImportResult = {
      created: 0,
      errors: [],
      brandsCreated: [],
      categoriesCreated: [],
    }

    const brandCache = new Map<string, { id: string; defaultProfitMargin: number }>()
    const categoryCache = new Map<string, string>()

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
                defaultProfitMargin: new Decimal(defaultProfitMargin),
              },
            })
            brand = {
              id: newBrand.id,
              defaultProfitMargin: Number(newBrand.defaultProfitMargin),
            }
            brandCache.set(brandKey, brand)
            result.brandsCreated.push(row.marca)
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
            result.categoriesCreated.push(row.categoria)
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

        // Check if product with same unique combo already exists
        const existing = await prisma.product.findFirst({
          where: {
            brandId: brandId,
            linha: linhaVal,
            fragrancia: fragVal,
            categoryId: categoryId,
            packagingType: packVal,
            deletedAt: null,
          },
        })

        if (existing) {
          // Update: add stock, update price if new price is higher
          const newSalePrice = salePrice > Number(existing.salePrice) ? salePrice : Number(existing.salePrice)
          const newCostPrice = newSalePrice > 0 ? newSalePrice / (1 + profitMargin / 100) : 0
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              stock: { increment: stock },
              salePrice: new Decimal(newSalePrice),
              costPrice: new Decimal(newCostPrice),
            },
          })
          result.created++
        } else {
          await prisma.product.create({
            data: {
              name: productName,
              brandId: brandId,
              categoryId: categoryId,
              linha: linhaVal,
              fragrancia: fragVal,
              salePrice: new Decimal(salePrice),
              costPrice: new Decimal(costPrice),
              profitMargin: new Decimal(profitMargin),
              stock,
              minStock: 5,
              packagingType: packVal,
            },
          })
          result.created++
        }
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        })
      }
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error importing products:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao importar produtos' } },
      { status: 500 }
    )
  }
}
