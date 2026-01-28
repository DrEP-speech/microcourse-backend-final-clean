param(
  [string]$Base = "http://localhost:4000/api"
)

function J($obj) { $obj | ConvertTo-Json -Depth 20 }

function PostJson($url, $body, $headers=@{}) {
  irm $url -Method Post -ContentType "application/json" -Headers $headers -Body (J $body)
}

function GetJson($url, $headers=@{}) {
  irm $url -Method Get -Headers $headers
}

Write-Host "== Health ==" -ForegroundColor Cyan
$health = GetJson "$Base/health"
$health | Format-List

# 1) Register Instructor (DEV-only role registration)
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$instEmail = "instructor+$stamp@microcourse.test"
$pw = "Passw0rd!123"

Write-Host "`n== Register Instructor ==" -ForegroundColor Cyan
$regI = PostJson "$Base/auth/register" @{
  name="Instructor $stamp"
  email=$instEmail
  password=$pw
  role="instructor"
}
$regI | Format-List

Write-Host "`n== Login Instructor ==" -ForegroundColor Cyan
$loginI = PostJson "$Base/auth/login" @{ email=$instEmail; password=$pw }
$tokenI = $loginI.token
if (-not $tokenI) { throw "Instructor login did not return token" }
$authI = @{ Authorization = "Bearer $tokenI" }
Write-Host "Instructor token len=$($tokenI.Length)" -ForegroundColor Green

Write-Host "`n== Instructor /me ==" -ForegroundColor Cyan
GetJson "$Base/auth/me" $authI | Format-List

# 2) List Courses
Write-Host "`n== List Courses ==" -ForegroundColor Cyan
$coursesResp = GetJson "$Base/courses"
$courses = $coursesResp.courses
if (-not $courses) { $courses = $coursesResp } # some APIs return array directly
Write-Host ("Courses found: {0}" -f @($courses).Count) -ForegroundColor Green

# 3) Create Course as Instructor (this is where your old E2E died)
Write-Host "`n== Create Course (Instructor) ==" -ForegroundColor Cyan
$courseTitle = "MicroCourse Forge: Use the App Like a Pro (E2E $stamp)"
$courseSlug  = ("use-the-app-like-a-pro-e2e-{0}" -f $stamp)

try {
  $create = PostJson "$Base/courses" @{
    title=$courseTitle
    slug=$courseSlug
    description="Built-in onboarding course created by E2E script."
  } $authI

  $create | Format-List
  Write-Host "Created course via POST $Base/courses" -ForegroundColor Green
}
catch {
  Write-Host "Create course failed. This usually means your course route still requires admin/owner only." -ForegroundColor Yellow
  Write-Host "If so, we will FALL BACK to using the existing seeded course." -ForegroundColor Yellow
}

# 4) Fallback: Use existing seeded onboarding course if creation is forbidden
Write-Host "`n== Resolve Course to Use ==" -ForegroundColor Cyan
$coursesResp2 = GetJson "$Base/courses"
$courses2 = $coursesResp2.courses
if (-not $courses2) { $courses2 = $coursesResp2 }

# prefer the newly created slug if it exists; else use seeded one you already have
$target = @($courses2) | Where-Object { $_.slug -eq $courseSlug } | Select-Object -First 1
if (-not $target) {
  $target = @($courses2) | Where-Object { $_.slug -like "*use-the-app-like-a-pro*" } | Select-Object -First 1
}

if (-not $target) { throw "Could not find any onboarding course to continue." }

Write-Host ("Using course: {0} ({1})" -f $target.title, $target._id) -ForegroundColor Green

Write-Host "`n== DONE (Auth + course creation/selection passed) ==" -ForegroundColor Green
