import React from "react";

import WorkspacePage from "./features/workspace/WorkspacePage";

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div>
            <p className="app-kicker">GenAI Assistant</p>
          </div>
          <span className="app-header-badge">Live</span>
        </div>
      </header>

      <div className="app-body">
        <WorkspacePage />
      </div>
    </main>
  );
}

export default App;
