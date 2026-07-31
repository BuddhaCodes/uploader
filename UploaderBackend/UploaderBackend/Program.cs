using UploaderBackend.Repositories;
using UploaderBackend.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

const string CorsPolicy = "UploaderFront";
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
    {
        policy
            .SetIsOriginAllowed(_ => true)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var uploadsPath = builder.Configuration["UploadsPath"] ?? "/data/uploads";
var mysqlConnectionString = builder.Configuration.GetConnectionString("MySql")
    ?? throw new InvalidOperationException("Falta ConnectionStrings:MySql en appsettings.json");

builder.Services.AddSingleton<IUploadRepository, UploadRepository>();
builder.Services.AddSingleton<IFileStorageService>(_ => new FileStorageService(uploadsPath));
builder.Services.AddSingleton<IImportCoordinator>(sp =>
    new ImportCoordinator(mysqlConnectionString, sp.GetRequiredService<IUploadRepository>()));
builder.Services.AddScoped<IUploadService, UploadService>();

// Necesario para poder leer Request.Body como stream crudo en el endpoint de chunk
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = long.MaxValue;
});

var app = builder.Build();
app.UseCors(CorsPolicy);
app.MapControllers();
app.Run();

