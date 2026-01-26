/**
 * Calculates similarity score between two strings using a fuzzy matching algorithm.
 * Returns a score from 0 to 1, where 1 is an exact match.
 */
export function fuzzyMatch(text: string, query: string): number {
  if (!query) return 1
  if (!text) return 0

  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()

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
 * Filters and sorts items by fuzzy match score
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getSearchFields: (item: T) => string[],
  minScore = 0.3
): T[] {
  if (!query.trim()) return items

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
