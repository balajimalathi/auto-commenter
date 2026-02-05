import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sema } from 'async-sema';
import { getCDPSessionForPage } from './cdp-session.js';
// Import sharp at module level - resolves to null if not available
const sharpPromise = import('sharp')
    .then((m) => { return m.default; })
    .catch(() => { return null; });
export const DEFAULT_SNAPSHOT_FORMAT = 'raw';
// ============================================================================
// A11y Client Code Loading
// ============================================================================
let a11yClientCode = null;
function getA11yClientCode() {
    if (a11yClientCode) {
        return a11yClientCode;
    }
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const a11yClientPath = path.join(currentDir, '..', 'dist', 'a11y-client.js');
    a11yClientCode = fs.readFileSync(a11yClientPath, 'utf-8');
    return a11yClientCode;
}
async function ensureA11yClient(page) {
    const hasA11y = await page.evaluate(() => !!globalThis.__a11y);
    if (!hasA11y) {
        const code = getA11yClientCode();
        await page.evaluate(code);
    }
}
export function buildShortRefMap({ refs }) {
    const map = new Map();
    refs.forEach((entry, index) => {
        map.set(entry.ref, `e${index + 1}`);
    });
    return map;
}
// Roles that represent interactive elements
const INTERACTIVE_ROLES = new Set([
    'button',
    'link',
    'textbox',
    'combobox',
    'searchbox',
    'checkbox',
    'radio',
    'slider',
    'spinbutton',
    'switch',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'tab',
    'treeitem',
    'img',
    'video',
    'audio',
]);
const LABEL_ROLES = new Set([
    'labeltext',
]);
const MAX_LABEL_POSITION_CONCURRENCY = 24;
const BOX_MODEL_TIMEOUT_MS = 5000;
const CONTEXT_ROLES = new Set([
    'navigation',
    'main',
    'contentinfo',
    'banner',
    'form',
    'section',
    'region',
    'list',
    'listitem',
    'table',
    'rowgroup',
    'row',
    'cell',
]);
const SKIP_WRAPPER_ROLES = new Set([
    'generic',
    'group',
    'none',
    'presentation',
]);
const TEST_ID_ATTRS = [
    'data-testid',
    'data-test-id',
    'data-test',
    'data-cy',
    'data-pw',
    'data-qa',
    'data-e2e',
    'data-automation-id',
];
function toAttributeMap(attributes) {
    const result = new Map();
    if (!attributes) {
        return result;
    }
    for (let i = 0; i < attributes.length; i += 2) {
        const name = attributes[i];
        const value = attributes[i + 1];
        if (name) {
            result.set(name, value ?? '');
        }
    }
    return result;
}
function getStableRefFromAttributes(attributes) {
    const id = attributes.get('id');
    if (id) {
        return { value: id, attr: 'id' };
    }
    for (const attr of TEST_ID_ATTRS) {
        const value = attributes.get(attr);
        if (value) {
            return { value, attr };
        }
    }
    return null;
}
function escapeLocatorValue(value) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function buildLocatorFromStable(stable) {
    const escaped = escapeLocatorValue(stable.value);
    return `[${stable.attr}="${escaped}"]`;
}
function buildBaseLocator({ role, name, stable }) {
    if (stable) {
        return buildLocatorFromStable(stable);
    }
    const trimmedName = name.trim();
    if (trimmedName.length > 0) {
        const escapedName = escapeLocatorValue(trimmedName);
        return `role=${role}[name="${escapedName}"]`;
    }
    return `role=${role}`;
}
function getAxValueString(value) {
    if (!value) {
        return '';
    }
    const raw = value.value;
    if (typeof raw === 'string') {
        return raw;
    }
    if (raw === undefined || raw === null) {
        return '';
    }
    return String(raw);
}
function getAxRole(node) {
    const role = getAxValueString(node.role);
    return role.toLowerCase();
}
function buildSnapshotLine({ role, name, baseLocator, indent, hasChildren }) {
    const prefix = '  '.repeat(indent);
    let text = `${prefix}- ${role}`;
    if (name) {
        const escapedName = name.replace(/"/g, '\\"');
        text += ` "${escapedName}"`;
    }
    return { text, baseLocator, hasChildren, role, name, indent };
}
function buildTextLine(text, indent) {
    const prefix = '  '.repeat(indent);
    const escaped = text.replace(/"/g, '\\"');
    return { text: `${prefix}- text: "${escaped}"` };
}
export function buildSnapshotLines(nodes, indent = 0) {
    return nodes.flatMap((node) => {
        const nodeIndent = indent + (node.indentOffset ?? 0);
        const line = node.role === 'text'
            ? buildTextLine(node.name, nodeIndent)
            : buildSnapshotLine({
                role: node.role,
                name: node.name,
                baseLocator: node.baseLocator,
                indent: nodeIndent,
                hasChildren: node.children.length > 0,
            });
        return [line, ...buildSnapshotLines(node.children, nodeIndent + 1)];
    });
}
function shiftIndent(nodes, offset) {
    return nodes.map((node) => {
        return { ...node, indentOffset: (node.indentOffset ?? 0) + offset };
    });
}
export function buildRawSnapshotTree(options) {
    const node = options.axById.get(options.nodeId);
    if (!node) {
        return null;
    }
    const role = getAxRole(node);
    const name = getAxValueString(node.name).trim();
    const children = (node.childIds ?? []).map((childId) => {
        return buildRawSnapshotTree({
            nodeId: childId,
            axById: options.axById,
            isNodeInScope: options.isNodeInScope,
        });
    }).filter(isTruthy);
    const inScope = options.isNodeInScope(node) || children.length > 0;
    if (!inScope) {
        return null;
    }
    return {
        role,
        name,
        backendNodeId: node.backendDOMNodeId,
        ignored: node.ignored,
        children,
    };
}
export function filterInteractiveSnapshotTree(options) {
    const role = options.node.role;
    const name = options.node.name;
    const hasName = name.length > 0;
    const nextAncestors = hasName ? [...options.ancestorNames, name] : options.ancestorNames;
    const isLabel = LABEL_ROLES.has(role);
    const nextLabelContext = options.labelContext || isLabel;
    const childResults = options.node.children.map((child) => {
        return filterInteractiveSnapshotTree({
            node: child,
            ancestorNames: nextAncestors,
            labelContext: nextLabelContext,
            refFilter: options.refFilter,
            domByBackendId: options.domByBackendId,
            createRefForNode: options.createRefForNode,
        });
    });
    const childNodes = childResults.flatMap((result) => {
        return result.nodes;
    });
    const childNames = childResults.reduce((acc, result) => {
        result.names.forEach((childName) => {
            acc.add(childName);
        });
        return acc;
    }, new Set());
    if (options.node.ignored) {
        return { nodes: shiftIndent(childNodes, 1), names: childNames };
    }
    if (isTextRole(role)) {
        if (!hasName) {
            return { nodes: childNodes, names: childNames };
        }
        if (!options.labelContext) {
            return { nodes: childNodes, names: childNames };
        }
        const isRedundantText = options.ancestorNames.some((ancestor) => {
            return ancestor.includes(name) || name.includes(ancestor);
        });
        if (isRedundantText) {
            return { nodes: childNodes, names: childNames };
        }
        const names = new Set(childNames);
        names.add(name);
        const textNode = { role: 'text', name, children: [] };
        return { nodes: [textNode], names };
    }
    const hasChildren = childNodes.length > 0;
    const nameToUse = hasName && (childNames.has(name) || isSubstringOfAny(name, childNames)) ? '' : name;
    const hasNameToUse = nameToUse.length > 0;
    const isWrapper = SKIP_WRAPPER_ROLES.has(role);
    const isInteractive = INTERACTIVE_ROLES.has(role);
    const isContext = CONTEXT_ROLES.has(role);
    const passesRefFilter = !options.refFilter || options.refFilter({ role, name });
    const includeInteractive = isInteractive && passesRefFilter;
    const shouldInclude = includeInteractive || isLabel || isContext || hasChildren;
    if (!shouldInclude) {
        return { nodes: childNodes, names: childNames };
    }
    if (!includeInteractive && !isLabel && !isContext) {
        if (!hasChildren) {
            return { nodes: [], names: childNames };
        }
        return { nodes: childNodes, names: childNames };
    }
    if (isWrapper && !hasNameToUse) {
        if (!hasChildren) {
            return { nodes: [], names: childNames };
        }
        return { nodes: childNodes, names: childNames };
    }
    let baseLocator;
    let ref = null;
    if (includeInteractive) {
        const domInfo = options.node.backendNodeId ? options.domByBackendId.get(options.node.backendNodeId) : undefined;
        const stable = domInfo ? getStableRefFromAttributes(domInfo.attributes) : null;
        baseLocator = buildBaseLocator({ role, name, stable });
        ref = options.createRefForNode({ backendNodeId: options.node.backendNodeId, role, name });
    }
    const nodeEntry = {
        role,
        name: nameToUse,
        baseLocator,
        ref: ref ?? undefined,
        backendNodeId: options.node.backendNodeId,
        children: childNodes,
    };
    const names = new Set(childNames);
    if (hasNameToUse) {
        names.add(nameToUse);
    }
    return { nodes: [nodeEntry], names };
}
export function filterFullSnapshotTree(options) {
    const role = options.node.role;
    const name = options.node.name;
    const hasName = name.length > 0;
    const nextAncestors = hasName ? [...options.ancestorNames, name] : options.ancestorNames;
    const childResults = options.node.children.map((child) => {
        return filterFullSnapshotTree({
            node: child,
            ancestorNames: nextAncestors,
            refFilter: options.refFilter,
            domByBackendId: options.domByBackendId,
            createRefForNode: options.createRefForNode,
        });
    });
    const childNodes = childResults.flatMap((result) => {
        return result.nodes;
    });
    const childNames = childResults.reduce((acc, result) => {
        result.names.forEach((childName) => {
            acc.add(childName);
        });
        return acc;
    }, new Set());
    if (options.node.ignored) {
        return { nodes: shiftIndent(childNodes, 1), names: childNames };
    }
    if (isTextRole(role)) {
        if (!hasName) {
            return { nodes: childNodes, names: childNames };
        }
        const isRedundantText = options.ancestorNames.some((ancestor) => {
            return ancestor.includes(name) || name.includes(ancestor);
        });
        if (isRedundantText) {
            return { nodes: childNodes, names: childNames };
        }
        const names = new Set(childNames);
        names.add(name);
        const textNode = { role: 'text', name, children: [] };
        return { nodes: [textNode], names };
    }
    const hasChildren = childNodes.length > 0;
    const nameToUse = hasName && (childNames.has(name) || isSubstringOfAny(name, childNames)) ? '' : name;
    const hasNameToUse = nameToUse.length > 0;
    const isWrapper = SKIP_WRAPPER_ROLES.has(role);
    const isInteractive = INTERACTIVE_ROLES.has(role);
    const passesRefFilter = !options.refFilter || options.refFilter({ role, name });
    const includeInteractive = isInteractive && passesRefFilter;
    const shouldInclude = includeInteractive || hasNameToUse || hasChildren;
    if (!shouldInclude) {
        return { nodes: childNodes, names: childNames };
    }
    if (isWrapper && !hasNameToUse) {
        if (!hasChildren) {
            return { nodes: [], names: childNames };
        }
        return { nodes: childNodes, names: childNames };
    }
    let baseLocator;
    let ref = null;
    if (includeInteractive) {
        const domInfo = options.node.backendNodeId ? options.domByBackendId.get(options.node.backendNodeId) : undefined;
        const stable = domInfo ? getStableRefFromAttributes(domInfo.attributes) : null;
        baseLocator = buildBaseLocator({ role, name, stable });
        ref = options.createRefForNode({ backendNodeId: options.node.backendNodeId, role, name });
    }
    const nodeEntry = {
        role,
        name: nameToUse,
        baseLocator,
        ref: ref ?? undefined,
        backendNodeId: options.node.backendNodeId,
        children: childNodes,
    };
    const names = new Set(childNames);
    if (hasNameToUse) {
        names.add(nameToUse);
    }
    return { nodes: [nodeEntry], names };
}
function buildLocatorLineText({ line, locator }) {
    const prefix = '  '.repeat(line.indent ?? 0);
    const role = line.role ?? '';
    const name = line.name ?? '';
    const escapedName = name.replace(/"/g, '\\"');
    const hasRoleInLocator = role ? locator.includes(role) : false;
    const hasNameInLocator = name ? locator.includes(escapedName) : false;
    const parts = [];
    if (role && !hasRoleInLocator) {
        parts.push(role);
    }
    if (name && !hasNameInLocator) {
        parts.push(`"${escapedName}"`);
    }
    const base = parts.length > 0 ? `${prefix}- ${parts.join(' ')}` : `${prefix}-`;
    return `${base} ${locator}`;
}
export function finalizeSnapshotOutput(lines, nodes, shortRefMap) {
    const locatorCounts = lines.reduce((acc, line) => {
        if (!line.baseLocator) {
            return acc;
        }
        acc.set(line.baseLocator, (acc.get(line.baseLocator) ?? 0) + 1);
        return acc;
    }, new Map());
    const locatorIndices = new Map();
    const locatorSequence = lines.reduce((acc, line) => {
        if (!line.baseLocator) {
            return acc;
        }
        const count = locatorCounts.get(line.baseLocator) ?? 0;
        const index = locatorIndices.get(line.baseLocator) ?? 0;
        locatorIndices.set(line.baseLocator, index + 1);
        const locator = count > 1 ? `${line.baseLocator} >> nth=${index}` : line.baseLocator;
        acc.push(locator);
        return acc;
    }, []);
    let lineLocatorIndex = 0;
    const snapshot = lines.map((line) => {
        let text = line.text;
        if (line.baseLocator) {
            const locator = locatorSequence[lineLocatorIndex];
            lineLocatorIndex += 1;
            text = buildLocatorLineText({ line, locator });
        }
        if (line.hasChildren) {
            text += ':';
        }
        return text;
    }).join('\n');
    let nodeLocatorIndex = 0;
    const applyLocators = (items) => {
        return items.map((item) => {
            const locator = item.baseLocator ? locatorSequence[nodeLocatorIndex++] : undefined;
            const children = applyLocators(item.children);
            return {
                role: item.role,
                name: item.name,
                locator,
                ref: item.ref,
                shortRef: item.ref ? (shortRefMap.get(item.ref) ?? item.ref) : undefined,
                backendNodeId: item.backendNodeId,
                children,
            };
        });
    };
    return { snapshot, tree: applyLocators(nodes) };
}
function buildDomIndex(nodes) {
    const domById = new Map();
    const domByBackendId = new Map();
    const childrenByParent = new Map();
    for (const node of nodes) {
        const info = {
            nodeId: node.nodeId,
            parentId: node.parentId,
            backendNodeId: node.backendNodeId,
            nodeName: node.nodeName,
            attributes: toAttributeMap(node.attributes),
        };
        domById.set(node.nodeId, info);
        domByBackendId.set(node.backendNodeId, info);
        if (node.parentId) {
            if (!childrenByParent.has(node.parentId)) {
                childrenByParent.set(node.parentId, []);
            }
            childrenByParent.get(node.parentId).push(node.nodeId);
        }
    }
    return { domById, domByBackendId, childrenByParent };
}
function findScopeRootNodeId(nodes, attrName, attrValue) {
    for (const node of nodes) {
        if (!node.attributes) {
            continue;
        }
        for (let i = 0; i < node.attributes.length; i += 2) {
            const name = node.attributes[i];
            const value = node.attributes[i + 1];
            if (name === attrName && value === attrValue) {
                return node.nodeId;
            }
        }
    }
    return null;
}
function buildBackendIdSet(rootNodeId, childrenByParent, domById) {
    const result = new Set();
    const stack = [rootNodeId];
    while (stack.length > 0) {
        const current = stack.pop();
        if (current === undefined) {
            continue;
        }
        const node = domById.get(current);
        if (node) {
            result.add(node.backendNodeId);
        }
        const children = childrenByParent.get(current);
        if (children && children.length > 0) {
            stack.push(...children);
        }
    }
    return result;
}
function isTextRole(role) {
    return role === 'statictext' || role === 'inlinetextbox';
}
function isSubstringOfAny(needle, haystack) {
    for (const str of haystack) {
        if (str.includes(needle)) {
            return true;
        }
    }
    return false;
}
// ============================================================================
// Main Functions
// ============================================================================
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
export async function getAriaSnapshot({ page, locator, refFilter, wsUrl, interactiveOnly = false, cdp }) {
    const session = cdp || await getCDPSessionForPage({ page, wsUrl });
    await session.send('DOM.enable');
    await session.send('Accessibility.enable');
    const scopeAttr = 'data-pw-scope';
    const scopeValue = crypto.randomUUID();
    let scopeApplied = false;
    try {
        if (locator) {
            await locator.evaluate((element, data) => {
                element.setAttribute(data.attr, data.value);
            }, { attr: scopeAttr, value: scopeValue });
            scopeApplied = true;
        }
        const { nodes: domNodes } = await session.send('DOM.getFlattenedDocument', { depth: -1, pierce: true });
        const { domById, domByBackendId, childrenByParent } = buildDomIndex(domNodes);
        let scopeRootNodeId = null;
        let scopeRootBackendId = null;
        if (locator) {
            scopeRootNodeId = findScopeRootNodeId(domNodes, scopeAttr, scopeValue);
            if (scopeRootNodeId) {
                const scopeNode = domById.get(scopeRootNodeId);
                if (scopeNode) {
                    scopeRootBackendId = scopeNode.backendNodeId;
                }
            }
        }
        const allowedBackendIds = scopeRootNodeId
            ? buildBackendIdSet(scopeRootNodeId, childrenByParent, domById)
            : null;
        const { nodes: axNodes } = await session.send('Accessibility.getFullAXTree');
        const axById = new Map();
        for (const node of axNodes) {
            axById.set(node.nodeId, node);
        }
        const findRootAxNodeId = () => {
            if (scopeRootBackendId) {
                const scoped = axNodes.find((node) => {
                    return node.backendDOMNodeId === scopeRootBackendId;
                });
                if (scoped) {
                    return scoped.nodeId;
                }
            }
            const rootWebArea = axNodes.find((node) => {
                return getAxRole(node) === 'rootwebarea';
            });
            if (rootWebArea) {
                return rootWebArea.nodeId;
            }
            const webArea = axNodes.find((node) => {
                return getAxRole(node) === 'webarea';
            });
            if (webArea) {
                return webArea.nodeId;
            }
            const topLevel = axNodes.find((node) => {
                return !node.parentId;
            });
            return topLevel ? topLevel.nodeId : null;
        };
        const rootAxNodeId = findRootAxNodeId();
        const refCounts = new Map();
        let fallbackCounter = 0;
        const refs = [];
        const createRefForNode = (options) => {
            if (!INTERACTIVE_ROLES.has(options.role)) {
                return null;
            }
            const domInfo = options.backendNodeId ? domByBackendId.get(options.backendNodeId) : undefined;
            const stable = domInfo ? getStableRefFromAttributes(domInfo.attributes) : null;
            let baseRef = stable?.value;
            if (!baseRef) {
                fallbackCounter += 1;
                baseRef = `e${fallbackCounter}`;
            }
            const count = refCounts.get(baseRef) ?? 0;
            refCounts.set(baseRef, count + 1);
            const ref = count === 0 ? baseRef : `${baseRef}-${count + 1}`;
            let selector;
            if (stable && count === 0) {
                selector = buildLocatorFromStable(stable);
            }
            refs.push({ ref, role: options.role, name: options.name, selector, backendNodeId: options.backendNodeId });
            return ref;
        };
        const isNodeInScope = (node) => {
            if (!allowedBackendIds) {
                return true;
            }
            if (!node.backendDOMNodeId) {
                return false;
            }
            return allowedBackendIds.has(node.backendDOMNodeId);
        };
        let snapshotNodes = [];
        if (rootAxNodeId) {
            const rootNode = axById.get(rootAxNodeId);
            const rootRole = rootNode ? getAxRole(rootNode) : '';
            const rawRoots = rootNode && (rootRole === 'rootwebarea' || rootRole === 'webarea') && rootNode.childIds
                ? rootNode.childIds.map((childId) => {
                    return buildRawSnapshotTree({ nodeId: childId, axById, isNodeInScope });
                }).filter(isTruthy)
                : [buildRawSnapshotTree({ nodeId: rootAxNodeId, axById, isNodeInScope })].filter(isTruthy);
            const filtered = rawRoots.flatMap((rawNode) => {
                if (interactiveOnly) {
                    return filterInteractiveSnapshotTree({
                        node: rawNode,
                        ancestorNames: [],
                        labelContext: false,
                        refFilter,
                        domByBackendId,
                        createRefForNode,
                    }).nodes;
                }
                return filterFullSnapshotTree({
                    node: rawNode,
                    ancestorNames: [],
                    refFilter,
                    domByBackendId,
                    createRefForNode,
                }).nodes;
            });
            snapshotNodes = filtered;
        }
        const snapshotLines = buildSnapshotLines(snapshotNodes);
        const shortRefMap = buildShortRefMap({ refs });
        const finalized = finalizeSnapshotOutput(snapshotLines, snapshotNodes, shortRefMap);
        const refsWithShortRef = refs.map((entry) => {
            return {
                ...entry,
                shortRef: shortRefMap.get(entry.ref) ?? entry.ref,
            };
        });
        const result = { snapshot: finalized.snapshot, tree: finalized.tree, refs: refsWithShortRef };
        // Build refToElement map
        const refToElement = new Map();
        const refToSelector = new Map();
        for (const { ref, role, name, shortRef } of result.refs) {
            if (!refFilter || refFilter({ role, name })) {
                refToElement.set(ref, { role, name, shortRef });
            }
        }
        for (const { ref, selector } of result.refs) {
            if (!selector) {
                continue;
            }
            refToSelector.set(ref, selector);
        }
        const snapshot = result.snapshot;
        const getSelectorForRef = (ref) => {
            const mapped = refToSelector.get(ref);
            if (mapped) {
                return mapped;
            }
            const info = refToElement.get(ref);
            if (!info) {
                return null;
            }
            const escapedName = info.name.replace(/"/g, '\\"');
            return `role=${info.role}[name="${escapedName}"]`;
        };
        const getRefsForLocators = async (locators) => {
            if (locators.length === 0) {
                return [];
            }
            const targetHandles = await Promise.all(locators.map(async (loc) => {
                try {
                    return 'elementHandle' in loc
                        ? await loc.elementHandle({ timeout: 1000 })
                        : loc;
                }
                catch {
                    return null;
                }
            }));
            const matchingRefs = await page.evaluate(({ targets, refData }) => {
                return targets.map((target) => {
                    if (!target) {
                        return null;
                    }
                    const testIdAttrs = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-pw', 'data-qa', 'data-e2e', 'data-automation-id'];
                    for (const attr of testIdAttrs) {
                        const value = target.getAttribute(attr);
                        if (value) {
                            const match = refData.find((ref) => {
                                return ref.ref === value || ref.ref.startsWith(value);
                            });
                            if (match) {
                                return match.ref;
                            }
                        }
                    }
                    const id = target.getAttribute('id');
                    if (id) {
                        const match = refData.find((ref) => {
                            return ref.ref === id || ref.ref.startsWith(id);
                        });
                        if (match) {
                            return match.ref;
                        }
                    }
                    return null;
                });
            }, {
                targets: targetHandles,
                refData: result.refs,
            });
            return matchingRefs.map((ref) => {
                if (!ref) {
                    return null;
                }
                const info = refToElement.get(ref);
                return info ? { ...info, ref } : null;
            });
        };
        return {
            snapshot,
            tree: result.tree,
            refs: result.refs,
            refToElement,
            refToSelector,
            getSelectorForRef,
            getRefsForLocators,
            getRefForLocator: async (loc) => (await getRefsForLocators([loc]))[0],
            getRefStringForLocator: async (loc) => (await getRefsForLocators([loc]))[0]?.ref ?? null,
        };
    }
    finally {
        if (scopeApplied && locator) {
            await locator.evaluate((element, attr) => {
                element.removeAttribute(attr);
            }, scopeAttr);
        }
        if (!cdp) {
            await session.detach();
        }
    }
}
function buildBoxFromQuad(quad) {
    if (!quad || quad.length < 8) {
        return null;
    }
    const xs = [quad[0], quad[2], quad[4], quad[6]];
    const ys = [quad[1], quad[3], quad[5], quad[7]];
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    return {
        x: left,
        y: top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
}
function isTruthy(value) {
    return Boolean(value);
}
async function getLabelBoxesForRefs({ page, refs, wsUrl, maxConcurrency = MAX_LABEL_POSITION_CONCURRENCY, logger, cdp, }) {
    const log = logger?.info ?? logger?.error ?? console.error;
    const session = cdp || await getCDPSessionForPage({ page, wsUrl });
    const sema = new Sema(maxConcurrency);
    const labelRefs = refs.filter((ref) => {
        return Boolean(ref.backendNodeId) && INTERACTIVE_ROLES.has(ref.role);
    });
    log(`[getLabelBoxesForRefs] processing ${labelRefs.length} interactive refs (concurrency: ${maxConcurrency})`);
    const startTime = Date.now();
    let completed = 0;
    let timedOut = 0;
    let failed = 0;
    try {
        const labels = await Promise.all(labelRefs.map(async (ref) => {
            if (!ref.backendNodeId) {
                return null;
            }
            await sema.acquire();
            try {
                const response = await Promise.race([
                    session.send('DOM.getBoxModel', { backendNodeId: ref.backendNodeId }),
                    new Promise((resolve) => {
                        setTimeout(() => { resolve(null); }, BOX_MODEL_TIMEOUT_MS);
                    }),
                ]);
                completed++;
                if (completed % 50 === 0 || completed === labelRefs.length) {
                    log(`[getLabelBoxesForRefs] progress: ${completed}/${labelRefs.length} (${timedOut} timeouts, ${failed} errors) - ${Date.now() - startTime}ms`);
                }
                if (!response) {
                    timedOut++;
                    return null;
                }
                const box = buildBoxFromQuad(response.model.border);
                if (!box) {
                    return null;
                }
                return { ref: ref.ref, role: ref.role, box };
            }
            catch (error) {
                completed++;
                failed++;
                return null;
            }
            finally {
                sema.release();
            }
        }));
        log(`[getLabelBoxesForRefs] done: ${completed} completed, ${timedOut} timeouts, ${failed} errors - ${Date.now() - startTime}ms`);
        return labels.filter(isTruthy);
    }
    finally {
        if (!cdp) {
            await session.detach();
        }
    }
}
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
export async function showAriaRefLabels({ page, locator, interactiveOnly = true, wsUrl, logger }) {
    const startTime = Date.now();
    const log = logger?.info ?? logger?.error ?? console.error;
    log(`[showAriaRefLabels] starting...`);
    await ensureA11yClient(page);
    log(`[showAriaRefLabels] ensureA11yClient: ${Date.now() - startTime}ms`);
    const cdpStart = Date.now();
    const cdp = await getCDPSessionForPage({ page, wsUrl });
    log(`[showAriaRefLabels] getCDPSessionForPage: ${Date.now() - cdpStart}ms`);
    try {
        const snapshotStart = Date.now();
        const { snapshot, refs } = await getAriaSnapshot({ page, locator, interactiveOnly, wsUrl, cdp });
        const shortRefMap = new Map(refs.map((entry) => {
            return [entry.ref, entry.shortRef];
        }));
        const interactiveRefs = refs.filter((ref) => Boolean(ref.backendNodeId) && INTERACTIVE_ROLES.has(ref.role));
        log(`[showAriaRefLabels] getAriaSnapshot: ${Date.now() - snapshotStart}ms (${refs.length} refs, ${interactiveRefs.length} interactive)`);
        const rootHandle = locator ? await locator.elementHandle() : null;
        const labelsStart = Date.now();
        const labels = await getLabelBoxesForRefs({ page, refs, wsUrl, logger, cdp });
        const shortLabels = labels.map((label) => {
            return {
                ...label,
                ref: shortRefMap.get(label.ref) ?? label.ref,
            };
        });
        log(`[showAriaRefLabels] getLabelBoxesForRefs: ${Date.now() - labelsStart}ms (${labels.length} boxes)`);
        const renderStart = Date.now();
        const labelCount = await page.evaluate(({ entries, root, interactiveOnly: intOnly }) => {
            const a11y = globalThis.__a11y;
            if (a11y?.renderA11yLabels) {
                return a11y.renderA11yLabels(entries);
            }
            if (a11y?.computeA11ySnapshot) {
                const rootElement = root || document.body;
                return a11y.computeA11ySnapshot({ root: rootElement, interactiveOnly: intOnly, renderLabels: true }).labelCount;
            }
            throw new Error('a11y client not loaded');
        }, { entries: shortLabels, root: rootHandle, interactiveOnly });
        log(`[showAriaRefLabels] renderA11yLabels: ${Date.now() - renderStart}ms (${labelCount} labels)`);
        log(`[showAriaRefLabels] total: ${Date.now() - startTime}ms`);
        return { snapshot, labelCount };
    }
    finally {
        await cdp.detach();
    }
}
/**
 * Remove all aria ref labels from the page.
 */
export async function hideAriaRefLabels({ page }) {
    await page.evaluate(() => {
        const a11y = globalThis.__a11y;
        if (a11y) {
            a11y.hideA11yLabels();
        }
        else {
            // Fallback if client not loaded
            const doc = document;
            const win = window;
            const timerKey = '__playwriter_labels_timer__';
            if (win[timerKey]) {
                win.clearTimeout(win[timerKey]);
                win[timerKey] = null;
            }
            doc.getElementById('__playwriter_labels__')?.remove();
        }
    });
}
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
export async function screenshotWithAccessibilityLabels({ page, locator, interactiveOnly = true, wsUrl, collector, logger }) {
    const log = logger?.info ?? logger?.error;
    const showLabelsStart = Date.now();
    const { snapshot, labelCount } = await showAriaRefLabels({ page, locator, interactiveOnly, wsUrl, logger });
    if (log) {
        log(`showAriaRefLabels: ${Date.now() - showLabelsStart}ms`);
    }
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 6);
    const filename = `playwriter-screenshot-${timestamp}-${random}.jpg`;
    // Use ./tmp folder (gitignored) instead of system temp
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    const screenshotPath = path.join(tmpDir, filename);
    // Get viewport size to clip screenshot to visible area
    const viewport = await page.evaluate('({ width: window.innerWidth, height: window.innerHeight })');
    // Max 1568px on any edge (larger gets auto-resized by Claude, adding latency)
    // Token formula: tokens = (width * height) / 750
    const MAX_DIMENSION = 1568;
    // Check if sharp is available for resizing
    const sharp = await sharpPromise;
    // Clip dimensions: if sharp unavailable, limit capture area to MAX_DIMENSION
    const clipWidth = sharp ? viewport.width : Math.min(viewport.width, MAX_DIMENSION);
    const clipHeight = sharp ? viewport.height : Math.min(viewport.height, MAX_DIMENSION);
    // Take viewport screenshot with scale: 'css' to ignore device pixel ratio
    const screenshotStart = Date.now();
    const rawBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 80,
        scale: 'css',
        clip: { x: 0, y: 0, width: clipWidth, height: clipHeight },
    });
    if (log) {
        log(`page.screenshot: ${Date.now() - screenshotStart}ms`);
    }
    // Resize with sharp if available, otherwise use clipped raw buffer
    const resizeStart = Date.now();
    const buffer = await (async () => {
        if (!sharp) {
            logger?.error?.('[playwriter] sharp not available, using clipped screenshot (max', MAX_DIMENSION, 'px)');
            return rawBuffer;
        }
        try {
            return await sharp(rawBuffer)
                .resize({
                width: MAX_DIMENSION,
                height: MAX_DIMENSION,
                fit: 'inside',
                withoutEnlargement: true, // Don't upscale small images
            })
                .jpeg({ quality: 80 })
                .toBuffer();
        }
        catch (err) {
            logger?.error?.('[playwriter] sharp resize failed, using raw buffer:', err);
            return rawBuffer;
        }
    })();
    if (log) {
        log(`screenshot resize: ${Date.now() - resizeStart}ms`);
    }
    // Save to file
    fs.writeFileSync(screenshotPath, buffer);
    // Convert to base64
    const base64 = buffer.toString('base64');
    // Hide labels
    await hideAriaRefLabels({ page });
    // Add to collector array
    collector.push({
        path: screenshotPath,
        base64,
        mimeType: 'image/jpeg',
        snapshot,
        labelCount,
    });
}
// Re-export for backward compatibility
export { getAriaSnapshot as getAriaSnapshotWithRefs };
//# sourceMappingURL=aria-snapshot.js.map