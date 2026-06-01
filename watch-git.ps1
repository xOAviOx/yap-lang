# watch-git.ps1
# Monitors the repo for file changes, adds, commits, and pushes after a 30‑second interval.

$repoPath = (Resolve-Path .).Path
Set-Location $repoPath

Write-Host "▶️  Watching for changes in $repoPath (push every 30 s, press Ctrl+C to stop)"

$lastPush = Get-Date "01/01/2000"
while ($true) {
    $changed = Get-ChildItem -Recurse -File -Exclude ".git/*" |
               Where-Object { $_.LastWriteTime -gt (Get-Date).AddSeconds(-2) }
    if ($changed) {
        git add -A
        $msg = "Auto‑commit: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        git commit -m "$msg" --quiet
    }

    $now = Get-Date
    if (($now - $lastPush).TotalSeconds -ge 30) {
        git push origin main
        $lastPush = $now
    }

    Start-Sleep -Milliseconds 1000
}
