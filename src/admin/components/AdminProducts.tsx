import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { adminService } from '../services/adminService';
import { AdminProduct, AdminCategory } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  Download,
  X,
  Image as ImageIcon,
  FolderTree,
  DollarSign,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

export const AdminProducts: React.FC = () => {
  const { hasPermission, showToast } = useAdmin();

  const canEdit = hasPermission('products.edit') || hasPermission('products.update');

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 30;

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);

  // Form Fields matching exact columns of public.global_products
  const [productId, setProductId] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [globalCategoryId, setGlobalCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('قطعة');
  const [defaultQuantity, setDefaultQuantity] = useState('1');
  const [estimatedPrice, setEstimatedPrice] = useState<string>('');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Product Modal
  const [productToDelete, setProductToDelete] = useState<AdminProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Product Details Modal
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await adminService.getCategories();
      setCategories(cats);
      if (cats.length > 0 && !globalCategoryId) {
        setGlobalCategoryId(cats[0].id);
      }
    } catch (e) {
      console.warn('Failed to load global_categories in products:', e);
    }
  }, [globalCategoryId]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getProducts({
        search: searchQuery,
        categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : undefined,
        subcategoryId: selectedSubcategoryId !== 'all' ? selectedSubcategoryId : undefined,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
        page,
        pageSize,
      });
      setProducts(res.products);
      setTotalCount(res.total);
    } catch (e) {
      console.warn('Failed to load global_products:', e);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategoryId, selectedSubcategoryId, activeFilter, page]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Subcategories available for filter bar when a category is selected
  const filterCategoryObj = categories.find((c) => c.id === selectedCategoryId);
  const filterSubcategories = Array.isArray(filterCategoryObj?.subcategories)
    ? filterCategoryObj!.subcategories!
    : [];

  // Subcategories available in form modal for chosen globalCategoryId
  const formCategoryObj = categories.find((c) => c.id === globalCategoryId);
  const formSubcategories = Array.isArray(formCategoryObj?.subcategories)
    ? formCategoryObj!.subcategories!
    : [];

  const resetCreateDraft = () => {
    setProductId('');
    setNameAr('');
    setNameEn('');
    const defaultCat =
      selectedCategoryId !== 'all'
        ? selectedCategoryId
        : categories.length > 0
        ? categories[0].id
        : '';
    setGlobalCategoryId(defaultCat);
    setSubcategoryId('');
    setDefaultUnit('قطعة');
    setDefaultQuantity('1');
    setEstimatedPrice('');
    setImageUrl('');
    setSortOrder(totalCount + 1);
    setIsActive(true);
  };

  const handleOpenAdd = () => {
    // Preserve draft if user was already in create mode and closed the sheet temporarily
    if (modalMode !== 'create' || editingProduct !== null || (!nameAr && !nameEn && !imageUrl && !estimatedPrice)) {
      resetCreateDraft();
    }
    setModalMode('create');
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prod: AdminProduct) => {
    // If reopening the same product that was being edited, preserve unsaved changes
    if (modalMode !== 'edit' || editingProduct?.id !== prod.id) {
      setModalMode('edit');
      setEditingProduct(prod);
      setProductId(prod.id);
      setNameAr(prod.name_ar || prod.name || '');
      setNameEn(prod.name_en || '');
      setGlobalCategoryId(
        prod.global_category_id || prod.category_id || (categories.length > 0 ? categories[0].id : '')
      );
      setSubcategoryId(prod.subcategory_id || '');
      setDefaultUnit(prod.default_unit || 'قطعة');
      setDefaultQuantity(String(prod.default_quantity ?? '1'));
      setEstimatedPrice(
        prod.estimated_price !== null && prod.estimated_price !== undefined
          ? String(prod.estimated_price)
          : ''
      );
      setImageUrl(prod.image_url || '');
      setSortOrder(prod.sort_order ?? 0);
      setIsActive(prod.is_active ?? true);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      showToast('يرجى إدخال اسم المنتج بالعربية', 'error');
      return;
    }
    if (!globalCategoryId) {
      showToast('يرجى اختيار القسم الرئيسي للمنتج', 'error');
      return;
    }

    const finalId =
      modalMode === 'edit' && editingProduct
        ? editingProduct.id
        : productId.trim() ||
          `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    setIsSaving(true);
    try {
      const res = await adminService.upsertProduct({
        id: finalId,
        global_category_id: globalCategoryId,
        subcategory_id: subcategoryId.trim() || null,
        name_ar: nameAr.trim(),
        name_en: nameEn.trim() || null,
        default_unit: defaultUnit.trim() || 'قطعة',
        default_quantity: String(defaultQuantity || '1').trim(),
        estimated_price:
          estimatedPrice.trim() !== '' && !isNaN(Number(estimatedPrice))
            ? Number(estimatedPrice)
            : null,
        image_url: imageUrl.trim() || null,
        sort_order: Number(sortOrder) || 0,
        is_active: isActive,
      });

      if (res.success) {
        showToast(
          modalMode === 'create'
            ? `تمت إضافة المنتج "${nameAr}" إلى global_products بنجاح`
            : `تم تحديث بيانات المنتج "${nameAr}" في global_products بنجاح`,
          'success'
        );
        if (modalMode === 'create') {
          resetCreateDraft();
        } else {
          setEditingProduct(null);
        }
        setIsModalOpen(false);
        loadProducts();
        loadCategories();
      } else {
        showToast(res.error || 'فشل حفظ المنتج', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (prod: AdminProduct) => {
    try {
      const res = await adminService.toggleProductActive(prod.id, !prod.is_active);
      if (res.success) {
        showToast(
          prod.is_active ? `تم تعطيل المنتج "${prod.name_ar}"` : `تم تفعيل المنتج "${prod.name_ar}"`,
          'info'
        );
        loadProducts();
      } else {
        showToast(res.error || 'تعذر تحديث حالة المنتج', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'حدث خطأ', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await adminService.deleteProduct(productToDelete.id);
      if (res.success) {
        showToast(`تم حذف المنتج "${productToDelete.name_ar}" من global_products بنجاح`, 'info');
        if (selectedProduct?.id === productToDelete.id) {
          setSelectedProduct(null);
        }
        setProductToDelete(null);
        loadProducts();
        loadCategories();
      } else {
        showToast(res.error || 'فشل حذف المنتج', 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    exportToCSV('global_products_catalog_export', products);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-lg font-bold text-white">الكتالوج المركزي للمنتجات (global_products)</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                {totalCount} منتج
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              إدارة المنتجات المركزية وربطها بالأقسام الرئيسية والفرعية مع الوحدة والكمية والسعر التقديري.
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
          {hasPermission('products.create') && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 space-x-reverse cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة منتج مركزي</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-4 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="ابحث بالاسم العربي أو الإنجليزي أو المعرف..."
              className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute left-3 top-3 text-xs text-slate-500 hover:text-slate-300"
              >
                مسح
              </button>
            )}
          </div>

          {/* Main Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setSelectedSubcategoryId('all');
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">كافة الأقسام الرئيسية</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon_name || c.icon} {c.name_ar || c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedSubcategoryId}
              onChange={(e) => {
                setSelectedSubcategoryId(e.target.value);
                setPage(1);
              }}
              disabled={selectedCategoryId === 'all' || filterSubcategories.length === 0}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 disabled:opacity-50 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">كافة الأقسام الفرعية</option>
              {filterSubcategories.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.nameAr || sc.name_ar}
                </option>
              ))}
            </select>
          </div>

          {/* Active Filter */}
          <div className="sm:col-span-2">
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط فقط</option>
              <option value="inactive">معطل فقط</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table / Mobile Cards */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-bold">جاري تحميل المنتجات من global_products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">لا توجد منتجات مطابقة</h3>
            <p className="text-xs text-slate-500">يمكنك إضافة منتج جديد للكتالوج المركزي عبر زر الإضافة أعلاه.</p>
          </div>
        ) : (
          <>
            {/* Mobile Responsive Cards (< md) */}
            <div className="md:hidden divide-y divide-slate-800/70">
              {products.map((prod) => (
                <div key={prod.id} className="p-4 space-y-3.5 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 space-x-reverse min-w-0">
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name_ar}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-800 shrink-0 bg-slate-950"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold border border-purple-500/20 shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">{prod.name_ar || prod.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {prod.name_en ? `${prod.name_en} · ` : ''}
                          {prod.id}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {prod.is_active ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          نشط
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          معطل
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-500">ترتيب #{prod.sort_order ?? 0}</span>
                    </div>
                  </div>

                  {/* Category & Subcategory Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {prod.category ? (
                      <span className="px-2.5 py-1 bg-slate-950 rounded-xl text-slate-200 font-bold border border-slate-800">
                        {prod.category.icon} {prod.category.name_ar || prod.category.name}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-950 rounded-xl text-slate-400 font-mono border border-slate-800">
                        {prod.global_category_id}
                      </span>
                    )}
                    {prod.subcategory_id && (
                      <span className="px-2.5 py-1 bg-cyan-950/40 text-cyan-300 rounded-xl border border-cyan-500/20 flex items-center gap-1">
                        <FolderTree className="w-3 h-3" />
                        <span>{prod.subcategory_name_ar || prod.subcategory_id}</span>
                      </span>
                    )}
                  </div>

                  {/* Quantity & Price Summary */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">الكمية والوحدة الافتراضية</span>
                      <span className="font-mono font-bold text-slate-200">
                        {prod.default_quantity} {prod.default_unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">السعر التقديري</span>
                      {prod.estimated_price !== null && prod.estimated_price !== undefined ? (
                        <span className="font-mono font-bold text-emerald-400">{prod.estimated_price} ج.م</span>
                      ) : (
                        <span className="text-slate-500 font-mono">غير محدد</span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(prod)}
                      className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                    >
                      <Eye className="w-3.5 h-3.5 text-purple-400" />
                      <span>التفاصيل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(prod)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        prod.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title={prod.is_active ? 'تعطيل المنتج' : 'تفعيل المنتج'}
                    >
                      {prod.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{prod.is_active ? 'نشط' : 'معطل'}</span>
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(prod)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                        title="تعديل المنتج"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {hasPermission('products.delete') && (
                      <button
                        type="button"
                        onClick={() => setProductToDelete(prod)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
                        title="حذف المنتج"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
                  <tr>
                    <th className="p-4">المنتج</th>
                    <th className="p-4">القسم الرئيسي والفرعي</th>
                    <th className="p-4">الكمية والوحدة الافتراضية</th>
                    <th className="p-4">السعر التقديري</th>
                    <th className="p-4">الترتيب</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {products.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          {prod.image_url ? (
                            <img
                              src={prod.image_url}
                              alt={prod.name_ar}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-800 shrink-0 bg-slate-950"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold border border-purple-500/20 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white">{prod.name_ar || prod.name}</div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                              <span>{prod.id}</span>
                              {prod.name_en && <span>· {prod.name_en}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          {prod.category ? (
                            <span className="px-2.5 py-1 bg-slate-950 rounded-lg text-slate-200 font-medium border border-slate-800">
                              {prod.category.icon} {prod.category.name_ar || prod.category.name}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px]">{prod.global_category_id}</span>
                          )}
                          {prod.subcategory_id && (
                            <span className="px-2 py-0.5 bg-cyan-950/40 text-cyan-300 rounded-md border border-cyan-500/20 text-[10px] flex items-center gap-1">
                              <FolderTree className="w-3 h-3" />
                              <span>{prod.subcategory_name_ar || prod.subcategory_id}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 font-mono text-slate-300">
                        {prod.default_quantity} {prod.default_unit}
                      </td>

                      <td className="p-4 font-mono">
                        {prod.estimated_price !== null && prod.estimated_price !== undefined ? (
                          <span className="text-emerald-400 font-bold">{prod.estimated_price} ج.م</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="p-4 font-mono text-slate-400">#{prod.sort_order ?? 0}</td>

                      <td className="p-4">
                        {prod.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            نشط
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            معطل
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center space-x-1.5 space-x-reverse">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(prod)}
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              prod.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                            title={prod.is_active ? 'تعطيل المنتج' : 'تفعيل المنتج'}
                          >
                            {prod.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(prod)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="تعديل المنتج"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {hasPermission('products.delete') && (
                            <button
                              type="button"
                              onClick={() => setProductToDelete(prod)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="حذف المنتج"
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

            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/50">
                <span>
                  صفحة <strong className="text-white">{page}</strong> من{' '}
                  <strong className="text-white">{totalPages}</strong> (إجمالي {totalCount} منتج)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>السابق</span>
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>التالي</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* =================================================================== */}
      {/* 0. PRODUCT DETAILS MODAL (Mobile Bottom Sheet / Desktop Modal)     */}
      {/* =================================================================== */}
      {selectedProduct && (
        <div
          onClick={() => setSelectedProduct(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full border-t sm:border border-slate-800 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden text-right text-white animate-in slide-in-from-bottom-4 sm:zoom-in-95"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-900/95">
              <div className="flex items-center gap-3 min-w-0">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name_ar}
                    className="w-11 h-11 rounded-2xl object-cover border border-slate-800 shrink-0 bg-slate-950"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold border border-purple-500/20 shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    {selectedProduct.name_ar || selectedProduct.name}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono block truncate">{selectedProduct.id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">الاسم بالعربية</span>
                  <span className="font-bold text-white">{selectedProduct.name_ar || selectedProduct.name}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">الاسم بالإنجليزية</span>
                  <span className="font-mono text-slate-300">{selectedProduct.name_en || '—'}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">القسم الرئيسي</span>
                  <span className="font-bold text-slate-200">
                    {selectedProduct.category
                      ? `${selectedProduct.category.icon || ''} ${selectedProduct.category.name_ar || selectedProduct.category.name}`
                      : selectedProduct.global_category_id}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">القسم الفرعي</span>
                  <span className="font-bold text-cyan-300">
                    {selectedProduct.subcategory_name_ar || selectedProduct.subcategory_id || '—'}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">الكمية والوحدة الافتراضية</span>
                  <span className="font-mono font-bold text-white">
                    {selectedProduct.default_quantity} {selectedProduct.default_unit}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">السعر التقديري</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {selectedProduct.estimated_price !== null && selectedProduct.estimated_price !== undefined
                      ? `${selectedProduct.estimated_price} ج.م`
                      : 'غير محدد'}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">ترتيب العرض</span>
                  <span className="font-mono text-slate-300">#{selectedProduct.sort_order ?? 0}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block mb-1">الحالة</span>
                  <span className={selectedProduct.is_active ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
                    {selectedProduct.is_active ? 'نشط ومفعل' : 'معطل'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center flex-wrap gap-2 shrink-0">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedProduct;
                    setSelectedProduct(null);
                    handleOpenEdit(p);
                  }}
                  className="flex-1 py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل المنتج</span>
                </button>
              )}
              {hasPermission('products.delete') && (
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedProduct;
                    setSelectedProduct(null);
                    setProductToDelete(p);
                  }}
                  className="py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. ADD / EDIT PRODUCT MODAL (Mobile Bottom Sheet / Desktop Modal)   */}
      {/* =================================================================== */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full border-t sm:border border-slate-800 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden text-right text-white animate-in slide-in-from-bottom-4 sm:zoom-in-95"
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
            </div>

            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-900/95">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {modalMode === 'create'
                  ? 'إضافة منتج جديد للكتالوج المركزي (global_products)'
                  : `تعديل المنتج: ${editingProduct?.name_ar}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                {/* Product Name AR & EN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">اسم المنتج بالعربية (name_ar) *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: حليب كامل الدسم 1 لتر"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">الاسم بالإنجليزية (name_en)</label>
                    <input
                      type="text"
                      placeholder="Full Cream Milk 1L"
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Main Category & Subcategory */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">القسم الرئيسي (global_category_id) *</label>
                    <select
                      required
                      value={globalCategoryId}
                      onChange={(e) => {
                        setGlobalCategoryId(e.target.value);
                        setSubcategoryId('');
                      }}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="" disabled>
                        اختر القسم الرئيسي...
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon_name || c.icon} {c.name_ar || c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">القسم الفرعي (subcategory_id)</label>
                    <select
                      value={subcategoryId}
                      onChange={(e) => setSubcategoryId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">بدون قسم فرعي محدد</option>
                      {formSubcategories.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.nameAr || sc.name_ar} ({sc.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Default Unit, Default Quantity, Estimated Price */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">الوحدة (default_unit)</label>
                    <select
                      value={defaultUnit}
                      onChange={(e) => setDefaultUnit(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="قطعة">قطعة</option>
                      <option value="كجم">كجم</option>
                      <option value="جرام">جرام</option>
                      <option value="لتر">لتر</option>
                      <option value="عبوة">عبوة</option>
                      <option value="علبة">علبة</option>
                      <option value="كرتونة">كرتونة</option>
                      <option value="كيس">كيس</option>
                      <option value="زجاجة">زجاجة</option>
                      <option value="ربطة">ربطة</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">الكمية (default_quantity)</label>
                    <input
                      type="text"
                      required
                      placeholder="1"
                      value={defaultQuantity}
                      onChange={(e) => setDefaultQuantity(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-emerald-400" />
                      <span>السعر التقديري (ج.م)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="اختياري"
                      value={estimatedPrice}
                      onChange={(e) => setEstimatedPrice(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-emerald-300 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Image URL */}
                <div>
                  <label className="font-bold text-slate-300 block mb-1 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>رابط صورة المنتج (image_url)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* ID, Sort Order, Is Active */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">المعرف (id)</label>
                    <input
                      type="text"
                      disabled={modalMode === 'edit'}
                      placeholder="تلقائي عند الترك فارغًا"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 disabled:opacity-60 rounded-xl font-mono text-[11px] text-purple-300"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">الترتيب (sort_order)</label>
                    <input
                      type="number"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white"
                    />
                  </div>

                  <div className="pt-2 sm:pt-4">
                    <label className="flex items-center space-x-2 space-x-reverse font-bold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-800"
                      />
                      <span>منتج مفعل ونشط</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sticky Actions Footer */}
              <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center space-x-2 space-x-reverse shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  إغلاق والعودة
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all shadow-md shadow-purple-600/30 cursor-pointer"
                >
                  {isSaving ? 'جاري الحفظ...' : modalMode === 'create' ? 'إضافة المنتج' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. DELETE MODAL (Mobile Bottom Sheet / Desktop Modal)               */}
      {/* =================================================================== */}
      {productToDelete && (
        <div
          onClick={() => {
            if (!isDeleting) setProductToDelete(null);
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

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-rose-400">حذف المنتج المركزي</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  هل أنت متأكد من حذف منتج{' '}
                  <strong className="text-white">"{productToDelete.name_ar || productToDelete.name}"</strong> من جدول{' '}
                  <code className="text-rose-300">global_products</code>؟
                </p>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center space-x-2 space-x-reverse shrink-0">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
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
