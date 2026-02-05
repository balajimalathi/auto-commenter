/**
 * Ghost Browser API integration for Playwriter
 *
 * Shared code for both executor (Node.js) and extension (Chrome) environments.
 * See extension/src/ghost-browser-api.d.ts for full API documentation.
 */
/// <reference types="chrome" />
/// <reference types="chrome" />
export declare const GHOST_PUBLIC_API_CONSTANTS: {
    readonly NEW_TEMPORARY_IDENTITY: "OpenInNewSession";
    readonly DEFAULT_IDENTITY: "";
    readonly MAX_TEMPORARY_IDENTITIES: 25;
};
export declare const GHOST_PROXIES_CONSTANTS: {
    readonly DIRECT_PROXY: "8f513494-8cf5-41c7-b318-936392222104";
    readonly SYSTEM_PROXY: "2485b989-7ffb-4442-a45a-d7f9a10c6171";
};
export declare const GHOST_PROJECTS_CONSTANTS: {
    readonly PROJECT_ID_HOME: "f0673216-13b9-48be-aa41-90763e229e78";
    readonly PROJECT_ID_UNSAVED: "fe061488-8a8e-40f0-9e5e-93a1a5e2c273";
    readonly SESSIONS_MAX: 25;
    readonly NEW_SESSION: "OpenInNewSession";
    readonly GLOBAL_SESSION: "";
};
export type GhostBrowserNamespace = 'ghostPublicAPI' | 'ghostProxies' | 'projects';
export type GhostBrowserCommandParams = {
    namespace: GhostBrowserNamespace;
    method: string;
    args: unknown[];
};
export type GhostBrowserCommandResult = {
    success: true;
    result: unknown;
} | {
    success: false;
    error: string;
};
/**
 * Function signature for sending ghost-browser commands.
 * In executor: sends via CDP session
 * In extension: calls chrome.* APIs directly
 */
export type SendGhostBrowserCommand = (namespace: GhostBrowserNamespace, method: string, args: unknown[]) => Promise<unknown>;
/**
 * Creates the chrome object with Ghost Browser API namespaces for the executor sandbox.
 * Mirrors the exact shape of chrome.ghostPublicAPI, chrome.ghostProxies, chrome.projects.
 *
 * @param sendCommand - Function to send commands to the extension
 */
export declare function createGhostBrowserChrome(sendCommand: SendGhostBrowserCommand): {
    ghostPublicAPI: Record<string, unknown>;
    ghostProxies: Record<string, unknown>;
    projects: Record<string, unknown>;
};
/**
 * Handles ghost-browser commands in the extension.
 * Calls the appropriate chrome.* API and returns the result.
 *
 * @param params - Command parameters (namespace, method, args)
 * @param chromeApi - The chrome object (passed to avoid global dependency)
 * @returns Result object with success/error status
 */
export declare function handleGhostBrowserCommand(params: GhostBrowserCommandParams, chromeApi: typeof chrome): Promise<GhostBrowserCommandResult>;
//# sourceMappingURL=ghost-browser.d.ts.map