const express = require('express');
const path = require('path');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, images, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing for form POSTs
app.use(express.urlencoded({ extended: true }));

// Simple request logger (shows what page you visit)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.url}`);
  next();
});

// Routes (your website pages)
app.get('/', (req, res, next) => {
  if (req.query.forceError === '1') {
    return next(new Error('Forced error via query'));
  }
  res.render('pages/home', { title: 'Home' });
});
app.get('/about', (req, res) => res.render('pages/about', { title: 'About' }));
app.get('/services', (req, res) => res.render('pages/services', { title: 'Services' }));
app.get('/blog', (req, res) => res.render('pages/blog', { title: 'Blog' }));
app.get('/contact', (req, res) => res.render('pages/contact', { title: 'Contact' }));

// Handle contact POST
app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).render('pages/contact', { title: 'Contact', message: { type: 'error', text: 'All fields are required.' } });
  }

  // In a real app you'd send/email/store the message. We'll just show a success message.
  return res.render('pages/contact', { title: 'Contact', message: { type: 'success', text: 'Thanks — your message was sent.' } });
});

// Items collection and detail
const items = require('./data/items.json');

app.get('/items', (req, res) => {
  res.render('pages/collection', { title: 'Collection', items });
});

app.get('/items/:slug', (req, res, next) => {
  const item = items.find(i => i.slug === req.params.slug);
  if (!item) return next();
  res.render('pages/detail', { title: item.title, item });
});

// Temporary route to force a server error for testing the 500 page
app.get('/error', (req, res, next) => {
  // create an error and pass to next() so Express uses the error handler
  const err = new Error('Forced test error');
  next(err);
});

// 404 - Page not found
app.use((req, res) => {
  res.status(404).render('pages/home', { title: 'Not Found' });
});

// 500 - Server error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('pages/500', { title: 'Server Error' });
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
