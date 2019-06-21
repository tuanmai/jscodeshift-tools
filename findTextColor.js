import {
  flow,
  map,
  find,
  flatten,
  first,
  size,
  get,
  compact,
  uniq
} from "lodash/fp";

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

const findColorValueInProps = props => {
  const color = flow(flatten, find(prop => prop.key.name === "color"), prop => {
    if (!prop) return undefined;
    if (prop.value.type === "Literal") return prop.value.value;
    if (prop.value.type === "Identifier") return prop.value.name;
    return prop.value.type;
  })(props);
  return color;
};

const findColorValueInStyleObject = (styleObject, stylePropName) => {
  let color = undefined;
  if (styleObject.init.type === "ObjectExpression") {
    color = flow(
      find(node => node.key.name === stylePropName),
      get("value.properties"),
      findColorValueInProps
    )(styleObject.init.properties);
  }
  if (styleObject.init.type === "CallExpression") {
    color = flow(
      first,
      get("properties"),
      find(node => node.key.name === stylePropName),
      get("value.properties"),
      findColorValueInProps
    )(styleObject.init.arguments);
  }
  return color;
};

const inlineStyleHasColor = (j, node) => {
  const inlineStyle = node.find(j.ObjectExpression, node =>
    find(prop => prop.key.name === "color", node.properties)
  );
  if (inlineStyle.length < 1) return undefined;
  const color = flow(map(node => node.properties), findColorValueInProps)(
    inlineStyle.nodes()
  );
  return color;
};

const arrayStyleHasColor = (j, root, node) => {
  const arrayStyle = findHasStylePropNode(j, node)
    .find(
      j.JSXExpressionContainer,
      node => node.expression.type === "ArrayExpression"
    )
    .find(j.MemberExpression);
  if (arrayStyle.length < 1) return undefined;
  const colors = flow(
    map(object => {
      const styleObjectName = object.object.name;
      const stylePropName = object.property.name;
      const styleObject = root
        .findVariableDeclarators(styleObjectName)
        .nodes()[0];
      return findColorValueInStyleObject(styleObject, stylePropName);
    }),
    compact,
    uniq
  )(arrayStyle.nodes());
  if (colors.length === 0) return undefined;

  return colors;
};

const objectStyleHasColor = (j, root, node) => {
  const objectStyle = findHasStylePropNode(j, node)
    .find(
      j.JSXExpressionContainer,
      node => node.expression.type === "MemberExpression"
    )
    .find(j.MemberExpression);
  if (objectStyle.length < 1) return undefined;
  const styleObjectName = objectStyle.nodes()[0].object.name;
  const stylePropName = objectStyle.nodes()[0].property.name;
  const styleObject = root.findVariableDeclarators(styleObjectName).nodes()[0];
  return findColorValueInStyleObject(styleObject, stylePropName);
};

const findColorStyle = (j, root, node) => {
  if (!isHasStyleProps(j, node)) return undefined;
  const inlineColor = inlineStyleHasColor(j, node);
  const objectColor = objectStyleHasColor(j, root, node);
  const arrayColor = arrayStyleHasColor(j, root, node);
  if (inlineColor || objectColor || arrayColor) {
    return inlineColor || objectColor || arrayColor;
  }
  return undefined;
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
      if (Array.isArray(foundColorStyle)) {
        map(color => console.log("Color: ", color), foundColorStyle);
      } else {
        console.log("Color: ", foundColorStyle);
      }
    }
  }

  return root.toSource({ quote: "single" });
};
