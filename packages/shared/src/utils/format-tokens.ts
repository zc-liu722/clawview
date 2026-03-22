export function formatTokens(tokenCount: number): string {
  return new Intl.NumberFormat("en-US").format(tokenCount);
}
