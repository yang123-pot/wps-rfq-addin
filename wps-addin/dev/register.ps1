param(
    [ValidateSet('Register', 'Unregister')][string]$Action = 'Register',
    [string]$Url = 'http://127.0.0.1:38891/',
    [string]$PublishPath = (Join-Path $env:APPDATA 'kingsoft\wps\jsaddons\publish.xml')
)
$ErrorActionPreference = 'Stop'
$address = [Uri]$Url
if ($address.Scheme -ne 'http' -or $address.Host -ne '127.0.0.1' -or $address.AbsolutePath -ne '/' -or $address.Query -or $address.Fragment -or $address.UserInfo) {
    throw 'Only an HTTP loopback root URL is allowed for development.'
}
$target = [IO.Path]::GetFullPath($PublishPath)
$directory = [IO.Path]::GetDirectoryName($target)
$document = New-Object System.Xml.XmlDocument
$document.XmlResolver = $null
if (Test-Path -LiteralPath $target) {
    $settings = New-Object System.Xml.XmlReaderSettings
    $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [System.Xml.XmlReader]::Create($target, $settings)
    try { $document.Load($reader) } finally { $reader.Close() }
    if ($document.DocumentElement.Name -ne 'jsplugins') { throw 'Unexpected publish.xml root; no changes made.' }
    $backup = $target + '.backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fffffff')
    Copy-Item -LiteralPath $target -Destination $backup -ErrorAction Stop
} else {
    if ($Action -eq 'Unregister') { Write-Output 'No registration exists.'; exit 0 }
    [void]$document.AppendChild($document.CreateElement('jsplugins'))
}
$nodes = @($document.DocumentElement.SelectNodes("jspluginonline[@name='WpsRfqAddin']"))
foreach ($node in $nodes) { [void]$document.DocumentElement.RemoveChild($node) }
if ($Action -eq 'Register') {
    $plugin = $document.CreateElement('jspluginonline')
    $attributes = @{ name='WpsRfqAddin'; type='et'; url=$Url; debug=''; enable='enable_dev'; install='null'; customDomain='' }
    foreach ($key in $attributes.Keys) { $plugin.SetAttribute($key, $attributes[$key]) }
    [void]$document.DocumentElement.AppendChild($plugin)
}
[void][IO.Directory]::CreateDirectory($directory)
$temporary = $target + '.writing-' + [Guid]::NewGuid().ToString('N')
$xmlSettings = New-Object System.Xml.XmlWriterSettings
$xmlSettings.Indent = $true
$xmlSettings.Encoding = New-Object System.Text.UTF8Encoding($false)
$writer = [System.Xml.XmlWriter]::Create($temporary, $xmlSettings)
try { $document.Save($writer) } finally { $writer.Close() }
if ([IO.File]::Exists($target)) { [IO.File]::Replace($temporary, $target, [System.Management.Automation.Language.NullString]::Value) }
else { [IO.File]::Move($temporary, $target) }
Write-Output ($Action + ' complete: ' + $target)
