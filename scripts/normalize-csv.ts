import * as fs from 'fs'
import * as path from 'path'

// ============================================================
// Brand normalization map (lowercased key → correct name)
// ============================================================
const BRAND_MAP: Record<string, string> = {
  'o boticário': 'O Boticário',
  'o boticario': 'O Boticário',
  'oboticario': 'O Boticário',
  'boticário': 'O Boticário',
  'boticario': 'O Boticário',
  'nativa spa': 'O Boticário',
  'o.u.i': 'O Boticário',
  'afnan': 'O Boticário',
  natura: 'Natura',
  avon: 'Avon',
  eudora: 'Eudora',
  disney: 'Disney',
  marvel: 'Marvel',
  diversos: 'Outros',
  outros: 'Outros',
  '—': 'Outros',
  '--': 'Outros',
  '': 'Outros',
}

// Brands that become a "linha" under O Boticário
const BRAND_TO_LINE: Record<string, string> = {
  'nativa spa': 'Nativa Spa',
  'o.u.i': 'O.U.I',
  afnan: 'O Boticário', // Afnan rows use existing linha (e.g. "Zaad")
}

// Lines that belong to O Boticário but might appear under Natura
const BOTICARIO_LINES = new Set([
  'cuide-se bem', 'nativa spa', 'floratta', 'egeo', 'lily', 'match',
  'elysée', 'zaad', 'malbec', 'arbo', 'clash', 'boticollection',
  'botik', 'dr. botica', 'boti baby', 'sophie', 'acordes', 'accordes',
  'liz', 'connexion', 'connection', 'glamour', 'seve', 'portinari',
  'the blend', 'uomini', 'quasar', 'her code', 'linda', 'dream',
  'ma chérie', 'qdb', 'harry potter', 'boti sun', 'dolce',
  'coffee', 'coffee man', 'coffee woman', 'celebre', 'make b',
  'spa', // "Spa" under Natura is actually Nativa Spa (O Boticário)
])

// Lines under Natura that should be renamed (not brand change, just line fix)
const NATURA_LINE_FIXES: Record<string, { linha: string; fragranciaPrefix?: string }> = {
  'urbe': { linha: 'Kaiak', fragranciaPrefix: 'Urbe' },
  'red': { linha: 'Todo Dia', fragranciaPrefix: '' }, // Natura Red → Todo Dia
}

// ============================================================
// Line normalization map (lowercased key → correct name)
// ============================================================
const LINE_MAP: Record<string, string> = {
  tododia: 'Todo Dia',
  'todo dia': 'Todo Dia',
  instace: 'Instance',
  instance: 'Instance',
  'cuide-se bem': 'Cuide-se Bem',
  'mamãe bebê': 'Mamãe e Bebê',
  'mamãe e bebê': 'Mamãe e Bebê',
  'mamãe e bebé': 'Mamãe e Bebê',
  'mamãe e bebe': 'Mamãe e Bebê',
  'nina skin': 'Nina Skin',
  'nativa skin': 'Nativa Skin',
  'nativa spa': 'Nativa Spa',
  'siàge': 'Siàge',
  'siage': 'Siàge',
  'ekos amazônia': 'Ekos',
  'ekos açaí': 'Ekos',
  'advance techniques': 'Advance Techniques',
  'care footworks': 'Care Footworks',
  'care sun': 'Care Sun',
  'care face': 'Care Face',
  'care baby': 'Care Baby',
  'clear skin': 'Clear Skin',
  'clearskin': 'Clear Skin',
  'neo dermo': 'Neo Dermo',
  'dr. botica': 'Dr. Botica',
  'boti baby': 'Boti Baby',
  'boti sun': 'Boti Sun',
  'coffee woman': 'Coffee Woman',
  'coffee man': 'Coffee Man',
  'malbec club': 'Malbec Club',
  'malbec black': 'Malbec Black',
  'malbec pure gold': 'Malbec Pure Gold',
  'egeo blue': 'Egeo Blue',
  'malbec x': 'Malbec X',
  'la victorie': 'La Victorie',
  'lily love': 'Lily Love',
  'skin soft': 'Skin Soft',
  'color trend': 'Color Trend',
  'accordes': 'Acordes',
  'acordes': 'Acordes',
  'connexion': 'Connexion',
  'connection': 'Connexion',
  'men': 'Men',
  'una': 'UNA',
  'spa': 'Nativa Spa',
  'biscoito ou bolacha': 'Cuide-se Bem',
  'deleite': 'Cuide-se Bem',
  '300 km/h': '300 Km/h',
  'karite': 'Karité',
  'boticollection 214': 'Boticollection',
  'arbo botanic': 'Arbo Botanic',
  'black essential': 'Black Essential',
  'on duty': 'On Duty',
  'far away': 'Far Away',
  'make b': 'Make B',
  'erva doce': 'Erva Doce',
  'ma chérie': 'Ma Chérie',
}

// Composite lines to split: "Kaiak Pulso" → linha=Kaiak, fragrancia=Pulso
const COMPOSITE_LINES: Record<string, { linha: string; fragrancia: string }> = {
  'kaiak pulso': { linha: 'Kaiak', fragrancia: 'Pulso' },
  'kaiak urbe': { linha: 'Kaiak', fragrancia: 'Urbe' },
  'homem tato': { linha: 'Homem', fragrancia: 'Tato' },
  'kaiak feminino': { linha: 'Kaiak', fragrancia: 'Feminino' },
  'kaiak masculino': { linha: 'Kaiak', fragrancia: 'Masculino' },
  'ekos amazônia': { linha: 'Ekos', fragrancia: 'Amazônia' },
  'ekos açaí': { linha: 'Ekos', fragrancia: 'Açaí' },
  'ekos madeira em flor': { linha: 'Ekos', fragrancia: 'Madeira em Flor' },
  'luna intenso': { linha: 'Luna', fragrancia: 'Intenso' },
  'humor próprio': { linha: 'Humor', fragrancia: 'Próprio' },
  'instance karité': { linha: 'Instance', fragrancia: 'Karité' },
  'instance baunilha': { linha: 'Instance', fragrancia: 'Baunilha' },
  'essencial exclusivo': { linha: 'Essencial', fragrancia: 'Exclusivo' },
  'essencial atrai': { linha: 'Essencial', fragrancia: 'Atrai' },
  'aventura feminino': { linha: 'Aventura', fragrancia: 'Feminino' },
  'black essential': { linha: 'Black Essential', fragrancia: '' },
  'kriska jeans': { linha: 'Kriska', fragrancia: 'Jeans' },
}

// ============================================================
// Fragrance normalization (accent fixes)
// ============================================================
const FRAGRANCE_MAP: Record<string, string> = {
  'pessego e amendoa': 'Pêssego e Amêndoa',
  'pessego e amêndoa': 'Pêssego e Amêndoa',
  'pêssego e amendoa': 'Pêssego e Amêndoa',
}

// ============================================================
// CSV Parser that handles quoted fields with commas
// ============================================================
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current.trim())
  return fields
}

function parseMoneyValue(value: string): number {
  if (!value || value.trim() === '' || value.trim() === '—' || value.trim() === '--') return 0
  // Handle Brazilian format: "34,9" → 34.9, also "1.234,56" → 1234.56
  let cleaned = value.replace(/R\$\s*/gi, '').trim()
  // If it has comma as decimal separator (Brazilian format)
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function titleCase(str: string): string {
  if (!str) return str
  const lower = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'p/', 'c/', 'com', 'sem', 'para']
  return str
    .split(' ')
    .map((word, index) => {
      if (index > 0 && lower.includes(word.toLowerCase())) {
        return word.toLowerCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function cleanPlaceholder(val: string | undefined): string | undefined {
  if (!val) return undefined
  const trimmed = val.trim()
  if (trimmed === '—' || trimmed === '--' || trimmed === '-' || trimmed === '') return undefined
  return trimmed
}

interface RawRow {
  marca: string
  linha: string
  fragrancia: string
  categoria: string
  tipoEmbalagem: string
  quantidade: number
  valor: number
}

interface NormalizedRow {
  marca: string
  linha?: string
  fragrancia?: string
  categoria?: string
  tipoEmbalagem?: string
  quantidade: number
  valor: number
}

function normalizeBrand(raw: string): string {
  const key = raw.toLowerCase().trim()
  return BRAND_MAP[key] ?? titleCase(raw)
}

function normalizeLine(rawBrand: string, rawLine: string, rawFragrancia: string): { linha?: string; fragrancia?: string } {
  const brandKey = rawBrand.toLowerCase().trim()
  const lineRaw = cleanPlaceholder(rawLine) || ''
  const fragRaw = cleanPlaceholder(rawFragrancia) || ''
  const lineKey = lineRaw.toLowerCase().trim()

  let linha = lineRaw
  let fragrancia = fragRaw

  // If brand is being collapsed into O Boticário, the original brand becomes the line
  if (BRAND_TO_LINE[brandKey]) {
    const brandAsLine = BRAND_TO_LINE[brandKey]
    if (brandKey === 'afnan') {
      // Afnan products keep their existing linha (e.g. "Zaad")
    } else if (brandKey === 'nativa spa') {
      // If original line exists and is not a generic "Vidro"/"Refis", keep it as fragrancia context
      if (lineRaw && lineRaw !== 'Nativa Spa') {
        // e.g. brand=Nativa Spa, line=Vidro → linha=Nativa Spa (line info goes away or stays)
        linha = 'Nativa Spa'
        // Keep original fragrancia
      } else {
        linha = 'Nativa Spa'
      }
    } else {
      // O.U.I
      linha = brandAsLine
      // Keep existing line as sub-info in fragrancia if needed
      if (lineRaw && lineRaw.toLowerCase() !== brandAsLine.toLowerCase()) {
        // e.g. O.U.I, La Villette, 470 → linha=O.U.I, fragrancia=La Villette 470
        fragrancia = [lineRaw, fragRaw].filter(Boolean).join(' ')
      }
    }
  }

  // Check composite lines
  const compositeKey = lineKey
  if (COMPOSITE_LINES[compositeKey]) {
    const composite = COMPOSITE_LINES[compositeKey]
    linha = composite.linha
    // Only override fragrancia if the composite provides one and raw fragrancia is empty
    if (composite.fragrancia && !fragRaw) {
      fragrancia = composite.fragrancia
    } else if (composite.fragrancia && fragRaw) {
      // Keep original fragrancia
    }
  }

  // Apply LINE_MAP normalization
  const normalizedLineKey = linha.toLowerCase().trim()
  if (LINE_MAP[normalizedLineKey]) {
    linha = LINE_MAP[normalizedLineKey]
  }

  // Normalize fragrancia
  const fragKey = fragrancia.toLowerCase().trim()
  if (FRAGRANCE_MAP[fragKey]) {
    fragrancia = FRAGRANCE_MAP[fragKey]
  }

  return {
    linha: cleanPlaceholder(linha),
    fragrancia: cleanPlaceholder(fragrancia),
  }
}

function normalizeCategory(raw: string): string | undefined {
  const cleaned = cleanPlaceholder(raw)
  if (!cleaned) return undefined
  return titleCase(cleaned)
}

function normalizePackaging(raw: string): string | undefined {
  const cleaned = cleanPlaceholder(raw)
  if (!cleaned) return undefined
  // Normalize casing for common patterns
  let result = cleaned
  // Normalize "caixa c/4" → "Caixa c/4"
  result = result.charAt(0).toUpperCase() + result.slice(1)
  return result
}

// ============================================================
// Handle shifted columns (known problematic lines)
// Lines where CAIXA/KIT/UNIDADE column is missing, shifting data
// ============================================================
function fixShiftedRow(fields: string[]): string[] | null {
  // Detect rows with wrong number of fields
  // Expected: 7 fields (Marca, LINHA, FRAGRANCIA, CATEGORIA, CAIXA/KIT/UNIDADE, QTDE, VALOR)
  if (fields.length === 6) {
    // Missing packaging type column - insert empty packaging
    // Fields are: Marca, LINHA, FRAGRANCIA, CATEGORIA, QTDE, VALOR
    return [fields[0], fields[1], fields[2], fields[3], '', fields[4], fields[5]]
  }
  if (fields.length < 6) {
    return null // Skip malformed rows
  }
  return fields
}

// ============================================================
// Main
// ============================================================
function main() {
  const csvPath = path.resolve(__dirname, '..', 'Dani Cosméticos - ESTOQUE DE ITENS (1).csv')
  const outputPath = path.resolve(__dirname, '..', 'cleaned-products.json')

  console.log('Reading CSV:', csvPath)
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.split(/\r?\n/).filter((line) => line.trim())

  if (lines.length < 2) {
    console.error('CSV has no data rows')
    process.exit(1)
  }

  console.log(`Found ${lines.length - 1} data rows (excluding header)`)

  const rows: NormalizedRow[] = []
  const skipped: { line: number; reason: string; content: string }[] = []

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i]
    let fields = parseCSVLine(rawLine)

    // Try to fix shifted rows
    fields = fixShiftedRow(fields) || []

    if (fields.length < 6) {
      skipped.push({ line: i + 1, reason: 'too few fields', content: rawLine })
      continue
    }

    const rawMarca = fields[0]?.trim() || ''
    const rawLinha = fields[1]?.trim() || ''
    const rawFragrancia = fields[2]?.trim() || ''
    const rawCategoria = fields[3]?.trim() || ''
    const rawEmbalagem = fields[4]?.trim() || ''
    const rawQtde = fields[5]?.trim() || '0'
    const rawValor = fields[6]?.trim() || '0'

    // Skip completely empty rows
    if (!rawMarca && !rawLinha && !rawFragrancia) {
      skipped.push({ line: i + 1, reason: 'empty row', content: rawLine })
      continue
    }

    // Normalize brand
    let marca = normalizeBrand(rawMarca)

    // Fix brand-line mismatches: some O Boticário lines appear under Natura
    const linhaKeyForBrandCheck = rawLinha.toLowerCase().trim()
    if (marca === 'Natura' && BOTICARIO_LINES.has(linhaKeyForBrandCheck)) {
      marca = 'O Boticário'
    }

    // Fix Natura lines that need renaming (e.g. "Urbe" → Kaiak)
    let adjustedLinha = rawLinha
    let adjustedFragrancia = rawFragrancia
    if (marca === 'Natura' && NATURA_LINE_FIXES[linhaKeyForBrandCheck]) {
      const fix = NATURA_LINE_FIXES[linhaKeyForBrandCheck]
      adjustedLinha = fix.linha
      if (fix.fragranciaPrefix && !rawFragrancia) {
        adjustedFragrancia = fix.fragranciaPrefix
      } else if (fix.fragranciaPrefix && rawFragrancia) {
        adjustedFragrancia = rawFragrancia
      }
    }

    // Normalize line and fragrance
    const { linha, fragrancia } = normalizeLine(rawMarca, adjustedLinha, adjustedFragrancia)

    // Normalize category
    const categoria = normalizeCategory(rawCategoria)

    // Normalize packaging
    const tipoEmbalagem = normalizePackaging(rawEmbalagem)

    // Parse quantity and value
    const quantidade = parseInt(rawQtde, 10) || 0
    const valor = parseMoneyValue(rawValor)

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

  console.log(`\nParsed ${rows.length} valid rows, skipped ${skipped.length}`)

  if (skipped.length > 0) {
    console.log('\nSkipped rows:')
    for (const s of skipped) {
      console.log(`  Line ${s.line}: ${s.reason} - "${s.content.substring(0, 80)}..."`)
    }
  }

  // ============================================================
  // Deduplicate exact matches
  // ============================================================
  const seen = new Set<string>()
  const dedupedRows: NormalizedRow[] = []
  let duplicateCount = 0

  for (const row of rows) {
    const key = [
      row.marca,
      row.linha || '',
      row.fragrancia || '',
      row.categoria || '',
      row.tipoEmbalagem || '',
      row.quantidade,
      row.valor,
    ].join('|')

    if (seen.has(key)) {
      duplicateCount++
      continue
    }
    seen.add(key)
    dedupedRows.push(row)
  }

  console.log(`\nDeduplicated: removed ${duplicateCount} exact duplicates`)
  console.log(`Final count: ${dedupedRows.length} products`)

  // ============================================================
  // Stats
  // ============================================================
  const brandCounts = new Map<string, number>()
  let noPriceCount = 0
  for (const row of dedupedRows) {
    brandCounts.set(row.marca, (brandCounts.get(row.marca) || 0) + 1)
    if (row.valor === 0) noPriceCount++
  }

  console.log('\nBrand distribution:')
  for (const [brand, count] of Array.from(brandCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${brand}: ${count}`)
  }
  console.log(`\nProducts without price: ${noPriceCount}`)

  // ============================================================
  // Write output
  // ============================================================
  const output = {
    products: dedupedRows,
    defaultProfitMargin: 35,
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\nOutput written to: ${outputPath}`)
}

main()
