import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
// import Busboy from 'busboy'; // Busboy is not needed with NextRequest file handling

// export const config = { // config is not needed for bodyParser with NextRequest
//   api: {
//     bodyParser: false,
//   },
// };

// parseForm function is no longer needed with NextRequest formData()
// function parseForm(req: NextApiRequest): Promise<{ videoPath: string }> {
//   return new Promise((resolve, reject) => {
//     const busboy = Busboy({ headers: req.headers });
//     let videoPath = '';
//     const tmpdir = os.tmpdir();
//     let fileReceived = false;
//     busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream, filename: string) => {
//       if (fieldname === 'video') {
//         videoPath = path.join(tmpdir, `${Date.now()}_${filename}`);
//         const outStream = fs.createWriteStream(videoPath);
//         file.pipe(outStream);
//         outStream.on('finish', () => {
//           fileReceived = true;
//           resolve({ videoPath });
//         });
//         outStream.on('error', reject);
//       } else {
//         file.resume();
//       }
//     });
//     busboy.on('finish', () => {
//       if (!fileReceived) reject(new Error('No video file uploaded'));
//     });
//     busboy.on('error', reject);
//     req.pipe(busboy);
//   });
// }

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
      .on('error', (err: Error) => {
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

// Change to App Router POST handler
export async function POST(req: NextRequest) {
  try {
    // Use req.formData() to handle file uploads in App Router
    const formData = await req.formData();
    const videoFile = formData.get('video') as File | null;

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file uploaded' }, { status: 400 });
    }

    // Save the uploaded video file to a temporary location
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tmpdir = os.tmpdir();
    const videoPath = path.join(tmpdir, `${Date.now()}_${videoFile.name}`);
    fs.writeFileSync(videoPath, buffer);

    // Extract frames
    const frames = await extractFrames(videoPath, 5, 50);

    // Clean up the temporary video file
    fs.unlinkSync(videoPath);

    return NextResponse.json({ frames });
  } catch (err: any) {
    console.error('Frame extraction API error:', err);
    return NextResponse.json({ error: err.message || 'Failed to extract frames' }, { status: 500 });
  }
} 