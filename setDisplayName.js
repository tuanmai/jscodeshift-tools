import {
  concat, difference, filter, flow, uniq,
} from 'lodash/fp';


const findImportSpecifier = (j, node) => {
  const arr = [];
  node.find(j.ImportSpecifier).forEach(n => arr.push(n.value.imported.name));
  return arr;
};

const findImport = (j, root, packageName) => root.find(j.ImportDeclaration,
  node => node.source.value === packageName);

const createImportNode = (j, methods, packageName) => {
  const specifiers = methods.map(name => j.importSpecifier(j.identifier(name)));
  return j.importDeclaration(specifiers, j.literal(packageName));
};

const addImportSetDisplayName = (j, root) => {
  const importRecompose = findImport(j, root, 'recompose');
  const recomposeSpecifiers = findImportSpecifier(j, importRecompose);
  importRecompose.replaceWith(() => {
    const newMethods = flow(
      concat('setDisplayName'),
      uniq,
    )(recomposeSpecifiers);
    return createImportNode(j, newMethods, 'recompose');
  });
};

const findComponentName = (j, root, node) => {
  if (node.parentPath.value.type === 'VariableDeclarator') {
    const enhanceName = node.parentPath.value.id.name;
    const enhancer = root
      .find(j.CallExpression, {
        callee: {
          name: enhanceName,
        },
      });
    if (enhancer.length < 1) return null;
    return enhancer.get().value.arguments[0].name;
  }

  if (node.parentPath.value.type === 'CallExpression') {
    return node.parentPath.value.arguments[0].name;
  }
  return null;
};

export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const useCompose = root
    .find(j.CallExpression, {
      callee: {
        name: 'compose',
      },
    });
  if (useCompose.length < 1) return file.source;

  useCompose.replaceWith((node) => {
    const args = node.node.arguments;
    const componentName = findComponentName(j, root, node);
    if (componentName === null) {
      return j.callExpression(j.identifier('compose'), args);
    }
    if (args[0].type === 'CallExpression' && args[0].callee.name === 'setStatic') {
      return j.callExpression(j.identifier('compose'), args);
    }
    const newArgs = [j.callExpression(j.identifier('setDisplayName'), [j.literal(componentName)]), ...args];
    addImportSetDisplayName(j, root);
    return j.callExpression(j.identifier('compose'), newArgs);
  });


  // return file.source;
  return root.toSource({ quote: 'single' });
};
