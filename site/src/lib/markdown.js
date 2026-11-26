import MarkdownIt from 'markdown-it';

// markdown-it's default preset (markdown-it-py calls it "js-default"): CommonMark with raw
// HTML off, so HTML in a description is escaped, and validateLink drops javascript:,
// vbscript:, file: and data: links (except data: images). Tables and strikethrough stay on.
const markdown = new MarkdownIt();

export function renderMarkdown(text) {
  return markdown.render(text);
}
