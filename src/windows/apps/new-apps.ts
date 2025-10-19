getApps();

export function getApps(): Promise<void> {
  // 1. asynchronously run this command:
  // `(New-Object -ComObject Shell.Application).NameSpace('shell:::{4234d49b-0245-4df3-b780-3893943456e1}').Items() | Where-Object { $_.name -like "*$AppName*" }`
  // output format:
  // Application  : System.__ComObject
  // Parent       : System.__ComObject
  // Name         : Python 3.13
  // Path         : PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0!Python
  // GetLink      :
  // GetFolder    :
  // IsLink       : False
  // IsFolder     : False
  // IsFileSystem : False
  // IsBrowsable  : False
  // ModifyDate   : 30/12/1899 00:00:00
  // Size         : 0
  // Type         :
  // 2. get name and path from the output
  // Get-StartApps
  // Get-AppxPackage
  // Get-Process | FT -Autosize
}
