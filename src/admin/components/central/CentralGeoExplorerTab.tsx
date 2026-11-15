import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GeoArea,
  GeoCenter,
  GeoCenterAreaCount,
  GeoGovernorate,
  GeoGovernorateAreaCount,
} from '../../types';
import { centralGeoDeliveryService } from '../../services/centralGeoDeliveryService';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Info,
  MapPin,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';

interface CentralGeoExplorerTabProps {
  governorates: GeoGovernorate[];
  centers: GeoCenter[];
  govCounts: Map<string, GeoGovernorateAreaCount>;
  centerCounts: Map<string, GeoCenterAreaCount>;
  geoTotals: {
    totalGovernorates: number;
    activeGovernorates: number;
    totalCenters: number;
    activeCenters: number;
    totalAreas: number;
    activeAreas: number;
  };
  onRefresh: () => void;
  isLoadingBase: boolean;
}

const AREAS_PAGE_SIZE = 60;

export const CentralGeoExplorerTab: React.FC<CentralGeoExplorerTabProps> = ({
  governorates,
  centers,
  govCounts,
  centerCounts,
  geoTotals,
  onRefresh,
  isLoadingBase,
}) => {
  const [selectedGovId, setSelectedGovId] = useState<string>('');
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [govSearch, setGovSearch] = useState('');
  const [centerSearch, setCenterSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [areas, setAreas] = useState<GeoArea[]>([]);
  const [areasTotal, setAreasTotal] = useState<number>(0);
  const [areasPage, setAreasPage] = useState<number>(0);
  const [isLoadingAreas, setIsLoadingAreas] = useState<boolean>(false);
  const [areasError, setAreasError] = useState<string | null>(null);

  const selectedGov = useMemo(
    () => governorates.find((g) => g.id === selectedGovId) || null,
    [governorates, selectedGovId]
  );

  const selectedCenter = useMemo(
    () => centers.find((c) => c.id === selectedCenterId) || null,
    [centers, selectedCenterId]
  );

  const filteredGovernorates = useMemo(() => {
    const q = govSearch.trim().toLowerCase();
    return governorates.filter((g) => {
      if (activeFilter === 'active' && !g.is_active) return false;
      if (activeFilter === 'inactive' && g.is_active) return false;
      if (!q) return true;
      return (
        g.name_ar.toLowerCase().includes(q) ||
        (g.name_en || '').toLowerCase().includes(q) ||
        (g.code || '').toLowerCase().includes(q)
      );
    });
  }, [governorates, govSearch, activeFilter]);

  const filteredCenters = useMemo(() => {
    const q = centerSearch.trim().toLowerCase();
    return centers.filter((c) => {
      if (selectedGovId && c.governorate_id !== selectedGovId) return false;
      if (activeFilter === 'active' && !c.is_active) return false;
      if (activeFilter === 'inactive' && c.is_active) return false;
      if (!q) return true;
      return (
        c.name_ar.toLowerCase().includes(q) ||
        (c.name_en || '').toLowerCase().includes(q) ||
        (c.admin_unit_type || '').toLowerCase().includes(q)
      );
    });
  }, [centers, selectedGovId, centerSearch, activeFilter]);

  const loadAreasPage = useCallback(async () => {
    setIsLoadingAreas(true);
    setAreasError(null);
    try {
      const res = await centralGeoDeliveryService.getGeoAreasPage({
        governorateId: selectedGovId || undefined,
        centerId: selectedCenterId || undefined,
        search: areaSearch,
        activeFilter,
        limit: AREAS_PAGE_SIZE,
        offset: areasPage * AREAS_PAGE_SIZE,
      });
      if (res.error) {
        setAreasError(res.error);
        setAreas([]);
        setAreasTotal(0);
      } else {
        setAreas(res.areas);
        setAreasTotal(res.total);
      }
    } finally {
      setIsLoadingAreas(false);
    }
  }, [selectedGovId, selectedCenterId, areaSearch, activeFilter, areasPage]);

  useEffect(() => {
    loadAreasPage();
  }, [loadAreasPage]);

  // Reset center & page when governorate changes
  const handleSelectGov = (govId: string) => {
    setSelectedGovId((prev) => (prev === govId ? '' : govId));
    setSelectedCenterId('');
    setAreasPage(0);
  };

  const handleSelectCenter = (center: GeoCenter) => {
    setSelectedGovId(center.governorate_id);
    setSelectedCenterId((prev) => (prev === center.id ? '' : center.id));
    setAreasPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(areasTotal / AREAS_PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header & Read-Only Scope Policy */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white">
              الهرم الجغرافي المعتمد (مصر ← المحافظة ← المركز/القسم ← المنطقة)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              مصدر حصري من جداول <span className="font-mono text-sky-300">geo_governorates</span> و{' '}
              <span className="font-mono text-sky-300">geo_centers</span> و{' '}
              <span className="font-mono text-sky-300">geo_areas</span>. القراءة والفحص بدون إنشاء أو تعديل مباشر على الجداول الجغرافية في هذه المرحلة.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value as 'all' | 'active' | 'inactive');
              setAreasPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="all">كل السجلات الجغرافية</option>
            <option value="active">المفعلة فقط (is_active = true)</option>
            <option value="inactive">غير المفعلة فقط (is_active = false)</option>
          </select>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoadingBase}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isLoadingBase ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Live Hierarchy Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">المحافظات (geo_governorates)</span>
            <span className="text-xl font-black text-white font-mono">
              {geoTotals.totalGovernorates}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
            مفعل: {geoTotals.activeGovernorates}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">المراكز والأقسام (geo_centers)</span>
            <span className="text-xl font-black text-white font-mono">{geoTotals.totalCenters}</span>
          </div>
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
            مفعل: {geoTotals.activeCenters}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">المناطق والشياخات والقرى (geo_areas)</span>
            <span className="text-xl font-black text-white font-mono">{geoTotals.totalAreas}</span>
          </div>
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
            مفعل: {geoTotals.activeAreas}
          </span>
        </div>
      </div>

      {/* Breadcrumb Bar */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            setSelectedGovId('');
            setSelectedCenterId('');
            setAreasPage(0);
          }}
          className="font-bold text-emerald-400 hover:underline cursor-pointer"
        >
          مصر (كامل الجمهورية)
        </button>
        {selectedGov && (
          <>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
            <button
              type="button"
              onClick={() => {
                setSelectedCenterId('');
                setAreasPage(0);
              }}
              className="font-bold text-white hover:text-emerald-300 cursor-pointer"
            >
              {selectedGov.name_ar}
            </button>
          </>
        )}
        {selectedCenter && (
          <>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-bold text-sky-300">{selectedCenter.name_ar}</span>
          </>
        )}
      </div>

      {/* Three-Column Interactive Hierarchy Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Column 1: Governorates */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col h-[520px]">
          <div className="space-y-2.5 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white">1. المحافظات ({filteredGovernorates.length})</h4>
              {selectedGovId && (
                <button
                  type="button"
                  onClick={() => handleSelectGov(selectedGovId)}
                  className="text-[11px] text-rose-300 hover:underline cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={govSearch}
                onChange={(e) => setGovSearch(e.target.value)}
                placeholder="بحث في المحافظات..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-2.5 space-y-1.5 pr-0.5">
            {filteredGovernorates.map((g) => {
              const count = govCounts.get(g.id);
              const isSelected = g.id === selectedGovId;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleSelectGov(g.id)}
                  className={`w-full text-right p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/50'
                      : 'bg-slate-950/60 border-slate-800/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-white truncate">{g.name_ar}</span>
                    {g.is_active ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                    <span className="font-mono">{g.code || g.id.slice(0, 8)}</span>
                    <span>
                      {count ? `${count.total_centers} مركز · ${count.total_areas} منطقة` : '—'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Centers */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col h-[520px]">
          <div className="space-y-2.5 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white">2. المراكز والأقسام ({filteredCenters.length})</h4>
              {selectedCenterId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCenterId('');
                    setAreasPage(0);
                  }}
                  className="text-[11px] text-rose-300 hover:underline cursor-pointer"
                >
                  عرض الكل
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={centerSearch}
                onChange={(e) => setCenterSearch(e.target.value)}
                placeholder="بحث في المراكز والأقسام..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-2.5 space-y-1.5 pr-0.5">
            {filteredCenters.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">لا توجد مراكز مطابقة</div>
            ) : (
              filteredCenters.map((c) => {
                const count = centerCounts.get(c.id);
                const isSelected = c.id === selectedCenterId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCenter(c)}
                    className={`w-full text-right p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-500/50'
                        : 'bg-slate-950/60 border-slate-800/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-white truncate">{c.name_ar}</span>
                      {c.is_active ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                      <span className="font-mono">{c.admin_unit_type || 'center'}</span>
                      <span>
                        {count
                          ? `${count.total_areas} منطقة (${count.active_areas} مفعل)`
                          : '0 منطقة'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Areas (Paginated from 5,716+ rows) */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col h-[520px]">
          <div className="space-y-2.5 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>3. المناطق ({areasTotal})</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">
                صفحة {areasPage + 1} / {totalPages}
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={areaSearch}
                onChange={(e) => {
                  setAreaSearch(e.target.value);
                  setAreasPage(0);
                }}
                placeholder="بحث بالاسم العربي أو الإنجليزي..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-2.5 space-y-1.5 pr-0.5">
            {areasError ? (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-xs text-rose-300">
                {areasError}
              </div>
            ) : isLoadingAreas ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                <span>جاري تحميل المناطق...</span>
              </div>
            ) : areas.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">لا توجد مناطق مطابقة للبحث</div>
            ) : (
              areas.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/70 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-white truncate">{a.name_ar}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        a.is_active
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {a.is_active ? 'مفعلة' : 'مستبعدة'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-mono">{a.admin_unit_type || 'area'} · {a.classification_status || '—'}</span>
                    <span className="font-mono text-slate-500">{a.id.slice(0, 8)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination Footer */}
          <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={areasPage <= 0 || isLoadingAreas}
              onClick={() => setAreasPage((p) => Math.max(0, p - 1))}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" /> السابق
            </button>
            <span className="text-[11px] font-mono text-slate-400">
              {areas.length} من {areasTotal}
            </span>
            <button
              type="button"
              disabled={areasPage + 1 >= totalPages || isLoadingAreas}
              onClick={() => setAreasPage((p) => p + 1)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              التالي <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-2.5 text-xs text-slate-400">
        <Info className="w-4 h-4 text-sky-400 shrink-0" />
        <span>
          جميع المعرفات في التبويب تستند إلى UUID الفعلي داخل جداول <span className="font-mono text-slate-200">geo_*</span> وتُستبعد السجلات غير المفعلة (<span className="font-mono">is_active = false</span>) تلقائياً من قوائم تفعيل التوصيل والتسعير.
        </span>
      </div>
    </div>
  );
};
