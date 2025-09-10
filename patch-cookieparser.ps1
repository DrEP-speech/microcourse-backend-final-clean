$ErrorActionPreference = "Stop"
$path = Join-Path $PWD "server.js"
if (!(Test-Path $path)) { throw "server.js not found in $PWD" }

# Read file
$txt = Get-Content -Raw $path

$original = $txt

# ─────────────────────────────────────────────────────────────────────
# Ensure import:  import cookieParser from 'cookie-parser';
# ─────────────────────────────────────────────────────────────────────
if ($txt -notmatch "(?m)^\s*import\s+cookieParser\s+from\s+['""]cookie-parser['""];") {
  if ($txt -match "(?m)^\s*import\s+express\s+from\s+['""]express['""];") {
    $txt = $txt -replace "(?m)(^\s*import\s+express\s+from\s+['""]express['""];\s*)",
      "`$1import cookieParser from 'cookie-parser';`r`n"
  } else {
    $txt = "import cookieParser from 'cookie-parser';`r`n" + $txt
  }
}

# ─────────────────────────────────────────────────────────────────────
# Ensure: const app = express(); followed by app.use(cookieParser());
# and JSON/urlencoded parsers BEFORE routes
# ─────────────────────────────────────────────────────────────────────
$addedCookieParserUse = $false
if ($txt -match "(?m)^\s*const\s+app\s*=\s*express\(\)\s*;") {
  if ($txt -notmatch "(?m)^\s*app\.use\(\s*cookieParser\(\)\s*\)\s*;") {
    $txt = $txt -replace "(?m)^\s*const\s+app\s*=\s*express\(\)\s*;",
      "const app = express();`r`napp.use(cookieParser());"
    $addedCookieParserUse = $true
  }
} elseif ($txt -match "(?m)^\s*let\s+app\s*=\s*express\(\)\s*;") {
  if ($txt -notmatch "(?m)^\s*app\.use\(\s*cookieParser\(\)\s*\)\s*;") {
    $txt = $txt -replace "(?m)^\s*let\s+app\s*=\s*express\(\)\s*;",
      "let app = express();`r`napp.use(cookieParser());"
    $addedCookieParserUse = $true
  }
}

# Ensure JSON body parser
if ($txt -notmatch "(?m)^\s*app\.use\(\s*express\.json\(\)\s*\)\s*;") {
  # try to insert after cookieParser() if we just added it
  if ($addedCookieParserUse) {
    $txt = $txt -replace "(?m)^\s*app\.use\(\s*cookieParser\(\)\s*\)\s*;",
      "app.use(cookieParser());`r`napp.use(express.json());"
  } else {
    # otherwise, put right after first "app = express()"
    $txt = $txt -replace "(?m)^\s*(const|let)\s+app\s*=\s*express\(\)\s*;",
      "`$0`r`napp.use(express.json());"
  }
}

# Ensure urlencoded body parser
if ($txt -notmatch "(?m)^\s*app\.use\(\s*express\.urlencoded\(\{\s*extended:\s*false\s*\}\)\s*\)\s*;") {
  $txt = $txt -replace "(?m)^\s*app\.use\(\s*express\.json\(\)\s*\)\s*;",
    "app.use(express.json());`r`napp.use(express.urlencoded({ extended: false }));"
}

# Write changes only if modified
if ($txt -ne $original) {
  Set-Content -Encoding UTF8 -Path $path -Value $txt
  Write-Host "✓ server.js patched (cookie-parser + body parsers ensured)."
} else {
  Write-Host "✓ No changes needed (cookie-parser and body parsers already in place)."
}
