export interface ExportMetrics {
  // Timing
  elapsedMs: number;           // Wall clock since export started
  decodeSetupMs: number;       // Time for buildVideoStreams to complete
  lastFrameMs: number;         // Time for the last encode frame (render + videoSource.add)
  averageFrameMs: number;      // Rolling average over last 30 frames

  // Throughput
  framesEncoded: number;       // Frames written to encoder so far
  totalFrames: number;         // Total frames to encode (known upfront)
  encodeFps: number;           // framesEncoded / (elapsedMs / 1000)

  // Memory — JS heap (Chrome only; 0 on other browsers)
  heapUsedMB: number;          // performance.memory.usedJSHeapSize / 1e6
  heapTotalMB: number;         // performance.memory.totalJSHeapSize / 1e6
  heapLimitMB: number;         // performance.memory.jsHeapSizeLimit / 1e6

  // Memory — custom counters
  activeBitmaps: number;       // ImageBitmaps created − closed (should stay ≤ N_videos)
  activeVideoFrames: number;   // VideoFrames created − closed (should stay at 0 after each frame)
  nullSampleCount: number;     // Times iter.next() returned null (timestamp alignment failures)

  // Device (static, read once)
  deviceMemoryGB: number;      // navigator.deviceMemory (rounded, Chrome only)
  cpuCores: number;            // navigator.hardwareConcurrency

  // Phase
  phase: 'preparing' | 'decoding' | 'encoding' | 'audio' | 'finalizing';
  videoCount: number;          // Number of video streams being decoded
}
