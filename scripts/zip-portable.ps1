param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Destination
)
$sourcePath = [System.IO.Path]::GetFullPath($Source)
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) { throw "Portable app folder not found: $sourcePath" }
$destinationDir = Split-Path -Parent $destinationPath
New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
if (Test-Path -LiteralPath $destinationPath) { Remove-Item -LiteralPath $destinationPath -Force }
Compress-Archive -Path (Join-Path $sourcePath '*') -DestinationPath $destinationPath -CompressionLevel Optimal
