# À exécuter depuis le compte Windows qui possède le certificat de sauvegarde.
$ErrorActionPreference = 'Stop'
$backupRoot = Join-Path $env:LOCALAPPDATA 'Ludion/Sauvegardes'
$archives = Join-Path $backupRoot 'archives'
$secret = Join-Path $backupRoot 'connexion.cms'
$configuration = Unprotect-CmsMessage -Path $secret | ConvertFrom-Json
$python = Join-Path $backupRoot 'runtime/Scripts/python.exe'
$export = Join-Path $PSScriptRoot 'sauvegarder-ludion.py'

$snapshot = $configuration | ConvertTo-Json -Compress | & $python $export
if ($LASTEXITCODE -ne 0) { throw 'Erreur de lecture du projet Supabase.' }
$data = $snapshot | ConvertFrom-Json
if ($data.version -ne 1 -or $data.date -notmatch '^\d{4}-\d{2}-\d{2}$') {
    throw 'Le fichier exporte est invalide.'
}

$certificate = Get-Item -LiteralPath (Join-Path 'Cert:/CurrentUser/My' $configuration.thumbprint)
$encrypted = Protect-CmsMessage -To $certificate -Content $snapshot
New-Item -Path $archives -ItemType Directory -Force | Out-Null
$name = 'ludion-' + $data.date + '.json.cms'
$archive = Join-Path $archives $name
$partial = Join-Path $archives ([guid]::NewGuid().ToString() + '.partial')
try {
    [IO.File]::WriteAllText($partial, $encrypted)
    if ([IO.File]::Exists($archive)) {
        [IO.File]::Replace($partial, $archive, [System.Management.Automation.Language.NullString]::Value)
    } else {
        [IO.File]::Move($partial, $archive)
    }
} finally {
    if ([IO.File]::Exists($partial)) { [IO.File]::Delete($partial) }
}

$cutoff = ([datetime]::ParseExact($data.date, 'yyyy-MM-dd', $null)).AddDays(-29)
Get-ChildItem -LiteralPath $archives -File -Filter 'ludion-*.json.cms' | ForEach-Object {
    if ($_.Name -match '^ludion-(\d{4}-\d{2}-\d{2})\.json\.cms$' -and
        [datetime]::ParseExact($Matches[1], 'yyyy-MM-dd', $null) -lt $cutoff) {
        Remove-Item -LiteralPath $_.FullName
    }
}

Write-Output "Sauvegarde $($data.date) : $($data.activites.Count) activites."
