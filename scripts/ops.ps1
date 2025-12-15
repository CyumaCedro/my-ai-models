Param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('view','write','append','git-init','git-status','git-add','git-commit','git-branch','git-log','git-push','git-set-user')]
    [string]$Action,

    [string]$Path,
    [string]$Content,
    [switch]$CreateDirs,
    [string]$Message,
    [string]$Name,
    [string]$Email,
    [string]$Branch,
    [string]$Remote='origin',
    [int]$Limit=20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-WorkspacePath {
    param([string]$p)
    $root = (Get-Location).Path
    if ([string]::IsNullOrWhiteSpace($p)) { return $null }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $p))
    if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path outside workspace: $full"
    }
    return $full
}

function View-File {
    param([string]$p)
    $full = Resolve-WorkspacePath $p
    if (-not (Test-Path -LiteralPath $full)) { throw "Not found: $full" }
    Get-Content -LiteralPath $full -Encoding UTF8
}

function Write-File {
    param([string]$p, [string]$c, [switch]$append, [switch]$createDirs)
    $full = Resolve-WorkspacePath $p
    $dir = Split-Path -Parent $full
    if ($createDirs -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    if ($append) {
        if (-not (Test-Path -LiteralPath $full)) { New-Item -ItemType File -Path $full -Force | Out-Null }
        [System.IO.File]::AppendAllText($full, $c, [System.Text.Encoding]::UTF8)
    }
    else {
        [System.IO.File]::WriteAllText($full, $c, [System.Text.Encoding]::UTF8)
    }
    Write-Output $full
}

function Git-Ensure {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git not available' }
}

switch ($Action) {
    'view' {
        if (-not $Path) { throw 'Path required' }
        View-File -p $Path
    }
    'write' {
        if (-not $Path) { throw 'Path required' }
        if ($null -eq $Content) { throw 'Content required' }
        Write-File -p $Path -c $Content -createDirs:$CreateDirs
    }
    'append' {
        if (-not $Path) { throw 'Path required' }
        if ($null -eq $Content) { throw 'Content required' }
        Write-File -p $Path -c $Content -append -createDirs:$CreateDirs
    }
    'git-init' {
        Git-Ensure
        if (-not (Test-Path -LiteralPath (Join-Path (Get-Location).Path '.git'))) {
            git init | Write-Output
        }
        git rev-parse --is-inside-work-tree | Write-Output
    }
    'git-status' {
        Git-Ensure
        git status --porcelain=v1 --branch | Write-Output
    }
    'git-add' {
        Git-Ensure
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        git add -- "$full" | Write-Output
        git status --porcelain=v1 | Write-Output
    }
    'git-commit' {
        Git-Ensure
        if (-not $Message) { throw 'Message required' }
        git commit -m "$Message" | Write-Output
    }
    'git-branch' {
        Git-Ensure
        if ($Branch) {
            git switch -c "$Branch" | Write-Output
        } else {
            git branch --show-current | Write-Output
            git branch --list | Write-Output
        }
    }
    'git-log' {
        Git-Ensure
        git log --oneline -n $Limit | Write-Output
    }
    'git-push' {
        Git-Ensure
        $b = if ($Branch) { $Branch } else { git branch --show-current } 
        if (-not $b) { throw 'Branch required' }
        git push $Remote "$b" | Write-Output
    }
    'git-set-user' {
        Git-Ensure
        if ($Name) { git config user.name "$Name" | Write-Output }
        if ($Email) { git config user.email "$Email" | Write-Output }
        git config --list | Write-Output
    }
    default { throw "Unknown action: $Action" }
}
