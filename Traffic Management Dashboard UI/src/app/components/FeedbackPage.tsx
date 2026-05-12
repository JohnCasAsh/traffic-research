import { useState, useEffect } from 'react';
import { MessageSquare, Send, CheckCircle, AlertTriangle, MapPin, Fuel, Car, HelpCircle, Camera, X, Navigation, Thermometer, PersonStanding, TriangleAlert } from 'lucide-react';
import { useAuth } from '../auth';
import { API_URL, buildAuthHeaders } from '../api';

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 1280;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CATEGORIES = [
  { value: 'blocked_sidewalk', label: 'Blocked Sidewalk', icon: PersonStanding },
  { value: 'unsafe_walkway', label: 'Unsafe Walkway', icon: TriangleAlert },
  { value: 'no_shade', label: 'No Shade / Heat Hazard', icon: Thermometer },
  { value: 'traffic', label: 'Traffic Congestion', icon: Car },
  { value: 'road', label: 'Road Condition', icon: AlertTriangle },
  { value: 'parking', label: 'Parking Problem', icon: MapPin },
  { value: 'tricycle', label: 'Tricycle Issue', icon: Navigation },
  { value: 'gas', label: 'Gas Station Info', icon: Fuel },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

export function FeedbackPage() {
  const { token, user } = useAuth();
  const [category, setCategory] = useState('blocked_sidewalk');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'detecting' | 'captured' | 'denied' | 'idle'>('idle');

  useEffect(() => {
    setGpsStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('captured');
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    setPhotoCompressing(true);
    setError('');
    try {
      setPhoto(await compressImage(file));
    } catch {
      setError('Failed to process image.');
    } finally {
      setPhotoCompressing(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) { setError('Please enter a message.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const body = {
        category,
        location: location.trim(),
        message: message.trim(),
        photo: photo || null,
        submittedBy: user ? `${user.firstName} ${user.lastName}`.trim() : 'Anonymous',
        gps: gps ? { lat: gps.lat, lng: gps.lng } : null,
      };
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { ...buildAuthHeaders(token || ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Server error');
      setSubmitted(true);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-teal-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Thank you!</h2>
          <p className="text-sm text-slate-500">Your road report has been submitted{gps ? ' with your GPS location' : ''}. The research team will review it and use it to improve walkway and traffic data for Tuguegarao City.</p>
          <button
            onClick={() => { setSubmitted(false); setMessage(''); setLocation(''); setCategory('traffic'); setPhoto(null); }}
            className="px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition"
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-8">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Road Report</h1>
            <p className="text-sm text-slate-500">Report blocked sidewalks, unsafe walkways, congestion & more — your GPS location is captured automatically</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition ${
                    category === value
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* GPS Status */}
          <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm border ${
            gpsStatus === 'captured' ? 'bg-green-50 border-green-200 text-green-700' :
            gpsStatus === 'detecting' ? 'bg-blue-50 border-blue-200 text-blue-600' :
            gpsStatus === 'denied' ? 'bg-amber-50 border-amber-200 text-amber-700' :
            'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            <Navigation className="w-4 h-4 flex-shrink-0" />
            {gpsStatus === 'captured' && gps && (
              <span>GPS captured — <span className="font-mono">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span> — your exact location will be attached to this report</span>
            )}
            {gpsStatus === 'detecting' && <span>Detecting your GPS location…</span>}
            {gpsStatus === 'denied' && <span>GPS not available — add the location name manually below</span>}
            {gpsStatus === 'idle' && <span>Getting location…</span>}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Location name <span className="text-slate-400 font-normal">(optional — add landmark or street name)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Rizal St., SM Center, near PSBank, Enrile Ave."
              maxLength={150}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe the issue or information you'd like to report..."
              maxLength={1000}
              rows={5}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white resize-none"
            />
            <p className="text-xs text-slate-400 text-right mt-1">{message.length}/1000</p>
          </div>

          {/* Photo Proof */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Photo Proof <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            {photo ? (
              <div className="relative">
                <img
                  src={photo}
                  alt="proof"
                  className="w-full max-h-52 object-cover rounded-xl border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center gap-2 w-full py-6 rounded-xl border-2 border-dashed cursor-pointer transition ${photoCompressing ? 'border-slate-200 opacity-50' : 'border-slate-200 hover:border-teal-400 hover:bg-teal-50'}`}>
                <Camera className="w-6 h-6 text-slate-400" />
                <span className="text-sm text-slate-500 font-medium">
                  {photoCompressing ? 'Processing...' : 'Tap to upload a photo'}
                </span>
                <span className="text-xs text-slate-400">JPG, PNG, HEIC — max 10MB</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={photoCompressing}
                />
              </label>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || photoCompressing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-400">
          Reports include your GPS coordinates and are reviewed by the research team to identify unsafe walkways, blocked sidewalks, and congestion hotspots in Tuguegarao City.
        </p>
      </div>
    </div>
  );
}
