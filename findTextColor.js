import { flow, map, find, flatten, first, size, get } from "lodash/fp";

const hasStyleAttribute = node =>
  find(attribute => attribute.name.name === "style", node.attributes);

const findHasStylePropNode = (j, node) =>
  node.find(j.JSXOpeningElement, node =>
    find(attribute => attribute.name.name === "style", node.attributes)
  );

const isHasStyleProps = (j, node) => {
  const styleProp = findHasStylePropNode(j, node);
  return styleProp.length >= 1;
};

const fileColorValueInProps = props => {
  const color = flow(flatten, find(prop => prop.key.name === "color"), prop => {
    if (prop.value.type === "Literal") return prop.value.value;
    if (prop.value.type === "Identifier") return prop.value.name;
    return prop.value.type;
  })(props);
  return color;
};

const inlineStyleHasColor = (j, node) => {
  const inlineStyle = node.find(j.ObjectExpression, node =>
    find(prop => prop.key.name === "color", node.properties)
  );
  if (inlineStyle.length < 1) return undefined;
  const color = flow(map(node => node.properties), fileColorValueInProps)(
    inlineStyle.nodes()
  );
  return color;
};

const objectStyleHasColor = (j, root, node) => {
  let color = undefined;
  const objectStyle = findHasStylePropNode(j, node).find(j.MemberExpression);
  if (objectStyle.length < 1) return undefined;
  const styleObjectName = objectStyle.nodes()[0].object.name;
  const stylePropName = objectStyle.nodes()[0].property.name;
  const styleObject = root.findVariableDeclarators(styleObjectName).nodes()[0];
  if (styleObject.init.type === "ObjectExpression") {
    color = flow(
      find(node => node.key.name === stylePropName),
      map(node => node.value.properties),
      fileColorValueInProps
    )(styleObject.init.properties);
  }
  console.log(stylePropName);

  if (styleObject.init.type === "CallExpression") {
    color = flow(
      first,
      get("properties"),
      find(node => node.key.name === stylePropName),
      get("value.properties"),
      fileColorValueInProps
    )(styleObject.init.arguments);
  }
  return color;
  // const color = flow(
  //   map(node => node.properties),
  //   flatten,
  //   find(prop => prop.key.name === "color"),
  //   prop => {
  //     if (prop.value.type === "Literal") return prop.value.value;
  //     if (prop.value.type === "Identifier") return prop.value.name;
  //     return prop.value.type;
  //   }
  // )(inlineStyle.nodes());
  // return color;
};

const findColorStyle = (j, root, node) => {
  if (!isHasStyleProps(j, node)) return "fff";
  const inlineColor = inlineStyleHasColor(j, node);
  const objectColor = objectStyleHasColor(j, root, node);
  if (inlineColor || objectColor) {
    return inlineColor || objectColor;
  }
  return "fff";
};

export default (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const textComponents = root.findJSXElements("Text");
  const found = textComponents.length >= 1;
  if (!found) return file.source;
  console.log(`Found ${textComponents.length} text in: `, file.path);

  for (let i = 0; i < textComponents.length; i++) {
    const textNode = textComponents.at(i);
    const foundColorStyle = findColorStyle(j, root, textNode);
    if (foundColorStyle !== undefined) {
      console.log("Color: ", foundColorStyle);
    }
  }

  return root.toSource({ quote: "single" });
};
