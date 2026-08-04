/**
 * Parent gate challenge: random 2-digit addition with 4 choices — one correct,
 * three plausible mistakes (off-by-carry, off-by-one...). rand is injectable
 * for tests.
 */
export function makeChallenge(rand = Math.random) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
  const a = int(10, 99)
  const b = int(10, 99)
  const answer = a + b

  const pool = [answer - 10, answer + 10, answer - 1, answer + 1, answer - 2, answer + 2, answer - 20, answer + 20]
  const distractors = [...new Set(pool.filter(n => n > 0 && n !== answer))].slice(0, 3)

  const choices = [answer, ...distractors]
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[choices[i], choices[j]] = [choices[j], choices[i]]
  }
  return { a, b, answer, choices }
}
