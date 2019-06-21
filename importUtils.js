import { concat } from "lodash/fp";

const findImportSpecifier = (j, node) => {
  const arr = [];
  node.find(j.ImportSpecifier).forEach(n => arr.push(n.value.imported.name));
  return arr;
};

const findImportDefaultSpecifier = (j, node) => {
  const arr = [];
  node
    .find(j.ImportDefaultSpecifier)
    .forEach(n => arr.push(n.value.local.name));
  return arr[0];
};

const findImport = (j, root, packageName) =>
  root.find(j.ImportDeclaration, node => node.source.value === packageName);

const createImportNode = (j, methods, packageName) => {
  const specifiers = methods.map(name => j.importSpecifier(j.identifier(name)));
  return j.importDeclaration(specifiers, j.literal(packageName));
};

const createImportDefaultNode = (
  j,
  defaultImportName,
  methods,
  packageName
) => {
  let specifiers = [];
  if (defaultImportName) {
    const importDefaultSpecifier = j.importDefaultSpecifier(
      j.identifier(defaultImportName)
    );
    specifiers = [importDefaultSpecifier];
  }
  const namedSecifiers = methods.map(name =>
    j.importSpecifier(j.identifier(name))
  );
  specifiers = concat(specifiers, namedSecifiers);
  return j.importDeclaration(specifiers, j.literal(packageName));
};

// const createImportDefaultNode = (
//   j,
//   importDefaultName,
//   methods,
//   packageName
// ) => {
//   let specifiers = [];
//   if (importDefaultName) {
//     const importDefaultSpecifier = j.ImportDefaultSpecifier(
//       j.identifier(importDefaultName)
//     );
//     specifiers = [importDefaultName];
//   }
//   const methodSpecifiers = methods.map(name =>
//     j.importSpecifier(j.identifier(name))
//   );
//   specifiers = [...specifiers, ...methodSpecifiers];
//   return j.importDeclaration(specifiers, j.literal(packageName));
// };

const findRelativeImport = (j, root, packageName) => {
  return root.find(j.ImportDeclaration, node =>
    node.source.value.includes(packageName)
  );
};

export {
  findImportDefaultSpecifier,
  findImportSpecifier,
  findRelativeImport,
  findImport,
  createImportNode,
  createImportDefaultNode
};
