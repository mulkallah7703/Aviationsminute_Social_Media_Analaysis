Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Output 'Read-only SQL Server verification (sqlcmd, Windows authentication).'
Write-Output 'No INSERT/UPDATE/DELETE/DDL is executed.'

$query = @"
SET NOCOUNT ON;
SELECT DB_NAME() AS DatabaseName;
SELECT COUNT(*) AS PlatformCount FROM social.Platforms;
SELECT PlatformId, PlatformCode, PlatformName, IsActive FROM social.Platforms ORDER BY PlatformId;
"@

sqlcmd -S "localhost\SQLEXPRESS" -E -C -d DigitalSocialMedia -W -s "|" -Q $query
if ($LASTEXITCODE -ne 0) {
  throw "sqlcmd verification failed with exit code $LASTEXITCODE"
}

Write-Output 'Read-only verification completed.'
