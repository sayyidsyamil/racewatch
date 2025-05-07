// @ts-ignore: ytdl-core may not have types installed
import ytdl from "ytdl-core";
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import fs from "fs";
import path from "path";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) throw new Error("GOOGLE_API_KEY environment variable is not set");
const ai = new GoogleGenAI({ apiKey });

export async function downloadYouTubeAndAnalyze(url: string, prompt: string) {
  const videoId = ytdl.getURLVideoID(url);
  const filePath = path.join("/tmp", `${videoId}_${Date.now()}.mp4`);

  // 1. Download MP4 from YouTube
  const videoStream = ytdl(url, { quality: "highestvideo" });
  const writeStream = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    videoStream.pipe(writeStream);
    videoStream.on("end", resolve);
    videoStream.on("error", reject);
  });

  // 2. Upload to Gemini Files API
  const uploadedFile = await ai.files.upload({
    file: filePath,
    config: { mimeType: "video/mp4" },
  });

  // 3. Generate AI response
  const result = await ai.models.generateContent({
    model: "gemini-2.5-pro-preview-05-06",
    contents: createUserContent([
      createPartFromUri(uploadedFile.uri as string, "video/mp4"),
      prompt,
    ]),
  });

  // 4. Clean up
  fs.unlinkSync(filePath);

  return result.text;
} 