import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL;

export default function Profile() {
  const { user, logout, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const [nameForm, setNameForm] = useState({ displayName: '', username: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');

  useEffect(() => {
    (async () => {
      const data = await refreshMe();
      if (data) {
        setMe(data);
        setNameForm({ displayName: data.displayName || '', username: data.username || '' });
      }
      setLoading(false);
    })();
  }, []);

  const copyUsername = async () => {
    try {
      await navigator.clipboard.writeText('@' + (me?.username || user?.username || ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      const res = await axios.put(`${API}/auth/profile`, {
        displayName: nameForm.displayName,
        username: nameForm.username.toLowerCase()
      });
      setProfileMsg('Profile updated.');
      await refreshMe();
      if (res.data?.user) setMe(res.data.user);
    } catch (err) {
      setProfileMsg(err.response?.data?.message || 'Could not update profile');
    }
    setSavingProfile(false);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSavingPw(true);
    setPwMsg('');
    try {
      const res = await axios.put(`${API}/auth/password`, pwForm);
      setPwMsg(res.data.message || 'Password changed.');
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setPwMsg(err.response?.data?.message || 'Could not change password');
    }
    setSavingPw(false);
  };

  const deleteAccount = async () => {
    setDeleteMsg('');
    try {
      await axios.delete(`${API}/auth/account`, { data: { password: deletePw } });
      logout();
      navigate('/login');
    } catch (err) {
      setDeleteMsg(err.response?.data?.message || 'Could not delete account');
    }
  };

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>;
  const shown = me || {};
  const email = shown.email || user?.email || '';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">My Profile</div>
          <div className="page-sub">Your identity and account settings</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="friend-av" style={{ width: 52, height: 52, fontSize: 17 }}>
            {((shown.displayName || user?.displayName) || '?').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 700 }}>{shown.displayName || user?.displayName}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>@{shown.username || user?.username}</div>
          </div>
          <button className="btn sm" onClick={copyUsername}>{copied ? 'Copied' : 'Copy username'}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Personal information</div>
        <form onSubmit={saveProfile}>
          <div className="field">
            <label>Full name</label>
            <input type="text" value={nameForm.displayName}
              onChange={e => setNameForm({ ...nameForm, displayName: e.target.value })} required />
          </div>
          <div className="field">
            <label>Username</label>
            <input type="text" value={nameForm.username}
              onChange={e => setNameForm({ ...nameForm, username: e.target.value.replace(/[^a-z0-9_]/g, '').toLowerCase() })} required />
            <span className="hint">Lowercase, numbers, underscores only. Must stay unique.</span>
          </div>
          <div className="field">
            <label>Email address</label>
            <input type="email" value={email} disabled />
            <span className="hint">
              {shown.emailVerified ? 'Verified.' : 'Not verified. Email changes are not supported yet.'}
            </span>
          </div>
          {profileMsg && <div style={{ fontSize: 12, marginBottom: 8, color: profileMsg.includes('updated') ? 'var(--accent)' : 'var(--error)' }}>{profileMsg}</div>}
          <button className="btn accent" type="submit" disabled={savingProfile}>
            {savingProfile ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">Account security</div>
        <form onSubmit={changePassword}>
          <div className="field">
            <label>Current password</label>
            <input type="password" value={pwForm.currentPassword}
              onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={pwForm.newPassword} placeholder="min 6 characters"
              onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
          </div>
          {pwMsg && <div style={{ fontSize: 12, marginBottom: 8, color: pwMsg.includes('changed') ? 'var(--accent)' : 'var(--error)' }}>{pwMsg}</div>}
          <button className="btn" type="submit" disabled={savingPw}>
            {savingPw ? 'Changing...' : 'Change password'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">Privacy and sharing</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
          Control who sees your availability and timetable.
        </p>
        <Link to="/friends" className="btn sm" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Manage sharing settings
        </Link>
      </div>

      <div className="card">
        <div className="card-title">Session</div>
        <button className="btn sm" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
      </div>

      <div className="card" style={{ borderColor: 'var(--error-border)' }}>
        <div className="card-title" style={{ color: 'var(--error)' }}>Delete account</div>
        {!confirmDelete ? (
          <button className="btn danger sm" onClick={() => setConfirmDelete(true)}>Delete my account</button>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
              This removes your timetable, friendships, groups memberships, and shares permanently. Enter your password to confirm.
            </p>
            <div className="field">
              <label>Password</label>
              <input type="password" value={deletePw} onChange={e => setDeletePw(e.target.value)} />
            </div>
            {deleteMsg && <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--error)' }}>{deleteMsg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn danger sm" onClick={deleteAccount}>Yes, delete everything</button>
              <button className="btn sm" onClick={() => { setConfirmDelete(false); setDeletePw(''); setDeleteMsg(''); }}>Keep</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
