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
  if (value.type === "CallExpression") {
    return value.arguments[0].value;
  }
  return value.type;
};

const findAttributeValueInObject = propName => props => {
  const value = flow(
    flatten,
    find(prop => prop.key.name === propName),
    prop => {
      if (!prop) return undefined;
      return getValue(prop.value);
    }
  )(props);
  return value;
};

const findPropValueInStyleObject = (styleObject, stylePropName, propName) => {
  let value = undefined;
  if (styleObject.init.type === "ObjectExpression") {
    value = flow(
      find(node => node.key.name === stylePropName),
      get("value.properties"),
      findAttributeValueInObject(propName)
    )(styleObject.init.properties);
  }
  if (styleObject.init.type === "CallExpression") {
    value = flow(
      first,
      get("properties"),
      find(node => node.key.name === stylePropName),
      get("value.properties"),
      findAttributeValueInObject(propName)
    )(styleObject.init.arguments);
  }
  return value;
};

const removePropValueInStyleObject = (
  j,
  styleObject,
  stylePropName,
  propName
) => {
  const supportedType = ["ObjectExpression", "CallExpression"];
  if (includes(styleObject.nodes()[0].init.type, supportedType)) {
    const textStyleObject = styleObject
      .find(j.Property, node => node.key.name === stylePropName)
      .find(j.Property, node => node.key.name === propName)
      .remove();
  }
};

const colorToPropMap = {
  white: "primary",
  WHITE: "primary",
  "#ffffff": "primary",
  PRIMARY_LIGHT_GREY: "secondary",
  "#747474": "secondary",
  textColor: "secondary",
  TEXT_COLOR: "secondary"
};

const fontSizeMap = {
  22: "h1",
  20: "h2",
  18: "h3",
  16: "h4",
  14: "h5",
  12: "h6"
};

const removePropFromInlineStyle = (j, node, propName) => {
  node.find(j.Property, node => node.key.name === propName).remove();
};

const addNewPropToText = (j, node, prop) => {
  node
    .find(j.JSXAttribute, node => node.name.name === "style")
    .insertAfter(() => {
      return j.identifier(prop);
    });
};

const newTextPropToAdd = (j, prop) => {
  return fontSizeMap[prop];
};

const inlineStyleHasWantedProp = (j, node, propName, isDelete) => {
  const inlineStyle = node.find(j.ObjectExpression, node =>
    find(prop => prop.key.name === propName, node.properties)
  );
  if (inlineStyle.length < 1) return undefined;
  const propValue = flow(
    map(node => node.properties),
    findAttributeValueInObject(propName)
  )(inlineStyle.nodes());

  const newProp = newTextPropToAdd(j, propValue);
  if (newProp) {
    if (isDelete) {
      removePropFromInlineStyle(j, inlineStyle, propName);
    } else {
      addNewPropToText(j, node, newProp);
    }
  }
};

const arrayStyleHasWantedProp = (j, root, node, propName, isDelete) => {
  const arrayStyle = findHasStylePropNode(j, node)
    .find(
      j.JSXExpressionContainer,
      node => node.expression.type === "ArrayExpression"
    )
    .find(j.MemberExpression);
  if (arrayStyle.length < 1) return undefined;
  const propValues = flow(
    map(object => {
      const styleObjectName = object.object.name;
      const stylePropName = object.property.name;
      const styleObject = root
        .findVariableDeclarators(styleObjectName)
        .nodes()[0];
      const styleNode = root.findVariableDeclarators(styleObjectName);
      const propValue = findPropValueInStyleObject(
        styleObject,
        stylePropName,
        propName
      );
      const newProp = newTextPropToAdd(j, propValue);
      if (newProp) {
        if (isDelete) {
          removePropValueInStyleObject(j, styleNode, stylePropName, propName);
        } else {
          addNewPropToText(j, node, newProp);
        }
      }
    }),
    compact,
    uniq
  )(arrayStyle.nodes());
  if (propValues.length === 0) return undefined;

  return propValues;
};

const objectStyleHasWantedProp = (j, root, node, propName, isDelete) => {
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
  const propValue = findPropValueInStyleObject(
    styleObject,
    stylePropName,
    propName
  );
  const newProp = newTextPropToAdd(j, propValue);
  if (newProp) {
    if (isDelete) {
      removePropValueInStyleObject(j, styleNode, stylePropName, propName);
    } else {
      addNewPropToText(j, node, newProp);
    }
  }
};

const addFontSizeProp = (j, root, node) => {
  if (!isHasStyleProps(j, node)) return undefined;
  const inlineValue = inlineStyleHasWantedProp(j, node, "fontSize", false);
  const objectValue = objectStyleHasWantedProp(
    j,
    root,
    node,
    "fontSize",
    false
  );
  const arrayValue = arrayStyleHasWantedProp(j, root, node, "fontSize", false);
  return undefined;
};

const removeFontSizeInStyle = (j, root, node) => {
  if (!isHasStyleProps(j, node)) return undefined;
  const inlineValue = inlineStyleHasWantedProp(j, node, "fontSize", true);
  const objectValue = objectStyleHasWantedProp(j, root, node, "fontSize", true);
  const arrayValue = arrayStyleHasWantedProp(j, root, node, "fontSize", true);
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
    const foundValueStyle = addFontSizeProp(j, root, textNode);
  }
  for (let i = 0; i < textComponents.length; i++) {
    const textNode = textComponents.at(i);
    addFontSizeProp(j, root, textNode, true);
  }

  return root.toSource({ quote: "single" });
};
