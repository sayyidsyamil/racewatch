import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "🏁 RaceWatch AI – MYRC25 Robot Race Evaluator",
  description: "Upload your race video, get instant AI scoring, and see your team on the leaderboard! Built for MYRC25.",
  keywords: [
    "robot race",
    "AI judge",
    "leaderboard",
    "MYRC25",
    "Gemini",
    "video scoring",
    "education",
    "competition",
    "Sekolah Rendah",
    "Sekolah Menengah",
    "RaceWatch AI",
  ],
  openGraph: {
    title: "🏁 RaceWatch AI – MYRC25 Robot Race Evaluator",
    description: "Upload your race video, get instant AI scoring, and see your team on the leaderboard! Built for MYRC25.",
    url: "https://racewatchai.vercel.app/",
    siteName: "RaceWatch AI",
    images: [
      {
        url: "/og-image.png", // fallback image if no logo
        width: 1200,
        height: 630,
        alt: "RaceWatch AI Social Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "🏁 RaceWatch AI – MYRC25 Robot Race Evaluator",
    description: "Upload your race video, get instant AI scoring, and see your team on the leaderboard! Built for MYRC25.",
    images: ["/og-image.png"],
    creator: "@myrc25",
    site: "@myrc25",
  },
  themeColor: "#f472b6", // Tailwind pink-400
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
