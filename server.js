const express = require('express');
const path = require('path');

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

app.get('/', (req, res, next) => {
  if (req.query.forceError === '1') {
    return next(new Error('Forced error via query'));
  }
  // compute featured list and pass as `items` to the home view so the collection markup can be reused
  const featured = (items || []).filter(i => i.featured);
  return res.render('pages/home', { title: 'Home', items: featured });
});
app.get('/about', (req, res) => res.render('pages/about', { title: 'About' }));
app.get('/services', (req, res) => res.render('pages/services', { title: 'Services' }));
app.get('/blog', (req, res) => res.render('pages/blog', { title: 'Blog' }));
app.get('/contact', (req, res) => res.render('pages/contact', { title: 'Contact' }));

app.post('/contact', (req, res) => {
  // avoid shadowing the template `message` variable by renaming the incoming message
  const { name, email, message: userMessage } = req.body;
  const form = { name: name || '', email: email || '', message: userMessage || '' };
  if (!form.name || !form.email || !form.message) {
    return res.status(400).render('pages/contact', { title: 'Contact', message: { type: 'error', text: 'All fields are required.' }, form });
  }

  return res.render('pages/contact', { title: 'Contact', message: { type: 'success', text: 'Thanks — your message was sent.' } });
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

app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('pages/500', { title: 'Server Error' });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
