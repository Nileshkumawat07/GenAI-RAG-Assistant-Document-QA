import React, { useEffect, useState } from "react";

import { requestJson } from "../../shared/api/http";

function ImageGenerationPanel() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const data = await requestJson("/image-generation/health", {}, "Image generation status failed.");
        if (isMounted) {
          setStatus(data);
        }
      } catch {
        if (isMounted) {
          setStatus(null);
        }
      }
    }

    loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("Prompt cannot be empty.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setResult(null);

    try {
      const data = await requestJson(
        "/image-generation/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            negative_prompt: negativePrompt.trim(),
            seed: seed.trim() ? Number(seed.trim()) : null,
          }),
        },
        "Image generation failed."
      );

      setResult(data);
    } catch (err) {
      setError(err.message || "Image generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const imageSrc = result ? `data:${result.mime_type};base64,${result.image_base64}` : "";

  return (
    <div className="feature-panel image-generation-panel-root">
      <div className="insight-section">
        <div className="insight-card">
          <h3 className="tool-title">Image Generation Guidance</h3>
          <p className="tool-copy">
            Write a strong visual prompt and optionally add a negative prompt to steer the SDXL
            Lightning output away from unwanted details.
          </p>
          {status ? <p className="tool-copy">{status.performance_hint}</p> : null}
        </div>
      </div>

      <div className="content-grid image-generation-grid">
        <article className="tool-card">
          <h3 className="tool-title">Prompt Builder</h3>
          <p className="tool-copy">Describe the scene, style, lighting, subject, and composition.</p>

          <textarea
            className="question-input prompt-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Cinematic portrait of a futuristic explorer in monsoon rain, ultra detailed, neon reflections, dramatic lighting"
            rows={6}
          />

          <textarea
            className="question-input prompt-input secondary-input"
            value={negativePrompt}
            onChange={(event) => setNegativePrompt(event.target.value)}
            placeholder="Negative prompt: blurry, deformed hands, low quality, extra limbs"
            rows={4}
          />

          <input
            className="question-input seed-input"
            type="number"
            min="0"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            placeholder="Optional seed for reproducible generations"
          />

          <button className="primary-button" onClick={generateImage} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate Image"}
          </button>

          {error ? <p className="error-text">{error}</p> : null}
        </article>

        <article className="tool-card image-result-card">
          <div className="answer-card-head">
            <div>
              <h3 className="tool-title">Generated Image</h3>
              <p className="tool-copy">The latest image returned by the SDXL Lightning pipeline.</p>
            </div>
            <span className="answer-badge">{result ? "Completed" : "Waiting"}</span>
          </div>

          <div className="image-generation-preview-box">
            {result ? (
              <img src={imageSrc} alt={result.prompt} className="generated-image-preview" />
            ) : (
              <p className="image-preview-empty">
                Submit a prompt and your generated image will appear here.
              </p>
            )}
          </div>

          <div className="answer-box image-meta-box">
            {result ? (
              <div className="image-generation-meta">
                <p><strong>Prompt:</strong> {result.prompt}</p>
                <p><strong>Negative Prompt:</strong> {result.negative_prompt || "None"}</p>
                <p><strong>Seed:</strong> {result.seed}</p>
                <p><strong>Steps:</strong> {result.steps}</p>
                <p><strong>Guidance Scale:</strong> {result.guidance_scale}</p>
                <p><strong>Resolution:</strong> {result.width} x {result.height}</p>
                <p><strong>Device:</strong> {result.device}</p>
                <p><strong>XFormers:</strong> {result.xformers_enabled ? "Enabled" : "Unavailable"}</p>
              </div>
            ) : (
              <p>
                {status
                  ? `Current device: ${status.device}. ${status.performance_hint}`
                  : "Generation details will appear here after the image is created."}
              </p>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

export default ImageGenerationPanel;
