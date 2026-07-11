import React, { createElement as createEl, Fragment, useState, useEffect, useContext, createContext, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';

// Convert CSS string styles ("color:red;font-size:12px") to React style objects.
// React throws if `style` is a string; this shim makes all h(...) calls safe.
function cssStringToObj(css) {
  const out = {};
  css.split(';').forEach((decl) => {
    const idx = decl.indexOf(':');
    if (idx === -1) return;
    const rawProp = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (!rawProp || !value) return;
    const prop = rawProp.startsWith('--')
      ? rawProp
      : rawProp.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[prop] = value;
  });
  return out;
}

const h = (type, props, ...children) => {
  if (props && typeof props.style === 'string') {
    props = { ...props, style: cssStringToObj(props.style) };
  }
  return createEl(type, props, ...children);
};

// Safe localStorage wrapper for iOS Private Browsing
const safeStorage = {
  getItem: function(k) { try { return localStorage.getItem(k); } catch(e) { return null; } },
  setItem: function(k, v) { try { localStorage.setItem(k, v); } catch(e) {} },
  removeItem: function(k) { try { localStorage.removeItem(k); } catch(e) {} }
};

// === ICONS (inline SVG) ===
const Icon = ({ name, size = 20 }) => {
  const icons = {
    home: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
      h('polyline', { points: '9 22 9 12 15 12 15 22' })),
    calendar: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }),
      h('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
      h('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
      h('line', { x1: 3, y1: 10, x2: 21, y2: 10 })),
    chat: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })),
    user: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
      h('circle', { cx: 12, cy: 7, r: 4 })),
    chevronRight: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('polyline', { points: '9 18 15 12 9 6' })),
    arrowLeft: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('line', { x1: 19, y1: 12, x2: 5, y2: 12 }),
      h('polyline', { points: '12 19 5 12 12 5' })),
    check: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('polyline', { points: '20 6 9 17 4 12' })),
    clock: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('circle', { cx: 12, cy: 12, r: 10 }),
      h('polyline', { points: '12 6 12 12 16 14' })),
    euro: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('line', { x1: 12, y1: 1, x2: 12, y2: 23 }),
      h('path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })),
    settings: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' })),
    creditCard: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('rect', { x: 1, y: 4, width: 22, height: 16, rx: 2, ry: 2 }),
      h('line', { x1: 1, y1: 10, x2: 23, y2: 10 })),
    logout: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }),
      h('polyline', { points: '16 17 21 12 16 7' }),
      h('line', { x1: 21, y1: 12, x2: 9, y2: 12 })),
    camera: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }),
      h('circle', { cx: 12, cy: 13, r: 4 })),
    mapPin: h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' }),
      h('circle', { cx: 12, cy: 10, r: 3 })),
  };
  return icons[name] || null;
};

// === ANALYTICS TRACKING ===
function track(name, metadata = {}) {
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, metadata }),
  }).catch(() => {});
}

// === API HELPER ===
const api = (() => {
  const base = '';
  async function request(path, options = {}) {
    const token = safeStorage.getItem('fixgo_token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(base + path, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  return {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
    patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  };
})();

// === PUSH NOTIFICATION MANAGER ===
const pushManager = {
  async isSupported() {
    return !!(navigator.serviceWorker && ('PushManager' in window));
  },
  async getVapidPublicKey() {
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) throw new Error('Failed to get VAPID key');
    const { publicKey } = await res.json();
    return publicKey;
  },
  async subscribe() {
    const sw = await navigator.serviceWorker.ready;
    const publicKey = await this.getVapidPublicKey();
    const sub = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(publicKey),
    });
    // Strip leading "推送" and normalize
    const subJson = sub.toJSON();
    await api.post('/api/push/subscribe', {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      userAgent: navigator.userAgent,
    });
    return sub;
  },
  async unsubscribe() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  },
  async isSubscribed() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch { return false; }
  },
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  },
};

// === AUTH CONTEXT ===
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = safeStorage.getItem('fixgo_token');
    if (token) {
      api.get('/api/auth/me')
        .then(data => setUser(data.user))
        .catch(() => safeStorage.removeItem('fixgo_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password });
    safeStorage.setItem('fixgo_token', data.token);
    setUser(data.user);
  };

  const register = async (email, password, name, role = 'client') => {
    const data = await api.post('/api/auth/register', { email, password, name, role });
    safeStorage.setItem('fixgo_token', data.token);
    setUser(data.user);
  };

  const googleLogin = async (googleId, email, name) => {
    const data = await api.post('/api/auth/google', { googleId, email, name });
    safeStorage.setItem('fixgo_token', data.token);
    setUser(data.user);
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    safeStorage.removeItem('fixgo_token');
    setUser(null);
  };

  return h(AuthContext.Provider, { value: { user, loading, login, register, googleLogin, logout } }, children);
}

const useAuth = () => useContext(AuthContext);

// === ERROR BOUNDARY ===
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, message: '' }; }
  static getDerivedStateFromError(err) { return { hasError: true, message: err.message }; }
  render() {
    if (this.state.hasError) {
      return h('div', { style: 'padding:40px 20px;text-align:center' },
        h('h2', { style: 'font-size:18px;font-weight:700;margin-bottom:12px' }, 'Si è verificato un errore'),
        h('p', { style: 'color:#6C7268;font-size:14px;margin-bottom:20px' }, 'Ricarica la pagina per continuare'),
        h('button', {
          style: 'background:#1E5B3E;color:white;padding:12px 24px;border:none;border-radius:10px;font-weight:600;cursor:pointer',
          onClick: () => window.location.reload()
        }, 'Ricarica')
      );
    }
    return this.props.children;
  }
}

// === TOAST ===
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return h('div', { className: 'toast' }, message);
}

// === BOTTOM NAV ===
function BottomNav() {
  const location = useLocation();
  const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
  if (isAuthPage) return null;
  const items = [
    { to: '/', icon: 'home', label: 'Home' },
    { to: '/analyze', icon: 'camera', label: 'Diagnostica' },
    { to: '/map', icon: 'mapPin', label: 'Mappa' },
    { to: '/bookings', icon: 'calendar', label: 'Prenotazioni' },
    { to: '/profile', icon: 'user', label: 'Profilo' },
  ];
  return h('nav', { className: 'bottom-nav' },
    items.map(item =>
      h(Link, {
        key: item.to,
        to: item.to,
        className: `nav-item${location.pathname === item.to ? ' active' : ''}`,
      },
        Icon(item.icon), item.label
      )
    )
  );
}

// === HOME PAGE ===
function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    track('page_view_home');
  }, []);

  const services = [
    { id: 'carwash', icon: '🚿', name: 'Car Wash', desc: 'Lavaggio auto a domicilio', price: 'da €25' },
    { id: 'idraulica', icon: '🔧', name: 'Idraulica', desc: 'Idraulici certificati', price: 'da €40' },
    { id: 'elettricista', icon: '⚡', name: 'Elettricista', desc: 'Elettricisti certificati', price: 'da €45' },
  ];
  return h(Fragment, null,
    // Hero
    h('div', { className: 'hero' },
      h('h1', null, 'FixGo'),
      h('p', null, 'Professionisti a domicilio, in pochi tap')
    ),

    // Services
    h('div', { className: 'services-section' },
      h('h2', { className: 'section-title' }, 'Servizi'),
      services.map(s =>
        h('div', { key: s.id, className: 'service-card' },
          h('div', { className: 'service-icon' }, s.icon),
          h('div', { className: 'service-info' },
            h('div', { className: 'service-name' }, s.name),
            h('div', { className: 'service-desc' }, s.desc)
          ),
          h('button', {
            className: 'btn-book',
            onClick: () => navigate('/book', { state: { serviceType: s.id } }),
          }, 'Prenota')
        )
      )
    ),

    // How it works
    h('div', { className: 'how-section' },
      h('h2', { className: 'section-title' }, 'Come funziona'),
      h('div', { className: 'how-grid' },
        h('div', { className: 'how-step' },
          h('div', { className: 'step-num' }, '1'),
          h('div', { className: 'step-text' }, 'Scegli il servizio che ti serve')
        ),
        h('div', { className: 'how-step' },
          h('div', { className: 'step-num' }, '2'),
          h('div', { className: 'step-text' }, 'Prenota un professionista vicino a te')
        ),
        h('div', { className: 'how-step' },
          h('div', { className: 'step-num' }, '3'),
          h('div', { className: 'step-text' }, 'Paga in sicurezza e lasciati votare')
        )
      )
    ),

    // Footer
    h('footer', { className: 'footer' },
      h('div', { className: 'footer-links' },
        h('a', { href: '#' }, 'Privacy'),
        h('a', { href: '#' }, 'Termini'),
        h('a', { href: '#' }, 'Contatti')
      ),
      h('p', { className: 'footer-copy' }, '© 2026 FixGo — Milano')
    )
  );
}

// === BOOK PAGE ===
function BookPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { serviceType, professionalId, professionalName, priceEstimate, distanceKm } = location.state || {};

  // Track page view on mount
  useEffect(() => {
    track('page_view_booking', { serviceType, professionalId, professionalName });
  }, []);

  const serviceLabels = { carwash: 'Lavaggio Auto', idraulica: 'Idraulica', elettricista: 'Elettricista', altro: 'Altro' };
  const priceRanges = { carwash: [25, 60], idraulica: [40, 200], elettricista: [45, 180], altro: [30, 150] };
  const range = priceRanges[serviceType] || [30, 150];

  const [step, setStep] = useState(1); // 1=pro+date, 2=time, 3=address, 4=confirm
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [createdBooking, setCreatedBooking] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Build next 7 days for date picker
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      iso: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', ''),
      dayNum: d.getDate(),
      monthName: d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''),
      display: d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
    };
  });

  // Load time slots when date changes
  const loadSlots = async (date) => {
    setLoadingSlots(true);
    try {
      const params = new URLSearchParams({ date });
      if (professionalId) params.set('pro_id', professionalId);
      const data = await api.get(`/api/bookings/slots?${params}`);
      setSlots(data.slots || []);
    } catch {
      // Fallback to generated slots
      const fallback = [];
      for (let h = 9; h <= 18; h++) {
        fallback.push({ time: `${h}:00`, iso: `${date}T${String(h).padStart(2,'0')}:00:00+02:00`, available: true });
      }
      setSlots(fallback);
    }
    setLoadingSlots(false);
  };

  const handleDateSelect = (dateObj) => {
    setSelectedDate(dateObj);
    setSelectedTime(null);
    loadSlots(dateObj.iso);
    setStep(2);
    track('booking_step_date', { serviceType, date: dateObj.iso });
  };

  const handleTimeSelect = (slot) => {
    if (!slot.available) return;
    setSelectedTime(slot);
    setStep(3);
    track('booking_step_time', { serviceType, time: slot.iso });
  };

  const handleConfirm = async () => {
    if (!address.trim()) { setError('Indirizzo richiesto'); return; }
    setLoading(true);
    setError('');
    try {
      const body = {
        professional_id: professionalId || null,
        service_type: serviceType,
        scheduled_at: selectedTime?.iso || null,
        address: address.trim(),
        notes: notes.trim() || null,
      };
      const data = await api.post('/api/bookings', body);
      setCreatedBooking(data.booking);
      setStep(4);
      track('booking_created', { bookingId: data.booking.id, serviceType, professionalId, address: address.trim() });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!createdBooking) return;
    setPaymentLoading(true);
    setPaymentError('');
    track('payment_initiated', { bookingId: createdBooking.id, serviceType });
    try {
      const data = await api.post('/api/payments/create-checkout-session', { bookingId: createdBooking.id });
      window.location.href = data.url;
    } catch (err) {
      setPaymentError(err.message);
      setPaymentLoading(false);
    }
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate(-1);
  };

  const priceDisplay = priceEstimate || `€${range[0]}–€${range[1]}`;
  const proInitials = professionalName ? professionalName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

  return h(Fragment, null,
    step < 4 && h('div', { className: 'booking-flow' },
      // Header
      h('div', { style: 'background:white;padding:20px 16px 16px;border-radius:0 0 20px 20px;margin:0 -16px 20px;box-shadow:0 2px 8px rgba(0,0,0,.05)' },
        h('button', { className: 'back-btn', onClick: goBack },
          Icon('arrowLeft'), 'Indietro'
        ),
        h('h2', { className: 'page-title', style: 'margin-bottom:4px' },
          serviceLabels[serviceType] || 'Prenotazione'
        ),
        h('p', { style: 'font-size:14px;color:var(--text-light);margin-bottom:16px' },
          priceDisplay + (distanceKm ? ` · ${distanceKm} km da te` : '')
        ),
        // Progress steps
        h('div', { style: 'display:flex;gap:6px;align-items:center' },
          [1,2,3].map(s => h('div', {
            key: s,
            style: `flex:1;height:4px;border-radius:2px;background:${s <= step ? 'var(--primary)' : 'var(--border)'}`
          }))
        ),
        h('div', { style: 'display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--text-light);font-weight:500' },
          h('span', { style: step >= 1 ? 'color:var(--primary)' : '' }, 'Data'),
          h('span', { style: step >= 2 ? 'color:var(--primary)' : '' }, 'Orario'),
          h('span', { style: step >= 3 ? 'color:var(--primary)' : '' }, 'Indirizzo')
        )
      ),

      // Pro summary (if selected from map)
      professionalId && professionalName && h('div', { className: 'pro-summary' },
        h('div', { className: 'pro-summary-avatar' }, proInitials),
        h('div', { className: 'pro-summary-info' },
          h('div', { className: 'pro-summary-name' }, professionalName),
          h('div', { className: 'pro-summary-meta' },
            serviceLabels[serviceType] || serviceType,
            distanceKm ? ` · 📍 ${distanceKm} km` : ''
          )
        ),
        h('div', { className: 'pro-summary-price' }, priceDisplay)
      ),

      // Step 1: Date picker
      step === 1 && h(Fragment, null,
        h('div', { style: 'font-size:15px;font-weight:700;margin-bottom:14px;color:var(--text)' },
          '📅 Quando vuoi il servizio?'
        ),
        h('div', { className: 'date-scroll' },
          dateOptions.map(d => h('div', {
            key: d.iso,
            className: `date-card${selectedDate?.iso === d.iso ? ' selected' : ''}`,
            onClick: () => handleDateSelect(d)
          },
            h('div', { className: 'day-name' }, d.dayName),
            h('div', { className: 'day-num' }, d.dayNum),
            h('div', { className: 'month-name' }, d.monthName)
          ))
        ),
        selectedDate && h('div', { style: 'font-size:14px;color:var(--text-light);margin-top:8px' },
          'Hai selezionato: ' + selectedDate.display
        )
      ),

      // Step 2: Time slots
      step === 2 && h(Fragment, null,
        h('div', { style: 'font-size:15px;font-weight:700;margin-bottom:14px;color:var(--text)' },
          '⏰ Seleziona un orario — ' + (selectedDate?.display || '')
        ),
        loadingSlots
          ? h('div', { style: 'text-align:center;padding:20px;color:var(--text-light)' }, 'Caricamento orari...')
          : h('div', { className: 'time-grid' },
              slots.map(slot => h('div', {
                key: slot.time,
                className: `time-slot${selectedTime?.time === slot.time ? ' selected' : ''}${!slot.available ? ' disabled' : ''}`,
                onClick: () => handleTimeSelect(slot)
              }, slot.time))
            )
      ),

      // Step 3: Address + notes
      step === 3 && h(Fragment, null,
        h('div', { style: 'font-size:15px;font-weight:700;margin-bottom:14px;color:var(--text)' },
          '📍 Dove ti serve?'
        ),
        h('div', { className: 'error-msg' }, error),
        h('div', { className: 'form-group' },
          h('label', { className: 'form-label' }, 'Indirizzo completo'),
          h('input', {
            className: 'form-input' + (error && !address ? ' error' : ''),
            type: 'text',
            placeholder: 'Via Roma 12, Milano MI',
            value: address,
            onChange: e => setAddress(e.target.value)
          })
        ),
        h('div', { className: 'form-group' },
          h('label', { className: 'form-label' }, 'Note (opzionale)'),
          h('textarea', {
            className: 'form-input',
            placeholder: 'Dettagli, accesso, preferenze...',
            value: notes, onChange: e => setNotes(e.target.value),
            rows: 3,
            style: 'resize:none;'
          })
        ),
        // Summary card
        h('div', { className: 'booking-summary' },
          h('h3', null, 'Riepilogo prenotazione'),
          h('div', { className: 'summary-row' },
            h('span', { className: 'label' }, 'Servizio'), h('span', { className: 'value' }, serviceLabels[serviceType] || serviceType)
          ),
          selectedDate && h('div', { className: 'summary-row' },
            h('span', { className: 'label' }, 'Data'),
            h('span', { className: 'value' }, selectedDate.display)
          ),
          selectedTime && h('div', { className: 'summary-row' },
            h('span', { className: 'label' }, 'Orario'), h('span', { className: 'value' }, selectedTime.time)
          ),
          professionalName && h('div', { className: 'summary-row' },
            h('span', { className: 'label' }, 'Professionista'), h('span', { className: 'value' }, professionalName)
          ),
          h('div', { className: 'summary-row' },
            h('span', { className: 'label' }, 'Stima prezzo'), h('span', { className: 'value', style: 'color:#1E5B3E' }, priceDisplay)
          )
        ),
        h('button', { className: 'btn-primary', onClick: handleConfirm, disabled: loading },
          loading ? h('span', { className: 'spinner' }) : '✓ Conferma Prenotazione'
        )
      )
    ),

    // Step 4: Confirmation screen
    step === 4 && createdBooking && h(ConfirmScreen, { booking: createdBooking, navigate }),

    // Payment CTA
    step === 4 && createdBooking && h('div', { className: 'payment-cta-wrap' },
      h('div', { className: 'payment-cta' },
        h('div', { className: 'payment-cta-label' }, '€10 fee servizio'),
        !createdBooking.payment_status || createdBooking.payment_status === 'pending'
          ? h(Fragment, null,
              paymentError && h('div', { className: 'error-msg', style: 'margin-bottom:10px;font-size:13px' }, paymentError),
              h('button', {
                className: 'btn-primary',
                onClick: handlePayNow,
                disabled: paymentLoading,
                style: 'background:var(--primary);width:100%'
              }, paymentLoading ? 'Caricamento...' : 'Paga ora con carta')
            )
          : createdBooking.payment_status === 'paid'
            ? h('div', { className: 'paid-badge' }, '✓ Pagamento completato')
            : h('div', { className: 'failed-badge' }, 'Pagamento fallito')
      )
    ),

    toast && h(Toast, { message: toast, onDone: () => setToast(null) })
  );
}

// === CONFIRMATION SCREEN ===
function ConfirmScreen({ booking, navigate }) {
  const serviceLabels = { carwash: 'Lavaggio Auto', idraulica: 'Idraulica', elettricista: 'Elettricista', altro: 'Altro' };
  const statusLabels = { pending: 'In attesa', confirmed: 'Confermata', in_progress: 'In corso', completed: 'Completata', cancelled: 'Cancellata' };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return h(Fragment, null,
    // Hero
    h('div', { className: 'confirm-hero' },
      h('div', { className: 'confirm-check' }, '✓'),
      h('h1', null, 'Prenotazione Confermata!'),
      h('p', null, 'Il professionista ti contatterà presto per confermare i dettagli.'),
      h('div', { className: 'confirm-booking-id' }, '#' + (booking.id || booking.booking_id || '—'))
    ),

    // Notification note
    h('div', { className: 'notification-note' },
      h('span', { className: 'notification-note-icon' }, '📧'),
      h('span', null, "Riceverai un'email di conferma e un reminder prima dell'appuntamento.")
    ),

    // Details
    h('div', { className: 'confirm-details' },
      booking.scheduled_at && h('div', { className: 'confirm-row' },
        h('span', { className: 'confirm-row-icon' }, '📅'),
        h('div', { className: 'confirm-row-info' },
          h('div', { className: 'confirm-row-label' }, 'Data e ora'),
          h('div', { className: 'confirm-row-value' }, formatDate(booking.scheduled_at))
        )
      ),
      h('div', { className: 'confirm-row' },
        h('span', { className: 'confirm-row-icon' }, '🔧'),
        h('div', { className: 'confirm-row-info' },
          h('div', { className: 'confirm-row-label' }, 'Servizio'),
          h('div', { className: 'confirm-row-value' }, serviceLabels[booking.service_type] || booking.service_type)
        )
      ),
      h('div', { className: 'confirm-row' },
        h('span', { className: 'confirm-row-icon' }, '📍'),
        h('div', { className: 'confirm-row-info' },
          h('div', { className: 'confirm-row-label' }, 'Indirizzo'),
          h('div', { className: 'confirm-row-value' }, booking.address)
        )
      ),
      booking.professional_name && h('div', { className: 'confirm-row' },
        h('span', { className: 'confirm-row-icon' }, '👷'),
        h('div', { className: 'confirm-row-info' },
          h('div', { className: 'confirm-row-label' }, 'Professionista'),
          h('div', { className: 'confirm-row-value' }, booking.professional_name)
        )
      ),
      booking.price && h('div', { className: 'confirm-row' },
        h('span', { className: 'confirm-row-icon' }, '💰'),
        h('div', { className: 'confirm-row-info' },
          h('div', { className: 'confirm-row-label' }, 'Prezzo stimato'),
          h('div', { className: 'confirm-row-value', style: 'color:#1E5B3E' }, '€' + parseFloat(booking.price).toFixed(2))
        )
      ),
      booking.notes && h('div', { className: 'confirm-row' },
        h('span', { className: 'confirm-row-icon' }, '📝'),
        h('div', { className: 'confirm-row-info' },
          h('div', { className: 'confirm-row-label' }, 'Note'),
          h('div', { className: 'confirm-row-value' }, booking.notes)
        )
      )
    ),

    // Actions
    h('div', { className: 'confirm-actions' },
      h('button', {
        className: 'btn-primary',
        onClick: () => navigate('/bookings'),
        style: 'background:var(--success);margin-bottom:10px'
      }, '👀 Vedi le mie prenotazioni'),
      h('button', {
        onClick: () => navigate('/'),
        style: 'width:100%;background:white;color:var(--text);border:2px solid var(--border);border-radius:14px;padding:14px;font-size:15px;font-weight:700;min-height:50px'
      }, '← Torna alla home')
    )
  );
}

// === BOOKINGS PAGE ===
function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/bookings')
      .then(data => setBookings(data.bookings || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return h('div', { className: 'loading-page' }, 'Caricamento...');
  if (error) return h('div', { className: 'page' }, h('div', { className: 'error-msg' }, error));

  return h(Fragment, null,
    h('div', { className: 'page' },
      h('h2', { className: 'page-title' }, 'Le Mie Prenotazioni'),
      bookings.length === 0
        ? h('div', { style: 'text-align:center;color:var(--text-light);padding:40px 0' },
            h('p', null, 'Nessuna prenotazione ancora.'),
            h(Link, { to: '/', style: 'color:var(--primary);font-weight:600;margin-top:8px;display:inline-block' }, 'Prenota ora →')
          )
        : bookings.map(b =>
            h('div', { key: b.id, className: 'booking-card' },
              h('span', { className: `booking-status status-${b.status}` }, b.status),
              h('div', { className: 'booking-service' }, b.service_type),
              h('div', { className: 'booking-meta' }, b.address),
              b.scheduled_at && h('div', { className: 'booking-meta' }, new Date(b.scheduled_at).toLocaleDateString('it-IT')),
              b.price && h('div', { className: 'booking-price' }, '€' + parseFloat(b.price).toFixed(2))
            )
          )
    )
  );
}

// === MAP PAGE (post-ai-diagnosis) ===
function MapPage() {
  const location = useLocation();
  const { state } = location;
  const serviceType = state?.serviceType || '';
  const urgency = state?.urgency || 'medium';
  const analysis = state?.analysis || null;

  const [pros, setPros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLoc, setUserLoc] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [activePro, setActivePro] = useState(null);
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      // Fallback: use Milano center
      setUserLoc({ lat: 45.4642, lng: 9.19 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLoc({ lat: 45.4642, lng: 9.19 }),
      { timeout: 8000 }
    );
  }, []);

  // Track page view
  useEffect(() => {
    track('page_view_map', { serviceType, urgency: urgency || 'medium' });
  }, []);

  // Load nearby professionals
  useEffect(() => {
    if (!userLoc) return;
    setLoading(true);
    api.get(`/api/professionals/nearby?lat=${userLoc.lat}&lng=${userLoc.lng}&service=${serviceType}&urgency=${urgency}`)
      .then(data => setPros(data.professionals || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [userLoc, serviceType, urgency]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!userLoc || mapReady) return;
    const L = window.L;
    if (!L) return;

    const map = L.map('map-container', { zoomControl: false }).setView([userLoc.lat, userLoc.lng], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // User location marker (blue pulse)
    const userIcon = L.divIcon({
      className: '',
      html: '<div style="width:16px;height:16px;background:#1E5B3E;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    L.marker([userLoc.lat, userLoc.lng], { icon: userIcon }).addTo(map).bindPopup('Tu');

    // Pro markers
    pros.forEach(pro => {
      if (!pro.lat || !pro.lng) return;
      const dist = pro.distance_km != null ? parseFloat(pro.distance_km).toFixed(1) : '?';
      const stars = pro.rating ? '★'.repeat(Math.round(parseFloat(pro.rating))) : '★'.repeat(3);
      const serviceLabels = { carwash: '🚿 Car Wash', idraulica: '🔧 Idraulica', elettricista: '⚡ Elettricista', altro: '🔧 Servizio' };
      const label = serviceLabels[pro.service_type] || pro.service_type;
      const color = urgency === 'high' ? '#C43D2F' : '#1E5B3E';

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background:${color};
          color:white;
          width:36px;height:36px;
          border-radius:50% 50% 50% 0;
          border:2px solid white;
          box-shadow:0 3px 8px rgba(0,0,0,.3);
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;
        "><span style="transform:rotate(45deg);font-size:12px">${label.split(' ')[0]}</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      const marker = L.marker([pro.lat, pro.lng], { icon }).addTo(map);
      const reviewLine = pro.review_count
        ? `${pro.review_count} recens. · <a href="/pro/${pro.id}" style="color:#1E5B3E;font-weight:600;text-decoration:none">Vedi profilo →</a>`
        : `<a href="/pro/${pro.id}" style="color:#1E5B3E;font-weight:600;text-decoration:none">Vedi profilo →</a>`;
      const popupContent = `
        <div style="min-width:160px;font-family:Inter,sans-serif">
          <strong style="font-size:14px">${pro.name || 'Professionista FixGo'}</strong>
          <div style="font-size:12px;color:#6C7268;margin:4px 0">${label}</div>
          <div style="font-size:13px;color:#B98A2F;font-weight:700">${stars} ${parseFloat(pro.rating || 0).toFixed(1)}</div>
          <div style="font-size:12px;color:#6C7268">📍 ${dist} km da te</div>
          <div style="font-size:11px;color:#9AA096;margin-top:4px">${pro.completed_jobs || 0} servizi · ${reviewLine}</div>
        </div>
      `;
      marker.bindPopup(popupContent);
      marker.on('click', () => setActivePro(pro));
    });

    // Fit bounds if we have pros
    if (pros.length > 0) {
      const validPros = pros.filter(p => p.lat && p.lng);
      if (validPros.length > 0) {
        const bounds = L.latLngBounds(validPros.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }

    setMapReady(true);
  }, [userLoc, pros, mapReady, urgency]);

  const bookPro = (pro) => {
    navigate('/book', { state: { serviceType: pro.service_type || serviceType, professionalId: pro.id } });
  };

  const serviceLabels = { carwash: 'Lavaggio Auto', idraulica: 'Idraulica', elettricista: 'Elettricista', altro: 'Altro' };
  const urgencyColors = { high: '#C43D2F', medium: '#B98A2F', low: '#2E7D53' };
  const urgencyBadge = urgency ? h('span', { style: `background:${urgencyColors[urgency] || '#6C7268'};color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700` },
    urgency === 'high' ? '🔴 Urgente' : urgency === 'medium' ? '🟡 Medio' : '🟢 Non urgente'
  ) : null;

  return h(Fragment, null,
    // Header
    h('div', { style: 'background:linear-gradient(135deg,#1E5B3E 0%,#14432E 100%);color:white;padding:24px 16px 20px;border-radius:0 0 20px 20px;margin-bottom:16px' },
      h('button', { onClick: () => navigate(-1), style: 'background:none;border:none;color:rgba(255,255,255,.8);font-size:13px;margin-bottom:8px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:0' },
        Icon('arrowLeft', 16), 'Indietro'
      ),
      h('h1', { style: 'font-size:20px;font-weight:800;margin-bottom:6px' },
        'Mappa Professionisti',
        urgencyBadge
      ),
      h('p', { style: 'font-size:13px;opacity:.85' },
        analysis
          ? analysis.problem_description
          : serviceLabels[serviceType] || 'Verifica i professionisti vicino a te'
      ),
      h('div', { style: 'display:flex;gap:8px;margin-top:12px' },
        h('button', {
          onClick: () => setViewMode('map'),
          style: `flex:1;padding:10px;border-radius:10px;border:none;font-weight:600;font-size:13px;cursor:pointer;background:${viewMode==='map'?'white':'rgba(255,255,255,.2)'};color:${viewMode==='map'?'#1E5B3E':'white'}`
        }, '🗺️ Mappa'),
        h('button', {
          onClick: () => setViewMode('list'),
          style: `flex:1;padding:10px;border-radius:10px;border:none;font-weight:600;font-size:13px;cursor:pointer;background:${viewMode==='list'?'white':'rgba(255,255,255,.2)'};color:${viewMode==='list'?'#1E5B3E':'white'}`
        }, '📋 Lista')
      )
    ),

    // Map container
    viewMode === 'map' && h('div', { style: 'margin:0 16px 16px;border-radius:16px;overflow:hidden;border:1px solid var(--border);position:relative;min-height:340px' },
      h('div', { id: 'map-container', style: 'height:340px;width:100%;background:#E5E7EB' }),
      !mapReady && !loading && h('div', { style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.8)' },
        h('span', null, 'Caricamento mappa...')
      )
    ),

    // Pro list
    viewMode === 'list' && h('div', { style: 'padding:0 16px' },
      loading ? h('div', { className: 'loading-page', style: 'min-height:100px' }, 'Caricamento professionisti...')
      : error ? h('div', { style: 'text-align:center;color:var(--danger);padding:20px' }, error)
      : pros.length === 0 ? h('div', { style: 'text-align:center;color:var(--text-light);padding:40px 0' },
          h('p', null, 'Nessun professionista trovato vicino a te.'),
          h('p', { style: 'font-size:13px;margin-top:8px' }, "Riprova da un'altra posizione.")
        )
        : pros.map(pro => {
          const dist = pro.distance_km != null ? parseFloat(pro.distance_km).toFixed(1) : '?';
          const stars = pro.rating ? parseFloat(pro.rating).toFixed(1) : '—';
          return h('div', {
            key: pro.id,
            style: 'background:white;border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px;display:flex;gap:14px;align-items:center',
            onClick: () => setActivePro(activePro?.id === pro.id ? null : pro),
          },
            h('div', { style: 'width:52px;height:52px;border-radius:14px;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:22px;color:white;font-weight:800;flex-shrink:0' },
              pro.name ? pro.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
            ),
            h('div', { style: 'flex:1;min-width:0' },
              h('div', { style: 'font-size:15px;font-weight:700;margin-bottom:2px' }, pro.name || 'Professionista FixGo'),
              h('div', { style: 'font-size:12px;color:var(--text-light);margin-bottom:4px' },
                serviceLabels[pro.service_type] || pro.service_type,
                pro.verified ? ' · ✓ Verificato' : '',
                pro.completed_jobs ? ` · ${pro.completed_jobs} servizi` : ''
              ),
              h('div', { style: 'font-size:13px;color:#B98A2F;font-weight:700;display:flex;align-items:center;gap:6px' },
                '★ ' + stars,
                pro.review_count
                  ? h(Link, { to: `/pro/${pro.id}`, onClick: e => e.stopPropagation(), style: 'color:#1E5B3E;font-size:12px;font-weight:600;text-decoration:none' }, `(${pro.review_count} rec.) →`)
                  : null
              )
            ),
            h('div', { style: 'text-align:right;flex-shrink:0' },
              h('div', { style: 'font-size:14px;font-weight:700;color:var(--text)' }, dist + ' km'),
              h('div', { style: 'font-size:11px;color:var(--text-light)' }, 'distanza')
            )
          );
        })
    ),

    // Active pro detail card
    activePro && h('div', { style: 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:440px;background:white;border-radius:16px 16px 0 0;box-shadow:0 -4px 20px rgba(0,0,0,.15);padding:20px;z-index:200' },
      h('div', { style: 'display:flex;gap:12px;align-items:flex-start;margin-bottom:14px' },
        h('div', { style: 'width:48px;height:48px;border-radius:14px;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:white;flex-shrink:0' },
          activePro.name ? activePro.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
        ),
        h('div', { style: 'flex:1' },
          h('div', { style: 'font-size:16px;font-weight:700' }, activePro.name || 'Professionista FixGo'),
          h('div', { style: 'font-size:13px;color:var(--text-light)' },
            serviceLabels[activePro.service_type] || activePro.service_type,
            ' · ★ ' + parseFloat(activePro.rating || 0).toFixed(1) + ' · ',
            activePro.distance_km != null ? parseFloat(activePro.distance_km).toFixed(1) + ' km da te' : ''
          )
        ),
        h('button', { onClick: () => setActivePro(null), style: 'background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-light);padding:0;line-height:1' }, '✕')
      ),
      activePro.bio && h('p', { style: 'font-size:13px;color:var(--text-light);margin-bottom:10px;line-height:1.5' }, activePro.bio),
      activePro.review_count > 0 && h('div', { style: 'font-size:13px;color:var(--text-light);margin-bottom:12px' },
        '★ ' + parseFloat(activePro.rating || 0).toFixed(1) + ' · ',
        h(Link, {
          to: `/pro/${activePro.id}`,
          onClick: () => setActivePro(null),
          style: 'color:var(--primary);font-weight:600;text-decoration:none'
        }, activePro.review_count + ' recensioni →')
      ),
      h('div', { style: 'display:flex;gap:8px' },
        h('button', {
          onClick: () => bookPro(activePro),
          style: 'flex:1;background:var(--primary);color:white;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;min-height:48px'
        }, 'Prenota ora'),
        h(Link, {
          to: `/pro/${activePro.id}`,
          onClick: () => setActivePro(null),
          style: 'width:48px;background:#F0F9FF;color:#1E5B3E;border:1px solid #BAE6FD;border-radius:12px;font-size:18px;display:flex;align-items:center;justify-content:center;text-decoration:none'
        }, '👤'),
        activePro.phone && h('a', {
          href: 'tel:' + activePro.phone,
          style: 'width:48px;background:#EAF0E7;color:#1E5B3E;border:1px solid #CFE0CC;border-radius:12px;font-size:20px;display:flex;align-items:center;justify-content:center;text-decoration:none'
        }, '📞')
      )
    ),

    // Count bar
    !loading && pros.length > 0 && h('div', { style: 'padding:0 16px 16px;text-align:center;font-size:13px;color:var(--text-light)' },
      `${pros.length} professionista${pros.length !== 1 ? 'i' : ''} trovato${pros.length !== 1 ? 'i' : ''} nel raggio di 50 km`
    ),

    toast && h(Toast, { message: toast, onDone: () => setToast(null) })
  );
}

// === PHOTO ANALYZER PAGE ===
function PhotoAnalyzerPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError("Seleziona un'immagine (JPG, PNG)");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Immagine troppo grande (max 5MB)');
      return;
    }
    setFile(f);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) {
      const fakeEvent = { target: { files: [f] } };
      handleFileChange(fakeEvent);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const clearPhoto = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
  };

  const analyzePhoto = async () => {
    if (!file || analyzing) return;
    setAnalyzing(true);
    setError('');
    try {
      // Convert to base64
      const base64 = preview.split(',')[1];
      const data = await api.post('/api/photo/analyze', { image_base64: base64 });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Analisi fallita. Riprova.');
    } finally {
      setAnalyzing(false);
    }
  };

  const bookWithPro = (pro) => {
    const serviceType = result?.analysis?.service_type || 'altro';
    navigate('/book', { state: { serviceType, professionalId: pro.id } });
  };

  const viewMap = () => {
    const serviceType = result?.analysis?.service_type || 'altro';
    const urgency = result?.analysis?.urgency || 'medium';
    navigate('/map', { state: { serviceType, urgency, analysis: result?.analysis } });
  };

  const serviceLabels = { carwash: 'Lavaggio Auto', idraulica: 'Idraulica', elettricista: 'Elettricista', altro: 'Altro' };
  const urgencyLabels = { high: 'Urgente', medium: 'Medio', low: 'Non urgente' };

  const urgencyClass = result?.analysis?.urgency ? `urgency-${result.analysis.urgency}` : '';

  return h(Fragment, null,
    h('div', { className: 'photo-analyzer' },
      // Hero
      h('div', { className: 'analyzer-hero' },
        h('h1', null, 'Analisi Foto AI'),
        h('p', null, 'Carica una foto del problema — ti diciamo subito chi ti serve e quanto costerà.')
      ),

      // Upload zone
      !preview && h('div', {
        className: 'upload-zone',
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onClick: () => document.getElementById('photo-input').click()
      },
        h('input', {
          id: 'photo-input', type: 'file', accept: 'image/*', onChange: handleFileChange
        }),
        h('div', { className: 'upload-icon' },
          Icon('camera', 28)
        ),
        h('p', null, 'Trascina qui o ', h('strong', null, 'clicca per selezionare')),
        h('p', { style: 'font-size:12px;color:var(--text-light)' }, 'JPG, PNG — max 5MB')
      ),

      // Preview
      preview && h('div', { className: 'photo-preview' },
        h('img', { src: preview, alt: 'Foto problema' }),
        h('button', { className: 'photo-clear', onClick: clearPhoto }, '✕')
      ),

      // Error
      error && h('div', { style: 'margin:0 16px 12px', className: 'error-msg' }, error),

      // Analyze button
      preview && h('button', {
        className: 'analyze-btn',
        onClick: analyzePhoto,
        disabled: analyzing
      },
        analyzing
          ? h('span', { className: 'spinner' })
          : '🔍 Analizza con AI'
      ),

      // Loading
      analyzing && h('div', { className: 'analysis-loading' },
        h('div', { className: 'spinner-lg' }),
        h('p', null, 'Analisi in corso — un attimo...')
      ),

      // Result
      result && h('div', { className: 'analysis-result' },
        h('div', { className: 'result-header' },
          Icon('camera', 22),
          h('span', null, 'Analisi completata'),
          h('span', { className: 'result-service-badge' },
            serviceLabels[result.analysis.service_type] || result.analysis.service_type
          )
        ),
        h('div', { className: 'result-body' },
          h('div', { className: 'result-description' }, result.analysis.problem_description),

          h('div', { className: 'result-grid' },
            h('div', { className: 'result-chip' },
              h('div', { className: 'result-chip-label' }, 'Urgenza'),
              h('div', { className: `result-chip-value ${urgencyClass}` },
                urgencyLabels[result.analysis.urgency] || result.analysis.urgency
              )
            ),
            h('div', { className: 'result-chip' },
              h('div', { className: 'result-chip-label' }, 'Gravità'),
              h('div', { className: 'result-chip-value' },
                result.analysis.severity.charAt(0).toUpperCase() + result.analysis.severity.slice(1)
              )
            ),
            h('div', { className: 'result-chip' },
              h('div', { className: 'result-chip-label' }, 'Affidabilità AI'),
              h('div', { className: 'result-chip-value' },
                Math.round(result.analysis.confidence * 100) + '%'
              )
            ),
            h('div', { className: 'result-chip' },
              h('div', { className: 'result-chip-label' }, 'Servizio'),
              h('div', { className: 'result-chip-value' },
                serviceLabels[result.analysis.service_type] || result.analysis.service_type
              )
            )
          ),

          h('div', { className: 'result-price' },
            h('div', { className: 'result-price-label' }, 'Stima indicativa'),
            h('div', { className: 'result-price-value' },
              '€' + result.price_range.min + ' – €' + result.price_range.max
            )
          ),

          result.analysis.recommendations?.length > 0 && h('div', { className: 'result-recommendations' },
            h('h3', null, 'Raccomandazioni'),
            h('ul', null,
              result.analysis.recommendations.map((r, i) =>
                h('li', { key: i }, r)
              )
            )
          ),

          // Pro Match
          h('div', { className: 'match-pros' },
            h('h3', null, 'Professionisti consigliati'),
            result.matched_professionals?.length > 0
              ? result.matched_professionals.map(pro =>
                  h('div', { key: pro.id, className: 'match-pro-card' },
                    h('div', { className: 'match-pro-avatar' },
                      pro.name ? pro.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
                    ),
                    h('div', { className: 'match-pro-info' },
                      h('div', { className: 'match-pro-name' }, pro.name || 'Professionista FixGo'),
                      h('div', { className: 'match-pro-meta' },
                        serviceLabels[pro.service_type] || pro.service_type,
                        pro.verified ? ' · ✓ Verificato' : ''
                      )
                    ),
                    pro.rating != null && h('div', { className: 'match-pro-rating' },
                      '★ ' + parseFloat(pro.rating).toFixed(1)
                    )
                  )
                )
              : h('div', { className: 'no-pros-msg' },
                  'Nessun professionista disponibile per questo servizio al momento. Riprova più tardi.'
                )
          ),

          result.matched_professionals?.length > 0 && h('button', {
            className: 'book-pro-btn',
            onClick: () => bookWithPro(result.matched_professionals[0])
          },
            'Prenota ' + (result.matched_professionals[0]?.name?.split(' ')[0] || 'Professionista') + ' — da €' + result.price_range.min
          ),

          h('button', {
            onClick: viewMap,
            style: 'display:block;width:100%;background:linear-gradient(135deg,#1E5B3E,#14432E);color:white;font-size:15px;font-weight:700;padding:14px;border:none;border-radius:12px;margin-top:10px;min-height:48px'
          }, '🗺️ Vedi sulla mappa — professionisti vicino a te')
        )
      )
    ),
    toast && h(Toast, { message: toast, onDone: () => setToast(null) })
  );
}

// === BOOKING CONFIRM PAGE (direct URL access) ===
function BookingConfirmPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/api/bookings/${id}`)
      .then(data => {
        setBooking(data.booking);
        track('page_view_booking_confirm', { bookingId: id, serviceType: data.booking?.service_type });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return h('div', { className: 'loading-page' }, 'Caricamento...');
  if (error) return h('div', { className: 'page' }, h('div', { className: 'error-msg' }, error));
  if (!booking) return h('div', { className: 'page' }, h('p', null, 'Prenotazione non trovata.'));

  return h(ConfirmScreen, { booking, navigate });
}

// === PAYMENT SUCCESS PAGE ===
function PaymentSuccessPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    track('payment_success', { bookingId: id });
  }, [id]);

  return h('div', { className: 'page' },
    h('div', { style: 'text-align:center;padding:60px 16px' },
      h('div', { style: 'font-size:64px;margin-bottom:16px' }, '🎉'),
      h('h1', { className: 'page-title', style: 'margin-bottom:8px' }, 'Pagamento completato!'),
      h('p', { style: 'color:var(--text-light);margin-bottom:32px' },
        'La tua prenotazione #' + id + ' è stata confermata.'
      ),
      h('button', {
        className: 'btn-primary',
        onClick: () => navigate('/bookings'),
        style: 'background:var(--success)'
      }, 'Vedi le mie prenotazioni'),
      h('button', {
        className: 'btn-secondary',
        onClick: () => navigate('/'),
        style: 'margin-top:10px'
      }, 'Torna alla home')
    )
  );
}

// === CHAT PAGE ===
function ChatPage() {
  return h('div', { className: 'page' },
    h('h2', { className: 'page-title' }, 'Chat'),
    h('div', { style: 'text-align:center;color:var(--text-light);padding:60px 0' },
      h('p', null, 'Messaggi in arrivo dopo la prima prenotazione.')
    )
  );
}

// === PRO VERIFY PAGE (KYC) ===
function ProVerifyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/verification/status', {
      headers: { Authorization: `Bearer ${safeStorage.getItem('fixgo_token')}` }
    }).then(r => r.json()).then(d => {
      setStatus(d.verification_status);
      setLoading(false);
      if (d.verification_status === 'verified') {
        navigate('/pro/dashboard');
      }
    }).catch(() => { setLoading(false); });
  }, []);

  // Track page view
  useEffect(() => {
    track('page_view_verification', { status });
  }, [status]);

  const startVerification = async () => {
    setStarting(true);
    setError(null);
    track('verification_started');
    try {
      const res = await fetch('/api/verification/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${safeStorage.getItem('fixgo_token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore durante l avvio della verifica');

      if (data.status === 'verified') {
        navigate('/pro/dashboard');
        return;
      }

      // Launch Sumsub Web SDK
      if (window.sumsub && data.token) {
        const sns = window.sumsub;
        sns.createOneShot({
          token: data.token,
          applicantEmail: user?.email,
          applicantFirstName: user?.name ? user.name.split(' ')[0] : '',
          applicantLastName: user?.name ? user.name.split(' ').slice(1).join(' ') : '',
          config: {
            lang: 'it',
            forceUseMobileScanner: true,
          },
          callbacks: {
            onReady: () => console.log('[sumsub] SDK ready'),
            onApplicantCreated: (applicantId) => console.log('[sumsub] applicant:', applicantId),
            onStepCompleted: (payload) => console.log('[sumsub] step completed:', payload),
            onPending: (applicantId) => {
              console.log('[sumsub] pending:', applicantId);
              setStatus('in_review');
            },
            onError: (err) => {
              console.error('[sumsub] error:', err);
              setError('Verifica interrotta. Riprova.');
              setStarting(false);
            },
          }
        });
      } else {
        // Fallback: redirect to external verification link
        setError('SDK non disponibile. Contatta il supporto.');
      }
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  };

  if (loading) {
    return h('div', { className: 'page', style: 'display:flex;align-items:center;justify-content:center;min-height:60vh' },
      h('span', { className: 'spinner' })
    );
  }

  const statusMessages = {
    in_review: { text: 'Verifica in corso', sub: 'Il tuo documento è in fase di revisione. Ti informeremo quando il controllo sarà completato.', color: '#B98A2F', icon: '⏳' },
    rejected: { text: 'Verifica fallita', sub: 'Non abbiamo potuto verificare il tuo documento. Riprova con una foto più chiara o un altro documento.', color: '#C43D2F', icon: '❌' },
    pending: { text: 'Verifica necessaria', sub: 'Completa la verifica del tuo account per iniziare a ricevere richieste.', color: '#1E5B3E', icon: '🔒' },
  };

  const msg = statusMessages[status] || statusMessages.pending;

  return h('div', { className: 'page' },
    h('div', { style: 'max-width:480px;margin:0 auto;text-align:center;padding-top:40px' },
      h('div', { style: `width:80px;height:80px;border-radius:50%;background:${msg.color}20;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:36px` },
        msg.icon
      ),
      h('h1', { style: 'font-size:22px;font-weight:700;margin-bottom:8px' }, msg.text),
      h('p', { style: 'color:var(--text-light);font-size:14px;line-height:1.6;margin-bottom:32px' }, msg.sub),

      status === 'rejected' && h('button', {
        className: 'btn-primary',
        onClick: startVerification,
        disabled: starting,
        style: 'width:100%;padding:14px;font-size:16px;background:#C43D2F'
      }, starting ? '⏳ Riavvio...' : '🔄 Riprova verifica'),

      (status === 'pending' || status === 'in_review') && h('button', {
        className: 'btn-primary',
        onClick: startVerification,
        disabled: starting,
        style: 'width:100%;padding:14px;font-size:16px'
      }, starting ? '⏳ Avvio...' : '▶ Inizia verifica'),

      error && h('div', { style: 'margin-top:16px;padding:12px;background:#FBECE8;border-radius:8px;color:#C43D2F;font-size:13px' }, error),

      h('div', { style: 'margin-top:40px;padding:16px;background:#F8FAFC;border-radius:12px;text-align:left' },
        h('div', { style: 'font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text)' }, 'Cosa serve per la verifica:'),
        h('ul', { style: 'padding-left:18px;font-size:13px;color:var(--text-light);line-height:1.8' },
          h('li', null, 'Documento d identità (carta d identità o passaporto)'),
          h('li', null, 'Selfie con il documento'),
          h('li', null, 'Buona illuminazione, nessuna riflessione')
        )
      ),

      h('button', {
        onClick: () => navigate('/pro/dashboard'),
        style: 'margin-top:16px;background:none;border:none;color:var(--text-light);font-size:13px;text-decoration:underline'
      }, '← Torna alla dashboard')
    )
  );
}

// === PRO DASHBOARD PAGE ===
function ProDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [pro, setPro] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifStatus, setVerifStatus] = useState('pending');

  useEffect(() => {
    loadData();
    // Check verification status
    fetch('/api/verification/status', {
      headers: { Authorization: `Bearer ${safeStorage.getItem('fixgo_token')}` }
    }).then(r => r.json()).then(d => setVerifStatus(d.verification_status || 'pending')).catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      const [bData, eData] = await Promise.all([
        api.get('/api/pro/bookings'),
        api.get('/api/pro/earnings'),
      ]);
      setBookings(bData.bookings || []);
      setEarnings(eData.earnings);
      const me = await api.get('/api/auth/me');
      const proRes = await fetch('/api/professionals', {
        headers: { Authorization: `Bearer ${safeStorage.getItem('fixgo_token')}` }
      }).then(r => r.json()).catch(() => ({ professionals: [] }));
      // Find this user's pro record
      const myPro = (proRes.professionals || []).find(p => p.user_id === user.id);
      setPro(myPro);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async () => {
    try {
      const res = await api.patch('/api/pro/profile', { is_available: !pro?.is_available });
      setPro(res.professional);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAction = async (bookingId, status) => {
    try {
      await api.patch(`/api/pro/bookings/${bookingId}`, { status });
      setBookings(prev => prev.filter(b => b.id !== bookingId));
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  const todayBookings = bookings.filter(b => {
    const d = new Date(b.scheduled_at || b.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString() && b.status === 'accepted';
  }).length;

  const weekBookings = bookings.filter(b => {
    const d = new Date(b.scheduled_at || b.created_at);
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 86400000);
    return d >= now && d <= weekFromNow && b.status === 'accepted';
  }).length;

  const pending = bookings.filter(b => b.status === 'pending').length;

  const SERVICE_NAMES = { idraulica: 'Idraulica', elettricista: 'Elettricista', carwash: 'Car Wash', pulizie: 'Pulizie', altro: 'Altro' };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m fa`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h fa`;
    return `${Math.floor(hrs / 24)}g fa`;
  };

  const maskName = (name) => {
    if (!name) return 'Cliente';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return parts[0] + ' ' + parts[1][0] + '.';
  };

  const extractCity = (address) => {
    if (!address) return 'Milano';
    const parts = address.split(',');
    return parts[parts.length - 1].trim() || 'Milano';
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return { day: d.getDate(), month: d.toLocaleString('default', { month: 'short' }) };
  };

  if (loading) return h('div', { style: 'display:flex;align-items:center;justify-content:center;min-height:60vh' }, h('span', { className: 'spinner' }));

  const pendingRequests = bookings.filter(b => b.status === 'pending');
  const upcoming = bookings.filter(b => ['accepted', 'confirmed'].includes(b.status));

  return h(Fragment, null,
    // Verification banner for non-verified pros
    verifStatus !== 'verified' && h('div', {
      style: `margin:0 -16px 16px;padding:12px 16px;background:${verifStatus === 'rejected' ? '#FBECE8' : '#EAF0E7'};border-bottom:1px solid ${verifStatus === 'rejected' ? '#FECACA' : '#BFDBFE'};display:flex;align-items:center;gap:10px;cursor:pointer`,
      onClick: () => navigate('/pro/verify')
    },
      h('span', { style: 'font-size:18px' }, verifStatus === 'rejected' ? '❌' : verifStatus === 'in_review' ? '⏳' : '🔒'),
      h('div', { style: 'flex:1' },
        h('div', { style: `font-size:13px;font-weight:600;color:${verifStatus === 'rejected' ? '#DC2626' : '#1D4ED8'}` },
          verifStatus === 'rejected' ? 'Verifica fallita' : verifStatus === 'in_review' ? 'Verifica in corso' : 'Account in verifica'
        ),
        h('div', { style: 'font-size:11px;color:#6C7268' },
          verifStatus === 'rejected' ? 'Riprova per attivare il tuo account' : 'Completa la verifica per ricevere prenotazioni'
        )
      ),
      h('span', { style: 'color:#9AA096;font-size:18px' }, '›')
    ),

    // Header
    h('div', { className: 'pro-header' },
      h('div', { className: 'pro-avatar' }, '👷'),
      h('div', { className: 'pro-info' },
        h('div', { className: 'pro-name' }, user?.name || 'Professionista'),
        h('span', { className: `pro-badge ${pro?.is_available ? 'badge-online' : 'badge-offline'}` },
          pro?.is_available ? '● Online' : '○ Offline'
        ),
        h('div', { className: 'availability-toggle' },
          h('div', { className: `toggle-switch ${pro?.is_available ? 'on' : ''}`, onClick: toggleAvailability }),
          h('span', { className: 'toggle-label' }, pro?.is_available ? 'Attivo' : 'Disattivato')
        )
      )
    ),

    // Stats
    h('div', { className: 'stats-grid' },
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-label' }, 'Oggi'),
        h('div', { className: 'stat-value' }, todayBookings),
        h('div', { className: 'stat-sub' }, 'appuntamenti')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-label' }, 'Questa settimana'),
        h('div', { className: 'stat-value' }, weekBookings),
        h('div', { className: 'stat-sub' }, 'appuntamenti')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-label' }, 'Richieste'),
        h('div', { className: 'stat-value' }, pending),
        h('div', { className: 'stat-sub' }, 'in attesa')
      ),
      h('div', { className: 'stat-card' },
        h('div', { className: 'stat-label' }, 'Guadagni mese'),
        h('div', { className: 'stat-value' }, '€' + Math.round(earnings?.netEarnings || 0)),
        h('div', { className: 'stat-sub' }, `${earnings?.bookings?.length || 0} prenotazioni`)
      )
    ),

    // Pending Requests
    h('div', { className: 'pro-section' },
      h('div', { className: 'pro-section-title' },
        h('span', { className: 'dot' }),
        'Richieste in arrivo (', pendingRequests.length, ')'
      ),
      pendingRequests.length === 0
        ? h('div', { className: 'pro-empty' },
            h('div', { className: 'pro-empty-icon' }, '📭'),
            h('div', { className: 'pro-empty-text' }, 'Nessuna richiesta al momento')
          )
        : pendingRequests.map(b =>
            h('div', { key: b.id, className: 'request-card' },
              h('div', { className: 'request-header' },
                h('div', { className: 'request-service' },
                  SERVICE_NAMES[b.service_type] || b.service_type,
                  b.notes?.toLowerCase().includes('urgent') || b.notes?.toLowerCase().includes('urgente')
                    ? h('span', { className: 'urgency-badge urgency-high' }, 'Urgente')
                    : h('span', { className: 'urgency-badge urgency-medium' }, 'Normale')
                ),
                h('span', { className: 'time-ago' }, timeAgo(b.created_at))
              ),
              h('div', { className: 'request-client' }, 'Cliente: ' + maskName(b.client_name)),
              h('div', { className: 'request-address' }, extractCity(b.address)),
              h('div', { className: 'request-meta' },
                h('span', { className: 'meta-tag' }, '📍 ', extractCity(b.address)),
                b.price ? h('span', { className: 'meta-tag' }, '💰 €' + b.price) : null
              ),
              h('div', { className: 'request-body' },
                h('div', { className: 'photo-thumb' }, '📷'),
                h('div', { className: 'request-info' },
                  h('div', { className: 'price-estimate' }, b.price ? '€' + b.price : 'Prezzo da definire')
                )
              ),
              h('div', { className: 'request-actions' },
                h('button', { className: 'btn-accept', onClick: () => handleAction(b.id, 'accepted') }, '✓ Accetta'),
                h('button', { className: 'btn-decline', onClick: () => handleAction(b.id, 'declined') }, '✗ Rifiuta')
              )
            )
          )
    ),

    // Upcoming Appointments
    h('div', { className: 'pro-section' },
      h('div', { className: 'pro-section-title' },
        h('span', null, '📅'),
        'Prossimi appuntamenti'
      ),
      upcoming.length === 0
        ? h('div', { className: 'pro-empty' },
            h('div', { className: 'pro-empty-icon' }, '📅'),
            h('div', { className: 'pro-empty-text' }, 'Nessun appuntamento confermato')
          )
        : upcoming.map(b => {
            const dt = formatDate(b.scheduled_at || b.created_at);
            return h('div', { key: b.id, className: 'appointment-card' },
              h('div', { className: 'appt-date' },
                h('div', { className: 'appt-day' }, dt.day),
                h('div', { className: 'appt-month' }, dt.month)
              ),
              h('div', { className: 'appt-info' },
                h('div', { className: 'appt-client' }, maskName(b.client_name)),
                h('div', { className: 'appt-service' }, SERVICE_NAMES[b.service_type] || b.service_type),
                h('div', { className: 'appt-location' }, extractCity(b.address))
              ),
              h('div', { className: 'appt-earnings' }, b.price ? '€' + Math.max(0, parseFloat(b.price) - 10) : '—')
            );
          })
    ),

    // Pro bottom nav
    h('nav', { className: 'pro-nav' },
      h(Link, { to: '/pro/dashboard', className: 'pro-nav-item active' }, Icon('home'), 'Dashboard'),
      h(Link, { to: '/pro/appointments', className: 'pro-nav-item' }, Icon('calendar'), 'Appuntamenti'),
      h(Link, { to: '/pro/profile', className: 'pro-nav-item' }, Icon('user'), 'Profilo')
    )
  );
}

// === PRO APPOINTMENTS PAGE ===
function ProAppointmentsPage() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const data = await api.get('/api/pro/bookings');
      setBookings(data.bookings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const SERVICE_NAMES = { idraulica: 'Idraulica', elettricista: 'Elettricista', carwash: 'Car Wash', pulizie: 'Pulizie', altro: 'Altro' };
  const STATUS_NAMES = { pending: 'In attesa', accepted: 'Accettato', declined: 'Rifiutato', confirmed: 'Confermato', cancelled: 'Cancellato', completed: 'Completato' };

  const maskName = (name) => {
    if (!name) return 'Cliente';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return parts[0] + ' ' + parts[1][0] + '.';
  };

  const extractCity = (address) => {
    if (!address) return 'Milano';
    const parts = address.split(',');
    return parts[parts.length - 1].trim() || 'Milano';
  };

  const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  if (loading) return h('div', { style: 'display:flex;align-items:center;justify-content:center;min-height:60vh' }, h('span', { className: 'spinner' }));

  const filters = [
    { key: 'all', label: 'Tutti' },
    { key: 'pending', label: 'In attesa' },
    { key: 'accepted', label: 'Accettati' },
    { key: 'confirmed', label: 'Confermati' },
    { key: 'completed', label: 'Completati' },
  ];

  return h(Fragment, null,
    h('div', { className: 'page' },
      h('h2', { style: 'font-size:22px;font-weight:800;margin-bottom:16px' }, 'Appuntamenti')
    ),
    h('div', { style: 'display:flex;gap:8px;padding:0 16px 16px;overflow-x:auto' },
      filters.map(f => h('button', {
        key: f.key,
        onClick: () => setFilter(f.key),
        style: `padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;${filter === f.key ? 'background:var(--primary);color:white' : 'background:white;border:1px solid var(--border);color:var(--text-light)'}`
      }, f.label))
    ),
    h('div', { style: 'padding:0 16px' },
      filtered.length === 0
        ? h('div', { className: 'pro-empty' }, h('div', { className: 'pro-empty-icon' }, '📋'), h('div', { className: 'pro-empty-text' }, 'Nessun appuntamento'))
        : filtered.map(b => h('div', {
            key: b.id,
            className: 'appointment-card',
            style: `opacity:${b.status === 'declined' || b.status === 'cancelled' ? 0.5 : 1}`
          },
            h('div', { className: 'appt-date' },
              h('div', { className: 'appt-day', style: 'font-size:18px' }, new Date(b.scheduled_at || b.created_at).getDate()),
              h('div', { className: 'appt-month' }, new Date(b.scheduled_at || b.created_at).toLocaleString('default', { month: 'short' }))
            ),
            h('div', { className: 'appt-info' },
              h('div', { className: 'appt-client' }, maskName(b.client_name)),
              h('div', { className: 'appt-service' }, SERVICE_NAMES[b.service_type] || b.service_type),
              h('div', { className: 'appt-location' }, extractCity(b.address))
            ),
            h('div', { style: 'display:flex;flex-direction:column;align-items:flex-end;gap:4px' },
              h('div', { className: 'appt-earnings' }, b.price ? '€' + Math.max(0, parseFloat(b.price) - 10) : '—'),
              h('span', {
                style: `font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;${b.status === 'accepted' || b.status === 'confirmed' ? 'background:#D1FAE5;color:#065F46' : b.status === 'pending' ? 'background:#F4EBD6;color:#92400E' : b.status === 'completed' ? 'background:#EAF0E7;color:var(--primary)' : 'background:#F6DBD5;color:#991B1B'}`
              }, STATUS_NAMES[b.status] || b.status)
            )
          ))
    ),
    h('nav', { className: 'pro-nav' },
      h(Link, { to: '/pro/dashboard', className: 'pro-nav-item' }, Icon('home'), 'Dashboard'),
      h(Link, { to: '/pro/appointments', className: 'pro-nav-item active' }, Icon('calendar'), 'Appuntamenti'),
      h(Link, { to: '/pro/profile', className: 'pro-nav-item' }, Icon('user'), 'Profilo')
    )
  );
}

// === PRO PROFILE PAGE ===
function ProProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pro, setPro] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/pro/earnings'),
      fetch('/api/professionals', {
        headers: { Authorization: `Bearer ${safeStorage.getItem('fixgo_token')}` }
      }).then(r => r.json()).catch(() => ({ professionals: [] }))
    ]).then(([eData, proData]) => {
      setEarnings(eData.earnings);
      const myPro = (proData.professionals || []).find(p => p.user_id === user.id);
      setPro(myPro);
    }).catch(err => console.error(err)).finally(() => setLoading(false));
  }, []);

  const SERVICE_NAMES = { idraulica: 'Idraulica', elettricista: 'Elettricista', carwash: 'Car Wash', pulizie: 'Pulizie', altro: 'Altro' };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) return h('div', { style: 'display:flex;align-items:center;justify-content:center;min-height:60vh' }, h('span', { className: 'spinner' }));

  return h(Fragment, null,
    h('div', { className: 'page' },
      h('h2', { style: 'font-size:22px;font-weight:800;margin-bottom:20px' }, 'Profilo')
    ),

    // Account card
    h('div', { className: 'profile-section' },
      h('div', { className: 'profile-card' },
        h('div', { style: 'display:flex;align-items:center;gap:14px;margin-bottom:16px' },
          h('div', { style: 'width:56px;height:56px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:28px;color:white' }, '👷'),
          h('div', null,
            h('div', { style: 'font-size:18px;font-weight:800' }, user?.name),
            h('div', { style: 'font-size:13px;color:var(--text-light)' }, user?.email)
          )
        ),
        h('div', { className: 'profile-row' },
          h('span', { className: 'profile-label' }, 'Ruolo'),
          h('span', { className: 'profile-value' }, 'Professionista')
        ),
        pro?.service_type ? h('div', { className: 'profile-row' },
          h('span', { className: 'profile-label' }, 'Servizio'),
          h('span', { className: 'profile-value' }, SERVICE_NAMES[pro.service_type] || pro.service_type)
        ) : null,
        h('div', { className: 'profile-row' },
          h('span', { className: 'profile-label' }, 'Stato'),
          h('span', { className: 'profile-value', style: pro?.is_available ? 'color:#2E7D53' : 'color:#C43D2F' },
            pro?.is_available ? '● Online' : '○ Offline'
          )
        )
      )
    ),

    // Earnings
    h('div', { className: 'profile-section' },
      h('h3', { style: 'font-size:17px;font-weight:700;margin-bottom:12px' }, 'Guadagni'),
      h('div', { style: 'background:white;border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;text-align:center' },
        h('div', { style: 'font-size:12px;color:var(--text-light);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px' }, earnings?.month || ''),
        h('div', { style: 'font-size:36px;font-weight:800;color:var(--success)' }, '€' + Math.round(earnings?.netEarnings || 0)),
        h('div', { style: 'font-size:13px;color:var(--text-light);margin-top:4px' }, 'netto da ', earnings?.platformFees || 0, ' € di fee FixGo')
      ),
      h('div', { className: 'earnings-list' },
        (earnings?.bookings || []).map(b =>
          h('div', { key: b.id, className: 'earnings-item' },
            h('div', { className: 'earnings-detail' },
              h('div', { className: 'earnings-service' }, SERVICE_NAMES[b.service_type] || b.service_type),
              h('div', { className: 'earnings-date' }, new Date(b.created_at).toLocaleDateString('it-IT'))
            ),
            h('div', null,
              h('div', { style: 'font-size:11px;color:var(--text-light)' }, '€' + b.price + ' lordo'),
              h('div', { className: 'earnings-fee' }, '€' + Math.max(0, (parseFloat(b.price) || 0) - 10))
            )
          )
        )
      )
    ),

    h('div', { className: 'profile-section' },
      h('button', {
        onClick: handleLogout,
        style: 'width:100%;padding:14px;background:white;border:2px solid var(--danger);color:var(--danger);border-radius:12px;font-size:15px;font-weight:700;cursor:pointer'
      }, 'Logout')
    ),

    h('nav', { className: 'pro-nav' },
      h(Link, { to: '/pro/dashboard', className: 'pro-nav-item' }, Icon('home'), 'Dashboard'),
      h(Link, { to: '/pro/appointments', className: 'pro-nav-item' }, Icon('calendar'), 'Appuntamenti'),
      h(Link, { to: '/pro/profile', className: 'pro-nav-item active' }, Icon('user'), 'Profilo')
    )
  );
}

// === STAR RATING COMPONENT ===
function StarRating({ value, onChange, size }) {
  return h('div', { className: 'star-rating' },
    [1, 2, 3, 4, 5].map(n =>
      h('span', {
        key: n,
        className: 'star' + (n <= value ? ' filled' : ''),
        onClick: () => onChange && onChange(n),
        style: { fontSize: size === 'small' ? 20 + 'px' : '32px' }
      }, '★')
    )
  );
}

// === REVIEW MODAL ===
function ReviewModal({ booking, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1) { setError('Seleziona almeno 1 stella'); return; }
    setLoading(true);
    setError('');
    try {
      await onSubmit(booking.id, rating, comment.trim() || null);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return h('div', { className: 'review-overlay' },
      h('div', { className: 'review-modal' },
        h('div', { className: 'review-success' },
          h('div', { className: 'big-emoji' }, '🙏'),
          h('h2', null, 'Grazie per la tua recensione!'),
          h('p', null, 'La tua opinione aiuta altri clienti a scegliere il professionista migliore.'),
          h('button', {
            className: 'btn-primary',
            style: 'margin-top:20px;width:100%',
            onClick: onClose
          }, 'Chiudi')
        )
      )
    );
  }

  return h('div', { className: 'review-overlay' },
    h('div', { className: 'review-modal' },
      h('button', {
        onClick: onClose,
        style: 'position:absolute;top:16px;right:20px;background:none;border:none;font-size:24px;color:var(--text-light);cursor:pointer'
      }, '×'),
      h('h2', null, 'Come è andata?'),
      h('p', { className: 'review-sub' }, 'Lascia una recensione per ' + (booking.pro_name || 'il professionista')),
      h('div', { className: 'review-label' }, 'Valutazione *'),
      h(StarRating, { value: rating, onChange: setRating }),
      error ? h('div', { style: 'color:var(--danger);font-size:13px;margin:10px 0' }, error) : null,
      h('div', { className: 'review-label', style: 'margin-top:20px' }, 'Commento (opzionale)'),
      h('textarea', {
        placeholder: 'Descrivi la tua esperienza... (min 10 caratteri)',
        value: comment,
        onInput: e => setComment(e.target.value)
      }),
      h('div', { style: 'display:' + 'flex;gap:10px;margin-top:20px' },
        h('button', {
          className: 'btn-secondary',
          style: 'flex:1;padding:14px;border:1px solid var(--border);border-radius:12px;background:none;font-weight:600',
          onClick: onClose
        }, 'Annulla'),
        h('button', {
          className: 'btn-primary',
          style: 'flex:1',
          onClick: handleSubmit,
          disabled: loading
        }, loading ? 'Invio...' : 'Invia recensione')
      )
    )
  );
}

// === PROFILE PAGE ===
function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loadingB, setLoadingB] = useState(true);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    api.get('/api/bookings/my')
      .then(data => setBookings(data.bookings || []))
      .catch(() => {})
      .finally(() => setLoadingB(false));
    // Check push subscription status on mount
    pushManager.isSubscribed().then(subscribed => setPushEnabled(subscribed)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSubmitReview = async (bookingId, rating, comment) => {
    await api.post('/api/reviews', { booking_id: bookingId, rating, comment });
    setReviewBooking(null);
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, has_review: true } : b));
  };

  const initials = user ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

  const statusBadge = (status) => {
    const map = { pending: 'badge-in_attesa', confirmed: 'badge-confermato', completed: 'badge-completed', cancelled: 'badge-annullato' };
    const labels = { pending: 'In attesa', confirmed: 'Confermato', completed: 'Completato', cancelled: 'Annullato' };
    return h('span', { className: 'booking-status ' + (map[status] || 'badge-in_attesa') }, labels[status] || status);
  };

  return h(Fragment, null,
    h('div', { className: 'profile-header' },
      h('div', { className: 'avatar' }, initials),
      h('div', { className: 'profile-info' },
        h('h2', null, user ? user.name : '—'),
        user?.email && h('p', { style: 'font-size:13px;color:var(--text-light);margin-top:2px' }, user.email)
      )
    ),

    // Le mie prenotazioni
    h('div', { className: 'page' },
      h('h3', { style: 'font-size:17px;font-weight:700;margin-bottom:12px' }, 'Le mie prenotazioni'),
      loadingB
        ? h('div', { style: 'text-align:center;color:var(--text-light);padding:20px' }, 'Caricamento...')
        : bookings.length === 0
          ? h('div', { style: 'text-align:center;color:var(--text-light);padding:20px' }, 'Nessuna prenotazione ancora.')
          : bookings.map(b =>
              h('div', { key: b.id, className: 'profile-booking-card' },
                h('div', { className: 'profile-booking-header' },
                  h('div', null,
                    h('div', { className: 'profile-booking-service' }, b.service_type),
                    h('div', { className: 'profile-booking-meta' },
                      b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ' · ' : '',
                      b.address || ''
                    )
                  ),
                  statusBadge(b.status)
                ),
                b.price && h('div', { style: 'font-size:15px;font-weight:700;color:var(--primary);margin-top:4px' }, '€' + parseFloat(b.price).toFixed(2)),
                b.status === 'completed' && !b.has_review
                  ? h('button', {
                      className: 'btn-review',
                      onClick: () => setReviewBooking(b)
                    }, 'Lascia recensione')
                  : null
              )
            )
    ),

    // Metodi di pagamento (placeholder UI)
    h('div', { className: 'page', style: 'margin-top:8px' },
      h('h3', { style: 'font-size:17px;font-weight:700;margin-bottom:12px' }, 'Metodi di pagamento'),
      h('div', { style: 'background:var(--white);border:1px solid var(--border);border-radius:14px;padding:0 16px' },
        h('div', { className: 'payment-card-row' },
          h('div', { className: 'payment-card-icon' }, 'VISA'),
          h('div', { className: 'payment-card-info' },
            h('div', { className: 'payment-card-number' }, '•••• •••• •••• 4242'),
            h('div', { className: 'payment-card-brand' }, 'Visa • Scade 12/26')
          ),
          h('span', { style: 'font-size:12px;color:var(--text-light)' }, 'Principale')
        )
      )
    ),

    // Impostazioni
    h('div', { className: 'page', style: 'margin-top:8px' },
      h('h3', { style: 'font-size:17px;font-weight:700;margin-bottom:12px' }, 'Impostazioni'),
      h('div', { style: 'background:var(--white);border:1px solid var(--border);border-radius:14px;padding:0 16px' },
        h('div', { className: 'profile-settings-row' },
          h('span', { className: 'profile-settings-label' }, 'Notifiche push'),
          h('label', { className: 'profile-toggle' },
            h('input', {
              type: 'checkbox',
              checked: pushEnabled,
              onChange: async e => {
                const enable = e.target.checked;
                try {
                  if (enable) {
                    const supported = await pushManager.isSupported();
                    if (!supported) {
                      alert('Notifiche push non supportate dal tuo browser. Prova Chrome o Safari.');
                      return;
                    }
                    await pushManager.subscribe();
                    setPushEnabled(true);
                  } else {
                    await pushManager.unsubscribe();
                    setPushEnabled(false);
                  }
                } catch (err) {
                  console.error('[push] toggle error:', err.message);
                  setPushEnabled(!enable);
                }
              }
            }),
            h('span', { className: 'slider' })
          )
        ),
        h('div', { className: 'profile-settings-row', style: 'border:none' },
          h('span', { className: 'profile-settings-label' }, 'Lingua'),
          h('span', { style: 'font-size:13px;color:var(--text-light)' }, 'Italiano')
        )
      )
    ),

    // Logout button
    h('div', { className: 'page', style: 'margin-top:8px;padding-bottom:32px' },
      h('button', {
        onClick: handleLogout,
        style: 'width:100%;padding:16px;background:none;border:1px solid var(--danger);border-radius:12px;color:var(--danger);font-size:15px;font-weight:600;cursor:pointer'
      }, 'Logout')
    ),

    reviewBooking && h(ReviewModal, {
      booking: reviewBooking,
      onClose: () => setReviewBooking(null),
      onSubmit: handleSubmitReview
    })
  );
}

// === LOGIN PAGE ===
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleGoogle = async () => {
    // Mock Google OAuth — in production, use Google Identity Services
    try {
      const mockGoogleId = 'google_' + Math.random().toString(36).slice(2);
      const data = await api.post('/api/auth/google', { googleId: mockGoogleId, email: email || 'demo@fixgo.app', name: 'Demo Utente' });
      safeStorage.setItem('fixgo_token', data.token);
      window.location.reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userData = await (async () => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        safeStorage.setItem('fixgo_token', data.token);
        return data.user;
      })();
      setUser(userData);
      track('login_completed', { role: userData.role });
      if (userData.role === 'professional') {
        // Check verification before redirecting to dashboard
        const vRes = await fetch('/api/verification/status', {
          headers: { Authorization: `Bearer ${safeStorage.getItem('fixgo_token')}` }
        }).catch(() => ({ ok: false }));
        if (vRes.ok) {
          const vData = await vRes.json();
          if (vData.verification_status === 'verified') {
            navigate('/pro/dashboard');
          } else {
            navigate('/pro/verify');
          }
        } else {
          navigate('/pro/verify');
        }
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return h('div', { className: 'auth-page' },
    h('div', { className: 'auth-logo' },
      h('h1', null, 'FixGo'),
      h('p', null, 'Accedi al tuo account')
    ),
    h('div', { className: 'error-msg' }, error),
    h('form', { onSubmit: handleSubmit },
      h('div', { className: 'form-group' },
        h('label', { className: 'form-label' }, 'Email'),
        h('input', {
          className: 'form-input' + (error ? ' error' : ''),
          type: 'email', placeholder: 'email@esempio.it',
          value: email, onChange: e => setEmail(e.target.value), required: true, autoComplete: 'email'
        })
      ),
      h('div', { className: 'form-group' },
        h('label', { className: 'form-label' }, 'Password'),
        h('input', {
          className: 'form-input',
          type: 'password', placeholder: '••••••••',
          value: password, onChange: e => setPassword(e.target.value), required: true, autoComplete: 'current-password'
        })
      ),
      h('div', null,
        h(Link, { to: '/forgot-password', style: 'font-size:13px;color:var(--primary);margin-bottom:12px;display:inline-block' }, 'Password dimenticata?')
      ),
      h('button', { className: 'btn-primary', type: 'submit', disabled: loading },
        loading ? h('span', { className: 'spinner' }) : 'Accedi'
      )
    ),
    h('p', { className: 'auth-link' },
      'Non hai un account? ', h(Link, { to: '/register' }, 'Registrati')
    )
  );
}

// === REGISTER PAGE ===
function RegisterPage() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(email, password, (name.trim() + ' ' + surname.trim()).trim(), role);
      track('register_completed', { role });
      navigate(role === 'professional' ? '/pro/verify' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return h('div', { className: 'auth-page' },
    h('div', { className: 'auth-logo' },
      h('h1', null, 'FixGo'),
      h('p', null, 'Crea il tuo account')
    ),
    h('div', { className: 'error-msg' }, error),
    h('form', { onSubmit: handleSubmit },
      h('div', { className: 'form-group' },
        h('label', { className: 'form-label' }, 'Nome'),
        h('input', {
          className: 'form-input', type: 'text', placeholder: 'Mario',
          value: name, onChange: e => setName(e.target.value), required: true, autoComplete: 'given-name'
        })
      ),
      h('div', { className: 'form-group' },
        h('label', { className: 'form-label' }, 'Cognome'),
        h('input', {
          className: 'form-input', type: 'text', placeholder: 'Rossi',
          value: surname, onChange: e => setSurname(e.target.value), required: true, autoComplete: 'family-name'
        })
      ),
      h('div', { className: 'form-group' },
        h('label', { className: 'form-label' }, 'Email'),
        h('input', {
          className: 'form-input' + (error ? ' error' : ''),
          type: 'email', placeholder: 'email@esempio.it',
          value: email, onChange: e => setEmail(e.target.value), required: true, autoComplete: 'email'
        })
      ),
      h('div', { className: 'form-group' },
        h('label', { className: 'form-label' }, 'Password'),
        h('input', {
          className: 'form-input', type: 'password', placeholder: 'Min. 6 caratteri',
          value: password, onChange: e => setPassword(e.target.value), required: true, minLength: 6, autoComplete: 'new-password'
        })
      ),
      h('div', { className: 'form-group' },
        h('label', { className: 'form-label' }, 'Tipo account'),
        h('select', {
          className: 'form-select',
          value: role, onChange: e => setRole(e.target.value)
        },
          h('option', { value: 'client' }, 'Cliente'),
          h('option', { value: 'professional' }, 'Professionista')
        )
      ),
      h('button', { className: 'btn-primary', type: 'submit', disabled: loading },
        loading ? h('span', { className: 'spinner' }) : 'Crea Account'
      )
    ),
    h('p', { className: 'auth-link' },
      'Hai già un account? ', h(Link, { to: '/login' }, 'Accedi')
    )
  );
}

// === FORGOT PASSWORD PAGE ===
function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setSent(true); // Always show success (security)
    } finally {
      setLoading(false);
    }
  };

  if (sent) return h('div', { className: 'auth-page' },
    h('div', { style: 'text-align:center' },
      h('div', { style: 'fontSize:48,marginBottom:16' }, '✓'),
      h('h2', { style: 'fontSize:22;fontWeight:700;marginBottom:8' }, 'Email inviata'),
      h('p', { style: 'color:var(--text-light)' }, "Se l'email esiste, riceverai un link per reimpostare la password.")
    ),
    h('button', {
      className: 'btn-primary',
      style: 'margin-top:24',
      onClick: () => navigate('/login')
    }, 'Torna al login')
  );

  return h('div', { className: 'auth-page' },
    h('div', { className: 'auth-logo' },
      h('h1', null, 'FixGo'),
      h('p', null, 'Reimposta la tua password')
    ),
    h('form', { onSubmit: handleSubmit },
      h('div', { className: 'form-group' },
        h('label', { className: 'form-label' }, 'Email'),
        h('input', {
          className: 'form-input', type: 'email', placeholder: 'email@esempio.it',
          value: email, onChange: e => setEmail(e.target.value), required: true
        })
      ),
      h('button', { className: 'btn-primary', type: 'submit', disabled: loading },
        loading ? h('span', { className: 'spinner' }) : 'Invia Link'
      )
    ),
    h('p', { className: 'auth-link' },
      h(Link, { to: '/login' }, '← Torna al login')
    )
  );
}

// === PRO DETAIL PAGE ===
function ProDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pro, setPro] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterRating, setFilterRating] = useState(0); // 0 = tutti
  const [filterSearch, setFilterSearch] = useState('');
  const [reportingId, setReportingId] = useState(null);
  const [reportedIds, setReportedIds] = useState(new Set());
  const [toast, setToast] = useState(null);

  // Load pro info + initial reviews
  useEffect(() => {
    setLoading(true);
    api.get(`/api/professionals/${id}`)
      .then(data => {
        setPro(data.professional);
        setReviews(data.reviews || []);
        setAvgRating(data.professional.avg_rating);
        setReviewCount(data.professional.review_count || 0);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Reload reviews when filter changes
  useEffect(() => {
    if (!pro) return;
    const params = new URLSearchParams();
    if (filterRating) params.set('rating', filterRating);
    if (filterSearch.trim()) params.set('search', filterSearch.trim());
    api.get(`/api/reviews/professional/${id}?${params.toString()}`)
      .then(data => {
        setReviews(data.reviews || []);
        setAvgRating(data.avg_rating);
        setReviewCount(data.review_count || 0);
      })
      .catch(() => {});
  }, [filterRating, filterSearch, pro, id]);

  const handleReport = async (reviewId) => {
    if (reportedIds.has(reviewId)) return;
    setReportingId(reviewId);
    try {
      await api.post(`/api/reviews/${reviewId}/report`, { reason: 'Contenuto inappropriato' });
      setReportedIds(prev => new Set([...prev, reviewId]));
      setToast('Recensione segnalata. Grazie!');
    } catch (err) {
      setToast(err.message || 'Errore nella segnalazione');
    } finally {
      setReportingId(null);
    }
  };

  const serviceLabels = { carwash: 'Car Wash', idraulica: 'Idraulica', elettricista: 'Elettricista', altro: 'Altro' };

  if (loading) return h('div', { className: 'loading-page' }, 'Caricamento profilo...');
  if (error || !pro) return h('div', { className: 'page' }, h('div', { className: 'error-msg' }, error || 'Professionista non trovato'));

  const stars = avgRating ? parseFloat(avgRating).toFixed(1) : '—';

  return h(Fragment, null,
    // Header
    h('div', { style: 'background:linear-gradient(135deg,#1E5B3E 0%,#14432E 100%);color:white;padding:24px 16px 20px;border-radius:0 0 20px 20px;margin-bottom:16px' },
      h('button', { onClick: () => navigate(-1), style: 'background:none;border:none;color:rgba(255,255,255,.8);font-size:13px;margin-bottom:12px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:0' },
        Icon('arrowLeft', 16), 'Indietro'
      ),
      h('div', { style: 'display:flex;gap:14px;align-items:center' },
        h('div', { style: 'width:56px;height:56px;border-radius:16px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;flex-shrink:0' },
          pro.name ? pro.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
        ),
        h('div', null,
          h('h1', { style: 'font-size:20px;font-weight:800;margin:0 0 4px' }, pro.name || 'Professionista FixGo'),
          h('div', { style: 'font-size:13px;opacity:.85' }, serviceLabels[pro.service_type] || pro.service_type,
            pro.verified ? ' · ✓ Verificato' : ''
          )
        )
      ),
      h('div', { style: 'display:flex;gap:16px;margin-top:14px' },
        h('div', { style: 'background:rgba(255,255,255,.15);border-radius:10px;padding:8px 14px;text-align:center' },
          h('div', { style: 'font-size:18px;font-weight:800' }, '★ ' + stars),
          h('div', { style: 'font-size:11px;opacity:.8' }, 'Valutazione')
        ),
        h('div', { style: 'background:rgba(255,255,255,.15);border-radius:10px;padding:8px 14px;text-align:center' },
          h('div', { style: 'font-size:18px;font-weight:800' }, reviewCount),
          h('div', { style: 'font-size:11px;opacity:.8' }, 'Recensioni')
        ),
        h('div', { style: 'background:rgba(255,255,255,.15);border-radius:10px;padding:8px 14px;text-align:center' },
          h('div', { style: 'font-size:18px;font-weight:800' }, pro.completed_jobs || 0),
          h('div', { style: 'font-size:11px;opacity:.8' }, 'Servizi')
        )
      )
    ),

    // Bio
    pro.bio && h('div', { style: 'margin:0 16px 16px;padding:14px;background:white;border:1px solid var(--border);border-radius:14px;font-size:14px;line-height:1.6;color:var(--text-light)' }, pro.bio),

    // Book CTA
    h('div', { style: 'margin:0 16px 20px;display:flex;gap:10px' },
      h('button', {
        onClick: () => navigate('/book', { state: { serviceType: pro.service_type, professionalId: pro.id } }),
        style: 'flex:1;background:var(--primary);color:white;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer'
      }, 'Prenota ora'),
      pro.phone && h('a', {
        href: 'tel:' + pro.phone,
        style: 'width:48px;height:48px;background:#EAF0E7;color:#1E5B3E;border:1px solid #CFE0CC;border-radius:12px;font-size:22px;display:flex;align-items:center;justify-content:center;text-decoration:none'
      }, '📞')
    ),

    // Reviews section
    h('div', { style: 'padding:0 16px' },
      h('h2', { style: 'font-size:17px;font-weight:700;margin-bottom:12px' }, 'Recensioni'),

      // Filter bar
      h('div', { style: 'display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap' },
        // Star filter chips
        [0, 1, 2, 3, 4, 5].map(n =>
          h('button', {
            key: n,
            onClick: () => setFilterRating(n === filterRating ? 0 : n),
            style: `padding:6px 12px;border-radius:20px;border:1px solid ${filterRating === n && n > 0 ? 'var(--primary)' : 'var(--border)'};background:${filterRating === n && n > 0 ? 'var(--primary)' : 'white'};color:${filterRating === n && n > 0 ? 'white' : 'var(--text)'};font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap`
          }, n === 0 ? 'Tutti' : '★'.repeat(n))
        )
      ),

      // Text search
      h('div', { style: 'position:relative;margin-bottom:16px' },
        h('input', {
          type: 'text',
          placeholder: 'Cerca nelle recensioni...',
          value: filterSearch,
          onInput: e => setFilterSearch(e.target.value),
          style: 'width:100%;box-sizing:border-box;padding:10px 14px;border:1px solid var(--border);border-radius:12px;font-size:14px;outline:none'
        })
      ),

      // Reviews list
      reviews.length === 0
        ? h('div', { style: 'text-align:center;color:var(--text-light);padding:40px 0' },
            h('div', { style: 'font-size:32px;margin-bottom:8px' }, '💬'),
            filterRating || filterSearch
              ? 'Nessuna recensione corrisponde ai filtri.'
              : 'Nessuna recensione ancora per questo professionista.'
          )
        : reviews.map(r =>
            h('div', { key: r.id, style: 'background:white;border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px' },
              h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px' },
                h('div', null,
                  h('div', { style: 'font-size:14px;font-weight:700' }, r.reviewer_name || 'Utente'),
                  h('div', { style: 'font-size:12px;color:var(--text-light);margin-top:2px' },
                    r.service_type ? (serviceLabels[r.service_type] || r.service_type) + ' · ' : '',
                    new Date(r.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
                  )
                ),
                h('div', { style: 'display:flex;flex-direction:column;align-items:flex-end;gap:6px' },
                  h('div', { style: 'font-size:15px;font-weight:700;color:#B98A2F' }, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)),
                  h('button', {
                    onClick: () => handleReport(r.id),
                    disabled: reportingId === r.id || reportedIds.has(r.id),
                    title: 'Segnala recensione',
                    style: `background:none;border:none;cursor:pointer;font-size:12px;color:${reportedIds.has(r.id) ? '#9AA096' : '#C43D2F'};padding:0;opacity:${reportingId === r.id ? 0.5 : 1}`
                  }, reportedIds.has(r.id) ? '🚩 Segnalata' : '🚩')
                )
              ),
              r.comment && h('p', { style: 'font-size:13px;color:var(--text);line-height:1.5;margin:0' }, r.comment)
            )
          )
    ),

    toast && h(Toast, { message: toast, onDone: () => setToast(null) })
  );
}

// === PROTECTED ROUTE ===
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return h('div', { className: 'loading-page' }, 'Caricamento...');
  if (!user) return h(Fragment, null,
    h('div', { style: 'text-align:center;padding:60px 20px' },
      h('p', { style: 'color:var(--text-light);margin-bottom:16' }, 'Effettua il login per continuare'),
      h(Link, { to: '/login', className: 'btn-primary', style: 'display:inline-block;text-align:center' }, 'Accedi')
    )
  );
  return children;
}

// === APP SHELL ===
function AppShell({ children }) {
  return h(Fragment, null,
    children,
    BottomNav()
  );
}

// === APP ===
function App() {
  // Register push service worker on startup
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/push-sw.js').catch(err => {
        console.warn('[push] SW registration failed:', err.message);
      });
    }
  }, []);

  return h(AuthProvider, null,
    h(BrowserRouter, null,
      h(Routes, null,
        // Auth pages (no nav)
        h(Route, { path: '/login', element: h(LoginPage) }),
        h(Route, { path: '/register', element: h(RegisterPage) }),
        h(Route, { path: '/forgot-password', element: h(ForgotPasswordPage) }),

        // Protected pages (with nav)
        h(Route, { path: '/', element: h(ProtectedRoute, null, h(AppShell, null, h(HomePage))) }),
        h(Route, { path: '/analyze', element: h(ProtectedRoute, null, h(AppShell, null, h(PhotoAnalyzerPage))) }),
        h(Route, { path: '/map', element: h(ProtectedRoute, null, h(AppShell, null, h(MapPage))) }),
        h(Route, { path: '/bookings', element: h(ProtectedRoute, null, h(AppShell, null, h(BookingsPage))) }),
        h(Route, { path: '/book', element: h(ProtectedRoute, null, h(AppShell, null, h(BookPage))) }),
        h(Route, { path: '/booking/confirm/:id', element: h(ProtectedRoute, null, h(AppShell, null, h(BookingConfirmPage))) }),
        h(Route, { path: '/booking/pay/success/:id', element: h(ProtectedRoute, null, h(AppShell, null, h(PaymentSuccessPage))) }),
        h(Route, { path: '/chat', element: h(ProtectedRoute, null, h(AppShell, null, h(ChatPage))) }),
        h(Route, { path: '/profile', element: h(ProtectedRoute, null, h(AppShell, null, h(ProfilePage))) }),
        h(Route, { path: '/pro/:id', element: h(ProtectedRoute, null, h(AppShell, null, h(ProDetailPage))) }),

        // Pro dashboard pages (no AppShell, own nav)
        h(Route, { path: '/pro/verify', element: h(ProtectedRoute, null, h(ProVerifyPage)) }),
        h(Route, { path: '/pro/dashboard', element: h(ProtectedRoute, null, h(ProDashboardPage)) }),
        h(Route, { path: '/pro/appointments', element: h(ProtectedRoute, null, h(ProAppointmentsPage)) }),
        h(Route, { path: '/pro/profile', element: h(ProtectedRoute, null, h(ProProfilePage)) }),
      )
    )
  );
}

const root = createRoot(document.getElementById('root'));
root.render(h(ErrorBoundary, null, h(App)));