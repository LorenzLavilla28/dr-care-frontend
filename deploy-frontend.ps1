param(
  [string]$Bucket = 'drcare-frontend-prod',
  [string]$DistributionId = '',
  [string]$Alias = 'drcaremedicalgroup.app',
  [string]$ApiUrl = ''
)

$ErrorActionPreference = 'Stop'
$frontendRoot = $PSScriptRoot

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw "AWS CLI was not found."
}

Set-Location $frontendRoot
if (-not $ApiUrl) { $ApiUrl = "https://$Alias" }

npm ci
if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }

$env:VITE_API_URL = $ApiUrl.TrimEnd('/')
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }

if (-not $DistributionId) {
  $DistributionId = aws cloudfront list-distributions `
    --query "DistributionList.Items[?contains(Aliases.Items, '$Alias')].Id | [0]" `
    --output text
  if (-not $DistributionId -or $DistributionId -eq 'None') {
    throw "Could not find the CloudFront distribution for $Alias. Pass -DistributionId explicitly."
  }
}

aws s3 sync (Join-Path $frontendRoot 'dist') "s3://$Bucket" --delete --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'S3 synchronization failed.' }

# The entry document must not be held by a browser after a deployment. It
# points to hashed assets, so a cached index can keep an older workflow UI in
# an existing browser profile even after CloudFront has been invalidated.
aws s3 cp (Join-Path $frontendRoot 'dist\index.html') "s3://$Bucket/index.html" `
  --content-type 'text/html; charset=utf-8' `
  --cache-control 'no-cache, no-store, must-revalidate' `
  --metadata-directive REPLACE `
  --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Frontend cache metadata update failed.' }

$invalidationId = aws cloudfront create-invalidation `
  --distribution-id $DistributionId `
  --paths '/*' `
  --query 'Invalidation.Id' `
  --output text
if ($LASTEXITCODE -ne 0) { throw 'CloudFront invalidation failed.' }

aws cloudfront wait invalidation-completed --distribution-id $DistributionId --id $invalidationId
if ($LASTEXITCODE -ne 0) { throw 'CloudFront invalidation did not complete successfully.' }

$response = Invoke-WebRequest -Uri "https://$Alias/" -UseBasicParsing -TimeoutSec 30
if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
  throw "Public frontend verification returned HTTP $($response.StatusCode)."
}

Write-Host "Frontend deployed to https://$Alias" -ForegroundColor Green
