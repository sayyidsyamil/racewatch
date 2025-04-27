# 🏁 RaceWatch AI

RaceWatch AI is a web application built for MYRC25 to provide instant AI-based evaluation of robot race videos and a live leaderboard. It uses Google Gemini models to analyze race performance according to official rules and outputs structured results.

![RaceWatch AI Logo](./public/logo.png)

## Features
- Upload race videos for Sekolah Rendah and Sekolah Menengah categories
- Choose between Gemini Flash (free/testing) and Pro (paid/recommended) models
- Instant AI evaluation with JSON output and editable fields
- Save results to MongoDB with team name, model used, and category
- Live leaderboard for both categories, sorted by time
- Mobile responsive, beautiful, and fun UI
- Error handling with user-friendly toasts

## Setup
1. **Clone the repository:**
   ```sh
   git clone https://github.com/sayyidsyamil/racewatch.git
   cd racewatch
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Configure environment:**
   - Copy `.env.local.example` to `.env.local` and set your MongoDB URI:
     ```env
     MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/racewatch?retryWrites=true&w=majority
     ```
4. **Run the development server:**
   ```sh
   npm run dev
   ```
5. **Get your Gemini API key:**
   - Visit [Gemini API Key Portal](https://aistudio.google.com/app/apikey)
   - Enter your API key in the app UI

## Usage
- Upload a video, select the model, and get instant AI evaluation.
- Edit the result if needed and save to the leaderboard.
- View and compare results in the leaderboard tab.

## Logo
If you want to add a custom logo, place it at `public/logo.png` and update the README if needed.

---

Made with ❤️ for MYRC25.
