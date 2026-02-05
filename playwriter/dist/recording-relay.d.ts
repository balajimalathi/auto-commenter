/**
 * Recording relay functionality for the CDP relay server.
 * Handles recording state, chunk accumulation, and file writing.
 */
/// <reference types="node" />
/// <reference types="node" />
import type { StartRecordingParams, StopRecordingParams, IsRecordingParams, CancelRecordingParams, StartRecordingResult, StopRecordingResult, IsRecordingResult, CancelRecordingResult, RecordingDataMessage, RecordingCancelledMessage } from './protocol.js';
export interface ActiveRecording {
    tabId: number;
    sessionId?: string;
    outputPath: string;
    chunks: Buffer[];
    startedAt: number;
    resolveStop?: (result: StopRecordingResult) => void;
}
export declare class RecordingRelay {
    private activeRecordings;
    private lastRecordingMetadataTabId;
    private sendToExtension;
    private isExtensionConnected;
    private logger?;
    constructor(sendToExtension: (params: {
        method: string;
        params?: unknown;
        timeout?: number;
    }) => Promise<unknown>, isExtensionConnected: () => boolean, logger?: {
        log(...args: unknown[]): void;
        error(...args: unknown[]): void;
    });
    /**
     * Handle incoming binary data (recording chunks) from the extension.
     */
    handleBinaryData(buffer: Buffer): void;
    /**
     * Handle recordingData message from extension.
     */
    handleRecordingData(message: RecordingDataMessage): void;
    /**
     * Handle recordingCancelled message from extension.
     */
    handleRecordingCancelled(message: RecordingCancelledMessage): void;
    startRecording(params: StartRecordingParams & {
        outputPath: string;
    }): Promise<StartRecordingResult>;
    stopRecording(params: StopRecordingParams): Promise<StopRecordingResult>;
    isRecording(params: IsRecordingParams): Promise<IsRecordingResult>;
    cancelRecording(params: CancelRecordingParams): Promise<CancelRecordingResult>;
}
//# sourceMappingURL=recording-relay.d.ts.map