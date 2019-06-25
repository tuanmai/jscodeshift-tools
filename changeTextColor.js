import {
  flow,
  map,
  find,
  flatten,
  first,
  size,
  get,
  compact,
  includes,
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

const getValue = value => {
  if (value.type === "Literal") return value.value;
  if (value.type === "Identifier") return value.name;
  if (value.type === "ConditionalExpression") {
    return [getValue(value.consequent), getValue(value.alternate)];
  }
  return value.type;
};

const findColorValueInProps = props => {
  const color = flow(flatten, find(prop => prop.key.name === "color"), prop => {
    if (!prop) return undefined;
    return getValue(prop.value);
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

const removeColorValueInStyleObject = (j, styleObject, stylePropName) => {
  const supportedType = ["ObjectExpression", "CallExpression"];
  if (includes(styleObject.nodes()[0].init.type, supportedType)) {
    const textStyleObject = styleObject
      .find(j.Property, node => node.key.name === stylePropName)
      .find(j.Property, node => node.key.name === "color")
      .remove();
  }
};

const colorToPropMap = {
  white: "primary",
  PRIMARY_LIGHT_GREY: "secondary",
  "#747474": "secondary"
};

const removeColorProps = (j, node) => {
  node.find(j.Property, node => node.key.name === "color").remove();
};

const addColorProp = (j, node, prop) => {
  node
    .find(j.JSXAttribute, node => node.name.name === "style")
    .insertAfter(() => {
      return j.identifier(prop);
    });
};

const inlineStyleHasColor = (j, node) => {
  const inlineStyle = node.find(j.ObjectExpression, node =>
    find(prop => prop.key.name === "color", node.properties)
  );
  if (inlineStyle.length < 1) return undefined;
  const color = flow(map(node => node.properties), findColorValueInProps)(
    inlineStyle.nodes()
  );
  const colorProp = colorToPropMap[color];
  if (colorProp) {
    removeColorProps(j, inlineStyle);
    addColorProp(j, node, colorProp);
  }
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
  const styleNode = root.findVariableDeclarators(styleObjectName);
  const color = findColorValueInStyleObject(styleObject, stylePropName);
  const colorProp = colorToPropMap[color];
  if (colorProp) {
    removeColorValueInStyleObject(j, styleNode, stylePropName);
    addColorProp(j, node, colorProp);
  }
};

const replaceColorByProp = (j, root, node) => {
  if (!isHasStyleProps(j, node)) return undefined;
  const inlineColor = inlineStyleHasColor(j, node);
  const objectColor = objectStyleHasColor(j, root, node);
  // const arrayColor = arrayStyleHasColor(j, root, node);
  // if (inlineColor || objectColor || arrayColor) {
  //   return inlineColor || objectColor || arrayColor;
  // }
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
    const foundColorStyle = replaceColorByProp(j, root, textNode);
    // if (foundColorStyle !== undefined) {
    //   if (Array.isArray(foundColorStyle)) {
    //     map(color => console.log("Color: ", color), foundColorStyle);
    //   } else {
    //     console.log("Color: ", foundColorStyle);
    //   }
    // }
  }

  return root.toSource({ quote: "single" });
};
