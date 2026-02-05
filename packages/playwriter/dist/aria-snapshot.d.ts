import type { Page, Locator, ElementHandle } from 'playwright-core';
import type { Protocol } from 'devtools-protocol';
import type { ICDPSession } from './cdp-session.js';
export type SnapshotFormat = 'raw';
export declare const DEFAULT_SNAPSHOT_FORMAT: SnapshotFormat;
export interface AriaRef {
    role: string;
    name: string;
    ref: string;
    shortRef: string;
    backendNodeId?: Protocol.DOM.BackendNodeId;
}
export type AriaSnapshotNode = {
    role: string;
    name: string;
    locator?: string;
    ref?: string;
    shortRef?: string;
    backendNodeId?: Protocol.DOM.BackendNodeId;
    children: AriaSnapshotNode[];
};
export interface ScreenshotResult {
    path: string;
    base64: string;
    mimeType: 'image/jpeg';
    snapshot: string;
    labelCount: number;
}
export interface AriaSnapshotResult {
    snapshot: string;
    tree: AriaSnapshotNode[];
    refs: AriaRef[];
    refToElement: Map<string, {
        role: string;
        name: string;
        shortRef: string;
    }>;
    refToSelector: Map<string, string>;
    /**
     * Get a CSS selector for a ref. Use with page.locator().
     * For stable test IDs, returns [data-testid="..."] or [id="..."]
     * For fallback refs, returns a role-based selector.
     */
    getSelectorForRef: (ref: string) => string | null;
    getRefsForLocators: (locators: Array<Locator | ElementHandle>) => Promise<Array<AriaRef | null>>;
    getRefForLocator: (locator: Locator | ElementHandle) => Promise<AriaRef | null>;
    getRefStringForLocator: (locator: Locator | ElementHandle) => Promise<string | null>;
}
export declare function buildShortRefMap({ refs }: {
    refs: Array<{
        ref: string;
    }>;
}): Map<string, string>;
type DomNodeInfo = {
    nodeId: Protocol.DOM.NodeId;
    parentId?: Protocol.DOM.NodeId;
    backendNodeId: Protocol.DOM.BackendNodeId;
    nodeName: string;
    attributes: Map<string, string>;
};
export type SnapshotLine = {
    text: string;
    baseLocator?: string;
    hasChildren?: boolean;
    role?: string;
    name?: string;
    indent?: number;
};
export type SnapshotNode = {
    role: string;
    name: string;
    baseLocator?: string;
    ref?: string;
    backendNodeId?: Protocol.DOM.BackendNodeId;
    indentOffset?: number;
    ignored?: boolean;
    children: SnapshotNode[];
};
export declare function buildSnapshotLines(nodes: SnapshotNode[], indent?: number): SnapshotLine[];
export declare function buildRawSnapshotTree(options: {
    nodeId: Protocol.Accessibility.AXNodeId;
    axById: Map<Protocol.Accessibility.AXNodeId, Protocol.Accessibility.AXNode>;
    isNodeInScope: (node: Protocol.Accessibility.AXNode) => boolean;
}): SnapshotNode | null;
export declare function filterInteractiveSnapshotTree(options: {
    node: SnapshotNode;
    ancestorNames: string[];
    labelContext: boolean;
    refFilter?: (entry: {
        role: string;
        name: string;
    }) => boolean;
    domByBackendId: Map<Protocol.DOM.BackendNodeId, DomNodeInfo>;
    createRefForNode: (options: {
        backendNodeId?: Protocol.DOM.BackendNodeId;
        role: string;
        name: string;
    }) => string | null;
}): {
    nodes: SnapshotNode[];
    names: Set<string>;
};
export declare function filterFullSnapshotTree(options: {
    node: SnapshotNode;
    ancestorNames: string[];
    refFilter?: (entry: {
        role: string;
        name: string;
    }) => boolean;
    domByBackendId: Map<Protocol.DOM.BackendNodeId, DomNodeInfo>;
    createRefForNode: (options: {
        backendNodeId?: Protocol.DOM.BackendNodeId;
        role: string;
        name: string;
    }) => string | null;
}): {
    nodes: SnapshotNode[];
    names: Set<string>;
};
export declare function finalizeSnapshotOutput(lines: SnapshotLine[], nodes: SnapshotNode[], shortRefMap: Map<string, string>): {
    snapshot: string;
    tree: AriaSnapshotNode[];
};
/**
 * Get an accessibility snapshot with utilities to look up refs for elements.
 * Uses the browser accessibility tree (CDP) and maps nodes to DOM attributes.
 *
 * Refs are generated from stable test IDs when available (data-testid, data-test-id, etc.)
 * or fall back to e1, e2, e3...
 *
 * @param page - Playwright page
 * @param locator - Optional locator to scope the snapshot to a subtree
 * @param refFilter - Optional filter for which elements get refs
 *
 * @example
 * ```ts
 * const { snapshot, getSelectorForRef } = await getAriaSnapshot({ page })
 * // Snapshot shows locators like [id="submit-btn"] or role=button[name="Submit"]
 * const selector = getSelectorForRef('submit-btn')
 * await page.locator(selector).click()
 * ```
 */
export declare function getAriaSnapshot({ page, locator, refFilter, wsUrl, interactiveOnly, cdp }: {
    page: Page;
    locator?: Locator;
    refFilter?: (info: {
        role: string;
        name: string;
    }) => boolean;
    wsUrl?: string;
    interactiveOnly?: boolean;
    cdp?: ICDPSession;
}): Promise<AriaSnapshotResult>;
/**
 * Show Vimium-style labels on interactive elements.
 * Labels are colored badges positioned above each element showing the ref.
 * Use with screenshots so agents can see which elements are interactive.
 *
 * Labels auto-hide after 30 seconds to prevent stale labels.
 * Call this function again if the page HTML changes to get fresh labels.
 *
 * @param page - Playwright page
 * @param locator - Optional locator to scope labels to a subtree
 * @param interactiveOnly - Only show labels for interactive elements (default: true)
 *
 * @example
 * ```ts
 * const { snapshot, labelCount } = await showAriaRefLabels({ page })
 * await page.screenshot({ path: '/tmp/screenshot.png' })
 * // Agent sees [submit-btn] label on "Submit" button
 * await page.locator('[data-testid="submit-btn"]').click()
 * ```
 */
export declare function showAriaRefLabels({ page, locator, interactiveOnly, wsUrl, logger }: {
    page: Page;
    locator?: Locator;
    interactiveOnly?: boolean;
    wsUrl?: string;
    logger?: {
        info?: (...args: unknown[]) => void;
        error?: (...args: unknown[]) => void;
    };
}): Promise<{
    snapshot: string;
    labelCount: number;
}>;
/**
 * Remove all aria ref labels from the page.
 */
export declare function hideAriaRefLabels({ page }: {
    page: Page;
}): Promise<void>;
/**
 * Take a screenshot with accessibility labels overlaid on interactive elements.
 * Shows Vimium-style labels, captures the screenshot, then removes the labels.
 * The screenshot is automatically included in the MCP response.
 *
 * @param page - Playwright page
 * @param locator - Optional locator to scope labels to a subtree
 * @param collector - Array to collect screenshots (passed by MCP execute tool)
 *
 * @example
 * ```ts
 * await screenshotWithAccessibilityLabels({ page })
 * // Screenshot is automatically included in the MCP response
 * // Use ref from the snapshot to interact with elements
 * await page.locator('[data-testid="submit-btn"]').click()
 * ```
 */
export declare function screenshotWithAccessibilityLabels({ page, locator, interactiveOnly, wsUrl, collector, logger }: {
    page: Page;
    locator?: Locator;
    interactiveOnly?: boolean;
    wsUrl?: string;
    collector: ScreenshotResult[];
    logger?: {
        info?: (...args: unknown[]) => void;
        error?: (...args: unknown[]) => void;
    };
}): Promise<void>;
export { getAriaSnapshot as getAriaSnapshotWithRefs };
//# sourceMappingURL=aria-snapshot.d.ts.map