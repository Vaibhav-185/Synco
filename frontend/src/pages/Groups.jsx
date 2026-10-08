import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const HOURS = [];
for (let h = 8; h <= 20; h++) HOURS.push(`${String(h).padStart(2,'0')}:00`);

export default function Groups() {
  const [groups, setGroups]             = useState([]);
  const [friends, setFriends]           = useState([]);
  const [activeGroup, setActiveGroup]   = useState(null);
  const [freeSlots, setFreeSlots]       = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    fetchGroups();
    fetchFriends();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await axios.get(`${API}/groups`);
      setGroups(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchFriends = async () => {
    try {
      const res = await axios.get(`${API}/friends`);
      setFriends(res.data);
    } catch (err) { console.error(err); }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await axios.post(`${API}/groups`, { name: newGroupName });
      setNewGroupName('');
      fetchGroups();
    } catch (err) { console.error(err); }
  };

  const addMember = async (groupId, userId) => {
    try {
      await axios.post(`${API}/groups/${groupId}/members`, { userId });
      const res = await axios.get(`${API}/groups`);
      setGroups(res.data);
      setActiveGroup(res.data.find(g => g._id === groupId));
    } catch (err) { console.error(err); }
  };

  const findFreeSlots = async (groupId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/groups/${groupId}/freeslots`);
      setFreeSlots(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const memberIds = activeGroup?.members?.map(m => m._id) || [];
  const availableFriends = friends.filter(f => !memberIds.includes(f.friend._id));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Groups</div>
          <div className="page-sub">Find when everyone's free</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:'1rem',alignItems:'start'}}>

        <div>
          <div className="card">
            <div className="card-title">Create group</div>
            <div className="field">
              <label>Group name</label>
              <input
                type="text" placeholder="CS Batch 2024"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createGroup()}
              />
            </div>
            <button className="btn accent" style={{width:'100%'}} onClick={createGroup}>+ Create</button>
          </div>

          <div style={{marginTop:'1rem'}}>
            {groups.length === 0 ? (
              <div className="card"><div className="empty"><p>No groups yet.</p></div></div>
            ) : (
              groups.map(g => (
                <div key={g._id}
                  onClick={() => { setActiveGroup(g); setFreeSlots(null); }}
                  className="card"
                  style={{cursor:'pointer',borderColor:activeGroup?._id===g._id ? 'var(--accent)' : 'var(--border)',marginBottom:8}}
                >
                  <div style={{fontWeight:700,marginBottom:4}}>{g.name}</div>
                  <div style={{fontSize:12,color:'var(--muted)'}}>{g.members?.length || 0} members</div>
                </div>
              ))
            )}
          </div>
        </div>

        {activeGroup ? (
          <div>
            <div className="card">
              <div className="card-row">
                <div className="card-title" style={{marginBottom:0}}>{activeGroup.name}</div>
                <button className="btn sm" onClick={() => { setActiveGroup(null); setFreeSlots(null); }}>✕</button>
              </div>

              <div style={{marginTop:'1rem'}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--muted)',marginBottom:8}}>Members</div>
                {activeGroup.members?.map(m => (
                  <div key={m._id} className="friend-row">
                    <div className="friend-av">{(m.displayName||'?').slice(0,2).toUpperCase()}</div>
                    <div className="friend-info">
                      <div className="friend-name">{m.displayName}</div>
                      <div className="friend-un">@{m.username}</div>
                    </div>
                  </div>
                ))}
              </div>

              {availableFriends.length > 0 && (
                <div style={{marginTop:'1rem'}}>
                  <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--muted)',marginBottom:8}}>Add friends</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {availableFriends.map(({ friend }) => (
                      <button key={friend._id} className="btn sm"
                        onClick={() => addMember(activeGroup._id, friend._id)}>
                        {friend.displayName} +
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn teal"
                style={{width:'100%',marginTop:'1rem',padding:'10px'}}
                onClick={() => findFreeSlots(activeGroup._id)}
                disabled={loading}>
                {loading ? 'Finding...' : '✨ Find common free slots'}
              </button>
            </div>

            {freeSlots && (
              <div className="card" style={{marginTop:'1rem'}}>
                <div className="card-title">Common free slots — {freeSlots.groupName}</div>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>
                  {freeSlots.totalMembers} members · teal = everyone free
                </div>
                <div className="tt-wrap">
                  <table className="tt-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        {DAYS.map(d => <th key={d}>{d.slice(0,3)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {HOURS.map(hour => (
                        <tr key={hour}>
                          <td>{hour}</td>
                          {DAYS.map(day => {
                            const slot = freeSlots.freeSlots[day]?.find(s => s.hour === hour);
                            let cls = 'free', text = '·';
                            if (slot?.allFree) { cls = 'common'; text = 'FREE'; }
                            else if (slot?.busyCount > 0) { cls = 'busy'; text = `${slot.freeCount}/${slot.totalMembers}`; }
                            return <td key={day}><div className={`tt-slot ${cls}`}>{text}</div></td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card">
            <div className="empty">
              <div style={{fontSize:24,marginBottom:8}}>✦</div>
              <p>Select a group to manage members and find free slots</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}