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
    <div className="feature-panel">
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
          <h3 className="tool-title">Upload Image</h3>
          <p className="tool-copy">Select an image for object detection.</p>

          <div className="object-detection-upload-layout">
            <label className="upload-box object-detection-upload-box">
              <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleSelectImage} />
              {previewUrl ? (
                <div className="upload-preview-content">
                  <img src={previewUrl} alt="Object detection preview" className="upload-preview-image" />
                  <strong>{selectedImage.name}</strong>
                  <small>Supported formats: JPG, JPEG, PNG, WEBP</small>
                </div>
              ) : (
                <>
                  <span className="upload-icon">+</span>
                  <strong>Choose an image</strong>
                  <small>Supported formats: JPG, JPEG, PNG, WEBP</small>
                </>
              )}
            </label>

            <div className="object-detection-preview-panel">
              <div className="answer-card-head detection-inline-head">
                <div>
                  <h3 className="tool-title">Detection Result</h3>
                  <p className="tool-copy">Detected objects returned by the Groq vision model.</p>
                </div>
                <span className="answer-badge">
                  {result ? `${result.object_count} Objects` : "Waiting"}
                </span>
              </div>
              <div className="answer-box detection-answer-box detection-inline-box">
                {error ? <p className="error-text">{error}</p> : null}

                {result ? (
                  <div className="detection-results">
                    <div className="detection-summary-card">
                      <p className="detection-summary-label">Summary</p>
                      <p className="answer-paragraph">{result.summary}</p>
                    </div>

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

          <div className="detection-note">
            The uploaded image appears in the upload area, and the detection
            result appears in the right-side panel for easier comparison.
          </div>

          <button
            className="primary-button"
            onClick={detectObjects}
            disabled={!selectedImage || isDetecting}
          >
            {isDetecting ? "Detecting..." : "Detect Objects"}
          </button>
        </article>
      </div>

      <div className="answer-section detection-answer-section">
        <div className="answer-card-head">
          <div>
            <h3 className="tool-title">Detection Notes</h3>
            <p className="tool-copy">Helpful guidance for reading the Groq vision output.</p>
          </div>
        </div>

        <div className="answer-box detection-answer-box">
          <div className="detection-note detection-empty-state">
            Confidence shows how certain the model is, while location is an
            approximate natural-language description rather than a drawn
            bounding box.
          </div>
        </div>
      </div>
    </div>
  );
}

export default ObjectDetectionPanel;
