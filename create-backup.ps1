param(
    [string]$SourceDir = "c:\tmp\spotify-bitstream-snippet-playlist-player-oct-10-2026-10-20-06-am",
    [string]$BackupDir = "c:\tmp\spotify-bitstream-snippet-playlist-player-oct-10-2026-10-20-06-am\backups"
)

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$zipPath = Join-Path $BackupDir "spotify-bitstream-backup-$timestamp.zip"
$latestZip = Join-Path $BackupDir "spotify-bitstream-backup-latest.zip"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

$allFiles = Get-ChildItem -Path $SourceDir -Recurse -File | Where-Object {
    $_.FullName -notmatch '\\node_modules(\\|$)' -and
    $_.FullName -notmatch '\\\.git(\\|$)' -and
    $_.FullName -notmatch '\\dist(\\|$)' -and
    $_.FullName -notmatch '\\backups(\\|$)' -and
    $_.FullName -notmatch '\\\.tempmediaStorage(\\|$)'
}

foreach ($file in $allFiles) {
    $relPath = $file.FullName.Substring($SourceDir.Length).TrimStart('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip,
        $file.FullName,
        $relPath,
        [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
}

$zip.Dispose()

Copy-Item -Path $zipPath -Destination $latestZip -Force

# Also save a copy to the persistent brain artifacts directory to keep it safe
$artifactBackupDir = "C:\Users\callm\.gemini\antigravity-ide\brain\e94d1a2e-8ed8-46e6-a601-99d8a91ecfa1"
if (Test-Path $artifactBackupDir) {
    Copy-Item -Path $zipPath -Destination (Join-Path $artifactBackupDir "spotify-bitstream-backup-latest.zip") -Force
}

Write-Host "Backup created successfully!"
Write-Host "Timestamped archive: $zipPath"
Write-Host "Latest archive:      $latestZip"
Write-Host "Archive size:        $([math]::Round((Get-Item $zipPath).Length / 1KB, 2)) KB"
Write-Host "Total files backed up: $($allFiles.Count)"
