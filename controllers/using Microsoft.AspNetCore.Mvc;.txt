using Microsoft.AspNetCore.Mvc;

public class CreateLessonAssetRequest {
    public string Type { get; set; } = default!;   // "video"
    public string Url { get; set; } = default!;
    public string? Title { get; set; }
    public int? DurationMs { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? JobId { get; set; }
    public string? Provider { get; set; }
    public Dictionary<string,object>? Metadata { get; set; }
}

public class LessonAssetResponse : CreateLessonAssetRequest {
    public string Id { get; set; } = default!;
    public string LessonId { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
}

[ApiController]
[Route("api/lessons/{lessonId}/assets")]
public class LessonAssetsController : ControllerBase
{
    private static readonly List<LessonAssetResponse> _assets = new();

    [HttpPost]
    public ActionResult<LessonAssetResponse> Create(
        string lessonId,
        [FromBody] CreateLessonAssetRequest req)
    {
        if (!string.Equals(req.Type, "video", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(req.Url))
            return BadRequest("Expected { type:\"video\", url }");

        var asset = new LessonAssetResponse {
            Id = "asset_" + Guid.NewGuid().ToString("N")[..8],
            LessonId = lessonId,
            Type = "video",
            Url = req.Url,
            Title = req.Title,
            DurationMs = req.DurationMs,
            ThumbnailUrl = req.ThumbnailUrl,
            JobId = req.JobId,
            Provider = req.Provider,
            Metadata = req.Metadata,
            CreatedAt = DateTime.UtcNow
        };

        _assets.Add(asset);
        return Created(string.Empty, asset);
    }
}
