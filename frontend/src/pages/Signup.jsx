import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Signup() {
  const { signup } = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]     = useState({ displayName: '', username: '', email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    const val = e.target.name === 'username'
      ? e.target.value.replace(/[^a-z0-9_]/g, '').toLowerCase()
      : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signup(form.displayName, form.username, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">syn<span>co</span></div>
        <p className="auth-tagline">Create your account</p>
        {error && <div className="error-bar">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Display name</label>
            <input type="text" name="displayName" value={form.displayName} onChange={handleChange} placeholder="Alex Morgan" required />
          </div>
          <div className="field">
            <label>Username</label>
            <input type="text" name="username" value={form.username} onChange={handleChange} placeholder="alex_123" required />
            <span className="hint">Lowercase, numbers, underscores only.</span>
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="min 6 characters" required />
          </div>
          <button className="btn-main" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        <p className="legal-footer"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></p>
      </div>
    </div>
  );
}
