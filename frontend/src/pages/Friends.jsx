import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

export default function Friends() {
  const [friends, setFriends]           = useState([]);
  const [pending, setPending]           = useState([]);
  const [searchQ, setSearchQ]           = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchMsg, setSearchMsg]       = useState('');
  const [friendStatuses, setFriendStatuses] = useState({});

  useEffect(() => {
    fetchFriends();
    fetchPending();
  }, []);

  const fetchFriends = async () => {
    try {
      const res = await axios.get(`${API}/friends`);
      setFriends(res.data);
      res.data.forEach(f => fetchFriendStatus(f.friend._id));
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
    } catch (err) { console.error(err); }
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
    } catch (err) {
      setSearchMsg(err.response?.data?.message || 'Error sending request');
    }
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

      {pending.length > 0 && (
        <div className="card">
          <div className="card-title">Friend requests ({pending.length})</div>
          {pending.map(req => (
            <div key={req._id} className="friend-row">
              <div className="friend-av">{req.requester.displayName.slice(0,2).toUpperCase()}</div>
              <div className="friend-info">
                <div className="friend-name">{req.requester.displayName}</div>
                <div className="friend-un">@{req.requester.username}</div>
              </div>
              <div className="friend-actions">
                <button className="btn accent" onClick={() => respondToRequest(req._id, 'accepted')}>Accept</button>
                <button className="btn danger sm" onClick={() => respondToRequest(req._id, 'declined')}>Decline</button>
              </div>
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
            <div className="friend-av">{searchResult.displayName.slice(0,2).toUpperCase()}</div>
            <div className="friend-info">
              <div className="friend-name">{searchResult.displayName}</div>
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
            return (
              <div key={friendshipId} className="friend-row">
                <div className="friend-av">{friend.displayName.slice(0,2).toUpperCase()}</div>
                <div className="friend-info">
                  <div className="friend-name">{friend.displayName}</div>
                  <div className="friend-un">@{friend.username}</div>
                </div>
                <div>
                  {s ? (
                    <span className={`status-badge ${s.inClass ? 'busy' : 'free'}`}>
                      {s.inClass ? 'In ' + s.currentClass?.subject : 'Free'}
                    </span>
                  ) : (
                    <span className="pill gray">Loading...</span>
                  )}
                  {s?.nextClass && !s.inClass && (
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>
                      Next: {s.nextClass.subject} at {s.nextClass.startTime}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}