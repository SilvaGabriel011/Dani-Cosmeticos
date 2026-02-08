/**
 * Removes diacritical marks (accents) from a string.
 * "João" → "Joao", "açaí" → "acai", "crème" → "creme"
 */
function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Normalizes text to a phonetic key for PT-BR.
 * Maps phonetically equivalent characters so that
 * "Karina" and "Carina", "Gessica" and "Jéssica" produce the same key.
 */
function phoneticNormalize(text: string): string {
  let s = removeAccents(text.toLowerCase())

  // Multi-char replacements first
  s = s.replace(/ph/g, 'f')
  s = s.replace(/ch/g, 'x')
  s = s.replace(/sh/g, 'x')
  s = s.replace(/ss/g, 's')
  s = s.replace(/rr/g, 'r')
  s = s.replace(/ll/g, 'l')
  s = s.replace(/nn/g, 'n')
  s = s.replace(/tt/g, 't')
  s = s.replace(/qu/g, 'k')

  // Context-sensitive: c before e/i → s
  s = s.replace(/c([ei])/g, 's$1')
  // Context-sensitive: g before e/i → j
  s = s.replace(/g([ei])/g, 'j$1')

  // Single-char replacements
  s = s.replace(/ç/g, 's')
  s = s.replace(/k/g, 'c')
  s = s.replace(/w/g, 'v')
  s = s.replace(/y/g, 'i')
  // Remove initial silent h
  s = s.replace(/^h/, '')

  return s
}

/**
 * Calculates similarity score between two strings using a fuzzy matching algorithm.
 * Returns a score from 0 to 1, where 1 is an exact match.
 * Accent-insensitive: "joao" matches "João".
 */
export function fuzzyMatch(text: string, query: string): number {
  if (!query) return 1
  if (!text) return 0

  const textLower = removeAccents(text.toLowerCase())
  const queryLower = removeAccents(query.toLowerCase())

  // Exact match
  if (textLower === queryLower) return 1

  // Contains exact query
  if (textLower.includes(queryLower)) {
    // Higher score if match is at the start
    if (textLower.startsWith(queryLower)) return 0.95
    return 0.85
  }

  // Check if all query characters exist in order (subsequence match)
  let textIndex = 0
  let queryIndex = 0
  let consecutiveMatches = 0
  let maxConsecutive = 0
  let totalMatches = 0

  while (textIndex < textLower.length && queryIndex < queryLower.length) {
    if (textLower[textIndex] === queryLower[queryIndex]) {
      totalMatches++
      consecutiveMatches++
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches)
      queryIndex++
    } else {
      consecutiveMatches = 0
    }
    textIndex++
  }

  // If not all query chars were found, check word boundaries
  if (queryIndex < queryLower.length) {
    // Try matching against words
    const words = textLower.split(/\s+/)
    for (const word of words) {
      if (word.startsWith(queryLower)) return 0.7
      if (word.includes(queryLower)) return 0.6
    }

    // Calculate Levenshtein-based similarity for short queries
    if (queryLower.length <= 10) {
      const distance = levenshteinDistance(textLower, queryLower)
      const maxLen = Math.max(textLower.length, queryLower.length)
      const similarity = 1 - distance / maxLen
      if (similarity > 0.5) return similarity * 0.5
    }

    // Phonetic fallback for PT-BR: "Karina"↔"Carina", "Gessica"↔"Jéssica"
    const phoneticText = phoneticNormalize(textLower)
    const phoneticQuery = phoneticNormalize(queryLower)
    if (phoneticText === phoneticQuery) return 0.65
    if (phoneticText.startsWith(phoneticQuery)) return 0.6
    if (phoneticText.includes(phoneticQuery)) return 0.55

    // Also check per-word phonetic match
    const phoneticWords = phoneticText.split(/\s+/)
    for (const pw of phoneticWords) {
      if (pw.startsWith(phoneticQuery)) return 0.55
      if (pw === phoneticQuery) return 0.6
    }

    return 0
  }

  // Score based on how well the characters matched
  const coverage = totalMatches / queryLower.length
  const density = totalMatches / textLower.length
  const consecutiveBonus = maxConsecutive / queryLower.length

  return Math.min(0.8, (coverage * 0.4 + density * 0.3 + consecutiveBonus * 0.3))
}

/**
 * Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Filters and sorts items by fuzzy match score.
 * Supports multi-word queries: "creme rosto" matches "Creme Hidratante para Rosto".
 * Each word must match at least one field above minScore.
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getSearchFields: (item: T) => string[],
  minScore = 0.3
): T[] {
  if (!query.trim()) return items

  const words = query.trim().split(/\s+/).filter(Boolean)

  // Single word: original logic (most common case, no overhead)
  if (words.length <= 1) {
    const scored = items
      .map((item) => {
        const fields = getSearchFields(item)
        const maxScore = Math.max(...fields.map((field) => fuzzyMatch(field, query)))
        return { item, score: maxScore }
      })
      .filter(({ score }) => score >= minScore)
      .sort((a, b) => b.score - a.score)

    return scored.map(({ item }) => item)
  }

  // Multi-word: each word must match at least one field
  const scored = items
    .map((item) => {
      const fields = getSearchFields(item)
      const allText = fields.join(' ')

      const wordScores = words.map((word) => {
        const fieldScores = fields.map((field) => fuzzyMatch(field, word))
        const allTextScore = fuzzyMatch(allText, word)
        return Math.max(...fieldScores, allTextScore)
      })

      // ALL words must meet minimum threshold
      const minWordScore = Math.min(...wordScores)
      if (minWordScore < minScore) return { item, score: 0 }

      // Average of per-word scores
      const avgScore = wordScores.reduce((a, b) => a + b, 0) / wordScores.length
      return { item, score: avgScore }
    })
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)

  return scored.map(({ item }) => item)
}
