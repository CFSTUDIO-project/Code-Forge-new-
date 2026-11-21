import type { WorkspaceFile } from './workspace';

const ARCHIVE_FORMAT = 'codeforge-workspace';
const MAX_FILES = 1200;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const SKIP_SEGMENTS = new Set(['node_modules', '.git', '.venv', 'venv', 'dist', 'build', '.next', '.turbo']);
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function write16(view: DataView, offset: number, value: number) { view.setUint16(offset, value, true); }
function write32(view: DataView, offset: number, value: number) { view.setUint32(offset, value >>> 0, true); }
function read16(view: DataView, offset: number) { return view.getUint16(offset, true); }
function read32(view: DataView, offset: number) { return view.getUint32(offset, true); }

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function safePath(input: string): string | null {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim();
  if (!normalized || normalized.endsWith('/')) return null;
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part.includes('\0'))) return null;
  if (parts.some((part) => SKIP_SEGMENTS.has(part.toLowerCase()))) return null;
  if (parts[0]?.startsWith('.DS_Store')) return null;
  return `/${normalized}`;
}

function makeWorkspaceFile(path: string, content: string): WorkspaceFile {
  const name = path.split('/').filter(Boolean).at(-1) ?? 'untitled.txt';
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, name, path, content };
}

export function createWorkspaceManifest(files: WorkspaceFile[]) {
  return {
    format: ARCHIVE_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    files: files.map(({ path, content }) => ({ path, content })),
  };
}

export function exportWorkspaceJson(files: WorkspaceFile[]): Blob {
  return new Blob([JSON.stringify(createWorkspaceManifest(files), null, 2)], { type: 'application/json;charset=utf-8' });
}

export function exportWorkspaceZip(files: WorkspaceFile[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const stamp = dosDateTime();
  let localOffset = 0;

  for (const file of files) {
    const path = safePath(file.path);
    if (!path) continue;
    const name = encoder.encode(path.slice(1));
    const body = encoder.encode(file.content);
    if (body.byteLength > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 5 MB export limit.`);
    const checksum = crc32(body);

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50); write16(localView, 4, 20); write16(localView, 6, 0x0800);
    write16(localView, 8, 0); write16(localView, 10, stamp.time); write16(localView, 12, stamp.date);
    write32(localView, 14, checksum); write32(localView, 18, body.length); write32(localView, 22, body.length);
    write16(localView, 26, name.length); write16(localView, 28, 0); local.set(name, 30);
    localParts.push(local, body);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50); write16(centralView, 4, 20); write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800); write16(centralView, 10, 0); write16(centralView, 12, stamp.time);
    write16(centralView, 14, stamp.date); write32(centralView, 16, checksum);
    write32(centralView, 20, body.length); write32(centralView, 24, body.length);
    write16(centralView, 28, name.length); write16(centralView, 30, 0); write16(centralView, 32, 0);
    write16(centralView, 34, 0); write16(centralView, 36, 0); write32(centralView, 38, 0);
    write32(centralView, 42, localOffset); central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + body.length;
  }

  if (centralParts.length > MAX_FILES) throw new Error(`A workspace can contain up to ${MAX_FILES} files per export.`);
  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50); write16(endView, 4, 0); write16(endView, 6, 0);
  write16(endView, 8, centralParts.length); write16(endView, 10, centralParts.length);
  write32(endView, 12, centralDirectory.length); write32(endView, 16, localOffset); write16(endView, 20, 0);
  return concat([...localParts, centralDirectory, end]);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress ZIP files. Import a .codeforge.json backup instead.');
  try {
    const payload = data.slice().buffer as ArrayBuffer;
    const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error('Could not decompress this ZIP entry. Try exporting from CODEFORGE and importing that ZIP.');
  }
}

async function readZip(buffer: ArrayBuffer): Promise<{ files: WorkspaceFile[]; skipped: string[] }> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let endOffset = -1;
  const scanStart = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= scanStart; i--) {
    if (read32(view, i) === 0x06054b50) { endOffset = i; break; }
  }
  if (endOffset < 0) throw new Error('This file is not a valid ZIP archive.');
  const count = read16(view, endOffset + 10);
  const directoryOffset = read32(view, endOffset + 16);
  if (count > MAX_FILES) throw new Error(`The archive contains too many files (limit ${MAX_FILES}).`);

  const entries: Array<{ path: string; method: number; crc: number; compressed: number; uncompressed: number; local: number; flags: number }> = [];
  let cursor = directoryOffset;
  for (let i = 0; i < count; i++) {
    if (read32(view, cursor) !== 0x02014b50) throw new Error('The ZIP directory is damaged.');
    const flags = read16(view, cursor + 8);
    const method = read16(view, cursor + 10);
    const crc = read32(view, cursor + 16);
    const compressed = read32(view, cursor + 20);
    const uncompressed = read32(view, cursor + 24);
    const nameLength = read16(view, cursor + 28);
    const extraLength = read16(view, cursor + 30);
    const commentLength = read16(view, cursor + 32);
    const local = read32(view, cursor + 42);
    const pathName = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const path = safePath(pathName);
    if (path && !pathName.endsWith('/')) entries.push({ path, method, crc, compressed, uncompressed, local, flags });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  const files: WorkspaceFile[] = [];
  const skipped: string[] = [];
  let totalBytes = 0;
  for (const entry of entries) {
    if ((entry.flags & 1) !== 0) { skipped.push(`${entry.path}: encrypted`); continue; }
    if (entry.uncompressed > MAX_FILE_BYTES) { skipped.push(`${entry.path}: larger than 5 MB`); continue; }
    totalBytes += entry.uncompressed;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('The expanded archive exceeds the 30 MB safety limit.');
    if (read32(view, entry.local) !== 0x04034b50) { skipped.push(`${entry.path}: invalid local header`); continue; }
    const nameLength = read16(view, entry.local + 26);
    const extraLength = read16(view, entry.local + 28);
    const start = entry.local + 30 + nameLength + extraLength;
    const compressedData = bytes.slice(start, start + entry.compressed);
    let body: Uint8Array;
    if (entry.method === 0) body = compressedData;
    else if (entry.method === 8) body = await inflateRaw(compressedData);
    else { skipped.push(`${entry.path}: unsupported ZIP compression (${entry.method})`); continue; }
    if (body.length !== entry.uncompressed || crc32(body) !== entry.crc) { skipped.push(`${entry.path}: damaged or incomplete`); continue; }
    try {
      const content = decoder.decode(body);
      if (content.includes('\0')) { skipped.push(`${entry.path}: binary file is not editable as text`); continue; }
      files.push(makeWorkspaceFile(entry.path, content));
    } catch {
      skipped.push(`${entry.path}: binary or non-UTF-8 file`);
    }
  }

  // GitHub source archives usually wrap every file in one repository-name folder.
  if (files.length) {
    const roots = new Set(files.map((file) => file.path.split('/').filter(Boolean)[0]));
    if (roots.size === 1) {
      const root = `/${[...roots][0]}/`;
      if (files.every((file) => file.path.startsWith(root))) {
        for (const file of files) file.path = file.path.slice(root.length - 1);
        for (const file of files) file.name = file.path.split('/').filter(Boolean).at(-1) ?? file.name;
      }
    }
  }
  return { files, skipped };
}

export async function importWorkspaceFile(file: File): Promise<{ files: WorkspaceFile[]; skipped: string[] }> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.zip')) return readZip(await file.arrayBuffer());
  if (lowerName.endsWith('.codeforge.json')) {
    const value: unknown = JSON.parse(await file.text());
    if (!value || typeof value !== 'object' || !('format' in value) || value.format !== ARCHIVE_FORMAT || !('files' in value) || !Array.isArray(value.files)) {
      throw new Error('This is not a valid CODEFORGE workspace backup.');
    }
    const files: WorkspaceFile[] = [];
    const seen = new Set<string>();
    let totalBytes = 0;
    const skipped: string[] = [];
    for (const entry of value.files) {
      if (!entry || typeof entry.path !== 'string' || typeof entry.content !== 'string') continue;
      const path = safePath(entry.path);
      if (!path) { skipped.push('An entry had an unsafe path.'); continue; }
      const bytes = encoder.encode(entry.content).byteLength;
      if (bytes > MAX_FILE_BYTES) { skipped.push(`${path}: larger than 5 MB`); continue; }
      if (seen.has(path.toLowerCase())) { skipped.push(`${path}: duplicate path`); continue; }
      totalBytes += bytes;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error('The backup exceeds the 30 MB safety limit.');
      seen.add(path.toLowerCase());
      files.push(makeWorkspaceFile(path, entry.content));
      if (files.length >= MAX_FILES) break;
    }
    return { files, skipped };
  }
  if (file.size > MAX_FILE_BYTES) throw new Error('Single file import limit is 5 MB.');
  const path = safePath(file.name);
  if (!path) throw new Error('Invalid file name.');
  const content = await file.text();
  if (content.includes('\0')) throw new Error('Binary files cannot be opened in the text editor yet.');
  return { files: [makeWorkspaceFile(path, content)], skipped: [] };
}
