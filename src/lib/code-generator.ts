function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function extractLetters(text: string, count: number): string {
  const normalized = normalize(text)
  const vowels = 'AEIOU'
  let result = normalized[0] || ''

  for (let i = 1; i < normalized.length && result.length < count; i++) {
    if (!vowels.includes(normalized[i])) {
      result += normalized[i]
    }
  }

  while (result.length < count && result.length < normalized.length) {
    result = normalized.substring(0, result.length + 1)
  }

  return result.padEnd(count, 'X')
}

export function generateProductCode(
  name: string,
  existingCodes: string[],
  brandName?: string,
  price?: number,
): string {
  const brandPart = brandName ? extractLetters(brandName, 2) : 'XX'
  const namePart = extractLetters(name, 3)
  const pricePart = price && price > 0 ? Math.round(price).toString() : '0'

  const baseCode = `${brandPart}${namePart}${pricePart}`

  let code = baseCode
  let counter = 1
  while (existingCodes.includes(code)) {
    code = `${baseCode}-${counter}`
    counter++
  }

  return code
}
