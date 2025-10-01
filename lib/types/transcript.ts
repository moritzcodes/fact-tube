/**
 * Transcript Types
 * 
 * Simplified, token-efficient format for AI processing.
 * See TRANSCRIPT_FORMAT.md for full documentation.
 */

/**
 * A single transcript segment with start time and text.
 * Duration and end time are omitted for token efficiency.
 */
export interface TranscriptSegment {
  /** Start time in seconds (float) */
  start: number;
  /** The transcript text for this segment */
  text: string;
}

/**
 * Complete transcript response from the API
 */
export interface TranscriptResponse {
  /** YouTube video ID */
  videoId: string;
  /** Language code (e.g., "en") */
  lang: string;
  /** Array of transcript segments */
  segments: TranscriptSegment[];
  /** Total number of segments */
  totalSegments: number;
}

/**
 * Helper type for segments with calculated duration
 * Use this when you need duration for display or processing
 */
export interface TranscriptSegmentWithDuration extends TranscriptSegment {
  /** Calculated duration (time until next segment starts) */
  duration: number;
}

/**
 * Helper type for segments with calculated end time
 * Use this when you need end time (e.g., for SRT generation)
 */
export interface TranscriptSegmentWithEnd extends TranscriptSegment {
  /** Calculated end time (usually start of next segment) */
  end: number;
}

/**
 * Helper function to add duration to segments
 */
export function addDuration(
  segments: TranscriptSegment[],
  videoDuration?: number
): TranscriptSegmentWithDuration[] {
  return segments.map((seg, i) => ({
    ...seg,
    duration: i < segments.length - 1
      ? segments[i + 1].start - seg.start
      : videoDuration ? videoDuration - seg.start : 0
  }));
}

/**
 * Helper function to add end time to segments
 */
export function addEndTime(
  segments: TranscriptSegment[],
  videoDuration?: number
): TranscriptSegmentWithEnd[] {
  return segments.map((seg, i) => ({
    ...seg,
    end: i < segments.length - 1
      ? segments[i + 1].start
      : videoDuration || seg.start
  }));
}

/**
 * Chunk segments into time-based groups (e.g., for streaming to AI)
 */
export function chunkSegmentsByTime(
  segments: TranscriptSegment[],
  chunkDurationSeconds: number = 60
): TranscriptSegment[][] {
  const chunks: TranscriptSegment[][] = [];
  let currentChunk: TranscriptSegment[] = [];
  let chunkStart = 0;

  for (const segment of segments) {
    if (segment.start - chunkStart > chunkDurationSeconds && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      chunkStart = segment.start;
    }
    currentChunk.push(segment);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

