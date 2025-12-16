Param(
    [int]$Port=5050
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Clear()
$isWin = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)
if ($isWin) {
    $p = "http://localhost:$Port/"
    $listener.Prefixes.Add($p)
}
else {
    $added = $false
    foreach ($p in @("http://*:$Port/", "http://0.0.0.0:$Port/", "http://localhost:$Port/")) {
        try { $listener.Prefixes.Add($p); $added = $true; break } catch { }
    }
    if (-not $added) { throw "Failed to bind any prefixes on port $Port" }
}
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
            'ls' {
                if ($method -ne 'GET') { throw 'Method not allowed' }
                $p = $req.QueryString['path']
                $f = $req.QueryString['filter']
                $rec = [bool]($req.QueryString['recursive'])
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action ls -Path $p -Filter $f -Recursive:$rec 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'index' {
                $exc = $req.QueryString['exclude']
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action index -Exclude $exc 2>&1
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
            'apply-blocks' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $raw = if ($b.search_replace_blocks) { [System.Text.Encoding]::UTF8.GetBytes([string]$b.search_replace_blocks) } else { $null }
                $b64 = if ($raw) { [System.Convert]::ToBase64String($raw) } else { $null }
                $out = & $script -Action 'apply-blocks' -Path $b.path -BlocksBase64 $b64 -Mode $b.mode 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'insert-lines' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action insert-lines -Path $b.path -Offset ([int]$b.offset) -Content $b.content 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'replace-lines' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action replace-lines -Path $b.path -Offset ([int]$b.offset) -Count ([int]$b.count) -Content $b.content 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'replace-lines-checked' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action replace-lines-checked -Path $b.path -Offset ([int]$b.offset) -Count ([int]$b.count) -Expected $b.expected -Content $b.content 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'insert-after' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action insert-after -Path $b.path -Anchor $b.anchor -Occurrence ([int]$b.occurrence) -Regex:$([bool]$b.regex) -Content $b.content 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'lint/js' {
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action lint-js 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'format/js' {
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action format-js 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'lint/py' {
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action lint-py 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'format/py' {
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action format-py 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'mkdir' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action mkdir -Path $b.path 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'rm' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action rm -Path $b.path -Recursive:$([bool]$b.recursive) 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'mv' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action mv -Path $b.path -Target $b.target 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'cp' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action cp -Path $b.path -Destination $b.destination -Recursive:$([bool]$b.recursive) 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'stat' {
                if ($method -ne 'GET') { throw 'Method not allowed' }
                $p = $req.QueryString['path']
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action stat -Path $p 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'head' {
                if ($method -ne 'GET') { throw 'Method not allowed' }
                $p = $req.QueryString['path']
                $n = $req.QueryString['lines']; if (-not $n) { $n = 10 } else { $n = [int]$n }
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action head -Path $p -Lines $n 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'tail' {
                if ($method -ne 'GET') { throw 'Method not allowed' }
                $p = $req.QueryString['path']
                $n = $req.QueryString['lines']; if (-not $n) { $n = 10 } else { $n = [int]$n }
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action tail -Path $p -Lines $n 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'read-range' {
                if ($method -ne 'GET') { throw 'Method not allowed' }
                $p = $req.QueryString['path']
                $o = $req.QueryString['offset']; if (-not $o) { $o = 1 } else { $o = [int]$o }
                $n = $req.QueryString['lines']; if (-not $n) { $n = 10 } else { $n = [int]$n }
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action 'read-range' -Path $p -Offset $o -Lines $n 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'find' {
                if ($method -ne 'GET') { throw 'Method not allowed' }
                $p = $req.QueryString['path']
                $f = $req.QueryString['filter']
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action find -Path $p -Filter $f 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'checksum' {
                if ($method -ne 'GET') { throw 'Method not allowed' }
                $p = $req.QueryString['path']
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action checksum -Path $p 2>&1
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
            'git/remote/add' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-remote-add -Remote $b.remote -Url $b.url 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/remote/set-url' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-remote-set-url -Remote $b.remote -Url $b.url 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/remote/list' {
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-remote-list 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/fetch' {
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-fetch -Remote ($req.QueryString['remote']) 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/pull' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-pull -Remote ($b.remote) -Branch ($b.branch) 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/diff' {
                $p = $req.QueryString['path']
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                if ($p) { $out = & $script -Action git-diff -Path $p 2>&1 } else { $out = & $script -Action git-diff 2>&1 }
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/reset' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-reset -Mode $b.mode -Ref $b.ref 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/checkout' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-checkout -Branch $b.branch 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/tag' {
                if ($method -eq 'POST') {
                    $b = Read-BodyJson $req
                    $script = Join-Path $PSScriptRoot 'ops.ps1'
                    $out = & $script -Action git-tag -Tag $b.tag -Message $b.message 2>&1
                } else {
                    $script = Join-Path $PSScriptRoot 'ops.ps1'
                    $out = & $script -Action git-tag 2>&1
                }
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/stash' {
                if ($method -eq 'POST') {
                    $b = Read-BodyJson $req
                    $script = Join-Path $PSScriptRoot 'ops.ps1'
                    $out = & $script -Action git-stash -Op $b.op -Message $b.message -StashRef $b.ref 2>&1
                } else {
                    $script = Join-Path $PSScriptRoot 'ops.ps1'
                    $out = & $script -Action git-stash 2>&1
                }
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/show' {
                $ref = $req.QueryString['ref']
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-show -Ref $ref 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'git/clone' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-clone -Url $b.url -Destination $b.destination 2>&1
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
            'git/revert' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action git-revert -Ref $b.ref -NoCommit:$([bool]$b.noCommit) 2>&1
                Write-Json -response $res -obj @{ success = $true; data = ($out -join "`n") }
            }
            'exec' {
                if ($method -ne 'POST') { throw 'Method not allowed' }
                $b = Read-BodyJson $req
                $script = Join-Path $PSScriptRoot 'ops.ps1'
                $out = & $script -Action exec -Cmd $b.command -Cwd $b.cwd -Timeout ([int]$b.timeoutSec) 2>&1
                $text = ($out -join "`n")
                $exit = 0
                $mExit = [regex]::Match($text, 'EXIT:(-?\d+)')
                if ($mExit.Success) { $exit = [int]$mExit.Groups[1].Value }
                $mStdOut = [regex]::Match($text, 'STDOUT<<\n([\s\S]*?)\n>>')
                $mStdErr = [regex]::Match($text, 'STDERR<<\n([\s\S]*?)\n>>')
                $stdout = if ($mStdOut.Success) { $mStdOut.Groups[1].Value } else { '' }
                $stderr = if ($mStdErr.Success) { $mStdErr.Groups[1].Value } else { '' }
                Write-Json -response $res -obj @{ success = $true; exit = $exit; stdout = $stdout; stderr = $stderr }
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
