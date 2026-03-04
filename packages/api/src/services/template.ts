export function renderTemplate(
  html: string,
  variables: Record<string, string>
): string {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

export function extractVariables(html: string): string[] {
  const matches = html.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}
