import test from './test';
import d from './domator';
import * as helpers from './helpers';

import Interactable from '@interactjs/core/Interactable';

test('Interactable copies and extends defaults', t => {
  const scope = helpers.mockScope();
  const { defaults } = scope;

  scope.actions.methodDict = { test: 'testize' };

  scope.Interactable.prototype.testize = function (options) {
    this.setPerAction('test', options);
  };

  defaults.test = {
    fromDefault: { a: 1, b: 2 },
    specified: { c: 1, d: 2 },
  };

  const specified = { specified: 'parent' };

  const div = d('div');
  const interactable = helpers.newInteractable(scope, div, { test: specified });

  t.deepEqual(interactable.options.test.specified, specified.specified,
    'specified options are properly set');
  t.deepEqual(interactable.options.test.fromDefault, defaults.test.fromDefault,
    'default options are properly set');
  t.notEqual(interactable.options.test.fromDefault, defaults.test.fromDefault,
    'defaults are not aliased');

  defaults.test.fromDefault.c = 3;
  t.notOk('c' in interactable.options.test.fromDefault,
    'modifying defaults does not affect constructed interactables');

  t.end();
});

test('Interactable copies and extends per action defaults', t => {
  const scope = helpers.mockScope();
  const { defaults } = scope;

  scope.actions.methodDict = { test: 'testize' };

  scope.Interactable.prototype.testize = function (options) {
    this.setPerAction('test', options);
  };

  defaults.perAction.testModifier = {
    fromDefault: { a: 1, b: 2 },
    specified: null,
  };
  defaults.test = { testModifier: defaults.perAction.testModifier };

  const div = d('div');
  const interactable = helpers.newInteractable(scope, div, {});
  interactable.testize({ testModifier: { specified: 'parent' } });

  t.deepEqual(interactable.options.test, {
    enabled: false,
    origin: { x: 0, y: 0 },

    testModifier: {
      fromDefault: { a: 1, b: 2},
      specified: 'parent',
    },
  }, 'specified options are properly set');
  t.deepEqual(
    interactable.options.test.testModifier.fromDefault,
    defaults.perAction.testModifier.fromDefault,
    'default options are properly set');
  t.notEqual(
    interactable.options.test.testModifier.fromDefault,
    defaults.perAction.testModifier.fromDefault,
    'defaults are not aliased');

  defaults.perAction.testModifier.fromDefault.c = 3;
  t.notOk('c' in interactable.options.test.testModifier.fromDefault,
    'modifying defaults does not affect constructed interactables');

  // Undo global changes
  delete scope.actions;
  delete Interactable.prototype.test;
  delete defaults.test;
  delete defaults.perAction.testModifier;

  t.end();
});
