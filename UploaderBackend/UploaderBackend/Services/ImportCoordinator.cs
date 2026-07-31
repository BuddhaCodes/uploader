using System.Collections.Concurrent;
using System.Threading.Channels;
using UploaderBackend.Database;
using UploaderBackend.Models;
using UploaderBackend.Repositories;
using UploaderBackend.Workers;

namespace UploaderBackend.Services
{
    public interface IImportCoordinator
    {
        void StartImport(Guid uploadId, string filePath);
        Task CancelImportAsync(Guid uploadId);
    }

    public class ImportCoordinator : IImportCoordinator
    {
        private readonly string _connectionString;
        private readonly IUploadRepository _repo;
        private readonly ConcurrentDictionary<Guid, CancellationTokenSource> _tokens = new();

        public ImportCoordinator(string connectionString, IUploadRepository repo)
        {
            _connectionString = connectionString;
            _repo = repo;
        }

        public void StartImport(Guid uploadId, string filePath)
        {
            var cts = new CancellationTokenSource();
            _tokens[uploadId] = cts;

            _ = Task.Run(async () =>
            {
                var worker = new CsvImportWorker(_connectionString, _repo);
                try
                {
                    await worker.RunAsync(uploadId, filePath, cts.Token);
                }
                catch (OperationCanceledException)
                {
                    await HandleCancelledAsync(uploadId);
                }
                catch
                {
                  
                }
                finally
                {
                    _tokens.TryRemove(uploadId, out _);
                }
            });
        }

        public async Task CancelImportAsync(Guid uploadId)
        {
            _repo.Update(uploadId, s => s.Status = UploadStatus.Cancelled);
            if (_tokens.TryGetValue(uploadId, out var cts))
            {
                cts.Cancel();
            }
            else
            {
                await HandleCancelledAsync(uploadId);
            }
        }

        private async Task HandleCancelledAsync(Guid uploadId)
        {
            var state = _repo.Get(uploadId);
            if (state?.TableName != null)
            {
                try
                {
                    using var conn = new MySqlConnector.MySqlConnection(_connectionString);
                    await conn.OpenAsync();
                    using var cmd = new MySqlConnector.MySqlCommand(
                        $"DROP TABLE IF EXISTS `{MySqlTableBuilder.Sanitize(state.TableName)}`", conn);
                    await cmd.ExecuteNonQueryAsync();
                }
                catch
                {
                    
                }
            }
        }
    }
}
