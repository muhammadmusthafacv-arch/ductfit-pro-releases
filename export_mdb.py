import subprocess
import json
import os

ps_code = r'''
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
'''

with open("temp_ps_runner.ps1", "w", encoding="utf-8") as f:
    f.write(ps_code)

print("Running 32-bit PowerShell to query MDB...")
res = subprocess.run(
    [r"C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe", "-ExecutionPolicy", "Bypass", "-File", "temp_ps_runner.ps1"],
    capture_output=True,
    text=True,
    encoding="utf-8"
)

if os.path.exists("temp_ps_runner.ps1"):
    os.remove("temp_ps_runner.ps1")

if res.returncode != 0:
    print("PowerShell Error:", res.stderr)
else:
    raw = res.stdout.strip()
    data = json.loads(raw)
    print("Exported tables:")
    for k, v in data.items():
        print(f"  {k}: {len(v)} records")
    scratch_dir = r"C:\Users\STRIX\.gemini\antigravity\brain\61532b17-c012-4298-aa61-dd43f89e1464\scratch"
    os.makedirs(scratch_dir, exist_ok=True)
    target_file = os.path.join(scratch_dir, "fittings_mdb_raw.json")
    with open(target_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Saved to {target_file} successfully! Size: {os.path.getsize(target_file)} bytes")
