# Module: Host Application

## Purpose

The Host Application is a WPF desktop wrapper that hosts the ASP.NET Core web application:
- Provides a native Windows application experience
- Manages the ASP.NET Core server lifecycle (start/stop)
- Opens the web app in a browser automatically
- Optional: Can embed WebView2 for in-app browsing
- Simplifies deployment for end users (no need to run `dotnet run`)

**Target:** Windows only (.NET 8.0)

---

## Key Files

### WPF Application

| File | Description |
|------|-------------|
| [App.xaml](../../DndSessionManager.Host/App.xaml) | Application definition |
| [App.xaml.cs](../../DndSessionManager.Host/App.xaml.cs) | Application entry point |
| [MainWindow.xaml](../../DndSessionManager.Host/MainWindow.xaml) | Main window definition |
| [MainWindow.xaml.cs](../../DndSessionManager.Host/MainWindow.xaml.cs) | Main window code-behind |
| [DndSessionManager.Host.csproj](../../DndSessionManager.Host/DndSessionManager.Host.csproj) | Project file |

---

## Architecture

### Hosting ASP.NET Core in WPF

```csharp
public partial class App : Application
{
    private IHost? _host;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Build and start ASP.NET Core host
        _host = Host.CreateDefaultBuilder()
            .ConfigureWebHostDefaults(webBuilder =>
            {
                webBuilder.UseStartup<Startup>();
                webBuilder.UseUrls("http://localhost:5000");
            })
            .Build();

        await _host.StartAsync();

        // Open browser
        Process.Start(new ProcessStartInfo
        {
            FileName = "http://localhost:5000",
            UseShellExecute = true
        });
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        if (_host != null)
        {
            await _host.StopAsync();
            _host.Dispose();
        }

        base.OnExit(e);
    }
}
```

### Lifecycle

```
User launches .exe
    → WPF App.OnStartup()
    → Build ASP.NET Core Host
    → Start server on http://localhost:5000
    → Open browser
    → Show MainWindow (optional tray icon)

User closes app
    → WPF App.OnExit()
    → Stop ASP.NET Core Host
    → Clean up resources
    → Exit application
```

---

## Configuration

### Server Port

Default port is `http://localhost:5000`. To change:

**App.xaml.cs:**
```csharp
webBuilder.UseUrls("http://localhost:8080"); // Change port
```

**Tip:** Make port configurable via settings file:
```csharp
var port = ConfigurationManager.AppSettings["ServerPort"] ?? "5000";
webBuilder.UseUrls($"http://localhost:{port}");
```

---

## Optional Features

### 1. WebView2 Integration (In-App Browser)

**Install Package:**
```bash
dotnet add package Microsoft.Web.WebView2
```

**MainWindow.xaml:**
```xml
<Window x:Class="DndSessionManager.Host.MainWindow"
        xmlns:wv2="clr-namespace:Microsoft.Web.WebView2.Wpf;assembly=Microsoft.Web.WebView2.Wpf">
    <Grid>
        <wv2:WebView2 Name="webView" Source="http://localhost:5000" />
    </Grid>
</Window>
```

**Benefits:**
- Users don't need a separate browser window
- Can control navigation, inject JavaScript
- More integrated user experience

**Drawbacks:**
- Requires WebView2 Runtime (auto-installed on Windows 11, may need download on Windows 10)
- Slightly larger application size

### 2. System Tray Icon

**Install Package:**
```bash
dotnet add package Hardcodet.NotifyIcon.Wpf
```

**MainWindow.xaml:**
```xml
<Window ShowInTaskbar="False" WindowState="Minimized" Visibility="Hidden">
    <tb:TaskbarIcon x:Name="trayIcon"
                    IconSource="icon.ico"
                    ToolTipText="D&D Session Manager"
                    TrayMouseDoubleClick="TrayIcon_DoubleClick">
        <tb:TaskbarIcon.ContextMenu>
            <ContextMenu>
                <MenuItem Header="Open" Click="OpenApp_Click" />
                <Separator />
                <MenuItem Header="Exit" Click="ExitApp_Click" />
            </ContextMenu>
        </tb:TaskbarIcon.ContextMenu>
    </tb:TaskbarIcon>
</Window>
```

**MainWindow.xaml.cs:**
```csharp
private void TrayIcon_DoubleClick(object sender, RoutedEventArgs e)
{
    Process.Start(new ProcessStartInfo
    {
        FileName = "http://localhost:5000",
        UseShellExecute = true
    });
}

private async void ExitApp_Click(object sender, RoutedEventArgs e)
{
    Application.Current.Shutdown();
}
```

### 3. Auto-start on Windows Boot

**Registry Key (HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run):**
```csharp
private void EnableAutoStart()
{
    string exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
    Microsoft.Win32.Registry.SetValue(
        @"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run",
        "DndSessionManager",
        exePath);
}
```

---

## Common Modification Tasks

### Task 1: Change server port

**Files to modify:**

1. **[App.xaml.cs](../../DndSessionManager.Host/App.xaml.cs)**
   ```csharp
   webBuilder.UseUrls("http://localhost:8080"); // Change 5000 to 8080
   ```

2. **Update browser launch URL:**
   ```csharp
   Process.Start(new ProcessStartInfo
   {
       FileName = "http://localhost:8080", // Match port
       UseShellExecute = true
   });
   ```

### Task 2: Add system tray icon

**Files to modify:**

1. **Add NuGet package:**
   ```bash
   dotnet add package Hardcodet.NotifyIcon.Wpf
   ```

2. **Add icon file:** `icon.ico` to project root
3. **Update [MainWindow.xaml](../../DndSessionManager.Host/MainWindow.xaml)** (see Optional Features above)

### Task 3: Embed WebView2

**Files to modify:**

1. **Add NuGet package:**
   ```bash
   dotnet add package Microsoft.Web.WebView2
   ```

2. **Update [MainWindow.xaml](../../DndSessionManager.Host/MainWindow.xaml):**
   ```xml
   <Window>
       <Grid>
           <wv2:WebView2 Name="webView" Source="http://localhost:5000" />
       </Grid>
   </Window>
   ```

3. **[MainWindow.xaml.cs](../../DndSessionManager.Host/MainWindow.xaml.cs):**
   ```csharp
   public MainWindow()
   {
       InitializeComponent();
       InitializeWebView();
   }

   private async void InitializeWebView()
   {
       await webView.EnsureCoreWebView2Async(null);
       webView.CoreWebView2.Navigate("http://localhost:5000");
   }
   ```

---

## Deployment

### Publishing

```bash
cd DndSessionManager.Host
dotnet publish -c Release -r win-x64 --self-contained
```

**Output:** `bin/Release/net8.0-windows/win-x64/publish/`

**Files:**
- `DndSessionManager.Host.exe` - Main executable
- All dependencies (.dll files)
- `DndSessionManager.Web/` - Web application files

### Creating Installer (Optional)

Use tools like:
- **Inno Setup** - Free Windows installer creator
- **WiX Toolset** - MSI installer
- **ClickOnce** - Built-in .NET deployment

**Example: Inno Setup Script**
```iss
[Setup]
AppName=D&D Session Manager
AppVersion=1.0
DefaultDirName={pf}\DndSessionManager
OutputDir=installer

[Files]
Source: "bin\Release\net8.0-windows\win-x64\publish\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{commondesktop}\D&D Session Manager"; Filename: "{app}\DndSessionManager.Host.exe"

[Run]
Filename: "{app}\DndSessionManager.Host.exe"; Description: "Launch D&D Session Manager"; Flags: postinstall nowait
```

---

## Troubleshooting

### Port already in use
**Error:** `Address already in use: http://localhost:5000`

**Solution:** Change port in App.xaml.cs or close application using port 5000

### WebView2 not found
**Error:** `WebView2 Runtime not found`

**Solution:** Install WebView2 Runtime from https://developer.microsoft.com/microsoft-edge/webview2/

### Firewall blocking
**Issue:** Windows Firewall blocks ASP.NET Core

**Solution:** Add firewall rule or run app as administrator (first time only)

---

## Module Dependencies

### Dependencies on other modules:
- **DndSessionManager.Web** → Hosts the entire web application

### Used by:
- End users who want a desktop application experience
