const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;

function jsonResponse(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function recognizeWorkPaper(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(413, { error: "This image is too large. Choose an image smaller than 12 MB." });
  }

  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    console.error("OCR_SPACE_API_KEY is not configured for the Netlify function.");
    return jsonResponse(503, { error: "OCR recognition is not configured. Please continue manually." });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid request body." });
  }
  if (typeof payload !== "object" || payload === null || !("image" in payload) || typeof payload.image !== "string") {
    return jsonResponse(400, { error: "A photo is required." });
  }

  const imageMatch = payload.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!imageMatch) {
    return jsonResponse(400, { error: "Use a JPEG, PNG, or WebP image." });
  }
  const [, mimeType, base64Data] = imageMatch;
  const imageBytes = Buffer.from(base64Data, "base64");
  if (imageBytes.byteLength > MAX_IMAGE_BYTES) {
    return jsonResponse(413, { error: "The compressed photo must be smaller than 1 MB for OCR.space's free tier." });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6500);
  try {
    const formData = new FormData();
    formData.set("file", new Blob([imageBytes], { type: mimeType }), "work-paper.jpg");
    formData.set("language", "kor");
    formData.set("OCREngine", "2");
    formData.set("isOverlayRequired", "false");
    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: apiKey },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`OCR.space request failed with HTTP ${response.status}.`);
      return jsonResponse(response.status === 429 ? 429 : 502, {
        error: response.status === 429
          ? "OCR.space free request limit reached. Please wait and try again later."
          : `OCR.space could not process this photo (HTTP ${response.status}).`,
      });
    }

    const result = await response.json() as {
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
      const providerMessage = Array.isArray(result.ErrorMessage)
        ? result.ErrorMessage.join(" ")
        : result.ErrorMessage;
      console.error("OCR.space could not read the submitted photo:", providerMessage ?? "No text returned.");
      return jsonResponse(422, { error: "OCR.space could not find readable text in this photo." });
    }
    return jsonResponse(200, { text });
  } catch (error) {
    console.error("OCR.space recognition failed:", error);
    return jsonResponse(502, {
      error: error instanceof Error && error.name === "AbortError"
        ? "OCR exceeded 7 seconds. Try again or continue manually."
        : "OCR.space could not read this photo.",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
