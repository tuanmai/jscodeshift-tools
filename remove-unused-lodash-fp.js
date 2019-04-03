import { difference } from 'lodash/fp';

const findImportSpecifier = (j, node) => {
  const arr = [];
  node.find(j.ImportSpecifier).forEach(node => arr.push(node.value.imported.name));
  return arr;
};

const findImport = (j, root, packageName) => {
  return root.find(j.ImportDeclaration, node => node.source.value === packageName);
};

const createImportNode = (j, methods, packageName) => {
  const specifiers = methods.map(name => {
    return j.importSpecifier(j.identifier(name));
  });
  return j.importDeclaration(specifiers, j.literal(packageName));
};

export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const lodashFpImport = findImport(j, root, 'lodash/fp');
  if (lodashFpImport.length < 1) return file.source;
  const lodashFpItems = findImportSpecifier(j, lodashFpImport);
  // eslint-disable-next-line
  let removeGet = true;
  root
    .find(j.CallExpression, {
      callee: {
        name: 'get',
      },
    })
    .forEach(() => {
      // eslint-disable-next-line
      removeGet = false;
    });

  if (removeGet) {
    lodashFpImport.replaceWith(() => {
      const newMethods = difference(lodashFpItems, ['get']);
      return createImportNode(j, newMethods, 'lodash/fp');
    });
  }

  return root.toSource({ quote: 'single' });
};
