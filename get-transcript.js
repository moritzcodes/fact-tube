// get-transcript.js
// Usage examples:
//   node get-transcript.js dQw4w9WgXcQ
//   node get-transcript.js https://www.youtube.com/watch?v=dQw4w9WgXcQ
//   node get-transcript.js https://youtu.be/dQw4w9WgXcQ --lang en --format srt --out transcript.srt

const { Innertube } = require('youtubei.js');
const fs = require('fs');
const path = require('path');

// Extract video ID from common YouTube URL forms or accept raw IDs
function extractVideoId(input) {
    // Raw 11-char IDs are typical
    const rawIdMatch = /^[a-zA-Z0-9_-]{11}$/.test(input) ? input : null;
    if (rawIdMatch) return rawIdMatch;

    try {
        const u = new URL(input);
        // https://www.youtube.com/watch?v=VIDEO_ID
        if ((u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be"))) {
            // youtu.be/VIDEO_ID
            if (u.hostname.includes("youtu.be")) {
                const id = u.pathname.split("/").filter(Boolean)[0];
                if (id) return id;
            }
            // youtube.com/watch?v=VIDEO_ID
            const v = u.searchParams.get("v");
            if (v) return v;

            // Shorts: youtube.com/shorts/VIDEO_ID
            const parts = u.pathname.split("/").filter(Boolean);
            const shortsIdx = parts.indexOf("shorts");
            if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
        }
    } catch {
        // Not a URL, fall through
    }

    return null;
}

// Convert seconds float to SRT time code
function toSrtTime(t) {
    const ms = Math.floor((t % 1) * 1000);
    const sec = Math.floor(t) % 60;
    const min = Math.floor(t / 60) % 60;
    const hr = Math.floor(t / 3600);
    const pad2 = (n) => String(n).padStart(2, "0");
    const pad3 = (n) => String(n).padStart(3, "0");
    return `${pad2(hr)}:${pad2(min)}:${pad2(sec)},${pad3(ms)}`;
}

// CLI args
const args = process.argv.slice(2);
if (args.length < 1) {
    console.error("Usage: node get-transcript.js <videoIdOrUrl> [--lang en] [--format plain|srt] [--out file.srt]");
    process.exit(1);
}

const input = args[0];
let lang = "en";
let format = "plain"; // or "srt"
let outFile = null;

for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--lang" && args[i + 1]) {
        lang = args[++i];
    } else if (a === "--format" && args[i + 1]) {
        format = args[++i];
    } else if (a === "--out" && args[i + 1]) {
        outFile = args[++i];
    }
}

const videoId = extractVideoId(input);
if (!videoId) {
    console.error("Could not determine YouTube video ID. Provide a valid video URL or 11-character ID.");
    process.exit(2);
}

(async() => {
    try {
        console.error(`Fetching transcript for video: ${videoId} (lang: ${lang})...`);

        // Create Innertube instance with language preference
        const innertube = await Innertube.create({
            lang: lang,
        });

        // Get video info
        const info = await innertube.getInfo(videoId);

        if (!info) {
            console.error('Video not found or unavailable');
            process.exit(3);
        }

        // Get transcript
        const transcriptData = await info.getTranscript();

        if (!transcriptData || !transcriptData.transcript) {
            console.error("No captions available or access restricted (private/age-restricted/disabled).");
            process.exit(4);
        }

        const transcript = transcriptData.transcript;

        // Extract segments from the transcript
        const segments = transcript.content ? .body ? .initial_segments ? .map((segment) => {
            const startMs = segment.start_ms || 0;
            const endMs = segment.end_ms || startMs;
            const durationMs = endMs - startMs;

            return {
                start: startMs / 1000,
                dur: durationMs / 1000,
                end: endMs / 1000,
                text: segment.snippet ? .text || '',
            };
        }).filter((seg) => seg.text.trim()) || [];

        if (segments.length === 0) {
            console.error("No caption segments found. The video may not have captions.");
            process.exit(5);
        }

        console.error(`Found ${segments.length} segments`);

        let output;
        if (format === "srt") {
            output = segments
                .map((seg, i) => {
                    const start = toSrtTime(seg.start);
                    const end = toSrtTime(seg.end);
                    return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
                })
                .join("\n");
        } else if (format === "plain") {
            output = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
        } else {
            console.error(`Unknown --format "${format}". Use "plain" or "srt".`);
            process.exit(6);
        }

        if (outFile) {
            fs.writeFileSync(outFile, output, "utf8");
            console.error(`Saved to ${path.resolve(outFile)}`);
        } else {
            console.log(output);
        }
    } catch (err) {
        console.error("Error:", err ? .message || err || "Unknown error");
        if (err ? .stack) {
            console.error("Stack:", err.stack);
        }
        process.exit(7);
    }
})();