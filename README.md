# MicroCourse LMS Backend

## Quick Start
1) Install deps:
- npm i

2) Create .env:
- copy .env.example .env
- set MONGODB_URI and JWT_SECRET

3) Seed demo data:
- npm run seed

4) Run:
- npm run dev

## Endpoints (base: /api)
- GET /health
- POST /auth/register
- POST /auth/login
- GET /auth/me
- GET /courses
- POST /courses (admin/instructor)
- GET /lessons?courseId=...
- GET /quizzes?lessonId=...
- POST /quizzes/:id/submit
- GET /analytics/student/overview
- GET /notifications/mine
- POST /email/send (admin/instructor)
- GET /email/logs (admin/instructor)
- GET /badges
- GET /badges/mine
