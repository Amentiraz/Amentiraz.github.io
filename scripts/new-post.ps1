param(
  [Parameter(Position = 0, Mandatory = $true)]
  [string]$Title
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$postsRoot = Join-Path $repoRoot "content\posts"

function Normalize-Segment([string]$Value) {
  $cleaned = $Value.Trim()
  if ([string]::IsNullOrWhiteSpace($cleaned)) {
    throw "Post title cannot be empty."
  }

  $cleaned = $cleaned -replace '[<>:"/\\|?*]', '-'
  $cleaned = $cleaned.Trim().TrimEnd('.')

  if ([string]::IsNullOrWhiteSpace($cleaned)) {
    throw "Post title became empty after removing invalid filename characters."
  }

  return $cleaned
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

$normalized = $Title.Replace('\', '/').Trim()
if ([string]::IsNullOrWhiteSpace($normalized)) {
  throw "Post title cannot be empty."
}

if ($normalized.EndsWith(".md", [System.StringComparison]::OrdinalIgnoreCase)) {
  $normalized = $normalized.Substring(0, $normalized.Length - 3)
}

$parts = @($normalized.Split('/', [System.StringSplitOptions]::RemoveEmptyEntries))
if ($parts.Count -eq 0) {
  throw "Post title cannot be empty."
}

$safeParts = @()
foreach ($part in $parts) {
  $safeParts += Normalize-Segment $part
}

$postName = $safeParts[-1]
$subDirs = @()
if ($safeParts.Count -gt 1) {
  $subDirs = $safeParts[0..($safeParts.Count - 2)]
}

$targetDir = $postsRoot
foreach ($dirPart in $subDirs) {
  $targetDir = Join-Path $targetDir $dirPart
}

$postPath = Join-Path $targetDir "$postName.md"
$assetDir = Join-Path $targetDir $postName

if (Test-Path $postPath) {
  throw "Post already exists: $postPath"
}

if (Test-Path $assetDir) {
  throw "Asset directory already exists: $assetDir"
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
New-Item -ItemType Directory -Path $assetDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$content = @"
---
title: $postName
date: $timestamp
tags:
categories:
---
<!--more-->

"@

Write-Utf8NoBom -Path $postPath -Content $content

Write-Host "Created post:" -ForegroundColor Green
Write-Host "  $postPath"
Write-Host "Created asset directory:" -ForegroundColor Green
Write-Host "  $assetDir"
