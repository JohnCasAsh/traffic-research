import { useEffect, useRef, useState } from 'react';
import { Shield, Users, LogIn, RefreshCw, Clock, Wifi, Ban, Trash2, CheckCircle, ShieldCheck, FlaskConical, MapPin, ParkingSquare, Plus, X, Pencil, Fuel, Image } from 'lucide-react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { useAuth } from '../auth';
import { API_URL, buildAuthHeaders } from '../api';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const TUGUEGARAO = { lat: 17.6128, lng: 121.7270 };

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email_verified: boolean;
  banned: boolean;
  created_at: string | null;
  auth_providers: string[];
};

type LoginRow = {
  id: string;
  user_id: string | null;
  action: string;
  ip_address: string | null;
  created_at: string | null;
  user: { firstName: string; lastName: string; role: string } | null;
};

type ParkingRow = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  notes: string;
  fare_normal: number | null;
  fare_discounted: number | null;
  photo: string | null;
  added_at: string | null;
};

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 640;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PARKING_TYPES: { value: string; label: string }[] = [
  { value: 'mall', label: 'Mall Parking' },
  { value: 'street', label: 'Street Parking' },
  { value: 'jeepney_terminal', label: 'Jeepney Terminal' },
  { value: 'tricycle_terminal', label: 'Tricycle Terminal' },
  { value: 'public', label: 'Public Parking' },
  { value: 'church', label: 'Church Parking' },
  { value: 'school', label: 'School Parking' },
  { value: 'gas_station', label: 'Gas Station' },
  { value: 'other', label: 'Other' },
];

const TYPE_COLORS: Record<string, string> = {
  mall: 'bg-blue-100 text-blue-700',
  street: 'bg-slate-100 text-slate-700',
  jeepney_terminal: 'bg-orange-100 text-orange-700',
  tricycle_terminal: 'bg-amber-100 text-amber-700',
  public: 'bg-teal-100 text-teal-700',
  church: 'bg-purple-100 text-purple-700',
  school: 'bg-green-100 text-green-700',
  gas_station: 'bg-green-100 text-green-700',
  other: 'bg-slate-100 text-slate-500',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AdminPage() {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'logins' | 'parking'>('logins');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);

  // Parking state
  const [parking, setParking] = useState<ParkingRow[]>([]);
  const [parkingLoading, setParkingLoading] = useState(false);
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  const [parkingName, setParkingName] = useState('');
  const [parkingType, setParkingType] = useState('mall');
  const [parkingNotes, setParkingNotes] = useState('');
  const [fareNormal, setFareNormal] = useState('');
  const [fareDiscounted, setFareDiscounted] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const [editTarget, setEditTarget] = useState<ParkingRow | null>(null);
  const [savingParking, setSavingParking] = useState(false);
  const [parkingError, setParkingError] = useState('');
  const [confirmDeleteParking, setConfirmDeleteParking] = useState<ParkingRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pinMarkerRef = useRef<google.maps.Marker | null>(null);
  const parkingMarkersRef = useRef<google.maps.Marker[]>([]);
  const mapInitRef = useRef(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [uRes, lRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, { headers: buildAuthHeaders(token) }),
        fetch(`${API_URL}/api/admin/logins`, { headers: buildAuthHeaders(token) }),
      ]);
      if (uRes.ok) setUsers((await uRes.json()).users);
      if (lRes.ok) setLogins((await lRes.json()).logins);
    } finally {
      setLoading(false);
    }
  };

  const loadParking = async () => {
    if (!token) return;
    setParkingLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/parking`, { headers: buildAuthHeaders(token) });
      if (res.ok) setParking((await res.json()).locations);
    } finally {
      setParkingLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  useEffect(() => {
    if (tab === 'parking') loadParking();
  }, [tab]);

  // Render parking markers on map whenever parking list or map changes
  useEffect(() => {
    if (!mapRef.current || tab !== 'parking') return;
    parkingMarkersRef.current.forEach(m => m.setMap(null));
    parkingMarkersRef.current = parking.map(p => {
      const isGas = p.type === 'gas_station';
      const m = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: mapRef.current!,
        title: p.name,
        icon: {
          path: 'M -1,-1 L 1,-1 L 1,1 L -1,1 Z',
          scale: 9,
          fillColor: isGas ? '#16a34a' : '#0d9488',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 1.5,
        },
        label: { text: isGas ? 'G' : 'P', color: '#fff', fontSize: '9px', fontWeight: 'bold' },
      });
      const typeLabel = PARKING_TYPES.find(t => t.value === p.type)?.label || p.type;
      const priceHtml = isGas
        ? `${p.fare_normal != null ? `<span style="color:#15803d;font-weight:600">₱${p.fare_normal}/L Gas</span>` : ''}${p.fare_normal != null && p.fare_discounted != null ? ' · ' : ''}${p.fare_discounted != null ? `<span style="color:#1d4ed8;font-weight:600">₱${p.fare_discounted}/kWh EV</span>` : ''}`
        : `${p.fare_normal != null ? `<span style="color:#0f766e;font-weight:600">₱${p.fare_normal} Normal</span>` : ''}${p.fare_normal != null && p.fare_discounted != null ? ' · ' : ''}${p.fare_discounted != null ? `<span style="color:#1d4ed8;font-weight:600">₱${p.fare_discounted} Student/PWD/Senior</span>` : ''}`;
      const info = new google.maps.InfoWindow({
        content: `<div style="font-size:13px;font-weight:600;color:#1e293b">${p.name}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${typeLabel}</div>${priceHtml ? `<div style="font-size:11px;margin-top:4px">${priceHtml}</div>` : ''}`,
      });
      m.addListener('click', () => info.open(mapRef.current!, m));
      return m;
    });
  }, [parking, tab]);

  // Initialize map when parking tab is active
  useEffect(() => {
    if (tab !== 'parking' || mapInitRef.current || !mapContainerRef.current) return;
    setOptions({ key: MAPS_API_KEY, v: 'weekly' });
    importLibrary('maps').then(() => initMap()).catch(console.error);
  }, [tab]);

  function initMap() {
    if (!mapContainerRef.current || mapInitRef.current) return;
    mapInitRef.current = true;
    const map = new google.maps.Map(mapContainerRef.current, {
      center: TUGUEGARAO,
      zoom: 15,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
    });
    mapRef.current = map;

    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      setEditTarget(null);
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setPinLat(lat);
      setPinLng(lng);
      setParkingError('');
      setShowForm(true);

      if (pinMarkerRef.current) {
        pinMarkerRef.current.setPosition(e.latLng);
      } else {
        pinMarkerRef.current = new google.maps.Marker({
          position: e.latLng,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#ea580c',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          animation: google.maps.Animation.DROP,
        });
      }
    });
  }

  function clearForm() {
    pinMarkerRef.current?.setMap(null);
    pinMarkerRef.current = null;
    setPinLat(null);
    setPinLng(null);
    setParkingName('');
    setParkingType('mall');
    setParkingNotes('');
    setFareNormal('');
    setFareDiscounted('');
    setPhoto(null);
    setParkingError('');
    setEditTarget(null);
    setShowForm(false);
  }

  function handleEditParking(p: ParkingRow) {
    setEditTarget(p);
    setParkingName(p.name);
    setParkingType(p.type);
    setParkingNotes(p.notes || '');
    setFareNormal(p.fare_normal != null ? String(p.fare_normal) : '');
    setFareDiscounted(p.fare_discounted != null ? String(p.fare_discounted) : '');
    setPhoto(p.photo || null);
    setPinLat(p.lat);
    setPinLng(p.lng);
    setParkingError('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleSaveParking = async () => {
    if (!token) return;
    if (!parkingName.trim()) { setParkingError('Please enter a name.'); return; }
    if (!editTarget && (pinLat === null || pinLng === null)) { setParkingError('Drop a pin on the map first.'); return; }
    setSavingParking(true);
    setParkingError('');
    try {
      const payload: Record<string, any> = {
        name: parkingName.trim(),
        type: parkingType,
        notes: parkingNotes.trim(),
        fare_normal: fareNormal !== '' ? parseFloat(fareNormal) : null,
        fare_discounted: fareDiscounted !== '' ? parseFloat(fareDiscounted) : null,
        photo: photo || null,
      };
      if (!editTarget) {
        payload.lat = pinLat;
        payload.lng = pinLng;
      }
      const url = editTarget
        ? `${API_URL}/api/admin/parking/${editTarget.id}`
        : `${API_URL}/api/admin/parking`;
      const res = await fetch(url, {
        method: editTarget ? 'PATCH' : 'POST',
        headers: { ...buildAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setParkingError(data.error || 'Failed to save.'); return; }
      await loadParking();
      clearForm();
    } finally {
      setSavingParking(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setParkingError('Please select an image file.'); return; }
    setPhotoCompressing(true);
    setParkingError('');
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch {
      setParkingError('Failed to process image.');
    } finally {
      setPhotoCompressing(false);
    }
  };

  const handleDeleteParking = async (p: ParkingRow) => {
    if (!token) return;
    setActionLoading(`del-parking-${p.id}`);
    try {
      await fetch(`${API_URL}/api/admin/parking/${p.id}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(token),
      });
      setParking(prev => prev.filter(x => x.id !== p.id));
    } finally {
      setActionLoading(null);
      setConfirmDeleteParking(null);
    }
  };

  const handleBan = async (u: UserRow) => {
    if (!token) return;
    const action = u.banned ? 'unban' : 'ban';
    setActionLoading(`${action}-${u.id}`);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}/${action}`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
      });
      if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, banned: !u.banned } : x));
    } finally {
      setActionLoading(null);
    }
  };

  const handleMakeAdmin = async (u: UserRow) => {
    if (!token) return;
    setActionLoading(`make-admin-${u.id}`);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}/make-admin`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
      });
      if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: 'admin' } : x));
    } finally {
      setActionLoading(null);
    }
  };

  const handleMakeResearcher = async (u: UserRow) => {
    if (!token) return;
    setActionLoading(`make-researcher-${u.id}`);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}/make-researcher`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
      });
      if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: 'researcher' } : x));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (!token) return;
    setActionLoading(`delete-${u.id}`);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(token),
      });
      if (res.ok) setUsers(prev => prev.filter(x => x.id !== u.id));
    } finally {
      setActionLoading(null);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Admin Panel</h1>
              <p className="text-sm text-slate-500">System access — restricted view</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{users.length}</p>
                <p className="text-xs text-slate-500">Registered Users</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <LogIn className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{logins.length}</p>
                <p className="text-xs text-slate-500">Recent Logins</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
                <ParkingSquare className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{parking.length}</p>
                <p className="text-xs text-slate-500">Parking Spots</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['logins', 'users', 'parking'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t
                  ? 'bg-teal-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === 'logins' ? 'Login Activity' : t === 'users' ? 'All Users' : 'Parking Manager'}
            </button>
          ))}
        </div>

        {/* Login Activity Table */}
        {tab === 'logins' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Recent Login Activity
              </h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
            ) : logins.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No login records yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-6 py-3 font-medium">User</th>
                      <th className="text-left px-6 py-3 font-medium">Role</th>
                      <th className="text-left px-6 py-3 font-medium">Method</th>
                      <th className="text-left px-6 py-3 font-medium">IP Address</th>
                      <th className="text-left px-6 py-3 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logins.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-3 font-medium text-slate-800">
                          {log.user
                            ? `${log.user.firstName} ${log.user.lastName}`.trim() || 'Unknown'
                            : <span className="text-slate-400 text-xs">Deleted user</span>}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.user?.role === 'admin'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {log.user?.role || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.action === 'OAUTH_LOGIN_SUCCESS'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-teal-100 text-teal-700'
                          }`}>
                            <Wifi className="w-3 h-3" />
                            {log.action === 'OAUTH_LOGIN_SUCCESS' ? 'OAuth' : 'Email'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-500 font-mono text-xs">
                          {log.ip_address || '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-500">
                          <span title={formatDate(log.created_at)}>
                            {timeAgo(log.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Users Table */}
        {tab === 'users' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                All Registered Users
              </h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-6 py-3 font-medium">Name</th>
                      <th className="text-left px-6 py-3 font-medium">Role</th>
                      <th className="text-left px-6 py-3 font-medium">Status</th>
                      <th className="text-left px-6 py-3 font-medium">Auth</th>
                      <th className="text-left px-6 py-3 font-medium">Joined</th>
                      <th className="text-left px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const isMe = u.id === me?.id;
                      const isAdmin = u.role === 'admin';
                      const isResearcher = u.role === 'researcher';
                      const banKey = `${u.banned ? 'unban' : 'ban'}-${u.id}`;
                      const deleteKey = `delete-${u.id}`;
                      const makeAdminKey = `make-admin-${u.id}`;
                      const makeResearcherKey = `make-researcher-${u.id}`;
                      return (
                        <tr key={u.id} className={`hover:bg-slate-50 transition ${u.banned ? 'opacity-60' : ''}`}>
                          <td className="px-6 py-3 font-medium text-slate-800">
                            {`${u.first_name} ${u.last_name}`.trim() || '—'}
                            {isMe && <span className="ml-2 text-xs text-teal-600">(you)</span>}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isAdmin ? 'bg-red-100 text-red-700' : isResearcher ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            {u.banned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                <Ban className="w-3 h-3" /> Banned
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-600">
                                <CheckCircle className="w-3 h-3" />
                                {u.email_verified ? 'Verified' : 'Pending'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-slate-500 text-xs">
                            {u.auth_providers.length > 0 ? u.auth_providers.join(', ') : 'email'}
                          </td>
                          <td className="px-6 py-3 text-slate-500 text-xs">
                            {formatDate(u.created_at)}
                          </td>
                          <td className="px-6 py-3">
                            {isMe || isAdmin ? (
                              <span className="text-xs text-slate-300">—</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleBan(u)}
                                  disabled={actionLoading === banKey}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                    u.banned
                                      ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  } disabled:opacity-50`}
                                >
                                  <Ban className="w-3 h-3" />
                                  {u.banned ? 'Unban' : 'Ban'}
                                </button>
                                {!u.banned && !isResearcher && (
                                  <button
                                    onClick={() => handleMakeResearcher(u)}
                                    disabled={actionLoading === makeResearcherKey}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
                                  >
                                    <FlaskConical className="w-3 h-3" />
                                    Make Researcher
                                  </button>
                                )}
                                {!u.banned && (
                                  <button
                                    onClick={() => handleMakeAdmin(u)}
                                    disabled={actionLoading === makeAdminKey}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition disabled:opacity-50"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    Make Admin
                                  </button>
                                )}
                                <button
                                  onClick={() => setConfirmDelete(u)}
                                  disabled={actionLoading === deleteKey}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Parking Manager Tab */}
        {tab === 'parking' && (
          <div className="space-y-4">
            {/* Map + Pin Form */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  Pin a Parking Location
                </h2>
                <p className="text-xs text-slate-500 mt-1">Click anywhere on the map to drop a pin, then fill in the details below.</p>
              </div>

              {/* Map */}
              <div ref={mapContainerRef} className="w-full h-80" />

              {/* Form — shown after map click or edit button */}
              {showForm && (
                <div className="p-5 border-t border-slate-100 bg-slate-50">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${editTarget ? 'bg-blue-100' : 'bg-orange-100'}`}>
                      {editTarget ? <Pencil className="w-4 h-4 text-blue-600" /> : <MapPin className="w-4 h-4 text-orange-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-700">{editTarget ? `Editing: ${editTarget.name}` : 'New pin'}</p>
                      {pinLat !== null && <p className="text-xs text-slate-500 font-mono">{pinLat.toFixed(6)}, {pinLng!.toFixed(6)}</p>}
                    </div>
                    <button onClick={clearForm} className="text-slate-400 hover:text-slate-600 transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
                      <input type="text" value={parkingName} onChange={e => setParkingName(e.target.value)}
                        placeholder="e.g. SM Center Parking" maxLength={100}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                      <select value={parkingType} onChange={e => setParkingType(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                        {PARKING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>

                    {/* Fare / Price fields — labels change based on type */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {parkingType === 'gas_station' ? 'Gasoline / Diesel Price (₱/L)' : 'Normal Fare (₱)'}
                      </label>
                      <input type="number" min="0" max="9999" step="0.50" value={fareNormal}
                        onChange={e => setFareNormal(e.target.value)}
                        placeholder={parkingType === 'gas_station' ? 'e.g. 62' : 'e.g. 14'}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {parkingType === 'gas_station' ? 'EV Charging Rate (₱/kWh)' : 'Student / PWD & Senior Fare (₱)'}
                      </label>
                      <input type="number" min="0" max="9999" step="0.50" value={fareDiscounted}
                        onChange={e => setFareDiscounted(e.target.value)}
                        placeholder={parkingType === 'gas_station' ? 'e.g. 10' : 'e.g. 11'}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optional)</label>
                      <input type="text" value={parkingNotes} onChange={e => setParkingNotes(e.target.value)}
                        placeholder="e.g. Open 24hrs, free parking" maxLength={300}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                    </div>

                    {/* Photo upload */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                        <Image className="w-3 h-3" /> Photo (optional)
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition">
                          <Plus className="w-3.5 h-3.5" />
                          {photoCompressing ? 'Processing...' : photo ? 'Change photo' : 'Upload photo'}
                          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={photoCompressing} />
                        </label>
                        {photo && (
                          <div className="flex items-center gap-2">
                            <img src={photo} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                            <button onClick={() => setPhoto(null)} className="text-slate-400 hover:text-red-500 transition">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {parkingError && <p className="mt-2 text-xs text-red-600">{parkingError}</p>}

                  <div className="mt-4 flex gap-3">
                    <button onClick={handleSaveParking} disabled={savingParking || photoCompressing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50">
                      {editTarget ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {savingParking ? 'Saving...' : editTarget ? 'Save Changes' : 'Save Spot'}
                    </button>
                    <button onClick={clearForm} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!showForm && (
                <div className="p-4 text-center text-slate-400 text-xs border-t border-slate-100">
                  Click on the map above to place a new pin
                </div>
              )}
            </div>

            {/* Existing Parking List */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <ParkingSquare className="w-4 h-4 text-teal-600" />
                  Pinned Parking Spots ({parking.length})
                </h2>
                <button onClick={loadParking} disabled={parkingLoading} className="text-slate-400 hover:text-slate-600 transition">
                  <RefreshCw className={`w-4 h-4 ${parkingLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {parkingLoading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
              ) : parking.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No parking spots pinned yet. Click on the map above to add one.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {parking.map((p) => (
                    <div key={p.id} className="flex items-start gap-3 px-6 py-4 hover:bg-slate-50 transition">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${p.type === 'gas_station' ? 'bg-green-50' : 'bg-teal-50'}`}>
                        {p.type === 'gas_station'
                          ? <Fuel className="w-4 h-4 text-green-600" />
                          : <ParkingSquare className="w-4 h-4 text-teal-600" />}
                      </div>
                      {p.photo && (
                        <img src={p.photo} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[p.type] || TYPE_COLORS.other}`}>
                            {PARKING_TYPES.find(t => t.value === p.type)?.label || p.type}
                          </span>
                          {p.fare_normal != null && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                              {p.type === 'gas_station' ? `₱${p.fare_normal}/L Gas` : `₱${p.fare_normal} Normal`}
                            </span>
                          )}
                          {p.fare_discounted != null && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {p.type === 'gas_station' ? `₱${p.fare_discounted}/kWh EV` : `₱${p.fare_discounted} Student/PWD/Senior`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400 font-mono">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                          {p.notes && <span className="text-xs text-slate-500 truncate max-w-[160px]">{p.notes}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0 mt-1">{timeAgo(p.added_at)}</span>
                      <button
                        onClick={() => handleEditParking(p)}
                        className="flex-shrink-0 p-1.5 rounded-lg text-blue-400 hover:bg-blue-50 hover:text-blue-600 transition mt-0.5"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteParking(p)}
                        disabled={actionLoading === `del-parking-${p.id}`}
                        className="flex-shrink-0 p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50 mt-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete User Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Delete User</h3>
                <p className="text-xs text-slate-500">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-slate-900">
                {`${confirmDelete.first_name} ${confirmDelete.last_name}`.trim() || 'this user'}
              </span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={actionLoading === `delete-${confirmDelete.id}`}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading === `delete-${confirmDelete.id}` ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Parking Confirmation Modal */}
      {confirmDeleteParking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Remove Parking Spot</h3>
                <p className="text-xs text-slate-500">It will disappear from the commuter map</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Remove <span className="font-semibold text-slate-900">{confirmDeleteParking.name}</span> from the map?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteParking(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteParking(confirmDeleteParking)}
                disabled={actionLoading === `del-parking-${confirmDeleteParking.id}`}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading === `del-parking-${confirmDeleteParking.id}` ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
