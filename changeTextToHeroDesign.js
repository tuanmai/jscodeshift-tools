import {
  createImportDefaultNode,
  findImportDefaultSpecifier,
  findRelativeImport
} from "./importUtils";

const migrateText = (j, root, relativePath, newPath) => {
  const commonTextImport = findRelativeImport(j, root, relativePath);
  const defaultImportName = findImportDefaultSpecifier(j, commonTextImport);
  if (commonTextImport.length < 1) return false;
  commonTextImport.replaceWith(() => {
    return createImportDefaultNode(j, defaultImportName, [], newPath);
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
