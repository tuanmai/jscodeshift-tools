import { concat, flow, uniq } from "lodash/fp";

import {
  createImportNode,
  findImport,
  findImportSpecifier
} from "./importUtils";

const addImportSetDisplayName = (j, root) => {
  const importRecompose = findImport(j, root, "recompose");
  const recomposeSpecifiers = findImportSpecifier(j, importRecompose);
  importRecompose.replaceWith(() => {
    const newMethods = flow(concat("setDisplayName"), uniq)(
      recomposeSpecifiers
    );
    return createImportNode(j, newMethods, "recompose");
  });
};

const findComponentName = (j, root, node) => {
  if (node.parentPath.value.type === "VariableDeclarator") {
    const enhanceName = node.parentPath.value.id.name;
    const enhancer = root.find(j.CallExpression, {
      callee: {
        name: enhanceName
      }
    });
    if (enhancer.length < 1) return null;
    return enhancer.get().value.arguments[0].name;
  }

  if (node.parentPath.value.type === "CallExpression") {
    return node.parentPath.value.arguments[0].name;
  }
  return null;
};

export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const useCompose = root.find(j.CallExpression, {
    callee: {
      name: "compose"
    }
  });
  if (useCompose.length < 1) return file.source;

  useCompose.replaceWith(node => {
    const args = node.node.arguments;
    const componentName = findComponentName(j, root, node);
    if (componentName === null) {
      return j.callExpression(j.identifier("compose"), args);
    }
    if (
      args[0].type === "CallExpression" &&
      args[0].callee.name === "setStatic"
    ) {
      return j.callExpression(j.identifier("compose"), args);
    }
    if (
      args[0].type === "CallExpression" &&
      args[0].callee.name === "setDisplayName"
    ) {
      return j.callExpression(j.identifier("compose"), args);
    }
    const newArgs = [
      j.callExpression(j.identifier("setDisplayName"), [
        j.literal(componentName)
      ]),
      ...args
    ];
    addImportSetDisplayName(j, root);
    return j.callExpression(j.identifier("compose"), newArgs);
  });

  // return file.source;
  return root.toSource({ quote: "single" });
};
