using DndSessionManager.Web;
using DndSessionManager.Web.Hubs;
using DndSessionManager.Web.Services;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options =>
{
	options.ListenAnyIP(5000);
});

WebAppStartup.InitializeWebApp(builder);

var app = builder.Build();

WebAppStartup.ConfigureWebApp(app);

app.Run();
