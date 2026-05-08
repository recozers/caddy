"use client";

import { useEffect, useRef, useState } from "react";

type Lie = "tee" | "fairway" | "light rough" | "heavy rough" | "fairway bunker" | "greenside bunker" | "green";
type Wind = "calm" | "light" | "moderate" | "strong";

const LIES: Lie[] = ["tee", "fairway", "light rough", "heavy rough", "fairway bunker", "greenside bunker", "green"];
const WINDS: Wind[] = ["calm", "light", "moderate", "strong"];
const WIND_DIRS = ["into", "downwind", "left-to-right", "right-to-left", "crosswind"];

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [lie, setLie] = useState<Lie>("fairway");
  const [distance, setDistance] = useState<number>(155);
  const [elevation, setElevation] = useState<number>(0);
  const [wind, setWind] = useState<Wind>("light");
  const [windDir, setWindDir] = useState<string>("into");
  const [tempF, setTempF] = useState<number>(68);
  const [bag, setBag] = useState<string>("driver, 3w, 4h, 5-PW, 52, 56, 60, putter");

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreaming(true);
        }
      } catch (e: any) {
        setError("Camera unavailable: " + (e?.message ?? String(e)));
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    setSnapshot(canvas.toDataURL("image/jpeg", 0.82));
  }

  async function askCaddy() {
    setError("");
    setAdvice("");
    setLoading(true);
    try {
      if (!snapshot) capture();
      const image = snapshot ?? canvasRef.current?.toDataURL("image/jpeg", 0.82);
      const res = await fetch("/api/caddy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          image,
          conditions: { lie, distance, elevation, wind, windDir, tempF, bag },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Caddy request failed");
      setAdvice(data.advice);
      speak(data.advice);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  }

  return (
    <main>
      <h1>AI Caddy</h1>
      <div className="sub">Glasses-POV prototype • point camera at the ball / target line</div>

      <div className="viewport">
        {snapshot ? (
          <img src={snapshot} alt="captured frame" />
        ) : (
          <video ref={videoRef} playsInline muted />
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div className="hud">
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />
          <div className="label">CADDY ▸ {lie.toUpperCase()} ▸ {distance}y</div>
        </div>
      </div>

      <div className="actions">
        <button onClick={capture} className="secondary" disabled={!streaming}>
          {snapshot ? "Recapture" : "Capture frame"}
        </button>
        <button onClick={() => setSnapshot(null)} className="secondary" disabled={!snapshot}>
          Resume live
        </button>
        <button onClick={askCaddy} disabled={loading}>
          {loading ? "Thinking…" : "Ask caddy"}
        </button>
      </div>

      {error && <div className="advice" style={{ borderColor: "#a34", color: "#fbb" }}>{error}</div>}

      <div className="row">
        <div className="panel">
          <h2>Ball & shot</h2>
          <label>Lie</label>
          <select value={lie} onChange={(e) => setLie(e.target.value as Lie)}>
            {LIES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <label>Distance to pin (yards)</label>
          <input type="number" value={distance} onChange={(e) => setDistance(+e.target.value)} />
          <label>Elevation change (ft, + uphill)</label>
          <input type="number" value={elevation} onChange={(e) => setElevation(+e.target.value)} />
        </div>

        <div className="panel">
          <h2>Conditions</h2>
          <label>Wind</label>
          <select value={wind} onChange={(e) => setWind(e.target.value as Wind)}>
            {WINDS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <label>Wind direction</label>
          <select value={windDir} onChange={(e) => setWindDir(e.target.value)}>
            {WIND_DIRS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <label>Temperature (°F)</label>
          <input type="number" value={tempF} onChange={(e) => setTempF(+e.target.value)} />
          <label>Bag (comma separated)</label>
          <input value={bag} onChange={(e) => setBag(e.target.value)} />
        </div>
      </div>

      <div className="advice">
        <div className="head">Caddy</div>
        {advice ? advice : <span className="muted">Capture the line, set conditions, and tap “Ask caddy.”</span>}
      </div>

      <div className="note">
        Real Meta Ray-Ban / Oakley glasses don't yet expose a public live-camera SDK for third-party apps.
        This prototype simulates the glasses POV with your phone or laptop camera; the AI vision + caddy logic would port directly when Meta opens that API.
      </div>
    </main>
  );
}
