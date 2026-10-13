# Stabilize NexClass startup, database migration and classroom flows

Fresh installations could fail USN registration, admin requests used the wrong URL, PDF socket pushes stopped before delivery, code submissions were duplicated, and packaged desktop applications tried to load development servers. This patch repairs those flows while retaining the existing applications, directories and SQLite architecture.

It also corrects registration styling/origin handling, removes broken duplicate WebRTC callbacks, repairs the exam launch timestamp and timer state, loads configured secrets, adds role checks to existing middleware, and updates dependency locks and setup instructions.

Validation: backend integration and migration tests pass; all four frontend production builds pass; backend health/startup and Electron binary execution verified. Desktop windows, Windows installers, screen/video capture and LibreOffice conversion require manual verification because this environment has no graphical display. Native SQLite installation needed a local extraction workaround, documented in PROJECT_REVIEW.md.

Remaining authorization, tenant isolation and exam integrity gaps are documented with a concrete proposal requiring owner approval. No new product feature or architecture redesign is included.
