using System.Collections.Concurrent;

namespace UploaderBackend.Services
{
    public interface IFileStorageService
    {
        string GetFilePath(Guid uploadId);
        long GetCurrentLength(Guid uploadId);

        Task<long> AppendChunkAsync(Guid uploadId, long offset, Stream chunkContent, CancellationToken ct);
        Task DeleteFileWithRetryAsync(Guid uploadId, int maxAttempts = 5);
        void DeleteFile(Guid uploadId);
    }

    public class FileStorageService : IFileStorageService
    {
        private readonly string _basePath;

        private readonly ConcurrentDictionary<Guid, SemaphoreSlim> _locks = new();

        public FileStorageService(string basePath)
        {
            _basePath = basePath;
            Directory.CreateDirectory(_basePath);
        }

        public string GetFilePath(Guid uploadId) => Path.Combine(_basePath, $"{uploadId:N}.data");


        public async Task DeleteFileWithRetryAsync(Guid uploadId, int maxAttempts = 5)
        {
            var path = GetFilePath(uploadId);
            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    if (File.Exists(path))
                        File.Delete(path);
                    return;
                }
                catch (IOException) when (attempt < maxAttempts)
                {
                    await Task.Delay(150 * attempt);
                }
            }
        }

        public long GetCurrentLength(Guid uploadId)
        {
            var path = GetFilePath(uploadId);
            return File.Exists(path) ? new FileInfo(path).Length : 0;
        }

        public async Task<long> AppendChunkAsync(Guid uploadId, long offset, Stream chunkContent, CancellationToken ct)
        {
            var sem = _locks.GetOrAdd(uploadId, _ => new SemaphoreSlim(1, 1));
            await sem.WaitAsync(ct);
            try
            {
                var path = GetFilePath(uploadId);
                var currentLength = GetCurrentLength(uploadId);

                if (offset != currentLength)
                {
                    throw new InvalidOperationException(
                        $"OFFSET_MISMATCH:{currentLength}");
                }

                using var fs = new FileStream(path, FileMode.OpenOrCreate, FileAccess.Write, FileShare.ReadWrite);
                fs.Seek(offset, SeekOrigin.Begin);
                await chunkContent.CopyToAsync(fs, 81920, ct);
                await fs.FlushAsync(ct);

                return fs.Length;
            }
            finally
            {
                sem.Release();
            }
        }

        public void DeleteFile(Guid uploadId)
        {
            var path = GetFilePath(uploadId);
            if (File.Exists(path))
                File.Delete(path);
            _locks.TryRemove(uploadId, out _);
        }
    }
}