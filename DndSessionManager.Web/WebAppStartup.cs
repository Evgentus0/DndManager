using DndSessionManager.Web.Data;
using DndSessionManager.Web.Hubs;
using DndSessionManager.Web.Services;

namespace DndSessionManager.Web;

public static class WebAppStartup
{
	public static void InitializeWebApp(WebApplicationBuilder builder)
	{
		// Add services to the container.
		builder.Services.AddControllersWithViews()
			.AddApplicationPart(typeof(Controllers.HomeController).Assembly); ;
		builder.Services.AddSignalR();

		// Add session support
		builder.Services.AddDistributedMemoryCache();
		builder.Services.AddSession(options =>
		{
			options.IdleTimeout = TimeSpan.FromHours(2);
			options.Cookie.HttpOnly = true;
			options.Cookie.IsEssential = true;
		});

		// Add memory cache for Handbook
		builder.Services.AddMemoryCache();

		// Register repository (LiteDB)
		builder.Services.AddSingleton<ISessionRepository, LiteDbRepository>();

		// Register application services
		builder.Services.AddScoped<SessionService>();
		builder.Services.AddScoped<UserService>();
		builder.Services.AddScoped<HandbookService>();
		builder.Services.AddScoped<CharacterService>();
		builder.Services.AddScoped<BattleMapService>();

		builder.Services.AddScoped<IHubCallerService, HubCallerService>();

		builder.Services.AddHttpContextAccessor();

		// Enable runtime compilation only in development
		// Runtime compilation doesn't work with single-file publish
		var razorPagesBuilder = builder.Services.AddRazorPages();

#if DEBUG
		razorPagesBuilder.AddRazorRuntimeCompilation();
#endif
	}

	public static void ConfigureWebApp(WebApplication app)
	{
		//if (!app.Environment.IsDevelopment())
		//{
		//	app.UseExceptionHandler("/Home/Error");
		//	app.UseHsts();
		//}

		app.UseDeveloperExceptionPage();

		app.UseStaticFiles();
		app.UseRouting();
		app.UseAuthorization();
		app.UseSession();

		app.MapControllerRoute(
				name: "default",
				pattern: "{controller=Home}/{action=Index}/{id?}");

		app.MapHub<LobbyHub>("/lobbyHub");
		app.MapHub<BrowseHub>("/browseHub");
		app.MapHub<BattleMapHub>("/battleMapHub");

		app.MapGet("/health", () => new { status = "healthy", timestamp = DateTime.UtcNow });
	}
}
