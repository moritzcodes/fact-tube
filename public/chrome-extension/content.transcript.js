// Transcript extraction utilities for YouTube videos

/**
 * Extract video ID from current YouTube URL
 */
function getYouTubeVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
}

/**
 * Extract video metadata from YouTube page
 */
function getVideoMetadata() {
    const videoId = getYouTubeVideoId();
    const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
    const channelElement = document.querySelector('ytd-channel-name#channel-name yt-formatted-string a');

    return {
        videoId: videoId,
        videoUrl: window.location.href,
        title: titleElement ? titleElement.textContent.trim() : '',
        channelName: channelElement ? channelElement.textContent.trim() : '',
    };
}

/**
 * Fetch YouTube transcript using YouTube's API
 * This uses the built-in captions/transcript feature
 */
async function fetchYouTubeTranscript(videoId) {
    try {
        console.log('🎬 Fetching transcript for video:', videoId);

        // Method 1: Try to extract from YouTube's ytInitialPlayerResponse
        let ytInitialPlayerResponse = window.ytInitialPlayerResponse;

        // If not found in window, try to extract from page scripts
        if (!ytInitialPlayerResponse) {
            const scripts = document.querySelectorAll('script');
            for (let script of scripts) {
                const content = script.textContent;
                if (content && content.includes('ytInitialPlayerResponse')) {
                    try {
                        const match = content.match(/var ytInitialPlayerResponse = ({.+?});/);
                        if (match && match[1]) {
                            ytInitialPlayerResponse = JSON.parse(match[1]);
                            break;
                        }
                    } catch (e) {
                        console.log('Failed to parse ytInitialPlayerResponse from script');
                    }
                }
            }
        }

        if (ytInitialPlayerResponse && ytInitialPlayerResponse.captions) {
            console.log('✅ Found ytInitialPlayerResponse with captions');
            const captionData = ytInitialPlayerResponse.captions;

            if (captionData.playerCaptionsTracklistRenderer) {
                const captionTracks = captionData.playerCaptionsTracklistRenderer.captionTracks;

                if (captionTracks && captionTracks.length > 0) {
                    console.log(`📝 Found ${captionTracks.length} caption tracks`);

                    // Prefer English captions, fall back to first available
                    let selectedTrack = captionTracks.find(track =>
                        track.languageCode === 'en' || track.languageCode === 'en-US'
                    ) || captionTracks[0];

                    console.log(`🎯 Using caption track: ${selectedTrack.name?.simpleText || 'Unknown'} (${selectedTrack.languageCode})`);

                    // Use the base URL to fetch the transcript
                    const captionUrl = selectedTrack.baseUrl;
                    const segments = await fetchTranscriptFromUrl(captionUrl);

                    if (segments && segments.length > 0) {
                        console.log(`✅ Successfully fetched ${segments.length} transcript segments`);
                        return segments;
                    }
                }
            }
        }

        // Method 2: Check if captions/subtitles are available in the DOM
        console.log('⚠️ ytInitialPlayerResponse method failed, trying DOM caption tracks...');
        const captionTracks = Array.from(document.querySelectorAll('track[kind="captions"], track[kind="subtitles"]'));

        if (captionTracks.length > 0) {
            console.log(`📝 Found ${captionTracks.length} caption tracks in DOM`);
            // Use the first available caption track
            const trackSrc = captionTracks[0].src;
            if (trackSrc) {
                const segments = await fetchTranscriptFromUrl(trackSrc);
                if (segments && segments.length > 0) {
                    console.log(`✅ Successfully fetched ${segments.length} transcript segments from DOM`);
                    return segments;
                }
            }
        }

        console.warn('⚠️ No caption tracks available for this video');
        return null;
    } catch (error) {
        console.error('❌ Error fetching transcript:', error);
        return null;
    }
}

/**
 * Fetch and parse transcript from a caption URL
 */
async function fetchTranscriptFromUrl(url) {
    try {
        const response = await fetch(url);
        const text = await response.text();

        // Parse the caption file (usually in WebVTT or TTML format)
        return parseTranscript(text);
    } catch (error) {
        console.error('❌ Error fetching caption file:', error);
        return null;
    }
}

/**
 * Parse transcript text into segments with timestamps
 */
function parseTranscript(text) {
    const segments = [];

    // Check if it's WebVTT format
    if (text.includes('WEBVTT')) {
        // Parse WebVTT
        const lines = text.split('\n');
        let currentSegment = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check for timestamp line (e.g., "00:00:12.500 --> 00:00:15.000")
            const timestampMatch = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
            if (timestampMatch) {
                if (currentSegment) {
                    segments.push(currentSegment);
                }

                const hours = parseInt(timestampMatch[1]);
                const minutes = parseInt(timestampMatch[2]);
                const seconds = parseInt(timestampMatch[3]);
                const start = hours * 3600 + minutes * 60 + seconds;

                currentSegment = {
                    start: start,
                    text: ''
                };
            } else if (currentSegment && line && !line.includes('-->') && !line.match(/^\d+$/)) {
                // This is the text content
                currentSegment.text += (currentSegment.text ? ' ' : '') + line;
            }
        }

        if (currentSegment) {
            segments.push(currentSegment);
        }
    } else if (text.includes('<?xml') || text.includes('<transcript>') || text.includes('<text')) {
        // Parse YouTube's XML format or TTML format
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');

        // Try YouTube's transcript format first (uses <text> tags)
        let textElements = xmlDoc.getElementsByTagName('text');

        // If not found, try TTML format (uses <p> tags)
        if (textElements.length === 0) {
            textElements = xmlDoc.getElementsByTagName('p');
        }

        for (let element of textElements) {
            // YouTube uses 'start' attribute for timestamp, TTML uses 'begin' or 't'
            const startAttr = element.getAttribute('start') ||
                element.getAttribute('begin') ||
                element.getAttribute('t');

            if (startAttr) {
                const start = parseFloat(startAttr);
                let text = element.textContent.trim();

                // Decode HTML entities
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = text;
                text = tempDiv.textContent || tempDiv.innerText || text;

                if (text) {
                    segments.push({
                        start: start,
                        text: text
                    });
                }
            }
        }
    }

    console.log(`📊 Parsed ${segments.length} transcript segments`);
    return segments;
}

/**
 * Parse time string to seconds
 */
function parseTimeToSeconds(timeStr) {
    // Handle formats like "00:00:12.500" or "12.500s" or "12500ms"
    if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseFloat(parts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    } else if (timeStr.endsWith('s')) {
        return parseFloat(timeStr);
    } else if (timeStr.endsWith('ms')) {
        return parseFloat(timeStr) / 1000;
    } else {
        return parseFloat(timeStr);
    }
}

/**
 * Chunk transcript segments into smaller batches for processing
 * @param {Array} segments - Array of transcript segments
 * @param {number} chunkDuration - Duration of each chunk in seconds (default: 60)
 */
function chunkTranscriptSegments(segments, chunkDuration = 60) {
    const chunks = [];
    let currentChunk = [];
    let chunkStartTime = 0;

    for (let segment of segments) {
        if (segment.start - chunkStartTime >= chunkDuration && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = [];
            chunkStartTime = segment.start;
        }
        currentChunk.push(segment);
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
}

/**
 * Process video transcript in chunks and send to backend
 */
async function processVideoTranscript(videoId, apiBaseUrl) {
    try {
        console.log('🎬 Starting transcript processing for video:', videoId);

        // Get video metadata
        const metadata = getVideoMetadata();
        console.log('📝 Video metadata:', metadata);

        // Fetch transcript
        const segments = await fetchYouTubeTranscript(videoId);
        if (!segments || segments.length === 0) {
            console.warn('⚠️ No transcript available for this video');
            throw new Error('No transcript available for this video. Please enable captions.');
        }

        console.log(`✅ Transcript fetched: ${segments.length} segments`);

        // Chunk the transcript into 60-second batches
        const chunks = chunkTranscriptSegments(segments, 60);
        console.log(`📦 Split transcript into ${chunks.length} chunks`);

        // Process chunks sequentially
        let totalClaims = 0;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`📤 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} segments)`);

            try {
                const response = await fetch(`${apiBaseUrl}/api/extension/submit-transcript`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        videoId: videoId,
                        videoUrl: metadata.videoUrl,
                        videoTitle: metadata.title,
                        channelName: metadata.channelName,
                        segments: chunk,
                    }),
                });

                if (!response.ok) {
                    console.error(`❌ Failed to process chunk ${i + 1}:`, response.statusText);
                    continue;
                }

                const result = await response.json();
                totalClaims += result.claimsExtracted;
                console.log(`✅ Chunk ${i + 1} processed: ${result.claimsExtracted} claims extracted`);

                // Small delay between chunks to avoid rate limiting
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error(`❌ Error processing chunk ${i + 1}:`, error);
            }
        }

        console.log(`🎉 Transcript processing complete! Total claims extracted: ${totalClaims}`);
        return {
            success: true,
            totalClaims: totalClaims,
            totalChunks: chunks.length,
        };
    } catch (error) {
        console.error('❌ Error processing video transcript:', error);
        throw error;
    }
}

console.log('✅ Content transcript module loaded');