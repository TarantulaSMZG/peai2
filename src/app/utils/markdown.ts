import DOMPurify from 'dompurify';

export function renderMarkdown(markdownText: string): string {
  if (!markdownText) return '';
  
  let html = markdownText
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  html = html.split('\n').join('<br />');
  
  return DOMPurify.sanitize(html);
}
