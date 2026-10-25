import React, { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  Edit2,
} from 'lucide-react';
import {
  validateImageFile,
  resolveRestaurantImageSrc,
  restaurantImageService,
  MAX_IMAGE_FILE_SIZE_BYTES,
} from '../services/restaurantImageService';

interface RestaurantImageUploaderProps {
  label: string;
  value?: string | null;
  restaurantId?: string | null;
  targetType: 'restaurant' | 'menu_item';
  targetId?: string; // e.g. restaurantId if updating restaurant, or menuItemId if updating menu item
  onChange: (pathOrUrl: string) => void;
  disabled?: boolean;
  helpText?: string;
}

export const RestaurantImageUploader: React.FC<RestaurantImageUploaderProps> = ({
  label,
  value,
  restaurantId,
  targetType,
  targetId,
  onChange,
  disabled = false,
  helpText,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [imgLoadError, setImgLoadError] = useState(false);

  // Active display image: local preview during selection, or resolved database value
  const displaySrc = localPreviewUrl || resolveRestaurantImageSrc(value) || null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(false);

    // Validate
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || 'الملف المختار غير صالح');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);
    setImgLoadError(false);
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    if (!restaurantId?.trim()) {
      setUploadError(
        targetType === 'menu_item'
          ? 'يرجى اختيار المطعم التابع له هذا الصنف أولاً قبل رفع الصورة'
          : 'يرجى حفظ بيانات المطعم الأساسية أولاً للحصول على معرّف المطعم ثم رفع الصورة'
      );
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    setUploadStatusText('جاري بدء الرفع...');

    try {
      let result;
      if (targetType === 'restaurant') {
        result = await restaurantImageService.uploadAndSaveRestaurantImage(
          restaurantId.trim(),
          selectedFile,
          (status) => setUploadStatusText(status)
        );
      } else {
        result = await restaurantImageService.uploadAndSaveMenuItemImage(
          restaurantId.trim(),
          selectedFile,
          targetId,
          (status) => setUploadStatusText(status)
        );
      }

      if (result.success && result.path) {
        setUploadSuccess(true);
        onChange(result.path);
        setSelectedFile(null);
      } else {
        setUploadError(result.error || 'فشلت عملية رفع الصورة');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'حدث خطأ غير متوقع أثناء الرفع');
    } finally {
      setIsUploading(false);
      setUploadStatusText(null);
    }
  };

  const handleCancelSelection = () => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setSelectedFile(null);
    setLocalPreviewUrl(null);
    setUploadError(null);
    setUploadSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="block text-slate-300 font-bold">{label}</label>
        <button
          type="button"
          onClick={() => setShowManualInput(!showManualInput)}
          className="text-[10px] text-slate-400 hover:text-amber-400 transition flex items-center gap-1 cursor-pointer"
        >
          <Edit2 className="w-2.5 h-2.5" />
          <span>{showManualInput ? 'إخفاء المسار اليدوي' : 'إدخال مسار يدوي'}</span>
        </button>
      </div>

      {/* Manual Input Toggle for Advanced Cases */}
      {showManualInput && (
        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 block">
            المسار المخزن في قاعدة البيانات (مسار التخزين أو رابط مباشر):
          </span>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => {
              onChange(e.target.value);
              setImgLoadError(false);
            }}
            placeholder="restaurants/ID/image.jpg أو https://..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none font-mono"
            dir="ltr"
          />
        </div>
      )}

      {/* Main Uploader Box */}
      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-3">
        <div className="flex items-center gap-3">
          {/* Image Thumbnail Preview */}
          <div className="relative w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
            {displaySrc && !imgLoadError ? (
              <img
                src={displaySrc}
                alt="معاينة الصورة"
                className="w-full h-full object-cover"
                onError={() => setImgLoadError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-600 gap-1">
                <ImageIcon className="w-6 h-6" />
                <span className="text-[8px]">بلا صورة</span>
              </div>
            )}

            {isUploading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
              </div>
            )}
          </div>

          {/* Action & Info Area */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled || isUploading}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>{value || selectedFile ? 'تغيير الصورة' : 'اختيار صورة'}</span>
              </button>

              {selectedFile && !isUploading && !uploadSuccess && (
                <button
                  type="button"
                  onClick={handleStartUpload}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع وتأكيد</span>
                </button>
              )}

              {selectedFile && (
                <button
                  type="button"
                  onClick={handleCancelSelection}
                  disabled={isUploading}
                  className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/50 text-rose-400 border border-slate-800 cursor-pointer"
                  title="إلغاء التحديد"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-[10px] text-slate-500 leading-tight">
              {selectedFile ? (
                <span className="text-amber-300 font-semibold truncate block">
                  الملف المحدد: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} ك.ب)
                </span>
              ) : (
                <span>الصيغ المدعومة: JPG, PNG, WEBP (حد أقصى 10 ميجابايت)</span>
              )}
            </div>
          </div>
        </div>

        {/* Uploading Status Message */}
        {isUploading && (
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-2 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span className="text-[11px] font-bold">{uploadStatusText || 'جاري الرفع...'}</span>
          </div>
        )}

        {/* Success Banner */}
        {uploadSuccess && (
          <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold">تم رفع الصورة وحفظ المسار بنجاح</span>
            </div>
            {value && (
              <span className="text-[9px] font-mono text-slate-400 truncate max-w-[150px]" dir="ltr">
                {value}
              </span>
            )}
          </div>
        )}

        {/* Error Banner */}
        {uploadError && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-[11px] font-bold">تعذر إتمام الرفع</span>
            </div>
            <p className="text-[10px] text-rose-300 leading-relaxed">{uploadError}</p>
            {selectedFile && !isUploading && (
              <button
                type="button"
                onClick={handleStartUpload}
                className="mt-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>إعادة المحاولة الآن</span>
              </button>
            )}
          </div>
        )}

        {/* Helpful notice when restaurantId is missing */}
        {!restaurantId && (
          <div className="text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl">
            {targetType === 'menu_item'
              ? 'ملاحظة: اختر المطعم التابع له هذا الصنف أولاً لتفعيل رفع الصورة إلى حاوية الكتالوج.'
              : 'ملاحظة: عند إضافة مطعم جديد، احفظ المطعم أولاً وسيتم توليد معرّف المطعم لرفع الصور وتحديثها فوراً.'}
          </div>
        )}

        {helpText && <div className="text-[10px] text-slate-500">{helpText}</div>}
      </div>
    </div>
  );
};
