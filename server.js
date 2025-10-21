const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.url}`);
  next();
});
const items = require('./data/items.json');

// Simple in-memory admin token store. Tokens are short-lived and lost on server restart.
const adminTokens = new Set();
const ADMIN_PASS = process.env.ADMIN_PASS || 'letmein'; // change this in your environment for production

function parseCookies(req) {
  const hdr = req.headers && req.headers.cookie;
  const out = {};
  if (!hdr) return out;
  hdr.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies.admin_token;
  if (token && adminTokens.has(token)) return next();
  // not authenticated -> send to login
  return res.redirect('/admin/login');
}


app.get('/', (req, res, next) => {
  if (req.query.forceError === '1') {
    return next(new Error('Forced error via query'));
  }
  const featured = (items || []).filter(i => i.featured);
  return res.render('pages/home', { title: 'Home', items: featured });
});
app.get('/about', (req, res) => res.render('pages/about', { title: 'About' }));
app.get('/services', (req, res) => res.render('pages/services', { title: 'Services' }));
app.get('/blog', (req, res) => res.render('pages/blog', { title: 'Blog' }));
app.get('/contact', (req, res) => res.render('pages/contact', { title: 'Contact', form: {} }));

app.post('/contact', (req, res) => {
  const { name, email, message: userMessage } = req.body;
  const form = { name: name || '', email: email || '', message: userMessage || '' };
  if (!form.name || !form.email || !form.message) {
    return res.status(400).render('pages/contact', { title: 'Contact', message: { type: 'error', text: 'All fields are required.' }, form });
  }

  return res.render('pages/contact', { title: 'Contact', message: { type: 'success', text: 'Thanks — your message was sent.' }, form: {} });
});
app.get('/items', (req, res) => {
  res.render('pages/collection', { title: 'Collection', items });
});

app.get('/items/:slug', (req, res, next) => {
  const item = items.find(i => i.slug === req.params.slug);
  if (!item) return next();
  res.render('pages/detail', { title: item.title, item });
});

app.get('/category/:category', (req, res, next) => {
  const cat = String(req.params.category || '').toLowerCase();
  const list = items.filter(i => (i.category || '').toLowerCase() === cat);
  if (!list.length) return res.status(404).render('pages/404', { title: 'Not Found' });
  const nice = cat.charAt(0).toUpperCase() + cat.slice(1);
  res.render('pages/collection', { title: nice, items: list });
});

// Admin: show items and saved messages (messages.json optional)
app.get('/admin/login', (req, res) => {
  // show a simple passcode login
  res.render('pages/admin-login', { title: 'Admin Login', error: null });
});

app.post('/admin/login', (req, res) => {
  const pass = String(req.body.pass || '');
  if (!pass || pass !== ADMIN_PASS) {
    return res.status(401).render('pages/admin-login', { title: 'Admin Login', error: 'Invalid passcode' });
  }

  // generate a token and set it as an HttpOnly cookie
  const token = crypto.randomBytes(24).toString('hex');
  adminTokens.add(token);
  res.setHeader('Set-Cookie', `admin_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`);
  return res.redirect('/admin');
});

app.post('/admin/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies.admin_token;
  if (token) adminTokens.delete(token);
  // clear cookie
  res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  return res.redirect('/');
});

// Admin: show items and saved messages (messages.json optional)
app.get('/admin', requireAdmin, (req, res) => {
  let messages = [];
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'data', 'messages.json'), 'utf8');
    messages = JSON.parse(raw || '[]');
  } catch (err) {
    messages = [];
  }

  // allow showing a success flag after posting
  const added = req.query.added === '1';
  const deleted = req.query.deleted === '1';
  res.render('pages/admin', { title: 'Admin', items, messages, added, deleted });
});

// Accept new listing submissions from admin form and persist to data/items.json
app.post('/admin/items', requireAdmin, (req, res) => {
  const { title, price, category, mileage, image, image2, image3, description, featured } = req.body;
  if (!title || !price) {
    return res.status(400).render('pages/admin', { title: 'Admin', items, messages: [], added: false, error: 'Title and price are required.' });
  }

  // generate a URL-safe slug and ensure uniqueness
  const baseSlug = String(title).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  let slug = baseSlug;
  let idx = 1;
  while (items.find(i => i.slug === slug)) {
    slug = `${baseSlug}-${idx++}`;
  }

  // collect images into an array (preserve original single `image` field for thumbnail/backwards-compat)
  const images = [];
  if (image && String(image).trim()) images.push(String(image).trim());
  if (image2 && String(image2).trim()) images.push(String(image2).trim());
  if (image3 && String(image3).trim()) images.push(String(image3).trim());

  const newItem = {
    title: String(title),
    price: String(price),
    category: category || '',
    mileage: mileage || '',
    image: images[0] || '',
    images: images,
    description: description || '',
    slug,
  };
  if (featured && (featured === 'on' || featured === 'true' || featured === '1')) newItem.featured = true;

  // append to in-memory array and persist to disk
  items.push(newItem);
  try {
    fs.writeFileSync(path.join(__dirname, 'data', 'items.json'), JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write items.json', err);
    return res.status(500).render('pages/admin', { title: 'Admin', items, messages: [], added: false, error: 'Failed to save item.' });
  }

  // redirect back to admin with a success flag
  return res.redirect('/admin?added=1');
});

// Show edit form for an item
app.get('/admin/items/edit', requireAdmin, (req, res) => {
  const slug = String(req.query.slug || '');
  if (!slug) return res.redirect('/admin');
  const item = items.find(i => i.slug === slug);
  if (!item) return res.redirect('/admin');
  res.render('pages/admin-edit', { title: 'Edit listing', item, error: null });
});

// Accept edits and persist
app.post('/admin/items/edit', requireAdmin, (req, res) => {
  const { slug, title, price, category, mileage, image, image2, image3, description, featured } = req.body;
  if (!slug) return res.redirect('/admin');
  const idx = items.findIndex(i => i.slug === slug);
  if (idx === -1) return res.redirect('/admin');

  if (!title || !price) {
    return res.status(400).render('pages/admin-edit', { title: 'Edit listing', item: items[idx], error: 'Title and price are required.' });
  }

  const images = [];
  if (image && String(image).trim()) images.push(String(image).trim());
  if (image2 && String(image2).trim()) images.push(String(image2).trim());
  if (image3 && String(image3).trim()) images.push(String(image3).trim());

  const updated = Object.assign({}, items[idx], {
    title: String(title),
    price: String(price),
    category: category || '',
    mileage: mileage || '',
    image: images[0] || (items[idx].image || ''),
    images: images.length ? images : (items[idx].images || (items[idx].image ? [items[idx].image] : [])),
    description: description || '',
  });
  if (featured && (featured === 'on' || featured === 'true' || featured === '1')) updated.featured = true; else delete updated.featured;

  items[idx] = updated;

  try {
    fs.writeFileSync(path.join(__dirname, 'data', 'items.json'), JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write items.json', err);
    return res.status(500).render('pages/admin-edit', { title: 'Edit listing', item: items[idx], error: 'Failed to save item.' });
  }

  return res.redirect('/admin?updated=1');
});

// Remove an item by slug from admin
app.post('/admin/items/delete', requireAdmin, (req, res) => {
  const slug = String(req.body.slug || '');
  if (!slug) return res.redirect('/admin');

  const idx = items.findIndex(i => i.slug === slug);
  if (idx === -1) return res.redirect('/admin');

  // remove from array
  items.splice(idx, 1);

  try {
    fs.writeFileSync(path.join(__dirname, 'data', 'items.json'), JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write items.json', err);
    return res.status(500).render('pages/admin', { title: 'Admin', items, messages: [], added: false, error: 'Failed to delete item.' });
  }

  return res.redirect('/admin?deleted=1');
});

app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('pages/500', { title: 'Server Error' });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
