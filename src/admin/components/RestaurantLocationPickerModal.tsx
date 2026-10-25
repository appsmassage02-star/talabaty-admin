import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Check,
  X,
  Crosshair,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Compass,
  Layers,
} from 'lucide-react';

// Custom sharp SVG pin icon for restaurant location
const createRestaurantMapPin = () => {
  return L.divIcon({
    className: 'custom-restaurant-pin',
    html: `
      <div style="position: relative; width: 38px; height: 48px; transform: translate(-50%, -100%);">
        <svg viewBox="0 0 384 512" width="38" height="48" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.45));">
          <path fill="#f59e0b" stroke="#78350f" stroke-width="12" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
          <circle cx="192" cy="192" r="80" fill="#0f172a" />
          <circle cx="192" cy="192" r="48" fill="#fbbf24" />
        </svg>
        <span style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; background: rgba(0,0,0,0.5); border-radius: 50%; filter: blur(1px);"></span>
      </div>
    `,
    iconSize: [38, 48],
    iconAnchor: [19, 48],
  });
};

interface RestaurantLocationPickerModalProps {
  isOpen: boolean;
  initialLat?: number;
  initialLng?: number;
  restaurantName?: string;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

export const RestaurantLocationPickerModal: React.FC<RestaurantLocationPickerModalProps> = ({
  isOpen,
  initialLat,
  initialLng,
  restaurantName,
  onConfirm,
  onClose,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const hasInitialCoords =
    initialLat !== undefined &&
    initialLng !== undefined &&
    !isNaN(Number(initialLat)) &&
    !isNaN(Number(initialLng)) &&
    Number(initialLat) >= -90 &&
    Number(initialLat) <= 90 &&
    Number(initialLng) >= -180 &&
    Number(initialLng) <= 180;

  const [currentLat, setCurrentLat] = useState<number | null>(
    hasInitialCoords ? Number(initialLat) : null
  );
  const [currentLng, setCurrentLng] = useState<number | null>(
    hasInitialCoords ? Number(initialLng) : null
  );
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [tilesLoaded, setTilesLoaded] = useState(true);

  // Initialize or re-center map when modal opens
  useEffect(() => {
    if (!isOpen) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    // Small delay to ensure the modal DOM is rendered and dimensions are known
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Center on existing restaurant coordinates if available; otherwise general Egypt overview
      const defaultCenter: L.LatLngTuple = hasInitialCoords
        ? [Number(initialLat), Number(initialLng)]
        : [26.8206, 30.8025]; // Egypt center
      const defaultZoom = hasInitialCoords ? 16 : 6;

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: false,
      });
      mapInstanceRef.current = map;

      // Add OpenStreetMap tiles
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      tileLayer.on('tileerror', () => {
        setTilesLoaded(false);
      });

      const icon = createRestaurantMapPin();

      // If initial coordinates exist, place initial marker
      if (hasInitialCoords) {
        const marker = L.marker([Number(initialLat), Number(initialLng)], {
          icon,
          draggable: true,
        }).addTo(map);
        markerRef.current = marker;

        marker.on('drag', (e) => {
          const latLng = (e.target as L.Marker).getLatLng();
          setCurrentLat(parseFloat(latLng.lat.toFixed(6)));
          setCurrentLng(parseFloat(latLng.lng.toFixed(6)));
        });

        marker.on('dragend', (e) => {
          const latLng = (e.target as L.Marker).getLatLng();
          setCurrentLat(parseFloat(latLng.lat.toFixed(6)));
          setCurrentLng(parseFloat(latLng.lng.toFixed(6)));
        });
      }

      // Map click handler to place or move the marker
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const roundedLat = parseFloat(lat.toFixed(6));
        const roundedLng = parseFloat(lng.toFixed(6));

        setCurrentLat(roundedLat);
        setCurrentLng(roundedLng);

        if (markerRef.current) {
          markerRef.current.setLatLng([roundedLat, roundedLng]);
        } else {
          const newMarker = L.marker([roundedLat, roundedLng], {
            icon,
            draggable: true,
          }).addTo(map);
          markerRef.current = newMarker;

          newMarker.on('drag', (ev) => {
            const dragLatLng = (ev.target as L.Marker).getLatLng();
            setCurrentLat(parseFloat(dragLatLng.lat.toFixed(6)));
            setCurrentLng(parseFloat(dragLatLng.lng.toFixed(6)));
          });

          newMarker.on('dragend', (ev) => {
            const dragLatLng = (ev.target as L.Marker).getLatLng();
            setCurrentLat(parseFloat(dragLatLng.lat.toFixed(6)));
            setCurrentLng(parseFloat(dragLatLng.lng.toFixed(6)));
          });
        }
      });

      // Force recalculating map size after container is fully visible
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen, initialLat, initialLng, hasInitialCoords]);

  // GPS Locate Current Position button inside Map
  const handleLocateMeOnMap = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('متصفحك لا يدعم تحديد الموقع الجغرافي');
      return;
    }

    setIsLocatingUser(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setCurrentLat(lat);
        setCurrentLng(lng);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17, { animate: true });

          const icon = createRestaurantMapPin();
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            const newMarker = L.marker([lat, lng], {
              icon,
              draggable: true,
            }).addTo(mapInstanceRef.current);
            markerRef.current = newMarker;

            newMarker.on('drag', (ev) => {
              const dragLatLng = (ev.target as L.Marker).getLatLng();
              setCurrentLat(parseFloat(dragLatLng.lat.toFixed(6)));
              setCurrentLng(parseFloat(dragLatLng.lng.toFixed(6)));
            });

            newMarker.on('dragend', (ev) => {
              const dragLatLng = (ev.target as L.Marker).getLatLng();
              setCurrentLat(parseFloat(dragLatLng.lat.toFixed(6)));
              setCurrentLng(parseFloat(dragLatLng.lng.toFixed(6)));
            });
          }
        }
      },
      (err) => {
        setIsLocatingUser(false);
        let msg = 'تعذر الحصول على الموقع الجغرافي.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'تم رفض الإذن بالوصول إلى موقعك. يرجى تفعيل الصلاحية من إعدادات المتصفح أو تحريك الخريطة يدوياً.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'إشارة GPS غير متوفرة حالياً من جهازك.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'انتهت مهلة انتظار استجابة نظام GPS.';
        }
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }, []);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleConfirmLocation = () => {
    if (currentLat !== null && currentLng !== null) {
      onConfirm(currentLat, currentLng);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl h-[90vh] max-h-[750px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:px-6 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>تحديد موقع المطعم على الخريطة</span>
                {restaurantName && (
                  <span className="text-xs font-semibold text-slate-400">({restaurantName})</span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                انقر على أي نقطة لتثبيت الدبوس، أو اسحب الدبوس لتعديل الإحداثيات بدقة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map Container & Overlays */}
        <div className="relative flex-1 w-full bg-slate-950 overflow-hidden">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Controls (Zoom & My Location) */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleZoomIn}
              title="تكبير"
              className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 shadow-lg flex items-center justify-center transition cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="تصغير"
              className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 shadow-lg flex items-center justify-center transition cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleLocateMeOnMap}
              disabled={isLocatingUser}
              title="تحديد موقعي الحالي بالـ GPS"
              className="w-9 h-9 rounded-xl bg-amber-500/90 hover:bg-amber-400 border border-amber-600 text-slate-950 shadow-lg flex items-center justify-center transition cursor-pointer disabled:opacity-50"
            >
              <Crosshair className={`w-4 h-4 ${isLocatingUser ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Guidance / Tile Warning Overlay */}
          {!tilesLoaded && (
            <div className="absolute top-4 right-4 z-10 bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs px-3 py-2 rounded-xl flex items-center gap-2 max-w-sm">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>قد تتأخر استجابة بلاطات الخريطة بسبب الاتصال، ولكن يمكنك النقر وسحب الدبوس بشكل طبيعي.</span>
            </div>
          )}

          {gpsError && (
            <div className="absolute top-4 right-4 z-10 bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 max-w-md shadow-xl animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{gpsError}</span>
              <button
                type="button"
                onClick={() => setGpsError(null)}
                className="mr-auto text-rose-400 hover:text-rose-100 font-bold text-xs"
              >
                ×
              </button>
            </div>
          )}

          {/* Bottom Live Coordinates Ribbon */}
          <div className="absolute bottom-3 inset-x-3 z-10 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">الإحداثيات المحددة:</span>
                {currentLat !== null && currentLng !== null ? (
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    خط العرض: {currentLat.toFixed(6)} | خط الطول: {currentLng.toFixed(6)}
                  </span>
                ) : (
                  <span className="text-xs text-amber-300 font-medium">
                    لم يتم وضع الدبوس بعد. انقر على الخريطة لتحديد الموقع
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={currentLat === null || currentLng === null}
                onClick={handleConfirmLocation}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/20"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد هذا الموقع</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
