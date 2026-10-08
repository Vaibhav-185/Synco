const jwt = require('jsonwebtoken');

// Protects routes — checks every request for a valid JWT token
module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ message: 'No token — please log in' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId; // now available in every protected route
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};