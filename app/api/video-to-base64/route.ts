import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';

// Detect video type
function getVideoType(url: string): 'youtube' | 'gdrive' | 'direct' | 'unknown' {
  if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url)) return 'youtube';
  if (/^https?:\/\/(drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=)/.test(url)) return 'gdrive';
  if (/^https?:\/\/.+\.(mp4|webm|ogg)$/i.test(url)) return 'direct';
  return 'unknown';
}

// Convert Google Drive link to usercontent direct download link
function getGoogleDriveUsercontentUrl(url: string): string {
  const match = url.match(/\/d\/([\w-]+)/);
  if (match) return `https://drive.usercontent.google.com/uc?id=${match[1]}&export=download`;
  const openId = url.match(/id=([\w-]+)/);
  if (openId) return `https://drive.usercontent.google.com/uc?id=${openId[1]}&export=download`;
  return url;
}

// Download with yt-dlp (YouTube)
function downloadWithYtDlp(url: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(`yt-dlp -f best -o "${filePath}" "${url}"`, (err, stdout, stderr) => {
      if (err) {
        console.error('yt-dlp error:', stderr || err);
        return reject(stderr || err);
      }
      resolve();
    });
  });
}

// Download direct video file with browser-like User-Agent and follow redirects
function downloadDirect(url: string, filePath: string, maxRedirects = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    proto.get(url, options, (response) => {
      // Handle redirect
      if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        if (maxRedirects === 0) {
          return reject(new Error('Too many redirects'));
        }
        // Recursively follow the redirect
        return downloadDirect(response.headers.location, filePath, maxRedirects - 1).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download file: ${response.statusCode}`));
      }
      const file = fs.createWriteStream(filePath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      reject(err);
    });
  });
}

export async function POST(req: NextRequest) {
  let { url } = await req.json();
  // Sanitize: remove leading/trailing whitespace, leading @, and quotes
  if (typeof url === 'string') {
    url = url.trim().replace(/^[@"']+/, '');
  }
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid URL' }, { status: 400 });
  }
  let type = getVideoType(url);
  let processedUrl = url;
  if (type === 'gdrive') {
    processedUrl = getGoogleDriveUsercontentUrl(url);
    type = 'direct';
  }
  const filePath = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);

  try {
    if (type === 'youtube') {
      await downloadWithYtDlp(processedUrl, filePath);
    } else if (type === 'direct') {
      await downloadDirect(processedUrl, filePath);
    } else {
      return NextResponse.json({ error: 'Unsupported video URL' }, { status: 400 });
    }
    const fileBuffer = fs.readFileSync(filePath);
    // If file is very small, it's likely an error page, not a video
    if (fileBuffer.length < 100 * 1024) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ error: 'Downloaded file is too small. The Google Drive file may not be public or downloadable.' }, { status: 403 });
    }
    const base64 = `data:video/mp4;base64,${fileBuffer.toString('base64')}`;
    fs.unlinkSync(filePath);
    return NextResponse.json({ base64 });
  } catch (e: any) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return NextResponse.json({ error: e?.toString() || 'Download or conversion failed' }, { status: 500 });
  }
} 