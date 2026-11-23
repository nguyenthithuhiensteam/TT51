; Bộ cài "Trường Mầm non Số" cho máy cá nhân (Windows 10/11, 64-bit).
; Cài vào thư mục của người dùng, KHÔNG cần quyền quản trị máy. Dữ liệu ở %LOCALAPPDATA%\TruongMNSo
; được giữ nguyên khi gỡ hoặc cài bản mới.
; Tạo bộ cài (sau khi đóng gói PyInstaller vào desktop\dist\TruongMNSo):
;   "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" desktop\installer.iss

#define AppName "Trường Mầm non Số"
#define AppVersion "1.0.0"
#define AppExe "TruongMNSo.exe"

[Setup]
AppId={{6F1B8C2E-4A57-4E0B-9D3A-7C51E2A9B814}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=Nguyễn Thị Thu Hiền
DefaultDirName={localappdata}\Programs\TruongMNSo
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=Output
OutputBaseFilename=TruongMNSo-CaiDat-{#AppVersion}
SetupIconFile=..\..\ctgdmn-windows-fixed\assets\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes

[Messages]
SetupAppTitle=Cài đặt
SetupWindowTitle=Cài đặt %1
UninstallAppTitle=Gỡ cài đặt
UninstallAppFullTitle=Gỡ cài đặt %1
ButtonBack=< &Quay lại
ButtonNext=&Tiếp tục >
ButtonInstall=&Cài đặt
ButtonOK=Đồng ý
ButtonCancel=Hủy
ButtonYes=&Có
ButtonNo=&Không
ButtonFinish=&Hoàn tất
ButtonBrowse=&Chọn...
ButtonWizardBrowse=C&họn...
ExitSetupTitle=Thoát cài đặt
ExitSetupMessage=Chưa cài đặt xong. Nếu thoát bây giờ, ứng dụng sẽ không được cài.%n%nThoát cài đặt?
WelcomeLabel1=Chào mừng đến với trình cài đặt [name]
WelcomeLabel2=Trình này sẽ cài [name/ver] lên máy tính của bạn.%n%nỨng dụng chạy hoàn toàn trên máy, không cần Internet (trừ khi dùng AI soạn giáo án). Không cần quyền quản trị máy.
WizardSelectDir=Chọn thư mục cài đặt
SelectDirDesc=Cài [name] vào đâu?
SelectDirLabel3=Ứng dụng sẽ được cài vào thư mục dưới đây.
SelectDirBrowseLabel=Bấm Tiếp tục để dùng thư mục này, hoặc Chọn... để chọn thư mục khác.
DiskSpaceGBLabel=Cần ít nhất [gb] GB dung lượng trống.
DiskSpaceMBLabel=Cần ít nhất [mb] MB dung lượng trống.
WizardSelectTasks=Tùy chọn thêm
SelectTasksDesc=Bạn muốn làm thêm việc nào?
SelectTasksLabel2=Chọn các việc cần làm thêm khi cài [name], rồi bấm Tiếp tục.
WizardReady=Sẵn sàng cài đặt
ReadyLabel1=Đã sẵn sàng cài [name] lên máy tính.
ReadyLabel2a=Bấm Cài đặt để bắt đầu, hoặc Quay lại để xem lại lựa chọn.
ReadyLabel2b=Bấm Cài đặt để bắt đầu.
ReadyMemoDir=Thư mục cài đặt:
ReadyMemoTasks=Tùy chọn thêm:
WizardPreparing=Đang chuẩn bị cài đặt
WizardInstalling=Đang cài đặt
InstallingLabel=Vui lòng chờ trong khi [name] được cài lên máy tính.
StatusExtractFiles=Đang chép tệp...
StatusCreateIcons=Đang tạo lối tắt...
StatusUninstalling=Đang gỡ %1...
FinishedHeadingLabel=Đã cài xong [name]
FinishedLabelNoIcons=Đã cài [name] lên máy tính.
FinishedLabel=Đã cài [name] lên máy tính. Mở ứng dụng bằng biểu tượng vừa tạo.
ClickFinish=Bấm Hoàn tất để kết thúc.
ConfirmUninstall=Gỡ %1 khỏi máy?%n%nDữ liệu kế hoạch của bạn (thư mục %%LOCALAPPDATA%%\TruongMNSo) vẫn được giữ lại.
UninstalledAll=Đã gỡ %1 khỏi máy tính.

[CustomMessages]
CreateDesktopIcon=Tạo biểu tượng ngoài &màn hình
AdditionalIcons=Biểu tượng:
LaunchProgram=Mở %1 ngay

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "dist\TruongMNSo\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Chỉ dọn thư mục chương trình; dữ liệu người dùng ở %LOCALAPPDATA%\TruongMNSo được giữ lại.
Type: filesandordirs; Name: "{app}\_internal"
