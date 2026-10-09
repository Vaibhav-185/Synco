import { useState, useEffect } from 'react';
import axios from 'axios';
import TimetableGrid from '../components/TimetableGrid';

const API = import.meta.env.VITE_API_URL;

export default function Friends() {
  const [friends, setFriends]           = useState([]);
  const [pending, setPending]           = useState([]);
  const [searchQ, setSearchQ]           = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchMsg, setSearchMsg]       = useState('');
  const [friendStatuses, setFriendStatuses] = useState({});
  // Timetable sharing state
  const [shareMode, setShareMode]       = useState('open');
  const [incoming, setIncoming]         = useState([]);
  const [outgoing, setOutgoing]         = useState([]);
  const [grants, setGrants]             = useState([]);
  const [shareMsg, setShareMsg]         = useState('');
  const [sentRequests, setSentRequests]   = useState([]);
  const [viewingId, setViewingId]       = useState(null);
  const [sharedSlots, setSharedSlots]   = useState({});
  const [sharedErr, setSharedErr]       = useState({});

  useEffect(() => {
    fetchFriends();
    fetchPending();
    fetchSharing();
    fetchSent();
  }, []);

  const fetchSharing = async () => {
    try {
      const [pref, inc, out, gr] = await Promise.all([
        axios.get(`${API}/sharing/preference`),
        axios.get(`${API}/sharing/incoming`),
        axios.get(`${API}/sharing/outgoing`),
        axios.get(`${API}/sharing/grants`)
      ]);
      setShareMode(pref.data.shareMode || 'open');
      setIncoming(inc.data);
      setOutgoing(out.data);
      setGrants(gr.data);
    } catch (err) { console.error(err); }
  };

  const fetchFriends = async () => {
    try {
      const res = await axios.get(`${API}/friends`);
      // Drop malformed entries (missing counterpart) so one bad record
      // can never blank the page.
      const list = (res.data || []).filter(f => f && f.friend && f.friend._id);
      setFriends(list);
      list.forEach(f => fetchFriendStatus(f.friend._id));
    } catch (err) { console.error(err); }
  };

  const fetchPending = async () => {
    try {
      const res = await axios.get(`${API}/friends/requests/pending`);
      setPending(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchFriendStatus = async (friendId) => {
    try {
      const res = await axios.get(`${API}/friends/status/${friendId}`);
      setFriendStatuses(prev => ({ ...prev, [friendId]: res.data }));
    } catch (err) {
      // Private mode surfaces as 403 with a safe message; show it plainly.
      const msg = err.response?.status === 403
        ? (err.response?.data?.message || 'Not sharing')
        : 'Status unavailable';
      setFriendStatuses(prev => ({ ...prev, [friendId]: { denied: msg } }));
    }
  };

  const setPreference = async (mode) => {
    try {
      const res = await axios.put(`${API}/sharing/preference`, { shareMode: mode });
      setShareMode(res.data.shareMode);
      setShareMsg(mode === 'private'
        ? 'Private mode on: friends see neither availability nor timetable.'
        : 'Sharing on: friends see availability; timetable only with permission.');
      fetchFriends();
    } catch (err) {
      setShareMsg(err.response?.data?.message || 'Could not update sharing preference');
    }
  };

  const requestAccess = async (ownerId) => {
    try {
      await axios.post(`${API}/sharing/request`, { ownerId });
      setShareMsg('Timetable access requested.');
      fetchSharing();
    } catch (err) {
      setShareMsg(err.response?.data?.message || 'Could not send request');
    }
  };

  const respondShare = async (id, action) => {
    try {
      await axios.put(`${API}/sharing/requests/${id}`, { action });
      setShareMsg(action === 'approved' ? 'Timetable access granted.' : 'Request declined.');
      fetchSharing();
    } catch (err) {
      setShareMsg(err.response?.data?.message || 'Could not respond');
    }
  };

  const revokeAccess = async (userId) => {
    try {
      await axios.delete(`${API}/sharing/access/${userId}`);
      setShareMsg('Timetable access revoked.');
      if (viewingId === userId) { setViewingId(null); }
      fetchSharing();
    } catch (err) {
      setShareMsg(err.response?.data?.message || 'Could not revoke access');
    }
  };

  const outgoingFor = (friendId) =>
    outgoing.find(o => String(o.owner?._id || o.owner) === String(friendId));

  const toggleViewTimetable = async (friend) => {
    if (viewingId === friend._id) { setViewingId(null); return; }
    // Always fetch fresh so a revocation takes effect on the next open.
    setSharedErr(prev => {
      const next = { ...prev };
      delete next[friend._id];
      return next;
    });
    setSharedSlots(prev => {
      const next = { ...prev };
      delete next[friend._id];
      return next;
    });
    try {
      const res = await axios.get(`${API}/timetable/shared/${friend._id}`);
      setSharedSlots(prev => ({ ...prev, [friend._id]: res.data }));
    } catch (err) {
      setSharedErr(prev => ({ ...prev, [friend._id]: err.response?.data?.message || 'Timetable unavailable' }));
    }
    setViewingId(friend._id);
  };

  const searchUser = async () => {
    if (!searchQ.trim()) return;
    setSearchMsg('Searching...');
    setSearchResult(null);
    try {
      const res = await axios.get(`${API}/friends/search?username=${searchQ.trim()}`);
      setSearchResult(res.data);
      setSearchMsg('');
    } catch (err) {
      setSearchMsg(err.response?.data?.message || 'User not found');
    }
  };

  const sendRequest = async (addresseeId) => {
    try {
      await axios.post(`${API}/friends/request`, { addresseeId });
      setSearchResult(null);
      setSearchQ('');
      setSearchMsg('Friend request sent.');
      fetchSent();
    } catch (err) {
      setSearchMsg(err.response?.data?.message || 'Error sending request');
    }
  };

  const fetchSent = async () => {
    try {
      const res = await axios.get(`${API}/friends/requests/sent`);
      setSentRequests(res.data || []);
    } catch (err) { console.error(err); }
  };

  const respondToRequest = async (id, action) => {
    try {
      await axios.put(`${API}/friends/request/${id}`, { action });
      fetchPending();
      if (action === 'accepted') fetchFriends();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Friends</div>
          <div className="page-sub">See who's free right now</div>
        </div>
      </div>

      <div className="card">
        <div className="card-row" style={{ marginBottom: shareMsg ? 8 : 0 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>Timetable sharing</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {shareMode === 'private'
                ? 'Private: friends see neither availability nor timetable.'
                : 'Friends see availability. Full timetable needs your approval.'}
            </div>
          </div>
          <div className="seg" role="group" aria-label="Sharing preference">
            <button className={shareMode === 'open' ? 'active' : ''} onClick={() => setPreference('open')}>Sharing on</button>
            <button className={shareMode === 'private' ? 'active' : ''} onClick={() => setPreference('private')}>Private</button>
          </div>
        </div>
        {shareMsg && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{shareMsg}</div>}
      </div>

      {(incoming.length > 0 || pending.length > 0 || sentRequests.length > 0) && (
        <h3 className="section-title" style={{ margin: '0 0 .5rem' }}>Requests</h3>
      )}

      {incoming.length > 0 && (
        <div className="card">
          <div className="card-title">Timetable requests ({incoming.length})</div>
          {incoming.map(req => (
            <div key={req._id} className="friend-row">
              <div className="friend-av">{(req.requester?.displayName || '?').slice(0, 2).toUpperCase()}</div>
              <div className="friend-info">
                <div className="friend-name">{req.requester?.displayName || 'Unknown user'}</div>
                <div className="friend-un">@{req.requester?.username || 'unknown'} <span className="pill gray">Timetable access</span></div>
              </div>
              <div className="friend-actions">
                <button className="btn accent sm" onClick={() => respondShare(req._id, 'approved')}>Allow</button>
                <button className="btn danger sm" onClick={() => respondShare(req._id, 'rejected')}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {grants.length > 0 && (
        <div className="card">
          <div className="card-title">Friends with timetable access ({grants.length})</div>
          {grants.map(g => (
            <div key={g._id} className="friend-row">
              <div className="friend-av">{(g.requester?.displayName || '?').slice(0, 2).toUpperCase()}</div>
              <div className="friend-info">
                <div className="friend-name">{g.requester?.displayName}</div>
                <div className="friend-un">@{g.requester?.username}</div>
              </div>
              <button className="btn sm" onClick={() => revokeAccess(g.requester?._id)}>Revoke</button>
            </div>
          ))}
        </div>
      )}

      {outgoing.filter(o => o.status !== 'approved').length > 0 && (
        <div className="card">
          <div className="card-title">My access requests</div>
          {outgoing.filter(o => o.status !== 'approved').map(o => (
            <div key={o._id} className="friend-row">
              <div className="friend-info">
                <div className="friend-name">{o.owner?.displayName}</div>
                <div className="friend-un">@{o.owner?.username}</div>
              </div>
              <span className="pill gray">{o.status === 'pending' ? 'Request pending' : 'Declined'}</span>
              {o.status === 'rejected' && (
                <button className="btn sm" onClick={() => requestAccess(o.owner?._id)}>Ask again</button>
              )}
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div className="card">
          <div className="card-title">Friend requests ({pending.length})</div>
          {pending.map(req => (
            <div key={req._id} className="friend-row">
              <div className="friend-av">{(req.requester?.displayName || '?').slice(0,2).toUpperCase()}</div>
              <div className="friend-info">
                <div className="friend-name">{req.requester?.displayName || 'Unknown user'}</div>
                <div className="friend-un">@{req.requester?.username || 'unknown'} <span className="pill gray">Friend request</span></div>
              </div>
              <div className="friend-actions">
                <button className="btn accent" onClick={() => respondToRequest(req._id, 'accepted')}>Accept</button>
                <button className="btn danger sm" onClick={() => respondToRequest(req._id, 'declined')}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sentRequests.length > 0 && (
        <div className="card">
          <div className="card-title">Sent friend requests ({sentRequests.length})</div>
          {sentRequests.map(req => (
            <div key={req._id} className="friend-row">
              <div className="friend-av">{(req.addressee?.displayName || '?').slice(0,2).toUpperCase()}</div>
              <div className="friend-info">
                <div className="friend-name">{req.addressee?.displayName || 'Unknown user'}</div>
                <div className="friend-un">@{req.addressee?.username || 'unknown'}</div>
              </div>
              <span className="pill gray">Pending</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">Find a friend</div>
        <div className="form-row">
          <div className="field">
            <label>Username</label>
            <input
              type="text" placeholder="vaibhav_cs"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value.replace(/[^a-z0-9_]/g,'').toLowerCase())}
              onKeyDown={e => e.key === 'Enter' && searchUser()}
            />
          </div>
          <button className="btn accent" onClick={searchUser}>Search</button>
        </div>
        {searchMsg && (
          <div style={{marginTop:8,fontSize:13,
            color:(searchMsg.includes('sent') || searchMsg === '') ? 'var(--accent)' : 'var(--text)'}}>
            {searchMsg}
          </div>
        )}
        {searchResult && (
          <div className="friend-row" style={{marginTop:10}}>
            <div className="friend-av">{(searchResult.displayName || '?').slice(0,2).toUpperCase()}</div>
            <div className="friend-info">
              <div className="friend-name">{searchResult.displayName || 'Unknown user'}</div>
              <div className="friend-un">@{searchResult.username}</div>
            </div>
            <button className="btn accent" onClick={() => sendRequest(searchResult._id)}>+ Add Friend</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">My friends ({friends.length})</div>
        {friends.length === 0 ? (
          <div className="empty">
            <p>No friends yet. Search a username above to add someone!</p>
          </div>
        ) : (
          friends.map(({ friend, friendshipId }) => {
            const s = friendStatuses[friend._id];
            const access = outgoingFor(friend._id);
            const isViewing = viewingId === friend._id;
            return (
              <div key={friendshipId}>
              <div className="friend-row">
                <div className="friend-av">{(friend.displayName || '?').slice(0,2).toUpperCase()}</div>
                <div className="friend-info">
                  <div className="friend-name">{friend.displayName || 'Unknown user'}</div>
                  <div className="friend-un">@{friend.username || 'unknown'}</div>
                </div>
                <div className="friend-status">
                  {s ? (
                    s.denied ? (
                      <span className="pill gray">{s.denied}</span>
                    ) : (
                      <span className={`status-badge ${s.inClass ? 'busy' : 'free'}`}>
                        {s.inClass ? 'In class' : 'Free'}
                      </span>
                    )
                  ) : (
                    <span className="pill gray">Loading...</span>
                  )}
                  {s?.inClass && s.currentClass && (
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>
                      {s.currentClass.subject} until {s.currentClass.endTime}
                    </div>
                  )}
                  {s?.nextClass && !s.inClass && (
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>
                      Next: {s.nextClass.subject} at {s.nextClass.startTime}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0 10px 46px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {access?.status === 'approved' ? 'Full timetable shared.' : 'Availability only.'}
                </span>
                {!access || access.status === 'rejected' ? (
                  <button className="btn sm" onClick={() => requestAccess(friend._id)}>Request timetable access</button>
                ) : access.status === 'pending' ? (
                  <span className="pill gray">Request pending</span>
                ) : (
                  <button className="btn sm" onClick={() => toggleViewTimetable(friend)}>{isViewing ? 'Hide timetable' : 'View timetable'}</button>
                )}
              </div>
              {isViewing && (
                <div style={{ paddingBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{friend.displayName}: weekly timetable</div>
                  {sharedErr[friend._id] ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sharedErr[friend._id]}</div>
                  ) : sharedSlots[friend._id] ? (
                    sharedSlots[friend._id].length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>No timetable shared yet.</div>
                    ) : (
                      <TimetableGrid slots={sharedSlots[friend._id]} />
                    )
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading...</div>
                  )}
                </div>
              )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}