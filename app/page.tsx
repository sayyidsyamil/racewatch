"use client"
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

const PROMPT = `"You are RaceWatch AI, a robot race judge tasked with analyzing robot performance based on video and PDF inputs. Your job is to evaluate the race according to the provided rules and track map, paying close attention to accurate time calculation, checkpoint passage rules, and marker verification. Your evaluation should generate specific JSON output for each video example provided.

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
    "start": "mm:ss.xx", // timestamp when the robot begins following the path
    "end": "mm:ss.xx",
    "taken": "ss.xx"
  },
  "comment": "SINGLE LINE COMMENT"
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
  const [lastModelRendah, setLastModelRendah] = useState<string | null>(null);
  const [lastModelMenengah, setLastModelMenengah] = useState<string | null>(null);

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
      if (tab === "rendah") {
        setParsedRendah(null);
      } else {
        setParsedMenengah(null);
      }
      return;
    }
    setLoading(true);
    setResult("");
    setVideo(URL.createObjectURL(file));
    if (tab === "rendah") {
      setParsedRendah(null);
    } else {
      setParsedMenengah(null);
    }
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
        if (tab === "rendah") setLastModelRendah(usedModel);
        else setLastModelMenengah(usedModel);
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
                  <video
                    src={videoRendah}
                    controls
                    className="w-full max-h-96 rounded border"
                  />
                )}
                <div className="flex items-center gap-2">
                  <label className="font-medium">AI Result</label>
                  {lastModelRendah && (
                    <Badge variant={lastModelRendah === "gemini-2.5-pro-preview-03-25" ? "default" : "secondary"}>
                      {lastModelRendah === "gemini-2.5-pro-preview-03-25" ? "Pro Model" : "Flash Model (Fallback)"}
                    </Badge>
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
                  <video
                    src={videoMenengah}
                    controls
                    className="w-full max-h-96 rounded border"
                  />
                )}
                <div className="flex items-center gap-2">
                  <label className="font-medium">AI Result</label>
                  {lastModelMenengah && (
                    <Badge variant={lastModelMenengah === "gemini-2.5-pro-preview-03-25" ? "default" : "secondary"}>
                      {lastModelMenengah === "gemini-2.5-pro-preview-03-25" ? "Pro Model" : "Flash Model (Fallback)"}
                    </Badge>
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
