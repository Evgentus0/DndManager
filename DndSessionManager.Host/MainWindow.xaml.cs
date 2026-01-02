using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Windows;
using System.Windows.Media;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using DndSessionManager.Web.Hubs;
using DndSessionManager.Web.Services;

namespace DndSessionManager.Host;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window
{
    private WebApplication? _webApp;
    private Task? _runTask;
    private bool _isRunning = false;
    private CancellationTokenSource? _cts;

    public MainWindow()
    {
        InitializeComponent();
        AddMessage("Application started. Ready to start server.");
    }

    private void ToggleButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isRunning)
        {
            StopServer();
        }
        else
        {
            StartServer();
        }
    }

    private async void StartServer()
    {
        try
        {
            AddMessage("Starting server...");

            // Get local IP address
            string localIp = GetLocalIPAddress();
            int port = 5008;
            string url = $"http://{localIp}:{port}";

            // Create the web application with proper options
            var webProjectPath = GetWebProjectPath();
            AddMessage($"Web project path: {webProjectPath}");

            if (!Directory.Exists(webProjectPath))
            {
                throw new DirectoryNotFoundException($"Web project directory not found: {webProjectPath}");
            }

            var wwwrootPath = Path.Combine(webProjectPath, "wwwroot");
            AddMessage($"wwwroot path: {wwwrootPath}");

            var options = new WebApplicationOptions
            {
                ContentRootPath = webProjectPath,
                WebRootPath = wwwrootPath
            };

            AddMessage("Creating web application builder...");
            var builder = WebApplication.CreateBuilder(options);

            // Configure Kestrel
            AddMessage("Configuring Kestrel...");
            builder.WebHost.ConfigureKestrel(options =>
            {
                options.ListenAnyIP(port);
            });

            // Add services (similar to Web project's Program.cs) 
            AddMessage("Adding services...");

            // Configure MVC to use the correct application part for controllers
            builder.Services.AddControllersWithViews()
                .AddApplicationPart(typeof(DndSessionManager.Web.Controllers.HomeController).Assembly);

            builder.Services.AddSignalR();
            builder.Services.AddDistributedMemoryCache();
            builder.Services.AddSession(options =>
            {
                options.IdleTimeout = TimeSpan.FromHours(2);
                options.Cookie.HttpOnly = true;
                options.Cookie.IsEssential = true;
            });

            // Register application services
            AddMessage("Registering application services...");
            builder.Services.AddSingleton<SessionService>();
            builder.Services.AddSingleton<UserService>();

            // Enable detailed errors for debugging
            builder.Services.AddRazorPages().AddRazorRuntimeCompilation();

            AddMessage("Building web application...");
            _webApp = builder.Build();

            // Configure middleware
            AddMessage("Configuring middleware...");

            // Enable developer exception page for better error messages
            _webApp.UseDeveloperExceptionPage();

            _webApp.UseStaticFiles();
            _webApp.UseRouting();
            _webApp.UseAuthorization();
            _webApp.UseSession();

            AddMessage("Mapping routes...");
            _webApp.MapControllerRoute(
                name: "default",
                pattern: "{controller=Home}/{action=Index}/{id?}");

            // Map SignalR hub
            AddMessage("Mapping SignalR hub...");
            _webApp.MapHub<LobbyHub>("/lobbyHub");

            // Add health check endpoint
            _webApp.MapGet("/health", () => new { status = "healthy", timestamp = DateTime.UtcNow });

            // Start the server
            AddMessage($"Starting server on port {port}...");
            _cts = new CancellationTokenSource();
            _runTask = _webApp.RunAsync(_cts.Token);

            // Wait a moment to ensure server started
            await Task.Delay(1000);

            AddMessage("Checking if server is responding...");

            // Test localhost
            bool localhostOk = await TestEndpoint($"http://localhost:{port}/health", "Localhost");

            // Test network address
            bool networkOk = await TestEndpoint($"{url}/health", "Network");

            if (!localhostOk && !networkOk)
            {
                throw new Exception("Server started but is not responding to requests. This may indicate a configuration issue.");
            }

            // Update UI
            _isRunning = true;
            StatusText.Text = "Running";
            StatusText.Foreground = new SolidColorBrush(Colors.Green);
            UrlText.Text = $"Local: http://localhost:{port}\nNetwork: {url}";
            ToggleButton.Content = "Stop Server";

            AddMessage($"Server started successfully!");
            AddMessage($"Local access: http://localhost:{port}");
            AddMessage($"Network access: {url}");
            AddMessage($"NOTE: If network access doesn't work, check Windows Firewall.");
            AddMessage($"You may need to allow port {port} through the firewall.");
        }
        catch (Exception ex)
        {
            AddMessage($"ERROR: {ex.Message}");
            AddMessage($"Stack trace: {ex.StackTrace}");
            if (ex.InnerException != null)
            {
                AddMessage($"Inner exception: {ex.InnerException.Message}");
            }
            MessageBox.Show($"Failed to start server:\n\n{ex.Message}\n\nCheck status messages for details.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void StopServer()
    {
        try
        {
            AddMessage("Stopping server...");

            if (_cts != null)
            {
                _cts.Cancel();
            }

            if (_webApp != null)
            {
                await _webApp.StopAsync();
                await _webApp.DisposeAsync();
                _webApp = null;
            }

            if (_runTask != null)
            {
                await _runTask;
                _runTask = null;
            }

            _cts?.Dispose();
            _cts = null;

            // Update UI
            _isRunning = false;
            StatusText.Text = "Stopped";
            StatusText.Foreground = new SolidColorBrush(Colors.Red);
            UrlText.Text = "Not available";
            UsersText.Text = "0";
            LocalHealthText.Text = "Not tested";
            LocalHealthText.Foreground = new SolidColorBrush(Colors.Gray);
            NetworkHealthText.Text = "Not tested";
            NetworkHealthText.Foreground = new SolidColorBrush(Colors.Gray);
            ToggleButton.Content = "Start Server";

            AddMessage("Server stopped.");
        }
        catch (Exception ex)
        {
            AddMessage($"Error stopping server: {ex.Message}");
        }
    }

    private string GetLocalIPAddress()
    {
        try
        {
            var host = Dns.GetHostEntry(Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == AddressFamily.InterNetwork)
                {
                    return ip.ToString();
                }
            }
            return "127.0.0.1";
        }
        catch
        {
            return "127.0.0.1";
        }
    }

    private string GetWebProjectPath()
    {
        // Get the solution directory (assuming Host and Web are in the same solution)
        var currentDir = AppDomain.CurrentDomain.BaseDirectory;
        var solutionDir = Directory.GetParent(currentDir)?.Parent?.Parent?.Parent?.Parent?.FullName;

        if (solutionDir != null)
        {
            var webProjectPath = Path.Combine(solutionDir, "DndSessionManager.Web");
            if (Directory.Exists(webProjectPath))
            {
                return webProjectPath;
            }
        }

        throw new DirectoryNotFoundException("Could not find DndSessionManager.Web project directory.");
    }

    private async Task<bool> TestEndpoint(string url, string name)
    {
        try
        {
            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromSeconds(5);

            AddMessage($"Testing {name}: {url}");
            var response = await httpClient.GetAsync(url);

            if (response.IsSuccessStatusCode)
            {
                AddMessage($"✓ {name} health check: PASSED");
                UpdateHealthStatus(name, true);
                return true;
            }
            else
            {
                AddMessage($"✗ {name} health check: FAILED (Status: {response.StatusCode})");
                UpdateHealthStatus(name, false);
                return false;
            }
        }
        catch (Exception ex)
        {
            AddMessage($"✗ {name} health check: FAILED ({ex.Message})");
            UpdateHealthStatus(name, false);
            return false;
        }
    }

    private void UpdateHealthStatus(string name, bool isHealthy)
    {
        Dispatcher.Invoke(() =>
        {
            if (name.ToLower().Contains("local"))
            {
                LocalHealthText.Text = isHealthy ? "OK" : "FAILED";
                LocalHealthText.Foreground = new SolidColorBrush(isHealthy ? Colors.Green : Colors.Red);
            }
            else if (name.ToLower().Contains("network"))
            {
                NetworkHealthText.Text = isHealthy ? "OK" : "FAILED";
                NetworkHealthText.Foreground = new SolidColorBrush(isHealthy ? Colors.Green : Colors.Red);
            }
        });
    }

    private void AddMessage(string message)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss");
        var newMessage = $"[{timestamp}] {message}\n";

        Dispatcher.Invoke(() =>
        {
            MessagesText.Text += newMessage;
        });
    }

    protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
    {
        if (_isRunning)
        {
            var result = MessageBox.Show(
                "Server is still running. Are you sure you want to exit?",
                "Confirm Exit",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (result == MessageBoxResult.No)
            {
                e.Cancel = true;
                return;
            }

            StopServer();
        }

        base.OnClosing(e);
    }
}