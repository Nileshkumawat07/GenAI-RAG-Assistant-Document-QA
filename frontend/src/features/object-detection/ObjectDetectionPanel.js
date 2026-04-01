import React, { useEffect, useRef, useState } from "react";
import { apiUrl } from "../../shared/api/http";

const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const DIRECT_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
const CONVERTIBLE_UPLOAD_TYPES = ["image/heic", "image/heif"];

function hasSupportedExtension(fileName = "") {
  return SUPPORTED_EXTENSIONS.some((extension) => fileName.toLowerCase().endsWith(extension));
}

function extensionFromType(mimeType) {
  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  return ".jpg";
}

function renameFileWithExtension(file, mimeType) {
  const safeType = mimeType || file.type || "image/jpeg";
  const extension = extensionFromType(safeType);
  const baseName = (file.name || "image").replace(/\.[^.]+$/, "") || "image";

  return new File([file], `${baseName}${extension}`, {
    type: safeType,
    lastModified: file.lastModified,
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image format is not supported on this device."));
    };

    image.src = objectUrl;
  });
}

async function convertImageToJpeg(file) {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });

  if (!blob) {
    throw new Error("Image conversion failed.");
  }

  const baseName = (file.name || "mobile-photo").replace(/\.[^.]+$/, "") || "mobile-photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

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

  const normalizeSelectedImage = async (file) => {
    if (DIRECT_UPLOAD_TYPES.includes(file.type)) {
      return hasSupportedExtension(file.name) ? file : renameFileWithExtension(file, file.type);
    }

    if (CONVERTIBLE_UPLOAD_TYPES.includes(file.type)) {
      return convertImageToJpeg(file);
    }

    if (!file.type && hasSupportedExtension(file.name)) {
      return file;
    }

    if (file.type.startsWith("image/")) {
      return convertImageToJpeg(file);
    }

    throw new Error("Only JPG, JPEG, PNG, and WEBP files are allowed.");
  };

  const handleSelectImage = async (event) => {
    const file = event.target.files[0] || null;
    event.target.value = "";
    setError("");
    setCameraError("");
    setResult(null);

    if (!file) {
      setSelectedImage(null);
      return;
    }

    if (file.size === 0) {
      setSelectedImage(null);
      setError("Selected image is empty.");
      return;
    }

    try {
      const normalizedFile = await normalizeSelectedImage(file);
      stopCamera();
      setSelectedImage(normalizedFile);
    } catch (err) {
      setSelectedImage(null);
      setError(err.message || "Only JPG, JPEG, PNG, and WEBP files are allowed.");
    }
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
                      <span className="upload-icon">+</span>
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
