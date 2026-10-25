import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { resolve } from 'path'

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

function ocrSpacePlugin(apiKey: string): Plugin {
  return {
    name: "coatx-ocr-space-work-paper-ocr",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/work-paper/recognize", (request, response, next) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.setHeader("Allow", "POST");
          response.end();
          return;
        }

        void (async () => {
          if (!apiKey) {
            response.statusCode = 503;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ error: "OCR.space is not configured. Add OCR_SPACE_API_KEY to .env.local and restart the dev server." }));
            return;
          }

          const chunks: Buffer[] = [];
          let size = 0;
          let tooLarge = false;
          const body = await new Promise<Buffer>((resolveBody, rejectBody) => {
            request.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > MAX_REQUEST_BYTES) {
                tooLarge = true;
                chunks.length = 0;
              } else if (!tooLarge) {
                chunks.push(chunk);
              }
            });
            request.on("end", () => {
              if (tooLarge) rejectBody(new Error("IMAGE_TOO_LARGE"));
              else resolveBody(Buffer.concat(chunks));
            });
            request.on("error", rejectBody);
          });

          let payload: { image?: unknown };
          try {
            payload = JSON.parse(body.toString("utf8")) as { image?: unknown };
          } catch {
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ error: "Invalid request body." }));
            return;
          }

          if (typeof payload.image !== "string") {
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ error: "A photo is required." }));
            return;
          }

          const imageMatch = payload.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
          if (!imageMatch) {
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ error: "Use a JPEG, PNG, or WebP image." }));
            return;
          }

          const [, mimeType, base64Data] = imageMatch;
          const imageBytes = Buffer.from(base64Data, "base64");
          if (imageBytes.byteLength > 1024 * 1024) {
            response.statusCode = 413;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ error: "The compressed photo must be smaller than 1 MB for OCR.space's free tier." }));
            return;
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6500);
          try {
            const formData = new FormData();
            formData.set("file", new Blob([Uint8Array.from(imageBytes)], { type: mimeType }), "work-paper.jpg");
            formData.set("language", "kor");
            formData.set("OCREngine", "2");
            formData.set("isOverlayRequired", "false");
            const ocrResponse = await fetch(
              "https://api.ocr.space/parse/image",
              {
                method: "POST",
                headers: {
                  apikey: apiKey,
                },
                signal: controller.signal,
                body: formData,
              },
            );

            if (!ocrResponse.ok) {
              const providerError = await ocrResponse.text();
              console.error(`OCR.space request failed (${ocrResponse.status}): ${providerError}`);
              response.statusCode = ocrResponse.status === 429 ? 429 : 502;
              response.setHeader("Content-Type", "application/json");
              response.end(JSON.stringify({
                error: ocrResponse.status === 429
                  ? "OCR.space free request limit reached. Please wait and try again later."
                  : `OCR.space could not process this photo (HTTP ${ocrResponse.status}).`,
              }));
              return;
            }

            const result = await ocrResponse.json() as {
              IsErroredOnProcessing?: boolean;
              ErrorMessage?: string | string[];
              ParsedResults?: Array<{ ParsedText?: string }>;
            };
            const text = result.ParsedResults
              ?.map((page) => page.ParsedText ?? "")
              .filter(Boolean)
              .join("\n")
              .trim();
            if (result.IsErroredOnProcessing || !text) {
              const providerError = Array.isArray(result.ErrorMessage)
                ? result.ErrorMessage.join(" ")
                : result.ErrorMessage;
              throw new Error(providerError || "OCR.space could not find readable text in this photo.");
            }

            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ text }));
          } catch (error) {
            console.error("OCR.space request failed:", error);
            response.statusCode = 502;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({
              error: error instanceof Error && error.name === "AbortError"
                ? "OCR exceeded 7 seconds. Try again or continue manually."
                : error instanceof Error ? error.message : "OCR.space could not read this photo.",
            }));
          } finally {
            clearTimeout(timeoutId);
          }
        })().catch((error: unknown) => {
          console.error("Work-paper OCR request failed:", error);
          if (!response.headersSent) {
            response.statusCode = error instanceof Error && error.message === "IMAGE_TOO_LARGE" ? 413 : 500;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({
              error: error instanceof Error && error.message === "IMAGE_TOO_LARGE"
                ? "This image is too large. Choose an image smaller than 12 MB."
                : "The work-paper recognition request failed.",
            }));
          }
        });

        return next;
      });
    },
  };
}

function excludeLocalScanPhotosFromProduction(): Plugin {
  return {
    name: "exclude-local-scan-photos",
    apply: "build",
    closeBundle() {
      const outputScanDirectory = resolve(__dirname, "dist", "scan");
      if (!existsSync(outputScanDirectory)) return;
      for (const filename of readdirSync(outputScanDirectory)) {
        const outputFile = resolve(outputScanDirectory, filename);
        if (statSync(outputFile).isFile()) unlinkSync(outputFile);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      ocrSpacePlugin(env.OCR_SPACE_API_KEY ?? ""),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["dijei-coat-logo.png"],
        manifest: {
          name: "Dijei Coat Work Management",
          short_name: "Dijei Coat",
          description: "Dijei Coat work orders, coating specifications, and job documents.",
          theme_color: "#ffffff",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: "/index.html",
          globPatterns: ["**/*.{css,html,ico,js,png,svg,webp,woff2}"],
          globIgnores: ["scan/**"],
        },
      }),
      excludeLocalScanPhotosFromProduction(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  };
})
