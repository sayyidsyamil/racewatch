import type { NextApiRequest, NextApiResponse } from 'next';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req: NextApiRequest): Promise<{ videoPath: string }> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    let videoPath = '';
    const tmpdir = os.tmpdir();
    let fileReceived = false;
    busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream, filename: string) => {
      if (fieldname === 'video') {
        videoPath = path.join(tmpdir, `${Date.now()}_${filename}`);
        const outStream = fs.createWriteStream(videoPath);
        file.pipe(outStream);
        outStream.on('finish', () => {
          fileReceived = true;
          resolve({ videoPath });
        });
        outStream.on('error', reject);
      } else {
        file.resume();
      }
    });
    busboy.on('finish', () => {
      if (!fileReceived) reject(new Error('No video file uploaded'));
    });
    busboy.on('error', reject);
    req.pipe(busboy);
  });
}

function extractFrames(videoPath: string, fps = 5, maxFrames = 50): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tmpdir = os.tmpdir();
    const outputDir = path.join(tmpdir, `frames_${Date.now()}`);
    fs.mkdirSync(outputDir);
    const framePattern = path.join(outputDir, 'frame_%03d.png');
    ffmpeg(videoPath)
      .setFfmpegPath(ffmpegPath as string)
      .outputOptions([
        `-vf fps=${fps}`,
        `-vframes ${maxFrames}`
      ])
      .output(framePattern)
      .on('end', () => {
        const files = fs.readdirSync(outputDir)
          .filter(f => f.endsWith('.png'))
          .sort();
        const frames = files.map(f => {
          const buf = fs.readFileSync(path.join(outputDir, f));
          return buf.toString('base64');
        });
        // Cleanup
        files.forEach(f => fs.unlinkSync(path.join(outputDir, f)));
        fs.rmdirSync(outputDir);
        resolve(frames);
      })
      .on('error', err => {
        // Cleanup
        if (fs.existsSync(outputDir)) {
          fs.readdirSync(outputDir).forEach(f => fs.unlinkSync(path.join(outputDir, f)));
          fs.rmdirSync(outputDir);
        }
        reject(err);
      })
      .run();
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { videoPath } = await parseForm(req);
    const frames = await extractFrames(videoPath, 5, 50);
    fs.unlinkSync(videoPath);
    return res.status(200).json({ frames });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to extract frames' });
  }
} 