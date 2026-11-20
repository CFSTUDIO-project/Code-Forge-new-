import type { WorkspaceFile } from './workspace';

const DB_NAME = 'codeforge-workspace';
const STORE = 'documents';
const KEY = 'active-project';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is unavailable in this browser.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open workspace database.'));
  });
}

export async function loadWorkspace(): Promise<WorkspaceFile[] | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result as WorkspaceFile[] : null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Local workspace could not be loaded:', error);
    return null;
  }
}

export async function saveWorkspace(files: WorkspaceFile[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(files, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Workspace save failed.'));
  });
}

export async function clearWorkspace(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Could not clear local workspace:', error);
  }
}
