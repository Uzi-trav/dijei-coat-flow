import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, RotateCcw, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getDemoData } from "@/lib/demoStore";
import { recognizeWorkPaper, suggestWorkRecordDraft } from "@/lib/workPaperOcr";
import type { WorkerFlowState } from "@/lib/workerFlow";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

interface CameraZoomRange {
  min: number;
  max: number;
}

export default function ScanWorkPaperPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const flowState = (location.state as WorkerFlowState | null) ?? {};
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState(flowState.imageDataUrl ?? "");
  const [ocrText, setOcrText] = useState(flowState.ocrText ?? "");
  const [imageError, setImageError] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionProgress, setRecognitionProgress] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [cameraZoomRange, setCameraZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [startingCamera, setStartingCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      activeStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t("scanner.cameraUnavailable"));
      return;
    }

    setStartingCamera(true);
    setCameraError(null);
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      activeStreamRef.current?.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = cameraStream;
      setStream(cameraStream);
      const track = cameraStream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities() as (MediaTrackCapabilities & { zoom?: CameraZoomRange }) | undefined;
      const zoom = capabilities?.zoom;
      if (track && zoom && typeof zoom.min === "number" && typeof zoom.max === "number") {
        setCameraZoomRange({
          min: zoom.min,
          max: zoom.max,
          step: Math.max((zoom.max - zoom.min) / 20, 0.1),
        });
        const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
        setCameraZoom(settings.zoom ?? zoom.min);
      }
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setCameraError(
        name === "NotAllowedError" || name === "SecurityError"
          ? t("scanner.cameraDenied")
          : t("scanner.cameraUnavailable"),
      );
    } finally {
      setStartingCamera(false);
    }
  }

  function stopCamera() {
    activeStreamRef.current?.getTracks().forEach((track) => track.stop());
    activeStreamRef.current = null;
    setStream(null);
    setCameraZoomRange(null);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraError(t("scanner.cameraUnavailable"));
    });
  }, [stream, t]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setImageError(t("scanner.captureUnavailable"));
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context unavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setImageDataUrl(canvas.toDataURL("image/jpeg", 0.9));
      setOcrText("");
      stopCamera();
      setImageError(null);
      setOcrError(null);
    } catch {
      setImageError(t("scanner.imageReadFailed"));
    }
  }

  function readImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageDataUrl("");
      setImageError(t("scanner.invalidImage"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageDataUrl("");
      setImageError(t("scanner.imageTooLarge"));
      return;
    }

    setImageDataUrl("");
    setOcrText("");
    setImageError(null);
    setOcrError(null);
    stopCamera();
    const reader = new FileReader();
    reader.onerror = () => setImageError(t("scanner.imageReadFailed"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setImageError(t("scanner.imageReadFailed"));
        return;
      }
      setImageDataUrl(reader.result);
      setImageError(null);
      setOcrError(null);
    };
    reader.readAsDataURL(file);
  }

  async function analyzePhoto() {
    if (!imageDataUrl || recognizing) return;
    setRecognizing(true);
    setRecognitionProgress(0);
    setOcrError(null);
    try {
      const result = await recognizeWorkPaper(imageDataUrl, setRecognitionProgress);
      const data = getDemoData();
      const draft = suggestWorkRecordDraft(result.text, data.projects, data.items, flowState.draft);
      setOcrText(result.text);
      navigate("/work/review", {
        state: {
          ...flowState,
          draft,
          imageDataUrl,
          ocrText: result.text,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setOcrError(
        message.startsWith("OCR timed out")
          ? t("scanner.ocrTimedOut")
          : message || t("scanner.ocrFailed"),
      );
    } finally {
      setRecognizing(false);
    }
  }

  function continueToReview() {
    if (!imageDataUrl) return;
    navigate("/work/review", {
      state: {
        ...flowState,
        ...(flowState.draft ? { draft: flowState.draft } : {}),
        imageDataUrl,
        ocrText: ocrText || undefined,
      },
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-8">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
          <Link to="/" onClick={(event) => {
            if (flowState.draft) {
              event.preventDefault();
              navigate("/work/review", {
                state: {
                  ...flowState,
                  imageDataUrl,
                  ocrText: ocrText || undefined,
                },
              });
            }
          }}>
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
        <img src="/dijei-coat-emblem.png" alt="Dijei Coat" className="h-auto max-h-12 w-[190px] rounded bg-white px-1 object-contain" />
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-8 sm:py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("scanner.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("scanner.description")}</p>
        </div>

        {cameraError && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm" role="status">
            {cameraError} {t("scanner.uploadInstead")}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border bg-black">
          {imageDataUrl ? (
            <img
              src={imageDataUrl}
              alt={t("scanner.previewAlt")}
              className="max-h-[60vh] min-h-64 w-full object-contain"
              onError={() => setImageError(t("scanner.imageReadFailed"))}
            />
          ) : stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label={t("scanner.livePreview")}
              className="max-h-[60vh] min-h-64 w-full object-contain"
            />
          ) : (
            <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-white/80">
              {startingCamera ? t("scanner.openingCamera") : t("scanner.choosePhotoPrompt")}
            </div>
          )}
        </div>

        {imageError && <p className="text-sm text-destructive" role="alert">{imageError}</p>}

        {!imageDataUrl && stream && cameraZoomRange && (
          <div className="space-y-2">
            <label htmlFor="camera-zoom" className="text-sm font-medium">{t("scanner.zoom")}</label>
            <input
              id="camera-zoom"
              type="range"
              min={cameraZoomRange.min}
              max={cameraZoomRange.max}
              step={cameraZoomRange.step}
              value={cameraZoom}
              className="w-full accent-primary"
              onChange={(event) => {
                const zoom = Number(event.currentTarget.value);
                setCameraZoom(zoom);
                const track = stream.getVideoTracks()[0];
                if (track) {
                const zoomConstraint = { zoom } as MediaTrackConstraintSet;
                void track.applyConstraints({ advanced: [zoomConstraint] }).catch(() => {
                  setCameraError(t("scanner.zoomUnavailable"));
                });
                }
              }}
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {imageDataUrl ? (
            <>
              <Button type="button" variant="outline" size="lg" className="min-h-12" onClick={() => {
                setImageDataUrl("");
                setOcrText("");
                setImageError(null);
                setOcrError(null);
              }}>
                <RotateCcw aria-hidden="true" />
                {t("scanner.retake")}
              </Button>
              <Button type="button" size="lg" className="min-h-12" onClick={() => void analyzePhoto()} disabled={Boolean(imageError) || recognizing}>
                {recognizing ? t("scanner.recognizing") : t("scanner.recognizeAndContinue")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="lg" className="min-h-12" onClick={() => fileInputRef.current?.click()}>
                <Upload aria-hidden="true" />
                {t("scanner.chooseImage")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-12"
                onClick={() => stream ? capturePhoto() : void startCamera()}
                disabled={startingCamera}
              >
                <Camera aria-hidden="true" />
                {startingCamera ? t("scanner.openingCamera") : stream ? t("scanner.capture") : t("scanner.openCamera")}
              </Button>
            </>
          )}
        </div>
        {imageDataUrl && (
          <div className="text-center">
            <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()}>
              <Upload aria-hidden="true" />
              {t("scanner.replacePhoto")}
            </Button>
          </div>
        )}

        {recognizing && (
          <div className="space-y-2" role="status" aria-live="polite">
            <p className="text-sm">{t("scanner.recognizingProgress", { progress: recognitionProgress })}</p>
            <progress className="h-2 w-full accent-primary" max={100} value={recognitionProgress} />
          </div>
        )}
        {ocrError && <p className="text-sm text-destructive" role="alert">{ocrError}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={t("scanner.chooseImage")}
          onChange={(event) => {
            readImage(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />

        <p className="text-xs leading-5 text-muted-foreground">{t("scanner.privacyNotice")}</p>
        <div className="flex justify-between border-t border-border pt-4">
          <Button variant="ghost" onClick={() => {
            if (flowState.draft) navigate("/work/review", { state: flowState });
            else navigate("/");
          }}>
            {t("common.cancel")}
          </Button>
          {imageDataUrl && (
            <div className="flex items-center gap-2">
              {!recognizing && <Button variant="link" onClick={continueToReview}>{t("scanner.continueManually")}</Button>}
              <Button variant="link" onClick={() => fileInputRef.current?.click()}>{t("scanner.replacePhoto")}</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
