// Applies the saved streamer flag to <html> before first paint.
// Single visual identity, so there's no light/dark theme to restore.
export function ThemeScript() {
  const code = `
(function(){try{
  if (localStorage.getItem('rtg-streamer') === '1') document.documentElement.classList.add('streamer');
}catch(e){}})();
`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
