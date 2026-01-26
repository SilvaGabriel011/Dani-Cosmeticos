function extractPrefix(normalized: string): string {
  const vowels = 'AEIOU'
  let prefix = normalized[0] || ''

  for (let i = 1; i < normalized.length && prefix.length < 3; i++) {
    if (!vowels.includes(normalized[i])) {
      prefix += normalized[i]
    }
  }

  while (prefix.length < 3 && prefix.length < normalized.length) {
    prefix = normalized.substring(0, prefix.length + 1)
  }

  return prefix.padEnd(3, 'X')
}

export function generateProductCode(name: string, existingCodes: string[]): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  const prefix = extractPrefix(normalized)
  const letterCount = name.replace(/[^a-zA-Z]/g, '').length
  const baseCode = `${prefix}${letterCount}`

  let code = baseCode
  let counter = 1
  while (existingCodes.includes(code)) {
    code = `${baseCode}-${counter}`
    counter++
  }

  return code
}

export function suggestProductCode(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  const prefix = extractPrefix(normalized)
  const letterCount = name.replace(/[^a-zA-Z]/g, '').length

  return `${prefix}${letterCount}`
}
