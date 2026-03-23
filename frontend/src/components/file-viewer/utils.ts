/**
 * File viewer utilities — extension mapping, language detection, and helpers.
 * Shared across all file-viewer components.
 */

/** Map file extension → highlight.js language identifier */
export const EXT_TO_HLJS_LANG: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  json: 'json',
  jsonl: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  md: 'markdown',
  mdx: 'markdown',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  sql: 'sql',
  r: 'r',
  lua: 'lua',
  php: 'php',
  perl: 'perl',
  pl: 'perl',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  cmake: 'cmake',
  groovy: 'groovy',
  scala: 'scala',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  clj: 'clojure',
  vim: 'vim',
  tex: 'latex',
  diff: 'diff',
  patch: 'diff',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'protobuf',
  nginx: 'nginx',
  env: 'ini',
};

/** Extensions that support rendered preview (Source ↔ Rendered toggle) */
const RENDERABLE_EXTENSIONS = new Set(['md', 'mdx', 'html', 'htm']);

/** Binary extensions that cannot be displayed as text */
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'avif',
  'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv', 'flv', 'ogg', 'webm',
  'pdf', 'zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz',
  'exe', 'dll', 'so', 'dylib', 'bin',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'pyc', 'pyo', 'class',
  'sqlite', 'db',
]);

/** Extract file extension from a path, handling special filenames */
export function getFileExtension(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1] || '';
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';
  if (lower === '.env' || lower.startsWith('.env.')) return 'env';
  return filename.split('.').pop()?.toLowerCase() || '';
}

/** Get just the filename from a full path */
export function getFileName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || filePath;
}

/** Human-readable language label for a file extension */
export function getLanguageLabel(ext: string): string {
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
    mjs: 'JavaScript', cjs: 'JavaScript',
    py: 'Python', rb: 'Ruby', rs: 'Rust', go: 'Go',
    java: 'Java', kt: 'Kotlin', swift: 'Swift',
    c: 'C', cpp: 'C++', cs: 'C#', h: 'C Header', hpp: 'C++ Header',
    css: 'CSS', scss: 'SCSS', less: 'LESS',
    html: 'HTML', htm: 'HTML', xml: 'XML', svg: 'SVG',
    json: 'JSON', jsonl: 'JSON Lines',
    yaml: 'YAML', yml: 'YAML', toml: 'TOML', ini: 'INI',
    md: 'Markdown', mdx: 'MDX',
    sh: 'Shell', bash: 'Bash', zsh: 'Zsh',
    sql: 'SQL', r: 'R', lua: 'Lua', php: 'PHP',
    perl: 'Perl', dockerfile: 'Dockerfile', makefile: 'Makefile',
    txt: 'Text', log: 'Log', csv: 'CSV',
    diff: 'Diff', patch: 'Patch',
    graphql: 'GraphQL', proto: 'Protobuf',
    env: 'Environment',
  };
  return map[ext] || (ext ? ext.toUpperCase() : 'Plain Text');
}

export function isRenderable(ext: string): boolean {
  return RENDERABLE_EXTENSIONS.has(ext);
}

export function isBinary(ext: string): boolean {
  return BINARY_EXTENSIONS.has(ext);
}

export function getRenderableType(ext: string): 'markdown' | 'html' | null {
  if (ext === 'md' || ext === 'mdx') return 'markdown';
  if (ext === 'html' || ext === 'htm') return 'html';
  return null;
}

/**
 * Split highlight.js HTML output into individual lines while preserving
 * open `<span>` tags across line boundaries.
 *
 * highlight.js can produce spans that cross `\n` boundaries. This function
 * tracks which tags are open, closes them at each `\n`, and re-opens them
 * on the next line so each line is a self-contained HTML fragment.
 */
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  let current = '';
  const openTags: string[] = [];

  for (let i = 0; i < html.length; i++) {
    if (html[i] === '\n') {
      // Close all open tags for this line
      for (let j = openTags.length - 1; j >= 0; j--) {
        current += '</span>';
      }
      lines.push(current);
      // Re-open all tags for the next line
      current = openTags.join('');
    } else if (html[i] === '<') {
      const tagEnd = html.indexOf('>', i);
      if (tagEnd === -1) {
        current += html[i];
        continue;
      }
      const tag = html.substring(i, tagEnd + 1);

      if (tag.startsWith('</')) {
        openTags.pop();
        current += tag;
      } else if (!tag.endsWith('/>')) {
        openTags.push(tag);
        current += tag;
      } else {
        current += tag;
      }

      i = tagEnd;
    } else {
      current += html[i];
    }
  }

  // Last line (no trailing newline)
  if (current || lines.length > 0) {
    for (let j = openTags.length - 1; j >= 0; j--) {
      current += '</span>';
    }
    lines.push(current);
  }

  return lines;
}
