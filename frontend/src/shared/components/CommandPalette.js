import React from "react";

function renderResultMeta(item) {
  const tags = [item?.meta?.typeLabel, item?.pageKey, item?.tabKey].filter(Boolean);
  return tags.slice(0, 3);
}

function buildResultVariant(item) {
  const label = String(item?.label || "").toLowerCase();
  const group = String(item?.group || "").toLowerCase();

  if (label.includes("analytics")) return "analytics";
  if (label.includes("chat")) return "chat";
  if (label.includes("team")) return "team";
  if (label.includes("pricing")) return "pricing";
  if (label.includes("trust") || label.includes("security")) return "trust";
  if (group.includes("support")) return "support";
  if (item?.itemType === "content") return "content";
  return "workspace";
}

function buildScore(index) {
  return Math.max(72, 98 - (index * 4));
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
        <section className="command-palette-hero">
          <div className="command-palette-hero-copy">
            <span className="command-palette-kicker">Premium Search</span>
            <h3>Intelligent workspace discovery</h3>
            <p>Find tools, teams, analytics, chats and content instantly.</p>
          </div>

          <div className="command-palette-hero-visual" aria-hidden="true">
            <div className="command-palette-hero-panel">
              <span className="command-palette-hero-row is-wide" />
              <span className="command-palette-hero-row" />
              <span className="command-palette-hero-row" />
              <span className="command-palette-hero-row is-short" />
            </div>
            <div className="command-palette-magnifier">
              <span className="command-palette-magnifier-core" />
            </div>
            <div className="command-palette-hero-chart">
              <span className="command-palette-hero-chart-line" />
            </div>
            <div className="command-palette-hero-bubbles">
              <span className="command-palette-bubble is-large" />
              <span className="command-palette-bubble is-small" />
            </div>
          </div>

          <button type="button" className="command-palette-close" onClick={onClose}>
            Esc
          </button>
        </section>

        <section className="command-palette-search-panel">
          <div className="command-palette-input-shell">
            <span className="command-palette-input-icon" aria-hidden="true">
              <span className="command-palette-input-icon-core" />
            </span>
            <input
              autoFocus
              type="text"
              className="command-palette-input"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search tools, pages, docs, pricing, teams, trust, admin, content..."
            />
            <div className="command-palette-input-actions">
              <span className="command-palette-shortcut-badge">K</span>
              <span className="command-palette-search-button">Search</span>
            </div>
          </div>

          <div className="command-palette-summary-grid">
            <article className="command-palette-summary-card is-primary">
              <span className="command-palette-summary-icon is-results" aria-hidden="true" />
              <span className="command-palette-summary-label">Results</span>
              <strong>{items.length}</strong>
              <p>{highlights[0] || `${items.length} refined results`}</p>
            </article>

            <article className="command-palette-summary-card">
              <span className="command-palette-summary-icon is-scope" aria-hidden="true" />
              <span className="command-palette-summary-label">Priority Scope</span>
              <strong>{highlights[1] || "Priority-ranked navigation"}</strong>
            </article>

            <article className="command-palette-summary-card">
              <span className="command-palette-summary-icon is-workspace" aria-hidden="true" />
              <span className="command-palette-summary-label">Cross Workspace</span>
              <strong>{highlights[2] || "Cross-workspace scope"}</strong>
            </article>

            <article className="command-palette-summary-card">
              <span className="command-palette-summary-icon is-filters" aria-hidden="true" />
              <span className="command-palette-summary-label">Smart Filters</span>
              <div className="command-palette-smart-filter-list">
                <span>in:workspace</span>
                <span>type:content</span>
                <span>page:pricing</span>
              </div>
            </article>
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
            <button type="button" className="command-palette-filter-tools" aria-label="Filter tools" />
          </div>
        </section>

        <section className="command-palette-results-shell">
          <div className="command-palette-results-head">
            <div className="command-palette-results-copy">
              <span className="command-palette-results-indicator" aria-hidden="true" />
              <strong>{items.length > 0 ? `Showing ${items.length} results` : "No results yet"}</strong>
            </div>
            <div className="command-palette-results-actions">
              <span className="command-palette-results-sort-label">Sort by</span>
              <button type="button" className="command-palette-results-sort-button">Relevance</button>
              <button type="button" className="command-palette-results-view-button is-active" aria-label="List view" />
              <button type="button" className="command-palette-results-view-button" aria-label="Grid view" />
            </div>
          </div>

          <div className="command-palette-list">
            {items.length > 0 ? (
              items.map((item, index) => {
                const variant = buildResultVariant(item);
                const score = buildScore(index);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`command-palette-item ${index === 0 ? "is-featured" : ""} variant-${variant}`}
                    onClick={() => onSelect(item)}
                  >
                    <div className="command-palette-item-number">{String(index + 1).padStart(2, "0")}</div>
                    <div className={`command-palette-item-icon variant-${variant}`} aria-hidden="true">
                      <span className="command-palette-item-icon-core" />
                    </div>
                    <div className="command-palette-item-main">
                      <div className="command-palette-item-topline">
                        <span className="command-palette-item-group">{item.group}</span>
                      </div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                      <div className="command-palette-item-meta">
                        {renderResultMeta(item).map((tag) => (
                          <span key={`${item.id}-${tag}`} className="command-palette-item-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className={`command-palette-item-visual variant-${variant}`} aria-hidden="true">
                      <span className="command-palette-item-visual-core" />
                    </div>
                    <div className="command-palette-item-score">
                      <strong>{score}</strong>
                      <span>Relevance score</span>
                    </div>
                    <span className="command-palette-item-arrow" aria-hidden="true" />
                  </button>
                );
              })
            ) : (
              <div className="command-palette-empty">
                <strong>No premium matches</strong>
                <p>Try narrower terms or use filters like `in:workspace`, `type:content`, or `page:pricing`.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default CommandPalette;
