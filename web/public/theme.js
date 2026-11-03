// Applies the saved theme before first paint (an external file because the CSP blocks inline scripts).
try {
  var t = localStorage.getItem('checklater.theme');
  var demo = new URLSearchParams(location.search).get('theme');
  if (demo === 'light' || demo === 'dark') t = demo;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
