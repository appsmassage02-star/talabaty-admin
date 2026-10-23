import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  AllAppAssetsMap,
  AppAssetKey,
  AppAssetRecord,
  AppAssetType,
  AppAssetUploadRecord,
  LocalConfirmedAppAsset,
} from '../types';

export const SUPPORTED_APP_KEYS: AppAssetKey[] = ['home', 'driver', 'admin'];
export const SUPPORTED_ASSET_TYPES: AppAssetType[] = ['header', 'splash'];

const APP_KEY: AppAssetKey = 'admin';
const META_PREFIX = 'talabat_admin_asset_meta_admin_';
const DATA_PREFIX = 'talabat_admin_asset_data_admin_';
const TEMP_PREFIX = 'talabat_admin_asset_tmp_admin_';

const IDB_NAME = 'talabat_admin_asset_cache_db';
const IDB_VERSION = 1;
const IDB_STORE_CONFIRMED = 'confirmed_assets';
const IDB_STORE_TEMP = 'temp_assets';

type AssetUpdateListener = (assetType: AppAssetType, asset: LocalConfirmedAppAsset | null) => void;

const listeners = new Set<AssetUpdateListener>();

// Synchronous in-memory cache hydrated immediately on module load
const memoryConfirmedCache: Record<AppAssetType, LocalConfirmedAppAsset | null> = {
  header: readConfirmedFromLocalStorageSync('header'),
  splash: readConfirmedFromLocalStorageSync('splash'),
};

// Snapshot of the splash asset locked at startup so startup never waits for network
// and any new splash downloaded in background is applied on the NEXT startup (Section 7, 9, 10.7)
const startupSplashSnapshot: LocalConfirmedAppAsset | null = memoryConfirmedCache.splash
  ? { ...memoryConfirmedCache.splash }
  : null;

let isBackgroundSyncRunning = false;
let backgroundSyncInitialized = false;

function readConfirmedFromLocalStorageSync(assetType: AppAssetType): LocalConfirmedAppAsset | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const rawMeta = window.localStorage.getItem(`${META_PREFIX}${assetType}`);
    if (!rawMeta) return null;
    const meta = JSON.parse(rawMeta) as Omit<LocalConfirmedAppAsset, 'local_data_url'> & {
      local_data_url?: string;
    };
    if (!meta || typeof meta.version !== 'number' || !meta.upload_id) {
      return null;
    }
    const rawData = window.localStorage.getItem(`${DATA_PREFIX}${assetType}`) || meta.local_data_url || '';
    if (!rawData && !meta.public_url) {
      return null;
    }
    return {
      ...meta,
      local_data_url: rawData || meta.public_url,
    };
  } catch {
    return null;
  }
}

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_CONFIRMED)) {
          db.createObjectStore(IDB_STORE_CONFIRMED, { keyPath: 'asset_type' });
        }
        if (!db.objectStoreNames.contains(IDB_STORE_TEMP)) {
          db.createObjectStore(IDB_STORE_TEMP, { keyPath: 'asset_type' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(storeName: string, value: any): Promise<boolean> {
  const db = await openCacheDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

async function idbGet<T = any>(storeName: string, key: string): Promise<T | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as T) || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

// Hydrate from IndexedDB if localStorage didn't hold a large data URL
async function hydrateMemoryCacheFromIdb(): Promise<void> {
  for (const assetType of ['header', 'splash'] as AppAssetType[]) {
    const idbRecord = await idbGet<LocalConfirmedAppAsset>(IDB_STORE_CONFIRMED, assetType);
    if (
      idbRecord &&
      idbRecord.local_data_url &&
      (!memoryConfirmedCache[assetType] ||
        idbRecord.version >= memoryConfirmedCache[assetType]!.version)
    ) {
      memoryConfirmedCache[assetType] = idbRecord;
      if (assetType === 'header') {
        notifyListeners('header', idbRecord);
      }
    }
  }
}

// Start non-blocking IDB hydration immediately
if (typeof window !== 'undefined') {
  hydrateMemoryCacheFromIdb().catch(() => {});
}

function notifyListeners(assetType: AppAssetType, asset: LocalConfirmedAppAsset | null) {
  listeners.forEach((cb) => {
    try {
      cb(assetType, asset);
    } catch (e) {
      console.warn('Asset listener error:', e);
    }
  });
}

export function arrayBufferToBase64DataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const safeMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/png';
  return `data:${safeMime};base64,${window.btoa(binary)}`;
}

/**
 * Validates that a Data URL, Object URL, or Blob/File is a genuinely readable, non-corrupted image
 * and returns its natural dimensions.
 */
export async function verifyImageReadable(
  srcOrBlob: string | Blob
): Promise<{
  valid: boolean;
  width: number;
  height: number;
}> {
  if (typeof window === 'undefined' || !srcOrBlob) {
    return { valid: false, width: 0, height: 0 };
  }

  // 1. If a Blob/File is passed and createImageBitmap is available (fast & immune to DataURL length limits)
  if (
    typeof srcOrBlob !== 'string' &&
    typeof window.createImageBitmap === 'function' &&
    srcOrBlob.type !== 'image/svg+xml'
  ) {
    try {
      const bitmap = await window.createImageBitmap(srcOrBlob);
      const width = bitmap.width;
      const height = bitmap.height;
      if (typeof bitmap.close === 'function') {
        bitmap.close();
      }
      if (width > 0 && height > 0) {
        return { valid: true, width, height };
      }
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  // 2. HTMLImageElement verification (using Object URL if Blob, or string URL directly)
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ valid: false, width: 0, height: 0 });
      return;
    }

    let objectUrlToRevoke: string | null = null;
    let imgSrc = '';

    try {
      if (typeof srcOrBlob === 'string') {
        imgSrc = srcOrBlob;
      } else {
        objectUrlToRevoke = URL.createObjectURL(srcOrBlob);
        imgSrc = objectUrlToRevoke;
      }
    } catch {
      resolve({ valid: false, width: 0, height: 0 });
      return;
    }

    const cleanup = () => {
      if (objectUrlToRevoke) {
        try {
          URL.revokeObjectURL(objectUrlToRevoke);
        } catch {}
        objectUrlToRevoke = null;
      }
    };

    const img = new Image();
    const timer = window.setTimeout(() => {
      cleanup();
      resolve({ valid: false, width: 0, height: 0 });
    }, 15000);

    img.onload = () => {
      window.clearTimeout(timer);
      cleanup();
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 0 && h > 0) {
        resolve({
          valid: true,
          width: w,
          height: h,
        });
      } else {
        resolve({ valid: false, width: 0, height: 0 });
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve({ valid: false, width: 0, height: 0 });
    };

    img.src = imgSrc;
  });
}

async function blobToDataUrl(blob: Blob, fallbackMimeType: string = 'image/png'): Promise<string> {
  const effectiveMime =
    blob.type && blob.type.startsWith('image/')
      ? blob.type
      : fallbackMimeType && fallbackMimeType.startsWith('image/')
      ? fallbackMimeType
      : 'image/png';

  // Primary strategy: arrayBuffer -> base64 Data URL
  if (typeof blob.arrayBuffer === 'function') {
    try {
      const buffer = await blob.arrayBuffer();
      if (buffer && buffer.byteLength > 0) {
        return arrayBufferToBase64DataUrl(buffer, effectiveMime);
      }
    } catch {
      // Fallback to FileReader below
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
        if (reader.result.startsWith('data:image/')) {
          resolve(reader.result);
        } else {
          const base64Idx = reader.result.indexOf(';base64,');
          if (base64Idx !== -1) {
            resolve(`data:${effectiveMime}${reader.result.slice(base64Idx)}`);
          } else {
            resolve(reader.result);
          }
        }
      } else {
        reject(new Error('Failed to encode image as Data URL'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads an image from Storage/Public URL into a temporary buffer,
 * verifies completion and readability, and returns the verified Data URL + dimensions.
 */
async function downloadAndVerifyAssetToTemp(
  assetType: AppAssetType,
  upload: AppAssetUploadRecord,
  version: number
): Promise<{
  success: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
}> {
  try {
    let blob: Blob | null = null;

    // 1. Try downloading via public_url with cache-busting query param
    if (upload.public_url) {
      try {
        const separator = upload.public_url.includes('?') ? '&' : '?';
        const fetchUrl = `${upload.public_url}${separator}v=${version}&t=${Date.now()}`;
        const response = await fetch(fetchUrl, { cache: 'no-store' });
        if (response.ok) {
          const fetchedBlob = await response.blob();
          if (fetchedBlob && fetchedBlob.size > 0) {
            blob = fetchedBlob;
          }
        }
      } catch {
        // Fallback to Supabase storage download below
      }
    }

    // 2. Fallback: download directly from bucket 'app-assets' using storage_path
    if (!blob && supabase && upload.storage_path) {
      const cleanPath = upload.storage_path.replace(/^\/+/, '');
      const { data, error } = await supabase.storage.from('app-assets').download(cleanPath);
      if (!error && data && data.size > 0) {
        blob = data;
      }
    }

    if (!blob || blob.size === 0) {
      return { success: false };
    }

    // Convert to Data URL
    const dataUrl = await blobToDataUrl(blob);

    // Stage into temporary storage first (Section 10: قم بتحميل الصورة الجديدة إلى ملف مؤقت أولاً)
    const tempEntry = {
      asset_type: assetType,
      version,
      upload_id: upload.id,
      storage_path: upload.storage_path,
      local_data_url: dataUrl,
      staged_at: new Date().toISOString(),
    };

    await idbPut(IDB_STORE_TEMP, tempEntry);
    try {
      window.localStorage.setItem(
        `${TEMP_PREFIX}${assetType}`,
        JSON.stringify({
          version,
          upload_id: upload.id,
          storage_path: upload.storage_path,
          staged_at: tempEntry.staged_at,
        })
      );
    } catch {
      // Ignore quota on temp metadata
    }

    // Verify readability and dimensions of the staged image (Section 10.1 & 10.2)
    const verification = await verifyImageReadable(dataUrl);
    if (!verification.valid) {
      await idbDelete(IDB_STORE_TEMP, assetType);
      try {
        window.localStorage.removeItem(`${TEMP_PREFIX}${assetType}`);
      } catch {}
      return { success: false };
    }

    return {
      success: true,
      dataUrl,
      width: verification.width,
      height: verification.height,
      fileSize: blob.size,
      mimeType: blob.type || upload.mime_type || 'image/png',
    };
  } catch {
    await idbDelete(IDB_STORE_TEMP, assetType);
    try {
      window.localStorage.removeItem(`${TEMP_PREFIX}${assetType}`);
    } catch {}
    return { success: false };
  }
}

/**
 * Atomically promotes a verified image into the confirmed local asset store.
 * Never deletes the old confirmed asset before the new one is verified.
 */
export async function commitConfirmedLocalAsset(
  assetRecord: LocalConfirmedAppAsset,
  applyImmediatelyToRuntime: boolean = assetRecord.asset_type === 'header'
): Promise<void> {
  const { asset_type } = assetRecord;

  // 1. Save full record in IndexedDB confirmed store
  await idbPut(IDB_STORE_CONFIRMED, assetRecord);

  // 2. Save metadata + data in localStorage for 0ms synchronous access on next startup
  try {
    const { local_data_url, ...metaOnly } = assetRecord;
    window.localStorage.setItem(`${META_PREFIX}${asset_type}`, JSON.stringify(metaOnly));
    try {
      window.localStorage.setItem(`${DATA_PREFIX}${asset_type}`, local_data_url);
    } catch {
      // If image data exceeds localStorage 5MB quota, IndexedDB + public_url still serve it
    }
  } catch {
    // Ignore localStorage quota errors
  }

  // 3. Clean up temporary staging record
  await idbDelete(IDB_STORE_TEMP, asset_type);
  try {
    window.localStorage.removeItem(`${TEMP_PREFIX}${asset_type}`);
  } catch {}

  // 4. Update in-memory confirmed cache
  memoryConfirmedCache[asset_type] = assetRecord;

  // 5. Notify runtime listeners if immediate application is safe (Header = immediate, Splash = next startup unless explicitly requested by admin preview)
  if (applyImmediatelyToRuntime) {
    notifyListeners(asset_type, assetRecord);
  }
}

/**
 * Synchronously returns the confirmed local asset for immediate startup/offline use.
 * NEVER waits for Supabase or network.
 */
export function getConfirmedLocalAssetSync(assetType: AppAssetType): LocalConfirmedAppAsset | null {
  if (assetType === 'splash') {
    return startupSplashSnapshot || memoryConfirmedCache.splash;
  }
  return memoryConfirmedCache[assetType];
}

/**
 * Returns the latest confirmed local asset (including any background updates already committed to disk).
 */
export function getLatestConfirmedLocalAsset(assetType: AppAssetType): LocalConfirmedAppAsset | null {
  return memoryConfirmedCache[assetType];
}

/**
 * Subscribe to runtime confirmed asset updates (e.g. when Header is updated in background or via Admin upload).
 */
export function subscribeToConfirmedAssets(listener: AssetUpdateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fetches central `app_assets` records for all 3 applications (`home`, `driver`, `admin`)
 * and both asset types (`header`, `splash`) along with their linked `app_asset_uploads` records.
 */
export async function fetchRemoteAllAppAssets(): Promise<AllAppAssetsMap> {
  const result: AllAppAssetsMap = {
    home: { header: null, splash: null },
    driver: { header: null, splash: null },
    admin: { header: null, splash: null },
  };

  if (!supabase || !isSupabaseConfigured) {
    return result;
  }

  try {
    const [assetsRes, uploadsRes] = await Promise.all([
      supabase
        .from('app_assets')
        .select('*, upload:app_asset_uploads!app_assets_upload_id_fkey(*)')
        .in('app_key', SUPPORTED_APP_KEYS)
        .in('asset_type', SUPPORTED_ASSET_TYPES),
      supabase
        .from('app_asset_uploads')
        .select('*')
        .in('app_key', SUPPORTED_APP_KEYS)
        .in('asset_type', SUPPORTED_ASSET_TYPES)
        .order('created_at', { ascending: false }),
    ]);

    const allUploads: AppAssetUploadRecord[] = Array.isArray(uploadsRes.data)
      ? (uploadsRes.data as AppAssetUploadRecord[])
      : [];

    const uploadsById = new Map<string, AppAssetUploadRecord>();
    const currentUploadBySlot = new Map<string, AppAssetUploadRecord>();

    for (const up of allUploads) {
      if (up.id) uploadsById.set(up.id, up);
      const slotKey = `${up.app_key}:${up.asset_type}`;
      if (up.is_current && !currentUploadBySlot.has(slotKey)) {
        currentUploadBySlot.set(slotKey, up);
      }
    }

    if (Array.isArray(assetsRes.data)) {
      for (const row of assetsRes.data as any[]) {
        const appKey = row.app_key as AppAssetKey;
        const type = row.asset_type as AppAssetType;
        if (!SUPPORTED_APP_KEYS.includes(appKey) || !SUPPORTED_ASSET_TYPES.includes(type)) {
          continue;
        }

        let uploadRecord: AppAssetUploadRecord | null = Array.isArray(row.upload)
          ? row.upload[0] || null
          : row.upload || null;

        if (!uploadRecord && row.upload_id) {
          uploadRecord = uploadsById.get(row.upload_id) || null;
        }

        if (!uploadRecord) {
          uploadRecord = currentUploadBySlot.get(`${appKey}:${type}`) || null;
        }

        result[appKey][type] = {
          id: row.id,
          app_key: appKey,
          asset_type: type,
          upload_id: row.upload_id || uploadRecord?.id || null,
          version: Number(row.version ?? 1),
          is_active: row.is_active !== false,
          updated_at: row.updated_at || uploadRecord?.created_at || new Date().toISOString(),
          updated_by: row.updated_by || null,
          upload: uploadRecord,
        };
      }
    }

    // Fallback: if an upload exists with is_current=true for a slot that doesn't yet have an app_assets row
    for (const appKey of SUPPORTED_APP_KEYS) {
      for (const type of SUPPORTED_ASSET_TYPES) {
        if (!result[appKey][type]) {
          const currentUp = currentUploadBySlot.get(`${appKey}:${type}`);
          if (currentUp) {
            result[appKey][type] = {
              id: currentUp.id,
              app_key: appKey,
              asset_type: type,
              upload_id: currentUp.id,
              version: 1,
              is_active: true,
              updated_at: currentUp.created_at,
              updated_by: currentUp.uploaded_by || null,
              upload: currentUp,
            };
          }
        }
      }
    }

    return result;
  } catch {
    return result;
  }
}

/**
 * Fetches central `app_assets` records for `app_key = 'admin'` (`header` and `splash`)
 * along with their linked `app_asset_uploads` records.
 */
export async function fetchRemoteAdminAppAssets(): Promise<Record<AppAssetType, AppAssetRecord | null>> {
  const all = await fetchRemoteAllAppAssets();
  return all.admin;
}

/**
 * Background / Runtime synchronization:
 * Checks `app_assets.version` in Supabase against the locally confirmed version.
 * If a newer version exists in Supabase, downloads to a temporary buffer, verifies readability,
 * and atomically updates the local cache.
 * - Header: applied immediately once verified.
 * - Splash: saved locally and used starting from the next startup.
 */
export async function syncAdminAssetsInBackground(): Promise<void> {
  if (isBackgroundSyncRunning) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!supabase || !isSupabaseConfigured) return;

  isBackgroundSyncRunning = true;
  try {
    const remoteAssets = await fetchRemoteAdminAppAssets();

    for (const assetType of ['header', 'splash'] as AppAssetType[]) {
      const remote = remoteAssets[assetType];
      if (!remote || !remote.is_active || !remote.upload) {
        continue;
      }

      const localConfirmed = memoryConfirmedCache[assetType];
      const remoteVersion = Number(remote.version || 1);
      const localVersion = Number(localConfirmed?.version || 0);

      // Source of truth for version comparison is strictly app_assets.version (Section 8, 9, 10)
      const hasNewerVersion =
        !localConfirmed ||
        remoteVersion > localVersion ||
        (remoteVersion === localVersion && remote.upload.id !== localConfirmed.upload_id);

      if (!hasNewerVersion) {
        continue;
      }

      // Download to temporary storage and verify (Section 10)
      const verified = await downloadAndVerifyAssetToTemp(assetType, remote.upload, remoteVersion);
      if (!verified.success || !verified.dataUrl) {
        // Section 10: If anything fails, keep the old image and old local version untouched
        continue;
      }

      const newConfirmedRecord: LocalConfirmedAppAsset = {
        app_key: 'admin',
        asset_type: assetType,
        version: remoteVersion,
        upload_id: remote.upload.id,
        storage_path: remote.upload.storage_path,
        public_url: remote.upload.public_url,
        local_data_url: verified.dataUrl,
        original_filename: remote.upload.original_filename || null,
        mime_type: verified.mimeType || remote.upload.mime_type || null,
        file_size_bytes:
          remote.upload.file_size_bytes ??
          remote.upload.file_size ??
          verified.fileSize ??
          null,
        width: remote.upload.width ?? verified.width ?? null,
        height: remote.upload.height ?? verified.height ?? null,
        updated_at: remote.updated_at,
        confirmed_at: new Date().toISOString(),
      };

      // Section 10.6 & 10.7:
      // Header -> apply immediately to live UI
      // Splash -> save to confirmed local cache for next startup without disrupting current session
      const applyImmediately = assetType === 'header';
      await commitConfirmedLocalAsset(newConfirmedRecord, applyImmediately);
    }
  } catch {
    // Silent failure in background sync: never interrupt user or overwrite confirmed assets
  } finally {
    isBackgroundSyncRunning = false;
  }
}

/**
 * Initializes non-blocking background synchronization lifecycle hooks:
 * - Deferred post-startup check (never blocks startup)
 * - App resume / visibilitychange ('visible')
 * - Window focus & network 'online' recovery
 * - Periodic background check
 * - Supabase Realtime subscription on `app_assets`
 */
export function initAppAssetBackgroundSync(): void {
  if (backgroundSyncInitialized || typeof window === 'undefined') return;
  backgroundSyncInitialized = true;

  // 1. Run after startup in background without blocking initial render
  const scheduleInitialSync = () => {
    window.setTimeout(() => {
      syncAdminAssetsInBackground().catch(() => {});
    }, 300);
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(scheduleInitialSync, { timeout: 1000 });
  } else {
    scheduleInitialSync();
  }

  // 2. App resume from background (Web & Capacitor Android WebView lifecycle)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncAdminAssetsInBackground().catch(() => {});
    }
  });

  // 3. Window focus & network online events
  window.addEventListener('focus', () => {
    syncAdminAssetsInBackground().catch(() => {});
  });

  window.addEventListener('online', () => {
    syncAdminAssetsInBackground().catch(() => {});
  });

  // 4. Periodic background sync every 2 minutes
  window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      syncAdminAssetsInBackground().catch(() => {});
    }
  }, 120000);

  // 5. Realtime listener on public.app_assets for app_key = admin
  if (supabase && isSupabaseConfigured) {
    try {
      supabase
        .channel('admin_app_assets_sync')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_assets',
            filter: 'app_key=eq.admin',
          },
          () => {
            syncAdminAssetsInBackground().catch(() => {});
          }
        )
        .subscribe();
    } catch {
      // Ignore realtime subscription errors when offline
    }
  }
}
