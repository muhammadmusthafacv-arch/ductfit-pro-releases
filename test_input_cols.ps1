
 = New-Object -ComObject ADODB.Connection
.Open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=F:\MUSTHAFA\CHD\DUCT SIZER APP\Duct Fitting Database\AshraeDuct.mdb;')
 = .Execute('SELECT TOP 10 * FROM [Input]')
for (=0;  -lt .Fields.Count; ++) {
    Write-Output .Fields.Item().Name
}
.Close()
