'use client';

import { trpc } from '@/lib/trpc/react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { chunkSegmentsByTime } from '@/lib/types/transcript';
import type { TranscriptSegment, Video } from '@/lib/db/schema';

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
  ) as { data: Array<{
    id: string;
    claim: string;
    speaker?: string | null;
    timestamp: number;
    status: string;
    verdict?: string | null;
    sources?: Array<{ url: string; title?: string }> | string | null;
  }> | undefined; refetch: () => void };

  // Get all videos (recent first)
  const { data: recentVideos, refetch: refetchRecentVideos } = trpc.videos.getAll.useQuery() as { data: Video[] | undefined; refetch: () => void };

  // Get video metadata from database
  const { data: dbVideo } = trpc.videos.getById.useQuery(
    { id: fetchedVideoId! },
    { enabled: !!fetchedVideoId }
  ) as { data: Video | undefined };

  // Get transcript segments from database
  const { data: dbTranscriptSegments } = trpc.transcripts.getByVideoId.useQuery(
    { videoId: fetchedVideoId! },
    { enabled: !!fetchedVideoId }
  ) as { data: TranscriptSegment[] | undefined };

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

  // Track which videos have been saved to prevent duplicate saves
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(new Set());

  // Save video metadata and transcript to database when fetched (only once per video)
  useEffect(() => {
    const saveToDatabase = async () => {
      if (!transcript || !videoMetadata || !fetchedVideoId) return;
      
      // Skip if already saved
      if (savedVideoIds.has(fetchedVideoId)) {
        console.log(`Video ${fetchedVideoId} already saved, skipping...`);
        return;
      }

      try {
        console.log(`Saving video ${fetchedVideoId} to database...`);
        
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

        // Mark as saved
        setSavedVideoIds(prev => new Set(prev).add(fetchedVideoId));

        // Refetch recent videos
        refetchRecentVideos();

        toast.success('Video and transcript saved to database');
      } catch (error) {
        console.error('Error saving to database:', error);
        // Don't show error toast as this is background operation
      }
    };

    saveToDatabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, videoMetadata, fetchedVideoId]);

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
          }) as unknown as {
            claims: Array<{
              id: string;
              claim: string;
              speaker?: string | null;
              timestamp: number;
              status: string;
              verdict?: string | null;
              sources?: Array<{ url: string; title?: string }> | string | null;
            }>;
            claimsExtracted: number;
          };
          
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
    <div className="min-h-screen p-4 md:p-8 font-[family-name:var(--font-geist-sans)] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background gradient - Light mode */}
      <div 
        className="absolute inset-0 w-full h-full bg-gradient-to-t z-0 dark:hidden" 
        style={{
          '--from': '#E9D2BB',
          '--via': '#87CEEB',
          '--to': '#4682B4',
          backgroundImage: 'linear-gradient(to top, var(--from), var(--via) 40%, var(--to))'
        } as React.CSSProperties}
      />
      
      {/* Background gradient - Dark mode */}
      <div 
        className="absolute inset-0 w-full h-full bg-gradient-to-t z-0 hidden dark:block" 
        style={{
          '--from': '#0C1732',
          '--via': '#060F23',
          '--to': '#000815',
          backgroundImage: 'linear-gradient(to top, var(--from), var(--via) 40%, var(--to))'
        } as React.CSSProperties}
      />
      
      <main className="max-w-6xl mx-auto relative z-10">
        <h1 className="text-4xl font-bold mb-8 text-white drop-shadow-lg">FactTube</h1>
  
        {/* YouTube Transcript Fetcher */}
        <div className="bg-white/10 md:bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 mb-8 shadow-2xl transition-all duration-300 hover:bg-white/15 z-20 relative">
          <h2 className="text-2xl font-semibold mb-4 text-white">YouTube Transcript Fetcher</h2>
          
          <form onSubmit={handleFetchTranscript} className="space-y-4">
            <div>
              <label htmlFor="videoInput" className="block text-sm font-medium mb-2 text-white/90">
                YouTube Video ID or URL
              </label>
              <input
                id="videoInput"
                type="text"
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                placeholder="e.g., dQw4w9WgXcQ or https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/10 md:bg-white/10 backdrop-blur-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-white/50 transition-all duration-300"
              />
              <p className="text-xs text-white/60 mt-1">
                Note: Only videos with captions/subtitles enabled will work.{' '}
                <button
                  type="button"
                  onClick={() => setVideoInput('jNQXAC9IVRw')}
                  className="text-blue-300 hover:text-blue-200 hover:underline transition-colors duration-200"
                >
                  Try example video
                </button>
              </p>
            </div>

            <div className="flex gap-4 items-end flex-col sm:flex-row">
              <div className="flex-1 w-full">
                <label htmlFor="language" className="block text-sm font-medium mb-2 text-white/90">
                  Language Code
                </label>
                <input
                  id="language"
                  type="text"
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  placeholder="en"
                  className="w-full px-4 py-2 border border-white/30 rounded-lg bg-white/10 md:bg-white/10 backdrop-blur-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-white/50 transition-all duration-300"
                />
              </div>
              
              <button
                type="submit"
                disabled={transcriptLoading}
                className="w-full sm:w-auto px-6 py-2 bg-blue-500/80 hover:bg-blue-500 disabled:bg-white/20 text-white rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-xl backdrop-blur-sm border border-white/20 hover:scale-105"
              >
                {transcriptLoading ? 'Fetching...' : 'Fetch Transcript'}
              </button>
            </div>
          </form>

          {/* Show recent videos button */}
          {!showRecentVideos && recentVideos && recentVideos.length > 0 && (
            <button
              onClick={() => setShowRecentVideos(true)}
              className="mt-4 text-sm text-blue-300 hover:text-blue-200 hover:underline transition-colors duration-200"
            >
              ← Back to Recent Videos
            </button>
          )}

          {/* Transcript Results */}
          {transcriptError && (
            <div className="mt-6 p-4 bg-red-500/20 backdrop-blur-md border border-red-400/30 rounded-lg shadow-lg transition-all duration-300">
              <p className="text-red-200 font-semibold">Error:</p>
              <p className="text-red-200/90 text-sm mt-1">{transcriptError.message}</p>
            </div>
          )}

          {/* Show stored transcript if available and not fetching new one */}
          {!transcript && dbTranscriptSegments && dbTranscriptSegments.length > 0 && dbVideo && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-purple-500/20 backdrop-blur-md border border-purple-400/30 rounded-lg shadow-lg transition-all duration-300 hover:bg-purple-500/25">
                <p className="text-purple-200 font-semibold">
                  ✓ Loaded from database
                </p>
                <div className="text-sm mt-2 text-white/90 space-y-1">
                  <p><strong>Video ID:</strong> {fetchedVideoId}</p>
                  <p><strong>Title:</strong> {dbVideo.title}</p>
                  <p><strong>Channel:</strong> {dbVideo.channelName}</p>
                  <p><strong>Total Segments:</strong> {dbTranscriptSegments.length}</p>
                </div>
              </div>

              {/* Database Transcript Segments */}
              <div className="border border-white/20 rounded-lg overflow-hidden backdrop-blur-sm bg-white/5 shadow-xl z-30 relative">
                <div className="bg-white/10 md:bg-white/10 backdrop-blur-sm px-4 py-3 border-b border-white/20">
                  <h3 className="font-semibold text-white">Transcript Segments (from database)</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {dbTranscriptSegments.map((segment: TranscriptSegment) => (
                    <div
                      key={segment.id}
                      className="px-4 py-3 border-b border-white/10 hover:bg-white/10 transition-all duration-200"
                    >
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-20 text-sm font-mono text-blue-300">
                          {formatTimestamp(segment.startTime)}
                        </div>
                        <div className="flex-1 text-sm text-white/80">
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
              <div className="p-4 bg-green-500/20 backdrop-blur-md border border-green-400/30 rounded-lg shadow-lg transition-all duration-300 hover:bg-green-500/25">
                <p className="text-green-200 font-semibold">
                  ✓ Transcript fetched successfully!
                </p>
                <div className="text-sm mt-2 text-white/90 space-y-1">
                  <p><strong>Video ID:</strong> {transcript.videoId}</p>
                  <p><strong>Language:</strong> {transcript.lang}</p>
                  <p><strong>Total Segments:</strong> {transcript.totalSegments}</p>
                  <p><strong>Last Timestamp:</strong> {formatTimestamp(transcript.segments[transcript.segments.length - 1]?.start || 0)}</p>
                </div>
              </div>

              {/* Transcript Segments */}
              <div className="border border-white/20 rounded-lg overflow-hidden backdrop-blur-sm bg-white/5 shadow-xl z-30 relative">
                <div className="bg-white/10 md:bg-white/10 backdrop-blur-sm px-4 py-3 border-b border-white/20">
                  <h3 className="font-semibold text-white">Transcript Segments</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {transcript.segments.map((segment: { start: number; text: string }, index: number) => (
                    <div
                      key={index}
                      className="px-4 py-3 border-b border-white/10 hover:bg-white/10 transition-all duration-200"
                    >
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-20 text-sm font-mono text-blue-300">
                          {formatTimestamp(segment.start)}
                        </div>
                        <div className="flex-1 text-sm text-white/80">
                          {segment.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* JSON Preview */}
              <details className="border border-white/20 rounded-lg backdrop-blur-sm bg-white/5 shadow-lg overflow-hidden">
                <summary className="cursor-pointer px-4 py-3 bg-white/10 md:bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300 font-medium text-white">
                  View Raw JSON
                </summary>
                <pre className="p-4 text-xs overflow-x-auto bg-black/20 backdrop-blur-sm text-white/70">
                  {JSON.stringify(transcript, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Video Metadata Display */}
          {videoMetadata && (
            <div className="mt-6 p-4 bg-purple-500/20 backdrop-blur-md border border-purple-400/30 rounded-lg shadow-lg transition-all duration-300 hover:bg-purple-500/25">
              <h3 className="font-semibold mb-3 text-purple-200">Video Context</h3>
              <div className="space-y-2 text-sm text-white/90">
                <p><strong>Title:</strong> {videoMetadata.title}</p>
                <p><strong>Channel:</strong> {videoMetadata.channelName}</p>
                {videoMetadata.description && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-purple-300 hover:text-purple-200 hover:underline transition-colors duration-200">
                      View Description
                    </summary>
                    <p className="mt-2 text-xs whitespace-pre-wrap bg-white/5 backdrop-blur-sm p-3 rounded border border-purple-400/30">
                      {videoMetadata.description}
                    </p>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Process Segments Button */}
          {transcript && (
            <div className="mt-6 p-4 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 rounded-lg shadow-lg transition-all duration-300 hover:bg-blue-500/25">
              <h3 className="font-semibold mb-3 text-white">AI Claim Extraction (Improved)</h3>
              <p className="text-sm text-white/80 mb-4">
                Use GPT-4o-mini (via OpenRouter) to extract <strong>only important, fact-checkable claims</strong> from the transcript.
                {videoMetadata && ' Video context (title, description, channel) is used for better understanding.'}
                Segments are processed in 60-second chunks asynchronously.
              </p>
              <button
                onClick={handleProcessSegments}
                disabled={isProcessing || !transcript}
                className="px-6 py-2 bg-blue-500/80 hover:bg-blue-500 disabled:bg-white/20 text-white rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-xl backdrop-blur-sm border border-white/20 hover:scale-105"
              >
                {isProcessing 
                  ? `Processing... (${processedChunks}/${totalChunks})` 
                  : 'Extract Claims with AI'}
              </button>
              
              {isProcessing && (
                <div className="mt-3">
                  <div className="w-full bg-white/20 backdrop-blur-sm rounded-full h-2 border border-white/20 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-400 to-purple-400 h-2 transition-all duration-300 shadow-lg"
                      style={{ width: `${(processedChunks / totalChunks) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/70 mt-1">
                    {processedChunks} of {totalChunks} chunks processed
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Recent Videos Section */}
        {showRecentVideos && recentVideos && recentVideos.length > 0 && (
          <div className="bg-white/10 md:bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 mb-8 shadow-2xl transition-all duration-300 hover:bg-white/15 z-20 relative">
            <h2 className="text-2xl font-semibold mb-4 text-white">Recent Videos</h2>
            <div className="space-y-3">
              {recentVideos.map((video: Video) => (
                <button
                  key={video.id}
                  onClick={() => handleSelectVideo(video.id)}
                  className="w-full text-left p-4 border border-white/20 rounded-lg bg-white/5 md:bg-white/5 backdrop-blur-sm hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.01] z-30 relative"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1 text-white">{video.title || video.id}</h3>
                      {video.channelName && (
                        <p className="text-sm text-white/70">
                          {video.channelName}
                        </p>
                      )}
                      <p className="text-xs text-white/50 mt-1">
                        Added: {new Date(video.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-xs px-2 py-1 rounded bg-blue-400/20 backdrop-blur-sm text-blue-200 border border-blue-300/30">
                        {video.id}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      

        {/* Extracted Claims Section */}
        {(extractedClaims.length > 0 || (videoClaims && videoClaims.length > 0)) && (
          <div className="bg-white/10 md:bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 mb-8 shadow-2xl transition-all duration-300 hover:bg-white/15 z-20 relative">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-2xl font-semibold text-white">
                {isProcessing ? 'Claims Being Extracted...' : 'Extracted Claims'}
              </h2>
              <span className="text-sm text-white/70 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
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
                    className="p-4 border border-white/20 rounded-lg bg-white/5 md:bg-white/5 backdrop-blur-sm hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.01] z-30 relative"
                  >
                    <div className="flex gap-4 flex-col sm:flex-row">
                      <div className="flex-shrink-0 w-20 text-sm font-mono text-blue-300">
                        {formatTimestamp(claim.timestamp)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1 text-white">{claim.claim}</p>
                        {claim.speaker && (
                          <p className="text-xs text-white/60 mb-2">
                            Speaker: {claim.speaker}
                          </p>
                        )}
                        
                        {/* Status Badge */}
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded backdrop-blur-sm border transition-all duration-200 ${
                            claim.status === 'pending' 
                              ? 'bg-yellow-500/20 text-yellow-200 border-yellow-400/30' 
                              : claim.status === 'verified'
                              ? 'bg-green-500/20 text-green-200 border-green-400/30'
                              : claim.status === 'false'
                              ? 'bg-red-500/20 text-red-200 border-red-400/30'
                              : claim.status === 'disputed'
                              ? 'bg-orange-500/20 text-orange-200 border-orange-400/30'
                              : 'bg-white/10 text-white/70 border-white/20'
                          }`}>
                            {claim.status}
                          </span>
                        </div>

                        {/* Verdict/Explanation */}
                        {claim.verdict && (
                          <div className="mt-3 p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/20 transition-all duration-200 hover:bg-white/10">
                            <p className="text-xs font-semibold text-white/90 mb-1">
                              Explanation:
                            </p>
                            <p className="text-xs text-white/70">
                              {claim.verdict}
                            </p>
                          </div>
                        )}

                        {/* Sources (show up to 2) */}
                        {parsedSources.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-white/90 mb-2">
                              Sources:
                            </p>
                            <div className="space-y-2">
                              {parsedSources.slice(0, 2).map((source: { url?: string; title?: string } | string, idx: number) => (
                                <a
                                  key={idx}
                                  href={typeof source === 'string' ? source : source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs p-2 bg-blue-500/20 backdrop-blur-sm rounded border border-blue-400/30 hover:bg-blue-500/30 transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-md"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="text-blue-300">🔗</span>
                                    <div className="flex-1 min-w-0">
                                      {typeof source === 'object' && source.title && (
                                        <p className="font-medium text-blue-200 truncate">
                                          {source.title}
                                        </p>
                                      )}
                                      <p className="text-blue-300/80 truncate">
                                        {typeof source === 'string' ? source : (source.url || '')}
                                      </p>
                                    </div>
                                  </div>
                                </a>
                              ))}
                              {parsedSources.length > 2 && (
                                <p className="text-xs text-white/50 italic">
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
      </main>
    </div>
  );
}
