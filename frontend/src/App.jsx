import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login     from './pages/Login';
import Signup    from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Friends   from './pages/Friends';
import Groups    from './pages/Groups';
import Privacy   from './pages/Privacy';
import Terms     from './pages/Terms';
import Navbar    from './components/Navbar';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms"   element={<Terms />} />
          <Route path="/" element={
            <PrivateRoute><Navbar /><Dashboard /></PrivateRoute>
          }/>
          <Route path="/friends" element={
            <PrivateRoute><Navbar /><Friends /></PrivateRoute>
          }/>
          <Route path="/groups" element={
            <PrivateRoute><Navbar /><Groups /></PrivateRoute>
          }/>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
