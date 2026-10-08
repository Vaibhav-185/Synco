import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import TimetableGrid from '../components/TimetableGrid';
import TimetableReview from '../components/TimetableReview';
import EnableNotifications from '../components/EnableNotifications';
import SlotForm from '../components/SlotForm';

const API = import.meta.env.VITE_API_URL;

export default function Dashboard() {
  const { user } = useAuth();
  const [slots, setSlots]         = useState([]);
  const [status, setStatus]       = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage]     = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [slotModal, setSlotModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', slot }

  useEffect(() => {
    fetchSlots();
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
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

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    setPreviewData(null);
    try {
      const formData = new FormData();
      formData.append('timetable', file);
      const res = await axios.post(`${API}/timetable/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.preview) {
        setPreviewData(res.data);
        setMessage('Review the extracted timetable below, then confirm to save.');
      }
    } catch (err) {
      setMessage('Upload failed: ' + (err.response?.data?.message || err.message));
    }
    setUploading(false);
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Welcome back, {user?.displayName}</div>
          <div className="page-sub">Your timetable dashboard</div>
        </div>
        <button className="btn accent" onClick={() => setSlotModal({ mode: 'add' })} disabled={!!previewData}>
          + Add Slot
        </button>
      </div>

      <div className="card">
        <div className="card-row">
          <div style={{fontSize:12,color:'var(--muted)'}}>
            GET A NUDGE BEFORE CLASS
          </div>
          <EnableNotifications />
        </div>
      </div>

      {status && (
        <div className="card">
          <div className="card-row">
            <div>
              <div style={{fontSize:12,color:'var(--muted)',marginBottom:4}}>
                Right now: {status.day}, {status.currentTime}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span className={`status-badge ${status.inClass ? 'busy' : 'free'}`}>
                  {status.inClass ? 'In ' + status.currentClass?.subject : 'Free right now'}
                </span>
                {status.nextClass && (
                  <span style={{fontSize:12,color:'var(--muted)'}}>
                    Next: {status.nextClass.subject} at {status.nextClass.startTime}
                  </span>
                )}
              </div>
            </div>
            <div style={{fontSize:12,color:'var(--muted)'}}>{slots.length} slots this week</div>
          </div>
        </div>
      )}

      {/* Review Modal / View */}
      {previewData ? (
        <TimetableReview
          previewData={previewData}
          onCancel={() => { setPreviewData(null); setMessage('Extraction discarded.'); }}
          onConfirmSuccess={handleConfirmSuccess}
        />
      ) : (
        <div className="card">
          <div className="card-title">Upload timetable photo</div>
          <label htmlFor="tt-upload">
            <div className="upload-zone">
              <div className="upload-title">
                {uploading ? 'Reading your timetable with Gemini Vision...' : 'Click to upload your timetable photo'}
              </div>
              <div className="upload-sub">
                {uploading ? 'Analyzing grid, merged cells, breaks & legend...' : 'Gemini AI will extract your schedule for review'}
              </div>
            </div>
          </label>
          <input id="tt-upload" type="file" accept="image/*"
            style={{display:'none'}} onChange={handleUpload} disabled={uploading} />
          {message && (
            <div style={{marginTop:10,fontSize:13,
              color:(message.includes('failed') || message.includes('discarded')) ? 'var(--text)' : 'var(--accent)'}}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* Manual add / edit form (above the grid so it's never missed) */}
      {slotModal && (
        <SlotForm
          mode={slotModal.mode}
          slot={slotModal.slot}
          onSaved={handleSlotSaved}
          onCancel={() => setSlotModal(null)}
        />
      )}

      {/* Weekly Schedule Grid */}
      {slots.length > 0 ? (
        <div className="card">
          <div className="card-title">My weekly schedule</div>
          <TimetableGrid slots={slots} onSlotClick={openEdit} />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            Tip: click a slot to edit or delete it.
          </div>
        </div>
      ) : (
        !previewData && (
          <div className="card">
            <div className="empty">
              <p>No timetable yet. Upload a photo above to get started!</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}