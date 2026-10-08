const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = [];
for (let h = 8; h <= 20; h++) HOURS.push(`${String(h).padStart(2, '0')}:00`);

function resolveSlotDisplay(slot) {
  if (!slot) return null;
  if (slot.parallelLabs && slot.parallelLabs.length > 0 && slot.selectedBatch) {
    const matched = slot.parallelLabs.find(l => l.batch.toUpperCase() === slot.selectedBatch.toUpperCase());
    if (matched) {
      return {
        ...slot,
        subject: matched.subject,
        code: matched.code,
        faculty: matched.faculty,
        room: matched.room,
        batch: matched.batch
      };
    }
  }
  return slot;
}

export default function TimetableGrid({ slots = [], onSlotClick }) {
  const getSlotsForCell = (day, hourStr) => {
    return slots.filter(s => {
      if (s.day !== day) return false;
      return s.startTime <= hourStr && hourStr < s.endTime;
    });
  };

  // Only render rows that contain at least one slot: fully empty hours
  // (early mornings, late evenings) collapse away instead of filling the
  // table with blank rows.
  const visibleHours = HOURS.filter(hour =>
    DAYS.some(day => getSlotsForCell(day, hour).length > 0)
  );

  const getSlotClass = (slot) => {
    if (!slot) return 'tt-slot free';
    if (slot.type === 'break') return 'tt-slot break';
    if (slot.type === 'lab') return 'tt-slot lab';
    if (slot.type === 'activity' || slot.type === 'proctoring') return 'tt-slot activity';
    if (slot.type === 'project') return 'tt-slot project';
    return 'tt-slot busy';
  };

  return (
    <div className="tt-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Time</th>
            {DAYS.map(d => <th key={d}>{d.slice(0, 3)}</th>)}
          </tr>
        </thead>
        <tbody>
          {visibleHours.map(hour => (
            <tr key={hour}>
              <td style={{ fontWeight: 600 }}>{hour}</td>
              {DAYS.map(day => {
                const cellSlots = getSlotsForCell(day, hour);
                if (cellSlots.length === 0) {
                  return <td key={day}></td>;
                }
                const rawSlot = cellSlots[0];
                const slot = resolveSlotDisplay(rawSlot);

                return (
                  <td key={day}>
                    <div
                      className={getSlotClass(slot) + (onSlotClick ? ' tt-slot-clickable' : '')}
                      title={`${slot.subject} ${slot.faculty ? '(' + slot.faculty + ')' : ''} ${slot.note ? '[' + slot.note + ']' : ''}${onSlotClick ? ', click to edit' : ''}`}
                      onClick={onSlotClick ? () => onSlotClick(rawSlot) : undefined}
                      role={onSlotClick ? 'button' : undefined}
                      style={{
                        flexDirection: 'column', padding: '2px 4px', lineHeight: 1.1,
                        ...(onSlotClick ? { cursor: 'pointer' } : {})
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '10px' }}>
                        {slot.subject.length > 12 ? slot.subject.slice(0, 11) + '…' : slot.subject}
                      </span>
                      {slot.faculty && (
                        <span style={{ fontSize: '9px', opacity: 0.8 }}>{slot.faculty}</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
