import type { ExtensionState } from 'mcp-extension/src/types.js';
declare global {
    var toggleExtensionForActiveTab: () => Promise<{
        isConnected: boolean;
        state: ExtensionState;
    }>;
    var getExtensionState: () => ExtensionState;
    var disconnectEverything: () => Promise<void>;
    var window: any;
    var document: any;
}
export {};
//# sourceMappingURL=test-declarations.d.ts.map