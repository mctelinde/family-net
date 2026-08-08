#Requires -RunAsAdministrator
# Updates the netsh portproxy rule to point at the current WSL IP.
# Run this if the app is returning 502 after a WSL restart.
# Shortcut: right-click → "Run with PowerShell" (will auto-elevate via #Requires).

$wslIp = (wsl -e bash -c 'hostname -I').Trim().Split()[0]
if (-not $wslIp) { Write-Error "Could not get WSL IP — is Ubuntu running?"; exit 1 }

netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=127.0.0.1 | Out-Null
netsh interface portproxy add    v4tov4 listenport=3000 listenaddress=127.0.0.1 connectport=3000 connectaddress=$wslIp

Write-Host "✅ Portproxy updated: 127.0.0.1:3000 → ${wslIp}:3000"
netsh interface portproxy show all
