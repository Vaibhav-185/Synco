import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const API = import.meta.env.VITE_API_URL;

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const isActive = path => location.pathname === path ? 'nav-link active' : 'nav-link';
  const [requestCount, setRequestCount] = useState(0);

  // Badge: real pending counts (friend requests + timetable-access requests).
  useEffect(() => {
    if (!user) { setRequestCount(0); return; }
    let alive = true;
    (async () => {
      try {
        const [fr, sh] = await Promise.all([
          axios.get(`${API}/friends/requests/pending`),
          axios.get(`${API}/sharing/incoming`)
        ]);
        if (alive) setRequestCount((fr.data || []).length + (sh.data || []).length);
      } catch { /* badge stays hidden on error */ }
    })();
    return () => { alive = false; };
  }, [user, location.pathname]);

  return (
    <nav className="navbar">
      <div className="nav-logo">syn<span>co</span></div>
      <div className="nav-links">
        <Link to="/"        className={isActive('/')}>Dashboard</Link>
        <Link to="/friends" className={isActive('/friends')}>
          Friends{requestCount > 0 && <span className="nav-badge">{requestCount}</span>}
        </Link>
        <Link to="/groups"  className={isActive('/groups')}>Groups</Link>
      </div>
      <div className="nav-user">
        <Link to="/profile" className="nav-profile" title="My profile">
          <div className="nav-av" style={{ background: user?.avatarColor + '33', color: user?.avatarColor }}>
            {(user?.displayName || '?').slice(0,2).toUpperCase()}
          </div>
          <span className="nav-name">{user?.displayName}</span>
        </Link>
        <select
          className="theme-select"
          value={theme}
          onChange={e => setTheme(e.target.value)}
          aria-label="Color theme"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <button className="btn-signout" onClick={logout}>Sign out</button>
      </div>
    </nav>
  );
}
