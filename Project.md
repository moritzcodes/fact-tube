### 1. **Transcript Capture**

-  [x] Extension gets transcript with `{text, start}` (from YouTube).  
-  [ ] Don’t send the whole transcript at once.  
-  [ ] Instead:  
    - [ ] Stream **small transcript segments** (e.g., 30–60 seconds of speech) to the backend.  
    - [ ] This way, claims are extracted chunk by chunk.

---

### 2. **Asynchronous Claim Extraction**

-  [ ] Each transcript segment is sent via `fetch(/api/extract-claims)` as soon as it’s available.  
-  [ ] Backend runs GPT on that segment → returns claims **with timestamps**.  
-  [ ] Backend streams JSON results to extension using **Server-Sent Events (SSE)** or **WebSocket**.  
-  [ ] Claims are **pushed to UI immediately** (no waiting for the full transcript).

---

### 3. **Frontend: Sync With Video Playback**

-  [ ] Claims arrive in the UI with timestamps:

    `{ "claim": "Trump says corporate taxes are 35% and he will lower them to 15%.", "speaker": "Donald Trump", "timestamp": 934 // seconds }`

-  [ ] UI maintains a **timeline queue**.  
-  [ ] As the YouTube video plays, a timer checks current playback time (via IFrame API).  
-  [ ] Claims whose timestamp ≤ current playback time get revealed (“pop up”) in real-time.

---

### 4. **Fact-Checking (Background)**

-  [ ] Claims get written to DB immediately (`status = pending`).  
-  [ ] Fact-check worker processes them async → updates DB.  
-  [ ] Extension subscribes (SSE/WebSocket) → updates claim verdicts in place.

---

## ⚡ Example Flow While Watching Video

-  [ ] User clicks **Start Fact-Check** at 0:00.  
-  [ ] Transcript is fetched in 1-minute slices.  
-  [ ] At 2:15, backend sends a claim:  
    - “Trump: The economy is growing at only 1%.” (timestamp 135s).  
-  [ ] Extension UI stores it but **only shows it when the player hits 2:15**.  
-  [ ] At 15:34, another claim pops up.  
-  [ ] Meanwhile, the fact-check worker updates claim #1 → overlay switches from ⏳ to ✅/❌.

---

## 🛠️ Implementation Changes

### **Extension**

-  [ ] Add listener for YouTube time updates (via IFrame API `player.getCurrentTime()`).  
-  [ ] Maintain a queue of claims sorted by timestamp.  
-  [ ] Reveal them when `currentTime >= claim.timestamp`.

### **Backend**

-  [ ] `/api/extract-claims` now supports **streaming small transcript slices**.  
-  [ ] Claims are streamed back immediately per slice, not at the end.

### **Data Model**

-  [ ] `{ "id": "claim-uuid", "claim": "Hillary Clinton will raise taxes.", "speaker": "Donald Trump", "timestamp": 934, "status": "pending", "sources": [] }`

---

## ✅ Final System Behavior

-  [ ] **Async extraction** → claims appear seconds after they’re spoken.  
-  [ ] **Synced playback** → claims pop up only when the video reaches the right point.  
-  [ ] **Background fact-check** → verdicts update in place after a delay.

