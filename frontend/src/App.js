import React from "react";
import Chat from "./Chat";

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div>
            <p className="app-kicker">Document Assistant</p>
          </div>
          <span className="app-header-badge">Live</span>
        </div>
      </header>

      <div className="app-body">
        <Chat />
      </div>
    </main>
  );
}

export default App;
