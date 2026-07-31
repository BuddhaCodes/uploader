namespace UploaderBackend.Models
{
    public class UploadState
    {
        public Guid UploadId { get; set; }
        public string FileName { get; set; } = string.Empty;

        public string FilePath { get; set; } = string.Empty;

        public long? TotalBytes { get; set; }

        public long ReceivedBytes { get; set; }

        public long ProcessedBytes { get; set; }

        public long RowsInserted { get; set; }

        public string? TableName { get; set; }

        public UploadStatus Status { get; set; } = UploadStatus.Initialized;

        public string? ErrorMessage { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
