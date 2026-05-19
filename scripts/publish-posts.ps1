param(
  [Parameter(Position = 0)]
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$lockPath = Join-Path $repoRoot ".git\index.lock"

function Write-Step([string]$Text) {
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Invoke-CheckedCommand([string]$FilePath, [string[]]$Arguments, [string]$FailureMessage) {
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

function Get-GitProcesses() {
  @(Get-Process | Where-Object { $_.ProcessName -match '^git($|-)' })
}

function Clear-StaleGitLock() {
  if (-not (Test-Path $lockPath)) {
    return
  }

  for ($attempt = 0; $attempt -lt 10; $attempt += 1) {
    if ((Get-GitProcesses).Count -eq 0) {
      break
    }
    Start-Sleep -Milliseconds 500
  }

  $activeGit = Get-GitProcesses
  if ($activeGit.Count -gt 0) {
    $ids = ($activeGit | ForEach-Object { $_.Id }) -join ", "
    throw "Git is still running (PID: $ids). Close it and run the command again."
  }

  Remove-Item -LiteralPath $lockPath -Force
}

function Get-OutputText([string]$FilePath, [string[]]$Arguments, [string]$FailureMessage) {
  $output = & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
  return ($output | Out-String).Trim()
}

Set-Location $repoRoot

Write-Step "Checking repository state"
Invoke-CheckedCommand "git" @("-C", $repoRoot, "rev-parse", "--is-inside-work-tree") "This directory is not a git repository."
Clear-StaleGitLock

$postChanges = Get-OutputText "git" @("-C", $repoRoot, "status", "--porcelain", "--", "content/posts") "Unable to inspect post changes."
if ([string]::IsNullOrWhiteSpace($postChanges)) {
  Write-Host "No changes detected under content/posts. Nothing to publish."
  exit 0
}

$stagedChanges = Get-OutputText "git" @("-C", $repoRoot, "diff", "--cached", "--name-only") "Unable to inspect staged changes."
if (-not [string]::IsNullOrWhiteSpace($stagedChanges)) {
  throw "There are already staged changes in this repository. Commit or unstage them before running publish:posts."
}

Write-Step "Building site"
Invoke-CheckedCommand "npm" @("run", "build") "Build failed."

Write-Step "Staging post changes"
Clear-StaleGitLock
Invoke-CheckedCommand "git" @("-C", $repoRoot, "add", "--", "content/posts") "git add failed."

$stagedPosts = Get-OutputText "git" @("-C", $repoRoot, "diff", "--cached", "--name-only", "--", "content/posts") "Unable to inspect staged post changes."
if ([string]::IsNullOrWhiteSpace($stagedPosts)) {
  Write-Host "No staged post changes found after git add. Nothing to commit."
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "Update posts $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

Write-Step "Creating commit"
Invoke-CheckedCommand "git" @("-C", $repoRoot, "commit", "-m", $Message) "git commit failed."

$branch = Get-OutputText "git" @("-C", $repoRoot, "rev-parse", "--abbrev-ref", "HEAD") "Unable to determine the current branch."
if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq "HEAD") {
  throw "Unable to determine a normal branch name for push."
}

Write-Step "Pushing to origin/$branch"
Invoke-CheckedCommand "git" @("-C", $repoRoot, "push", "origin", $branch) "git push failed."

Write-Host "Publish completed successfully." -ForegroundColor Green
