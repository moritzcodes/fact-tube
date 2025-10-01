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
  const [extractedClaims, setExtractedClaims] = useState<any[]>([]);

  // Fetch transcript from YouTube
  const { data: transcript, isLoading: transcriptLoading, error: transcriptError } = 
    trpc.transcripts.fetchFromYouTube.useQuery(
      { videoId: fetchedVideoId!, lang: selectedLang },
      { enabled: !!fetchedVideoId }
    );

  // Mutation for extracting claims
  const extractClaimsMutation = trpc.ai.extractClaims.useMutation();
  
  // Get all claims for the current video
  const { data: videoClaims, refetch: refetchClaims } = trpc.claims.getByVideoId.useQuery(
    { videoId: fetchedVideoId! },
    { enabled: !!fetchedVideoId }
  );

  const handleFetchTranscript = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoInput.trim()) {
      toast.error('Please enter a YouTube video ID or URL');
      return;
    }
    
    setFetchedVideoId(videoInput.trim());
    setExtractedClaims([]);
    toast.info('Fetching transcript...');
  };

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
      
      toast.info(`Processing ${chunks.length} segments...`);

      // Process each chunk asynchronously
      const allClaims: any[] = [];
      for (let i = 0; i < chunks.length; i++) {
        try {
          const result = await extractClaimsMutation.mutateAsync({
            videoId: fetchedVideoId,
            segments: chunks[i],
          });
          
          allClaims.push(...result.claims);
          setExtractedClaims(prev => [...prev, ...result.claims]);
          setProcessedChunks(i + 1);
          
          toast.success(`Chunk ${i + 1}/${chunks.length}: ${result.claimsExtracted} claims found`);
        } catch (error) {
          console.error(`Error processing chunk ${i + 1}:`, error);
          toast.error(`Failed to process chunk ${i + 1}`);
        }
      }

      // Refetch all claims from database
      await refetchClaims();
      
      toast.success(`✓ Processing complete! ${allClaims.length} total claims extracted.`);
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

          {/* Transcript Results */}
          {transcriptError && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 font-semibold">Error:</p>
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">{transcriptError.message}</p>
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
                  {transcript.segments.map((segment: any, index: number) => (
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

          {/* Process Segments Button */}
          {transcript && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-3">AI Claim Extraction</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Use GPT-4o-mini (via OpenRouter) to extract factual claims from the transcript segments.
                Segments will be processed in 60-second chunks asynchronously.
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
            <h2 className="text-2xl font-semibold mb-4">Extracted Claims</h2>
            
            <div className="space-y-3">
              {(videoClaims || extractedClaims).map((claim: any, index: number) => (
                <div 
                  key={claim.id || index}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-20 text-sm font-mono text-blue-600 dark:text-blue-400">
                      {formatTimestamp(claim.timestamp)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">{claim.claim}</p>
                      {claim.speaker && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Speaker: {claim.speaker}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          claim.status === 'pending' 
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' 
                            : claim.status === 'verified'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : claim.status === 'false'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                        }`}>
                          {claim.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                <li><code>transcripts.fetchFromYouTube</code> - Fetch transcript from YouTube (NEW)</li>
                <li><code>transcripts.create</code> - Create transcript segment</li>
                <li><code>transcripts.markProcessed</code> - Mark segment as processed</li>
                <li><code>transcripts.getUnprocessed</code> - Get unprocessed segments</li>
                <li><code>transcripts.getByVideoId</code> - Get all segments for video</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-blue-600 dark:text-blue-400">Videos:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700 dark:text-gray-300">
                <li><code>videos.getById</code> - Get video metadata</li>
                <li><code>videos.upsert</code> - Create or update video metadata</li>
                <li><code>videos.getAll</code> - Get all videos</li>
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
              <h3 className="font-semibold text-blue-600 dark:text-blue-400">AI Processing (NEW):</h3>
              <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700 dark:text-gray-300">
                <li><code>ai.extractClaims</code> - Extract claims from transcript segments using GPT-4o-mini</li>
                <li><code>ai.extractClaimsBatch</code> - Batch process multiple segment chunks</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
