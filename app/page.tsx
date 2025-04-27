"use client"
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";

const PDF_MAP = {
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

const PROMPT = `You are RaceWatch AI, a robot race judge tasked with analyzing robot performance based on both video and PDF inputs. Your job is to evaluate the race strictly according to the provided rules and map, paying close attention to precise time calculation, conditional checkpoint passage rules, and marker type verification. Your evaluation must generate the specific JSON output confirmed for each provided video example.

Evaluation Rules:

Race Track Specifications:
The track is marked with a black line. The official map (PDF - provided as input) shows star markers as checkpoints.
Marker Verification: Observe the markers used in the video. They might be stars (matching the PDF) or different shapes/colors (e.g., yellow dots). This observation is crucial for applying the correct rules and comments.
The blue line is a guide; it is not part of the race path.
The robot must follow the black line and should not cut corners or deviate significantly, except for valid obstacle avoidance.

Checkpoints & Scoring:
The robot must start and finish at the defined start/end points shown in the PDF map.
The robot cannot reverse direction until after passing the first checkpoint marker it encounters.
The robot earns 1 point per checkpoint passed (first time only). Total checkpoints (total) are based on the PDF map (4 stars).
General Passing Rule (Strict): For checkpoints not located near the obstacle zone, a checkpoint is "passed" ONLY when the robot's line-following sensor(s) physically cross over the designated checkpoint marker seen in the video.
Conditional Passing Rule (Obstacle Zone - Checkpoint 3): This rule applies only to the checkpoint located near the obstacle (typically the 3rd one visited chronologically, bottom-right on the map, verify position using the PDF).
    Condition A (Star Markers in Video): If the video shows star markers (matching the PDF), apply the Strict Passing Rule: The robot's sensors must physically cross over the star marker after avoiding the obstacle to get the point.
    Condition B (Dot Markers or Other Non-Star Markers in Video): If the video shows dot markers (or other non-star shapes), apply the Modified Passing Rule: Successfully avoiding the obstacle and rejoining the black line in the same zone (even if slightly past the precise marker location due to the avoidance path) is sufficient to consider this specific checkpoint 'passed'.
After passing the first checkpoint marker, subsequent markers may be visited in any order allowed by the path.
The robot must pass through the END point after attempting all required checkpoints. Failure to cross the END line means the run is incomplete.

Obstacle Rules:
There is one obstacle (cube) on the course. Check PDF for location.
The robot may leave the black line to avoid the obstacle, but must return to the same zone (the segment of the track it was on before deviating).
The robot must not touch the obstacle. Touching incurs a specific comment.
Crossing nearby lines during the avoidance manoeuvre is permitted, but following them is not.

Output Structure:
Return ONLY a valid JSON object in the following format. Do not include any text before or after the JSON object, and do not use markdown formatting (like \`\`\`json).

{
  "checkpoint": {
    "reached": X,
    "total": 4
  },
  "time": {
    "start": "mm:ss.xx", //not the video start time but precise tstart time when robot start move follow the race path
    "end": "mm:ss.xx",
    "taken": "ss.xx"
  },
  "comment": "SINGLE LINE COMMENT"
}

Evaluation Considerations & Comment Logic:
1. Analyze PDF: Identify start/end, path, 4 star checkpoint locations, obstacle position.
2. Analyze Video:
   - Determine precise start and end times (mm:ss.xx). Calculate taken time (end-start, in seconds XX.XX).
   - Identify Marker Type in Video: Crucially note if the video uses stars or dots/other markers.
   - Track the robot's path meticulously against the PDF map.
   - Check for obstacle contact.
3. Apply Rules & Score Checkpoints:
   - For checkpoints 1, 2, and 4 (non-obstacle zone), use the General Passing Rule (Strict).
   - For checkpoint 3 (obstacle zone), determine if Condition A or B applies based on the Marker Type identified in the video, and apply the corresponding rule (Strict or Modified).
   - Sum the reached checkpoints (X).
4. Determine Comment: Choose ONE comment based on the first matching condition below:
   - If the robot does not cross the finish line -> "ROBOT DID NOT COMPLETE COURSE"
   - If the robot touches the obstacle -> "TOUCHED OBSTACLE"
   - If checkpoint 3 (obstacle area) was NOT reached or go through AND the applicable rule was Strict Passing (Condition A - i.e., video had stars but robot didn't cross it) -> "OKAY (ROBOT TAK LALU TITIK MARKAH HALANGAN)"
   - If all 4 checkpoints are reached (using the applicable rules) AND the video markers were stars (matching PDF) -> "PERFECT"
   - If all 4 checkpoints are reached (using the applicable rules) BUT the video markers were missing (not matching PDF) -> "OKAY (TIADA TITIK MARKAH)"
   - If none of the above specific conditions are met, provide a brief, accurate, neutral summary of the run (e.g., "Completed course, missed X checkpoints").

Strictness: Be strict but fair. Only judge based on what's visible in the video and specified in the PDF map and rules. Calculate time precisely. Adhere exactly to the JSON format.
`;

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
  const [leaderboardRendah, setLeaderboardRendah] = useState<any[]>([]);
  const [leaderboardMenengah, setLeaderboardMenengah] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [model, setModel] = useState("gemini-2.5-pro-preview-03-25");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("racewatch_apiKey");
      if (savedKey) setApiKey(savedKey);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("racewatch_apiKey", apiKey);
    }
  }, [apiKey]);

  async function handleVideoChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setVideo: (url: string | null) => void,
    setResult: (result: string) => void,
    setLoading: (loading: boolean) => void,
    tab: "rendah" | "menengah"
  ) {
    const file = e.target.files?.[0];
    if (!file) {
      setVideo(null);
      setResult("");
      if (tab === "rendah") setFileNameRendah("");
      else setFileNameMenengah("");
      return;
    }
    setLoading(true);
    setResult("");
    setVideo(URL.createObjectURL(file));
    if (tab === "rendah") setFileNameRendah(file.name);
    else setFileNameMenengah(file.name);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      let usedModel = "gemini-2.5-pro-preview-03-25";
      let response;
      try {
        const ai = new GoogleGenAI({ apiKey });
        response = await ai.models.generateContentStream({
          model: usedModel,
          contents: [
            {
              role: "user",
              parts: [
                { text: PROMPT },
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: await fetchPdfAsBase64(PDF_MAP[tab]).then(base64 => base64.split(",")[1]),
                  },
                },
                {
                  inlineData: {
                    mimeType: file.type,
                    data: await toBase64(file).then(base64 => base64.split(",")[1]),
                  },
                },
              ],
            },
          ],
        });
      } catch (err: any) {
        let message = err?.message || "Unknown error";
        if (
          message.includes("doesn't have a free quota tier") ||
          message.includes("RESOURCE_EXHAUSTED")
        ) {
          // Fallback to Flash for this one request
          usedModel = "gemini-2.5-flash-preview-04-17";
          toast({
            title: "Fallback to Flash",
            description: "Your API key does not have access to the Pro model. Using Flash model for this request.",
          });
          const ai = new GoogleGenAI({ apiKey });
          response = await ai.models.generateContentStream({
            model: usedModel,
            contents: [
              {
                role: "user",
                parts: [
                  { text: PROMPT },
                  {
                    inlineData: {
                      mimeType: "application/pdf",
                      data: await fetchPdfAsBase64(PDF_MAP[tab]).then(base64 => base64.split(",")[1]),
                    },
                  },
                  {
                    inlineData: {
                      mimeType: file.type,
                      data: await toBase64(file).then(base64 => base64.split(",")[1]),
                    },
                  },
                ],
              },
            ],
          });
        } else {
          throw err;
        }
      }
      let result = "";
      for await (const chunk of response) {
        result += chunk.text;
      }
      try {
        const jsonMatch = result.match(/{[\s\S]*}/);
        const cleaned = jsonMatch ? jsonMatch[0] : result
          .replace(/```json\s*/g, "")
          .replace(/```/g, "")
          .trim();
        const parsed = JSON.parse(cleaned);
        if (!parsed.checkpoint?.total) {
          parsed.checkpoint.total = 4;
        }
        setResult(JSON.stringify(parsed, null, 2));
        if (tab === "rendah") setParsedRendah(parsed);
        else setParsedMenengah(parsed);
      } catch {
        setResult(result);
        if (tab === "rendah") setParsedRendah(null);
        else setParsedMenengah(null);
        toast({
          title: "AI Error",
          description: "Failed to parse AI response. The output may not be valid JSON. Please check the raw output below or try regenerating.",
        });
      }
    } catch (err: any) {
      let message = err?.message || "Unknown error";
      toast({ title: "AI Error", description: message });
    }
    setLoading(false);
  }

  async function saveResult(tab: "rendah" | "menengah") {
    const data = tab === "rendah" ? parsedRendah : parsedMenengah;
    const teamName = tab === "rendah" ? fileNameRendah : fileNameMenengah;
    let modelUsed = "Pro";
    if (data && data.model && data.model === "gemini-2.5-flash-preview-04-17") modelUsed = "Flash";
    if (!data) return;
    if (tab === "rendah") setSavingRendah(true);
    else setSavingMenengah(true);
    try {
      const res = await fetch("/api/save-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, teamName, category: tab, modelUsed }),
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

  // Add regenerate handlers
  function handleRegenerate(tab: "rendah" | "menengah") {
    if (tab === "rendah" && videoRendah) {
      handleVideoChange({ target: { files: [dataURLtoFile(videoRendah, fileNameRendah)] } } as any, setVideoRendah, setResultRendah, setLoadingRendah, "rendah");
    } else if (tab === "menengah" && videoMenengah) {
      handleVideoChange({ target: { files: [dataURLtoFile(videoMenengah, fileNameMenengah)] } } as any, setVideoMenengah, setResultMenengah, setLoadingMenengah, "menengah");
    }
  }

  // Helper to convert dataURL back to File
  function dataURLtoFile(dataurl: string, filename: string) {
    const arr = dataurl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "";
    if (!arr[1]) return new File([], filename, { type: mime });
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  // Remove video handlers
  function handleRemoveVideo(tab: "rendah" | "menengah") {
    if (tab === "rendah") {
      setVideoRendah(null);
      setResultRendah("");
      setParsedRendah(null);
      setFileNameRendah("");
    } else {
      setVideoMenengah(null);
      setResultMenengah("");
      setParsedMenengah(null);
      setFileNameMenengah("");
    }
  }

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-start bg-gradient-to-br from-blue-50 via-pink-50 to-yellow-50 p-2 sm:p-6">
      <Toaster />
      <div className="w-full max-w-2xl mt-6 mb-4 p-6 rounded-2xl shadow-xl bg-white/80 border border-gray-100 flex flex-col items-center">
        <h1 className="text-4xl font-extrabold mb-2 text-center text-pink-600 flex items-center gap-2">
          <span>🏁</span> RaceWatch AI
        </h1>
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
            <span>Pro model is used for all evaluations. If your API key does not have access, the app will fallback to Flash for this request only.</span>
            <span className="ml-auto text-blue-700 underline cursor-pointer" onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}>Get your API key</span>
          </div>
        </div>
        <div className="w-full border-t border-dashed border-pink-200 my-6"></div>
        <div className="w-full max-w-2xl">
          <Tabs defaultValue="rendah" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 rounded-lg overflow-hidden shadow">
              <TabsTrigger value="rendah" className="data-[state=active]:bg-pink-100 data-[state=active]:text-pink-700">Sekolah Rendah</TabsTrigger>
              <TabsTrigger value="menengah" className="data-[state=active]:bg-pink-100 data-[state=active]:text-pink-700">Sekolah Menengah</TabsTrigger>
              <TabsTrigger value="leaderboard" className="data-[state=active]:bg-pink-100 data-[state=active]:text-pink-700">Leaderboard</TabsTrigger>
            </TabsList>
            <TabsContent value="rendah">
              <div className="flex flex-col gap-4">
                <label className="font-medium">Upload Video</label>
                <Input type="file" accept="video/*" onChange={e => handleVideoChange(e, setVideoRendah, setResultRendah, setLoadingRendah, "rendah")}/>
                {videoRendah && (
                  <div className="flex flex-col gap-2">
                    <video
                      src={videoRendah}
                      controls
                      className="w-full max-h-96 rounded border"
                    />
                    <div className="flex gap-2 mt-1">
                      <button
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-200 hover:bg-pink-300 text-pink-800 font-semibold shadow transition"
                        onClick={() => handleRegenerate("rendah")}
                        type="button"
                      >
                        <RefreshCw className="w-4 h-4" /> Regenerate
                      </button>
                      <button
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold shadow transition"
                        onClick={() => handleRemoveVideo("rendah")}
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" /> Remove Video
                      </button>
                    </div>
                  </div>
                )}
                {loadingRendah && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="animate-spin inline-block w-4 h-4 border-2 border-t-transparent border-gray-400 rounded-full"></span>Uploading & Analyzing...</div>
                )}
                <label className="font-medium">AI Result</label>
                <ResultEditor
                  result={parsedRendah}
                  setResult={setParsedRendah}
                  onSave={() => saveResult("rendah")}
                  saving={savingRendah}
                />
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
                <label className="font-medium">Upload Video</label>
                <Input type="file" accept="video/*" onChange={e => handleVideoChange(e, setVideoMenengah, setResultMenengah, setLoadingMenengah, "menengah")}/>
                {videoMenengah && (
                  <div className="flex flex-col gap-2">
                    <video
                      src={videoMenengah}
                      controls
                      className="w-full max-h-96 rounded border"
                    />
                    <div className="flex gap-2 mt-1">
                      <button
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-200 hover:bg-pink-300 text-pink-800 font-semibold shadow transition"
                        onClick={() => handleRegenerate("menengah")}
                        type="button"
                      >
                        <RefreshCw className="w-4 h-4" /> Regenerate
                      </button>
                      <button
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold shadow transition"
                        onClick={() => handleRemoveVideo("menengah")}
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" /> Remove Video
                      </button>
                    </div>
                  </div>
                )}
                {loadingMenengah && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="animate-spin inline-block w-4 h-4 border-2 border-t-transparent border-gray-400 rounded-full"></span>Uploading & Analyzing...</div>
                )}
                <label className="font-medium">AI Result</label>
                <ResultEditor
                  result={parsedMenengah}
                  setResult={setParsedMenengah}
                  onSave={() => saveResult("menengah")}
                  saving={savingMenengah}
                />
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
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-2 py-1 border">Team Name</th>
                          <th className="px-2 py-1 border">Checkpoints</th>
                          <th className="px-2 py-1 border">Time Taken</th>
                          <th className="px-2 py-1 border">Start</th>
                          <th className="px-2 py-1 border">End</th>
                          <th className="px-2 py-1 border">Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardRendah.sort((a, b) => parseFloat(a.time?.taken || "9999") - parseFloat(b.time?.taken || "9999")).map((row, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1 border">{row.teamName}</td>
                            <td className="px-2 py-1 border">{row.checkpoint?.reached}/{row.checkpoint?.total}</td>
                            <td className="px-2 py-1 border">{row.time?.taken}</td>
                            <td className="px-2 py-1 border">{row.time?.start}</td>
                            <td className="px-2 py-1 border">{row.time?.end}</td>
                            <td className="px-2 py-1 border">{row.comment}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h2 className="font-bold text-lg mb-2">Sekolah Menengah</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-2 py-1 border">Team Name</th>
                          <th className="px-2 py-1 border">Checkpoints</th>
                          <th className="px-2 py-1 border">Time Taken</th>
                          <th className="px-2 py-1 border">Start</th>
                          <th className="px-2 py-1 border">End</th>
                          <th className="px-2 py-1 border">Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardMenengah.sort((a, b) => parseFloat(a.time?.taken || "9999") - parseFloat(b.time?.taken || "9999")).map((row, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1 border">{row.teamName}</td>
                            <td className="px-2 py-1 border">{row.checkpoint?.reached}/{row.checkpoint?.total}</td>
                            <td className="px-2 py-1 border">{row.time?.taken}</td>
                            <td className="px-2 py-1 border">{row.time?.start}</td>
                            <td className="px-2 py-1 border">{row.time?.end}</td>
                            <td className="px-2 py-1 border">{row.comment}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}
