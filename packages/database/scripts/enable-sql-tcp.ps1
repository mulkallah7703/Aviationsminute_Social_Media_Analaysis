$tcpKey = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQLServer\SuperSocketNetLib\Tcp'
$ipAll = "$tcpKey\IPAll"
Set-ItemProperty -Path $tcpKey -Name Enabled -Value 1
Set-ItemProperty -Path $ipAll -Name TcpPort -Value '1433'
Set-ItemProperty -Path $ipAll -Name TcpDynamicPorts -Value ''
Restart-Service -Name 'MSSQL$SQLEXPRESS' -Force
Start-Sleep -Seconds 8
$enabled = (Get-ItemProperty $tcpKey).Enabled
$port = (Get-ItemProperty $ipAll).TcpPort
$state = (Get-Service 'MSSQL$SQLEXPRESS').Status
Write-Output "tcp_enabled=$enabled tcp_port=$port service=$state"
