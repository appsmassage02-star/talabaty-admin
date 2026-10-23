import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { AdminBroadcastNotification, AdminNotificationView } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import {
  Bell,
  Send,
  Users,
  Radio,
  Clock,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  X,
  Image as ImageIcon,
  Link2,
  Calendar,
  Layout,
  Maximize2,
  PanelBottom,
  PanelTop,
  CheckCircle2,
  Home,
} from 'lucide-react';

export const AdminNotifications: React.FC = () => {
  const {
    hasPermission,
    showToast,
    activeSection,
    setActiveSection,
    sectionFilter,
    clearSectionFilter,
  } = useAdmin();

  const [notifications, setNotifications] = useState<AdminBroadcastNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Apply filter when navigated from Command Center (e.g., Active Notifications card)
  useEffect(() => {
    if (!sectionFilter) return;
    const incomingStatus =
      sectionFilter.status || sectionFilter.activeFilter || sectionFilter.statusTab;
    if (
      incomingStatus === 'active' ||
      incomingStatus === 'inactive' ||
      incomingStatus === 'all'
    ) {
      setFilterStatus(incomingStatus);
    }
    clearSectionFilter();
  }, [sectionFilter, clearSectionFilter]);

  // Form State (Create & Edit) matching exact columns of public.admin_notifications
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'top_banner' | 'modal' | 'bottom_banner'>('top_banner');
  const [iconName, setIconName] = useState('🔔');
  const [imageUrl, setImageUrl] = useState('');
  const [actionType, setActionType] = useState<'none' | 'route' | 'url'>('none');
  const [actionRoute, setActionRoute] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Views Details Modal (public.admin_notification_views)
  const [selectedNotifForViews, setSelectedNotifForViews] = useState<AdminBroadcastNotification | null>(null);
  const [viewsList, setViewsList] = useState<AdminNotificationView[]>([]);
  const [isLoadingViews, setIsLoadingViews] = useState(false);

  // Delete Confirmation Modal
  const [notifToDelete, setNotifToDelete] = useState<AdminBroadcastNotification | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const emojiPresets = ['🔔', '📢', '🎉', '⚠️', '🛒', '🚚', '✨', '💡', '🔥', '❤️'];

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAdminNotifications();
      setNotifications(data);
    } catch (e) {
      console.warn('Failed to load admin_notifications:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setType('top_banner');
    setIconName('🔔');
    setImageUrl('');
    setActionType('none');
    setActionRoute('');
    setIsActive(true);
    setStartAt('');
    setEndAt('');
  };

  const toLocalDatetimeInput = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const handleEditClick = (notif: AdminBroadcastNotification) => {
    setEditingId(notif.id);
    setTitle(notif.title || '');
    setBody(notif.body || '');
    const validType =
      notif.type === 'modal' || notif.type === 'bottom_banner' || notif.type === 'top_banner'
        ? notif.type
        : 'top_banner';
    setType(validType);
    setIconName(notif.icon_name || '🔔');
    setImageUrl(notif.image_url || '');
    const aType =
      notif.action_type === 'route' || notif.action_type === 'url'
        ? notif.action_type
        : notif.action_route
        ? 'route'
        : 'none';
    setActionType(aType);
    setActionRoute(notif.action_route || '');
    setIsActive(notif.is_active ?? true);
    setStartAt(toLocalDatetimeInput(notif.start_at));
    setEndAt(toLocalDatetimeInput(notif.end_at));
    setActiveSection('notifications_broadcast');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      showToast('يرجى ملء عنوان ومحتوى الإشعار', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        type,
        icon_name: iconName.trim() || null,
        image_url: imageUrl.trim() || null,
        action_type: actionType === 'none' ? null : actionType,
        action_route: actionType === 'none' ? null : actionRoute.trim() || null,
        is_active: isActive,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        end_at: endAt ? new Date(endAt).toISOString() : null,
      };

      if (editingId) {
        const res = await adminService.updateAdminNotification(editingId, payload);
        if (res.success) {
          showToast('تم تحديث الإشعار في admin_notifications بنجاح', 'success');
          resetForm();
          loadNotifications();
        } else {
          showToast(res.error || 'فشل تحديث الإشعار', 'error');
        }
      } else {
        const res = await adminService.createAdminNotification(payload);
        if (res.success) {
          showToast('تم إنشاء الإشعار في admin_notifications بنجاح', 'success');
          resetForm();
          loadNotifications();
        } else {
          showToast(res.error || 'فشل إنشاء الإشعار', 'error');
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (notif: AdminBroadcastNotification) => {
    const res = await adminService.toggleAdminNotificationActive(notif.id, !notif.is_active);
    if (res.success) {
      showToast(
        notif.is_active ? `تم إيقاف الإشعار "${notif.title}"` : `تم تفعيل الإشعار "${notif.title}"`,
        'info'
      );
      loadNotifications();
    } else {
      showToast(res.error || 'تعذر تغيير حالة الإشعار', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!notifToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await adminService.deleteAdminNotification(notifToDelete.id);
      if (res.success) {
        showToast(`تم حذف الإشعار "${notifToDelete.title}" نهائيًا`, 'info');
        if (editingId === notifToDelete.id) resetForm();
        setNotifToDelete(null);
        loadNotifications();
      } else {
        showToast(res.error || 'فشل حذف الإشعار', 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenViewsModal = async (notif: AdminBroadcastNotification) => {
    setSelectedNotifForViews(notif);
    setIsLoadingViews(true);
    setViewsList([]);
    try {
      const details = await adminService.getNotificationViewsDetails(notif.id);
      setViewsList(details);
    } finally {
      setIsLoadingViews(false);
    }
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case 'top_banner':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center space-x-1 space-x-reverse">
            <PanelTop className="w-3 h-3 text-cyan-400" />
            <span>شريط علوي (top_banner)</span>
          </span>
        );
      case 'modal':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center space-x-1 space-x-reverse">
            <Maximize2 className="w-3 h-3 text-purple-400" />
            <span>نافذة منبثقة (modal)</span>
          </span>
        );
      case 'bottom_banner':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1 space-x-reverse">
            <PanelBottom className="w-3 h-3 text-amber-400" />
            <span>شريط سفلي (bottom_banner)</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center space-x-1 space-x-reverse">
            <Layout className="w-3 h-3 text-slate-400" />
            <span>{t}</span>
          </span>
        );
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterStatus === 'active' && !n.is_active) return false;
    if (filterStatus === 'inactive' && n.is_active) return false;
    if (filterType !== 'all' && n.type !== filterType) return false;
    return true;
  });

  const totalViewsSum = notifications.reduce((acc, n) => acc + (n.views_count || 0), 0);
  const activeCount = notifications.filter((n) => n.is_active).length;

  const handleExport = () => {
    exportToCSV('admin_notifications_export', notifications);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center border border-pink-500/20">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse flex-wrap gap-y-1">
              <h2 className="text-lg font-bold text-white">نظام الإشعارات المركزي (admin_notifications)</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 font-mono">
                {notifications.length} إشعار
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                {activeCount} نشط
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                {totalViewsSum} مشاهدة مسجلة
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              إدارة إشعارات التطبيق المركزية وتتبع مشاهدات المستخدمين والمنازل عبر سجل (admin_notification_views).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveSection('notifications')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection !== 'notifications_broadcast'
                  ? 'bg-pink-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              قائمة الإشعارات والمشاهدات
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('notifications_broadcast')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSection === 'notifications_broadcast'
                  ? 'bg-pink-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {editingId ? 'تعديل الإشعار' : 'إنشاء إشعار جديد'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center space-x-1.5 space-x-reverse cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Create / Edit Notification Form (5 Cols) */}
        <div
          className={`lg:col-span-5 bg-slate-900/90 rounded-3xl p-5 sm:p-6 border shadow-sm space-y-4 transition-colors ${
            activeSection === 'notifications_broadcast' || editingId
              ? 'border-pink-500/60 ring-1 ring-pink-500/20'
              : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Radio className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-bold text-white">
                {editingId ? 'تعديل بيانات الإشعار الحالي' : 'إنشاء إشعار جديد في التطبيق'}
              </h3>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800"
              >
                إلغاء التعديل
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Notification Type (Approved Types: top_banner, modal, bottom_banner) */}
            <div>
              <label className="font-bold text-slate-300 block mb-1.5">نوع الإشعار المعتمد (type) *</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setType('top_banner')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    type === 'top_banner'
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <PanelTop className="w-4 h-4" />
                  <span className="text-[11px]">شريط علوي</span>
                  <span className="text-[9px] font-mono opacity-75">top_banner</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('modal')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    type === 'modal'
                      ? 'bg-purple-500/15 border-purple-500 text-purple-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Maximize2 className="w-4 h-4" />
                  <span className="text-[11px]">نافذة منبثقة</span>
                  <span className="text-[9px] font-mono opacity-75">modal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('bottom_banner')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    type === 'bottom_banner'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <PanelBottom className="w-4 h-4" />
                  <span className="text-[11px]">شريط سفلي</span>
                  <span className="text-[9px] font-mono opacity-75">bottom_banner</span>
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="font-bold text-slate-300 block mb-1">عنوان الإشعار (title) *</label>
              <input
                type="text"
                required
                placeholder="مثال: تحديث جديد في خدمة توصيل طلبات البيت"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* Body */}
            <div>
              <label className="font-bold text-slate-300 block mb-1">محتوى الإشعار (body) *</label>
              <textarea
                rows={3}
                required
                placeholder="اكتب نص الإشعار الذي سيظهر للمستخدمين داخل التطبيق..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* Icon & Image URL */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="font-bold text-slate-300 block mb-1">الأيقونة (icon_name)</label>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="text"
                    value={iconName}
                    onChange={(e) => setIconName(e.target.value)}
                    placeholder="🔔"
                    className="w-16 px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                  <div className="flex flex-wrap gap-1">
                    {emojiPresets.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setIconName(em)}
                        className="w-7 h-7 rounded-lg bg-slate-950 hover:bg-slate-800 flex items-center justify-center text-sm border border-slate-800 transition-colors cursor-pointer"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>رابط صورة الإشعار الاختياري (image_url)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            {/* Action Type & Route */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1 flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>نوع التوجيه (action_type)</span>
                </label>
                <select
                  value={actionType}
                  onChange={(e: any) => setActionType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                >
                  <option value="none">بدون إجراء (عرض فقط)</option>
                  <option value="route">مسار داخلي (route)</option>
                  <option value="url">رابط خارجي (url)</option>
                </select>
              </div>

              {actionType !== 'none' && (
                <div>
                  <label className="font-bold text-slate-300 block mb-1">مسار/رابط التوجيه (action_route)</label>
                  <input
                    type="text"
                    placeholder={actionType === 'route' ? '/delivery' : 'https://...'}
                    value={actionRoute}
                    onChange={(e) => setActionRoute(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              )}
            </div>

            {/* Start At & End At */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>بداية العرض (start_at)</span>
                </label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-white focus:outline-none focus:border-pink-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>انتهاء العرض (end_at)</span>
                </label>
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-white focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            {/* Is Active Switch */}
            <div className="pt-1">
              <label className="flex items-center space-x-2 space-x-reverse font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 bg-slate-950 border-slate-800"
                />
                <span>تفعيل الإشعار فور الحفظ (is_active)</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSaving || !hasPermission('notifications.send')}
              className="w-full py-3 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-pink-600/30 transition-all flex items-center justify-center space-x-2 space-x-reverse cursor-pointer"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{editingId ? 'حفظ تعديلات الإشعار' : 'إنشاء ونشر الإشعار'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Notifications List & Views Tracking (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2 space-x-reverse">
              <Clock className="w-4 h-4 text-pink-400" />
              <span>الإشعارات المسجلة وسجل المشاهدة</span>
            </h3>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterStatus === 'all'
                      ? 'bg-pink-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  الكل ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('active')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterStatus === 'active'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  النشطة ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('inactive')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterStatus === 'inactive'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  المتوقفة ({Math.max(0, notifications.length - activeCount)})
                </button>
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-bold text-slate-300"
              >
                <option value="all">كل الأنواع</option>
                <option value="top_banner">top_banner (شريط علوي)</option>
                <option value="modal">modal (نافذة منبثقة)</option>
                <option value="bottom_banner">bottom_banner (شريط سفلي)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e: any) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-bold text-slate-300"
              >
                <option value="all">كل الحالات</option>
                <option value="active">نشط فقط</option>
                <option value="inactive">متوقف فقط</option>
              </select>

              <button
                type="button"
                onClick={loadNotifications}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                title="تحديث"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {(filterStatus !== 'all' || filterType !== 'all') && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  الفلتر المطبق حاليًا:{' '}
                  {filterStatus === 'active'
                    ? 'الإشعارات النشطة فقط'
                    : filterStatus === 'inactive'
                    ? 'الإشعارات المتوقفة فقط'
                    : 'كل الحالات'}
                  {filterType !== 'all' ? ` • النوع: ${filterType}` : ''} (
                  {filteredNotifications.length} نتيجة)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('all');
                  setFilterType('all');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-bold border border-slate-700 cursor-pointer shrink-0"
              >
                عرض الكل
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-pink-400 animate-spin mx-auto" />
              <span className="text-xs text-slate-400">جاري تحميل الإشعارات وسجل المشاهدات...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              لا توجد إشعارات مسجلة في جدول admin_notifications تطابق الفلتر الحالي.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 bg-slate-950 rounded-2xl border space-y-3 transition-colors ${
                    notif.is_active
                      ? 'border-slate-800/90 hover:border-slate-700'
                      : 'border-slate-900 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3 space-x-reverse">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg shrink-0">
                        {notif.icon_name || '🔔'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-xs">{notif.title}</h4>
                          {notif.is_active ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              مفعل
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              متوقف
                            </span>
                          )}
                          {getTypeBadge(notif.type)}
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed whitespace-pre-line">
                          {notif.body}
                        </p>
                        {notif.image_url && (
                          <a
                            href={notif.image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline mt-1 font-mono"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>صورة مرفقة</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center space-x-1 space-x-reverse shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(notif)}
                        className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                          notif.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                        title={notif.is_active ? 'إيقاف الإشعار' : 'تفعيل الإشعار'}
                      >
                        {notif.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditClick(notif)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="تعديل الإشعار"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setNotifToDelete(notif)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="حذف الإشعار"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Stats & Metadata Footer from admin_notification_views */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 pt-2.5 border-t border-slate-900">
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenViewsModal(notif)}
                        className="px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/20 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Users className="w-3 h-3 text-pink-400" />
                        <span>المشاهدات: {notif.views_count || 0}</span>
                        <span className="text-slate-400 font-normal">
                          ({notif.unique_users_count || 0} مستخدم · {notif.unique_households_count || 0} منزل)
                        </span>
                      </button>

                      {notif.dismissed_count > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800">
                          تم إغلاقه: {notif.dismissed_count} مرة
                        </span>
                      )}

                      {notif.action_route && (
                        <span className="font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
                          {notif.action_type || 'route'}: {notif.action_route}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 font-mono text-slate-500">
                      {notif.end_at && (
                        <span title="تاريخ الانتهاء" className="text-amber-400/80">
                          ينتهي:{' '}
                          {new Date(notif.end_at).toLocaleDateString('ar-EG', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                      <span>
                        {new Date(notif.created_at).toLocaleString('ar-EG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEWS LOG MODAL (admin_notification_views) — Bottom Sheet on Mobile */}
      {/* =================================================================== */}
      {selectedNotifForViews && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setSelectedNotifForViews(null)}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full border-t sm:border border-slate-800 shadow-2xl text-right text-white animate-in zoom-in-95 max-h-[92dvh] sm:max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            {/* Sticky Header */}
            <div className="flex items-center justify-between px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-pink-400 shrink-0" />
                  <span>سجل المشاهدات (admin_notification_views)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[260px] sm:max-w-md">
                  {selectedNotifForViews.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotifForViews(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-base sm:text-lg font-bold text-pink-400 font-mono">
                    {viewsList.length}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400">إجمالي المشاهدات</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-base sm:text-lg font-bold text-cyan-400 font-mono">
                    {selectedNotifForViews.unique_users_count || 0}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400">مستخدمون فريدون</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
                    {selectedNotifForViews.unique_households_count || 0}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400">منازل مسجلة</div>
                </div>
              </div>

              {isLoadingViews ? (
                <div className="py-12 text-center space-y-2">
                  <RefreshCw className="w-6 h-6 text-pink-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">جاري جلب سجل المشاهدات من قاعدة البيانات...</p>
                </div>
              ) : viewsList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  لم يتم تسجيل أي مشاهدة لهذا الإشعار حتى الآن في جدول admin_notification_views.
                </div>
              ) : (
                <>
                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-2.5">
                    {viewsList.map((v) => (
                      <div
                        key={v.id}
                        className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-white">{v.user_name || 'مستخدم'}</div>
                            {v.user_email && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                {v.user_email}
                              </div>
                            )}
                          </div>
                          {v.household_name && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-bold">
                              <Home className="w-3 h-3 text-emerald-400" />
                              <span>{v.household_name}</span>
                            </span>
                          )}
                        </div>
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                          <span className="text-slate-400">
                            المشاهدة: {new Date(v.created_at).toLocaleString('ar-EG')}
                          </span>
                          {v.dismissed_at ? (
                            <span className="text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>أُغلق: {new Date(v.dismissed_at).toLocaleString('ar-EG')}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">لم يُغلق</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                        <tr>
                          <th className="p-3">المستخدم</th>
                          <th className="p-3">المنزل</th>
                          <th className="p-3">وقت المشاهدة (created_at)</th>
                          <th className="p-3">وقت الإغلاق (dismissed_at)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {viewsList.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-800/30">
                            <td className="p-3">
                              <div className="font-bold text-white">{v.user_name || 'مستخدم'}</div>
                              {v.user_email && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {v.user_email}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {v.household_name ? (
                                <span className="inline-flex items-center gap-1 text-slate-300">
                                  <Home className="w-3 h-3 text-emerald-400" />
                                  <span>{v.household_name}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-300">
                              {new Date(v.created_at).toLocaleString('ar-EG')}
                            </td>
                            <td className="p-3 font-mono text-[11px]">
                              {v.dismissed_at ? (
                                <span className="text-emerald-400 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{new Date(v.dismissed_at).toLocaleString('ar-EG')}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-slate-950/90 border-t border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedNotifForViews(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DELETE CONFIRMATION MODAL — Bottom Sheet on Mobile                  */}
      {/* =================================================================== */}
      {notifToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => !isDeleting && setNotifToDelete(null)}
        >
          <div
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full border-t sm:border border-rose-500/30 shadow-2xl p-5 sm:p-6 space-y-4 text-right text-white animate-in zoom-in-95 max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center pb-1">
              <div className="w-10 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-rose-400">حذف الإشعار نهائيًا</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                هل أنت متأكد من حذف الإشعار <strong className="text-white">"{notifToDelete.title}"</strong> من جدول{' '}
                <code className="text-rose-300">admin_notifications</code>؟
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setNotifToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer"
              >
                {isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
