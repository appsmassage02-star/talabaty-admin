import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { AdminAuditLog } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Download,
  Eye,
  ShieldCheck,
  UserCheck,
  Trash2,
  Lock,
  Layers,
  Package,
  Settings,
  X,
} from 'lucide-react';

export const AdminAuditLogs: React.FC = () => {
  const { hasPermission, showToast } = useAdmin();

  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 30;

  // Selected Log for Details Modal
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getAuditLogs({
        action: actionFilter !== 'all' ? actionFilter : undefined,
        entityType: entityFilter !== 'all' ? entityFilter : undefined,
        page,
        pageSize,
      });
      setLogs(res.logs);
      setTotalCount(res.total);
    } catch (e) {
      console.warn('Failed to load audit logs:', e);
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, entityFilter, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleExport = () => {
    exportToCSV('audit_logs_export', logs);
  };

  const getActionBadge = (action: string) => {
    if (action.includes('DELETE')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
          {action}
        </span>
      );
    }
    if (action.includes('BLOCK')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
          {action}
        </span>
      );
    }
    if (action.includes('CREATE') || action.includes('INSERT')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
          {action}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-lg font-bold text-white">سجل العمليات والرقابة (Audit Logs)</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">
                {totalCount} عملية مسجلة
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              توثيق دقيق لكافة الإجراءات الإدارية، التعديلات، الحظر، والحذف مع تفاصيل المنفذ والوقت.
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
            onClick={loadLogs}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="إعادة تحميل"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">نوع العملية (Action)</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-teal-500"
            >
              <option value="all">كافة العمليات</option>
              <option value="USER_BLOCK">حظر مستخدم (USER_BLOCK)</option>
              <option value="USER_UNBLOCK">إلغاء حظر (USER_UNBLOCK)</option>
              <option value="USER_DELETE">حذف مستخدم (USER_DELETE)</option>
              <option value="HOUSEHOLD_DELETE">حذف منزل (HOUSEHOLD_DELETE)</option>
              <option value="CATEGORY_CREATE">إضافة قسم (CATEGORY_CREATE)</option>
              <option value="CATEGORY_UPDATE">تعديل قسم (CATEGORY_UPDATE)</option>
              <option value="CATEGORY_DELETE">حذف قسم (CATEGORY_DELETE)</option>
              <option value="PRODUCT_CREATE">إضافة منتج (PRODUCT_CREATE)</option>
              <option value="NOTIFICATION_BROADCAST">بث إشعار (NOTIFICATION_BROADCAST)</option>
              <option value="ADMIN_CREATE">إضافة مشرف (ADMIN_CREATE)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">الكيان المستهدف (Entity)</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-teal-500"
            >
              <option value="all">كافة الكيانات</option>
              <option value="users">المستخدمين (users)</option>
              <option value="households">المنازل (households)</option>
              <option value="categories">الأقسام (categories)</option>
              <option value="products">المنتجات (products)</option>
              <option value="notifications">الإشعارات (notifications)</option>
              <option value="admins">المشرفين (admins)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-bold">جاري تحميل سجل العمليات...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Activity className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">لا توجد سجلات مسجلة</h3>
            <p className="text-xs text-slate-500">سيتم تسجيل أي إجراء يتم تنفيذه في لوحة التحكم هنا تلقائياً.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-4">المنفذ (Admin)</th>
                  <th className="p-4">نوع الإجراء</th>
                  <th className="p-4">الكيان والهدف</th>
                  <th className="p-4">التفاصيل</th>
                  <th className="p-4">الوقت والتاريخ</th>
                  <th className="p-4 text-center">فحص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-white block">
                            {log.admin?.full_name || log.admin?.email || 'النظام'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{log.admin_id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{getActionBadge(log.action)}</td>
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-200 block">{log.entity_type}</span>
                        {log.entity_id && (
                          <span className="font-mono text-[10px] text-slate-500 block">{log.entity_id.slice(0, 8)}...</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 max-w-xs truncate text-slate-400">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                    <td className="p-4 font-mono text-slate-400">
                      {new Date(log.created_at).toLocaleString('ar-EG')}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="عرض البيانات الكاملة"
                      >
                        <Eye className="w-4 h-4 text-teal-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-800 shadow-2xl p-6 space-y-4 text-right text-white animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Activity className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">تفاصيل العملية الإدارية</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 block">الإجراء:</span>
                  <span className="font-mono font-bold text-teal-400">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">الكيان:</span>
                  <span className="font-mono font-bold text-white">{selectedLog.entity_type}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">معرف الهدف (Entity ID):</span>
                  <span className="font-mono text-slate-300 break-all">{selectedLog.entity_id || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">وقت التنفيذ:</span>
                  <span className="font-mono text-slate-300">
                    {new Date(selectedLog.created_at).toLocaleString('ar-EG')}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-300 block mb-1">تفاصيل وحالة العملية (Payload JSON):</span>
                <pre className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48 text-left" dir="ltr">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
