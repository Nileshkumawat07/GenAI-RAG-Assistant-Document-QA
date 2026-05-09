import React from "react";

function renderResultMeta(item) {
  const tags = [item?.meta?.typeLabel, item?.pageKey, item?.tabKey].filter(Boolean);
  return tags.slice(0, 3);
}

function CommandPalette({
  open,
  query,
  items,
  filters = [],
  filterCounts = {},
  activeFilter = "all",
  highlights = [],
  onClose,
  onQueryChange,
  onFilterChange,
  onSelect,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette-shell" onClick={(event) => event.stopPropagation()}>
        <div className="command-palette-head">
          <div className="command-palette-copy">
            <span className="command-palette-kicker">Premium Search</span>
            <h3>Search with ranked results, scope filters, and deeper workspace coverage</h3>
          </div>
          <button type="button" className="command-palette-close" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="command-palette-search-panel">
          <input
            autoFocus
            type="text"
            className="command-palette-input"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search tools, pages, docs, pricing, teams, trust, admin, content..."
          />
          <div className="command-palette-highlights">
            {highlights.map((item) => (
              <span key={item} className="command-palette-highlight-pill">{item}</span>
            ))}
          </div>
          <div className="command-palette-filter-row">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`command-palette-filter-chip ${activeFilter === filter.id ? "active" : ""}`}
                onClick={() => onFilterChange(filter.id)}
              >
                <strong>{filter.label}</strong>
                <span>{filterCounts[filter.id] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="command-palette-list">
          {items.length > 0 ? (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`command-palette-item ${index === 0 ? "is-featured" : ""}`}
                onClick={() => onSelect(item)}
              >
                <div className="command-palette-item-main">
                  <div className="command-palette-item-topline">
                    <strong>{item.label}</strong>
                    <span className="command-palette-item-group">{item.group}</span>
                  </div>
                  <p>{item.description}</p>
                  <div className="command-palette-item-meta">
                    {renderResultMeta(item).map((tag) => (
                      <span key={`${item.id}-${tag}`} className="command-palette-item-tag">{tag}</span>
                    ))}
                  </div>
                </div>
                <span className="command-palette-rank-badge">{String(index + 1).padStart(2, "0")}</span>
              </button>
            ))
          ) : (
            <div className="command-palette-empty">
              <strong>No premium matches</strong>
              <p>Try narrower terms or use filters like `in:workspace`, `type:content`, or `page:pricing`.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
