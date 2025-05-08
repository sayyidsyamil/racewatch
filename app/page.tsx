"use client"
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Badge, BadgeProps } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LeaderboardRow {
  teamName: string;
  checkpoint?: { reached: number; total: number };
  time?: { start: string; end: string; taken: string };
  comment: string;
  category: "rendah" | "menengah";
  link?: string;
}

const PDF_MAP: Record<'rendah' | 'menengah', string> = {
  rendah: "/rendah_rule.pdf",
  menengah: "/menengah_rule.pdf",
};

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

async function fetchPdfAsBase64(pdfPath: string): Promise<string> {
  const res = await fetch(pdfPath);
  const blob = await res.blob();
  return await toBase64(new File([blob], "map.pdf", { type: "application/pdf" }));
}

const PROMPT = `"You are RaceSentinel AI, a robot race judge tasked with analyzing robot performance based on video and PDF inputs. Your job is to evaluate the race according to the provided rules and track map, paying close attention to accurate time calculation, checkpoint passage rules, and marker verification. Your evaluation should generate specific JSON output for each video example provided.

Evaluation Rules:

Race Track Specifications:
- The race track is marked by a black line. The official map (PDF - provided as input) includes star markers as checkpoints.
- Marker Verification: Ensure that the markers in the video match the markers in the PDF, either stars or alternative shapes/colors (e.g., yellow dots). This is critical for applying the correct evaluation rules.
- The blue line on the map is a guide and not part of the race path.
- The robot must follow the black line. It may deviate only when avoiding obstacles, but it must return to the track as per the rules.

Checkpoints & Scoring:
- The robot must start and finish at the designated start and end points on the map (PDF).
- The robot cannot reverse direction before passing its first checkpoint.
- The robot earns 1 point for each checkpoint passed, counting each checkpoint only once. The total number of checkpoints is 4 (as per the PDF map).
- Passing Rule: A checkpoint is "passed" ONLY when the robot's line-following sensor physically crosses over the marker seen in the video.
- Obstacle Zone (Checkpoint 3): This rule applies to the third checkpoint near the obstacle (bottom-right on the map).
    - The rule is the same for all checkpoints: Successfully avoiding the obstacle and rejoining the black line in the same zone (even slightly past the exact marker due to the avoidance path) counts as passing the checkpoint.
- The robot must pass the end point after completing the required checkpoints. Failure to cross the end line means the run is incomplete.

Obstacle Rules:
- There is one obstacle (a cube) on the course, located as indicated on the PDF.
- The robot may leave the black line to avoid the obstacle but must return to the same segment of the track after avoiding it.
- The robot must not touch the obstacle. If the robot touches it, a specific comment will be generated.
- The robot may cross adjacent lines while avoiding the obstacle, but it must return to following the correct path immediately.

Output Structure:
Return ONLY a valid JSON object in the following format. Do not include any text before or after the JSON object, and do not use markdown formatting (like \`\`\`json).

{
  "checkpoint": {
    "reached": X,
    "total": 4
  },
  "time": {
    "start": "mm:ss.xx", // timestamp when the robot begins following the path of race just before the timer is being on
    "end": "mm:ss.xx",
    "taken": "ss.xx"
  },
  "comment": "SINGLE LINE COMMENT"
}

Additionally, return a 'screenshots' object with timestamps (in mm:ss.xx) of the actualy video for the following events:
- mula: when the robot is at the start (MULA) line and about to start race just before the timer is on
- checkpoint_1: when the robot reaches checkpoint 1 (time when robot area touch  to the first checkpoint star etc)
- checkpoint_2: when the robot reaches checkpoint 2
- checkpoint_3: when the robot reaches checkpoint 3
- checkpoint_4: when the robot reaches checkpoint 4
- tamat: when the robot reaches the end (TAMAT)
- out_of_line: when the robot goes out of line (if applicable only if robot go out of line)

Example:
"screenshots": {
  "mula": "00:01.23",
  "checkpoint_1": "00:10.45",
  "checkpoint_2": "00:20.12",
  "checkpoint_3": "00:30.67",
  "checkpoint_4": "00:40.89",
  "tamat": "00:50.00",
  "out_of_line": "00:35.00"
}

Evaluation Considerations & Comment Logic:
1. Analyze the PDF: Identify the start/end points, path, the four star checkpoint locations, and the obstacle position.
2. Analyze the video:
   - Determine precise start and end times (mm:ss.xx). Calculate the time taken (end-start, in seconds).
   - Identify Marker Type in the video: note if the video uses stars or dots/other markers.
   - Track the robot's path carefully in relation to the PDF map.
   - Check for contact with the obstacle.
3. Apply Rules & Score Checkpoints:
   - For all checkpoints (1, 2, 3, and 4), the passing rule is the same: The robot must successfully avoid the obstacle and rejoin the black line in the same zone (even slightly past the exact marker due to the avoidance path).
   - Sum the reached checkpoints (X).
4. Determine Comment: Select ONE comment based on the first matching condition:
   - If all 4 checkpoints are reached and the video markers match the PDF stars -> "PERFECT"
  - If the robot touches or hit the obstacle -> "TOUCHED OBSTACLE"
   - If the obstacle zone checkpoint was not reached (i.e., the robot missed the marker in the obstacle zone) -> "OKAY (ROBOT MISSED CHECKPOINT IN OBSTACLE ZONE)"
   - If all 4 checkpoints are reached, but the video markers do not match the PDF stars (it could be other shape eg rounded yellow or pink but if its not there THEN flag this) -> "OKAY (NO MARKER)"
   - If the obstacle is not centered on the line of its track path (maybe the box slight left or right) -> "OKAY (OBSTACLE NOT CENTERED)"
   - If none of the above conditions are met, provide a neutral summary: "OKAY (OTHER DESCRIPTION)"

Strictness: Be fair but precise. Only judge based on what's visible in the video and what's outlined in the PDF map and rules. Calculate the time accurately and adhere strictly to the JSON format."
`;

const GEMINI_MODEL = "gemini-2.5-pro-preview-05-06";

function ResultEditor({ result, setResult, onSave, saving }: {
  result: any;
  setResult: (r: any) => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (!result) return null;
  return (
    <div className="space-y-2 mt-4">
      <div>
        <label className="block font-medium">Checkpoint touched</label>
        <Input
          type="text"
          value={result.checkpoint?.reached || ""}
          onChange={e => setResult({ ...result, checkpoint: { ...result.checkpoint, reached: e.target.value } })}
        />
      </div>
      <div>
        <label className="block font-medium">Start time</label>
        <Input
          type="text"
          value={result.time?.start || ""}
          onChange={e => setResult({ ...result, time: { ...result.time, start: e.target.value } })}
        />
      </div>
      <div>
        <label className="block font-medium">End time</label>
        <Input
          type="text"
          value={result.time?.end || ""}
          onChange={e => setResult({ ...result, time: { ...result.time, end: e.target.value } })}
        />
      </div>
      <div>
        <label className="block font-medium">Time taken</label>
        <Input
          type="text"
          value={result.time?.taken || ""}
          onChange={e => setResult({ ...result, time: { ...result.time, taken: e.target.value } })}
        />
      </div>
      <div>
        <label className="block font-medium">Comment</label>
        <Input
          type="text"
          value={result.comment || ""}
          onChange={e => setResult({ ...result, comment: e.target.value })}
        />
      </div>
      <button
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        onClick={onSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save to Database"}
      </button>
    </div>
  );
}

// Reusable loading overlay component for cleaner markup
function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10 animate-fade-in">
      <span className="animate-spin inline-block w-10 h-10 border-4 border-t-transparent border-pink-500 rounded-full" />
    </div>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [resultRendah, setResultRendah] = useState("");
  const [resultMenengah, setResultMenengah] = useState("");
  const [videoRendah, setVideoRendah] = useState<string | null>(null);
  const [videoMenengah, setVideoMenengah] = useState<string | null>(null);
  const [loadingRendah, setLoadingRendah] = useState(false);
  const [loadingMenengah, setLoadingMenengah] = useState(false);
  const [parsedRendah, setParsedRendah] = useState<any>(null);
  const [parsedMenengah, setParsedMenengah] = useState<any>(null);
  const [savingRendah, setSavingRendah] = useState(false);
  const [savingMenengah, setSavingMenengah] = useState(false);
  const [fileNameRendah, setFileNameRendah] = useState("");
  const [fileNameMenengah, setFileNameMenengah] = useState("");
  const [leaderboardRendah, setLeaderboardRendah] = useState<LeaderboardRow[]>([]);
  const [leaderboardMenengah, setLeaderboardMenengah] = useState<LeaderboardRow[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [lastModelRendah, setLastModelRendah] = useState<boolean>(false);
  const [lastModelMenengah, setLastModelMenengah] = useState<boolean>(false);
  const videoRendahRef = useRef<HTMLVideoElement>(null);
  const videoMenengahRef = useRef<HTMLVideoElement>(null);
  const [screenshotsRendah, setScreenshotsRendah] = useState<{ label: string, dataUrl: string }[]>([]);
  const [screenshotsMenengah, setScreenshotsMenengah] = useState<{ label: string, dataUrl: string }[]>([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRowData, setEditingRowData] = useState<LeaderboardRow | null>(null);
  const [editingCategory, setEditingCategory] = useState<'rendah' | 'menengah' | null>(null);

  // Authentication State
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const HARDCODED_USERNAME = 'myrc2025';
  const HARDCODED_PASSWORD = 'steminme2025!';

  // Add state for video URL and type
  const [videoRendahUrl, setVideoRendahUrl] = useState("");
  const [videoMenengahUrl, setVideoMenengahUrl] = useState("");
  const [videoRendahType, setVideoRendahType] = useState<null | "youtube" | "gdrive" | "direct">(null);
  const [videoMenengahType, setVideoMenengahType] = useState<null | "youtube" | "gdrive" | "direct">(null);

  // Add state for base64 video
  const [videoRendahBase64, setVideoRendahBase64] = useState<string | null>(null);
  const [videoMenengahBase64, setVideoMenengahBase64] = useState<string | null>(null);

  // Add a new state to track if the video is playable
  const [videoRendahPlayable, setVideoRendahPlayable] = useState(false);
  const [videoMenengahPlayable, setVideoMenengahPlayable] = useState(false);

  // Add a new state for video loading overlay
  const [videoRendahLoading, setVideoRendahLoading] = useState(false);
  const [videoMenengahLoading, setVideoMenengahLoading] = useState(false);

  // Add state for team name and video link
  const [teamNameRendah, setTeamNameRendah] = useState("");
  const [teamNameMenengah, setTeamNameMenengah] = useState("");
  const [videoRendahOriginalLink, setVideoRendahOriginalLink] = useState("");
  const [videoMenengahOriginalLink, setVideoMenengahOriginalLink] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("racewatch_apiKey");
      if (savedKey) setApiKey(savedKey);
      const savedLogin = localStorage.getItem("racewatch_loggedIn");
      if (savedLogin === "true") {
        setLoggedIn(true);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("racewatch_apiKey", apiKey);
      localStorage.setItem("racewatch_loggedIn", String(loggedIn));
    }
  }, [apiKey, loggedIn]);

  const handleLogin = () => {
    if (username === HARDCODED_USERNAME && password === HARDCODED_PASSWORD) {
      setLoggedIn(true);
      toast({ title: "Login Successful", description: "Welcome Race Sentinal!" });
    } else {
      toast({ title: "Login Failed", description: "Invalid username or password." });
      setLoggedIn(false);
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setApiKey(""); // Clear API key on logout
    toast({ title: "Logged Out", description: "You have been logged out." });
  };

  // Helper function to export data to CSV
  const exportToCsv = (data: LeaderboardRow[], filename: string) => {
    if (data.length === 0) {
      toast({ title: "Export", description: "No data to export." });
      return;
    }

    const headers = ["#", "Team Name", "Checkpoints Reached", "Checkpoints Total", "Time Taken", "Start Time", "End Time", "Comment"];
    const csvRows = [];

    csvRows.push(headers.join(',')); // Add headers

    data.forEach((row, index) => {
      const values = [
        index + 1, // Row number
        `"${row.teamName.replace(/"/g, '""')}"`, // Handle commas and quotes in team name
        row.checkpoint?.reached || 0,
        row.checkpoint?.total || 4,
        `"${row.time?.taken || ''}"`, // Handle potential commas/quotes in time
        `"${row.time?.start || ''}"`, // Handle potential commas/quotes in time
        `"${row.time?.end || ''}"`, // Handle potential commas/quotes in time
        `"${row.comment.replace(/"/g, '""')}"`, // Handle commas and quotes in comment
      ];
      csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Helper: Validate YouTube URL
  function isYouTubeUrl(url: string) {
    return /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/.test(url);
  }
  // Helper: Get file name from URL
  function getFileNameFromUrl(url: string): string {
    try {
      const parts = url.split("/");
      let name = parts[parts.length - 1];
      if (name.includes("?")) name = name.split("?")[0];
      return decodeURIComponent(name);
    } catch {
      return "Unknown Team";
    }
  }

  // Helper: Validate Google Drive URL
  function isGoogleDriveUrl(url: string) {
    return /^https?:\/\/(drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=)/.test(url);
  }

  // Modular, reusable function to load and prepare video from any source
  interface LoadAndPrepareVideoOptions {
    input: File | string;
    setVideoUrl: (url: string | null) => void;
    setPlayable: (playable: boolean) => void;
    setLoading: (loading: boolean) => void;
    setFileName: (name: string) => void;
    setVideoType: (type: null | 'youtube' | 'gdrive' | 'direct') => void;
    setBase64: (base64: string | null) => void;
    toast: (opts: { title: string; description: string }) => void;
  }
  async function loadAndPrepareVideo({
    input,
    setVideoUrl,
    setPlayable,
    setLoading,
    setFileName,
    setVideoType,
    setBase64,
    toast,
  }: LoadAndPrepareVideoOptions) {
    setPlayable(false);
    setLoading(true);
    if (!input) {
      setVideoUrl(null);
      setFileName("");
      setVideoType(null);
      setBase64(null);
      setLoading(false);
      return;
    }
    if (input instanceof File) {
      setVideoUrl(URL.createObjectURL(input));
      setFileName(input.name);
      setVideoType('direct');
      setLoading(true);
      toBase64(input).then(base64 => {
        setBase64(base64);
        setLoading(false);
      });
      return;
    }
    // input is a string (URL)
    const url = input.trim();
    if (!url) {
      setVideoUrl(null);
      setFileName("");
      setVideoType(null);
      setBase64(null);
      setLoading(false);
      return;
    }
    let type: null | 'youtube' | 'gdrive' | 'direct' = null;
    let title = url;
    if (isYouTubeUrl(url)) {
      type = 'youtube';
      try {
        const videoId = url.includes("youtu.be/")
          ? url.split("youtu.be/")[1].split(/[?&]/)[0]
          : new URL(url).searchParams.get("v");
        if (videoId) {
          const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}`;
          const res = await fetch(oembedUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.title) title = data.title;
          }
        }
      } catch {}
    } else if (isGoogleDriveUrl(url)) {
      type = 'gdrive';
      title = url;
    } else if (/^https?:\/\/.+\.(mp4|webm|ogg)$/i.test(url)) {
      type = 'direct';
      title = getFileNameFromUrl(url);
    }
    try {
      const res = await fetch("/api/video-to-base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !data.base64) throw new Error(data.error || "Failed to convert video");
      setVideoUrl(data.base64);
      setFileName(title);
      setVideoType(type);
      setBase64(data.base64);
      setLoading(false);
      toast({ title: "Video Ready", description: "Video loaded as base64." });
    } catch (e: any) {
      setVideoUrl(null);
      setFileName("");
      setVideoType(null);
      setBase64(null);
      setLoading(false);
      toast({ title: "Error", description: e?.toString() || "Failed to load video." });
    }
  }

  // Usage for Sekolah Rendah
  const handleRendahVideoInput = (input: File | string) => {
    setResultRendah("");
    setParsedRendah(null);
    setScreenshotsRendah([]);
    setVideoRendah(null);
    setVideoRendahLoading(true);
    if (typeof input === 'string') setVideoRendahOriginalLink(input);
    else if (input instanceof File) setVideoRendahOriginalLink(input.name);
    // Set default team name if empty
    if (!teamNameRendah) {
      if (input instanceof File) setTeamNameRendah(input.name.replace(/\.[^/.]+$/, ""));
      else if (typeof input === 'string' && isYouTubeUrl(input)) {
        // Fetch YouTube title
        const url = input.trim();
        const videoId = url.includes("youtu.be/")
          ? url.split("youtu.be/")[1].split(/[?&]/)[0]
          : new URL(url).searchParams.get("v");
        if (videoId) {
          fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}`)
            .then(res => res.json())
            .then(data => { if (data.title) setTeamNameRendah(data.title); });
        }
      } else if (typeof input === 'string' && isGoogleDriveUrl(input)) {
        setTeamNameRendah(getFileNameFromUrl(input).replace(/\.[^/.]+$/, ""));
      }
    }
    loadAndPrepareVideo({
      input,
      setVideoUrl: setVideoRendah,
      setPlayable: setVideoRendahPlayable,
      setLoading: setVideoRendahLoading,
      setFileName: setFileNameRendah,
      setVideoType: setVideoRendahType,
      setBase64: setVideoRendahBase64,
      toast,
    });
  };
  // Usage for Sekolah Menengah
  const handleMenengahVideoInput = (input: File | string) => {
    setResultMenengah("");
    setParsedMenengah(null);
    setScreenshotsMenengah([]);
    setVideoMenengah(null);
    setVideoMenengahLoading(true);
    if (typeof input === 'string') setVideoMenengahOriginalLink(input);
    else if (input instanceof File) setVideoMenengahOriginalLink(input.name);
    // Set default team name if empty
    if (!teamNameMenengah) {
      if (input instanceof File) setTeamNameMenengah(input.name.replace(/\.[^/.]+$/, ""));
      else if (typeof input === 'string' && isYouTubeUrl(input)) {
        // Fetch YouTube title
        const url = input.trim();
        const videoId = url.includes("youtu.be/")
          ? url.split("youtu.be/")[1].split(/[?&]/)[0]
          : new URL(url).searchParams.get("v");
        if (videoId) {
          fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}`)
            .then(res => res.json())
            .then(data => { if (data.title) setTeamNameMenengah(data.title); });
        }
      } else if (typeof input === 'string' && isGoogleDriveUrl(input)) {
        setTeamNameMenengah(getFileNameFromUrl(input).replace(/\.[^/.]+$/, ""));
      }
    }
    loadAndPrepareVideo({
      input,
      setVideoUrl: setVideoMenengah,
      setPlayable: setVideoMenengahPlayable,
      setLoading: setVideoMenengahLoading,
      setFileName: setFileNameMenengah,
      setVideoType: setVideoMenengahType,
      setBase64: setVideoMenengahBase64,
      toast,
    });
  };

  // Unified AI analysis function for both file and URL
  interface AnalyzeVideoWithAIParams {
    tab: 'rendah' | 'menengah';
    file?: File | null;
    base64?: string | null;
    urlType?: null | 'youtube' | 'gdrive' | 'direct';
    apiKey: string;
    setResult: (result: string) => void;
    setParsed: (parsed: any) => void;
    setLoading: (loading: boolean) => void;
    setLastModel: (v: boolean) => void;
  }
  async function analyzeVideoWithAI({
    tab,
    file,
    base64,
    urlType,
    apiKey,
    setResult,
    setParsed,
    setLoading,
    setLastModel,
  }: AnalyzeVideoWithAIParams) {
    setLoading(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const config = { responseMimeType: "application/json" };
      const parts = [
        { text: PROMPT },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: await fetchPdfAsBase64(PDF_MAP[tab]).then(base64 => base64.split(",")[1]),
          },
        },
      ];
      if (file) {
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: await toBase64(file).then(base64 => base64.split(",")[1]),
          },
        });
      } else if (base64) {
        parts.push({
          inlineData: {
            mimeType: "video/mp4",
            data: base64.split(",")[1],
          },
        });
      } else {
        // No valid video input
        setLoading(false);
        toast({ title: "No video loaded", description: "Please upload a video or load a valid video URL first." });
        return;
      }
      const response = await ai.models.generateContentStream({
        model: GEMINI_MODEL,
        config,
        contents: [
          {
            role: "user",
            parts,
          },
        ],
      });
      let result = "";
      for await (const chunk of response) {
        result += chunk.text;
      }
      // Remove any trailing 'undefined' or similar non-JSON text
      result = result.replace(/undefined+$/g, '').trim();
      try {
        const parsed = JSON.parse(result);
        if (!parsed.checkpoint?.total) {
          parsed.checkpoint = parsed.checkpoint || {};
          parsed.checkpoint.total = 4;
        }
        setResult(JSON.stringify(parsed, null, 2));
        setParsed(parsed);
        setLastModel(true);
      } catch {
        setResult(result);
        setParsed(null);
        toast({
          title: "AI Error",
          description: "Failed to parse AI response. The output may not be valid JSON. Please check the raw output below or try regenerating.",
        });
      }
    } catch (err) {
      toast({ title: "AI Error", description: (err as any)?.message || "Unknown error" });
    }
    setLoading(false);
  }

  // Update handleAnalyze to always use the video currently loaded in the player
  async function handleAnalyze(tab: 'rendah' | 'menengah') {
    let base64: string | null = null;
    let urlType: null | 'youtube' | 'gdrive' | 'direct' = null;
    let file: File | null = null;
    if (tab === 'rendah') {
      base64 = videoRendahBase64;
      urlType = videoRendahType;
      // If the video is a local file, try to get the file from the input (not possible from blob URL, so use base64)
    } else {
      base64 = videoMenengahBase64;
      urlType = videoMenengahType;
    }
    // Always use the base64 from the video player (which is set by loadAndPrepareVideo)
    await analyzeVideoWithAI({
      tab,
      file: null, // always null, since we use base64
      base64,
      urlType,
      apiKey,
      setResult: tab === 'rendah' ? setResultRendah : setResultMenengah,
      setParsed: tab === 'rendah' ? setParsedRendah : setParsedMenengah,
      setLoading: tab === 'rendah' ? setLoadingRendah : setLoadingMenengah,
      setLastModel: tab === 'rendah' ? setLastModelRendah : setLastModelMenengah,
    });
  }

  // Update video URL AI handler
  async function handleAnalyzeUrl(tab: "rendah" | "menengah") {
    await handleAnalyze(tab);
  }

  async function saveResult(tab: "rendah" | "menengah") {
    const data = tab === "rendah" ? parsedRendah : parsedMenengah;
    const teamName = tab === "rendah" ? teamNameRendah : teamNameMenengah;
    const link = tab === "rendah" ? videoRendahOriginalLink : videoMenengahOriginalLink;
    if (!data) return;
    if (!teamName || !teamName.trim()) {
      toast({ title: "Missing Team Name", description: "Please enter a team name before saving.", variant: "destructive" });
      return;
    }
    if (tab === "rendah") setSavingRendah(true);
    else setSavingMenengah(true);
    try {
      const res = await fetch("/api/save-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, teamName, link, category: tab }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.error && err.error.includes('already exists')) {
          toast({ title: "Duplicate Team Name", description: "A result for this team name already exists in this category. Please use a different file name or category." });
        } else {
          toast({ title: "Database Error", description: err.error || "Unknown error" });
        }
        throw new Error(err.error || "Failed to save result");
      }
      toast({ title: "Success", description: "Result saved to database." });
      fetchLeaderboard();
    } catch (err: any) {
      // Error already handled by toast above
    } finally {
      if (tab === "rendah") setSavingRendah(false);
      else setSavingMenengah(false);
    }
  }

  async function fetchLeaderboard() {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch("/api/save-result", { method: "GET" });
      const data = await res.json();
      setLeaderboardRendah(data.rendah || []);
      setLeaderboardMenengah(data.menengah || []);
    } catch (err: any) {
      toast({ title: "Leaderboard Error", description: err?.message || "Unknown error" });
    } finally {
      setLoadingLeaderboard(false);
    }
  }

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Helper to extract a frame at a given timestamp
  async function extractScreenshot(videoEl: HTMLVideoElement, timestamp: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const [min, sec] = timestamp.split(":");
      const [s, ms] = sec.split(".");
      const time = parseInt(min) * 60 + parseFloat(s + "." + (ms || "0"));
      const seekAndCapture = () => {
        videoEl.currentTime = time;
        videoEl.onseeked = () => {
          const canvas = document.createElement("canvas");
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png"));
          } else {
            reject("No canvas context");
          }
        };
      };
      if (Math.abs(videoEl.currentTime - time) > 0.01) {
        seekAndCapture();
      } else {
        // Already at the right time
        const canvas = document.createElement("canvas");
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        } else {
          reject("No canvas context");
        }
      }
    });
  }

  // After AI result, extract screenshots if timestamps are present
  useEffect(() => {
    async function processScreenshots(parsed: any, videoEl: HTMLVideoElement | null, setScreenshots: (shots: { label: string, dataUrl: string }[]) => void) {
      if (!parsed || !parsed.screenshots || !videoEl) return;
      const entries = Object.entries(parsed.screenshots) as [string, string][];
      const shots: { label: string, dataUrl: string }[] = [];
      for (const [label, timestamp] of entries) {
        try {
          const dataUrl = await extractScreenshot(videoEl, timestamp);
          shots.push({ label, dataUrl });
        } catch {}
      }
      setScreenshots(shots);
    }
    processScreenshots(parsedRendah, videoRendahRef.current, setScreenshotsRendah);
  }, [parsedRendah, videoRendahRef.current]);
  useEffect(() => {
    async function processScreenshots(parsed: any, videoEl: HTMLVideoElement | null, setScreenshots: (shots: { label: string, dataUrl: string }[]) => void) {
      if (!parsed || !parsed.screenshots || !videoEl) return;
      const entries = Object.entries(parsed.screenshots) as [string, string][];
      const shots: { label: string, dataUrl: string }[] = [];
      for (const [label, timestamp] of entries) {
        try {
          const dataUrl = await extractScreenshot(videoEl, timestamp);
          shots.push({ label, dataUrl });
        } catch {}
      }
      setScreenshots(shots);
    }
    processScreenshots(parsedMenengah, videoMenengahRef.current, setScreenshotsMenengah);
  }, [parsedMenengah, videoMenengahRef.current]);

  const handleEditClick = (row: LeaderboardRow, category: 'rendah' | 'menengah') => {
    setEditingRowData(row);
    setEditingCategory(category);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = async (row: LeaderboardRow) => {
    if (confirm(`Are you sure you want to delete the result for ${row.teamName}?`)) {
      try {
        const res = await fetch(`/api/save-result?teamName=${row.teamName}&category=${row.category}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to delete result");
        }
        toast({ title: "Success", description: "Result deleted successfully." });
        fetchLeaderboard(); // Refresh the leaderboard after deletion
      } catch (err: any) {
        toast({ title: "Delete Error", description: err?.message || "Unknown error" });
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!editingRowData || !editingCategory) return;

    try {
      const res = await fetch('/api/save-result', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRowData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save changes');
      }

      toast({ title: 'Success', description: 'Changes saved successfully.' });
      fetchLeaderboard(); // Refresh the leaderboard
    } catch (err: any) {
      toast({ title: 'Save Error', description: err?.message || 'Unknown error' });
    } finally {
      setIsEditModalOpen(false);
      setEditingRowData(null);
      setEditingCategory(null);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-start bg-gradient-to-br from-blue-50 via-pink-50 to-yellow-50 p-2 sm:p-6">
      <Toaster />
      {!loggedIn ? (
        <Card className="w-full max-w-sm mx-auto mt-20">
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="myrc2025"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" onClick={handleLogin}>Sign in</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full max-w-screen-lg mt-6 mb-4 p-6 rounded-2xl shadow-xl bg-white/80 border border-gray-100 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-4">
             <h1 className="text-4xl font-extrabold text-pink-600 flex items-center gap-2">
              <span>🏁</span> Race Sentinel
            </h1>
            <Button variant="outline" onClick={handleLogout}>Logout</Button>
          </div>
          <div className="mb-4 text-gray-700 text-center text-lg font-medium">
            This website is created for <b>MYRC25</b> as an AI evaluator.<br />
            Upload your race video and get instant AI-based evaluation and leaderboard.
          </div>
          <div className="w-full flex flex-col gap-4">
            <label className="font-semibold text-gray-800">API Key</label>
            <div className="flex flex-col gap-2 items-stretch">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full pr-10 text-base border-pink-300 focus:border-pink-500 focus:ring-pink-200 rounded-lg shadow-sm"
                  style={{ fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-pink-400 hover:text-pink-600 transition"
                  tabIndex={-1}
                  onClick={() => setShowApiKey(v => !v)}
                >
                  {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="w-full mt-6 mb-2">
            <div className="p-3 bg-gradient-to-r from-pink-100 via-yellow-100 to-blue-100 border border-pink-200 rounded-xl text-pink-700 text-sm font-semibold flex items-center gap-2 shadow-sm">
              <span>💡</span>
              <span>Pro model is used for all evaluations. If your API key does not have access, you will see an error.</span>
              <span className="ml-auto text-blue-700 underline cursor-pointer" onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}>Get your API key</span>
            </div>
          </div>
          <div className="w-full border-t border-dashed border-pink-200 my-6"></div>
          <div className="w-full">
            <Tabs defaultValue="rendah" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4 rounded-lg overflow-hidden shadow">
                <TabsTrigger value="rendah" className="data-[state=active]:bg-pink-100 data-[state=active]:text-pink-700">Sekolah Rendah</TabsTrigger>
                <TabsTrigger value="menengah" className="data-[state=active]:bg-pink-100 data-[state=active]:text-pink-700">Sekolah Menengah</TabsTrigger>
                <TabsTrigger value="leaderboard" className="data-[state=active]:bg-pink-100 data-[state=active]:text-pink-700">Leaderboard</TabsTrigger>
              </TabsList>
              <TabsContent value="rendah">
                <div className="flex flex-col gap-4">
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label className="text-base font-semibold text-pink-700">Team Name</Label>
                    <Input
                      type="text"
                      id="teamNameRendah"
                      placeholder="Enter team name"
                      value={teamNameRendah}
                      onChange={e => setTeamNameRendah(e.target.value)}
                      className="rounded-xl border-pink-300 focus:border-pink-500 focus:ring-pink-200 text-base py-2 px-3 shadow-sm"
                    />
                  </div>
                  <label className="font-medium">Upload Video</label>
                  <Input type="file" accept="video/*" onChange={e => { const file = e.target.files?.[0]; if (file) handleRendahVideoInput(file); }}/>
                  <div className="flex gap-2 items-center mt-2">
                    <Input
                      type="text"
                      placeholder="Paste YouTube, Google Drive, or direct video URL"
                      value={videoRendahUrl}
                      onChange={e => setVideoRendahUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={() => handleRendahVideoInput(videoRendahUrl)}>Load Video from URL</Button>
                  </div>
                  <div className="text-xs text-gray-500">YouTube URL support is in preview. Only public videos are supported.</div>
                  {videoRendahLoading && (
                    <LoadingOverlay />
                  )}
                  {videoRendah && (
                    <div className="relative">
                      <video
                        ref={videoRendahRef}
                        src={videoRendah}
                        controls
                        className="w-full max-h-96 rounded border"
                        onLoadedData={() => {
                          setVideoRendahPlayable(true);
                          setVideoRendahLoading(false);
                        }}
                        onError={() => {
                          setVideoRendah(null);
                          setFileNameRendah("");
                          setVideoRendahPlayable(false);
                          setVideoRendahLoading(false);
                          toast({ title: "Video Playback Error", description: "This video could not be loaded. Please use YouTube, Google Drive, or upload the file directly.", duration: 8000 });
                        }}
                      />
                    </div>
                  )}
                  {videoRendahPlayable && (
                    <Button type="button" className="mt-2" onClick={() => handleAnalyzeUrl("rendah")}>Process with AI</Button>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="font-medium">AI Result</label>
                    {lastModelRendah && (
                      <Badge variant="outline">Pro Model</Badge>
                    )}
                  </div>
                  {loadingRendah && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><span className="animate-spin inline-block w-4 h-4 border-2 border-t-transparent border-gray-400 rounded-full"></span>Uploading & Analyzing...</div>
                  )}
                  {parsedRendah && (
                    <ResultEditor
                      result={parsedRendah}
                      setResult={setParsedRendah}
                      onSave={() => saveResult("rendah")}
                      saving={savingRendah}
                    />
                  )}
                  {screenshotsRendah.length > 0 && (
                    <div className="flex flex-wrap gap-4 mt-4">
                      {screenshotsRendah.map((shot, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                          <img src={shot.dataUrl} alt={shot.label} className="w-32 h-20 object-cover rounded border" />
                          <span className="text-xs mt-1 font-semibold">{shot.label.replace(/_/g, ' ').toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!parsedRendah && resultRendah && (
                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto max-h-40">
                      <b>Raw Output:</b>
                      <pre>{resultRendah}</pre>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="menengah">
                <div className="flex flex-col gap-4">
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label className="text-base font-semibold text-pink-700">Team Name</Label>
                    <Input
                      type="text"
                      id="teamNameMenengah"
                      placeholder="Enter team name"
                      value={teamNameMenengah}
                      onChange={e => setTeamNameMenengah(e.target.value)}
                      className="rounded-xl border-pink-300 focus:border-pink-500 focus:ring-pink-200 text-base py-2 px-3 shadow-sm"
                    />
                  </div>
                  <label className="font-medium">Upload Video</label>
                  <Input type="file" accept="video/*" onChange={e => { const file = e.target.files?.[0]; if (file) handleMenengahVideoInput(file); }}/>
                  <div className="flex gap-2 items-center mt-2">
                    <Input
                      type="text"
                      placeholder="Paste YouTube, Google Drive, or direct video URL"
                      value={videoMenengahUrl}
                      onChange={e => setVideoMenengahUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={() => handleMenengahVideoInput(videoMenengahUrl)}>Load Video from URL</Button>
                  </div>
                  <div className="text-xs text-gray-500">YouTube URL support is in preview. Only public videos are supported.</div>
                  {videoMenengahLoading && (
                    <LoadingOverlay />
                  )}
                  {videoMenengah && (
                    <div className="relative">
                      <video
                        ref={videoMenengahRef}
                        src={videoMenengah}
                        controls
                        className="w-full max-h-96 rounded border"
                        onLoadedData={() => {
                          setVideoMenengahPlayable(true);
                          setVideoMenengahLoading(false);
                        }}
                        onError={() => {
                          setVideoMenengah(null);
                          setFileNameMenengah("");
                          setVideoMenengahPlayable(false);
                          setVideoMenengahLoading(false);
                          toast({ title: "Video Playback Error", description: "This video could not be loaded. Please use YouTube, Google Drive, or upload the file directly.", duration: 8000 });
                        }}
                      />
                    </div>
                  )}
                  {videoMenengahPlayable && (
                    <Button type="button" className="mt-2" onClick={() => handleAnalyzeUrl("menengah")}>Process with AI</Button>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="font-medium">AI Result</label>
                    {lastModelMenengah && (
                      <Badge variant="outline">Pro Model</Badge>
                    )}
                  </div>
                  {loadingMenengah && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><span className="animate-spin inline-block w-4 h-4 border-2 border-t-transparent border-gray-400 rounded-full"></span>Uploading & Analyzing...</div>
                  )}
                  {parsedMenengah && (
                    <ResultEditor
                      result={parsedMenengah}
                      setResult={setParsedMenengah}
                      onSave={() => saveResult("menengah")}
                      saving={savingMenengah}
                    />
                  )}
                  {screenshotsMenengah.length > 0 && (
                    <div className="flex flex-wrap gap-4 mt-4">
                      {screenshotsMenengah.map((shot, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                          <img src={shot.dataUrl} alt={shot.label} className="w-32 h-20 object-cover rounded border" />
                          <span className="text-xs mt-1 font-semibold">{shot.label.replace(/_/g, ' ').toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!parsedMenengah && resultMenengah && (
                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto max-h-40">
                      <b>Raw Output:</b>
                      <pre>{resultMenengah}</pre>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="leaderboard">
                <div className="flex flex-col gap-8">
                  <div>
                    <h2 className="font-bold text-lg mb-2">Sekolah Rendah</h2>
                    <Button variant="outline" className="mb-4" onClick={() => exportToCsv(leaderboardRendah, 'rendah_leaderboard.csv')}>Export Sekolah Rendah Data</Button>
                    <div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]">#</TableHead>
                            <TableHead className="w-[120px]">Team Name</TableHead>
                            <TableHead className="w-[120px]">Video Link</TableHead>
                            <TableHead>Checkpoints</TableHead>
                            <TableHead>Time Taken</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            <TableHead className="w-auto">Comment</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leaderboardRendah
                            .sort((a: LeaderboardRow, b: LeaderboardRow) => parseFloat(a.time?.taken || "9999") - parseFloat(b.time?.taken || "9999"))
                            .map((row: LeaderboardRow, i) => {
                              if (!row.teamName || !row.category) {
                                console.warn('Malformed leaderboard row:', row);
                                return null;
                              }
                              return (
                                <TableRow key={i}>
                                  <TableCell className="py-1 px-2">{i + 1}</TableCell>
                                  <TableCell className="font-medium text-xs py-1 px-2">{row.teamName ?? '?'}</TableCell>
                                  <TableCell className="text-xs py-1 px-2">
                                    {row.link && row.link.startsWith('http') ? (
                                      <a href={row.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline flex items-center gap-1">
                                        View Video
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14m-7 7h7a2 2 0 002-2v-7" /></svg>
                                      </a>
                                    ) : (
                                      row.link ? row.link : <span className="text-gray-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs py-1 px-2">{row.checkpoint?.reached ?? '?'} / {row.checkpoint?.total ?? 4}</TableCell>
                                  <TableCell className="text-xs py-1 px-2">{row.time?.taken ?? ''}</TableCell>
                                  <TableCell className="text-xs py-1 px-2">{row.time?.start ?? ''}</TableCell>
                                  <TableCell className="text-xs py-1 px-2">{row.time?.end ?? ''}</TableCell>
                                  <TableCell className="whitespace-normal text-xs py-1 px-2">{row.comment ?? ''}</TableCell>
                                  <TableCell className="text-right py-1 px-2">
                                    <Button variant="ghost" size="icon" className="mr-0.5 h-5 w-5" onClick={() => handleEditClick(row, 'rendah') as any}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-800 h-5 w-5" onClick={() => handleDeleteClick(row) as any}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg mb-2">Sekolah Menengah</h2>
                    <Button variant="outline" className="mb-4" onClick={() => exportToCsv(leaderboardMenengah, 'menengah_leaderboard.csv')}>Export Sekolah Menengah Data</Button>
                    <div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]">#</TableHead>
                            <TableHead className="w-[120px]">Team Name</TableHead>
                            <TableHead className="w-[120px]">Video Link</TableHead>
                            <TableHead>Checkpoints</TableHead>
                            <TableHead>Time Taken</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            <TableHead className="w-auto">Comment</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leaderboardMenengah
                            .sort((a: LeaderboardRow, b: LeaderboardRow) => parseFloat(b.time?.taken || "9999") - parseFloat(a.time?.taken || "9999"))
                            .map((row: LeaderboardRow, i) => {
                              if (!row.teamName || !row.category) {
                                console.warn('Malformed leaderboard row:', row);
                                return null;
                              }
                              return (
                                <TableRow key={i}>
                                  <TableCell className="py-1 px-2">{i + 1}</TableCell>
                                  <TableCell className="font-medium text-xs py-1 px-2">{row.teamName ?? '?'}</TableCell>
                                  <TableCell className="text-xs py-1 px-2">
                                    {row.link && row.link.startsWith('http') ? (
                                      <a href={row.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline flex items-center gap-1">
                                        View Video
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14m-7 7h7a2 2 0 002-2v-7" /></svg>
                                      </a>
                                    ) : (
                                      row.link ? row.link : <span className="text-gray-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs py-1 px-2">{row.checkpoint?.reached ?? '?'} / {row.checkpoint?.total ?? 4}</TableCell>
                                  <TableCell className="text-xs py-1 px-2">{row.time?.taken ?? ''}</TableCell>
                                  <TableCell className="text-xs py-1 px-2">{row.time?.start ?? ''}</TableCell>
                                  <TableCell className="text-xs py-1 px-2">{row.time?.end ?? ''}</TableCell>
                                  <TableCell className="whitespace-normal text-xs py-1 px-2">{row.comment ?? ''}</TableCell>
                                  <TableCell className="text-right py-1 px-2">
                                    <Button variant="ghost" size="icon" className="mr-0.5 h-5 w-5" onClick={() => handleEditClick(row, 'menengah') as any}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-800 h-5 w-5" onClick={() => handleDeleteClick(row) as any}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {/* Edit Result Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Result</DialogTitle>
            <DialogDescription>
              Edit the details for the selected team result.
            </DialogDescription>
          </DialogHeader>
          {editingRowData && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="teamName" className="text-right">
                  Team Name
                </Label>
                <Input
                  id="teamName"
                  value={editingRowData.teamName}
                  onChange={(e) => setEditingRowData({ ...editingRowData, teamName: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="checkpointReached" className="text-right">
                  Checkpoints Reached
                </Label>
                <Input
                  id="checkpointReached"
                  value={editingRowData.checkpoint?.reached || 0}
                  onChange={(e) => setEditingRowData({
                    ...editingRowData,
                    checkpoint: {
                      reached: parseInt(e.target.value) || 0,
                      total: editingRowData.checkpoint?.total ?? 4,
                    },
                  })}
                  className="col-span-3"
                  type="number"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="startTime" className="text-right">
                  Start Time
                </Label>
                <Input
                  id="startTime"
                  value={editingRowData.time?.start || ""}
                  onChange={(e) => setEditingRowData({
                    ...editingRowData,
                    time: {
                      start: e.target.value,
                      end: editingRowData.time?.end ?? "",
                      taken: editingRowData.time?.taken ?? "",
                    },
                  })}
                  className="col-span-3"
                  placeholder="mm:ss.xx"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="endTime" className="text-right">
                  End Time
                </Label>
                <Input
                  id="endTime"
                  value={editingRowData.time?.end || ""}
                  onChange={(e) => setEditingRowData({
                    ...editingRowData,
                    time: {
                      start: editingRowData.time?.start ?? "",
                      end: e.target.value,
                      taken: editingRowData.time?.taken ?? "",
                    },
                  })}
                  className="col-span-3"
                  placeholder="mm:ss.xx"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="timeTaken" className="text-right">
                  Time Taken
                </Label>
                <Input
                  id="timeTaken"
                  value={editingRowData.time?.taken || ""}
                  onChange={(e) => setEditingRowData({
                    ...editingRowData,
                    time: {
                      start: editingRowData.time?.start ?? "",
                      end: editingRowData.time?.end ?? "",
                      taken: e.target.value,
                    },
                  })}
                  className="col-span-3"
                  placeholder="ss.xx"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="comment" className="text-right">
                  Comment
                </Label>
                <Textarea
                  id="comment"
                  value={editingRowData.comment || ""}
                  onChange={(e) => setEditingRowData({ ...editingRowData, comment: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="videoLink" className="text-right">Video Link</Label>
                <Input
                  id="videoLink"
                  value={editingRowData.link || ''}
                  onChange={e => setEditingRowData({ ...editingRowData, link: e.target.value })}
                  className="col-span-3"
                  placeholder="Paste video link or file name"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={handleSaveChanges}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}