import React from "react";

function ImageGenerationPanel() {
  return (
    <div className="feature-panel">
      <div className="insight-section">
        <div className="insight-card">
          <h3 className="tool-title">Image Generation Guidance</h3>
          <p className="tool-copy">
            This section is ready for your future prompt-to-image flow, model
            settings, image previews, and download actions.
          </p>
        </div>
      </div>

      <div className="content-grid single-column">
        <article className="tool-card">
          <h3 className="tool-title">Image Generation</h3>
          <p className="tool-copy">
            A new section has been added so you can build image generation
            separately from document retrieval.
          </p>

          <div className="placeholder-box">
            <strong>Scaffold Ready</strong>
            <p>
              Frontend and backend placeholder files, folders, and API routes are
              now in place for this module.
            </p>
          </div>

          <button className="primary-button" disabled>
            Image Generation Coming Soon
          </button>
        </article>
      </div>
    </div>
  );
}

export default ImageGenerationPanel;
