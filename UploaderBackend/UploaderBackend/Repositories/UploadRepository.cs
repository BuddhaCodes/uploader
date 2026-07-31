using System.Collections.Concurrent;
using UploaderBackend.Models;

namespace UploaderBackend.Repositories
{
    public interface IUploadRepository
    {
        UploadState Create(UploadState state);
        UploadState? Get(Guid uploadId);
        void Update(Guid uploadId, Action<UploadState> mutate);
        void Remove(Guid uploadId);
    }

    public class UploadRepository : IUploadRepository
    {
        private readonly ConcurrentDictionary<Guid, UploadState> _states = new();
        private readonly object _lock = new();

        public UploadState Create(UploadState state)
        {
            _states[state.UploadId] = state;
            return state;
        }

        public UploadState? Get(Guid uploadId)
        {
            _states.TryGetValue(uploadId, out var state);
            return state;
        }

        public void Update(Guid uploadId, Action<UploadState> mutate)
        {
            lock (_lock)
            {
                if (_states.TryGetValue(uploadId, out var state))
                {
                    mutate(state);
                    state.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        public void Remove(Guid uploadId)
        {
            _states.TryRemove(uploadId, out _);
        }
    }
}
