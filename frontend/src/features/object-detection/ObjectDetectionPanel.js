import React, { useMemo, useState } from "react";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function ObjectDetectionPanel() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [error, setError] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState(null);

  const previewUrl = useMemo(() => {
    if (!selectedImage) {
      return "";
    }

    return URL.createObjectURL(selectedImage);
  }, [selectedImage]);

  const handleSelectImage = (event) => {
    const file = event.target.files[0] || null;
    setError("");
    setResult(null);

    if (!file) {
      setSelectedImage(null);
      return;
    }

    const isValidType = /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!isValidType) {
      setSelectedImage(null);
      setError("Only JPG, JPEG, PNG, and WEBP files are allowed.");
      return;
    }

    if (file.size === 0) {
      setSelectedImage(null);
      setError("Selected image is empty.");
      return;
    }

    setSelectedImage(file);
  };

  const detectObjects = async () => {
    if (!selectedImage) {
      return;
    }

    setIsDetecting(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", selectedImage);

    try {
      const response = await fetch(apiUrl("/object-detection/detect"), {
        method: "POST",
        body: formData,
      });

      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(data.detail || "Object detection failed.");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Object detection failed.");
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="feature-panel object-detection-panel-root">
      <div className="insight-section">
        <div className="insight-card">
          <h3 className="tool-title">Object Detection Guidance</h3>
          <p className="tool-copy">
            Upload an image and Groq vision will identify the visible objects,
            estimated counts, confidence, and approximate locations.
          </p>
        </div>
      </div>

      <div className="content-grid single-column">
        <article className="tool-card object-detection-upload-card">
          <div className="object-detection-top-head">
            <div>
              <h3 className="tool-title">Upload Image</h3>
              <p className="tool-copy">Select an image for object detection.</p>
            </div>

            <div>
              <h3 className="tool-title">Detection Result</h3>
              <p className="tool-copy">Detected objects returned by the Groq vision model.</p>
            </div>
          </div>

          <div className="object-detection-upload-layout">
            <div className="object-detection-left-panel">
              <div className="object-detection-panel-head" />
              <label className="upload-box object-detection-upload-box">
                <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleSelectImage} />
                {previewUrl ? (
                  <div className="upload-preview-content">
                    <img src={previewUrl} alt="Object detection preview" className="upload-preview-image" />
                  </div>
                ) : (
                  <>
                    <span className="upload-icon">+</span>
                    <strong>Choose an image</strong>
                    <small>Supported formats: JPG, JPEG, PNG, WEBP</small>
                  </>
                )}
              </label>
            </div>

            <div className="object-detection-preview-panel">
              <div className="object-detection-panel-head detection-panel-badge-row">
                <div />
                <span className="answer-badge">
                  {result ? `${result.object_count} Objects` : "Waiting"}
                </span>
              </div>
              <div className="answer-box detection-answer-box detection-inline-box">
                {error ? <p className="error-text">{error}</p> : null}

                {result ? (
                  <div className="detection-results">
                    {result.objects.length ? (
                      <div className="detection-results-grid">
                        {result.objects.map((item, index) => (
                          <article key={`${item.label}-${index}`} className="detection-object-card">
                            <div className="detection-object-head">
                              <h4>{item.label}</h4>
                              <span className={`confidence-badge confidence-${item.confidence}`}>
                                {item.confidence}
                              </span>
                            </div>
                            <p className="detection-object-meta">Count: {item.count}</p>
                            <p className="detection-object-meta">Location: {item.location}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="answer-paragraph">No clear objects were detected.</p>
                    )}
                  </div>
                ) : (
                  <div className="detection-note detection-empty-state">
                    Run object detection and the result will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            className="primary-button object-detection-action"
            onClick={detectObjects}
            disabled={!selectedImage || isDetecting}
          >
            {isDetecting ? "Detecting..." : "Detect Objects"}
          </button>

          <div className="object-detection-summary-section">
            <div className="answer-card-head">
              <div>
                <h3 className="tool-title">Summary</h3>
                <p className="tool-copy">Stable summary area for the current detection result.</p>
              </div>
              <span className="answer-badge">
                {result ? `${result.objects.length} Labels` : "Ready"}
              </span>
            </div>

            <div className="object-detection-summary-box">
              {result ? (
                <>
                  <p className="answer-paragraph">{result.summary}</p>
                  <p className="detection-summary-meta">
                    Total objects counted: {result.object_count}
                  </p>
                </>
              ) : (
                <p className="answer-paragraph">
                  Upload an image and run detection to show a stable summary here.
                </p>
              )}
            </div>
          </div>
        </article>
      </div>

    </div>
  );
}

export default ObjectDetectionPanel;
