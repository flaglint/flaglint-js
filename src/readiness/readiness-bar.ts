export function renderReadinessBar(score: number): string {
  const filled = Math.round((score / 100) * 25);
  const empty = 25 - filled;
  return "[" + "█".repeat(filled) + "░".repeat(empty) + "] " + score + "%";
}
