import {
  createImportDefaultNode,
  findImportDefaultSpecifier,
  findRelativeImport
} from "./importUtils";

const migrateText = (j, root, relativePath, newPath) => {
  const commonTextImport = findRelativeImport(j, root, relativePath);
  const defaultImportName = findImportDefaultSpecifier(j, commonTextImport);
  if (commonTextImport.length < 1) return file.source;
  commonTextImport.replaceWith(() => {
    return createImportDefaultNode(j, defaultImportName, [], newPath);
  });
};

export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  migrateText(j, root, "common/text", "hero-design-rn");
  migrateText(j, root, "./text", "hero-design-rn");
  migrateText(j, root, "../text", "hero-design-rn");

  return root.toSource({ quote: "single" });
};
