// A simple levenshtein implementation
export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
}

// Generate all contiguous combinations of tokens up to length N
export function getTokenCombinations(tokens: string[]): string[] {
  const combinations: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    let current = "";
    for (let j = i; j < tokens.length; j++) {
      current += tokens[j];
      combinations.push(current);
    }
  }
  return [...new Set(combinations)];
}

export function matchToken(gToken: string, tToken: string): { matches: boolean, penalty: number, reason: string } {
  // Exact match
  if (gToken === tToken) return { matches: true, penalty: 0.0, reason: "exact" };

  // Prefix Match (Guess token is a prefix of target token, or vice versa)
  if (tToken.startsWith(gToken) || gToken.startsWith(tToken)) {
    const minLength = Math.min(gToken.length, tToken.length);
    if (minLength >= 3) {
      const lenDiff = Math.abs(gToken.length - tToken.length);
      const prefixPenalty = 0.3 + Math.min(0.3, lenDiff * 0.05);
      return { matches: true, penalty: prefixPenalty, reason: "prefix" };
    }
  }

  // Levenshtein Typo match
  const dist = levenshtein(gToken, tToken);
  const maxTypos = Math.max(1, Math.floor(Math.max(gToken.length, tToken.length) / 3));
  if (dist <= maxTypos) {
    return { matches: true, penalty: 0.25 * dist, reason: "typo" };
  }

  // Substring Match
  if (tToken.includes(gToken) && gToken.length >= 4) {
    return { matches: true, penalty: 0.5, reason: "substring" };
  }

  return { matches: false, penalty: Infinity, reason: "none" };
}

export function evaluateMatch(guess: string, target: string): { score: number, penalty: number, confidence: number, bestReason: string } {
  // Lowercase, normalize hyphens to spaces to preserve token boundaries
  const g = guess.toLowerCase().replace(/-/g, ' ');
  const t = target.toLowerCase().replace(/-/g, ' ');

  const gTokens = g.split(' ').filter(Boolean);
  const tTokens = t.split(' ').filter(Boolean);

  let matches: any[] = [];
  for (let i = 0; i < gTokens.length; i++) {
    for (let j = 0; j < tTokens.length; j++) {
      for (let gLen = 1; i + gLen <= gTokens.length; gLen++) {
        const gStr = gTokens.slice(i, i + gLen).join('');
        for (let tLen = 1; j + tLen <= tTokens.length; tLen++) {
          const tStr = tTokens.slice(j, j + tLen).join('');

          const matchResult = matchToken(gStr, tStr);
          if (matchResult.matches) {
            matches.push({
              gStart: i, gEnd: i + gLen - 1,
              tStart: j, tEnd: j + tLen - 1,
              gStr, tStr,
              penalty: matchResult.penalty,
              reason: matchResult.reason
            });
          }
        }
      }
    }
  }

  if (matches.length === 0) return { score: Infinity, penalty: Infinity, confidence: 0, bestReason: 'none' };

  // Sort matches by penalty ASC, then length DESC
  matches.sort((a, b) => {
    if (a.penalty !== b.penalty) return a.penalty - b.penalty;
    const lenA = a.gEnd - a.gStart + a.tEnd - a.tStart;
    const lenB = b.gEnd - b.gStart + b.tEnd - b.tStart;
    return lenB - lenA;
  });

  // Greedily pick non-overlapping matches
  let finalMatches: any[] = [];
  let gUsed = new Set<number>();
  let tUsed = new Set<number>();

  for (const m of matches) {
    let overlap = false;
    for (let i = m.gStart; i <= m.gEnd; i++) if (gUsed.has(i)) overlap = true;
    for (let j = m.tStart; j <= m.tEnd; j++) if (tUsed.has(j)) overlap = true;
    if (!overlap) {
      finalMatches.push(m);
      for (let i = m.gStart; i <= m.gEnd; i++) gUsed.add(i);
      for (let j = m.tStart; j <= m.tEnd; j++) tUsed.add(j);
    }
  }

  const matchedGChars = finalMatches.reduce((sum, m) => sum + m.gStr.length, 0);
  const totalGChars = gTokens.join('').length;

  const matchedTTokensCount = new Set(finalMatches.map((m) => m.tStart)).size;
  const totalTTokensCount = tTokens.length;
  const unmatchedTTokensCount = totalTTokensCount - matchedTTokensCount;

  const totalMatchPenalty = finalMatches.reduce((sum, m) => sum + m.penalty, 0);
  const unmatchedGCharsPenalty = (totalGChars - matchedGChars) * 0.3;
  const unmatchedTTokensPenalty = unmatchedTTokensCount * 0.05; // 0.05 per unmatched token

  const totalScore = totalMatchPenalty + unmatchedGCharsPenalty + unmatchedTTokensPenalty;
  const confidence = Math.max(0, 1 - totalScore / 2.0);

  const bestReason = finalMatches[0]?.reason || 'none';

  return { score: totalScore, penalty: totalMatchPenalty, confidence, bestReason };
}
