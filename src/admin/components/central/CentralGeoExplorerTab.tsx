import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DeliverySystemSettings,
  GeoArea,
  GeoCenter,
  GeoCenterAreaCount,
  GeoGovernorate,
  GeoGovernorateAreaCount,
  GeoJsonGeometry,
} from '../../types';
import { centralGeoDeliveryService } from '../../services/centralGeoDeliveryService';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Globe,
  Info,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
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
  deliverySystemSettings: DeliverySystemSettings | null;
  deliverySystemSettingsError?: string | null;
  onRefresh: () => void;
  isLoadingBase: boolean;
}

const AREAS_PAGE_SIZE = 60;

function isSohagGov(g: GeoGovernorate): boolean {
  const code = (g.code || '').toUpperCase();
  const ar = g.name_ar || '';
  const en = (g.name_en || '').toLowerCase();
  return code === 'SHG' || ar.includes('سوهاج') || en.includes('sohag');
}

/** Extract closed coordinate rings ([lng, lat][]) from GeoJSON Polygon or MultiPolygon */
function extractOuterAndInnerRings(geometry?: GeoJsonGeometry | null): number[][][] {
  if (!geometry || !geometry.coordinates) return [];
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][];
    return Array.isArray(coords) ? coords : [];
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as number[][][][];
    if (!Array.isArray(polys)) return [];
    const allRings: number[][][] = [];
    for (const poly of polys) {
      if (Array.isArray(poly)) {
        for (const ring of poly) {
          if (Array.isArray(ring)) allRings.push(ring);
        }
      }
    }
    return allRings;
  }
  return [];
}

function buildSvgPathFromGeometry(
  geometry: GeoJsonGeometry | null | undefined,
  project: (lng: number, lat: number) => [number, number]
): string {
  const rings = extractOuterAndInnerRings(geometry);
  if (rings.length === 0) return '';
  const parts: string[] = [];
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 3) continue;
    const cmds: string[] = [];
    for (let i = 0; i < ring.length; i++) {
      const pt = ring[i];
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const [x, y] = project(Number(pt[0]), Number(pt[1]));
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      cmds.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    if (cmds.length > 2) {
      parts.push(`${cmds.join(' ')} Z`);
    }
  }
  return parts.join(' ');
}

export const CentralGeoExplorerTab: React.FC<CentralGeoExplorerTabProps> = ({
  governorates,
  centers,
  govCounts,
  centerCounts,
  geoTotals,
  deliverySystemSettings,
  deliverySystemSettingsError,
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

  // Real GeoJSON boundary state for selected governorate
  const [boundaryGov, setBoundaryGov] = useState<GeoGovernorate | null>(null);
  const [boundaryCenters, setBoundaryCenters] = useState<GeoCenter[]>([]);
  const [boundaryAreas, setBoundaryAreas] = useState<GeoArea[]>([]);
  const [boundariesLoading, setBoundariesLoading] = useState<boolean>(false);
  const [boundariesError, setBoundariesError] = useState<string | null>(null);
  const [hoveredBoundaryLabel, setHoveredBoundaryLabel] = useState<{
    name: string;
    kind: 'center' | 'area';
    isActive: boolean;
    hasBoundary: boolean;
    source?: string | null;
  } | null>(null);

  const hasAutoSelectedSohagRef = useRef(false);

  const sohagGov = useMemo(() => governorates.find(isSohagGov) || null, [governorates]);

  // Focus on Sohag by default once governorates load
  useEffect(() => {
    if (!hasAutoSelectedSohagRef.current && governorates.length > 0 && !selectedGovId) {
      hasAutoSelectedSohagRef.current = true;
      if (sohagGov) {
        setSelectedGovId(sohagGov.id);
      }
    }
  }, [governorates, sohagGov, selectedGovId]);

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
    return [...governorates]
      .sort((a, b) => {
        const aS = isSohagGov(a) ? 0 : 1;
        const bS = isSohagGov(b) ? 0 : 1;
        if (aS !== bS) return aS - bS;
        return (a.sort_order ?? 9999) - (b.sort_order ?? 9999);
      })
      .filter((g) => {
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

  // Load paginated area list
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

  // Load real GeoJSON boundary geometries for the selected governorate
  useEffect(() => {
    let cancelled = false;
    if (!selectedGovId) {
      setBoundaryGov(null);
      setBoundaryCenters([]);
      setBoundaryAreas([]);
      setBoundariesError(null);
      return;
    }
    setBoundariesLoading(true);
    setBoundariesError(null);
    centralGeoDeliveryService
      .getGeoBoundariesForGovernorate(selectedGovId)
      .then((res) => {
        if (cancelled) return;
        setBoundaryGov(res.governorate);
        setBoundaryCenters(res.centers);
        setBoundaryAreas(res.areas);
        setBoundariesError(res.error || null);
      })
      .finally(() => {
        if (!cancelled) setBoundariesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGovId]);

  const boundaryStats = useMemo(() => {
    const centersWithBoundary = boundaryCenters.filter((c) => Boolean(c.boundary)).length;
    const areasWithBoundary = boundaryAreas.filter((a) => Boolean(a.boundary)).length;
    const centerMap = new Map<string, boolean>();
    boundaryCenters.forEach((c) => centerMap.set(c.id, Boolean(c.boundary)));
    const areaMap = new Map<string, GeoArea>();
    boundaryAreas.forEach((a) => areaMap.set(a.id, a));

    const selectedCenterAreas = selectedCenterId
      ? boundaryAreas.filter((a) => a.center_id === selectedCenterId)
      : [];
    const selectedCenterAreasWithBoundary = selectedCenterAreas.filter((a) => Boolean(a.boundary)).length;

    return {
      govHasBoundary: Boolean(boundaryGov?.boundary),
      centersTotal: boundaryCenters.length,
      centersWithBoundary,
      areasTotal: boundaryAreas.length,
      areasWithBoundary,
      selectedCenterAreas,
      selectedCenterAreasWithBoundary,
      centerHasBoundaryMap: centerMap,
      boundaryAreaById: areaMap,
    };
  }, [boundaryGov, boundaryCenters, boundaryAreas, selectedCenterId]);

  // Compute SVG viewport projection from real GeoJSON geometries (no invented polygons)
  const svgMapData = useMemo(() => {
    const viewW = 720;
    const viewH = 420;
    const pad = 22;

    const displayedAreas = selectedCenterId
      ? boundaryAreas.filter((a) => a.center_id === selectedCenterId && Boolean(a.boundary))
      : [];

    const geometriesToFit: GeoJsonGeometry[] = [];
    if (selectedCenterId && displayedAreas.length > 0) {
      displayedAreas.forEach((a) => {
        if (a.boundary) geometriesToFit.push(a.boundary);
      });
      const selCenterGeo = boundaryCenters.find((c) => c.id === selectedCenterId)?.boundary;
      if (selCenterGeo) geometriesToFit.push(selCenterGeo);
    } else {
      if (boundaryGov?.boundary) geometriesToFit.push(boundaryGov.boundary);
      boundaryCenters.forEach((c) => {
        if (c.boundary) geometriesToFit.push(c.boundary);
      });
    }

    if (geometriesToFit.length === 0) {
      return null;
    }

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const g of geometriesToFit) {
      const rings = extractOuterAndInnerRings(g);
      for (const ring of rings) {
        for (const pt of ring) {
          if (!Array.isArray(pt) || pt.length < 2) continue;
          const lng = Number(pt[0]);
          const lat = Number(pt[1]);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }

    if (!Number.isFinite(minLng) || maxLng <= minLng || maxLat <= minLat) {
      return null;
    }

    const midLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos((midLat * Math.PI) / 180) || 1;
    const spanX = (maxLng - minLng) * cosLat;
    const spanY = maxLat - minLat;

    const innerW = viewW - pad * 2;
    const innerH = viewH - pad * 2;
    const scale = Math.min(innerW / spanX, innerH / spanY);
    const offsetX = pad + (innerW - spanX * scale) / 2;
    const offsetY = pad + (innerH - spanY * scale) / 2;

    const project = (lng: number, lat: number): [number, number] => {
      const x = offsetX + (lng - minLng) * cosLat * scale;
      const y = offsetY + (maxLat - lat) * scale;
      return [x, y];
    };

    const govPath = boundaryGov?.boundary
      ? buildSvgPathFromGeometry(boundaryGov.boundary, project)
      : '';

    const centerPaths = boundaryCenters
      .map((c) => ({
        center: c,
        d: buildSvgPathFromGeometry(c.boundary, project),
      }))
      .filter((item) => Boolean(item.d));

    const areaPaths = displayedAreas
      .map((a) => ({
        area: a,
        d: buildSvgPathFromGeometry(a.boundary, project),
      }))
      .filter((item) => Boolean(item.d));

    return {
      viewW,
      viewH,
      govPath,
      centerPaths,
      areaPaths,
    };
  }, [boundaryGov, boundaryCenters, boundaryAreas, selectedCenterId]);

  // Reset center & page when governorate changes
  const handleSelectGov = (govId: string) => {
    setSelectedGovId((prev) => (prev === govId ? '' : govId));
    setSelectedCenterId('');
    setHoveredBoundaryLabel(null);
    setAreasPage(0);
  };

  const handleSelectCenter = (center: GeoCenter) => {
    setSelectedGovId(center.governorate_id);
    setSelectedCenterId((prev) => (prev === center.id ? '' : center.id));
    setHoveredBoundaryLabel(null);
    setAreasPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(areasTotal / AREAS_PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header & Sohag Launch Scope Policy */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white">
                الهرم الجغرافي المعتمد والحدود الحقيقية (GeoJSON)
              </h3>
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-300">
                نطاق الإطلاق الحالي: محافظة سوهاج فقط
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              مصدر حصري من جداول <span className="font-mono text-sky-300">geo_governorates</span> و{' '}
              <span className="font-mono text-sky-300">geo_centers</span> و{' '}
              <span className="font-mono text-sky-300">geo_areas</span> والحدود المحفوظة في عمود{' '}
              <span className="font-mono text-emerald-300">boundary</span> (دون توليد أي حدود وهمية).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {sohagGov && selectedGovId !== sohagGov.id && (
            <button
              type="button"
              onClick={() => {
                setSelectedGovId(sohagGov.id);
                setSelectedCenterId('');
                setAreasPage(0);
              }}
              className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>التركيز على سوهاج</span>
            </button>
          )}
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

      {/* Truthful GPS & Geofencing System Settings Card (delivery_system_settings) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs sm:text-sm font-black text-white">
              إعدادات GPS والتحقق الجغرافي في قاعدة البيانات (delivery_system_settings)
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {deliverySystemSettings?.updated_at
              ? `آخر تحديث: ${new Date(deliverySystemSettings.updated_at).toLocaleString('ar-EG')}`
              : 'قراءة حية مباشرة دون افتراض قيم'}
          </span>
        </div>

        {deliverySystemSettingsError || !deliverySystemSettings ? (
          <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/35 text-xs text-amber-200 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">تعذر قراءة إعدادات GPS من قاعدة البيانات للجلسة الحالية</span>
              <span className="font-mono text-[11px] text-amber-300/90 block break-words">
                {deliverySystemSettingsError || 'لا توجد بيانات متاحة'}
              </span>
              <span className="text-[11px] text-slate-300 block">
                لا يتم عرض أي قيم افتراضية أو مفعّلة كاذبة عند حجب الصلاحية (RLS 42501) أو غياب السجل.
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-slate-300 font-bold">إلزام GPS للطلبات الجديدة</span>
              <span
                className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold border ${
                  deliverySystemSettings.gps_required_for_new_orders
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {deliverySystemSettings.gps_required_for_new_orders === null
                  ? 'غير محدد'
                  : deliverySystemSettings.gps_required_for_new_orders
                  ? 'true (مفعّل)'
                  : 'false (معطّل)'}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-slate-300 font-bold">تطبيق السياج الجغرافي</span>
              <span
                className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold border ${
                  deliverySystemSettings.geofence_enforcement_enabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {deliverySystemSettings.geofence_enforcement_enabled === null
                  ? 'غير محدد'
                  : deliverySystemSettings.geofence_enforcement_enabled
                  ? 'true (مفعّل)'
                  : 'false (معطّل)'}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-slate-300 font-bold">تتبع السائقين المباشر</span>
              <span
                className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold border ${
                  deliverySystemSettings.driver_tracking_enabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {deliverySystemSettings.driver_tracking_enabled === null
                  ? 'غير محدد'
                  : deliverySystemSettings.driver_tracking_enabled
                  ? 'true (مفعّل)'
                  : 'false (معطّل)'}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-slate-300 font-bold">أقصى دقة GPS مقبولة</span>
              <span className="px-2 py-0.5 rounded-lg font-mono tabular-nums text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                {deliverySystemSettings.max_accepted_gps_accuracy_m !== null
                  ? `${deliverySystemSettings.max_accepted_gps_accuracy_m} م`
                  : 'غير محدد'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Live Hierarchy Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">المحافظات (geo_governorates)</span>
            <span className="text-xl font-black text-white font-mono tabular-nums">
              {geoTotals.totalGovernorates}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono tabular-nums">
            مفعل: {geoTotals.activeGovernorates}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">المراكز والأقسام (geo_centers)</span>
            <span className="text-xl font-black text-white font-mono tabular-nums">
              {geoTotals.totalCenters}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono tabular-nums">
            مفعل: {geoTotals.activeCenters}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">المناطق والشياخات والقرى (geo_areas)</span>
            <span className="text-xl font-black text-white font-mono tabular-nums">
              {geoTotals.totalAreas}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono tabular-nums">
            مفعل: {geoTotals.activeAreas}
          </span>
        </div>
      </div>

      {/* Real GeoJSON Boundary Viewer Panel */}
      {selectedGov && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-start gap-2.5">
              <Layers className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-black text-white">
                  خريطة الحدود الجغرافية الحقيقية (GeoJSON): {selectedGov.name_ar}
                  {selectedCenter ? ` › ${selectedCenter.name_ar}` : ''}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  عرض المضلعات المحفوظة فعلياً في عمود <span className="font-mono text-slate-200">boundary</span>. النقر على أي مركز يعرض حدود مناطقه/قراه. المناطق التي لا تملك حدوداً يظل تغليف التوصيل والتسعير لها عاملاً عبر <span className="font-mono text-emerald-300">UUID</span>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
              <span
                className={`px-2.5 py-1 rounded-xl border font-bold ${
                  boundaryStats.govHasBoundary
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                حدود المحافظة: {boundaryStats.govHasBoundary ? 'محفوظة' : 'لا توجد حدود GPS محفوظة'}
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-sky-300 font-bold">
                مراكز بحدود: {boundaryStats.centersWithBoundary} / {boundaryStats.centersTotal}
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-bold">
                مناطق بحدود:{' '}
                {selectedCenterId
                  ? `${boundaryStats.selectedCenterAreasWithBoundary} / ${boundaryStats.selectedCenterAreas.length}`
                  : `${boundaryStats.areasWithBoundary} / ${boundaryStats.areasTotal}`}
              </span>
            </div>
          </div>

          {boundariesError && (
            <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/35 text-xs text-rose-200 font-mono">
              {boundariesError}
            </div>
          )}

          {boundariesLoading ? (
            <div className="py-14 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
              <span>جاري تحميل حدود GeoJSON الحقيقية من قاعدة البيانات...</span>
            </div>
          ) : !svgMapData ? (
            <div className="py-10 px-4 text-center rounded-2xl bg-slate-950/70 border border-amber-500/30 space-y-1.5">
              <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
              <div className="text-xs font-bold text-amber-300">لا توجد حدود GPS محفوظة لهذه المحافظة/المركز</div>
              <p className="text-[11px] text-slate-400 max-w-lg mx-auto">
                عمود <span className="font-mono">boundary</span> فارغ (NULL) حالياً لهذا النطاق؛ تظل عمليات التسعير وتغطية المندوبين عبر معرفات UUID عاملة دون أي تعطيل.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-8 bg-slate-950/90 border border-slate-800 rounded-2xl p-3 relative overflow-hidden">
                <svg
                  viewBox={`0 0 ${svgMapData.viewW} ${svgMapData.viewH}`}
                  className="w-full h-[300px] sm:h-[360px]"
                  role="img"
                  aria-label={`خريطة حدود ${selectedGov.name_ar}`}
                >
                  {svgMapData.govPath && (
                    <path
                      d={svgMapData.govPath}
                      fill="rgba(14, 165, 233, 0.05)"
                      stroke="rgba(56, 189, 248, 0.45)"
                      strokeWidth={1.5}
                    />
                  )}

                  {svgMapData.centerPaths.map(({ center, d }) => {
                    const isSel = center.id === selectedCenterId;
                    return (
                      <path
                        key={center.id}
                        d={d}
                        onClick={() => handleSelectCenter(center)}
                        onMouseEnter={() =>
                          setHoveredBoundaryLabel({
                            name: center.name_ar,
                            kind: 'center',
                            isActive: center.is_active,
                            hasBoundary: true,
                            source: center.boundary_source,
                          })
                        }
                        fill={
                          isSel
                            ? 'rgba(245, 158, 11, 0.16)'
                            : selectedCenterId
                            ? 'rgba(15, 23, 42, 0.15)'
                            : 'rgba(16, 185, 129, 0.12)'
                        }
                        stroke={
                          isSel
                            ? '#fbbf24'
                            : center.is_active
                            ? 'rgba(16, 185, 129, 0.7)'
                            : 'rgba(244, 63, 94, 0.55)'
                        }
                        strokeWidth={isSel ? 2.2 : 1}
                        className="cursor-pointer transition-opacity hover:opacity-90"
                      />
                    );
                  })}

                  {svgMapData.areaPaths.map(({ area, d }) => (
                    <path
                      key={area.id}
                      d={d}
                      onMouseEnter={() =>
                        setHoveredBoundaryLabel({
                          name: area.name_ar,
                          kind: 'area',
                          isActive: area.is_active,
                          hasBoundary: true,
                          source: area.boundary_source,
                        })
                      }
                      fill={
                        area.is_active ? 'rgba(16, 185, 129, 0.28)' : 'rgba(244, 63, 94, 0.25)'
                      }
                      stroke={
                        area.is_active ? 'rgba(52, 211, 153, 0.95)' : 'rgba(251, 113, 133, 0.85)'
                      }
                      strokeWidth={1.1}
                      className="cursor-pointer transition-opacity hover:opacity-100"
                    />
                  ))}
                </svg>

                {hoveredBoundaryLabel && (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-900/95 border border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-sky-300 font-bold text-[10px]">
                        {hoveredBoundaryLabel.kind === 'center' ? 'مركز / قسم' : 'منطقة / قرية'}
                      </span>
                      <span className="font-bold text-white">{hoveredBoundaryLabel.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      {hoveredBoundaryLabel.source && (
                        <span className="text-slate-400">{hoveredBoundaryLabel.source}</span>
                      )}
                      <span
                        className={
                          hoveredBoundaryLabel.isActive ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {hoveredBoundaryLabel.isActive ? 'is_active = true' : 'is_active = false'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Map Legend & Boundary Gaps Summary */}
              <div className="lg:col-span-4 space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="font-bold text-white">دليل قراءة الحدود</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-400 shrink-0" />
                    <span>نطاق مفعل بحدود GeoJSON حقيقية</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-400 shrink-0" />
                    <span>المركز/القسم المختار حالياً</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="w-3 h-3 rounded-sm bg-rose-500/25 border border-rose-400 shrink-0" />
                    <span>سجل مستبعد (is_active = false)</span>
                  </div>
                </div>

                {selectedCenter && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="font-bold text-white">
                      حالة الحدود داخل مركز {selectedCenter.name_ar}
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono tabular-nums">
                      مناطق لها حدود: {boundaryStats.selectedCenterAreasWithBoundary} من{' '}
                      {boundaryStats.selectedCenterAreas.length}
                    </div>
                    {boundaryStats.selectedCenterAreasWithBoundary <
                      boundaryStats.selectedCenterAreas.length && (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                        توجد مناطق بدون حدود GPS محفوظة في هذا المركز؛ يتم تمييزها صراحةً في القائمة أدناه وتظل قابلة للتسعير والتوصيل عبر UUID.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
              const isSohag = isSohagGov(g);
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-xs text-white truncate">{g.name_ar}</span>
                      {isSohag && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold shrink-0">
                          نطاق الإطلاق
                        </span>
                      )}
                    </div>
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
                const knownBoundary = boundaryStats.centerHasBoundaryMap.get(c.id);
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        {selectedGovId && knownBoundary === false && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                            لا توجد حدود GPS محفوظة
                          </span>
                        )}
                        {c.is_active ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                      </div>
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

        {/* Column 3: Areas */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col h-[520px]">
          <div className="space-y-2.5 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>3. المناطق ({areasTotal})</span>
              </h4>
              <span className="text-[10px] font-mono tabular-nums text-slate-400">
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
              areas.map((a) => {
                const boundaryMatch = boundaryStats.boundaryAreaById.get(a.id);
                const hasBoundaryInfo = Boolean(boundaryMatch);
                const hasPolygon = Boolean(boundaryMatch?.boundary);
                return (
                  <div
                    key={a.id}
                    className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/70 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-white truncate">{a.name_ar}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          a.is_active
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {a.is_active ? 'مفعلة' : 'مستبعدة'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                      <span className="font-mono">
                        {a.admin_unit_type || 'area'} · {a.classification_status || '—'}
                      </span>
                      {selectedGovId && hasBoundaryInfo && !boundariesLoading && (
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            hasPolygon
                              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {hasPolygon ? 'حدود GPS محفوظة' : 'لا توجد حدود GPS محفوظة'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
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
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
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
