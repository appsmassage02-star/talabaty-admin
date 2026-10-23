import React, { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { exportToCSV } from '../utils/exportUtils';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  Users,
  Wallet,
  Building,
  ClipboardList,
  Layers,
  ArrowUpRight,
  Sparkles,
  Package,
  RefreshCw,
} from 'lucide-react';

export const AdminAnalytics: React.FC = () => {
  const { stats } = useAdmin();
  const [isLoading, setIsLoading] = useState(true);
  const [topCategories, setTopCategories] = useState<{ name: string; count: number; amount: number; pct: number; color: string }[]>([]);
  const [topItems, setTopItems] = useState<{ name: string; category: string; requests: number; status: 'high' | 'medium' | 'low' }[]>([]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAnalyticsData();
      setTopCategories(data.topCategories);
      setTopItems(data.topItems);
    } catch (e) {
      console.warn('Analytics loading error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleExportReport = () => {
    if (topCategories.length > 0) {
      exportToCSV('analytics_consumption_report', topCategories);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">التحليلات ومؤشرات الاستهلاك</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تحليل شامل لنمط استهلاك الأسر، أكثر النواقص طلباً، وتوزيع المشتريات على الأقسام.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            type="button"
            onClick={loadAnalytics}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors shrink-0 cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleExportReport}
            disabled={topCategories.length === 0}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تصدير التقرير التحليلي</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">إجمالي إنفاق المشتريات</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {(stats?.total_purchases_sum ?? 0).toLocaleString('ar-SA')} ج.م
          </div>
          <span className="text-[11px] text-slate-500 block">
            عبر {stats?.total_invoices ?? 0} فاتورة مسجلة
          </span>
        </div>

        <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">معدل النواقص لكل منزل</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {stats && stats.total_households > 0
              ? ((stats.total_missing_items || 0) / stats.total_households).toFixed(1)
              : '0'}{' '}
            <span className="text-xs">صنف/منزل</span>
          </div>
          <span className="text-[11px] text-slate-500 block">
            إجمالي {stats?.total_missing_items ?? 0} صنف مسجل
          </span>
        </div>

        <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">متوسط الأعضاء لكل أسرة</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-400 font-mono">
            {stats && stats.total_households > 0
              ? ((stats.total_users || 0) / stats.total_households).toFixed(1)
              : '0'}{' '}
            <span className="text-xs">أفراد</span>
          </div>
          <span className="text-[11px] text-slate-500 block">
            من إجمالي {stats?.total_users ?? 0} مستخدم
          </span>
        </div>
      </div>

      {/* Grid: Category Breakdown & Top Missing Items */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown (6 Cols) */}
        <div className="lg:col-span-6 bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2 space-x-reverse">
              <PieChart className="w-4 h-4 text-emerald-400" />
              <span>توزيع المشتريات حسب الأقسام</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">نسبة الإنفاق</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs">جاري تحميل توزيع الأقسام...</div>
          ) : topCategories.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">لا توجد بيانات كافية للأقسام حالياً</div>
          ) : (
            <div className="space-y-4">
              {topCategories.map((cat, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <span className="font-bold text-slate-200">{cat.name}</span>
                      <span className="text-[10px] text-slate-500">({cat.count} عملية)</span>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse font-mono">
                      <span className="font-bold text-white">{cat.amount.toLocaleString('ar-SA')} ج.م</span>
                      <span className="text-slate-400 font-semibold">({cat.pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${Math.max(5, cat.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Missing Items (6 Cols) */}
        <div className="lg:col-span-6 bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2 space-x-reverse">
              <ClipboardList className="w-4 h-4 text-amber-400" />
              <span>الأصناف الأكثر تسجيلاً في النواقص</span>
            </h3>
            <span className="text-xs text-slate-400">مرات الإضافة</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs">جاري تحميل أكثر النواقص طلباً...</div>
          ) : topItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">لا توجد نواقص مسجلة في قاعدة البيانات حالياً</div>
          ) : (
            <div className="space-y-2.5">
              {topItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-bold font-mono flex items-center justify-center text-[11px]">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-white block">{item.name}</span>
                      <span className="text-[10px] text-slate-500">{item.category}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="font-mono font-bold text-amber-300">{item.requests} مرة</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.status === 'high'
                          ? 'bg-rose-500'
                          : item.status === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
