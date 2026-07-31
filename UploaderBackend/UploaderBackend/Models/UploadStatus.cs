namespace UploaderBackend.Models
{
    public enum UploadStatus
    {
        Initialized,   
        Uploading,   
        Completed,
        Importing, 
        Finished, 
        Cancelled,  
        Error
    }
}
