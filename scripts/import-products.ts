import * as fs from 'fs'
import * as path from 'path'

const BATCH_SIZE = 100
const API_URL = process.env.API_URL || 'http://localhost:3000'

async function main() {
  const jsonPath = path.resolve(__dirname, '..', 'cleaned-products.json')
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  const products = data.products
  const defaultProfitMargin = data.defaultProfitMargin || 35

  console.log(`Importing ${products.length} products in batches of ${BATCH_SIZE}...`)
  console.log(`API URL: ${API_URL}`)

  let totalCreated = 0
  let totalErrors = 0
  const allBrandsCreated: string[] = []
  const allCategoriesCreated: string[] = []
  const allErrors: Array<{ batch: number; row: number; message: string }> = []

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(products.length / BATCH_SIZE)

    console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} products)...`)

    try {
      const response = await fetch(`${API_URL}/api/import/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: batch,
          defaultProfitMargin,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`  Batch ${batchNum} failed: ${response.status} - ${errorBody}`)
        totalErrors += batch.length
        continue
      }

      const result = await response.json()
      totalCreated += result.created
      if (result.brandsCreated) allBrandsCreated.push(...result.brandsCreated)
      if (result.categoriesCreated) allCategoriesCreated.push(...result.categoriesCreated)
      if (result.errors?.length > 0) {
        totalErrors += result.errors.length
        for (const err of result.errors) {
          allErrors.push({ batch: batchNum, row: err.row, message: err.message })
        }
      }

      console.log(`  Created: ${result.created}, Errors: ${result.errors?.length || 0}`)
    } catch (error) {
      console.error(`  Batch ${batchNum} network error:`, error)
      totalErrors += batch.length
    }
  }

  console.log('\n========================================')
  console.log('IMPORT COMPLETE')
  console.log('========================================')
  console.log(`Total created/updated: ${totalCreated}`)
  console.log(`Total errors: ${totalErrors}`)
  if (allBrandsCreated.length > 0) {
    console.log(`Brands created: ${allBrandsCreated.join(', ')}`)
  }
  if (allCategoriesCreated.length > 0) {
    console.log(`Categories created: ${allCategoriesCreated.join(', ')}`)
  }
  if (allErrors.length > 0) {
    console.log('\nErrors:')
    for (const err of allErrors.slice(0, 20)) {
      console.log(`  Batch ${err.batch}, Row ${err.row}: ${err.message}`)
    }
    if (allErrors.length > 20) {
      console.log(`  ... and ${allErrors.length - 20} more errors`)
    }
  }
}

main().catch(console.error)
