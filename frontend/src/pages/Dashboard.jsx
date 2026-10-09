import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import TimetableGrid, { resolveSlotDisplay } from '../components/TimetableGrid';
import TimetableReview from '../components/TimetableReview';
import EnableNotifications from '../components/EnableNotifications';
import SlotForm from '../components/SlotForm';

const API = import.meta.env.VITE_API_URL;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // mirrors backend multer limit

function toMinutes(t) {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1;
}

function formatCountdown(mins) {
  if (mins < 0) return '';
  if (mins < 60) return mins <= 1 ? '1 min' : `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function metaLine(view) {
  return [view.room, view.faculty].filter(Boolean).join(' · ');
}

export default function Dashboard() {
  const { user } = useAuth();
  const [slots, setSlots]         = useState([]);
  const [status, setStatus]       = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage]     = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [slotModal, setSlotModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', slot }
  const [view, setView]           = useState('today'); // 'today' agenda | 'week' grid
  const uploadAbort = useRef(null); // aborts the in-flight upload, if any

  useEffect(() => {
    fetchSlots();
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    // Abandon any in-flight upload on unmount so its late settlement
    // cannot flip state on an unmounted component.
    return () => {
      clearInterval(interval);
      if (uploadAbort.current) uploadAbort.current.abort();
    };
  }, []);

  const fetchSlots = async () => {
    try {
      const res = await axios.get(`${API}/timetable/my`);
      setSlots(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API}/timetable/status`);
      setStatus(res.data);
    } catch (err) { console.error(err); }
  };

  const cancelUpload = () => {
    if (uploadAbort.current) uploadAbort.current.abort();
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    // Client-side validation mirrors the backend (image/*, 10 MB): instant
    // feedback instead of a wasted slow upload.
    if (!String(file.type || '').startsWith('image/')) {
      setMessage('Upload failed: that file is not an image. Choose a JPEG, PNG, or WebP photo.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage('Upload failed: image is larger than 10 MB. Retake or compress the photo.');
      return;
    }
    // Abort any previous in-flight upload before starting a new one.
    if (uploadAbort.current) uploadAbort.current.abort();
    const controller = new AbortController();
    uploadAbort.current = controller;
    setUploading(true);
    setMessage('');
    setPreviewData(null);
    try {
      const formData = new FormData();
      formData.append('timetable', file);
      const res = await axios.post(`${API}/timetable/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal
      });
      if (res.data.preview) {
        setPreviewData(res.data);
        setMessage('Review the extracted timetable below, then confirm to save.');
      }
    } catch (err) {
      if (err && (err.code === 'ERR_CANCELED' || err.name === 'CanceledError')) {
        setMessage('Upload cancelled. Your current timetable is unchanged.');
      } else {
        setMessage('Upload failed: ' + (err.response?.data?.message || err.message));
      }
    } finally {
      if (uploadAbort.current === controller) uploadAbort.current = null;
      setUploading(false);
    }
  };

  const handleConfirmSuccess = (savedSlots) => {
    setSlots(savedSlots);
    setPreviewData(null);
    setMessage('Timetable saved successfully!');
    fetchStatus();
  };

  // After any manual slot mutation: refresh grid + status (savedSlot null => deleted)
  const handleSlotSaved = () => {
    setSlotModal(null);
    setMessage('Schedule updated.');
    fetchSlots();
    fetchStatus();
  };

  const openEdit = (slot) => setSlotModal({ mode: 'edit', slot });

  // Time-aware greeting + real calendar date for the header.
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLine = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const hasTimetable = slots.length > 0;
  const todayName = status?.day || now.toLocaleDateString('en-US', { weekday: 'long' });
  const todaySlots = slots
    .filter(s => s.day === todayName)
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

  const isCurrent = (s) => {
    if (!status?.inClass || !status.currentClass) return false;
    const c = status.currentClass;
    return (c._id && s._id && String(c._id) === String(s._id)) ||
      (s.subject === c.subject && s.startTime === c.startTime);
  };

  const messageIsError = message.includes('failed') || message.includes('discarded');

  const renderHero = () => {
    if (!status) return null;
    if (status.inClass && status.currentClass) {
      const c = status.currentClass;
      const view = resolveSlotDisplay(c);
      const left = formatCountdown(toMinutes(c.endTime) - toMinutes(status.currentTime));
      return (
        <section className="hero">
          <div className="hero-kicker">Now</div>
          <h2 className="hero-title">{view.subject}</h2>
          <div className="hero-meta">{c.startTime}-{c.endTime}{metaLine(view) ? ` · ${metaLine(view)}` : ''}</div>
          {left && <div className="hero-sub">Ends in <span className="hero-eta">{left}</span></div>}
        </section>
      );
    }
    if (status.nextClass) {
      const n = status.nextClass;
      const view = resolveSlotDisplay(n);
      const wait = formatCountdown(toMinutes(n.startTime) - toMinutes(status.currentTime));
      return (
        <section className="hero">
          <div className="hero-kicker">Up next</div>
          <h2 className="hero-title">{view.subject}</h2>
          <div className="hero-meta">{n.startTime}-{n.endTime}{metaLine(view) ? ` · ${metaLine(view)}` : ''}</div>
          <div className="hero-sub">
            Free right now{wait ? <> · starts in <span className="hero-eta">{wait}</span></> : null}
          </div>
        </section>
      );
    }
    return (
      <section className="hero">
        <div className="hero-kicker">Today</div>
        <h2 className="hero-title">No more classes today</h2>
        <div className="hero-sub">{todaySlots.length} class{todaySlots.length === 1 ? '' : 'es'} on {todayName}</div>
      </section>
    );
  };

  const renderAgenda = () => {
    if (todaySlots.length === 0) {
      return (
        <div className="empty">
          <p>Nothing scheduled for {todayName}.</p>
        </div>
      );
    }
    return (
      <div className="agenda">
        {todaySlots.map((s) => {
          const view = resolveSlotDisplay(s);
          const nowRow = isCurrent(s);
          const showKind = !['class', 'break'].includes(s.type);
          return (
            <div
              key={s._id || `${s.startTime}-${s.subject}`}
              className={`agenda-row${nowRow ? ' now' : ''}${s.type === 'break' ? ' is-break' : ''}`}
              onClick={() => openEdit(s)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') openEdit(s); }}
              title={`${view.subject}${metaLine(view) ? ` (${metaLine(view)})` : ''}, click to edit`}
            >
              <div className="agenda-time">
                <div>{s.startTime}</div>
                <div className="agenda-end">{s.endTime}</div>
              </div>
              <div className="agenda-main">
                <div className="agenda-subject">{view.subject}</div>
                {metaLine(view) && <div className="agenda-meta">{metaLine(view)}</div>}
              </div>
              {nowRow
                ? <span className="agenda-tag">Now</span>
                : showKind ? <span className="agenda-tag muted">{s.type}</span> : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-sub">{dateLine}</div>
          <div className="page-title">{greeting}, {user?.displayName}</div>
        </div>
        <div className="header-actions">
          <button className="btn accent" onClick={() => setSlotModal({ mode: 'add' })} disabled={!!previewData}>
            + Add Slot
          </button>
          {hasTimetable && !previewData && (
            <label className={`btn${uploading ? ' disabled' : ''}`} htmlFor="tt-upload" style={uploading ? { opacity: .5, pointerEvents: 'none' } : undefined}>
              {uploading ? 'Reading...' : 'Update timetable'}
            </label>
          )}
          {uploading && (
            <button className="btn sm" onClick={cancelUpload}>Cancel</button>
          )}
        </div>
      </div>
      <input id="tt-upload" type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />

      <div className="alerts-row">
        <span className="alerts-label">Class alerts</span>
        <EnableNotifications />
      </div>

      {message && (
        <p className={`flash-note${messageIsError ? ' err' : ''}`}>{message}</p>
      )}

      {hasTimetable && renderHero()}

      {/* Review flow (unchanged workflow) */}
      {previewData && (
        <TimetableReview
          previewData={previewData}
          onCancel={() => { setPreviewData(null); setMessage('Extraction discarded.'); }}
          onConfirmSuccess={handleConfirmSuccess}
        />
      )}

      {/* First-time onboarding: full upload card only when there is no timetable */}
      {!hasTimetable && !previewData && (
        <div className="card">
          <div className="card-title">Upload timetable photo</div>
          <label htmlFor="tt-upload">
            <div className="upload-zone">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginBottom: 8 }}>
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                <path d="M12 4v12" />
                <path d="m7 9 5-5 5 5" />
              </svg>
              <div className="upload-title">
                {uploading ? 'Reading your timetable...' : 'Click to upload your timetable photo'}
              </div>
              <div className="upload-sub">
                {uploading ? 'Analyzing grid, merged cells, breaks and legend...' : 'Your schedule will be extracted for review'}
              </div>
            </div>
          </label>
          {uploading && (
            <button className="btn sm" style={{ marginTop: 10 }} onClick={cancelUpload}>Cancel upload</button>
          )}
        </div>
      )}

      {/* Manual add / edit form (above the schedule so it's never missed) */}
      {slotModal && (
        <SlotForm
          mode={slotModal.mode}
          slot={slotModal.slot}
          onSaved={handleSlotSaved}
          onCancel={() => setSlotModal(null)}
        />
      )}

      {/* Schedule: today agenda by default, weekly grid on switch */}
      {hasTimetable && !previewData && (
        <section>
          <div className="schedule-head">
            <h3 className="section-title">{view === 'today' ? `Today, ${todayName}` : 'Weekly schedule'}</h3>
            <div className="seg" role="tablist" aria-label="Schedule view">
              <button role="tab" aria-selected={view === 'today'} className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>Today</button>
              <button role="tab" aria-selected={view === 'week'} className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Week</button>
            </div>
          </div>
          {view === 'today' ? renderAgenda() : (
            <div className="card">
              <TimetableGrid slots={slots} onSlotClick={openEdit} highlightDay={status?.day} />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                Tip: click a slot to edit or delete it.
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
