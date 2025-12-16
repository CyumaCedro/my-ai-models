Param(
    [Parameter(Mandatory=$true)]
    [string]$Path,
    [string]$Blocks,
    [string]$BlocksBase64,
    [ValidateSet('strict','append','overwrite')]
    [string]$Mode='strict'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Lines {
    param([string]$p, [string[]]$lines)
    $dir = Split-Path -Parent $p
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    $sw = New-Object System.IO.StreamWriter($p, $false, [System.Text.Encoding]::UTF8, 4096)
    try { foreach ($line in $lines) { $sw.WriteLine($line) } } finally { $sw.Dispose() }
}

function Apply-Blocks {
    param([string]$p, [string]$src, [string]$mode)
    $exists = Test-Path -LiteralPath $p
    $raw = if ($exists) { [System.IO.File]::ReadAllText($p) } else { '' }
    $norm = ($raw -replace '\r\n', "`n")
    $pattern = '<<<<<<< ORIGINAL([\s\S]*?)=======([\s\S]*?)>>>>>>> UPDATED'
    $matches = [regex]::Matches($src, $pattern)
    if ($matches.Count -lt 1) { throw 'no blocks' }
    foreach ($m in $matches) {
        $orig = $m.Groups[1].Value
        $upd = $m.Groups[2].Value
        $origNorm = ($orig -replace '^\r?\n','' -replace '\r?\n$','' -replace '\r\n', "`n")
        $updNorm = ($upd -replace '^\r?\n','' -replace '\r?\n$','' -replace '\r\n', "`n")
        if ($norm.Contains($origNorm)) { $norm = $norm.Replace($origNorm, $updNorm) }
        else {
            if ($exists) {
                switch ($mode) {
                    'overwrite' { $norm = $updNorm }
                    'append' { $norm = if ($norm) { $norm + "`n" + $updNorm } else { $updNorm } }
                    default { throw 'original not found' }
                }
            } else { $norm = $updNorm }
        }
    }
    $lines = [string[]]($norm -split "`n")
    Write-Lines -p $p -lines $lines
    Write-Output $p
}

$src = $null
if ($BlocksBase64) {
    $bytes = [System.Convert]::FromBase64String($BlocksBase64)
    $src = [System.Text.Encoding]::UTF8.GetString($bytes)
} else {
    if (-not $Blocks) { throw 'Blocks required' }
    $src = $Blocks
}

Apply-Blocks -p $Path -src $src -mode $Mode

