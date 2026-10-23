import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { AdminHousehold } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import {
  Building,
  Search,
  Users,
  ClipboardList,
  Receipt,
  Wallet,
  Calendar,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  X,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export const AdminHouseholds: React.FC = () => {
  const { hasPermission, showToast } = useAdmin();

  const [households, setHouseholds] = useState<AdminHousehold[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Selected Household for Inspection Modal
  const [selectedHousehold, setSelectedHousehold] = useState<AdminHousehold | null>(null);
  const [householdDetails, setHouseholdDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Delete Household Modal
  const [householdToDelete, setHouseholdToDelete] = useState<AdminHousehold | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadHouseholds = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getHouseholds({
        search: searchQuery,
        page,
        pageSize,
      });
      setHouseholds(res.households);
      setTotalCount(res.total);
    } catch (e) {
      console.warn('Failed to load households:', e);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, page]);

  useEffect(() => {
    loadHouseholds();
  }, [loadHouseholds]);

  // Open inspection details modal
  const handleOpenDetails = async (hh: AdminHousehold) => {
    setSelectedHousehold(hh);
    setIsLoadingDetails(true);
    try {
      const details = await adminService.getHouseholdDetails(hh.id);
      setHouseholdDetails(details);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Confirm Household Deletion
  const handleConfirmDelete = async () => {
    if (!householdToDelete || deleteConfirmation !== 'DELETE') return;
    setIsDeleting(true);
    try {
      const res = await adminService.deleteHousehold(householdToDelete.id, deleteConfirmation);
      if (res.success) {
        showToast(`تم حذف منزل "${householdToDelete.name}" وكافة بياناته المرتبطة`, 'info');
        setHouseholdToDelete(null);
        setDeleteConfirmation('');
        loadHouseholds();
      } else {
        showToast(res.error || 'فشل حذف المنزل', 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    exportToCSV('households_export', households);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-lg font-bold text-white">إدارة المنازل والأسر</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                {totalCount} منزل مسجل
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              مراقبة منازل الأسر، الأعضاء المرتبطين، رمز الاقتران، ومعدل الاستهلاك.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            type="button"
            onClick={handleExport}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تصدير CSV</span>
          </button>
          <button
            type="button"
            onClick={loadHouseholds}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="إعادة تحميل"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم المنزل، رمز الاقتران (Pair Code)، أو معرف المنزل..."
            className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-3 text-xs text-slate-500 hover:text-slate-300"
            >
              مسح
            </button>
          )}
        </div>
      </div>

      {/* Table / Grid */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-bold">جاري استرجاع بيانات المنازل من السيرفر...</p>
          </div>
        ) : households.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Building className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">لم يتم العثور على أي منازل مسجلة</h3>
            <p className="text-xs text-slate-500">جرب البحث بكلمات أخرى أو تحقق من التسجيلات الجديدة.</p>
          </div>
        ) : (
          <div>
            {/* Mobile Responsive Cards (< md) */}
            <div className="md:hidden divide-y divide-slate-800/70">
              {households.map((hh) => (
                <div key={hh.id} className="p-4 space-y-3.5 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 space-x-reverse min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold border border-amber-500/20 shrink-0">
                        <Building className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-white text-sm block truncate">{hh.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono truncate block max-w-[180px]">
                          {hh.id}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-950 text-amber-300 font-mono font-bold text-xs rounded-xl border border-amber-500/20 inline-flex items-center space-x-1 space-x-reverse shrink-0">
                      <Key className="w-3 h-3 text-amber-400" />
                      <span>{hh.pair_code}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-center">
                    <div>
                      <span className="text-slate-500 block text-[10px]">الأعضاء</span>
                      <span className="font-mono text-blue-400 font-bold">{hh.members_count ?? 1}</span>
                    </div>
                    <div className="border-x border-slate-800/70">
                      <span className="text-slate-500 block text-[10px]">النواقص الحالية</span>
                      <span className="font-mono text-rose-300 font-bold">{hh.items_count ?? 0} صنف</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">المشتريات</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {(hh.total_purchases ?? 0).toLocaleString('ar-SA')} ج.م
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] text-slate-400 font-mono">
                      أُنشئ: {new Date(hh.created_at).toLocaleDateString('ar-EG')}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(hh)}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer border border-slate-700"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>فحص وتفاصيل</span>
                      </button>

                      {hasPermission('households.delete') && (
                        <button
                          type="button"
                          onClick={() => setHouseholdToDelete(hh)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
                          title="حذف المنزل بالكامل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
                  <tr>
                    <th className="p-4">اسم المنزل</th>
                    <th className="p-4">رمز الاقتران</th>
                    <th className="p-4">الأعضاء</th>
                    <th className="p-4">النواقص الحالية</th>
                    <th className="p-4">المشتريات الإجمالية</th>
                    <th className="p-4">تاريخ الإنشاء</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {households.map((hh) => (
                    <tr key={hh.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold border border-amber-500/20 shrink-0">
                            <Building className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white block">{hh.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono truncate block max-w-[120px]">
                              {hh.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-950 text-amber-300 font-mono font-bold rounded-lg border border-amber-500/20 inline-flex items-center space-x-1.5 space-x-reverse">
                          <Key className="w-3 h-3 text-amber-400" />
                          <span>{hh.pair_code}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1 space-x-reverse text-slate-300 font-bold font-mono">
                          <Users className="w-3.5 h-3.5 text-blue-400" />
                          <span>{hh.members_count ?? 1}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-rose-300 font-bold">
                          {hh.items_count ?? 0} صنف
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-emerald-400 font-bold">
                          {(hh.total_purchases ?? 0).toLocaleString('ar-SA')} ج.م
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-400">
                        {new Date(hh.created_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center space-x-1.5 space-x-reverse">
                          {/* Open Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(hh)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="فحص تفاصيل المنزل"
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                          </button>

                          {/* Delete Household */}
                          {hasPermission('households.delete') && (
                            <button
                              type="button"
                              onClick={() => setHouseholdToDelete(hh)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="حذف المنزل بالكامل"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 1. HOUSEHOLD INSPECTION MODAL (Bottom Sheet on Mobile)             */}
      {/* =================================================================== */}
      {selectedHousehold && (
        <div
          onClick={() => setSelectedHousehold(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full border-t sm:border border-slate-800 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 text-right text-white"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-900/95">
              <div className="flex items-center space-x-3 space-x-reverse min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white shrink-0">
                  <Building className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">{selectedHousehold.name}</h3>
                  <span className="text-xs text-amber-400 font-mono block">
                    رمز الاقتران: {selectedHousehold.pair_code}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHousehold(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4">
              {isLoadingDetails ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
                  <span className="text-xs text-slate-400 mt-2 block">جاري تحميل تفاصيل ومحتويات المنزل...</span>
                </div>
              ) : (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-[10px] text-slate-500 block mb-1">الأعضاء المرتبطون</span>
                      <span className="font-bold text-blue-400 font-mono">
                        {householdDetails?.members?.length ?? selectedHousehold.members_count ?? 1}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-[10px] text-slate-500 block mb-1">النواقص الحالية</span>
                      <span className="font-bold text-rose-400 font-mono">
                        {householdDetails?.items?.length ?? selectedHousehold.items_count ?? 0}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-[10px] text-slate-500 block mb-1">الفواتير المسجلة</span>
                      <span className="font-bold text-purple-400 font-mono">
                        {householdDetails?.invoices?.length ?? 0}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <span className="text-[10px] text-slate-500 block mb-1">إجمالي المشتريات</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {(selectedHousehold.total_purchases ?? 0).toLocaleString('ar-SA')} ج.م
                      </span>
                    </div>
                  </div>

                  {/* Members list */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">أعضاء المنزل:</span>
                    {householdDetails?.members?.length > 0 ? (
                      <div className="space-y-2">
                        {householdDetails.members.map((m: any) => (
                          <div
                            key={m.id}
                            className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2.5 space-x-reverse">
                              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-300">
                                {m.user?.full_name?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <span className="font-bold text-white block">{m.user?.full_name || 'بدون اسم'}</span>
                                <span className="text-[10px] font-mono text-slate-400">{m.user?.email}</span>
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                              {m.role === 'admin' ? 'مشرف رئيسي' : 'هاتف المنزل'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-950 rounded-xl text-center text-xs text-slate-500">
                        لا يوجد أعضاء مرتبطين حالياً
                      </div>
                    )}
                  </div>

                  {/* Recent Items Preview */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">النواقص الحالية بالمنزل:</span>
                    {householdDetails?.items?.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-950 rounded-xl border border-slate-800">
                        {householdDetails.items.map((it: any) => (
                          <div
                            key={it.id}
                            className="p-2 bg-slate-900 rounded-lg flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-slate-200">{it.name}</span>
                            <span className="font-mono text-[11px] text-amber-400">
                              {it.quantity} {it.unit || ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-950 rounded-xl text-center text-xs text-slate-500">
                        قائمة النواقص فارغة
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2 shrink-0">
              {hasPermission('households.delete') && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedHousehold;
                    setSelectedHousehold(null);
                    setHouseholdToDelete(target);
                  }}
                  className="py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف المنزل</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedHousehold(null)}
                className="mr-auto py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. DANGEROUS HOUSEHOLD DELETION MODAL (Bottom Sheet on Mobile)     */}
      {/* =================================================================== */}
      {householdToDelete && (
        <div
          onClick={() => {
            if (!isDeleting) setHouseholdToDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-rose-500/30 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden text-right text-white animate-in slide-in-from-bottom-4 sm:zoom-in-95"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-rose-400">حذف المنزل بالكامل (منطقة الخطر)</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  أنت على وشك حذف منزل <strong className="text-white">"{householdToDelete.name}"</strong> وكافة النواقص،
                  الفواتير، والروابط الخاصة به.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  اكتب <code className="bg-slate-950 px-1.5 py-0.5 rounded text-rose-400 font-mono font-bold">DELETE</code>{' '}
                  لتأكيد الحذف:
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-rose-500/40 rounded-xl text-xs font-bold text-rose-300 focus:outline-none focus:border-rose-500 text-center font-mono tracking-widest"
                />
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center space-x-2 space-x-reverse shrink-0">
              <button
                type="button"
                onClick={() => setHouseholdToDelete(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer"
              >
                {isDeleting ? 'جاري الحذف...' : 'حذف المنزل نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
