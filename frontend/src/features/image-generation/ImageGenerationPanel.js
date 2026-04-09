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
    <div className="workspace-premium-shell">
      <section className="workspace-command-hero">
        <article className="workspace-hub-card workspace-command-story workspace-tool-premium-hero">
          <div className="workspace-command-topline">
            <div>
              <span className="workspace-command-kicker">Creative Generation</span>
              <h3 className="workspace-command-title">Premium image generation workspace for sharper prompts and cleaner visual output.</h3>
              <p className="workspace-command-lede">
                Build images with a stronger studio-style prompt surface, negative prompt control, and a polished preview area that makes generation feel production-ready.
              </p>
            </div>
            <div className="workspace-chat-hero-pill">
              <span>Generation</span>
              <strong>{result ? "1" : "0"}</strong>
            </div>
          </div>

          <div className="workspace-command-badge-row">
            <article className="workspace-command-badge">
              <span>Engine</span>
              <strong>SDXL</strong>
              <p>{status?.performance_hint || "Studio-style image generation pipeline."}</p>
            </article>
            <article className="workspace-command-badge">
              <span>Device</span>
              <strong>{status?.device || result?.device || "Unknown"}</strong>
              <p>Current runtime used for generation requests.</p>
            </article>
            <article className="workspace-command-badge">
              <span>Output state</span>
              <strong>{result ? "Ready" : "Waiting"}</strong>
              <p>Generated image and model details appear in the result surface.</p>
            </article>
          </div>
        </article>

        <aside className="workspace-command-sidebar">
          <section className="workspace-hub-card workspace-spotlight-panel">
            <div className="workspace-spotlight-head">
              <span className="workspace-spotlight-tag">Prompt status</span>
            </div>
            <strong>{prompt.trim() ? "Prompt loaded" : "No prompt yet"}</strong>
            <p>{prompt.trim() || "Write the subject, style, lighting, angle, composition, and mood to start generation."}</p>
            <div className="workspace-focus-meta">
              <span>{negativePrompt.trim() ? "Negative prompt set" : "Negative prompt empty"}</span>
              <span>{seed.trim() ? `Seed ${seed.trim()}` : "Random seed"}</span>
            </div>
          </section>
        </aside>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="workspace-command-main">
        <article className="workspace-hub-card workspace-tool-form-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">Prompt builder</span>
              <h4>Compose the image request</h4>
            </div>
            <span className="workspace-section-summary">Prompt, negative prompt, seed</span>
          </div>

          <textarea
            className="question-input workspace-tool-textarea"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Cinematic portrait of a futuristic explorer in monsoon rain, ultra detailed, neon reflections, dramatic lighting"
            rows={7}
          />

          <textarea
            className="question-input workspace-tool-textarea"
            value={negativePrompt}
            onChange={(event) => setNegativePrompt(event.target.value)}
            placeholder="Negative prompt: blurry, deformed hands, low quality, extra limbs"
            rows={5}
          />

          <input
            className="question-input seed-input"
            type="number"
            min="0"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            placeholder="Optional seed for reproducible generations"
          />

          <button className="hero-button hero-button-primary" onClick={generateImage} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate Image"}
          </button>
        </article>

        <article className="workspace-hub-card workspace-tool-answer-card">
          <div className="workspace-section-heading">
            <div>
              <span className="workspace-hub-eyebrow">Preview</span>
              <h4>Generated image</h4>
            </div>
            <span className="answer-badge">{result ? "Completed" : "Waiting"}</span>
          </div>

          <div className="image-generation-preview-box workspace-tool-preview-box">
            {result ? (
              <img src={imageSrc} alt={result.prompt} className="generated-image-preview" />
            ) : (
              <p className="image-preview-empty">Submit a prompt and your generated image will appear here.</p>
            )}
          </div>

          <div className="answer-box workspace-tool-answer-box image-meta-box">
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
      </section>
    </div>
  );
}

export default ImageGenerationPanel;
