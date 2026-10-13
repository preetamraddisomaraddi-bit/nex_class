# Project review and stabilization

Reviewed repository baseline: `4ff0ab9`. Branch: `fix/project-verification`.

## Architecture and feature inventory

The existing React/Vite/Tailwind, Electron, Express, Socket.IO and SQLite architecture is preserved. No directory relocation, database replacement or new product module was introduced.

| Module | Current implementation and verification | Remaining work |
| --- | --- | --- |
| University signup | Registration UI, logo data, university/admin persistence and admin login; API tested, production build passes | Established year is collected but not persisted; browser form still needs interactive acceptance testing |
| Administration | Departments, semesters, instructor assignments/approval, students, sessions, reports and CSV/PDF exports have UI/API implementations; build passes and attendance report tested | Tenant ownership checks missing in several routes; deletion with dependent records can fail with a foreign-key error; export escaping needs review |
| Teacher desktop | Login, rooms, whiteboard, notes, attendance, exams, submissions and media presentation implemented; build passes | Windows screen capture, WebRTC, LibreOffice conversion and installers require manual verification; room form does not expose cohort selection |
| Student desktop | Email/USN login, joining, classroom, code, notes/PDFs, exam timer and profile implemented; build passes; core APIs tested | Browser timer interactions and kiosk behavior need Windows verification; current exam components mount only while their tab is open |
| Authentication | JWT and bcrypt implemented; configured secrets now honored and existing role middleware checks roles | Most classroom API routes do not apply authentication; socket events trust client identities; pending teachers receive signup tokens |
| Real-time classroom | Board, notes, code broadcast, PDF, exams, WebRTC signaling, slides, status, chat/hand socket handlers | Chat/hand handlers lack matching UI; reconnect membership/state recovery incomplete; board/slides state replay incomplete |
| Exams | Creation, launch/end, MCQ scoring and history implemented; API grading and persisted launch timestamp tested | Written/coding answers are stored but not graded; answers include correct indexes in student payloads; submissions can be replaced and lack deadline/access enforcement |
| Code and AI | Code submission/history tested; Judge0 execution and Claude/local hint implementations present | Compiler and AI external services not exercised; PDF.js CDN and Judge0 mean those features are not fully offline; AI model/configuration and timeout need review |
| Attendance and badges | Attendance/history tested; five badge rules implemented and perfect-score badge tested | Attendance denominator only includes recorded joins, so missing sessions are not counted; “Consistent” and “Top Performer” badges advertised in historical log are absent |
| Database | 15 SQLite tables, async helpers, WAL, foreign keys and tenant migrations | Migration errors are logged rather than blocking startup; duplicate existing USNs can prevent unique-index creation; broader validation/transactions need review |

## Modifications

1. Repair the USN migration by adding a plain column and then a unique index; retain existing records. Add a database-path override for isolated tests.
2. Fix invalid attendance-report subquery syntax.
3. Import `dbAll` in socket PDF sharing so PDFs are linked to students and actually broadcast after saving. Raise Socket.IO's payload limit to 10 MiB to accommodate PDFs larger than its default 1 MiB; base64 overhead counts toward that limit.
4. Save student code once through HTTP; use the existing socket event for teacher notifications.
5. Remove duplicate teacher WebRTC callbacks that shadowed the functioning handlers and referenced undefined `offerSDP`.
6. Select packaged Electron assets using `app.isPackaged`; use hash routing in teacher/student apps and relative admin asset paths for `file://` loading.
7. Fix admin requests to resolve the currently selected server on each request, include `/api`, and default to port 4000.
8. Wait for the admin Vite server before Electron starts; build frontend assets before packaging; restrict packaged files. Set strict desktop dev ports to avoid Electron connecting to the wrong port.
9. Fix registration requests to use the serving origin or `VITE_API_URL`, with a development API proxy. Add missing Tailwind/PostCSS configuration so production registration styles compile.
10. Load backend `.env` before routes, honor `JWT_SECRET`, validate roles in existing middleware, and send stored tokens from teacher/student HTTP clients. Retain development fallback secrets for compatibility; configure secrets for real use.
11. Keep the backend running if network-interface enumeration is unavailable.
12. Broadcast persisted exam data and launch timestamp. Prevent exam reload/reset on each answer change, use the latest answers for timer submission, parse SQLite timestamps as UTC, and guard against concurrent submission.
13. Repair teacher dependency lock synchronization, add the registration lockfile, update admin/server locks for added test/startup dependencies, and add integration/migration tests plus current setup instructions.

## Validation

- Dependency installation completed for all five packages. Backend's normal install failed in this container because native extraction tried unsupported ownership changes and the compiler then lacked Node headers. Installed its locked JavaScript dependencies with scripts disabled and extracted the already downloaded official sqlite3 5.1.7 Linux N-API binary without changing file ownership. This workaround affected only ignored local dependencies; SQLite loaded as version 3.44.2. No alternative database driver was introduced.
- Backend starts and responds to health requests; restricted network-interface enumeration no longer crashes startup.
- Four production frontend builds pass. Nonfatal dependency deprecation/module warnings and large student/admin bundles remain.
- Backend regression suite covers schema/USN uniqueness, university/student/teacher registration, USN login, configured secret signing, admin authentication/role rejection, attendance-report SQL, notes/history, MCQ grades, badges, PDF delivery/download above 1 MiB, single code persistence, exam launch timestamp, session ending and preservation of pre-existing data across repeated migration startups.
- Electron version execution passes; full window startup is blocked by the missing X/display server. No desktop UI or Windows installer acceptance claims are made.
- No external compiler, Claude API, screen/video sharing or LibreOffice conversion test was performed. Existing user databases were not supplied and were not modified.

## Proposed major security change — requires owner approval

Preserve all current modules and storage. Add JWT authentication to classroom HTTP routes and Socket.IO handshakes; derive user identity on the server; validate teacher ownership and student enrollment for every room/resource; enforce university ownership for admin actions; reject pending/rejected teacher sessions; hide answer keys from students and enforce exam timing/single submission. Update clients to handle authorization failures and add cross-user/cross-university regression tests. This changes access behavior across the applications and is outside this stabilization patch.

## Windows acceptance checklist

1. Install dependencies, build registration site, set secrets and start all four processes using the README.
2. Register a university; create a department/semester; register and approve a teacher; register a student with a USN. Test login and admin reports.
3. Create a classroom, join from another LAN device, verify attendance, notes, whiteboard, code submission and shared PDF download/profile history.
4. Launch an MCQ exam, answer several questions and confirm answers persist and the timer counts down in India time. Test manual/automatic submission and teacher results. Check tab switching separately because exam state is currently scoped to its tab.
5. Share desktop/video; present PDF and PowerPoint; verify student playback, late joins and stop/disconnect handling.
6. Verify entering/leaving focus mode restores ordinary desktop shortcuts and window closing, then build/install each Windows installer and repeat login/navigation without Vite running.

New product features await the owner's specific instructions.
