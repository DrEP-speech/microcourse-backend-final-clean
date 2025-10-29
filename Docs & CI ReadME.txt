### API Docs
- Browse at **/api/docs** (Swagger UI).
- Edit the spec in `backend/docs/openapi.yaml`.

### CI
- GitHub Actions workflow: `.github/workflows/ci.yml`
- Boots Mongo, seeds data, starts server, hits `/api/healthz`, builds a grading payload from the quiz’s answer key, submits to `/api/results/grade`, and checks the result.
