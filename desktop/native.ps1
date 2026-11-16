param(
  [Parameter(Mandatory=$true, Position=0)][string]$Action,
  [Parameter(Position=1)][int]$X = -1,
  [Parameter(Position=2)][int]$Y = -1,
  [Parameter(Position=3)][string]$Value = ""
)

$source = @'
using System;
using System.Runtime.InteropServices;
public static class DexorInput {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extraInfo);
}
'@
Add-Type -TypeDefinition $source -ErrorAction Stop

$mouse = @{
  left = @(0x0002, 0x0004)
  right = @(0x0008, 0x0010)
  middle = @(0x0020, 0x0040)
}
$vk = @{
  SPACE = 0x20; ENTER = 0x0D; TAB = 0x09; ESC = 0x1B; BACKSPACE = 0x08
  SHIFT = 0x10; CTRL = 0x11; ALT = 0x12; UP = 0x26; DOWN = 0x28; LEFT = 0x25; RIGHT = 0x27
}

switch ($Action) {
  "Click" {
    $button = $Value.ToLowerInvariant()
    if (-not $mouse.ContainsKey($button)) { throw "Unsupported mouse button." }
    if ($X -ge 0 -and $Y -ge 0) { [void][DexorInput]::SetCursorPos($X, $Y) }
    [DexorInput]::mouse_event([uint32]$mouse[$button][0], 0, 0, 0, [UIntPtr]::Zero)
    [DexorInput]::mouse_event([uint32]$mouse[$button][1], 0, 0, 0, [UIntPtr]::Zero)
  }
  "MouseDown" {
    $button = $Value.ToLowerInvariant()
    if (-not $mouse.ContainsKey($button)) { throw "Unsupported mouse button." }
    if ($X -ge 0 -and $Y -ge 0) { [void][DexorInput]::SetCursorPos($X, $Y) }
    [DexorInput]::mouse_event([uint32]$mouse[$button][0], 0, 0, 0, [UIntPtr]::Zero)
  }
  "MouseUp" {
    $button = $Value.ToLowerInvariant()
    if (-not $mouse.ContainsKey($button)) { throw "Unsupported mouse button." }
    if ($X -ge 0 -and $Y -ge 0) { [void][DexorInput]::SetCursorPos($X, $Y) }
    [DexorInput]::mouse_event([uint32]$mouse[$button][1], 0, 0, 0, [UIntPtr]::Zero)
  }
  "Key" {
    $key = $Value.ToUpperInvariant()
    if ($key -match '^[A-Z0-9]$') { $code = [byte][char]$key }
    elseif ($key -match '^F([1-9]|1[0-2])$') { $code = [byte](0x70 + [int]$Matches[1] - 1) }
    elseif ($vk.ContainsKey($key)) { $code = [byte]$vk[$key] }
    else { throw "Unsupported key." }
    [DexorInput]::keybd_event($code, 0, 0, [UIntPtr]::Zero)
    [DexorInput]::keybd_event($code, 0, 0x0002, [UIntPtr]::Zero)
  }
  default { throw "Unsupported action." }
}
