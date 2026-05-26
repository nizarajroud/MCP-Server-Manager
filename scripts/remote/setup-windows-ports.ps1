# MCP Remote Deployment — Windows Port Setup
# Run this script as Administrator on the target Windows machine.
# It reads machine.env (same directory) and creates portproxy + firewall rules.
#
# Usage: .\setup-windows-ports.ps1
# To remove: .\setup-windows-ports.ps1 -Remove

param([switch]$Remove)

# Load config from machine.env
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $scriptDir "machine.env"

if (-not (Test-Path $envFile)) {
    Write-Error "machine.env not found at $envFile"
    exit 1
}

$config = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+)$') {
        $config[$Matches[1]] = $Matches[2].Trim()
    }
}

$wslIP = $config["WSL_IP"]
$basePort = [int]$config["BASE_PORT"]
$portCount = [int]$config["PORT_COUNT"]
$machineName = $config["MACHINE_NAME"]
$sshPort = [int]$config["SSH_PORT"]
$endPort = $basePort + $portCount - 1

Write-Host "=== MCP Port Setup for $machineName ===" -ForegroundColor Cyan
Write-Host "WSL IP: $wslIP"
Write-Host "Ports: $basePort - $endPort ($portCount ports)"
Write-Host ""

if ($Remove) {
    Write-Host "Removing rules..." -ForegroundColor Yellow

    # Remove portproxy
    for ($port = $basePort; $port -le $endPort; $port++) {
        netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null
    }
    netsh interface portproxy delete v4tov4 listenport=$sshPort listenaddress=0.0.0.0 2>$null

    # Remove firewall rule
    Remove-NetFirewallRule -DisplayName "WSL MCP Servers ($machineName)" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "WSL SSH ($machineName)" -ErrorAction SilentlyContinue

    Write-Host "Done. All rules removed." -ForegroundColor Green
    exit 0
}

Write-Host "Creating portproxy rules..." -ForegroundColor Yellow

# SSH portproxy
netsh interface portproxy add v4tov4 listenport=$sshPort listenaddress=0.0.0.0 connectport=22 connectaddress=$wslIP
Write-Host "  SSH: 0.0.0.0:$sshPort -> ${wslIP}:22"

# MCP ports portproxy
for ($port = $basePort; $port -le $endPort; $port++) {
    netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIP
    Write-Host "  MCP: 0.0.0.0:$port -> ${wslIP}:$port"
}

Write-Host ""
Write-Host "Creating firewall rules..." -ForegroundColor Yellow

# Firewall — SSH
New-NetFirewallRule -DisplayName "WSL SSH ($machineName)" -Direction Inbound -Protocol TCP -LocalPort $sshPort -Action Allow -ErrorAction SilentlyContinue | Out-Null
Write-Host "  Firewall: port $sshPort (SSH)"

# Firewall — MCP ports range
New-NetFirewallRule -DisplayName "WSL MCP Servers ($machineName)" -Direction Inbound -Protocol TCP -LocalPort "$basePort-$endPort" -Action Allow -ErrorAction SilentlyContinue | Out-Null
Write-Host "  Firewall: ports $basePort-$endPort (MCP)"

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Verify with: netsh interface portproxy show all"
