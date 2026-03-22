function truncateAtWordBoundary(content: string, limit: number): string {
  if (content.length <= limit) {
    return content;
  }

  const truncated = content.slice(0, limit + 1);
  const boundary = truncated.lastIndexOf(" ");

  if (boundary >= Math.floor(limit * 0.6)) {
    return `${truncated.slice(0, boundary).trim()}...`;
  }

  return `${content.slice(0, limit).trim()}...`;
}

export function sanitizeDisplayText(
  content: string | null | undefined,
  fallback: string,
  limit = 96,
): string {
  if (!content) {
    return fallback;
  }

  const cleaned = content
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/`[^`]*`/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/<\/?[^>]+>/gu, " ")
    .replace(/(?:^|\s)(?:[A-Za-z]:)?(?:\/[\w.-]+)+/gu, " ")
    .replace(/\b[a-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md|yaml|yml|sh|py|css|html)\b/giu, " ")
    .replace(/\{[^{}]{0,400}\}/gu, " ")
    .replace(/\[[^\[\]]{0,400}\]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return truncateAtWordBoundary(cleaned, limit) || fallback;
}
