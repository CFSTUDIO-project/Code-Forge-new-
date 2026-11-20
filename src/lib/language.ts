import {
  Braces, Code2, FileCode2, FileJson, FileText, Globe2, Hash, Image,
  Palette, TerminalSquare, Database, Coffee, Cog, type LucideIcon,
} from 'lucide-react';

export type LanguageInfo = { label: string; monaco: string; icon: LucideIcon; tone: string; runnable?: 'python' | 'javascript' | 'preview' };

const languages: Record<string, LanguageInfo> = {
  html: { label: 'HTML', monaco: 'html', icon: Globe2, tone: 'html', runnable: 'preview' },
  htm: { label: 'HTML', monaco: 'html', icon: Globe2, tone: 'html', runnable: 'preview' },
  css: { label: 'CSS', monaco: 'css', icon: Palette, tone: 'css', runnable: 'preview' },
  scss: { label: 'SCSS', monaco: 'scss', icon: Palette, tone: 'css' },
  js: { label: 'JavaScript', monaco: 'javascript', icon: FileCode2, tone: 'js', runnable: 'javascript' },
  mjs: { label: 'JavaScript', monaco: 'javascript', icon: FileCode2, tone: 'js', runnable: 'javascript' },
  cjs: { label: 'JavaScript', monaco: 'javascript', icon: FileCode2, tone: 'js', runnable: 'javascript' },
  jsx: { label: 'React JSX', monaco: 'javascript', icon: Code2, tone: 'react' },
  ts: { label: 'TypeScript', monaco: 'typescript', icon: FileCode2, tone: 'ts' },
  tsx: { label: 'React TSX', monaco: 'typescript', icon: Code2, tone: 'react' },
  py: { label: 'Python', monaco: 'python', icon: Hash, tone: 'python', runnable: 'python' },
  json: { label: 'JSON', monaco: 'json', icon: FileJson, tone: 'json' },
  md: { label: 'Markdown', monaco: 'markdown', icon: FileText, tone: 'markdown' },
  yml: { label: 'YAML', monaco: 'yaml', icon: FileText, tone: 'yaml' },
  yaml: { label: 'YAML', monaco: 'yaml', icon: FileText, tone: 'yaml' },
  java: { label: 'Java', monaco: 'java', icon: Coffee, tone: 'java' },
  kt: { label: 'Kotlin', monaco: 'kotlin', icon: FileCode2, tone: 'kotlin' },
  kts: { label: 'Kotlin Script', monaco: 'kotlin', icon: FileCode2, tone: 'kotlin' },
  c: { label: 'C', monaco: 'c', icon: Code2, tone: 'c' },
  h: { label: 'C Header', monaco: 'c', icon: Code2, tone: 'c' },
  cpp: { label: 'C++', monaco: 'cpp', icon: Code2, tone: 'cpp' },
  cc: { label: 'C++', monaco: 'cpp', icon: Code2, tone: 'cpp' },
  rs: { label: 'Rust', monaco: 'rust', icon: Cog, tone: 'rust' },
  go: { label: 'Go', monaco: 'go', icon: Code2, tone: 'go' },
  php: { label: 'PHP', monaco: 'php', icon: FileCode2, tone: 'php' },
  sql: { label: 'SQL', monaco: 'sql', icon: Database, tone: 'sql' },
  lua: { label: 'Lua', monaco: 'lua', icon: Code2, tone: 'lua' },
  sh: { label: 'Shell', monaco: 'shell', icon: TerminalSquare, tone: 'shell' },
  xml: { label: 'XML', monaco: 'xml', icon: FileCode2, tone: 'xml' },
  svg: { label: 'SVG', monaco: 'xml', icon: Image, tone: 'svg' },
  toml: { label: 'TOML', monaco: 'ini', icon: Braces, tone: 'json' },
};

export function languageForFile(name: string): LanguageInfo {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return languages[ext] ?? { label: 'Plain Text', monaco: 'plaintext', icon: FileText, tone: 'plain' };
}

export const languageCatalog = [
  'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Python', 'Java', 'Kotlin', 'C', 'C++', 'C#', 'Rust', 'Go', 'PHP', 'SQL', 'Lua', 'JSON', 'YAML', 'Markdown',
];
