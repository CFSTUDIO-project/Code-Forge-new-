import {
  Braces, Code2, FileCode2, FileJson, FileText, Globe2, Hash, Image,
  Palette, TerminalSquare, Database, Coffee, Cog, type LucideIcon,
} from 'lucide-react';

export type LanguageInfo = {
  label: string;
  monaco: string;
  icon: LucideIcon;
  tone: string;
  mark?: string;
  runnable?: 'python' | 'javascript' | 'preview';
};

const languages: Record<string, LanguageInfo> = {
  html: { label: 'HTML', monaco: 'html', icon: Globe2, tone: 'html', mark: '5', runnable: 'preview' },
  htm: { label: 'HTML', monaco: 'html', icon: Globe2, tone: 'html', mark: '5', runnable: 'preview' },
  css: { label: 'CSS', monaco: 'css', icon: Palette, tone: 'css', mark: '3', runnable: 'preview' },
  scss: { label: 'SCSS', monaco: 'scss', icon: Palette, tone: 'css', mark: 'SCSS' },
  less: { label: 'Less', monaco: 'less', icon: Palette, tone: 'css', mark: 'LESS' },
  js: { label: 'JavaScript', monaco: 'javascript', icon: FileCode2, tone: 'js', mark: 'JS', runnable: 'javascript' },
  mjs: { label: 'JavaScript', monaco: 'javascript', icon: FileCode2, tone: 'js', mark: 'JS', runnable: 'javascript' },
  cjs: { label: 'JavaScript', monaco: 'javascript', icon: FileCode2, tone: 'js', mark: 'JS', runnable: 'javascript' },
  jsx: { label: 'React JSX', monaco: 'javascript', icon: Code2, tone: 'react', mark: 'JSX' },
  ts: { label: 'TypeScript', monaco: 'typescript', icon: FileCode2, tone: 'ts', mark: 'TS' },
  tsx: { label: 'React TSX', monaco: 'typescript', icon: Code2, tone: 'react', mark: 'TSX' },
  py: { label: 'Python', monaco: 'python', icon: Hash, tone: 'python', mark: 'Py', runnable: 'python' },
  json: { label: 'JSON', monaco: 'json', icon: FileJson, tone: 'json', mark: '{}' },
  jsonc: { label: 'JSON with Comments', monaco: 'json', icon: FileJson, tone: 'json', mark: '{c}' },
  md: { label: 'Markdown', monaco: 'markdown', icon: FileText, tone: 'markdown', mark: 'MD' },
  mdx: { label: 'MDX', monaco: 'markdown', icon: FileText, tone: 'markdown', mark: 'MDX' },
  yml: { label: 'YAML', monaco: 'yaml', icon: FileText, tone: 'yaml', mark: 'YML' },
  yaml: { label: 'YAML', monaco: 'yaml', icon: FileText, tone: 'yaml', mark: 'YML' },
  java: { label: 'Java', monaco: 'java', icon: Coffee, tone: 'java', mark: 'J' },
  kt: { label: 'Kotlin', monaco: 'kotlin', icon: FileCode2, tone: 'kotlin', mark: 'Kt' },
  kts: { label: 'Kotlin Script', monaco: 'kotlin', icon: FileCode2, tone: 'kotlin', mark: 'Kt' },
  c: { label: 'C', monaco: 'c', icon: Code2, tone: 'c', mark: 'C' },
  h: { label: 'C Header', monaco: 'c', icon: Code2, tone: 'c', mark: 'H' },
  cpp: { label: 'C++', monaco: 'cpp', icon: Code2, tone: 'cpp', mark: 'C++' },
  cc: { label: 'C++', monaco: 'cpp', icon: Code2, tone: 'cpp', mark: 'C++' },
  hpp: { label: 'C++ Header', monaco: 'cpp', icon: Code2, tone: 'cpp', mark: 'H++' },
  cs: { label: 'C#', monaco: 'csharp', icon: Code2, tone: 'csharp', mark: 'C#' },
  rs: { label: 'Rust', monaco: 'rust', icon: Cog, tone: 'rust', mark: 'Rs' },
  go: { label: 'Go', monaco: 'go', icon: Code2, tone: 'go', mark: 'Go' },
  php: { label: 'PHP', monaco: 'php', icon: FileCode2, tone: 'php', mark: 'PHP' },
  sql: { label: 'SQL', monaco: 'sql', icon: Database, tone: 'sql', mark: 'SQL' },
  lua: { label: 'Lua', monaco: 'lua', icon: Code2, tone: 'lua', mark: 'Lua' },
  sh: { label: 'Shell', monaco: 'shell', icon: TerminalSquare, tone: 'shell', mark: '$_' },
  bash: { label: 'Bash', monaco: 'shell', icon: TerminalSquare, tone: 'shell', mark: '$_' },
  zsh: { label: 'Zsh', monaco: 'shell', icon: TerminalSquare, tone: 'shell', mark: '$_' },
  xml: { label: 'XML', monaco: 'xml', icon: FileCode2, tone: 'xml', mark: 'XML' },
  svg: { label: 'SVG', monaco: 'xml', icon: Image, tone: 'svg', mark: 'SVG' },
  toml: { label: 'TOML', monaco: 'ini', icon: Braces, tone: 'json', mark: 'TOML' },
  ini: { label: 'INI', monaco: 'ini', icon: Braces, tone: 'json', mark: 'INI' },
  dockerfile: { label: 'Dockerfile', monaco: 'dockerfile', icon: Cog, tone: 'docker', mark: 'DK' },
  sqlx: { label: 'SQL', monaco: 'sql', icon: Database, tone: 'sql', mark: 'SQL' },
  graphql: { label: 'GraphQL', monaco: 'graphql', icon: Braces, tone: 'graphql', mark: 'GQL' },
  vue: { label: 'Vue', monaco: 'html', icon: Code2, tone: 'vue', mark: 'V' },
  svelte: { label: 'Svelte', monaco: 'html', icon: Code2, tone: 'svelte', mark: 'S' },
  rb: { label: 'Ruby', monaco: 'ruby', icon: Code2, tone: 'rust', mark: 'Rb' },
  swift: { label: 'Swift', monaco: 'swift', icon: Code2, tone: 'rust', mark: 'Sw' },
  dart: { label: 'Dart', monaco: 'dart', icon: Code2, tone: 'go', mark: 'Da' },
  r: { label: 'R', monaco: 'r', icon: Code2, tone: 'c', mark: 'R' },
  pl: { label: 'Perl', monaco: 'perl', icon: Code2, tone: 'shell', mark: 'Pl' },
  ex: { label: 'Elixir', monaco: 'elixir', icon: Code2, tone: 'graphql', mark: 'Ex' },
  erl: { label: 'Erlang', monaco: 'erlang', icon: Code2, tone: 'rust', mark: 'Er' },
  ps1: { label: 'PowerShell', monaco: 'powershell', icon: TerminalSquare, tone: 'shell', mark: 'PS' },
  bat: { label: 'Batch', monaco: 'bat', icon: TerminalSquare, tone: 'shell', mark: 'BAT' },
  cmd: { label: 'Command Script', monaco: 'bat', icon: TerminalSquare, tone: 'shell', mark: 'CMD' },
  prisma: { label: 'Prisma', monaco: 'prisma', icon: Database, tone: 'sql', mark: 'PR' },
  tf: { label: 'Terraform', monaco: 'hcl', icon: Cog, tone: 'rust', mark: 'TF' },
  hcl: { label: 'HCL', monaco: 'hcl', icon: Cog, tone: 'rust', mark: 'HCL' },
  ipynb: { label: 'Jupyter Notebook', monaco: 'json', icon: FileJson, tone: 'json', mark: 'NB' },
  lock: { label: 'Lock File', monaco: 'plaintext', icon: FileText, tone: 'plain', mark: 'LOCK' },
  xmls: { label: 'XML', monaco: 'xml', icon: FileCode2, tone: 'xml', mark: 'XML' },
};

const specialFiles: Record<string, LanguageInfo> = {
  'dockerfile': languages.dockerfile,
  'makefile': { label: 'Makefile', monaco: 'makefile', icon: Cog, tone: 'docker', mark: 'MK' },
  'package.json': languages.json,
  'package-lock.json': languages.json,
  'tsconfig.json': languages.json,
  'jsconfig.json': languages.json,
  '.gitignore': { label: 'Git Ignore', monaco: 'ignore', icon: FileText, tone: 'markdown', mark: 'GIT' },
  '.gitattributes': { label: 'Git Attributes', monaco: 'ini', icon: FileText, tone: 'markdown', mark: 'GIT' },
  '.editorconfig': { label: 'EditorConfig', monaco: 'ini', icon: Cog, tone: 'json', mark: 'CFG' },
  '.env': { label: 'Environment', monaco: 'dotenv', icon: Cog, tone: 'json', mark: 'ENV' },
  '.env.example': { label: 'Environment', monaco: 'dotenv', icon: Cog, tone: 'json', mark: 'ENV' },
  '.env.local': { label: 'Environment', monaco: 'dotenv', icon: Cog, tone: 'json', mark: 'ENV' },
  '.env.development': { label: 'Environment', monaco: 'dotenv', icon: Cog, tone: 'json', mark: 'ENV' },
  '.env.production': { label: 'Environment', monaco: 'dotenv', icon: Cog, tone: 'json', mark: 'ENV' },
  '.env.test': { label: 'Environment', monaco: 'dotenv', icon: Cog, tone: 'json', mark: 'ENV' },
  '.dockerignore': { label: 'Docker Ignore', monaco: 'ignore', icon: Cog, tone: 'docker', mark: 'DK' },
  '.npmrc': { label: 'NPM Config', monaco: 'ini', icon: Cog, tone: 'json', mark: 'NPM' },
  '.nvmrc': { label: 'Node Version', monaco: 'plaintext', icon: Cog, tone: 'js', mark: 'NVM' },
  '.prettierrc': { label: 'Prettier Config', monaco: 'json', icon: Braces, tone: 'json', mark: 'PRE' },
  '.eslintrc': { label: 'ESLint Config', monaco: 'json', icon: Cog, tone: 'js', mark: 'ESL' },
  'cargo.toml': { label: 'Cargo Manifest', monaco: 'toml', icon: Cog, tone: 'rust', mark: 'CR' },
  'go.mod': { label: 'Go Module', monaco: 'go', icon: Code2, tone: 'go', mark: 'Go' },
  'requirements.txt': { label: 'Python Requirements', monaco: 'plaintext', icon: Hash, tone: 'python', mark: 'Py' },
  'pyproject.toml': { label: 'Python Project', monaco: 'toml', icon: Hash, tone: 'python', mark: 'Py' },
  'gemfile': { label: 'Ruby Dependencies', monaco: 'ruby', icon: Code2, tone: 'rust', mark: 'Rb' },
  'readme': { label: 'Markdown', monaco: 'markdown', icon: FileText, tone: 'markdown', mark: 'MD' },
  'license': { label: 'License', monaco: 'plaintext', icon: FileText, tone: 'markdown', mark: 'LIC' },
};

export function languageForFile(name: string): LanguageInfo {
  const normalized = name.split('/').pop()?.toLowerCase() ?? '';
  if (specialFiles[normalized]) return specialFiles[normalized];
  if (normalized.startsWith('.env.')) return specialFiles['.env'];
  const dot = normalized.lastIndexOf('.');
  const ext = dot > 0 && dot < normalized.length - 1 ? normalized.slice(dot + 1) : normalized.startsWith('.') ? '' : '';
  return languages[ext] ?? { label: 'Plain Text', monaco: 'plaintext', icon: FileText, tone: 'plain', mark: undefined };
}

export const languageCatalog = [
  'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Python', 'Java', 'Kotlin', 'C', 'C++', 'C#', 'Rust', 'Go', 'PHP', 'SQL', 'Lua', 'JSON', 'YAML', 'Markdown', 'Bash', 'PowerShell', 'Dockerfile', 'GraphQL', 'Vue', 'Svelte', 'Ruby', 'Swift', 'Dart', 'R', 'Terraform', 'Prisma', 'Jupyter Notebook',
];
