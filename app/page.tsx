'use client';

import { trpc } from '@/lib/trpc/react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { chunkSegmentsByTime } from '@/lib/types/transcript';

export default function Home() {
  const [videoInput, setVideoInput] = useState('');
  const [selectedLang, setSelectedLang] = useState('en');
  const [fetchedVideoId, setFetchedVideoId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedChunks, setProcessedChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [extractedClaims, setExtractedClaims] = useState<Array<{
    id: string;
    claim: string;
    speaker?: string | null;
    timestamp: number;
    status: string;
    verdict?: string | null;
    sources?: Array<{ url: string; title?: string }> | string | null;
  }>>([]);
  const [showRecentVideos, setShowRecentVideos] = useState(true);

  // Fetch transcript from YouTube
  const { data: transcript, isLoading: transcriptLoading, error: transcriptError } = 
    trpc.transcripts.fetchFromYouTube.useQuery(
      { videoId: fetchedVideoId!, lang: selectedLang },
      { enabled: !!fetchedVideoId }
    );

  // Fetch video metadata (including description)
  const { data: videoMetadata } =
    trpc.transcripts.getVideoMetadata.useQuery(
      { videoId: fetchedVideoId! },
      { enabled: !!fetchedVideoId }
    );

  // Mutation for extracting claims
  const extractClaimsMutation = trpc.ai.extractClaims.useMutation();
  
  // Get all claims for the current video
  const { data: videoClaims, refetch: refetchClaims } = trpc.claims.getByVideoId.useQuery(
    { videoId: fetchedVideoId! },
    { enabled: !!fetchedVideoId }
  );

  // Get all videos (recent first)
  const { data: recentVideos, refetch: refetchRecentVideos } = trpc.videos.getAll.useQuery();

  // Get video metadata from database
  const { data: dbVideo } = trpc.videos.getById.useQuery(
    { id: fetchedVideoId! },
    { enabled: !!fetchedVideoId }
  );

  // Get transcript segments from database
  const { data: dbTranscriptSegments } = trpc.transcripts.getByVideoId.useQuery(
    { videoId: fetchedVideoId! },
    { enabled: !!fetchedVideoId }
  );

  // Mutations for saving data
  const saveVideoMutation = trpc.videos.upsert.useMutation();
  const saveTranscriptMutation = trpc.transcripts.saveSegments.useMutation();

  const handleFetchTranscript = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoInput.trim()) {
      toast.error('Please enter a YouTube video ID or URL');
      return;
    }
    
    setFetchedVideoId(videoInput.trim());
    setExtractedClaims([]);
    setShowRecentVideos(false);
    toast.info('Fetching transcript...');
  };

  const handleSelectVideo = (videoId: string) => {
    setVideoInput(videoId);
    setFetchedVideoId(videoId);
    setExtractedClaims([]);
    setShowRecentVideos(false);
    toast.info('Loading video...');
  };

  // Save video metadata and transcript to database when fetched
  useEffect(() => {
    const saveToDatabase = async () => {
      if (!transcript || !videoMetadata || !fetchedVideoId) return;

      try {
        // Save video metadata
        await saveVideoMutation.mutateAsync({
          id: fetchedVideoId,
          title: videoMetadata.title,
          description: videoMetadata.description,
          channelName: videoMetadata.channelName,
          duration: videoMetadata.duration,
        });

        // Save transcript segments
        await saveTranscriptMutation.mutateAsync({
          videoId: fetchedVideoId,
          segments: transcript.segments,
        });

        // Refetch recent videos
        await refetchRecentVideos();

        toast.success('Video and transcript saved to database');
      } catch (error) {
        console.error('Error saving to database:', error);
        // Don't show error toast as this is background operation
      }
    };

    saveToDatabase();
  }, [transcript, videoMetadata, fetchedVideoId, saveVideoMutation, saveTranscriptMutation, refetchRecentVideos]);

  // Process transcript segments asynchronously
  const handleProcessSegments = async () => {
    if (!transcript || !fetchedVideoId) {
      toast.error('No transcript to process');
      return;
    }

    setIsProcessing(true);
    setProcessedChunks(0);
    setExtractedClaims([]);
    
    try {
      // Chunk segments into 60-second groups
      const chunks = chunkSegmentsByTime(transcript.segments, 60);
      setTotalChunks(chunks.length);
      
      // Prepare video context
      const videoContext = videoMetadata ? {
        title: videoMetadata.title,
        description: videoMetadata.description,
        channelName: videoMetadata.channelName,
      } : undefined;

      if (videoContext) {
        toast.info(`Processing ${chunks.length} segments with video context...`);
      } else {
        toast.info(`Processing ${chunks.length} segments...`);
      }

      // Process each chunk asynchronously
      const allClaims: Array<{
        id: string;
        claim: string;
        speaker?: string | null;
        timestamp: number;
        status: string;
        verdict?: string | null;
        sources?: Array<{ url: string; title?: string }> | string | null;
      }> = [];
      for (let i = 0; i < chunks.length; i++) {
        try {
          const result = await extractClaimsMutation.mutateAsync({
            videoId: fetchedVideoId,
            segments: chunks[i],
            videoContext,
          });
          
          if (result.claims.length > 0) {
            allClaims.push(...result.claims);
            setExtractedClaims(prev => [...prev, ...result.claims]);
            toast.success(`Chunk ${i + 1}/${chunks.length}: ${result.claimsExtracted} important claims found`);
          } else {
            toast.info(`Chunk ${i + 1}/${chunks.length}: No significant claims`);
          }
          
          setProcessedChunks(i + 1);
        } catch (error) {
          console.error(`Error processing chunk ${i + 1}:`, error);
          toast.error(`Failed to process chunk ${i + 1}`);
        }
      }

      // Refetch all claims from database
      await refetchClaims();
      
      if (allClaims.length > 0) {
        toast.success(`✓ Complete! ${allClaims.length} important fact-checkable claims extracted.`);
      } else {
        toast.info('✓ Processing complete. No significant fact-checkable claims found.');
      }
    } catch (error) {
      console.error('Error processing segments:', error);
      toast.error('Failed to process segments');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTimestamp = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">FactTube - Backend Debugging</h1>

        {/* Recent Videos Section */}
        {showRecentVideos && recentVideos && recentVideos.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Recent Videos</h2>
            <div className="space-y-3">
              {recentVideos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => handleSelectVideo(video.id)}
                  className="w-full text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{video.title || video.id}</h3>
                      {video.channelName && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {video.channelName}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Added: {new Date(video.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        {video.id}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* YouTube Transcript Fetcher */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">YouTube Transcript Fetcher</h2>
          
          <form onSubmit={handleFetchTranscript} className="space-y-4">
            <div>
              <label htmlFor="videoInput" className="block text-sm font-medium mb-2">
                YouTube Video ID or URL
              </label>
              <input
                id="videoInput"
                type="text"
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                placeholder="e.g., dQw4w9WgXcQ or https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Note: Only videos with captions/subtitles enabled will work.{' '}
                <button
                  type="button"
                  onClick={() => setVideoInput('jNQXAC9IVRw')}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Try example video
                </button>
              </p>
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label htmlFor="language" className="block text-sm font-medium mb-2">
                  Language Code
                </label>
                <input
                  id="language"
                  type="text"
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  placeholder="en"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <button
                type="submit"
                disabled={transcriptLoading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {transcriptLoading ? 'Fetching...' : 'Fetch Transcript'}
              </button>
            </div>
          </form>

          {/* Show recent videos button */}
          {!showRecentVideos && recentVideos && recentVideos.length > 0 && (
            <button
              onClick={() => setShowRecentVideos(true)}
              className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back to Recent Videos
            </button>
          )}

          {/* Transcript Results */}
          {transcriptError && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 font-semibold">Error:</p>
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">{transcriptError.message}</p>
            </div>
          )}

          {/* Show stored transcript if available and not fetching new one */}
          {!transcript && dbTranscriptSegments && dbTranscriptSegments.length > 0 && dbVideo && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-purple-700 dark:text-purple-400 font-semibold">
                  ✓ Loaded from database
                </p>
                <div className="text-sm mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <p><strong>Video ID:</strong> {fetchedVideoId}</p>
                  <p><strong>Title:</strong> {dbVideo.title}</p>
                  <p><strong>Channel:</strong> {dbVideo.channelName}</p>
                  <p><strong>Total Segments:</strong> {dbTranscriptSegments.length}</p>
                </div>
              </div>

              {/* Database Transcript Segments */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold">Transcript Segments (from database)</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {dbTranscriptSegments.map((segment) => (
                    <div
                      key={segment.id}
                      className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-20 text-sm font-mono text-gray-600 dark:text-gray-400">
                          {formatTimestamp(segment.startTime)}
                        </div>
                        <div className="flex-1 text-sm">
                          {segment.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {transcript && (
            <div className="mt-6 space-y-4">
              {/* Summary */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-700 dark:text-green-400 font-semibold">
                  ✓ Transcript fetched successfully!
                </p>
                <div className="text-sm mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <p><strong>Video ID:</strong> {transcript.videoId}</p>
                  <p><strong>Language:</strong> {transcript.lang}</p>
                  <p><strong>Total Segments:</strong> {transcript.totalSegments}</p>
                  <p><strong>Last Timestamp:</strong> {formatTimestamp(transcript.segments[transcript.segments.length - 1]?.start || 0)}</p>
                </div>
              </div>

              {/* Transcript Segments */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold">Transcript Segments</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {transcript.segments.map((segment: { start: number; text: string }, index: number) => (
                    <div
                      key={index}
                      className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-20 text-sm font-mono text-gray-600 dark:text-gray-400">
                          {formatTimestamp(segment.start)}
                        </div>
                        <div className="flex-1 text-sm">
                          {segment.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* JSON Preview */}
              <details className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <summary className="cursor-pointer px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium">
                  View Raw JSON
                </summary>
                <pre className="p-4 text-xs overflow-x-auto bg-gray-50 dark:bg-gray-900">
                  {JSON.stringify(transcript, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Video Metadata Display */}
          {videoMetadata && (
            <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <h3 className="font-semibold mb-3 text-purple-900 dark:text-purple-300">Video Context</h3>
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <p><strong>Title:</strong> {videoMetadata.title}</p>
                <p><strong>Channel:</strong> {videoMetadata.channelName}</p>
                {videoMetadata.description && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-purple-700 dark:text-purple-400 hover:underline">
                      View Description
                    </summary>
                    <p className="mt-2 text-xs whitespace-pre-wrap bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
                      {videoMetadata.description}
                    </p>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Process Segments Button */}
          {transcript && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-3">AI Claim Extraction (Improved)</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Use GPT-4o-mini (via OpenRouter) to extract <strong>only important, fact-checkable claims</strong> from the transcript.
                {videoMetadata && ' Video context (title, description, channel) is used for better understanding.'}
                Segments are processed in 60-second chunks asynchronously.
              </p>
              <button
                onClick={handleProcessSegments}
                disabled={isProcessing || !transcript}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {isProcessing 
                  ? `Processing... (${processedChunks}/${totalChunks})` 
                  : 'Extract Claims with AI'}
              </button>
              
              {isProcessing && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(processedChunks / totalChunks) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {processedChunks} of {totalChunks} chunks processed
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Extracted Claims Section */}
        {(extractedClaims.length > 0 || (videoClaims && videoClaims.length > 0)) && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">
                {isProcessing ? 'Claims Being Extracted...' : 'Extracted Claims'}
              </h2>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {(isProcessing ? extractedClaims : (videoClaims || extractedClaims)).length} claims
              </span>
            </div>
            
            <div className="space-y-3">
              {(isProcessing ? extractedClaims : (videoClaims || extractedClaims)).map((claim: {
                id: string;
                claim: string;
                speaker?: string | null;
                timestamp: number;
                status: string;
                verdict?: string | null;
                sources?: Array<{ url: string; title?: string }> | string | null;
              }) => {
                // Parse sources if they exist
                let parsedSources: Array<{ url?: string; title?: string }> = [];
                try {
                  if (claim.sources && typeof claim.sources === 'string') {
                    parsedSources = JSON.parse(claim.sources);
                  } else if (Array.isArray(claim.sources)) {
                    parsedSources = claim.sources;
                  }
                } catch (e) {
                  console.error('Error parsing sources:', e);
                }

                return (
                  <div
                    key={claim.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-20 text-sm font-mono text-blue-600 dark:text-blue-400">
                        {formatTimestamp(claim.timestamp)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">{claim.claim}</p>
                        {claim.speaker && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            Speaker: {claim.speaker}
                          </p>
                        )}
                        
                        {/* Status Badge */}
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            claim.status === 'pending' 
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' 
                              : claim.status === 'verified'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : claim.status === 'false'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : claim.status === 'disputed'
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                          }`}>
                            {claim.status}
                          </span>
                        </div>

                        {/* Verdict/Explanation */}
                        {claim.verdict && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                              Explanation:
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {claim.verdict}
                            </p>
                          </div>
                        )}

                        {/* Sources (show up to 2) */}
                        {parsedSources.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Sources:
                            </p>
                            <div className="space-y-2">
                              {parsedSources.slice(0, 2).map((source: { url?: string; title?: string } | string, idx: number) => (
                                <a
                                  key={idx}
                                  href={typeof source === 'string' ? source : source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="text-blue-600 dark:text-blue-400">🔗</span>
                                    <div className="flex-1 min-w-0">
                                      {typeof source === 'object' && source.title && (
                                        <p className="font-medium text-blue-700 dark:text-blue-300 truncate">
                                          {source.title}
                                        </p>
                                      )}
                                      <p className="text-blue-600 dark:text-blue-400 truncate">
                                        {typeof source === 'string' ? source : (source.url || '')}
                                      </p>
                                    </div>
                                  </div>
                                </a>
                              ))}
                              {parsedSources.length > 2 && (
                                <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                                  +{parsedSources.length - 2} more source{parsedSources.length - 2 > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Routes Reference */}
        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-3">Available tRPC Routes:</h2>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold text-blue-600 dark:text-blue-400">Transcripts:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700 dark:text-gray-300">
                <li><code>transcripts.fetchFromYouTube</code> - Fetch transcript from YouTube</li>
                <li><code>transcripts.getVideoMetadata</code> - Get video metadata (title, description, etc.)</li>
                <li><code>transcripts.saveSegments</code> - Save transcript segments to database (NEW)</li>
                <li><code>transcripts.create</code> - Create transcript segment</li>
                <li><code>transcripts.markProcessed</code> - Mark segment as processed</li>
                <li><code>transcripts.getUnprocessed</code> - Get unprocessed segments</li>
                <li><code>transcripts.getByVideoId</code> - Get all segments for video</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-blue-600 dark:text-blue-400">Videos:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700 dark:text-gray-300">
                <li><code>videos.getById</code> - Get video metadata from database</li>
                <li><code>videos.upsert</code> - Create or update video metadata (now includes description)</li>
                <li><code>videos.getAll</code> - Get all videos (most recent first)</li>
                <li className="text-green-600 dark:text-green-400">✨ Videos automatically saved when transcript is fetched</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-blue-600 dark:text-blue-400">Claims:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700 dark:text-gray-300">
                <li><code>claims.getByVideoId</code> - Get all claims for a video</li>
                <li><code>claims.getById</code> - Get a single claim</li>
                <li><code>claims.create</code> - Create a new claim</li>
                <li><code>claims.updateStatus</code> - Update claim verification status</li>
                <li><code>claims.getByTimeRange</code> - Get claims by time range</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-blue-600 dark:text-blue-400">AI Processing (IMPROVED):</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700 dark:text-gray-300">
                <li><code>ai.extractClaims</code> - Extract important claims with video context (GPT-4o-mini)</li>
                <li><code>ai.extractClaimsBatch</code> - Batch process with selective filtering</li>
                <li className="text-green-600 dark:text-green-400">✨ Now includes video description for better context</li>
                <li className="text-green-600 dark:text-green-400">✨ More selective: only extracts significant, fact-checkable claims</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
