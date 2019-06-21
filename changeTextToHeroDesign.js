import {
  createImportDefaultNode,
  findImportDefaultSpecifier,
  findRelativeImport
} from "./importUtils";

export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const commonTextImport = findRelativeImport(j, root, "common/text");
  const defaultImportName = findImportDefaultSpecifier(j, commonTextImport);
  if (commonTextImport.length < 1) return file.source;
  console.log("Found import text");
  commonTextImport.replaceWith(() => {
    return createImportDefaultNode(j, defaultImportName, [], "hero-design-rn");
  });

  return root.toSource({ quote: "single" });
};
