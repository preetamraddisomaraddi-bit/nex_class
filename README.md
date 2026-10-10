# EduSync 🎓
### Real-Time Smart Classroom Platform

Two desktop applications + one backend server.

---

## Project Structure

```
edusync/
├── server/          ← Node.js backend (runs on teacher's laptop)
├── teacher-app/     ← Electron desktop app for teachers
└── student-app/     ← Electron desktop app for students
```

---

## Step 1 — Start the Server

Open a terminal and run:

```bash
cd server
npm install
npm run dev
```

You will see the server print your **LAN IP address** — share this with students.

---

## Step 2 — Start Teacher App

Open a new terminal:

```bash
cd teacher-app
npm install
npm run dev
```

---

## Step 3 — Start Student App

Open another terminal:

```bash
cd student-app
npm install
npm run dev
```

---

## How It Works

- Server runs on **teacher's laptop** on port 4000
- Both apps connect to the server over **WiFi / LAN**
- Students enter the server IP in their app settings
- Teacher creates a room → gets a 6-digit code → students join with that code
- Everything syncs in real-time via Socket.IO

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop App | Electron.js |
| UI | React + Tailwind CSS |
| Real-time | Socket.IO |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |

---

## Features

- 🖊️ Live drawing board (syncs to all students)
- 🖥️ Screen sharing (PPT, browser, anything)
- 📤 Push notes (students can download as PDF)
- 💻 Code editor with run support
- 📡 Code broadcast (teacher's code → all student editors)
- 📋 Attendance (auto-marked on join)
- 📝 Exams (MCQ + Written + Coding)
- 👤 Student profiles with scores & badges
- 🤖 AI hints via Claude API
