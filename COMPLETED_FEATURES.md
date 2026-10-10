# EduSync — Completed Features & Architecture Summary

This document provides a comprehensive log of the features built, updated, and integrated in this development cycle, detailing the architecture of the **Backend Server**, **Student Desktop App**, and **Teacher Desktop App**.

---

## 📁 File Structure & Mapping

Here is the current state of the files we have modified or newly created:

```
edusync/
├── server/
│   ├── index.js                  ← Mounted /api/ai, /api/badges, /api/pdfs, and new /api/universities, /api/departments, /api/semesters routes
│   ├── socket/
│   │   └── events.js             ← Heartbeats, WebRTC screen share, slides presenter & PDF socket streams
│   ├── middleware/
│   │   └── auth.js               ← [NEW] Defines verifyTeacher, verifyStudent, and verifyAdmin JWT validations
│   ├── db/
│   │   └── database.js           ← Automated try-catch migrations for multi-university tables and columns
│   └── routes/
│       ├── auth.js               ← Converted database calls to promise helpers, added university signup fields & USN student login
│       ├── rooms.js              ← Enforces student department and semester matches on join
│       ├── attendance.js         ← Converted database calls to async promise helpers
│       ├── notes.js              ← Converted database calls to async promise helpers
│       ├── exam.js               ← Converted database calls to async promise helpers
│       ├── code.js               ← Converted database calls to async promise helpers
│       ├── ai.js                 ← Claude API endpoint with local syntax checker fallback
│       ├── badges.js             ← Computes & awards student badges dynamically
│       ├── pdfs.js               ← Saves pushed PDFs in BLOBs, maps students, streams file downloads
│       ├── universities.js       ← [NEW] Statistics summaries, low attendance alerts, monthly session logs
│       ├── departments.js        ← [NEW] CRUD actions for university departments
│       └── semesters.js          ← [NEW] Semester student rosters, mapping tools for instructors
│
├── registration-site/            ← [NEW] React + Vite Browser Registration Portal
│   ├── package.json
│   ├── vite.config.js            ← Base path set to '/register/' for static Express serving
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               ← Maps Landing (/) and Register (/signup)
│       ├── index.css
│       └── pages/
│           ├── Landing.jsx       ← SaaS promotion view with feature highlight cards
│           └── Register.jsx      ← 3-step sign-up wizard (Metadata, Admin credentials, confirmation codes)
│
├── admin-app/                    ← [NEW] Electron + React Admin Desktop Shell (Port 5175)
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── electron/
│   │   ├── main.js               ← IPC file savers, electron-store JWT managers, custom app menus
│   │   └── preload.js            ← contextBridge preload script
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               ← Protected route verification hooks, fixed navigation AppShell sidebar
│       ├── api.js                ← Axios client appending admin token headers
│       ├── index.css
│       └── pages/
│           ├── Login.jsx         ← Admin authentication portal
│           ├── Dashboard.jsx     ← High-level count cards, active room logs, pending alerts banners
│           ├── Departments.jsx    ← CRUD actions for academic divisions
│           ├── Semesters.jsx      ← Maps teachers and lists semester cohort student grades
│           ├── Teachers.jsx      ← Dual-tab approved/pending logs supporting teacher activation
│           ├── Students.jsx      ← Roster search, full student profile modals (attendance rings, exam score logs, badges)
│           ├── Sessions.jsx      ← Filterable class history list with detail overlays
│           ├── Reports.jsx       ← Custom CSS monthly attendance charts, performance distribution graphs
│           └── Downloads.jsx     ← Compliance export dashboard for CSV/PDF records
│
├── teacher-app/
│   ├── package.json              ← Configured electron-builder packaging configurations
│   ├── electron/
│   │   └── main.js               ← Enabled local-media:// video stream protocol, LibreOffice converters
│   │   └── preload.js            ← Exposed local buffer reading, PDF pickers, PPT-to-PDF IPC bridges
│   └── src/
│       └── pages/
│           ├── Classroom.jsx     ← Slide presenters, Next/Prev slide syncs, pushed PDF triggers, live connection roster
│           ├── Dashboard.jsx     ← Light/White theme professional redesign
│           └── Login.jsx         ← Add university code, employee ID, and department mapping selectors
│
└── student-app/                  ← Complete React + Tailwind + Electron Student App
    ├── package.json              ← Configured dependencies, scripts, packaging parameters
    ├── vite.config.js            ← Setup Vite dev server on port 5174
    ├── tailwind.config.js        ← Content patterns for Tailwind CSS compiling
    ├── index.html                ← App DOM mounting wrapper
    ├── electron/
    │   ├── main.js               ← Activates Focus Mode kiosk locks, blocks Alt+Tab/Meta/Alt+F4, intercepts close warnings
    │   └── preload.js            ← ContextBridge preload bridge exposing savePDF and Focus Mode toggles
    └── src/
        ├── App.jsx               ← Route handlers (/login, /dashboard, /classroom/:code, /profile)
        ├── index.css             ← Global styles, custom scrollbars, and scroll tracks
        ├── api.js                ← Axios API instances & Socket.IO client connections
        └── pages/
            ├── Login.jsx         ← Support login via USN, select university codes and semesters on registration
            ├── Dashboard.jsx     ← Light/White theme professional redesign with join room forms
            ├── Classroom.jsx     ← Auto focus mode initialization, PDF sub-panels, presentation slide image players
            └── Profile.jsx       ← SVG attendance rings, CSS exam bar charts, badge grids, notes compile exporters
```

---

## 🛠️ Summary of Completed Features

### 1. Database Driver Mismatch Resolution (Backend)
- Converted all database queries from synchronous `better-sqlite3` formatting (`db.prepare().run()`) to asynchronous promise-based queries (`dbGet`, `dbRun`, `dbAll`) defined in `server/db/database.js`. This prevents driver runtime exceptions with standard `sqlite3` on Windows.

### 2. AI-Powered Code Guidance & Hints (Backend + Student App)
- Developed a new `/api/ai/hint` endpoint in the backend. When a student clicks **Ask AI** in the Code tab, the system calls the Anthropic Claude API using `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`) and returns suggestions.
- **Offline Fallback**: If the server has no internet or the API key is missing, it parses the code locally (checking for unmatched brackets, missing colons in Python blocks, uninitialized JS const definitions) and gives the student heuristic feedback.

### 3. Student Achievements & Badges (Backend + Student App)
- Developed a new `/api/badges/student/:student_id` endpoint.
- Whenever a student accesses their profile, the backend automatically evaluates the student's metrics:
  - **Attendance Star**: Present in at least 3 classes.
  - **Coding Champ**: Submitted code at least once.
  - **Fast Learner**: Submitted code at least 3 times.
  - **Exam Ace**: Score $\ge$ 80% on any exam.
  - **Perfect Score**: Score = 100% on any exam.
  - **Consistent**: Active heartbeats received during class.
  - **Top Performer**: Top grade averages across exams.
- Eligible badges are saved to the SQLite database and rendered on the student's Profile page.

### 4. Classroom Whiteboard Synchronization (Real-time)
- The Teacher app captures mouse/pen drawing coordinates on a Fabric.js canvas and broadcasts them via the Socket.IO `board:draw` channel.
- The Student app captures the draw coordinates and redraws them on a read-only HTML5 canvas in real time.

### 5. WebRTC Screen Sharing (Desktop Capturer)
- Built screen capture capabilities in the Teacher app using Electron's `desktopCapturer` via IPC.
- When the teacher starts screen sharing, they stream the desktop feed to students using peer-to-peer WebRTC connections.
- The student app listens for connection parameters and streams the screen share inside a toggleable `<video>` card.

### 6. Notes PDF Exporter (Student App)
- Pushed note announcements display instantly on the student app.
- Students can click **Download PDF** on any note to generate a styled PDF sheet on the client-side using `jspdf`, containing subject details, topics, date, and formatted text wrapping.

### 7. Live Exams & Countdown Timers (Student App)
- When a teacher launches an exam, the student app transitions to the timed Exam view.
- A timer countdown ticks down (e.g. 30 minutes) and **automatically submits** the student's answers when the timer reaches zero.
- Graded results display instantly upon submission.

### 8. CSV Exporters (Teacher App)
- **Attendance**: Added a download button to export the attendance sheet (Names, Roll Numbers, sections, status, join times) as a CSV file.
- **Exam Results**: Added a student results table and CSV exporter showing exam grades.

### 9. Electron Packaging Setup
- Added `electron-builder` parameters to `package.json` files for both the Teacher and Student apps.
- Run `npm run package` to compile source code into standalone `.exe` installers.

### 10. PDF Push (Teacher → Students)
- Teacher pushes local PDFs via Electron file picker dialogs to the server, which broadcasts the binary to students and saves it to a SQLite BLOB. 
- Students receive the PDF broadcast instantly in-app, can preview it inside a secure iframe wrapper (fully offline compatible using Blob Object URLs), download it to their desktop, and access it later in their profile logs.

### 11. Local File Presentation (PPT / PDF / Video)
- **PowerPoint/PDF**: Teacher presents local PDF or PowerPoint files. PowerPoint files are compiled to PDF on-the-fly using headless LibreOffice. PDF.js renders pages to canvas client-side, converts them to compressed base64 JPEG images, and streams them page-by-page to all students.
- **Video Sharing**: Teacher selects local videos which play locally and stream to students via WebRTC MediaStream (`captureStream()`) using a custom `local-media://` Electron protocol handler.

### 12. Distraction Filter (Hard Block Focus Mode)
- Student app automatically locks into a fullscreen kiosk lock when joining a classroom.
- Intercepts and blocks typical window switching keys (`Alt+Tab`, `Super`/Windows key, `Alt+F4`, `Ctrl+Escape`).
- Intercepts window close attempts to display warning confirmations. If the student confirms and force-quits the app, it sends a Socket warning to the teacher's active dashboard.
- Displays green (online/focused), amber (distracted/unfocused), or red (offline) status indicator dots next to each student in the teacher's active list based on periodic heartbeats.

### 13. Student Profile Analytics & Badge Grid
- Rebuilt the profile dashboard with the following cards:
  - **Circular SVG Attendance ring**: Dynamic radial ring displaying attendance percentage.
  - **Monthly breakdown logs**: Table displaying Month | Classes | Attendance rate with color ratings (Green $\ge$ 75%, Amber 60-74%, Red < 60%).
  - **Exam analytics**: Average grades and best scores metrics alongside a custom, pure CSS-based bar chart.
  - **Achievements badge grid**: Locks greyed out with locks, and earned badges colored.
  - **Shared materials & notes logs**: List of pushed PDFs and notes with a compilation exporter to aggregate all notes into a single PDF.

### 14. Light Theme Dashboard Redesign
- Upgraded the teacher dashboard ([Dashboard.jsx](file:///d:/edusync/edusync/teacher-app/src/pages/Dashboard.jsx)) and student dashboard ([Dashboard.jsx](file:///d:/edusync/student-app/src/pages/Dashboard.jsx)) from dark slate styles to professional white/light layouts with clean thin borders and soft drop shadows.

### 15. Multi-University Cloud SaaS Portal
- **University Registration Portal**: Created a React-based public landing and registration site under `registration-site/` where universities can sign up, upload their logo, and receive a unique university code. Served statically under `/register`.
- **Database Multitenancy**: Modified `server/db/database.js` to create `universities`, `departments`, `semesters`, and `semester_teachers` tables, and altered existing entities to support multi-tenant references.
- **Dedicated Admin App**: Designed and built `admin-app/` in Electron + React, enabling administrative officers to construct departments, create semesters, activate/approve pending teacher registrations, review students metrics and badge accomplishments, trace active sessions, analyze monthly compliance via pure CSS bar charts, and export CSV/PDF summaries.
- **Tenant Enrollment Safeguards**: Modified registration views in both the Teacher and Student apps to require university code mappings, matching students to active department and semester cohorts, and blocking classroom entries if student course departments do not match the active session.

---

## 🚀 How to Run the Applications

1. **Start Server**:
   ```bash
   cd server
   npm install
   node index.js
   ```
   *Note the LAN IP (e.g., `192.168.1.50`) displayed on start.*

2. **Start Teacher App**:
   ```bash
   cd teacher-app
   npm install
   npm run dev
   ```

3. **Start Student App**:
   ```bash
   cd student-app
   npm install
   npm run dev
   ```

4. **Start Admin App**:
   ```bash
   cd admin-app
   npm install
   npm run dev
   ```
