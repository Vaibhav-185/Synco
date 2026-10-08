import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Mirrors models/Slot.js enum
const TYPES = ['class', 'lab', 'break', 'activity', 'proctoring', 'project'];

const EMPTY = {
  subject: '', day: 'Monday', startTime: '09:00', endTime: '10:00',
  type: 'class', faculty: '', room: '', note: ''
};

/**
 * Reusable add/edit slot modal.
 *  - mode "add":    POST /api/timetable/slot
 *  - mode "edit":   PUT  /api/timetable/slot/:id   (populated from `slot`)
 * Calls onSaved(savedSlot) on success; onCancel to close.
 */
export default function SlotForm({ mode = 'add', slot = null, onSaved, onCancel, onDelete }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate all editable fields when editing
  useEffect(() => {
    if (mode === 'edit' && slot) {
      setForm({
        subject: slot.subject || '',
        day: slot.day || 'Monday',
        startTime: slot.startTime || '09:00',
        endTime: slot.endTime || '10:00',
        type: slot.type || 'class',
        faculty: slot.faculty || '',
        room: slot.room || '',
        note: slot.note || ''
      });
    }
  }, [mode, slot]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    if (!form.subject.trim()) return 'Subject is required';
    if (!form.day) return 'Day is required';
    if (!form.startTime.trim() || !form.endTime.trim()) return 'Start and end time are required';
    if (!TYPES.includes(form.type)) return 'Invalid type';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        subject: form.subject.trim(),
        day: form.day,
        startTime: form.startTime.trim(),
        endTime: form.endTime.trim(),
        type: form.type,
        faculty: form.faculty,
        room: form.room,
        note: form.note
      };
      const res = mode === 'edit'
        ? await axios.put(`${API}/timetable/slot/${slot._id}`, payload)
        : await axios.post(`${API}/timetable/slot`, payload);
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save slot');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; } // first click arms the confirmation
    setSaving(true);
    setError('');
    try {
      await axios.delete(`${API}/timetable/slot/${slot._id}`);
      onSaved(null); // null => deleted
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete slot');
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ border: '2px solid var(--accent)', marginBottom: '1rem' }}>
      <div className="card-title">{mode === 'edit' ? 'Edit slot' : 'Add a slot'}</div>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="field" style={{ flex: 2 }}>
            <label>Subject *</label>
            <input type="text" value={form.subject} onChange={set('subject')}
              placeholder="e.g. Computer Networks" autoFocus />
          </div>
          <div className="field">
            <label>Type *</label>
            <select value={form.type} onChange={set('type')}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Day *</label>
            <select value={form.day} onChange={set('day')}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Start *</label>
            <input type="time" value={form.startTime} onChange={set('startTime')} />
          </div>
          <div className="field">
            <label>End *</label>
            <input type="time" value={form.endTime} onChange={set('endTime')} />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Faculty</label>
            <input type="text" value={form.faculty} onChange={set('faculty')} placeholder="Initials" />
          </div>
          <div className="field">
            <label>Room</label>
            <input type="text" value={form.room} onChange={set('room')} placeholder="e.g. ISE403" />
          </div>
          <div className="field">
            <label>Note</label>
            <input type="text" value={form.note} onChange={set('note')} placeholder="Optional note" />
          </div>
        </div>

        {error && (
          <div className="error-bar" style={{ marginBottom: 10 }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {mode === 'edit' ? (
            confirmDelete ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>Delete this slot permanently?</span>
                <button type="button" className="btn danger sm" onClick={handleDelete} disabled={saving}>Yes, delete</button>
                <button type="button" className="btn sm" onClick={() => setConfirmDelete(false)} disabled={saving}>Keep</button>
              </div>
            ) : (
              <button type="button" className="btn danger sm" onClick={handleDelete} disabled={saving}>Delete</button>
            )
          ) : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="btn accent" disabled={saving}>
              {saving ? 'Saving...' : (mode === 'edit' ? 'Save changes' : '+ Add slot')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
