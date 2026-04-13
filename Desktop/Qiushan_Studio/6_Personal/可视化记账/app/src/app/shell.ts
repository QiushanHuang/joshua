export function buildShell(): HTMLDivElement {
  const root = document.createElement('div');
  root.dataset.appShell = 'true';
  root.innerHTML = `
    <div class="app-shell">
      <header class="app-shell__header">Asset Tracker Foundation</header>
      <main class="app-shell__main">
        <p data-role="boot-status">Loading local book...</p>
        <div id="app-root"></div>
      </main>
    </div>
  `;
  return root;
}
