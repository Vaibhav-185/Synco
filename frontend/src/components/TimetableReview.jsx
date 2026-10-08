import { useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TYPES = ['class', 'lab', 'break', 'activity', 'proctoring', 'project'];
const BATCHES = ['All', 'C1', 'C2', 'C3'];

export default function TimetableReview({ previewData, onCancel, onConfirmSuccess }) {
  const [slots, setSlots] = useState(previewData.slots || []);
  const [globalBatch, setGlobalBatch] = useState('C1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Handle global batch selection change (e.g. User chooses "C1", "C2", or "C3")
  const handleGlobalBatchSelect = (selectedB) => {
    setGlobalBatch(selectedB);
    if (selectedB === 'All') return;

    // Automatically resolve parallel labs to the selected student batch
    const updated = slots.map(slot => {
      if (slot.parallelLabs && slot.parallelLabs.length > 0) {
        const matchingLab = slot.parallelLabs.find(l => l.batch.toUpperCase() === selectedB.toUpperCase());
        if (matchingLab) {
          return {
            ...slot,
            subject: matchingLab.subject,
            code: matchingLab.code,
            faculty: matchingLab.faculty,
            room: matchingLab.room,
            batch: matchingLab.batch,
            selectedBatch: selectedB,
            isUncertain: false
          };
        }
      }
      return slot;
    });
    setSlots(updated);
  };

  const handleSlotChange = (index, field, value) => {
    const updated = [...slots];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'subject' && value.trim()) {
      updated[index].isUncertain = false;
      updated[index].uncertainReason = '';
    }
    setSlots(updated);
  };

  const handleLabBatchChange = (slotIndex, labIndex, field, value) => {
    const updated = [...slots];
    const labs = [...(updated[slotIndex].parallelLabs || [])];
    labs[labIndex] = { ...labs[labIndex], [field]: value };
    updated[slotIndex].parallelLabs = labs;
    setSlots(updated);
  };

  const handleDeleteSlot = (index) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleAddSlot = () => {
    setSlots([
      ...slots,
      {
        day: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
        subject: 'New Subject',
        code: '',
        type: 'class',
        faculty: '',
        room: '',
        note: '',
        isUncertain: false
      }
    ]);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await axios.post(`${API}/timetable/confirm`, { slots });
      onConfirmSuccess(res.data.slots);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save timetable');
      setSaving(false);
    }
  };

  const uncertainCount = slots.filter(s => s.isUncertain).length;

  return (
    <div className="card" style={{ border: '2px solid var(--accent)', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Review Extracted Timetable</h2>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Inspect extracted schedule. Select your lab batch or edit any entry before saving.
          </p>
        </div>

        {/* Global Batch Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>My Lab Batch:</span>
          {BATCHES.map(b => (
            <button
              key={b}
              className={`btn sm ${globalBatch === b ? 'accent' : ''}`}
              onClick={() => handleGlobalBatchSelect(b)}
              style={{ padding: '3px 10px' }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {uncertainCount > 0 && (
        <div className="error-bar" style={{ background: 'rgba(240, 180, 74, 0.15)', borderColor: 'rgba(240, 180, 74, 0.4)', color: '#f0c84a', marginBottom: '1rem' }}>
          ⚠️ {uncertainCount} slot(s) require review or subject clarification.
        </div>
      )}

      {error && <div className="error-bar">{error}</div>}

      <div style={{ maxHeight: '460px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px' }}>
        <table className="tt-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Day</th>
              <th>Time</th>
              <th style={{ textAlign: 'left' }}>Subject / Parallel Labs</th>
              <th>Type</th>
              <th>Faculty</th>
              <th>Room</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, idx) => {
              const isUncertain = slot.isUncertain;
              const isBreak = slot.type === 'break';
              const hasParallelLabs = slot.parallelLabs && slot.parallelLabs.length > 0;

              return (
                <tr key={idx} style={{ background: isUncertain ? 'rgba(240, 180, 74, 0.1)' : (isBreak ? 'rgba(255,255,255,0.02)' : 'transparent') }}>
                  <td style={{ textAlign: 'left', minWidth: '100px' }}>
                    <select
                      value={slot.day}
                      onChange={e => handleSlotChange(idx, 'day', e.target.value)}
                      style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '3px' }}
                    >
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td style={{ minWidth: '130px' }}>
                    <input
                      type="text"
                      value={slot.startTime}
                      onChange={e => handleSlotChange(idx, 'startTime', e.target.value)}
                      style={{ width: '52px', textAlign: 'center', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px' }}
                    />
                    {' - '}
                    <input
                      type="text"
                      value={slot.endTime}
                      onChange={e => handleSlotChange(idx, 'endTime', e.target.value)}
                      style={{ width: '52px', textAlign: 'center', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px' }}
                    />
                  </td>
                  <td style={{ textAlign: 'left', padding: '6px' }}>
                    <input
                      type="text"
                      value={slot.subject}
                      placeholder="Subject title..."
                      onChange={e => handleSlotChange(idx, 'subject', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg3)',
                        color: 'var(--text)',
                        border: isUncertain ? '1.5px solid #f0c84a' : '1px solid var(--border)',
                        borderRadius: '4px',
                        padding: '4px 6px',
                        fontWeight: 600
                      }}
                    />

                    {/* Render parallel labs list if multi-batch block */}
                    {hasParallelLabs && (
                      <div style={{ marginTop: '6px', fontSize: '11px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, marginBottom: '4px' }}>
                          ⚡ PARALLEL BATCH LABS IN THIS CELL:
                        </div>
                        {slot.parallelLabs.map((pl, lIdx) => (
                          <div key={lIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                            <span className={`pill ${slot.batch === pl.batch ? 'green' : 'gray'}`}>{pl.batch}</span>
                            <span style={{ flex: 1, color: 'var(--text)' }}>{pl.subject}</span>
                            <span style={{ fontSize: '10px', color: 'var(--accent)' }}>{pl.faculty || '—'}</span>
                            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>[{pl.room}]</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ minWidth: '90px' }}>
                    <select
                      value={slot.type || 'class'}
                      onChange={e => handleSlotChange(idx, 'type', e.target.value)}
                      style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '3px', fontSize: '11px' }}
                    >
                      {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={{ minWidth: '80px' }}>
                    <input
                      type="text"
                      value={slot.faculty || ''}
                      placeholder="Faculty"
                      onChange={e => handleSlotChange(idx, 'faculty', e.target.value)}
                      style={{ width: '75px', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 4px', fontSize: '11px' }}
                    />
                  </td>
                  <td style={{ minWidth: '70px' }}>
                    <input
                      type="text"
                      value={slot.room || ''}
                      placeholder="Room"
                      onChange={e => handleSlotChange(idx, 'room', e.target.value)}
                      style={{ width: '65px', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 4px', fontSize: '11px' }}
                    />
                  </td>
                  <td>
                    <button
                      className="btn danger sm"
                      onClick={() => handleDeleteSlot(idx)}
                      title="Delete slot"
                      style={{ padding: '2px 6px' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn accent sm" onClick={handleAddSlot} disabled={saving}>+ Add Custom Slot</button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={onCancel} disabled={saving}>Discard</button>
          <button className="btn accent" onClick={handleConfirmSave} disabled={saving || slots.length === 0}>
            {saving ? 'Saving...' : '✅ Confirm & Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
