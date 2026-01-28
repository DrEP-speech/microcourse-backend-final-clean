function Discover-QuizForCourse {
  param(
    [Parameter(Mandatory=$true)][string]$Base,
    [Parameter(Mandatory=$true)][string]$CourseId,
    [Parameter(Mandatory=$true)][hashtable]$Headers
  )

  Write-Host "[1b] Discover quiz via REAL route: GET /courses/:id/quizzes" -ForegroundColor Yellow

  $url = "$Base/courses/$CourseId/quizzes"
  $resp = Invoke-Api -Method "GET" -Url $url -Headers $Headers

  # Expected: { ok:true, courseId, quizzes:[...] }
  if ($null -eq $resp) { throw "No response from $url" }

  $qid = $null
  if ($resp.PSObject.Properties.Name -contains "quizzes") {
    $arr = $resp.quizzes
    if ($arr -and $arr.Count -gt 0) {
      if ($arr[0].PSObject.Properties.Name -contains "_id") { $qid = [string]$arr[0]._id }
      elseif ($arr[0].PSObject.Properties.Name -contains "id") { $qid = [string]$arr[0].id }
    }
  }

  if (-not $qid) { throw "Course has no quizzes (or response shape unexpected) from $url" }

  Write-Host "[OK] Discovered quizId: $qid" -ForegroundColor Green
  return $qid
}
