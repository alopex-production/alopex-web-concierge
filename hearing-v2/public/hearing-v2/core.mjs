export const options = q => q.type === 'design'
  ? ['白基調','ダーク','ナチュラル','高級感','シンプル','ポップ'] : q.options;
export const visible = (q,a) => (!q.when || [a[q.when[0]]].flat().includes(q.when[1]))
  && (!q.unless || (a[q.unless[0]] && ![a[q.unless[0]]].flat().includes(q.unless[1])));
export const emailOK = v => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export function problem(q,v,final) {
  if (v === undefined || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim()))
    return final && q.required ? '回答してください' : '';
  if (q.type === 'multi') return Array.isArray(v) && v.every(x=>q.options.includes(x)) && new Set(v).size===v.length ? '' : '選択肢を確認してください';
  if (typeof v !== 'string' || v.length > 1200) return '1200文字以内で入力してください';
  if (['single','design'].includes(q.type) && !options(q).includes(v)) return '選択肢を確認してください';
  if (final && q.type === 'email' && !emailOK(v)) return 'メール形式を確認してください';
  if (final && q.type === 'url' && !URL.canParse(v)) return 'URLを確認してください';
  if (final && q.type === 'url' && !['http:','https:'].includes(new URL(v).protocol)) return 'HTTP または HTTPS のURLを入力してください';
  return '';
}
