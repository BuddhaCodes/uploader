namespace UploaderBackend.Models
{
    public class UploadInitRequest
    {
        public string FileName { get; set; } = string.Empty;
        public long? TotalBytes { get; set; }

        public System.Guid? ExistingUploadId { get; set; }
    }

    public class UploadInitResponse
    {
        public System.Guid UploadId { get; set; }
        public long OffsetToResumeFrom { get; set; }
    }

    public class UploadStatusResponse
    {
        public System.Guid UploadId { get; set; }
        public string Status { get; set; } = string.Empty;
        public long ReceivedBytes { get; set; }
        public long ProcessedBytes { get; set; }
        public long? TotalBytes { get; set; }
        public long RowsInserted { get; set; }
        public string? TableName { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
