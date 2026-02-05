import { describe, expect, it } from 'vitest';
import { buildRawSnapshotTree, buildSnapshotLines, filterFullSnapshotTree, filterInteractiveSnapshotTree, finalizeSnapshotOutput, } from './aria-snapshot.js';
const roleValue = (value) => {
    return { type: 'role', value };
};
const nameValue = (value) => {
    return { type: 'string', value };
};
describe('aria-snapshot tree filters', () => {
    it('builds a raw snapshot tree with scope pruning', () => {
        const rootId = '1';
        const mainId = '2';
        const navId = '3';
        const listId = '4';
        const listItemId = '5';
        const linkId = '6';
        const headingId = '7';
        const buttonId = '8';
        const axById = new Map([
            [rootId, {
                    nodeId: rootId,
                    ignored: false,
                    role: roleValue('rootwebarea'),
                    childIds: [mainId, navId],
                }],
            [mainId, {
                    nodeId: mainId,
                    ignored: false,
                    role: roleValue('main'),
                    childIds: [headingId, buttonId],
                    backendDOMNodeId: 200,
                }],
            [navId, {
                    nodeId: navId,
                    ignored: false,
                    role: roleValue('navigation'),
                    childIds: [listId],
                    backendDOMNodeId: 201,
                }],
            [listId, {
                    nodeId: listId,
                    ignored: false,
                    role: roleValue('list'),
                    childIds: [listItemId],
                    backendDOMNodeId: 202,
                }],
            [listItemId, {
                    nodeId: listItemId,
                    ignored: false,
                    role: roleValue('listitem'),
                    childIds: [linkId],
                    backendDOMNodeId: 203,
                }],
            [linkId, {
                    nodeId: linkId,
                    ignored: false,
                    role: roleValue('link'),
                    name: nameValue('Docs'),
                    backendDOMNodeId: 204,
                }],
            [headingId, {
                    nodeId: headingId,
                    ignored: false,
                    role: roleValue('heading'),
                    name: nameValue('Title'),
                    backendDOMNodeId: 205,
                }],
            [buttonId, {
                    nodeId: buttonId,
                    ignored: false,
                    role: roleValue('button'),
                    name: nameValue('Submit'),
                    backendDOMNodeId: 206,
                }],
        ]);
        const allowed = new Set([204]);
        const isNodeInScope = (node) => {
            return Boolean(node.backendDOMNodeId && allowed.has(node.backendDOMNodeId));
        };
        const rawTree = buildRawSnapshotTree({ nodeId: rootId, axById, isNodeInScope });
        expect(rawTree).toMatchInlineSnapshot(`
      {
        "backendNodeId": undefined,
        "children": [
          {
            "backendNodeId": 201,
            "children": [
              {
                "backendNodeId": 202,
                "children": [
                  {
                    "backendNodeId": 203,
                    "children": [
                      {
                        "backendNodeId": 204,
                        "children": [],
                        "ignored": false,
                        "name": "Docs",
                        "role": "link",
                      },
                    ],
                    "ignored": false,
                    "name": "",
                    "role": "listitem",
                  },
                ],
                "ignored": false,
                "name": "",
                "role": "list",
              },
            ],
            "ignored": false,
            "name": "",
            "role": "navigation",
          },
        ],
        "ignored": false,
        "name": "",
        "role": "rootwebarea",
      }
    `);
    });
    it('filters interactive-only trees with labels and wrapper hoisting', () => {
        const rawTree = {
            role: 'main',
            name: '',
            ignored: false,
            children: [
                {
                    role: 'navigation',
                    name: '',
                    ignored: false,
                    children: [
                        { role: 'link', name: 'Home', backendNodeId: 2, children: [] },
                    ],
                },
                {
                    role: 'labeltext',
                    name: '',
                    ignored: false,
                    children: [
                        { role: 'statictext', name: 'Email', ignored: false, children: [] },
                    ],
                },
                {
                    role: 'generic',
                    name: '',
                    ignored: false,
                    children: [
                        { role: 'button', name: 'Save', backendNodeId: 1, children: [] },
                    ],
                },
                {
                    role: 'generic',
                    name: 'Wrapper',
                    ignored: false,
                    children: [
                        { role: 'statictext', name: 'Wrapper', ignored: false, children: [] },
                        { role: 'statictext', name: 'Hint', ignored: false, children: [] },
                    ],
                },
                {
                    role: 'generic',
                    name: '',
                    ignored: true,
                    children: [
                        { role: 'button', name: 'Ignored Action', backendNodeId: 3, children: [] },
                    ],
                },
                { role: 'heading', name: 'Settings', ignored: false, children: [] },
            ],
        };
        const domByBackendId = new Map([
            [1, {
                    nodeId: 10,
                    backendNodeId: 1,
                    nodeName: 'BUTTON',
                    attributes: new Map([['id', 'save-btn']]),
                }],
            [2, {
                    nodeId: 11,
                    backendNodeId: 2,
                    nodeName: 'A',
                    attributes: new Map([['data-testid', 'nav-home']]),
                }],
            [3, {
                    nodeId: 12,
                    backendNodeId: 3,
                    nodeName: 'BUTTON',
                    attributes: new Map([['id', 'ignored-action']]),
                }],
        ]);
        let refCounter = 0;
        const createRefForNode = (options) => {
            refCounter += 1;
            return `${options.role}-${options.name}-${refCounter}`;
        };
        const filtered = filterInteractiveSnapshotTree({
            node: rawTree,
            ancestorNames: [],
            labelContext: false,
            domByBackendId,
            createRefForNode,
        });
        expect(filtered).toMatchInlineSnapshot(`
      {
        "names": Set {
          "Home",
          "Email",
          "Save",
          "Ignored Action",
        },
        "nodes": [
          {
            "backendNodeId": undefined,
            "baseLocator": undefined,
            "children": [
              {
                "backendNodeId": undefined,
                "baseLocator": undefined,
                "children": [
                  {
                    "backendNodeId": 2,
                    "baseLocator": "[data-testid="nav-home"]",
                    "children": [],
                    "name": "Home",
                    "ref": "link-Home-1",
                    "role": "link",
                  },
                ],
                "name": "",
                "ref": undefined,
                "role": "navigation",
              },
              {
                "backendNodeId": undefined,
                "baseLocator": undefined,
                "children": [
                  {
                    "children": [],
                    "name": "Email",
                    "role": "text",
                  },
                ],
                "name": "",
                "ref": undefined,
                "role": "labeltext",
              },
              {
                "backendNodeId": 1,
                "baseLocator": "[id="save-btn"]",
                "children": [],
                "name": "Save",
                "ref": "button-Save-2",
                "role": "button",
              },
              {
                "backendNodeId": 3,
                "baseLocator": "[id="ignored-action"]",
                "children": [],
                "indentOffset": 1,
                "name": "Ignored Action",
                "ref": "button-Ignored Action-3",
                "role": "button",
              },
            ],
            "name": "",
            "ref": undefined,
            "role": "main",
          },
        ],
      }
    `);
    });
    it('generates locator output for full snapshot trees', () => {
        const rawTree = {
            role: 'form',
            name: 'Account',
            ignored: false,
            children: [
                { role: 'textbox', name: 'Email', backendNodeId: 2, children: [] },
                {
                    role: 'group',
                    name: '',
                    ignored: false,
                    children: [
                        { role: 'button', name: 'Save', backendNodeId: 3, children: [] },
                        { role: 'button', name: 'Save', backendNodeId: 4, children: [] },
                    ],
                },
            ],
        };
        const domByBackendId = new Map([
            [2, {
                    nodeId: 20,
                    backendNodeId: 2,
                    nodeName: 'INPUT',
                    attributes: new Map([['data-testid', 'email-input']]),
                }],
            [3, {
                    nodeId: 21,
                    backendNodeId: 3,
                    nodeName: 'BUTTON',
                    attributes: new Map([['id', 'save-primary']]),
                }],
            [4, {
                    nodeId: 22,
                    backendNodeId: 4,
                    nodeName: 'BUTTON',
                    attributes: new Map([['id', 'save-secondary']]),
                }],
        ]);
        let refCounter = 0;
        const createRefForNode = () => {
            refCounter += 1;
            return `e${refCounter}`;
        };
        const filtered = filterFullSnapshotTree({
            node: rawTree,
            ancestorNames: [],
            domByBackendId,
            createRefForNode,
        });
        const lines = buildSnapshotLines(filtered.nodes);
        const result = finalizeSnapshotOutput(lines, filtered.nodes, new Map());
        expect(result.snapshot).toMatchInlineSnapshot(`
      "- form "Account":
        - textbox "Email" [data-testid="email-input"]
        - button "Save" [id="save-primary"]
        - button "Save" [id="save-secondary"]"
    `);
        expect(result).toMatchInlineSnapshot(`
      {
        "snapshot": "- form "Account":
        - textbox "Email" [data-testid="email-input"]
        - button "Save" [id="save-primary"]
        - button "Save" [id="save-secondary"]",
        "tree": [
          {
            "backendNodeId": undefined,
            "children": [
              {
                "backendNodeId": 2,
                "children": [],
                "locator": "[data-testid="email-input"]",
                "name": "Email",
                "ref": "e1",
                "role": "textbox",
                "shortRef": "e1",
              },
              {
                "backendNodeId": 3,
                "children": [],
                "locator": "[id="save-primary"]",
                "name": "Save",
                "ref": "e2",
                "role": "button",
                "shortRef": "e2",
              },
              {
                "backendNodeId": 4,
                "children": [],
                "locator": "[id="save-secondary"]",
                "name": "Save",
                "ref": "e3",
                "role": "button",
                "shortRef": "e3",
              },
            ],
            "locator": undefined,
            "name": "Account",
            "ref": undefined,
            "role": "form",
            "shortRef": undefined,
          },
        ],
      }
    `);
    });
    it('drops redundant text and preserves named wrappers in full snapshots', () => {
        const rawTree = {
            role: 'section',
            name: 'Billing',
            ignored: false,
            children: [
                {
                    role: 'generic',
                    name: 'Card',
                    ignored: false,
                    children: [
                        { role: 'statictext', name: 'Card', ignored: false, children: [] },
                        { role: 'statictext', name: 'Card number', ignored: false, children: [] },
                    ],
                },
            ],
        };
        const domByBackendId = new Map();
        const createRefForNode = () => {
            return null;
        };
        const filtered = filterFullSnapshotTree({
            node: rawTree,
            ancestorNames: [],
            domByBackendId,
            createRefForNode,
        });
        expect(filtered).toMatchInlineSnapshot(`
      {
        "names": Set {
          "Card",
          "Billing",
        },
        "nodes": [
          {
            "backendNodeId": undefined,
            "baseLocator": undefined,
            "children": [
              {
                "backendNodeId": undefined,
                "baseLocator": undefined,
                "children": [],
                "name": "Card",
                "ref": undefined,
                "role": "generic",
              },
            ],
            "name": "Billing",
            "ref": undefined,
            "role": "section",
          },
        ],
      }
    `);
    });
    it('respects refFilter in interactive-only snapshots', () => {
        const rawTree = {
            role: 'main',
            name: '',
            ignored: false,
            children: [
                { role: 'button', name: 'Delete', backendNodeId: 5, children: [] },
                { role: 'button', name: 'Save', backendNodeId: 6, children: [] },
            ],
        };
        const domByBackendId = new Map([
            [5, {
                    nodeId: 30,
                    backendNodeId: 5,
                    nodeName: 'BUTTON',
                    attributes: new Map([['id', 'delete']]),
                }],
            [6, {
                    nodeId: 31,
                    backendNodeId: 6,
                    nodeName: 'BUTTON',
                    attributes: new Map([['id', 'save']]),
                }],
        ]);
        let refCounter = 0;
        const createRefForNode = () => {
            refCounter += 1;
            return `e${refCounter}`;
        };
        const filtered = filterInteractiveSnapshotTree({
            node: rawTree,
            ancestorNames: [],
            labelContext: false,
            domByBackendId,
            createRefForNode,
            refFilter: ({ name }) => name !== 'Delete',
        });
        expect(filtered).toMatchInlineSnapshot(`
      {
        "names": Set {
          "Save",
        },
        "nodes": [
          {
            "backendNodeId": undefined,
            "baseLocator": undefined,
            "children": [
              {
                "backendNodeId": 6,
                "baseLocator": "[id="save"]",
                "children": [],
                "name": "Save",
                "ref": "e1",
                "role": "button",
              },
            ],
            "name": "",
            "ref": undefined,
            "role": "main",
          },
        ],
      }
    `);
    });
});
//# sourceMappingURL=aria-snapshot.unit.test.js.map