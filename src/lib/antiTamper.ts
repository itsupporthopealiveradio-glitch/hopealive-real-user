export function initAntiTamper() {
  if (import.meta.env.DEV) return; // Don't run in development

  // Disable right-click
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Detect DevTools open (basic approach)
  const element = new Image();
  Object.defineProperty(element, 'id', {
    get: function () {
      // If devtools is opened and logging happens or element is inspected
      document.body.innerHTML = 'Security violation detected.';
      window.location.replace("about:blank");
    }
  });
  console.log('%c', element);

  // Periodically check for debugger
  setInterval(() => {
    const start = performance.now();
    debugger; // This will pause execution if DevTools is open
    const end = performance.now();
    if (end - start > 100) {
      // Execution was paused
      document.body.innerHTML = 'Security violation detected.';
      window.location.replace("about:blank");
    }
  }, 2000);
}
