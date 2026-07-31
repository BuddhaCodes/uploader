using Microsoft.AspNetCore.Mvc;
using UploaderBackend.Models;
using UploaderBackend.Services;

namespace UploaderBackend.Controllers
{
    [ApiController]
    [Route("api/upload")]
    public class UploadController : ControllerBase
    {
        private readonly IUploadService _uploadService;

        public UploadController(IUploadService uploadService)
        {
            _uploadService = uploadService;
        }

        [HttpPost("init")]
        public ActionResult<UploadInitResponse> Init([FromBody] UploadInitRequest request)
        {
            var response = _uploadService.InitOrResume(request);
            return Ok(response);
        }

        [HttpPut("{uploadId}/chunk")]
        [RequestSizeLimit(20_000_000)] // ~20MB por chunk, ajustar según tamaño de chunk elegido en el cliente
        public async Task<IActionResult> UploadChunk(
            Guid uploadId,
            [FromQuery] long offset,
            CancellationToken ct)
        {
            try
            {
                var newLength = await _uploadService.AppendChunkAsync(uploadId, offset, Request.Body, ct);
                return Ok(new { receivedBytes = newLength });
            }
            catch (InvalidOperationException ex) when (ex.Message.StartsWith("OFFSET_MISMATCH"))
            {
                var correctOffset = long.Parse(ex.Message.Split(':')[1]);
                return Conflict(new { correctOffset });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPost("{uploadId}/complete")]
        public IActionResult Complete(Guid uploadId)
        {
            _uploadService.Complete(uploadId);
            return Ok();
        }

        [HttpPost("{uploadId}/cancel")]
        public async Task<IActionResult> Cancel(Guid uploadId)
        {
            await _uploadService.CancelAsync(uploadId);
            return Ok();
        }

        [HttpGet("{uploadId}/status")]
        public ActionResult<UploadStatusResponse> Status(Guid uploadId)
        {
            var status = _uploadService.GetStatus(uploadId);
            return status == null ? NotFound() : Ok(status);
        }
    }
}
