const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { randomUUID } = require('crypto');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'gylam-panel-secret-change-me';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const NODES_FILE = path.join(DATA_DIR, 'nodes.json');

function ensureData() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(USERS_FILE)) writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  if (!existsSync(NODES_FILE)) writeFileSync(NODES_FILE, JSON.stringify({ nodes: [] }, null, 2));
}
ensureData();

function readUsers() {
  try { return JSON.parse(readFileSync(USERS_FILE, 'utf-8')).users || []; }
  catch { return []; }
}
function writeUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
}
function readNodes() {
  try { return JSON.parse(readFileSync(NODES_FILE, 'utf-8')).nodes || []; }
  catch { return []; }
}
function writeNodes(nodes) {
  writeFileSync(NODES_FILE, JSON.stringify({ nodes }, null, 2));
}

function safeUser(u) {
  const { password_hash, ...rest } = u;
  return rest;
}
function signToken(user) {
  return jwt.sign({ id: user.id, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
}

function createApiServer() {
  const app = express();
  app.use(express.json());

  function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'No token' });
    try { req.user = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET); next(); }
    catch { res.status(401).json({ error: 'Invalid token' }); }
  }
  function adminOnly(req, res, next) {
    if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', panel: 'Gylam Panel', made: 'Nethost Team' }));

  app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const users = readUsers();
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const isFirst = users.length === 0;
    const user = { id: randomUUID(), username, email: email.toLowerCase(), password_hash: hash, is_admin: isFirst, created_at: new Date().toISOString() };
    users.push(user); writeUsers(users);
    res.json({ user: safeUser(user), token: signToken(user) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    const users = readUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ user: safeUser(user), token: signToken(user) });
  });

  app.get('/api/auth/me', auth, (req, res) => {
    const user = readUsers().find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  });

  app.post('/api/admin/create', async (req, res) => {
    const { username, email, password, secret } = req.body;
    const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET || 'gylam-bootstrap';
    const users = readUsers();

    if (secret !== bootstrapSecret) {
      const header = req.headers.authorization;
      if (!header) return res.status(403).json({ error: 'Unauthorized' });
      try { const decoded = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET); if (!decoded.is_admin) return res.status(403).json({ error: 'Admin only' }); }
      catch { return res.status(403).json({ error: 'Invalid token' }); }
    }
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (idx !== -1) { users[idx].is_admin = true; writeUsers(users); return res.json({ user: safeUser(users[idx]), message: 'Promoted to admin' }); }
    const hash = await bcrypt.hash(password, 10);
    const user = { id: randomUUID(), username, email: email.toLowerCase(), password_hash: hash, is_admin: true, created_at: new Date().toISOString() };
    users.push(user); writeUsers(users);
    res.json({ user: safeUser(user), message: 'Admin created' });
  });

  app.get('/api/admin/users', auth, adminOnly, (_req, res) => res.json({ users: readUsers().map(safeUser) }));
  app.delete('/api/admin/users/:id', auth, adminOnly, (req, res) => { writeUsers(readUsers().filter((u) => u.id !== req.params.id)); res.json({ success: true }); });
  app.patch('/api/admin/users/:id', auth, adminOnly, (req, res) => {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    if (typeof req.body.is_admin === 'boolean') users[idx].is_admin = req.body.is_admin;
    if (req.body.username) users[idx].username = req.body.username;
    writeUsers(users);
    res.json({ user: safeUser(users[idx]) });
  });

  app.get('/api/nodes', auth, (_req, res) => res.json({ nodes: readNodes() }));
  app.post('/api/nodes', auth, adminOnly, (req, res) => {
    const nodes = readNodes();
    const node = { id: randomUUID(), name: req.body.name, ip_assigned: req.body.ip_assigned, status: 'offline', location: req.body.location || '', ram_total_mb: req.body.ram_total_mb || 4096, disk_total_mb: req.body.disk_total_mb || 20480, cpu_total_percent: req.body.cpu_total_percent || 200, created_at: new Date().toISOString() };
    nodes.push(node); writeNodes(nodes);
    res.json({ node });
  });
  app.post('/api/nodes/:id/heartbeat', (req, res) => {
    const nodes = readNodes();
    const idx = nodes.findIndex((n) => n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Node not found' });
    nodes[idx].status = req.body.status || 'online'; writeNodes(nodes);
    res.json({ success: true, status: nodes[idx].status });
  });
  app.delete('/api/nodes/:id', auth, adminOnly, (req, res) => { writeNodes(readNodes().filter((n) => n.id !== req.params.id)); res.json({ success: true }); });

  return app;
}

module.exports = { createApiServer };
