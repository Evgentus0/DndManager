using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Windows;
using System.Windows.Media;
using DndSessionManager.Web.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

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

			// Parse port from UI
			if (!int.TryParse(PortTextBox.Text, out int port) || port < 1 || port > 65535)
			{
				MessageBox.Show("Please enter a valid port number (1-65535).", "Invalid Port", MessageBoxButton.OK, MessageBoxImage.Warning);
				return;
			}

			// Get local IP address
			string localIp = GetLocalIPAddress();
			string url = $"http://{localIp}:{port}";

			// Create the web application with proper options
			var currentDir = CurrentDir();
			AddMessage($"Current project path: {currentDir}");

			if (!Directory.Exists(currentDir))
			{
				throw new DirectoryNotFoundException($"Current project directory not found: {currentDir}");
			}

			var wwwrootPath = Path.Combine(currentDir, "wwwroot");
			AddMessage($"wwwroot path: {wwwrootPath}");

			var options = new WebApplicationOptions
			{
				ContentRootPath = currentDir,
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

			Web.WebAppStartup.InitializeWebApp(builder);

			AddMessage("Building web application...");
			_webApp = builder.Build();

			// Configure middleware
			AddMessage("Configuring middleware...");
			Web.WebAppStartup.ConfigureWebApp(_webApp);

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
			PortTextBox.IsReadOnly = true;
			PortTextBox.Background = new SolidColorBrush(Color.FromRgb(240, 240, 240));

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
				try
				{
					_webApp.Services.GetRequiredService<SessionService>().ShutdownAllSessions();
				}
				catch {}

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
			PortTextBox.IsReadOnly = false;
			PortTextBox.Background = new SolidColorBrush(Colors.White);

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

	private string CurrentDir()
	{
		// For single-file publish, use ProcessPath to get the actual exe directory
		// AppDomain.CurrentDomain.BaseDirectory points to temp extraction folder in single-file mode
		var exePath = Environment.ProcessPath ?? AppDomain.CurrentDomain.BaseDirectory;
		var currentDir = Path.GetDirectoryName(exePath) ?? AppDomain.CurrentDomain.BaseDirectory;

		if (currentDir != null)
		{
			return currentDir;
		}

		throw new DirectoryNotFoundException("Could not find application directory.");
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
