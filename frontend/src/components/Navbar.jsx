import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
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
        <button className="btn-signout" onClick={logout}>Sign out</button>
      </div>
    </nav>
  );
}
