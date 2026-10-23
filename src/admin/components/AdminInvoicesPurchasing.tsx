import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { AdminInvoiceRecord, AdminMissingItemRecord } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import {
  Receipt,
  Wallet,
  ClipboardList,
  Archive,
  Search,
  RefreshCw,
  Download,
  Eye,
  X,
  Building,
  Calendar,
  Package,
  CheckCircle2,
  Clock,
  FolderArchive,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';

type InvoicesSubTab =
  | 'invoices_overview'
  | 'invoices_purchases'
  | 'invoices_missing_items'
  | 'invoices_archive';

export const AdminInvoicesPurchasing: React.FC = () => {
  const { activeSection, setActiveSection, showToast, refreshStats } = useAdmin();

  const currentTab: InvoicesSubTab = useMemo(() => {
    if (
      activeSection === 'invoices_overview' ||
      activeSection === 'invoices_purchases' ||
      activeSection === 'invoices_missing_items' ||
      activeSection === 'invoices_archive'
    ) {
      return activeSection;
    }
    return 'invoices_overview';
  }, [activeSection]);

  const [invoices, setInvoices] = useState<AdminInvoiceRecord[]>([]);
  const [missingItems, setMissingItems] = useState<AdminMissingItemRecord[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingArchive, setIsUpdatingArchive] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [missingStatusFilter, setMissingStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<AdminInvoiceRecord | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getInvoicesAndPurchasingData();
      setInvoices(res.invoices);
      setMissingItems(res.missingItems);
      setArchivedIds(res.archivedIds);
    } catch (e) {
      console.warn('Error loading invoices & purchasing:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived categories
  const availableCategories = useMemo(() => {
    const s = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.category) s.add(inv.category);
    });
    missingItems.forEach((it) => {
      if (it.category) s.add(it.category);
    });
    return Array.from(s);
  }, [invoices, missingItems]);

  // Active vs Archived Invoices
  const activeInvoices = useMemo(
    () => invoices.filter((inv) => !archivedIds.includes(inv.id)),
    [invoices, archivedIds]
  );

  const archivedInvoices = useMemo(
    () => invoices.filter((inv) => archivedIds.includes(inv.id)),
    [invoices, archivedIds]
  );

  // Filtered Invoices for Overview
  const filteredInvoices = useMemo(() => {
    const source = currentTab === 'invoices_archive' ? archivedInvoices : activeInvoices;
    return source.filter((inv) => {
      const matchesCategory = categoryFilter === 'all' || inv.category === categoryFilter;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchHousehold = (inv.household_name || '').toLowerCase().includes(q);
      const matchStore = (inv.store_name || '').toLowerCase().includes(q);
      const matchCat = (inv.category || '').toLowerCase().includes(q);
      const matchNum = String(inv.invoice_number || inv.id).toLowerCase().includes(q);
      return matchHousehold || matchStore || matchCat || matchNum;
    });
  }, [currentTab, archivedInvoices, activeInvoices, categoryFilter, searchQuery]);

  // Filtered Missing Items
  const filteredMissingItems = useMemo(() => {
    return missingItems.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (missingStatusFilter === 'pending' && item.completed) return false;
      if (missingStatusFilter === 'completed' && !item.completed) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.household_name || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    });
  }, [missingItems, categoryFilter, missingStatusFilter, searchQuery]);

  // Summary Metrics
  const totalInvoicesCount = invoices.length;
  const totalPurchasesSum = useMemo(
    () => invoices.reduce((acc, cur) => acc + (Number(cur.total_price) || 0), 0),
    [invoices]
  );
  const avgInvoiceValue = totalInvoicesCount > 0 ? Math.round(totalPurchasesSum / totalInvoicesCount) : 0;
  const pendingMissingCount = useMemo(
    () => missingItems.filter((m) => !m.completed).length,
    [missingItems]
  );

  // Category Purchasing Breakdown
  const purchasesByCategory = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    invoices.forEach((inv) => {
      const cat = inv.category || 'مشتريات عامة';
      const cur = map.get(cat) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(inv.total_price) || 0;
      map.set(cat, cur);
    });
    return Array.from(map.entries())
      .map(([name, val]) => ({
        name,
        count: val.count,
        total: val.total,
        pct: totalPurchasesSum > 0 ? Math.round((val.total / totalPurchasesSum) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [invoices, totalPurchasesSum]);

  // Household Purchasing Breakdown
  const purchasesByHousehold = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>();
    invoices.forEach((inv) => {
      const key = inv.household_id || inv.household_name || 'عام';
      const cur = map.get(key) || { name: inv.household_name || 'أسرة مسجلة', count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(inv.total_price) || 0;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [invoices]);

  // Archive / Unarchive handler
  const handleToggleArchive = async (ids: string[], archive: boolean) => {
    if (ids.length === 0) return;
    setIsUpdatingArchive(true);
    try {
      const res = await adminService.setInvoiceArchivedState(ids, archive);
      if (res.success) {
        setArchivedIds(res.archivedIds);
        showToast(
          archive
            ? `تمت أرشفة ${ids.length} فاتورة مشتريات بنجاح`
            : `تمت استعادة ${ids.length} فاتورة من الأرشيف`,
          'success'
        );
        refreshStats();
      } else {
        showToast(res.error || 'تعذر تحديث الأرشيف', 'error');
      }
    } finally {
      setIsUpdatingArchive(false);
    }
  };

  const handleExportCurrentView = () => {
    if (currentTab === 'invoices_missing_items') {
      exportToCSV('missing_items_inventory', filteredMissingItems);
    } else if (currentTab === 'invoices_archive') {
      exportToCSV('archived_purchase_invoices', archivedInvoices);
    } else {
      exportToCSV('purchase_invoices_report', filteredInvoices);
    }
    showToast('تم تصدير البيانات بصيغة CSV بنجاح', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-right" dir="rtl">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white">
              إدارة الفواتير والمشتريات والنواقص
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              متابعة إجمالي الفواتير والمداخيل، تحليل المشتريات، إدارة النواقص المسجلة، وأرشفة فواتير المشتريات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث السجلات</span>
          </button>
          <button
            type="button"
            onClick={handleExportCurrentView}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      {/* Top Summary Cards across the 4 pillars of Invoices & Purchasing Management */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setActiveSection('invoices_overview')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            currentTab === 'invoices_overview'
              ? 'bg-indigo-950/40 border-indigo-500/60'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">إجمالي الفواتير والمداخيل</span>
            <Receipt className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono tabular-nums">
              {totalInvoicesCount}
            </span>
            <span className="text-xs text-indigo-400 font-semibold">فاتورة مسجلة</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            متوسط الفاتورة: <span className="font-mono text-slate-200">{avgInvoiceValue.toLocaleString('ar-EG')} ج.م</span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('invoices_purchases')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            currentTab === 'invoices_purchases'
              ? 'bg-emerald-950/40 border-emerald-500/60'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">إجمالي المشتريات</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
              {totalPurchasesSum.toLocaleString('ar-EG')}
            </span>
            <span className="text-xs text-emerald-300 font-semibold">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            موزعة على {purchasesByCategory.length} تصنيفات شرائية
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('invoices_missing_items')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            currentTab === 'invoices_missing_items'
              ? 'bg-amber-950/40 border-amber-500/60'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">النواقص والأصناف المسجلة</span>
            <ClipboardList className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-300 font-mono tabular-nums">
              {missingItems.length}
            </span>
            <span className="text-xs text-amber-400 font-semibold">صنف مسجل</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            منها <span className="font-mono text-amber-300">{pendingMissingCount}</span> قيد الطلب حالياً
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('invoices_archive')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            currentTab === 'invoices_archive'
              ? 'bg-purple-950/40 border-purple-500/60'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">أرشفة فواتير المشتريات</span>
            <Archive className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-300 font-mono tabular-nums">
              {archivedInvoices.length}
            </span>
            <span className="text-xs text-purple-400 font-semibold">فاتورة مؤرشفة</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            إدارة الأرشيف والحفظ التاريخي للفواتير
          </p>
        </button>
      </div>

      {/* Sub-navigation Segmented Control */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSection('invoices_overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentTab === 'invoices_overview'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>إجمالي الفواتير والمداخيل</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('invoices_purchases')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentTab === 'invoices_purchases'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>إجمالي المشتريات</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('invoices_missing_items')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentTab === 'invoices_missing_items'
              ? 'bg-amber-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>النواقص والأصناف المسجلة</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('invoices_archive')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentTab === 'invoices_archive'
              ? 'bg-purple-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>أرشفة فواتير المشتريات</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      {currentTab !== 'invoices_purchases' && (
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                currentTab === 'invoices_missing_items'
                  ? 'ابحث باسم الصنف أو اسم الأسرة أو التصنيف...'
                  : 'ابحث برقم الفاتورة، اسم الأسرة، أو التصنيف...'
              }
              className="w-full pr-10 pl-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">جميع التصنيفات</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {currentTab === 'invoices_missing_items' && (
            <select
              value={missingStatusFilter}
              onChange={(e) => setMissingStatusFilter(e.target.value as any)}
              className="w-full sm:w-44 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">كل حالات النواقص</option>
              <option value="pending">قيد الطلب (غير مكتمل)</option>
              <option value="completed">تم شراؤه (مكتمل)</option>
            </select>
          )}

          {currentTab === 'invoices_overview' && activeInvoices.length > 0 && (
            <button
              type="button"
              disabled={isUpdatingArchive}
              onClick={() =>
                handleToggleArchive(
                  filteredInvoices.map((i) => i.id),
                  true
                )
              }
              className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>أرشفة الفواتير المعروضة ({filteredInvoices.length})</span>
            </button>
          )}
        </div>
      )}

      {/* TAB 1 & TAB 4: INVOICES OVERVIEW OR INVOICES ARCHIVE */}
      {(currentTab === 'invoices_overview' || currentTab === 'invoices_archive') && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">
                {currentTab === 'invoices_archive'
                  ? `سجل أرشيف فواتير المشتريات (${filteredInvoices.length})`
                  : `سجل الفواتير والمداخيل النشطة (${filteredInvoices.length})`}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {currentTab === 'invoices_archive'
                  ? 'الفواتير المحفوظة داخل أرشيف إدارة الفواتير والمشتريات مع إمكانية الاستعادة أو التصدير'
                  : 'جميع فواتير المشتريات المسجلة بواسطة المنازل والأسر مع تفاصيل الأصناف والأسعار'}
              </p>
            </div>
            {currentTab === 'invoices_archive' && archivedInvoices.length > 0 && (
              <button
                type="button"
                disabled={isUpdatingArchive}
                onClick={() =>
                  handleToggleArchive(
                    archivedInvoices.map((i) => i.id),
                    false
                  )
                }
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>استعادة الكل من الأرشيف</span>
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-xs text-slate-400">جاري تحميل سجل الفواتير...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-300">
                {currentTab === 'invoices_archive'
                  ? 'لا توجد فواتير مؤرشفة حالياً'
                  : 'لا توجد فواتير مطابقة للبحث'}
              </p>
              <p className="text-xs text-slate-500">
                {currentTab === 'invoices_archive'
                  ? 'يمكنك أرشفة أي فاتورة من تبويب "إجمالي الفواتير والمداخيل" لحفظها في الأرشيف.'
                  : 'جرب تغيير معايير الفلترة أو البحث.'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Cards View (< md) */}
              <div className="md:hidden p-3.5 space-y-3">
                {filteredInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded-lg">
                            #{inv.invoice_number || inv.id.slice(0, 8)}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {new Date(inv.date || inv.created_at).toLocaleDateString('ar-EG')}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white mt-1.5">
                          {inv.household_name}
                        </h4>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="text-[10px] text-slate-500 block">إجمالي الفاتورة</span>
                        <span className="text-sm font-black font-mono text-emerald-400 tabular-nums">
                          {inv.total_price.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">التصنيف / المتجر</span>
                        <span className="font-bold text-slate-200 truncate block">
                          {inv.category || inv.store_name || 'عام'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">عدد الأصناف</span>
                        <span className="font-mono font-bold text-amber-300 block">
                          {inv.products?.length || 0} صنف مسجل
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>التفاصيل والأصناف</span>
                      </button>

                      {currentTab === 'invoices_archive' ? (
                        <button
                          type="button"
                          disabled={isUpdatingArchive}
                          onClick={() => handleToggleArchive([inv.id], false)}
                          className="py-2.5 px-3.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>استعادة</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isUpdatingArchive}
                          onClick={() => handleToggleArchive([inv.id], true)}
                          className="py-2.5 px-3.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>أرشفة</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                      <th className="p-3.5 font-bold">رقم الفاتورة</th>
                      <th className="p-3.5 font-bold">الأسرة / المنزل</th>
                      <th className="p-3.5 font-bold">التصنيف / المتجر</th>
                      <th className="p-3.5 font-bold text-center">عدد الأصناف</th>
                      <th className="p-3.5 font-bold text-center">إجمالي الفاتورة</th>
                      <th className="p-3.5 font-bold text-center">التاريخ</th>
                      <th className="p-3.5 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-indigo-300">
                          #{inv.invoice_number || inv.id.slice(0, 8)}
                        </td>
                        <td className="p-3.5 font-bold text-white">{inv.household_name}</td>
                        <td className="p-3.5 text-slate-300">{inv.category || inv.store_name}</td>
                        <td className="p-3.5 text-center font-mono text-slate-300">
                          {inv.products?.length || 0} صنف
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold text-emerald-400 tabular-nums">
                          {inv.total_price.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3.5 text-center font-mono text-slate-400">
                          {new Date(inv.date || inv.created_at).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice(inv)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-400" />
                              <span>الأصناف</span>
                            </button>
                            {currentTab === 'invoices_archive' ? (
                              <button
                                type="button"
                                disabled={isUpdatingArchive}
                                onClick={() => handleToggleArchive([inv.id], false)}
                                className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>استعادة</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isUpdatingArchive}
                                onClick={() => handleToggleArchive([inv.id], true)}
                                className="px-2.5 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>أرشفة</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: TOTAL PURCHASES BREAKDOWN */}
      {currentTab === 'invoices_purchases' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Category Purchases Distribution */}
          <div className="lg:col-span-7 bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>توزيع إجمالي المشتريات حسب التصنيفات</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  تحليل المبالغ المنفقة وعدد الفواتير لكل تصنيف
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400">
                الإجمالي: {totalPurchasesSum.toLocaleString('ar-EG')} ج.م
              </span>
            </div>

            {purchasesByCategory.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                لا توجد مشتريات مسجلة حتى الآن
              </div>
            ) : (
              <div className="space-y-4">
                {purchasesByCategory.map((cat) => (
                  <div key={cat.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{cat.name}</span>
                        <span className="text-slate-500">· {cat.count} فاتورة</span>
                      </div>
                      <div className="font-mono tabular-nums">
                        <span className="font-bold text-emerald-400">
                          {cat.total.toLocaleString('ar-EG')} ج.م
                        </span>
                        <span className="text-slate-400 mr-2">({cat.pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.max(4, cat.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Households by Purchasing Volume */}
          <div className="lg:col-span-5 bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-400" />
                <span>أعلى المنازل والأسر إنفاقاً</span>
              </h3>
              <span className="text-xs text-slate-400">حسب الفواتير</span>
            </div>

            {purchasesByHousehold.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">لا توجد بيانات للأسر</div>
            ) : (
              <div className="space-y-2.5">
                {purchasesByHousehold.map((hh, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{hh.name}</span>
                      <span className="text-[11px] text-slate-500">{hh.count} فواتير مشتريات</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">
                      {hh.total.toLocaleString('ar-EG')} ج.م
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MISSING ITEMS & REGISTERED INVENTORY */}
      {currentTab === 'invoices_missing_items' && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">
                سجل النواقص والأصناف المسجلة ({filteredMissingItems.length})
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                متابعة الأصناف المسجلة في قوائم المنازل والأسر وحالة توفرها أو شرائها
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-xs text-slate-400">جاري تحميل قائمة النواقص...</div>
          ) : filteredMissingItems.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              لا توجد نواقص مطابقة لمعايير البحث الحالية
            </div>
          ) : (
            <>
              {/* Mobile Cards View (< md) */}
              <div className="md:hidden p-3.5 space-y-3">
                {filteredMissingItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-black text-white">{item.name}</h4>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          المنزل: <strong className="text-slate-200">{item.household_name}</strong>
                        </span>
                      </div>
                      {item.completed ? (
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تم الشراء</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold inline-flex items-center gap-1 shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          <span>نواقص مطلوبة</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">التصنيف</span>
                        <span className="font-bold text-slate-200">{item.category || 'عام'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">الكمية المطلوبة</span>
                        <span className="font-mono font-bold text-indigo-300">
                          {item.quantity || '1'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">تاريخ الإضافة</span>
                        <span className="font-mono text-slate-300">
                          {new Date(item.added_at).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                      <th className="p-3.5 font-bold">اسم الصنف</th>
                      <th className="p-3.5 font-bold">التصنيف</th>
                      <th className="p-3.5 font-bold text-center">الكمية المطلوبة</th>
                      <th className="p-3.5 font-bold">المنزل / الأسرة</th>
                      <th className="p-3.5 font-bold text-center">الحالة</th>
                      <th className="p-3.5 font-bold text-center">تاريخ الإضافة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredMissingItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 font-bold text-white">{item.name}</td>
                        <td className="p-3.5 text-slate-300">{item.category || 'عام'}</td>
                        <td className="p-3.5 text-center font-mono text-slate-200">
                          {item.quantity || '1'}
                        </td>
                        <td className="p-3.5 text-slate-300">{item.household_name}</td>
                        <td className="p-3.5 text-center">
                          {item.completed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تم الشراء</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                              <Clock className="w-3.5 h-3.5" />
                              <span>نواقص مطلوبة</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-mono text-slate-400">
                          {new Date(item.added_at).toLocaleDateString('ar-EG')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Invoice Details Modal — Bottom Sheet on Mobile */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92dvh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            {/* Sticky Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white">
                  تفاصيل فاتورة المشتريات #{selectedInvoice.invoice_number || selectedInvoice.id.slice(0, 8)}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedInvoice.household_name} · {selectedInvoice.category || selectedInvoice.store_name || 'عام'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">إجمالي الفاتورة</span>
                  <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                    {selectedInvoice.total_price.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">تاريخ الفاتورة</span>
                  <span className="text-xs font-bold text-white font-mono mt-1 block">
                    {new Date(selectedInvoice.date || selectedInvoice.created_at).toLocaleString('ar-EG')}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 block">
                  الأصناف المسجلة داخل الفاتورة ({selectedInvoice.products?.length || 0})
                </span>
                {!selectedInvoice.products || selectedInvoice.products.length === 0 ? (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                    لا توجد أصناف مفصلة مسجلة لهذه الفاتورة
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                    {selectedInvoice.products.map((prod, i) => (
                      <div key={i} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-white">{prod.name || `صنف #${i + 1}`}</span>
                          {prod.quantity && (
                            <span className="text-slate-400 mr-2">· الكمية: {prod.quantity}</span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-emerald-400">
                          {Number(prod.price || 0).toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const isArch = archivedIds.includes(selectedInvoice.id);
                  handleToggleArchive([selectedInvoice.id], !isArch);
                  setSelectedInvoice(null);
                }}
                className="px-3.5 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>
                  {archivedIds.includes(selectedInvoice.id)
                    ? 'استعادة من الأرشيف'
                    : 'أرشفة هذه الفاتورة'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
