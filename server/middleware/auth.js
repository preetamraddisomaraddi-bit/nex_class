const jwt = require('jsonwebtoken');

const JWT_SECRET = 'edusync_secret_key_2024';
const JWT_SECRET_ADMIN = process.env.JWT_SECRET_ADMIN || 'edusync_admin_secret_key_change_in_production';

function verifyTeacher(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authorization token required' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

function verifyStudent(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authorization token required' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

function verifyAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Admin authorization token required' });
  
  jwt.verify(token, JWT_SECRET_ADMIN, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired admin token' });
    req.admin = decoded;
    next();
  });
}

module.exports = {
  verifyTeacher,
  verifyStudent,
  verifyAdmin
};
