Param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('view','write','append','ls','mkdir','rm','mv','cp','stat','head','tail','read-range','find','checksum','index','lint-js','format-js','lint-py','format-py','insert-lines','replace-lines','replace-lines-checked','insert-after','git-init','git-status','git-add','git-commit','git-branch','git-log','git-push','git-set-user','git-remote-add','git-remote-set-url','git-remote-list','git-fetch','git-pull','git-diff','git-reset','git-checkout','git-tag','git-stash','git-show','git-clone','git-revert','exec')]
    [string]$Action,

    [string]$Path,
    [string]$Content,
    [switch]$CreateDirs,
    [string]$Message,
    [string]$Name,
    [string]$Email,
    [string]$Branch,
    [string]$Remote='origin',
    [int]$Limit=20,
    [string]$Target,
    [string]$Destination,
    [switch]$Recursive,
    [string]$Filter,
    [int]$Lines=10,
    [int]$Offset=1,
    [string]$Ref,
    [string]$Mode,
    [string]$Url,
    [string]$Tag,
    [string]$StashRef,
    [string]$Op,
    [string]$Exclude,
    [switch]$NoCommit,
    [int]$Count=0,
    [string]$Expected,
    [string]$Anchor,
    [int]$Occurrence=1,
    [switch]$Regex,
    [string]$Cmd,
    [string]$Cwd,
    [int]$Timeout=60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-WorkspacePath {
    param([string]$p)
    $root = (Get-Location).Path
    if ([string]::IsNullOrWhiteSpace($p)) { return $null }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $p))
    $isWin = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)
    $cmp = if ($isWin) { [System.StringComparison]::OrdinalIgnoreCase } else { [System.StringComparison]::Ordinal }
    if (-not $full.StartsWith($root, $cmp)) {
        throw "Path outside workspace: $full"
    }
    return $full
}

function Invoke-Retry {
    param([scriptblock]$sb, [int]$tries=5, [int]$delayMs=200)
    for ($i=0; $i -lt $tries; $i++) {
        try { & $sb; return } catch { if ($i -ge ($tries-1)) { throw } else { Start-Sleep -Milliseconds $delayMs } }
    }
}

function Write-Lines {
    param([string]$p, [string[]]$lines)
    $sw = New-Object System.IO.StreamWriter($p, $false, [System.Text.Encoding]::UTF8, 4096)
    try {
        foreach ($line in $lines) { $sw.WriteLine($line) }
    } finally { $sw.Dispose() }
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
        Invoke-Retry { [System.IO.File]::AppendAllText($full, $c, [System.Text.Encoding]::UTF8) }
    }
    else {
        Invoke-Retry { [System.IO.File]::WriteAllText($full, $c, [System.Text.Encoding]::UTF8) }
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
    'ls' {
        $base = if ($Path) { Resolve-WorkspacePath $Path } else { (Get-Location).Path }
        $items = Get-ChildItem -LiteralPath $base -Force -Recurse:$Recursive -ErrorAction Stop
        if ($Filter) { $items = $items | Where-Object { $_.Name -like $Filter } }
        $items | ForEach-Object { if ($_.PSIsContainer) { "{0}|{1}|{2:O}|{3}" -f $_.FullName, '', $_.LastWriteTime, $_.Mode } else { "{0}|{1}|{2:O}|{3}" -f $_.FullName, $_.Length, $_.LastWriteTime, $_.Mode } }
    }
    'mkdir' {
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        New-Item -ItemType Directory -Path $full -Force | Select-Object -ExpandProperty FullName
    }
    'rm' {
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        Remove-Item -LiteralPath $full -Force -Recurse:$Recursive
        Write-Output $full
    }
    'mv' {
        if (-not $Path -or -not $Target) { throw 'Path and Target required' }
        $src = Resolve-WorkspacePath $Path
        $dst = Resolve-WorkspacePath $Target
        Move-Item -LiteralPath $src -Destination $dst -Force
        Write-Output $dst
    }
    'cp' {
        if (-not $Path -or -not $Destination) { throw 'Path and Destination required' }
        $src = Resolve-WorkspacePath $Path
        $dst = Resolve-WorkspacePath $Destination
        Copy-Item -LiteralPath $src -Destination $dst -Force -Recurse:$Recursive
        Write-Output $dst
    }
    'stat' {
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        $i = Get-Item -LiteralPath $full -ErrorAction Stop
        "{0}|{1}|{2:O}|{3}" -f $i.FullName, $i.Length, $i.LastWriteTime, $i.Mode
    }
    'head' {
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        Get-Content -LiteralPath $full -Encoding UTF8 -TotalCount $Lines
    }
    'tail' {
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        Get-Content -LiteralPath $full -Encoding UTF8 -Tail $Lines
    }
    'read-range' {
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        Get-Content -LiteralPath $full -Encoding UTF8 | Select-Object -Skip ($Offset - 1) -First $Lines
    }
    'find' {
        $base = if ($Path) { Resolve-WorkspacePath $Path } else { (Get-Location).Path }
        if (-not $Filter) { throw 'Filter required' }
        Select-String -Path (Join-Path $base '*') -Pattern $Filter -AllMatches -ErrorAction Stop | ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
    }
    'checksum' {
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        $fs = [System.IO.File]::OpenRead($full)
        try {
            $sha = [System.Security.Cryptography.SHA256]::Create()
            $hash = $sha.ComputeHash($fs)
            ($hash | ForEach-Object { $_.ToString('x2') }) -join ''
        } finally { $fs.Dispose() }
    }
    'index' {
        $base = (Get-Location).Path
        $items = Get-ChildItem -LiteralPath $base -Force -Recurse
        if ($Exclude) { $items = $items | Where-Object { $_.FullName -notmatch $Exclude } }
        $entries = @()
        foreach ($i in $items) {
            if ($i.PSIsContainer) { continue }
            $rel = $i.FullName.Substring($base.Length).TrimStart('\\','/')
            $ext = [System.IO.Path]::GetExtension($i.Name)
            $lang = switch ($ext) { '.js' {'js'} '.ts' {'ts'} '.py' {'py'} '.json' {'json'} '.yml' {'yaml'} '.yaml' {'yaml'} '.md' {'md'} default {'other'} }
            $size = $i.Length
            $mtime = $i.LastWriteTime
            $sha = $null
            try {
                $fs = [System.IO.File]::OpenRead($i.FullName)
                $sha256 = [System.Security.Cryptography.SHA256]::Create()
                $sha = ($sha256.ComputeHash($fs) | ForEach-Object { $_.ToString('x2') }) -join ''
                $fs.Dispose()
            } catch { }
            $lineCount = $null
            try { $lineCount = (Get-Content -LiteralPath $i.FullName -Encoding UTF8).Length } catch { }
            $entries += [pscustomobject]@{ path = $rel; ext = $ext; lang = $lang; size = $size; mtime = $mtime; sha256 = $sha; lines = $lineCount }
        }
        $entries | ConvertTo-Json -Depth 4
    }
    'lint-js' {
        $pkg = Join-Path (Get-Location).Path 'package.json'
        if (-not (Test-Path -LiteralPath $pkg)) { Write-Output 'package.json not found'; break }
        $npm = Get-Command npm -ErrorAction SilentlyContinue
        $npx = Get-Command npx -ErrorAction SilentlyContinue
        if ($npm) { npm run lint 2>&1 | Write-Output }
        elseif ($npx) { npx eslint . 2>&1 | Write-Output }
        else { Write-Output 'node tooling not available' }
    }
    'format-js' {
        $pkg = Join-Path (Get-Location).Path 'package.json'
        $npm = Get-Command npm -ErrorAction SilentlyContinue
        $npx = Get-Command npx -ErrorAction SilentlyContinue
        if ($npm) { npm run format 2>&1 | Write-Output }
        elseif ($npx) { npx prettier --write . 2>&1 | Write-Output }
        else { Write-Output 'node tooling not available' }
    }
    'lint-py' {
        $ruff = Get-Command ruff -ErrorAction SilentlyContinue
        $flake = Get-Command flake8 -ErrorAction SilentlyContinue
        if ($ruff) { ruff . 2>&1 | Write-Output }
        elseif ($flake) { flake8 . 2>&1 | Write-Output }
        else { Write-Output 'python lint tooling not available' }
    }
    'format-py' {
        $black = Get-Command black -ErrorAction SilentlyContinue
        if ($black) { black . 2>&1 | Write-Output } else { Write-Output 'python format tooling not available' }
    }
    'insert-lines' {
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        $arr = @()
        if (Test-Path -LiteralPath $full) { $raw = [System.IO.File]::ReadAllText($full); $arr = if ($raw) { $raw -split '\r?\n' } else { @() } } else { $arr = @() }
        $ins = if ($Content) { $Content -split '\r?\n' } else { @('') }
        $preCount = [Math]::Max(0, $Offset - 1)
        $pre = if ($arr.Length -gt 0 -and $preCount -gt 0) { $arr[0..($preCount-1)] } else { @() }
        $post = if ($arr.Length -ge $preCount) { $arr[$preCount..($arr.Length-1)] } else { @() }
        $new = @()
        $new += $pre
        $new += $ins
        $new += $post
        $vals = [string[]]$new
        Invoke-Retry { Write-Lines -p $full -lines $vals }
        Write-Output $full
    }
    'replace-lines' {
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        if (-not (Test-Path -LiteralPath $full)) { throw 'Not found' }
        $raw = [System.IO.File]::ReadAllText($full)
        $arr = if ($raw) { $raw -split '\r?\n' } else { @() }
        $startIdx = [Math]::Max(0, $Offset - 1)
        $endIdx = [Math]::Min($arr.Length - 1, $startIdx + [Math]::Max(0,$Count) - 1)
        $ins = if ($Content) { $Content -split '\r?\n' } else { @() }
        $pre = if ($startIdx -gt 0) { $arr[0..($startIdx-1)] } else { @() }
        $postStart = $endIdx + 1
        $post = if ($postStart -le ($arr.Length - 1)) { $arr[$postStart..($arr.Length-1)] } else { @() }
        $new = @()
        $new += $pre
        $new += $ins
        $new += $post
        $vals = [string[]]$new
        Invoke-Retry { Write-Lines -p $full -lines $vals }
        Write-Output $full
    }
    'replace-lines-checked' {
        if (-not $Path) { throw 'Path required' }
        $full = Resolve-WorkspacePath $Path
        if (-not (Test-Path -LiteralPath $full)) { throw 'Not found' }
        $raw = [System.IO.File]::ReadAllText($full)
        $arr = if ($raw) { $raw -split '\r?\n' } else { @() }
        $startIdx = [Math]::Max(0, $Offset - 1)
        $endIdx = [Math]::Min($arr.Length - 1, $startIdx + [Math]::Max(0,$Count) - 1)
        $cur = if ($endIdx -ge $startIdx) { $arr[$startIdx..$endIdx] } else { @() }
        $exp = if ($Expected) { $Expected -split '\r?\n' } else { @() }
        if ($cur.Length -ne $exp.Length) { throw 'mismatch' }
        for ($i=0; $i -lt $cur.Length; $i++) { if ($cur[$i] -ne $exp[$i]) { throw 'mismatch' } }
        $ins = if ($Content) { $Content -split '\r?\n' } else { @() }
        $pre = if ($startIdx -gt 0) { $arr[0..($startIdx-1)] } else { @() }
        $postStart = $endIdx + 1
        $post = if ($postStart -le ($arr.Length - 1)) { $arr[$postStart..($arr.Length-1)] } else { @() }
        $new = @()
        $new += $pre
        $new += $ins
        $new += $post
        $vals = [string[]]$new
        Invoke-Retry { Write-Lines -p $full -lines $vals }
        Write-Output $full
    }
    'insert-after' {
        if (-not $Path) { throw 'Path required' }
        if (-not $Anchor) { throw 'Anchor required' }
        $full = Resolve-WorkspacePath $Path
        if (-not (Test-Path -LiteralPath $full)) { throw 'Not found' }
        $raw = [System.IO.File]::ReadAllText($full)
        $arr = if ($raw) { $raw -split '\r?\n' } else { @() }
        $matchIdx = -1
        $count = 0
        for ($i=0; $i -lt $arr.Length; $i++) {
            $line = $arr[$i]
            $isMatch = $false
            if ($Regex) { $isMatch = [regex]::IsMatch($line, $Anchor) }
            else { $isMatch = $line.Contains($Anchor) }
            if ($isMatch) { $count++; if ($count -eq $Occurrence) { $matchIdx = $i; break } }
        }
        if ($matchIdx -lt 0) { throw 'anchor not found' }
        $ins = if ($Content) { $Content -split "`r?`n" } else { @('') }
        $pre = if ($matchIdx -ge 0) { $arr[0..$matchIdx] } else { @() }
        $postStart = $matchIdx + 1
        $post = if ($postStart -le ($arr.Length - 1)) { $arr[$postStart..($arr.Length-1)] } else { @() }
        $new = @()
        $new += $pre
        $new += $ins
        $new += $post
        $vals = [string[]]$new
        Invoke-Retry { Write-Lines -p $full -lines $vals }
        Write-Output $full
    }
    'exec' {
        if (-not $Cmd) { throw 'Cmd required' }
        $wd = if ($Cwd) { Resolve-WorkspacePath $Cwd } else { (Get-Location).Path }
        $exeCmd = Get-Command pwsh -ErrorAction SilentlyContinue
        $exe = if ($exeCmd) { 'pwsh' } else { 'powershell' }
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $exe
        $psi.Arguments = "-NoLogo -NoProfile -Command $Cmd"
        $psi.WorkingDirectory = $wd
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $p = [System.Diagnostics.Process]::Start($psi)
        $ok = $p.WaitForExit($Timeout * 1000)
        if (-not $ok) { $p.Kill(); throw 'timeout' }
        $out = $p.StandardOutput.ReadToEnd()
        $err = $p.StandardError.ReadToEnd()
        Write-Output ("EXIT:{0}" -f $p.ExitCode)
        Write-Output ("STDOUT<<`n{0}`n>>" -f $out)
        Write-Output ("STDERR<<`n{0}`n>>" -f $err)
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
    'git-remote-add' {
        Git-Ensure
        if (-not $Url) { throw 'Url required' }
        git remote add $Remote "$Url" | Write-Output
        git remote -v | Write-Output
    }
    'git-remote-set-url' {
        Git-Ensure
        if (-not $Url) { throw 'Url required' }
        git remote set-url $Remote "$Url" | Write-Output
        git remote -v | Write-Output
    }
    'git-remote-list' {
        Git-Ensure
        git remote -v | Write-Output
    }
    'git-fetch' {
        Git-Ensure
        git fetch $Remote | Write-Output
    }
    'git-pull' {
        Git-Ensure
        $b = if ($Branch) { $Branch } else { git branch --show-current }
        git pull $Remote "$b" | Write-Output
    }
    'git-diff' {
        Git-Ensure
        if ($Path) { $full = Resolve-WorkspacePath $Path; git diff -- "$full" | Write-Output }
        else { git diff | Write-Output }
    }
    'git-reset' {
        Git-Ensure
        if (-not $Ref) { $Ref = 'HEAD' }
        switch ($Mode) {
            'soft' { git reset --soft "$Ref" | Write-Output }
            'mixed' { git reset --mixed "$Ref" | Write-Output }
            'hard' { git reset --hard "$Ref" | Write-Output }
            default { git reset "$Ref" | Write-Output }
        }
    }
    'git-checkout' {
        Git-Ensure
        if (-not $Branch) { throw 'Branch required' }
        git checkout "$Branch" | Write-Output
    }
    'git-tag' {
        Git-Ensure
        if ($Tag -and $Message) { git tag -a "$Tag" -m "$Message" | Write-Output }
        elseif ($Tag) { git tag "$Tag" | Write-Output }
        else { git tag | Write-Output }
    }
    'git-stash' {
        Git-Ensure
        $op = if ($Op) { $Op } else { 'list' }
        switch ($op) {
            'list' { git stash list | Write-Output }
            'save' { if ($Message) { git stash push -m "$Message" | Write-Output } else { git stash push | Write-Output } }
            'apply' { git stash apply "$StashRef" | Write-Output }
            'pop' { git stash pop "$StashRef" | Write-Output }
            default { git stash list | Write-Output }
        }
    }
    'git-show' {
        Git-Ensure
        if (-not $Ref) { throw 'Ref required' }
        git show --oneline --name-only -n 1 "$Ref" | Write-Output
    }
    'git-clone' {
        Git-Ensure
        if (-not $Url) { throw 'Url required' }
        if (-not $Destination) { throw 'Destination required' }
        $dst = Resolve-WorkspacePath $Destination
        git clone "$Url" "$dst" | Write-Output
    }
    'git-revert' {
        Git-Ensure
        if (-not $Ref) { throw 'Ref required' }
        if ($NoCommit) { git revert --no-commit "$Ref" | Write-Output }
        else { git revert "$Ref" | Write-Output }
    }
    default { throw "Unknown action: $Action" }
}
