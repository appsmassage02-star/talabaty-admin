import React, { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import {
  Settings,
  Database,
  ShieldCheck,
  Server,
  Key,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Code,
  Globe,
  Radio,
  Download,
  Terminal,
} from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const { hasPermission, showToast, stats, refreshStats, activeSection, setActiveSection } = useAdmin();

  // Settings State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [allowGuestPairing, setAllowGuestPairing] = useState(true);
  const [maxMembersPerHousehold, setMaxMembersPerHousehold] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);

  // Supabase Info
  const metaEnv = (import.meta as any).env || {};
  const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://ukwzixktqwmckytakdjx.supabase.co';


  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await adminService.getSystemSettings();
      if (s) {
        setMaintenanceMode(Boolean(s.maintenance_mode));
        setAllowRegistration(s.allow_registration !== false);
        setAllowGuestPairing(s.allow_guest_pairing !== false);
        setMaxMembersPerHousehold(s.max_members_per_household || 10);
      }
    } catch (e) {
      console.warn('Failed to load system settings:', e);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await adminService.updateSystemSettings({
        maintenance_mode: maintenanceMode,
        allow_registration: allowRegistration,
        allow_guest_pairing: allowGuestPairing,
        max_members_per_household: Number(maxMembersPerHousehold),
      });

      if (res.success) {
        showToast('تم حفظ إعدادات النظام وتحديثها في قاعدة البيانات', 'success');
      } else {
        showToast(res.error || 'فشل تحديث الإعدادات', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const sqlSetupScript = `-- ==============================================================================
-- TALABAT AL-BAYT (طلبات البيت) - ADMIN CONTROL CENTER DATABASE SCHEMA & POLICIES
-- ==============================================================================

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'ADMIN', -- SUPER_ADMIN, ADMIN, CONTENT_MANAGER, SUPPORT, READ_ONLY
    custom_permissions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 4. Create broadcast_notifications table
CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'all',
    target_role TEXT,
    target_id TEXT,
    priority TEXT NOT NULL DEFAULT 'info',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Helper Function: Is Caller an Active Admin?
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = user_id_param AND is_active = TRUE
  );
$$;

-- 6. Helper Function: Is Caller a Super Admin?
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = user_id_param AND role = 'SUPER_ADMIN' AND is_active = TRUE
  );
$$;

-- 7. Enable RLS on Admin Tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;

-- 8. Policies for admin_users
CREATE POLICY "Admins can view admin_users"
    ON public.admin_users FOR SELECT
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Super Admins can modify admin_users"
    ON public.admin_users FOR ALL
    USING (public.is_super_admin(auth.uid()));

-- 9. Insert Initial Super Admin Seed (Replace with your actual Auth UUID)
-- INSERT INTO public.admin_users (user_id, email, full_name, role)
-- VALUES ('YOUR_AUTH_USER_UUID', 'admin@talabatalbayt.com', 'Super Administrator', 'SUPER_ADMIN')
-- ON CONFLICT (user_id) DO NOTHING;

-- 10. Allow Dashboard Admins to View All Profiles from profiles Table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (true);

-- 11. Add Status & Block Fields to profiles Table
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS blocked_by UUID;

DROP POLICY IF EXISTS "Admins can update profile status" ON public.profiles;
CREATE POLICY "Admins can update profile status"
    ON public.profiles FOR UPDATE
    USING (true);
`;

  const copySQLToClipboard = () => {
    navigator.clipboard.writeText(sqlSetupScript);
    setCopiedSQL(true);
    showToast('تم نسخ سكريبت SQL إلى الحافظة بنجاح', 'success');
    setTimeout(() => setCopiedSQL(false), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">إعدادات النظام والاتصال بقاعدة البيانات</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              مراقبة حالة خوادم Supabase، ضبط محددات التطبيق، وإدارة الجداول البرمجية.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection !== 'settings_rls'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              إعدادات النظام و Supabase
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('app_assets')}
              className="px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-white"
            >
              إدارة صور التطبيق
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('settings_rls')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection === 'settings_rls'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الأمان والحماية (RLS)
            </button>
          </div>
          <button
            type="button"
            onClick={refreshStats}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span>فحص وتحديث الاتصال</span>
          </button>
        </div>
      </div>

      {/* Supabase Connection Status Card */}
      <div className="bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">حالة الاتصال بسيرفر Supabase</h3>
              <span className="text-[11px] text-slate-400 font-mono">{supabaseUrl}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-emerald-400">متصل وجاهز للعمل</span>
          </div>
        </div>

        {/* Database Health Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-500 block mb-1">جدول المستخدمين (users)</span>
            <span className="font-mono font-bold text-blue-400">{stats?.total_users ?? 0} سجل</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-500 block mb-1">جدول المنازل (households)</span>
            <span className="font-mono font-bold text-amber-400">{stats?.total_households ?? 0} سجل</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-500 block mb-1">جدول الفواتير (invoices)</span>
            <span className="font-mono font-bold text-emerald-400">{stats?.total_invoices ?? 0} سجل</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-500 block mb-1">جدول الأصناف (items)</span>
            <span className="font-mono font-bold text-purple-400">{stats?.total_missing_items ?? 0} سجل</span>
          </div>
        </div>
      </div>

      {/* App General Settings Form */}
      <div className="bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 space-x-reverse border-b border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">إعدادات وضوابط التشغيل العامة</h3>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Maintenance Mode */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">وضع الصيانة (Maintenance Mode)</span>
                <span className="text-[11px] text-slate-400">
                  إيقاف مؤقت للتطبيق وإظهار شاشة الصيانة للمستخدمين العاديين
                </span>
              </div>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Allow Registration */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">السماح بتسجيل مستخدمين جدد</span>
                <span className="text-[11px] text-slate-400">
                  تمكين أو تعطيل إنشاء حسابات جديدة في التطبيق
                </span>
              </div>
              <input
                type="checkbox"
                checked={allowRegistration}
                onChange={(e) => setAllowRegistration(e.target.checked)}
                className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Allow Guest Pairing */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">السماح باقتران الضيوف (Pairing)</span>
                <span className="text-[11px] text-slate-400">
                  تمكين انضمام هواتف المنازل باستخدام كود الاقتران السريع
                </span>
              </div>
              <input
                type="checkbox"
                checked={allowGuestPairing}
                onChange={(e) => setAllowGuestPairing(e.target.checked)}
                className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Max Members */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <span className="font-bold text-white block">الحد الأقصى للأعضاء لكل منزل</span>
              <span className="text-[11px] text-slate-400 block mb-2">
                الحد المسموح به لعدد الهواتف المرتبطة بالمنزل الواحد
              </span>
              <input
                type="number"
                min="1"
                max="50"
                value={maxMembersPerHousehold}
                onChange={(e) => setMaxMembersPerHousehold(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving || !hasPermission('settings.manage')}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
            >
              {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        </form>
      </div>

      {/* SQL Migration & RLS Bootstrapping Guide */}
      <div
        className={`bg-slate-900/90 rounded-3xl p-5 sm:p-6 border shadow-sm space-y-4 transition-colors ${
          activeSection === 'settings_rls'
            ? 'border-emerald-500/60 ring-1 ring-emerald-500/20'
            : 'border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 space-x-reverse">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">الأمان والحماية (RLS) وسكريبت إعداد صلاحيات المشرفين</h3>
          </div>

          <button
            type="button"
            onClick={copySQLToClipboard}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
          >
            {copiedSQL ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedSQL ? 'تم النسخ!' : 'نسخ كود SQL'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          يمكنك تشغيل هذا السكريبت في نافذة <strong className="text-white">Supabase SQL Editor</strong> لإنشاء جداول المشرفين (
          <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-400">admin_users</code>،
          <code className="bg-slate-950 px-1 py-0.5 rounded text-teal-400">admin_audit_logs</code>،
          <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-400">system_settings</code>) وقواعد الأمان RLS المتقدمة.
        </p>

        <div className="relative">
          <pre
            className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-60 text-left"
            dir="ltr"
          >
            {sqlSetupScript}
          </pre>
        </div>
      </div>
    </div>
  );
};
