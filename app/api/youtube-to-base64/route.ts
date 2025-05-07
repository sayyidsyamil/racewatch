import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid URL' }, { status: 400 });
  }
  const filePath = path.join(os.tmpdir(), `ytvideo_${Date.now()}.mp4`);

  try {
    // Download the video using yt-dlp
    console.log('Step 1: Downloading video with yt-dlp');
    await new Promise((resolve, reject) => {
      exec(`yt-dlp -f best -o "${filePath}" "${url}"`, (err, stdout, stderr) => {
        if (err) {
          console.error('yt-dlp error:', stderr || err);
          return reject(stderr || err);
        }
        resolve(stdout);
      });
    });
    console.log('Step 2: Reading file');
    const fileBuffer = fs.readFileSync(filePath);
    console.log('Step 3: Converting to base64');
    const base64 = `data:video/mp4;base64,${fileBuffer.toString('base64')}`;
    console.log('Step 4: Deleting file');
    fs.unlinkSync(filePath);
    console.log('Step 5: Returning response');
    return NextResponse.json({ base64 });
  } catch (e: any) {
    console.error('YouTube to base64 error:', e);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return NextResponse.json({ error: e?.toString() || 'Download or conversion failed' }, { status: 500 });
  }
} 