// ── Account field validation (pure helpers, shared by routes + tests) ──
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

function validateDisplayName(v) {
  if (!v || !String(v).trim()) return 'Display name is required';
  if (String(v).trim().length > 60) return 'Display name must be 60 characters or fewer';
  return null;
}

function validateUsername(v) {
  if (!v || !String(v).trim()) return 'Username is required';
  if (!USERNAME_RE.test(String(v).trim()))
    return 'Username must be 3-30 characters: lowercase letters, numbers, underscores';
  return null;
}

function normalizeUsername(v) {
  return String(v).trim().toLowerCase();
}

function validatePassword(v) {
  if (!v) return 'Password is required';
  if (String(v).length < 6) return 'Password must be at least 6 characters';
  return null;
}

module.exports = { validateDisplayName, validateUsername, normalizeUsername, validatePassword };
