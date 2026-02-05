export interface SmartDiffResult {
    type: 'diff' | 'full' | 'no-change';
    content: string;
}
export interface CreateSmartDiffOptions {
    oldContent: string;
    newContent: string;
    /** Threshold ratio (0-1) above which full content is returned instead of diff. Default 0.5 (50%) */
    threshold?: number;
    /** Label for the diff output */
    label?: string;
}
/**
 * Creates a smart diff that returns full content when changes exceed threshold.
 *
 * When more than `threshold` (default 50%) of lines have changed, showing a diff
 * is not useful - we return the full new content instead.
 */
export declare function createSmartDiff(options: CreateSmartDiffOptions): SmartDiffResult;
//# sourceMappingURL=diff-utils.d.ts.map