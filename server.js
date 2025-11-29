import express from "express";
import fetch from "node-fetch";
import { v4 as uuid } from "uuid";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import ytdlp from "yt-dlp-exec";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.json({ limit: "200mb" }));

app.post("/clip", async (req, res) => {
  try {
    const { vodUrl, startTime, endTime } = req.body;

    console.log("Received clip request:", { vodUrl, startTime, endTime });

    // 1. Download VOD using yt-dlp
    const tmpDir = os.tmpdir();
    const fileId = uuid();
    const inputPath = path.join(tmpDir, `${fileId}.mp4`);
    const outputPath = path.join(tmpDir, `${fileId}-clip.mp4`);

    console.log("Downloading Twitch VOD...");

    await ytdlp(vodUrl, {
      o: inputPath,
      f: "best",
    });

    console.log("VOD downloaded:", inputPath);

    // 2. Cut the video using ffmpeg
    console.log("Cutting video...");
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(endTime - startTime)
      .output(outputPath)
      .on("end", () => {
        console.log("Clip created:", outputPath);

        res.download(outputPath, "clip.mp4", () => {
          fs.unlinkSync(inputPath);
          fs.unlinkSync(outputPath);
        });
      })
      .on("error", (err) => {
        console.log("FFmpeg error:", err);
        res.status(500).json({ error: "FFmpeg failed" });
      })
      .run();

  } catch (err) {
    console.error("Worker error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("Clipify Worker is Running"));

app.listen(process.env.PORT || 3000, () => {
  console.log("Worker started on port", process.env.PORT || 3000);
});
