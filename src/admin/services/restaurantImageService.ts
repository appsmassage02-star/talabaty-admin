/**
 * Service for Restaurant & Product Image Uploads
 * Interacts with:
 * 1. Main Project (Talabaty): https://itbfqpjwgjvvybffunkm.supabase.co
 *    - Edge Function: "food-image-upload-url" (validates user & issues signed upload URL)
 *    - Database: "restaurants" & "restaurant_menu_items" (stores permanent image path)
 * 2. Catalog Project (Storage Only): https://qjmcbaxyutatamzvudqp.supabase.co
 *    - Bucket: "restaurant-product-images"
 * Strictly avoids embedding any secret keys in frontend or client code.
 */

import { StorageClient } from '@supabase/storage-js';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase';
import { restaurantAdminService } from './restaurantAdminService';

export const CATALOG_SUPABASE_URL = 'https://qjmcbaxyutatamzvudqp.supabase.co';
export const CATALOG_STORAGE_URL = 'https://qjmcbaxyutatamzvudqp.supabase.co/storage/v1';
export const CATALOG_BUCKET_NAME = 'restaurant-product-images';

// Allowed image formats per specification: JPG, JPEG, PNG, WEBP
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

// Storage max file size (10MB limit check)
export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface SignedUploadUrlResponse {
  bucket: string;
  path: string;
  token: string;
  signed_url: string;
  content_type: string;
  expires_in_seconds?: number;
}

export interface UploadImageResult {
  success: boolean;
  path?: string;
  publicUrl?: string;
  error?: string;
}

/**
 * Validates a selected image file for format and size
 */
export function validateImageFile(file: File): { valid: boolean; error?: string; extension: string; mimeType: string } {
  if (!file) {
    return { valid: false, error: 'لم يتم اختيار أي ملف', extension: '', mimeType: '' };
  }

  // 1. Validate MIME type
  let mimeType = (file.type || '').toLowerCase();
  const nameParts = file.name.split('.');
  const ext = (nameParts.pop() || '').toLowerCase();

  // Normalize JPEG/JPG MIME
  if (!mimeType) {
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'webp') mimeType = 'image/webp';
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType) || !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `صيغة الملف غير مدعومة (${ext || 'غير محدد'}). الصيغ المسموحة هي: JPG, JPEG, PNG, WEBP فقط.`,
      extension: ext,
      mimeType,
    };
  }

  // 2. Validate File Size
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `حجم الصورة (${sizeMb} ميجابايت) يتجاوز الحد الأقصى المسموح به (10 ميجابايت).`,
      extension: ext === 'jpeg' ? 'jpg' : ext,
      mimeType,
    };
  }

  // Standardize extension for Edge Function
  const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;

  return {
    valid: true,
    extension: normalizedExt,
    mimeType,
  };
}

/**
 * Resolves an image source for rendering in <img> tags:
 * 1. If it's already an HTTP/HTTPS URL or data:image URL -> returned directly (backwards compatibility).
 * 2. If it's a relative path stored from the catalog bucket -> resolves to the catalog storage URL.
 */
export function resolveRestaurantImageSrc(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Relative storage path in catalog bucket
  let cleanPath = trimmed.replace(/^\/+/, '');
  if (cleanPath.startsWith(`${CATALOG_BUCKET_NAME}/`)) {
    cleanPath = cleanPath.slice(`${CATALOG_BUCKET_NAME}/`.length);
  }

  return `${CATALOG_STORAGE_URL}/object/public/${CATALOG_BUCKET_NAME}/${cleanPath}`;
}

export const restaurantImageService = {
  /**
   * 1. Request signed upload URL from Edge Function "food-image-upload-url"
   * Sends:
   *   restaurant_id: string
   *   content_type: string
   *   extension: string
   * Uses current user session bearer token.
   */
  async requestSignedUploadUrl(params: {
    restaurantId: string;
    contentType: string;
    extension: string;
  }): Promise<{ response: SignedUploadUrlResponse | null; error?: string }> {
    if (!supabase) {
      return { response: null, error: 'Supabase غير متصل' };
    }

    if (!params.restaurantId?.trim()) {
      return { response: null, error: 'معرّف المطعم مطلوب لإصدار رابط الرفع' };
    }

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session?.access_token) {
        return {
          response: null,
          error: 'جلسة تسجيل الدخول غير متوفرة أو منتهية. يرجى إعادة تسجيل الدخول كمسؤول أو كمالك للمطعم.',
        };
      }

      const accessToken = sessionData.session.access_token;
      const functionUrl = `${supabaseUrl}/functions/v1/food-image-upload-url`;

      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          restaurant_id: params.restaurantId.trim(),
          content_type: params.contentType,
          extension: params.extension,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          json?.message ||
          json?.error ||
          `تعذر الحصول على رابط رفع الصورة (رمز الخطأ: ${res.status})`;
        return { response: null, error: errorMsg };
      }

      if (!json || (!json.signed_url && !json.token)) {
        return {
          response: null,
          error: 'استجابة خادم الرفع غير صالحة، لم يتم استلام رابط أو رمز الرفع',
        };
      }

      const uploadData: SignedUploadUrlResponse = {
        bucket: json.bucket || CATALOG_BUCKET_NAME,
        path: json.path,
        token: json.token,
        signed_url: json.signed_url,
        content_type: json.content_type || params.contentType,
        expires_in_seconds: json.expires_in_seconds,
      };

      return { response: uploadData };
    } catch (err: any) {
      return {
        response: null,
        error: err?.message || 'فشل الاتصال بوظيفة إصدار رابط الرفع',
      };
    }
  },

  /**
   * 2. Upload the file to the Catalog project storage using Supabase Storage API
   */
  async uploadFileToCatalog(
    file: File | Blob,
    signedUpload: SignedUploadUrlResponse
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const targetBucket = signedUpload.bucket || CATALOG_BUCKET_NAME;
      const targetPath = signedUpload.path;
      const token = signedUpload.token;

      // Initialize Supabase Storage Client for catalog project
      const storageClient = new StorageClient(CATALOG_STORAGE_URL, {});

      // Perform upload using Supabase Storage API's uploadToSignedUrl
      const { data, error: storageErr } = await storageClient
        .from(targetBucket)
        .uploadToSignedUrl(targetPath, token, file, {
          contentType: signedUpload.content_type,
          upsert: true,
        });

      if (storageErr) {
        // Fallback: If uploadToSignedUrl method encountered a path/signature mismatch,
        // attempt direct PUT using signed_url if available
        if (signedUpload.signed_url) {
          const directUrl = signedUpload.signed_url.startsWith('http')
            ? signedUpload.signed_url
            : `${CATALOG_SUPABASE_URL}${signedUpload.signed_url.startsWith('/') ? '' : '/'}${signedUpload.signed_url}`;

          const directRes = await fetch(directUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': signedUpload.content_type,
              'x-upsert': 'true',
            },
            body: file,
          });

          if (!directRes.ok) {
            const errBody = await directRes.text().catch(() => '');
            return {
              success: false,
              error: `فشل رفع الصورة إلى حاوية الكتالوج: ${storageErr.message || errBody || directRes.statusText}`,
            };
          }

          return { success: true, path: targetPath };
        }

        return {
          success: false,
          error: `فشل رفع الصورة عبر Supabase Storage: ${storageErr.message}`,
        };
      }

      return { success: true, path: targetPath };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'حدث خطأ أثناء نقل ملف الصورة إلى خادم الكتالوج',
      };
    }
  },

  /**
   * Complete end-to-end upload cycle:
   * 1. Validate file
   * 2. Request signed upload URL from Edge Function
   * 3. Upload file to catalog storage
   * 4. Save path to Talabaty database (restaurants or restaurant_menu_items)
   */
  async uploadAndSaveRestaurantImage(
    restaurantId: string,
    file: File,
    onProgress?: (status: string) => void
  ): Promise<UploadImageResult> {
    // Step 1: Validate file
    onProgress?.('جاري فحص صيغة وحجم الصورة...');
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Step 2: Request signed upload URL
    onProgress?.('جاري استخراج رابط الرفع الموقّع من السيرفر...');
    const urlRes = await this.requestSignedUploadUrl({
      restaurantId,
      contentType: validation.mimeType,
      extension: validation.extension,
    });

    if (urlRes.error || !urlRes.response) {
      return { success: false, error: urlRes.error || 'تعذر إصدار تصريح رفع الصورة' };
    }

    // Step 3: Perform actual upload
    onProgress?.('جاري رفع الصورة إلى حاوية التخزين...');
    const uploadRes = await this.uploadFileToCatalog(file, urlRes.response);
    if (!uploadRes.success || !uploadRes.path) {
      return { success: false, error: uploadRes.error || 'فشل رفع ملف الصورة' };
    }

    const savedPath = uploadRes.path;

    // Step 4: Save path in Talabaty database under restaurants.image_url
    onProgress?.('جاري حفظ مسار الصورة في قاعدة البيانات...');
    const dbRes = await restaurantAdminService.updateRestaurant(restaurantId, {
      image_url: savedPath,
    });

    if (!dbRes.success) {
      return {
        success: false,
        error: `تم رفع ملف الصورة بنجاح ولكن تعذر حفظ المسار في سجل المطعم: ${dbRes.error}`,
      };
    }

    onProgress?.('تم الرفع وحفظ الصورة بنجاح!');
    return {
      success: true,
      path: savedPath,
      publicUrl: resolveRestaurantImageSrc(savedPath) || undefined,
    };
  },

  /**
   * Complete end-to-end upload cycle for Menu Item (Product):
   * 1. Validate file
   * 2. Request signed upload URL with restaurantId
   * 3. Upload file to catalog storage
   * 4. If menuItemId exists, save to restaurant_menu_items.image_url
   */
  async uploadAndSaveMenuItemImage(
    restaurantId: string,
    file: File,
    menuItemId?: string,
    onProgress?: (status: string) => void
  ): Promise<UploadImageResult> {
    if (!restaurantId?.trim()) {
      return { success: false, error: 'يجب تحديد المطعم التابع له الصنف أولاً لإصدار تصريح الرفع' };
    }

    // Step 1: Validate file
    onProgress?.('جاري فحص صيغة وحجم الصورة...');
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Step 2: Request signed upload URL
    onProgress?.('جاري استخراج رابط الرفع الموقّع من السيرفر...');
    const urlRes = await this.requestSignedUploadUrl({
      restaurantId,
      contentType: validation.mimeType,
      extension: validation.extension,
    });

    if (urlRes.error || !urlRes.response) {
      return { success: false, error: urlRes.error || 'تعذر إصدار تصريح رفع الصورة' };
    }

    // Step 3: Perform actual upload
    onProgress?.('جاري رفع صورة الصنف إلى حاوية التخزين...');
    const uploadRes = await this.uploadFileToCatalog(file, urlRes.response);
    if (!uploadRes.success || !uploadRes.path) {
      return { success: false, error: uploadRes.error || 'فشل رفع ملف الصورة' };
    }

    const savedPath = uploadRes.path;

    // Step 4: If menuItemId exists, save directly to restaurant_menu_items
    if (menuItemId) {
      onProgress?.('جاري تحديث سجل الصنف في قاعدة البيانات...');
      const dbRes = await restaurantAdminService.updateMenuItem(menuItemId, {
        image_url: savedPath,
      });

      if (!dbRes.success) {
        return {
          success: false,
          error: `تم رفع ملف الصورة بنجاح ولكن تعذر حفظ المسار في سجل الصنف: ${dbRes.error}`,
        };
      }
    }

    onProgress?.('تم الرفع وحفظ صورة الصنف بنجاح!');
    return {
      success: true,
      path: savedPath,
      publicUrl: resolveRestaurantImageSrc(savedPath) || undefined,
    };
  },
};
