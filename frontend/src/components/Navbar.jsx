import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const isActive = path => location.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <div className="nav-logo">syn<span>co</span></div>
      <div className="nav-links">
        <Link to="/"        className={isActive('/')}>Dashboard</Link>
        <Link to="/friends" className={isActive('/friends')}>Friends</Link>
        <Link to="/groups"  className={isActive('/groups')}>Groups</Link>
      </div>
      <div className="nav-user">
        <div className="nav-av" style={{ background: user?.avatarColor + '33', color: user?.avatarColor }}>
          {user?.displayName?.slice(0,2).toUpperCase()}
        </div>
        <span className="nav-name">{user?.displayName}</span>
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
