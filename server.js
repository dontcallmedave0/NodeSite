const express = require('express');
const path = require('path');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, images, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Simple request logger (shows what page you visit)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.url}`);
  next();
});

// Routes (your website pages)
app.get('/', (req, res) => res.render('pages/home', { title: 'Home' }));
app.get('/about', (req, res) => res.render('pages/about', { title: 'About' }));
app.get('/services', (req, res) => res.render('pages/services', { title: 'Services' }));
app.get('/blog', (req, res) => res.render('pages/blog', { title: 'Blog' }));
app.get('/contact', (req, res) => res.render('pages/contact', { title: 'Contact' }));

// 404 - Page not found
app.use((req, res) => {
  res.status(404).render('pages/home', { title: 'Not Found' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
