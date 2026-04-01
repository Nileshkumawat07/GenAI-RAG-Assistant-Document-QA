import React, { useEffect, useRef, useState } from "react";
import { apiUrl } from "../../shared/api/http";

function ObjectDetectionPanel() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [error, setError] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const uploadInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImage]);

  useEffect(
    () => () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    },
    []
  );

  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen]);

  const handleSelectImage = (event) => {
    const file = event.target.files[0] || null;
    setError("");
    setCameraError("");
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

    stopCamera();
    setSelectedImage(file);
    event.target.value = "";
  };

  const openUploadPicker = () => {
    uploadInputRef.current?.click();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const startCamera = async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    setIsStartingCamera(true);
    setError("");
    setCameraError("");
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setCameraError(err.message || "Camera access failed.");
      stopCamera();
    } finally {
      setIsStartingCamera(false);
    }
  };

  const handleCameraButtonClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isCameraOpen) {
      stopCamera();
      return;
    }

    await startCamera();
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      setCameraError("Camera is not ready yet.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setCameraError("Camera feed is not ready yet.");
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Photo capture failed.");
          return;
        }

        const capturedFile = new File([blob], `camera-capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setSelectedImage(capturedFile);
        setError("");
        setCameraError("");
        setResult(null);
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
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

      const data = await response.json().catch(() => ({}));
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
            <div className="object-detection-head-block">
              <h3 className="tool-title">Upload Image</h3>
              <p className="tool-copy">Select an image or use your camera for object detection.</p>
            </div>

            <div className="object-detection-head-block object-detection-result-head">
              <div>
                <h3 className="tool-title">Detection Result</h3>
                <p className="tool-copy">Detected objects returned by the Groq vision model.</p>
              </div>
              <span className="answer-badge">
                {result ? `${result.object_count} Objects` : "Waiting"}
              </span>
            </div>
          </div>

          <div className="object-detection-upload-layout">
            <div className="object-detection-input-panel">
              <div className="object-detection-upload-shell">
                <input
                  ref={uploadInputRef}
                  className="hidden-file-input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleSelectImage}
                />
                <input
                  ref={cameraInputRef}
                  className="hidden-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleSelectImage}
                />
                <button
                  className="upload-box object-detection-upload-box"
                  type="button"
                  onClick={openUploadPicker}
                >
                  {isCameraOpen ? (
                    <div className="camera-preview-shell object-detection-inline-camera">
                      <video ref={videoRef} className="camera-preview" autoPlay playsInline muted />
                      <canvas ref={canvasRef} className="camera-canvas" />
                    </div>
                  ) : previewUrl ? (
                    <div className="upload-preview-content">
                      <img src={previewUrl} alt="Object detection preview" className="upload-preview-image" />
                    </div>
                  ) : (
                    <>
                      <strong>Choose an image</strong>
                      <small>Supported formats: JPG, JPEG, PNG, WEBP</small>
                    </>
                  )}
                </button>

                <button
                  className="upload-overlay-button upload-camera-button"
                  type="button"
                  onClick={handleCameraButtonClick}
                  disabled={isStartingCamera}
                >
                  <span className="camera-icon" aria-hidden="true">
                    {isCameraOpen ? "x" : "\uD83D\uDCF7"}
                  </span>
                  <span className="sr-only">
                    {isStartingCamera ? "Opening camera" : isCameraOpen ? "Close camera" : "Open camera"}
                  </span>
                </button>

                {isCameraOpen ? (
                  <div className="camera-overlay-actions">
                    <button className="primary-button camera-overlay-button" type="button" onClick={capturePhoto}>
                      Capture Photo
                    </button>
                  </div>
                ) : null}
              </div>

              {cameraError ? <p className="error-text">{cameraError}</p> : null}
            </div>

            <div className="answer-box detection-answer-box detection-inline-box">
              {error ? <p className="error-text">{error}</p> : null}

              {result ? (
                <div className="detection-results">
                  <div className="detection-inline-summary">
                    <p className="detection-summary-label">Summary</p>
                    <p className="answer-paragraph">{result.summary}</p>
                    <p className="detection-summary-meta">
                      Total objects counted: {result.object_count}
                    </p>
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

          <button
            className="primary-button object-detection-action"
            onClick={detectObjects}
            disabled={!selectedImage || isDetecting}
          >
            {isDetecting ? "Detecting..." : "Detect Objects"}
          </button>
        </article>
      </div>
    </div>
  );
}

export default ObjectDetectionPanel;
