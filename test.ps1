$apps = . .\new-get-apps.ps1 | ConvertFrom-Json
$total = $apps.Count
$withIcons = @($apps | Where-Object { -not [string]::IsNullOrWhiteSpace($_.icon) }).Count
$pct = [math]::Round(($withIcons / $total) * 100, 1)
Write-Host "Total: $total | With Icons: $withIcons ($pct%)" -ForegroundColor $(if ($pct -ge 99) { 'Green' } else { 'Red' })

