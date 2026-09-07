const STOP_WORDS = new Set(['and', 'the', 'with', 'for', 'from', 'this', 'that', 'years', 'year', '工作', '负责', '以及', '相关']);

export function normalizeTerm(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s_]+/g, ' ');
}

export function uniqueTerms(values: string[]): string[] {
  return [...new Set(values.map(normalizeTerm).filter((value) => value.length > 1 && !STOP_WORDS.has(value)))];
}

export function termsFromText(text: string): string[] {
  const technical = text.match(/[A-Za-z][A-Za-z0-9.+#-]{1,24}/g) ?? [];
  const chinese = text.match(/[\u4e00-\u9fff]{2,8}/g) ?? [];
  return uniqueTerms([...technical, ...chinese]).slice(0, 80);
}
