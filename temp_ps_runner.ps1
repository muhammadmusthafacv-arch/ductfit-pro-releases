
$conn = New-Object -ComObject ADODB.Connection
$conn.Open("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=F:\MUSTHAFA\CHD\DUCT SIZER APP\Duct Fitting Database\AshraeDuct.mdb;")

$tables = @("Menu", "System", "Group", "Fitting", "Input")
$data = [ordered]@{}

foreach ($t in $tables) {
    $rs = $conn.Execute("SELECT * FROM [$t]")
    $items = New-Object System.Collections.ArrayList
    $cols = @()
    for ($i=0; $i -lt $rs.Fields.Count; $i++) { $cols += $rs.Fields.Item($i).Name }
    while (-not $rs.EOF) {
        $row = [ordered]@{}
        for ($i=0; $i -lt $rs.Fields.Count; $i++) {
            $val = $rs.Fields.Item($i).Value
            if ($val -is [System.Array]) {
                $row[$cols[$i]] = "[BLOB]"
            } elseif ($null -eq $val -or $val -is [System.DBNull]) {
                $row[$cols[$i]] = $null
            } else {
                $row[$cols[$i]] = $val
            }
        }
        [void]$items.Add($row)
        $rs.MoveNext()
    }
    $rs.Close()
    $data[$t] = $items
}
$conn.Close()

$json = $data | ConvertTo-Json -Depth 5
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::Out.Write($json)
