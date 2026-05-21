import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, Compass, Stethoscope } from 'lucide-react';
import { api } from '../api/client.js';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

// Fix default marker icons (Leaflet + Vite)
import marker from 'leaflet/dist/images/marker-icon.png';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';
L.Icon.Default.mergeOptions({
  iconUrl: marker,
  iconRetinaUrl: marker2x,
  shadowUrl: shadow,
});

const KAKUMA = [3.7172, 34.8689];

export default function Clinics() {
  useDocumentTitle('Find a clinic');
  const { t } = useTranslation();
  const [center, setCenter] = useState(KAKUMA);
  const [search, setSearch] = useState('');
  const [service, setService] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { timeout: 4000 }
    );
  }, []);

  const { data: clinics, isLoading } = useQuery({
    queryKey: ['clinics'],
    queryFn: () => api.get('/clinics').then((r) => r.data.clinics),
  });

  const allServices = useMemo(() => {
    const set = new Set();
    (clinics || []).forEach((c) => (c.services || []).forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [clinics]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clinics || []).filter((c) => {
      const matchesText =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q) ||
        (c.services || []).some((s) => s.toLowerCase().includes(q));
      const matchesService = !service || (c.services || []).includes(service);
      return matchesText && matchesService;
    });
  }, [clinics, search, service]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">
          {t('clinics.title')}
        </h1>
        <div className="text-sm text-neutral-600 dark:text-slate-400">
          {filtered.length} of {clinics?.length || 0} clinics
        </div>
      </div>

      {/* Search + filter */}
      <div className="card-flat flex flex-col md:flex-row gap-3">
        <label className="flex-1">
          <span className="sr-only">Search clinics</span>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search by name, address or service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </label>
        <label className="md:w-72">
          <span className="sr-only">Filter by service</span>
          <div className="relative">
            <Stethoscope size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <select
              className="input pl-9"
              value={service}
              onChange={(e) => setService(e.target.value)}
            >
              <option value="">All services</option>
              {allServices.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="h-[55vh] min-h-[320px] w-full">
          <MapContainer center={center} zoom={11} className="h-full w-full">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered?.map((c) => {
              const [lng, lat] = c.location?.coordinates || [];
              if (lng == null) return null;
              return (
                <Marker key={c._id} position={[lat, lng]}>
                  <Popup>
                    <div className="font-semibold text-primary">{c.name}</div>
                    <div className="text-xs">{c.address}</div>
                    <div className="text-xs mt-1">{t('clinics.open', { hours: c.hours })}</div>
                    <a
                      className="text-primary underline text-xs"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.openstreetmap.org/directions?from=&to=${lat}%2C${lng}`}
                    >
                      {t('clinics.directions')}
                    </a>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card">
                <Skeleton className="h-5 w-1/3 mb-2" />
                <Skeleton className="h-3 w-2/3 mb-3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </>
        )}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            icon={MapPin}
            title="No clinics match your search"
            body="Try a different keyword or clear the service filter."
            action={
              <button
                onClick={() => { setSearch(''); setService(''); }}
                className="btn-outline text-sm"
              >
                Clear filters
              </button>
            }
          />
        )}
        {filtered?.map((c) => {
          const [lng, lat] = c.location?.coordinates || [];
          return (
            <div key={c._id} className="card">
              <div className="font-bold text-primary dark:text-accent">{c.name}</div>
              <div className="text-sm text-neutral-700 dark:text-slate-300 mb-2">{c.address}</div>
              <div className="text-xs text-neutral-600 dark:text-slate-400 mb-3">
                {t('clinics.services')}: {c.services?.join(', ')}
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  className="btn-outline text-sm"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.openstreetmap.org/directions?from=&to=${lat}%2C${lng}`}
                >
                  <Compass size={14} /> {t('clinics.directions')}
                </a>
                <Link to="/book" className="btn-primary text-sm">
                  Book here
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
