# 臻品足道荣辱榜 - GitHub 自动推送监控
# 每5分钟尝试推送一次,成功后自动停止
cd "c:\Users\71486\Desktop\臻品足道荣辱榜"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GitHub 自动推送监控已启动" -ForegroundColor Cyan
Write-Host "  每5分钟尝试一次,成功后自动停止" -ForegroundColor Cyan
Write-Host "  开始时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 尝试推送..."
    git push github main:production 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  推送成功! Railway 将自动部署" -ForegroundColor Green
        Write-Host "  时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "推送成功! 按任意键退出..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        break
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 推送失败,5分钟后重试..." -ForegroundColor Yellow
    }
    Start-Sleep -Seconds 300
}
