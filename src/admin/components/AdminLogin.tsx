import React, { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertTriangle,
  LogIn,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  CheckCircle2,
} from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const { adminSignIn, adminAuthError, isAdminLoading, setViewMode, headerAssetSrc, splashAssetSrc } = useAdmin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [headerImgError, setHeaderImgError] = useState(false);
  const [splashImgError, setSplashImgError] = useState(false);

  React.useEffect(() => {
    setHeaderImgError(false);
  }, [headerAssetSrc]);

  React.useEffect(() => {
    setSplashImgError(false);
  }, [splashAssetSrc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password) {
      setLocalError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminSignIn(email.trim(), password);
      if (!res.success) {
        setLocalError(res.error || 'فشل تسجيل الدخول. تحقق من صلاحيات المشرف');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const currentError = localError || adminAuthError;

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-['Cairo',sans-serif] selection:bg-emerald-600 selection:text-white p-4 sm:p-6"
      dir="rtl"
    >
      {/* Top Brand Strip */}
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center space-x-2.5 space-x-reverse">
          {headerAssetSrc && !headerImgError ? (
            <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-emerald-400/30 flex items-center justify-center overflow-hidden shadow-lg shadow-emerald-500/20 shrink-0">
              <img
                src={headerAssetSrc}
                alt="طلبات البيت"
                onError={() => setHeaderImgError(true)}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
          )}
          <div>
            <h1 className="text-base font-black text-white leading-tight">طلبات البيت</h1>
            <span className="text-[10px] text-emerald-400 font-bold block">مركز التحكم الإداري الشامل</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setViewMode('client_app')}
          className="text-xs font-bold text-slate-400 hover:text-emerald-400 bg-slate-900/80 hover:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-800 transition-all flex items-center space-x-1.5 space-x-reverse cursor-pointer"
        >
          <span>الانتقال لتطبيق المستخدم</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Login Card Container */}
      <div className="max-w-md w-full mx-auto my-auto py-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl shadow-emerald-950/30 space-y-6 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center space-y-2 relative z-10">
            {splashAssetSrc && !splashImgError ? (
              <div className="w-20 h-20 rounded-3xl bg-slate-950/80 border-2 border-emerald-500/40 flex items-center justify-center mx-auto shadow-inner overflow-hidden p-2">
                <img
                  src={splashAssetSrc}
                  alt="طلبات البيت"
                  onError={() => setSplashImgError(true)}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : headerAssetSrc && !headerImgError ? (
              <div className="w-16 h-16 rounded-3xl bg-slate-950/80 border-2 border-emerald-500/40 flex items-center justify-center mx-auto shadow-inner overflow-hidden p-2">
                <img
                  src={headerAssetSrc}
                  alt="طلبات البيت"
                  onError={() => setHeaderImgError(true)}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-600/30 via-emerald-500/20 to-teal-500/10 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
            )}
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">تسجيل دخول المشرفين</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              بوابة الدخول الموحدة لإدارة المستخدمين، المنازل، الأقسام، والمنتجات.
            </p>
          </div>

          {/* Error Message */}
          {currentError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-start space-x-2.5 space-x-reverse animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{currentError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">البريد الإلكتروني للمشرف</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="admin@talabatalbayt.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-3 pr-10 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-right"
                  autoFocus
                />
                <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-right font-mono"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || isAdminLoading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2 space-x-reverse cursor-pointer disabled:opacity-50"
            >
              {submitting || isAdminLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>دخول لوحة التحكم</span>
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center space-x-1.5 space-x-reverse text-emerald-400 font-bold">
              <Database className="w-3.5 h-3.5" />
              <span>أمان وحماية Supabase Auth & RLS:</span>
            </div>
            <p className="leading-relaxed">
              يتم التحقق من هوية المشرف مباشرة عبر خادم Supabase وقاعدة البيانات. الصلاحيات محددة حسب الدور المعين
              (Super Admin / Admin / Support).
            </p>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-md mx-auto w-full text-center text-xs text-slate-500 py-2">
        <p>© 2026 طلبات البيت — جميع الحقوق محفوظة لنظام الإدارة المركزي</p>
      </div>
    </div>
  );
};
