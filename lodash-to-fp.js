import { concat, difference, filter, flow, uniq } from 'lodash/fp';

import {
  customArgumentOrder,
  dataTypes,
  fixedArityFour,
  fixedArityThree,
  fixedArityTwo,
  iterateeCappedToOneArgument,
  iterateeCappedToTwoArguments,
  oneToOneRelation,
  shouldNotRotate,
  fixedArityOne,
} from './lodash-migrate-config';

const rotate = arr => {
  const first = arr.shift();
  arr.push(first);
  return arr;
};

const rotateLeft = arr => {
  return [arr[arr.length - 1], ...arr.splice(0, arr.length - 1)];
};

const findImportSpecifier = (j, node) => {
  const arr = [];
  node.find(j.ImportSpecifier).forEach(node => arr.push(node.value.imported.name));
  return arr;
};

const findImport = (j, root, packageName) => {
  return root.find(j.ImportDeclaration, node => node.source.value === packageName);
};

const validTransformMethod = (methodName, args) => {
  if (customArgumentOrder[methodName]) {
    // Not implemented
    return { valid: false, reason: 'does_not_support' };
  } else if (oneToOneRelation[methodName]) {
    return { valid: true };
  } else if (fixedArityOne[methodName]) {
    const valid = args.length === 1;
    return { valid };
  } else if (iterateeCappedToOneArgument[methodName]) {
    const iteratee = args[1];
    const isDataType = dataTypes[iteratee.name];
    const isLiteral = ['ArrayExpression', 'Literal', 'ObjectExpression'].indexOf(iteratee.type) > -1;
    const isFunction = ['ArrowFunctionExpression', 'FunctionExpression'].indexOf(iteratee.type) > -1;
    const isFunctionWithOneArg = isFunction && iteratee.params.length === 1;
    const valid = isDataType || isLiteral || isFunctionWithOneArg;
    return { valid, method: 'reverse' };
  } else if (iterateeCappedToTwoArguments[methodName]) {
    const iteratee = args[1];
    const isFunction = ['ArrowFunctionExpression', 'FunctionExpression'].indexOf(iteratee.type) > -1;
    const isFunctionWithTwoArgs = isFunction && iteratee.params.length === 2;
    const arityOfThree = args.length === 3;
    const valid = isFunctionWithTwoArgs && arityOfThree;
    return { valid, method: 'rotate' };
  } else if (methodName === 'get' && args.length === 3) {
    return { valid: true, method: 'change' };
  } else if (fixedArityTwo[methodName]) {
    const valid = args.length === 2;
    const method = !shouldNotRotate[methodName] ? 'rotate' : 'none';
    return { valid, method };
  } else if (fixedArityThree[methodName]) {
    const valid = args.length === 3;
    const method = !shouldNotRotate[methodName] ? 'rotate' : 'none';
    return { valid, method };
  } else if (fixedArityFour[methodName]) {
    const valid = args.length === 4;
    const method = !shouldNotRotate[methodName] ? 'rotate' : 'none';
    return { valid, method };
  }

  return { valid: false, reason: 'exception' };
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
  const lodashImport = findImport(j, root, 'lodash');
  if (lodashImport.length < 1) return file.source;
  const lodashItems = findImportSpecifier(j, lodashImport);
  // eslint-disable-next-line
  let methodsValidate = {};
  lodashItems.forEach(methodName => {
    root
      .find(j.CallExpression, {
        callee: {
          name: methodName,
        },
      })
      .forEach(ex => {
        const args = ex.node.arguments;
        const validate = validTransformMethod(methodName, args);
        if (!validate.valid) {
          // eslint-disable-next-line
          methodsValidate[methodName] = false;
          console.log(methodName, validate.reason);
        }
      });
  });
  const canMigrateLodashItems = filter(item => methodsValidate[item] !== false, lodashItems);
  const changeItems = [];
  canMigrateLodashItems.forEach(methodName => {
    root
      .find(j.CallExpression, {
        callee: {
          name: methodName,
        },
      })
      .replaceWith(ex => {
        const args = ex.node.arguments;
        const validate = validTransformMethod(methodName, args);
        // eslint-disable-next-line
        let newMethod = methodName;
        // eslint-disable-next-line
        let newArgs = args;
        if (validate.method === 'reverse') {
          newArgs = args.reverse();
        }
        if (validate.method === 'rotate') {
          newArgs = rotate(args);
        }
        if (validate.method === 'change') {
          if (methodName === 'get') {
            newMethod = 'getOr';
            changeItems.push('getOr');
            newArgs = args.reverse();
          }
        }
        return j.callExpression(j.identifier(newMethod), newArgs);
      });
  });

  // remove import lodash
  if (canMigrateLodashItems.length === lodashItems.length) {
    lodashImport.remove();
  } else {
    lodashImport.replaceWith(() => {
      const newMethods = difference(lodashItems, canMigrateLodashItems);
      return createImportNode(j, newMethods, 'lodash');
    });
  }
  // Add import lodash fp
  if (canMigrateLodashItems.length > 0) {
    const lodashFpImport = findImport(j, root, 'lodash/fp');
    if (lodashFpImport.length >= 1) {
      const lodashFpItems = findImportSpecifier(j, lodashFpImport);
      lodashFpImport.replaceWith(() => {
        const newMethods = flow(
          concat(canMigrateLodashItems),
          concat(changeItems),
          uniq,
        )(lodashFpItems);
        return createImportNode(j, newMethods, 'lodash/fp');
      });
    } else {
      const newMethods = flow(
        concat(changeItems),
        uniq,
      )(canMigrateLodashItems);
      lodashImport.insertAfter(createImportNode(j, newMethods, 'lodash/fp'));
    }
  }

  return root.toSource({ quote: 'single' });
};
