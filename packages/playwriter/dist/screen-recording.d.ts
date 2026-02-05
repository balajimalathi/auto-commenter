/**
 * Screen recording utility for playwriter using chrome.tabCapture.
 * Recording happens in the extension context, so it survives page navigation.
 *
 * This module communicates with the relay server which forwards commands to the extension.
 * SessionId (pw-tab-X format) is used to identify which tab to record.
 */
import type { Page } from 'playwright-core';
/**
 * Generate a shell command to quit and restart Chrome with flags that allow automatic tab capture.
 * This enables screen recording without user interaction (clicking extension icon).
 *
 * Required flags:
 * - --allowlisted-extension-id=<id> - grants the extension special privileges (one per extension)
 * - --auto-accept-this-tab-capture - auto-accepts tab capture permission requests
 */
export declare function getChromeRestartCommand(): string;
export interface StartRecordingOptions {
    /** Target page to record */
    page: Page;
    /** Session ID (pw-tab-X format) to identify which tab to record */
    sessionId?: string;
    /** Frame rate (default: 30) */
    frameRate?: number;
    /** Video bitrate in bps (default: 2500000 = 2.5 Mbps) */
    videoBitsPerSecond?: number;
    /** Audio bitrate in bps (default: 128000 = 128 kbps) */
    audioBitsPerSecond?: number;
    /** Include audio from tab (default: false) */
    audio?: boolean;
    /** Path to save the video file */
    outputPath: string;
    /** Relay server port (default: 19988) */
    relayPort?: number;
}
export interface StopRecordingOptions {
    /** Target page that is being recorded */
    page: Page;
    /** Session ID (pw-tab-X format) to identify which tab to stop recording */
    sessionId?: string;
    /** Relay server port (default: 19988) */
    relayPort?: number;
}
export interface RecordingState {
    isRecording: boolean;
    startedAt?: number;
    tabId?: number;
}
/**
 * Start recording the page.
 * The recording is handled by the extension, so it survives page navigation.
 */
export declare function startRecording(options: StartRecordingOptions): Promise<RecordingState>;
/**
 * Stop recording and save to file.
 * Returns the path to the saved video file.
 */
export declare function stopRecording(options: StopRecordingOptions): Promise<{
    path: string;
    duration: number;
    size: number;
}>;
/**
 * Check if recording is currently active.
 */
export declare function isRecording(options: {
    page: Page;
    sessionId?: string;
    relayPort?: number;
}): Promise<RecordingState>;
/**
 * Cancel recording without saving.
 */
export declare function cancelRecording(options: {
    page: Page;
    sessionId?: string;
    relayPort?: number;
}): Promise<void>;
//# sourceMappingURL=screen-recording.d.ts.map