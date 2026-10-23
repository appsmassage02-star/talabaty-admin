import React from 'react';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { AdminLogin } from './components/AdminLogin';
import { AdminLayout } from './components/AdminLayout';
import { AdminOverview } from './components/AdminOverview';
import { AdminDeliveryDrivers } from './components/AdminDeliveryDrivers';
import { AdminDeliveryOrders } from './components/AdminDeliveryOrders';
import { AdminDeliveryCustomers } from './components/AdminDeliveryCustomers';
import { AdminDeliverySettings } from './components/AdminDeliverySettings';
import { AdminUsers } from './components/AdminUsers';
import { AdminHouseholds } from './components/AdminHouseholds';
import { AdminCategories } from './components/AdminCategories';
import { AdminProducts } from './components/AdminProducts';
import { AdminNotifications } from './components/AdminNotifications';
import { AdminAnalytics } from './components/AdminAnalytics';
import { AdminAuditLogs } from './components/AdminAuditLogs';
import { AdminTeamManagement } from './components/AdminTeamManagement';
import { AdminSettings } from './components/AdminSettings';
import { AdminAppAssets } from './components/AdminAppAssets';
import { AdminInvoicesPurchasing } from './components/AdminInvoicesPurchasing';
import { AdminPharmacyManagement } from './components/AdminPharmacyManagement';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, RefreshCw, ShieldCheck } from 'lucide-react';

const SPLASH_STAGES = [
  { id: 0, label: 'المصادقة', detail: 'جاري بدء المصادقة والتحقق الأولي...' },
  { id: 1, label: 'فحص الجلسة', detail: 'جاري فحص الجلسة وصلاحيات المشرف...' },
  { id: 2, label: 'المصادقة', detail: 'جاري تأكيد المصادقة وتجهيز البيانات...' },
  { id: 3, label: 'الانتقال للصفحة الرئيسية', detail: 'جاري الانتقال للصفحة الرئيسية...' },
] as const;

const SPLASH_DURATION_MS = 3000;

const AdminContent: React.FC = () => {
  const { adminUser, isAdminLoading, activeSection, toastMessage, splashAssetSrc } = useAdmin();
  const [splashLoadFailed, setSplashLoadFailed] = React.useState(false);
  const [splashProgress, setSplashProgress] = React.useState(0);
  const [isSplashMinDelayDone, setIsSplashMinDelayDone] = React.useState(false);

  // Run a 3-second interactive splash progress sequence whenever loading starts
  React.useEffect(() => {
    setSplashProgress(0);
    setIsSplashMinDelayDone(false);

    const startTime = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / SPLASH_DURATION_MS, 1);
      setSplashProgress(Math.round(ratio * 100));

      if (elapsed >= SPLASH_DURATION_MS) {
        window.clearInterval(interval);
        setSplashProgress(100);
        setIsSplashMinDelayDone(true);
      }
    }, 30);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  // Re-trigger the 3-second splash sequence when signing in triggers isAdminLoading
  const prevLoadingRef = React.useRef(isAdminLoading);
  React.useEffect(() => {
    if (!prevLoadingRef.current && isAdminLoading) {
      setSplashProgress(0);
      setIsSplashMinDelayDone(false);

      const startTime = Date.now();
      const interval = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const ratio = Math.min(elapsed / SPLASH_DURATION_MS, 1);
        setSplashProgress(Math.round(ratio * 100));

        if (elapsed >= SPLASH_DURATION_MS) {
          window.clearInterval(interval);
          setSplashProgress(100);
          setIsSplashMinDelayDone(true);
        }
      }, 30);

      prevLoadingRef.current = isAdminLoading;
      return () => {
        window.clearInterval(interval);
      };
    }
    prevLoadingRef.current = isAdminLoading;
  }, [isAdminLoading]);

  const currentStageIndex = React.useMemo(() => {
    if (splashProgress < 30) return 0; // المصادقة
    if (splashProgress < 65) return 1; // فحص الجلسة
    if (splashProgress < 90) return 2; // المصادقة
    return 3; // الانتقال للصفحة الرئيسية
  }, [splashProgress]);

  if (isAdminLoading || !isSplashMinDelayDone) {
    const activeStage = SPLASH_STAGES[currentStageIndex];

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6 text-white p-6" dir="rtl">
        {splashAssetSrc && !splashLoadFailed ? (
          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-slate-900/80 border border-emerald-500/25 flex items-center justify-center p-3 shadow-2xl shadow-emerald-950/40 overflow-hidden transition-transform duration-500">
            <img
              src={splashAssetSrc}
              alt="طلبات البيت — لوحة التحكم الإدارية"
              onError={() => setSplashLoadFailed(true)}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shadow-2xl shadow-emerald-950/40">
            <ShieldCheck className="w-10 h-10 text-emerald-400 animate-pulse" />
          </div>
        )}

        <div className="text-center space-y-1.5">
          <h2 className="text-base sm:text-lg font-bold text-slate-100">
            لوحة التحكم الإدارية — طلبات البيت
          </h2>
          <p className="text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1.5 min-h-[20px]">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
            <span>{activeStage.detail}</span>
          </p>
        </div>

        {/* Interactive Progress Bar & Stepper */}
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 shadow-xl space-y-3.5">
          {/* Top Status & Percentage */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{activeStage.label}</span>
            </span>
            <span className="font-mono font-bold text-emerald-400">{splashProgress}%</span>
          </div>

          {/* Animated Progress Track */}
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
            <div
              className="h-full bg-gradient-to-l from-emerald-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-75 ease-out shadow-sm shadow-emerald-500/50"
              style={{ width: `${splashProgress}%` }}
            />
          </div>

          {/* Interactive Stages Indicators */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {SPLASH_STAGES.map((stage, idx) => {
              const isCompleted = idx < currentStageIndex || splashProgress === 100;
              const isCurrent = idx === currentStageIndex && splashProgress < 100;
              return (
                <div
                  key={stage.id}
                  className={`flex flex-col items-center text-center p-1.5 rounded-xl border transition-all duration-200 ${
                    isCurrent
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                      : isCompleted
                      ? 'bg-slate-800/70 border-emerald-500/20 text-slate-300'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-center mb-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : isCurrent ? (
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-700 text-[9px] flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold leading-tight line-clamp-2">
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated as Admin -> Show Login Screen
  if (!adminUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative" dir="rtl">
        <AdminLogin />

        {/* Floating Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-200">
            <div
              className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center space-x-2.5 space-x-reverse text-xs font-bold text-white ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
                  : toastMessage.type === 'error'
                  ? 'bg-rose-950/90 border-rose-500/30 text-rose-300'
                  : 'bg-slate-900/90 border-slate-700 text-slate-200'
              }`}
            >
              {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
              {toastMessage.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Section Component
  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <AdminOverview />;
      case 'delivery_drivers':
        return <AdminDeliveryDrivers />;
      case 'delivery_orders':
        return <AdminDeliveryOrders />;
      case 'delivery_customers':
        return <AdminDeliveryCustomers />;
      case 'delivery_settings':
        return <AdminDeliverySettings />;
      case 'pharmacy_orders':
      case 'pharmacy_prescriptions':
      case 'pharmacy_pharmacies':
      case 'pharmacy_settings':
        return <AdminPharmacyManagement />;
      case 'users':
        return <AdminUsers />;
      case 'households':
        return <AdminHouseholds />;
      case 'team':
        return <AdminTeamManagement />;
      case 'categories':
        return <AdminCategories />;
      case 'products':
        return <AdminProducts />;
      case 'invoices_overview':
      case 'invoices_purchases':
      case 'invoices_missing_items':
      case 'invoices_archive':
        return <AdminInvoicesPurchasing />;
      case 'analytics':
        return <AdminAnalytics />;
      case 'audit_logs':
      case 'audit':
        return <AdminAuditLogs />;
      case 'notifications':
      case 'notifications_broadcast':
        return <AdminNotifications />;
      case 'app_assets':
        return <AdminAppAssets />;
      case 'settings':
      case 'settings_rls':
        return <AdminSettings />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <AdminLayout>
      {renderSection()}

      {/* Global Floating Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center space-x-2.5 space-x-reverse text-xs font-bold text-white backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-300'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {toastMessage.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export const AdminApp: React.FC = () => {
  return (
    <AdminProvider>
      <AdminContent />
    </AdminProvider>
  );
};

export default AdminApp;
