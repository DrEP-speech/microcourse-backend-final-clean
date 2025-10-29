# Scaffold-Schemas.ps1
# Creates/updates JSON Schemas for MicroCourse in backend/schemas

$ErrorActionPreference = "Stop"

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function Write-Json {
  param(
    [string]$Path,
    [string]$Content
  )
  $dir = Split-Path $Path -Parent
  Ensure-Dir $dir
  $Content | Set-Content -Path $Path -Encoding UTF8
  Write-Host "Wrote $Path"
}

$schemasRoot = "backend/schemas"
Ensure-Dir $schemasRoot

# -------------------------
# user.schema.json
# -------------------------
$user = @'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://microcourse.ai/schemas/user.json",
  "type": "object",
  "required": ["email", "name", "role"],
  "properties": {
    "_id": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "name": { "type": "string", "minLength": 1 },
    "role": { "enum": ["student", "instructor", "parent", "admin"] },
    "avatarUrl": { "type": "string" },
    "badges": { "type": "array", "items": { "type": "string" } },
    "settings": {
      "type": "object",
      "properties": {
        "locale": { "type": "string" },
        "timezone": { "type": "string" },
        "notificationsEnabled": { "type": "boolean" }
      },
      "additionalProperties": false
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
    "deletedAt": { "type": ["string", "null"], "format": "date-time" }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/user.schema.json" $user

# -------------------------
# course.schema.json
# -------------------------
$course = @'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://microcourse.ai/schemas/course.json",
  "type": "object",
  "required": ["title", "instructorId", "published"],
  "properties": {
    "_id": { "type": "string" },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "language": { "type": "string" },
    "level": { "enum": ["beginner","intermediate","advanced"] },
    "tags": { "type": "array", "items": { "type": "string" } },
    "coverImage": { "type": "string" },
    "instructorId": { "type": "string" },
    "lessons": { "type": "array", "items": { "type": "string" } },
    "published": { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/course.schema.json" $course

# -------------------------
# lesson.schema.json
# -------------------------
$lesson = @'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://microcourse.ai/schemas/lesson.json",
  "type": "object",
  "required": ["courseId","title","order"],
  "properties": {
    "_id": { "type": "string" },
    "courseId": { "type": "string" },
    "title": { "type": "string" },
    "videoUrl": { "type": "string" },
    "content": { "type": "string" },
    "resources": { "type": "array", "items": { "type": "string" } },
    "durationSec": { "type": "number" },
    "order": { "type": "number" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/lesson.schema.json" $lesson

# -------------------------
# quiz.schema.json
# -------------------------
$quiz = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/quiz.json",
  "type":"object",
  "required":["title","questions"],
  "properties": {
    "_id": { "type":"string" },
    "courseId": { "type":"string" },
    "title": { "type":"string" },
    "questions": {
      "type":"array",
      "items": {
        "type":"object",
        "required":["prompt","type"],
        "properties": {
          "_id": { "type":"string" },
          "prompt": { "type":"string" },
          "type": { "enum":["single","multi","truefalse","short","numeric"] },
          "options": {
            "type":"array",
            "items": {
              "type":"object",
              "required":["id","text"],
              "properties": {
                "id": { "type":"string" },
                "text": { "type":"string" },
                "correct": { "type":"boolean" }
              }
            }
          },
          "points": { "type":"number" },
          "explanation": { "type":"string" }
        }
      }
    },
    "settings": {
      "type":"object",
      "properties": {
        "timeLimitSec": { "type":"number" },
        "shuffle": { "type":"boolean" },
        "attempts": { "type":"number" }
      }
    },
    "createdAt": { "type":"string", "format":"date-time" },
    "updatedAt": { "type":"string", "format":"date-time" }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/quiz.schema.json" $quiz

# -------------------------
# quizResult.schema.json
# -------------------------
$quizResult = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/quizResult.json",
  "type":"object",
  "required":["quizId","userId","score","percentage","correctCount","totalCount","startedAt","submittedAt"],
  "properties": {
    "_id": { "type":"string" },
    "quizId": { "type":"string" },
    "userId": { "type":"string" },
    "score": { "type":"number" },
    "percentage": { "type":"number" },
    "correctCount": { "type":"number" },
    "totalCount": { "type":"number" },
    "startedAt": { "type":"string", "format":"date-time" },
    "submittedAt": { "type":"string", "format":"date-time" },
    "breakdown": {
      "type":"array",
      "items": {
        "type":"object",
        "properties": {
          "questionId": { "type":"string" },
          "correct": { "type":"boolean" },
          "selected": { "type":"array", "items": { "type":"string" } }
        }
      }
    },
    "aiSummaryId": { "type":"string" }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/quizResult.schema.json" $quizResult

# -------------------------
# notification.schema.json
# -------------------------
$notification = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/notification.json",
  "type":"object",
  "required":["userId","type","message","read","createdAt"],
  "properties": {
    "_id": { "type":"string" },
    "userId": { "type":"string" },
    "type": { "type":"string" },
    "message": { "type":"string" },
    "read": { "type":"boolean" },
    "createdAt": { "type":"string","format":"date-time" },
    "meta": {}
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/notification.schema.json" $notification

# -------------------------
# emailLog.schema.json
# -------------------------
$emailLog = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/emailLog.json",
  "type":"object",
  "required":["to","subject","success","createdAt"],
  "properties": {
    "_id": { "type":"string" },
    "to": { "type":"array", "items": { "type":"string","format":"email" } },
    "cc": { "type":"array", "items": { "type":"string","format":"email" } },
    "bcc": { "type":"array", "items": { "type":"string","format":"email" } },
    "subject": { "type":"string" },
    "template": { "type":"string" },
    "payload": {},
    "success": { "type":"boolean" },
    "errorMsg": { "type":"string" },
    "type": { "enum":["results","insights","reminder","system"] },
    "createdAt": { "type":"string","format":"date-time" }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/emailLog.schema.json" $emailLog

# -------------------------
# badge.schema.json
# -------------------------
$badge = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/badge.json",
  "type":"object",
  "required":["code","name"],
  "properties": {
    "_id": { "type":"string" },
    "code": { "type":"string" },
    "name": { "type":"string" },
    "description": { "type":"string" },
    "icon": { "type":"string" },
    "criteria": {},
    "createdAt": { "type":"string","format":"date-time" }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/badge.schema.json" $badge

# -------------------------
# goal.schema.json
# -------------------------
$goal = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/goal.json",
  "type":"object",
  "required":["userId","title","status"],
  "properties": {
    "_id": { "type":"string" },
    "userId": { "type":"string" },
    "title": { "type":"string" },
    "description": { "type":"string" },
    "status": { "enum":["active","completed","paused"] },
    "progress": { "type":"number" },
    "createdAt": { "type":"string","format":"date-time" },
    "updatedAt": { "type":"string","format":"date-time" }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/goal.schema.json" $goal

# -------------------------
# session.schema.json
# -------------------------
$session = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/session.json",
  "type":"object",
  "required":["userId","startsAt","endsAt","status"],
  "properties": {
    "_id": { "type":"string" },
    "therapistId": { "type":"string" },
    "userId": { "type":"string" },
    "childId": { "type":"string" },
    "startsAt": { "type":"string","format":"date-time" },
    "endsAt": { "type":"string","format":"date-time" },
    "status": { "enum":["scheduled","completed","cancelled"] },
    "notes": { "type":"string" },
    "zoomLink": { "type":"string" },
    "consentId": { "type":"string" },
    "auditLogIds": { "type":"array", "items": { "type":"string" } },
    "tags": { "type":"array", "items": { "type":"string" } }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/session.schema.json" $session

# -------------------------
# telehealthConsent.schema.json
# -------------------------
$telehealthConsent = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/telehealthConsent.json",
  "type":"object",
  "required":["userId","signedAt","signerName"],
  "properties": {
    "_id": { "type":"string" },
    "userId": { "type":"string" },
    "sessionId": { "type":"string" },
    "signedAt": { "type":"string","format":"date-time" },
    "signerName": { "type":"string" },
    "signerRole": { "type":"string" },
    "pdfUrl": { "type":"string" },
    "metadata": {}
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/telehealthConsent.schema.json" $telehealthConsent

# -------------------------
# auditLog.schema.json
# -------------------------
$auditLog = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/auditLog.json",
  "type":"object",
  "required":["entity","entityId","action","ts"],
  "properties": {
    "_id": { "type":"string" },
    "entity": { "type":"string" },
    "entityId": { "type":"string" },
    "actorId": { "type":"string" },
    "action": { "type":"string" },
    "ts": { "type":"string","format":"date-time" },
    "details": {},
    "severity": { "enum":["info","warning","critical"] }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/auditLog.schema.json" $auditLog

# -------------------------
# message.schema.json
# -------------------------
$message = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/message.json",
  "type":"object",
  "required":["threadId","fromId","toIds","body","createdAt"],
  "properties": {
    "_id": { "type":"string" },
    "threadId": { "type":"string" },
    "fromId": { "type":"string" },
    "toIds": { "type":"array", "items": { "type":"string" } },
    "body": { "type":"string" },
    "attachments": { "type":"array", "items": { "type":"string" } },
    "createdAt": { "type":"string","format":"date-time" }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/message.schema.json" $message

# -------------------------
# checkIn.schema.json
# -------------------------
$checkIn = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/checkIn.json",
  "type":"object",
  "required":["childId","parentId","scheduledFor","status"],
  "properties": {
    "_id": { "type":"string" },
    "childId": { "type":"string" },
    "parentId": { "type":"string" },
    "scheduledFor": { "type":"string","format":"date-time" },
    "status": { "enum":["scheduled","done","no_show"] },
    "notes": { "type":"string" },
    "createdAt": { "type":"string","format":"date-time" }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/checkIn.schema.json" $checkIn

# -------------------------
# parentAIFeedback.schema.json
# -------------------------
$parentAIFeedback = @'
{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://microcourse.ai/schemas/parentAIFeedback.json",
  "type":"object",
  "required":["childId","createdAt","feedback"],
  "properties": {
    "_id": { "type":"string" },
    "childId": { "type":"string" },
    "createdAt": { "type":"string","format":"date-time" },
    "feedback": { "type":"string" },
    "insights": { "type":"array", "items": { "type":"string" } }
  },
  "additionalProperties": false
}
'@
Write-Json "$schemasRoot/parentAIFeedback.schema.json" $parentAIFeedback

Write-Host "`nAll schemas written to $schemasRoot ✅"
