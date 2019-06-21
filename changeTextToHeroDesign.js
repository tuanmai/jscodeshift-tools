import { findImportDefaultSpecifier, findRelativeImport } from "./importUtils";

const createImportTextNode = (j, defaultImportName, localName, packageName) => {
  let specifiers = [];
  if (defaultImportName !== localName) {
    specifiers = [
      j.importSpecifier(
        j.identifier(defaultImportName),
        j.identifier(localName)
      )
    ];
  }
  specifiers = [j.importSpecifier(j.identifier(defaultImportName))];
  return j.importDeclaration(specifiers, j.literal(packageName));
};

const migrateText = (j, root, relativePath, newPath) => {
  const commonTextImport = findRelativeImport(j, root, relativePath);
  if (commonTextImport.length < 1) return false;
  const defaultImportName = findImportDefaultSpecifier(j, commonTextImport);
  commonTextImport.replaceWith(() => {
    return createImportTextNode(j, defaultImportName, "Text", newPath);
  });
  return true;
};

export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  let found = false;
  found = found || migrateText(j, root, "common/text", "hero-design-rn");
  found = found || migrateText(j, root, "./text", "hero-design-rn");
  found = found || migrateText(j, root, "../text", "hero-design-rn");
  if (!found) return file.source;

  return root.toSource({ quote: "single" });
};
