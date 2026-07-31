using UploaderBackend.Database;
using UploaderBackend.Models;
using UploaderBackend.Parsers;
using UploaderBackend.Repositories;
using UploaderBackend.Services;

namespace UploaderBackend.Workers
{
    public class CsvImportWorker
    {
        private const int BatchSize = 1000;
        private const int ReadBufferSize = 1024 * 1024; // 1 MB por lectura
        private const int PollDelayMs = 300;

        private readonly string _connectionString;
        private readonly IUploadRepository _repo;

        public CsvImportWorker(string connectionString, IUploadRepository repo)
        {
            _connectionString = connectionString;
            _repo = repo;
        }

        public async Task RunAsync(Guid uploadId, string filePath, CancellationToken ct)
        {
            var lineReader = new CsvLineReader();
            var buffer = new byte[ReadBufferSize];
            var batch = new List<string[]>();
            string[]? columns = null;
            string? tableName = null;
            long position = 0;

            try
            {
                while (!File.Exists(filePath))
                {
                    ct.ThrowIfCancellationRequested();
                    var waitingState = _repo.Get(uploadId);
                    if (waitingState == null || waitingState.Status == UploadStatus.Cancelled)
                        return;
                    await Task.Delay(PollDelayMs, ct);
                }

                using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);

                while (true)
                {
                    ct.ThrowIfCancellationRequested();

                    int read = await fs.ReadAsync(buffer, 0, buffer.Length, ct);

                    if (read > 0)
                    {
                        foreach (var line in lineReader.Feed(buffer, read))
                        {
                            if (line.Length == 0)
                                continue;

                            if (columns == null)
                            {
                                columns = CsvParser.Parse(line);
                                tableName = $"import_{uploadId:N}";
                                await MySqlTableBuilder.CreateTableAsync(_connectionString, tableName, columns, ct);
                                _repo.Update(uploadId, s =>
                                {
                                    s.TableName = tableName;
                                    s.Status = UploadStatus.Importing;
                                });
                                continue;
                            }

                            batch.Add(CsvParser.Parse(line));
                            if (batch.Count >= BatchSize)
                            {
                                await BatchInserter.InsertAsync(_connectionString, tableName!, columns, batch, ct);
                                _repo.Update(uploadId, s => s.RowsInserted += batch.Count);
                                batch.Clear();
                            }
                        }

                        position += read;
                        _repo.Update(uploadId, s => s.ProcessedBytes = position);
                    }
                    else
                    {
                        var state = _repo.Get(uploadId);
                        if (state == null)
                            break;

                        if (state.Status == UploadStatus.Completed)
                        {
                            foreach (var line in lineReader.Flush())
                            {
                                if (columns == null)
                                    continue; 
                                batch.Add(CsvParser.Parse(line));
                            }
                            break;
                        }

                        await Task.Delay(PollDelayMs, ct);
                    }
                }

                if (batch.Count > 0 && columns != null && tableName != null)
                {
                    await BatchInserter.InsertAsync(_connectionString, tableName, columns, batch, ct);
                    _repo.Update(uploadId, s => s.RowsInserted += batch.Count);
                }

                _repo.Update(uploadId, s => s.Status = UploadStatus.Finished);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _repo.Update(uploadId, s =>
                {
                    s.Status = UploadStatus.Error;
                    s.ErrorMessage = ex.Message;
                });
                throw;
            }
        }
    }
}
