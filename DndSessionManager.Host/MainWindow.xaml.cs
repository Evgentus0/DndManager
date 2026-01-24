using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Windows;
using System.Windows.Documents;
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

			// Get all IP addresses
			var allIps = GetAllIPAddresses();
			var primaryIp = allIps.FirstOrDefault(IsPrivateIP) ?? allIps.FirstOrDefault() ?? "127.0.0.1";
			string url = $"http://{primaryIp}:{port}";

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

			// Add firewall rule if needed
			EnsureFirewallRule(port);

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
			UpdateUrlDisplay(port, allIps);
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
			UrlText.Document = new FlowDocument(new Paragraph(new Run("Not available"))) { PagePadding = new Thickness(0) };
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

	private List<string> GetAllIPAddresses()
	{
		var ips = new List<string>();
		try
		{
			var host = Dns.GetHostEntry(Dns.GetHostName());
			foreach (var ip in host.AddressList)
			{
				if (ip.AddressFamily == AddressFamily.InterNetwork && ip.ToString() != "127.0.0.1")
				{
					ips.Add(ip.ToString());
				}
			}
		}
		catch { }
		return ips;
	}

	private bool IsPrivateIP(string ip)
	{
		// Private IP ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
		if (ip.StartsWith("10.")) return true;
		if (ip.StartsWith("192.168.")) return true;
		if (ip.StartsWith("172."))
		{
			var parts = ip.Split('.');
			if (parts.Length >= 2 && int.TryParse(parts[1], out int second))
			{
				return second >= 16 && second <= 31;
			}
		}
		return false;
	}

	private void UpdateUrlDisplay(int port, List<string> ips)
	{
		var paragraph = new Paragraph();

		// Add localhost
		paragraph.Inlines.Add(new Run($"http://localhost:{port}") { Foreground = Brushes.Gray });
		paragraph.Inlines.Add(new LineBreak());

		// Sort IPs: private first, then others
		var sortedIps = ips.OrderByDescending(IsPrivateIP).ToList();

		foreach (var ip in sortedIps)
		{
			var url = $"http://{ip}:{port}";

			if (IsPrivateIP(ip))
			{
				paragraph.Inlines.Add(new Run(url) { FontWeight = FontWeights.Bold });
				paragraph.Inlines.Add(new Run(" (LAN)") { Foreground = Brushes.Green, FontWeight = FontWeights.Bold });
			}
			else
			{
				paragraph.Inlines.Add(new Run(url));
			}

			paragraph.Inlines.Add(new LineBreak());
		}

		UrlText.Document = new FlowDocument(paragraph) { PagePadding = new Thickness(0) };
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

	private void EnsureFirewallRule(int port)
	{
		var ruleName = $"DndSessionManager Port {port}";

		if (!FirewallRuleExists(ruleName))
		{
			AddMessage($"Adding firewall rule for port {port}...");
			AddFirewallRule(ruleName, port);
		}
		else
		{
			AddMessage($"Firewall rule for port {port} already exists");
		}
	}

	private bool FirewallRuleExists(string ruleName)
	{
		try
		{
			var psi = new ProcessStartInfo("netsh", $"advfirewall firewall show rule name=\"{ruleName}\"")
			{
				UseShellExecute = false,
				RedirectStandardOutput = true,
				CreateNoWindow = true
			};

			using var process = Process.Start(psi);
			process?.WaitForExit();
			return process?.ExitCode == 0;
		}
		catch
		{
			return false;
		}
	}

	private void AddFirewallRule(string ruleName, int port)
	{
		try
		{
			var args = $"advfirewall firewall add rule name=\"{ruleName}\" dir=in action=allow protocol=TCP localport={port}";

			var psi = new ProcessStartInfo("netsh", args)
			{
				Verb = "runas",
				UseShellExecute = true,
				CreateNoWindow = true
			};

			var process = Process.Start(psi);
			process?.WaitForExit();

			if (process?.ExitCode == 0)
			{
				AddMessage($"✓ Firewall rule added successfully");
			}
			else
			{
				AddMessage($"⚠ Could not add firewall rule (may need admin rights)");
			}
		}
		catch (Exception ex)
		{
			AddMessage($"⚠ Firewall rule: {ex.Message}");
		}
	}

	private void RemoveFirewallRuleButton_Click(object sender, RoutedEventArgs e)
	{
		if (!int.TryParse(PortTextBox.Text, out int port) || port < 1 || port > 65535)
		{
			MessageBox.Show("Please enter a valid port number (1-65535).", "Invalid Port", MessageBoxButton.OK, MessageBoxImage.Warning);
			return;
		}

		var ruleName = $"DndSessionManager Port {port}";

		if (!FirewallRuleExists(ruleName))
		{
			AddMessage($"No firewall rule exists for port {port}");
			return;
		}

		try
		{
			var args = $"advfirewall firewall delete rule name=\"{ruleName}\"";

			var psi = new ProcessStartInfo("netsh", args)
			{
				Verb = "runas",
				UseShellExecute = true,
				CreateNoWindow = true
			};

			var process = Process.Start(psi);
			process?.WaitForExit();

			if (process?.ExitCode == 0)
			{
				AddMessage($"✓ Firewall rule for port {port} removed");
			}
			else
			{
				AddMessage($"⚠ Could not remove firewall rule");
			}
		}
		catch (Exception ex)
		{
			AddMessage($"⚠ Remove firewall rule: {ex.Message}");
		}
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
