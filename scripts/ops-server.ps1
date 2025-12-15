Param(
    [int]$Port=5050
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

function Read-BodyJson {
    param($request)
    $sr = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
    $raw = $sr.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    return $raw | ConvertFrom-Json
}

function Write-Json {
    param($response, $obj)
    $json = $obj | ConvertTo-Json -Depth 5
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.ContentType = 'application/json'
    $response.ContentEncoding = [System.Text.Encoding]::UTF8
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.OutputStream.Close()
}

Remove-Item -ErrorAction SilentlyContinue -LiteralPath $null

while ($true) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
        $path = $req.Url.AbsolutePath.Trim('/')
        $method = $req.HttpMethod.ToUpperInvariant()
        switch ($path) {
            'view' {
                if ($method -ne 'GET') { throw 'Method not allowed' }
                $p = $req.QueryString['path']
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action view -Path $p 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'write' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action write -Path $b.path -Content $b.content -CreateDirs:$([bool]$b.createDirs) 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'append' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action append -Path $b.path -Content $b.content -CreateDirs:$([bool]$b.createDirs) 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/init' {
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-init 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/status' {
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-status 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/add' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-add -Path $b.path 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/commit' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-commit -Message $b.message 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/branch' {
                if ($method -eq 'POST') {
                    $b = Read-BodyJson $req
                    $script = Join-Path $PSScriptRoot 'ops.ps1'
                    $out = & $script -Action git-branch -Branch $b.branch 2>&1
                } else {
                    $script = Join-Path $PSScriptRoot 'ops.ps1'
                    $out = & $script -Action git-branch 2>&1
                }
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/log' {
                $limit = $req.QueryString['limit']
                if (-not $limit) { $limit = 20 } else { $limit = [int]$limit }
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-log -Limit $limit 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/push' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $remote = if ($b.remote) { $b.remote } else { 'origin' }
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-push -Remote $remote -Branch $b.branch 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/set-user' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-set-user -Name $b.name -Email $b.email 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            default {
                $res.StatusCode = 404
                Write-Json -response $res -obj @{ success = $false; error = 'not found' }
            }
        }
    }
    catch {
        $res.StatusCode = 500
        Write-Json -response $res -obj @{ success = $false; error = $_.Exception.Message }
    }
}
