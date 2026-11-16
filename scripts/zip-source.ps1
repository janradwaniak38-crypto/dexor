param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Destination
)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourcePath = [System.IO.Path]::GetFullPath($Source).TrimEnd('\', '/')
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) { throw "Source folder not found: $sourcePath" }
New-Item -ItemType Directory -Path (Split-Path -Parent $destinationPath) -Force | Out-Null
if (Test-Path -LiteralPath $destinationPath) { Remove-Item -LiteralPath $destinationPath -Force }
$archive = [System.IO.Compression.ZipFile]::Open($destinationPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -LiteralPath $sourcePath -File -Recurse -Force | ForEach-Object {
    $relative = $_.FullName.Substring($sourcePath.Length).TrimStart('\', '/')
    $segments = $relative -split '[\\/]'
    if ($segments -contains 'node_modules' -or $segments -contains 'release' -or $segments -contains '.git') { return }
    $entryName = $relative.Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $archive.Dispose()
}
