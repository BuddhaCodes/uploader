using UploaderBackend.Models;
using UploaderBackend.Repositories;

namespace UploaderBackend.Services
{
    public interface IUploadService
    {
        UploadInitResponse InitOrResume(UploadInitRequest request);
        Task<long> AppendChunkAsync(Guid uploadId, long offset, Stream content, CancellationToken ct);
        void Complete(Guid uploadId);
        Task CancelAsync(Guid uploadId);
        UploadStatusResponse? GetStatus(Guid uploadId);
    }

    public class UploadService : IUploadService
    {
        private readonly IUploadRepository _repo;
        private readonly IFileStorageService _fileStorage;
        private readonly IImportCoordinator _coordinator;

        public UploadService(IUploadRepository repo, IFileStorageService fileStorage, IImportCoordinator coordinator)
        {
            _repo = repo;
            _fileStorage = fileStorage;
            _coordinator = coordinator;
        }

        public UploadInitResponse InitOrResume(UploadInitRequest request)
        {
            if (request.ExistingUploadId is Guid existingId)
            {
                var existing = _repo.Get(existingId);
                if (existing != null && existing.Status != UploadStatus.Cancelled)
                {
                    return new UploadInitResponse
                    {
                        UploadId = existingId,
                        OffsetToResumeFrom = _fileStorage.GetCurrentLength(existingId)
                    };
                }
            }

            var uploadId = Guid.NewGuid();
            var filePath = _fileStorage.GetFilePath(uploadId);

            _repo.Create(new UploadState
            {
                UploadId = uploadId,
                FileName = request.FileName,
                TotalBytes = request.TotalBytes,
                FilePath = filePath,
                Status = UploadStatus.Uploading
            });

            _coordinator.StartImport(uploadId, filePath);

            return new UploadInitResponse { UploadId = uploadId, OffsetToResumeFrom = 0 };
        }

        public async Task<long> AppendChunkAsync(Guid uploadId, long offset, Stream content, CancellationToken ct)
        {
            var state = _repo.Get(uploadId) ?? throw new InvalidOperationException("UPLOAD_NOT_FOUND");
            if (state.Status is UploadStatus.Cancelled or UploadStatus.Completed or UploadStatus.Finished)
                throw new InvalidOperationException("UPLOAD_NOT_ACTIVE");

            var newLength = await _fileStorage.AppendChunkAsync(uploadId, offset, content, ct);
            _repo.Update(uploadId, s =>
            {
                s.ReceivedBytes = newLength;
                s.Status = UploadStatus.Uploading;
            });
            return newLength;
        }

        public void Complete(Guid uploadId)
        {
            _repo.Update(uploadId, s => s.Status = UploadStatus.Completed);
        }

        public async Task CancelAsync(Guid uploadId)
        {
            // 1) Primero, cancela/detén el import y ESPERA a que el stream de lectura se cierre.
            await _coordinator.CancelImportAsync(uploadId);

            // 2) Solo después, borra el archivo (con reintentos por si el handle
            //    tarda un instante en liberarse — antivirus, GC, etc.)
            await _fileStorage.DeleteFileWithRetryAsync(uploadId);
        }

        public UploadStatusResponse? GetStatus(Guid uploadId)
        {
            var s = _repo.Get(uploadId);
            if (s == null)
                return null;

            return new UploadStatusResponse
            {
                UploadId = s.UploadId,
                Status = s.Status.ToString(),
                ReceivedBytes = s.ReceivedBytes,
                ProcessedBytes = s.ProcessedBytes,
                TotalBytes = s.TotalBytes,
                RowsInserted = s.RowsInserted,
                TableName = s.TableName,
                ErrorMessage = s.ErrorMessage
            };
        }
    }
}
