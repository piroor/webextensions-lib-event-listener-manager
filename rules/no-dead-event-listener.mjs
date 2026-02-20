import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* eslint-disable no-underscore-dangle */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/* eslint-enable no-underscore-dangle */


let analyzed = false;
const dispatchedNames = new Set();
const listenedNames = new Set();

function analyzeProject() {
  if (analyzed) return;
  analyzed = true;

  const basePath = path.resolve(__dirname, '../../..');

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (['node_modules', 'extlib', 'submodules'].includes(name) || name.startsWith('.')) continue;
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (name.endsWith('.js') || name.endsWith('.mjs')) {
        const content = fs.readFileSync(fullPath, 'utf8');

        // Match obj.dispatch(...)
        for (const match of content.matchAll(/([a-zA-Z0-9_$]+)\.dispatch\s*\(/g)) {
          dispatchedNames.add(match[1]);
        }

        // Match obj.addListener(...) or obj.addEventListener(...)
        for (const match of content.matchAll(/([a-zA-Z0-9_$]+)\.(?:addListener|addEventListener)\s*\(/g)) {
          listenedNames.add(match[1]);
        }
      }
    }
  }

  scanDir(basePath);
}

function getInstanceName(node) {
  let parent = node.parent;
  if (!parent) return null;

  if (parent.type === 'LogicalExpression' || parent.type === 'ConditionalExpression') {
    parent = parent.parent;
  }

  if (parent.type === 'VariableDeclarator') {
    return parent.id.name;
  } else if (parent.type === 'AssignmentExpression') {
    if (parent.left.type === 'Identifier') {
      return parent.left.name;
    } else if (parent.left.type === 'MemberExpression') {
      return parent.left.property.name;
    }
  } else if (parent.type === 'PropertyDefinition') {
    return parent.key.name;
  }
  return null;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow dead EventListenerManagers that are never dispatched or listened to',
    },
    schema: [],
  },
  create(context) {
    analyzeProject();

    return {
      NewExpression(node) {
        if (node.callee.name === 'EventListenerManager') {
          const instanceName = getInstanceName(node);
          if (instanceName) {
            if (!dispatchedNames.has(instanceName)) {
              context.report({
                node,
                message: `EventListenerManager '${instanceName}' is never dispatched.`,
              });
            } else if (!listenedNames.has(instanceName)) {
              context.report({
                node,
                message: `EventListenerManager '${instanceName}' is never listened to.`,
              });
            }
          }
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'dispatch'
        ) {
          const obj = node.callee.object;
          let instanceName = null;
          if (obj.type === 'Identifier') {
            instanceName = obj.name;
          } else if (obj.type === 'MemberExpression') {
            instanceName = obj.property.name;
          }
          if (instanceName && !listenedNames.has(instanceName)) {
            context.report({
              node,
              message: `dispatch is called on '${instanceName}' but it is never listened to anywhere.`,
            });
          }
        }
      }
    };
  }
};
