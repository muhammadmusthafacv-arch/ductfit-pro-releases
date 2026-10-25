
 = New-Object -ComObject ADODB.Connection
.Open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=F:\MUSTHAFA\CHD\DUCT SIZER APP\Duct Fitting Database\AshraeDuct.mdb;')
 = .OpenSchema(20)
while (-not .EOF) {
    if (.Fields.Item('TABLE_TYPE').Value -eq 'TABLE') {
        Write-Output .Fields.Item('TABLE_NAME').Value
    }
    .MoveNext()
}
.Close()
