$ErrorActionPreference = "Stop"

Write-Host "Logging in..."
$loginResp = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -ContentType "application/json" -Body '{"username": "testuser", "password": "password123"}'
$token = $loginResp.access_token
$userId = $loginResp.user.id
Write-Host "Token received. Requesting verification..."

$reqResp = Invoke-RestMethod -Uri "http://localhost:3000/auth/request-verification" -Method Post -Headers @{Authorization="Bearer $token"}
Write-Host "Request verification response:"
$reqResp | Out-String | Write-Host

Write-Host "Fetching code from Redis for user $userId..."
$redisCode = (docker exec ella3eba-redis redis-cli GET "verify_email:$userId").Trim()
Write-Host "Code retrieved: $redisCode"

Write-Host "Verifying email..."
$verifyBody = "{ `"code`": `"$redisCode`" }"
$verifyResp = Invoke-RestMethod -Uri "http://localhost:3000/auth/verify-email" -Method Post -Headers @{Authorization="Bearer $token"} -ContentType "application/json" -Body $verifyBody
Write-Host "Verify email response:"
$verifyResp | Out-String | Write-Host

Write-Host "Checking if user isVerified in DB..."
$dbUser = npx prisma studio --browser none # not the best way...
