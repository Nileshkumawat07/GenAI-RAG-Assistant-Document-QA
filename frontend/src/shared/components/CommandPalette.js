import React from "react";

function CommandPalette({ open, query, items, onClose, onQueryChange, onSelect }) {
  if (!open) {
    return null;
  }

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette-shell" onClick={(event) => event.stopPropagation()}>
        <div className="command-palette-head">
          <div>
            <span className="command-palette-kicker">Quick Navigation</span>
            <h3>Search pages, tools, and workspace actions</h3>
          </div>
          <button type="button" className="command-palette-close" onClick={onClose}>
            Esc
          </button>
        </div>

        <input
          autoFocus
          type="text"
          className="command-palette-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Jump to dashboard, pricing, FAQs, notifications, teams..."
        />

        <div className="command-palette-list">
          {items.length > 0 ? (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="command-palette-item"
                onClick={() => onSelect(item)}
              >
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.description}</p>
                </div>
                <span>{item.group}</span>
              </button>
            ))
          ) : (
            <div className="command-palette-empty">
              <strong>No results yet</strong>
              <p>Try searching for dashboard, pricing, support, profile, or teams.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
