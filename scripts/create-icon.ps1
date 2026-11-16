Add-Type -AssemblyName System.Drawing
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconDir = Join-Path (Split-Path -Parent $scriptDir) 'desktop'
$bmp = [System.Drawing.Bitmap]::new(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$path = [System.Drawing.Drawing2D.GraphicsPath]::new()
$radius = 46
$path.AddArc(0, 0, $radius, $radius, 180, 90)
$path.AddArc(256 - $radius - 1, 0, $radius, $radius, 270, 90)
$path.AddArc(256 - $radius - 1, 256 - $radius - 1, $radius, $radius, 0, 90)
$path.AddArc(0, 256 - $radius - 1, $radius, $radius, 90, 90)
$path.CloseFigure()
$brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Rectangle]::new(0, 0, 256, 256), [System.Drawing.Color]::FromArgb(185, 159, 255), [System.Drawing.Color]::FromArgb(113, 78, 224), 48)
$graphics.FillPath($brush, $path)
$font = [System.Drawing.Font]::new('Segoe UI', 132, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$format = [System.Drawing.StringFormat]::new()
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$letterBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$graphics.DrawString('D', $font, $letterBrush, [System.Drawing.RectangleF]::new(0, -4, 256, 260), $format)
$bmp.Save((Join-Path $iconDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$stream = [System.IO.File]::Create((Join-Path $iconDir 'icon.ico'))
$icon.Save($stream)
$stream.Dispose()
$graphics.Dispose(); $brush.Dispose(); $letterBrush.Dispose(); $font.Dispose(); $format.Dispose(); $path.Dispose(); $bmp.Dispose()
