import extend from '@interactjs/utils/extend';

function init (scope) {
  const {
    interactions,
  } = scope;

  scope.modifiers = { names: [] };

  interactions.signals.on('new', function (interaction) {
    interaction.modifiers = {
      startOffset: { left: 0, right: 0, top: 0, bottom: 0 },
      offsets    : {},
      statuses   : resetStatuses({}, scope.modifiers),
      result     : null,
    };
  });

  interactions.signals.on('before-action-start' , arg =>
    start(arg, scope.modifiers, arg.interaction.startCoords.page));

  interactions.signals.on('action-resume', arg => {
    beforeMove(arg, scope.modifiers);
    start(arg, scope.modifiers, arg.interaction.curCoords.page);
  });

  interactions.signals.on('before-action-move', arg => beforeMove(arg, scope.modifiers));
  interactions.signals.on('before-action-end', arg => beforeEnd(arg, scope.modifiers));

  interactions.signals.on('before-action-start', arg => setCurCoords(arg, scope.modifiers));
  interactions.signals.on('before-action-move', arg => setCurCoords(arg, scope.modifiers));
}

function startAll (arg, modifiers) {
  const { interaction, pageCoords: page } = arg;
  const { target, element, modifiers: { startOffset } } = interaction;
  const rect = target.getRect(element);

  if (rect) {
    startOffset.left = page.x - rect.left;
    startOffset.top  = page.y - rect.top;

    startOffset.right  = rect.right  - page.x;
    startOffset.bottom = rect.bottom - page.y;

    if (!('width'  in rect)) { rect.width  = rect.right  - rect.left; }
    if (!('height' in rect)) { rect.height = rect.bottom - rect.top ; }
  }
  else {
    startOffset.left = startOffset.top = startOffset.right = startOffset.bottom = 0;
  }

  arg.rect = rect;
  arg.interactable = target;
  arg.element = element;

  for (const modifierName of modifiers.names) {
    arg.options = target.options[interaction.prepared.name][modifierName];
    arg.status = arg.statuses[modifierName];

    if (!arg.options) {
      continue;
    }

    interaction.modifiers.offsets[modifierName] = modifiers[modifierName].start(arg);
  }
}

function setAll (arg, modifiers) {
  const { interaction, statuses, preEnd, requireEndOnly } = arg;

  arg.modifiedCoords = extend({}, arg.pageCoords);

  const result = {
    delta: { x: 0, y: 0 },
    coords: arg.modifiedCoords,
    changed: false,
    locked: false,
    shouldMove: true,
  };

  for (const modifierName of modifiers.names) {
    const modifier = modifiers[modifierName];
    const options = interaction.target.options[interaction.prepared.name][modifierName];

    if (!shouldDo(options, preEnd, requireEndOnly)) { continue; }

    arg.status = arg.status = statuses[modifierName];
    arg.options = options;
    arg.offset = arg.interaction.modifiers.offsets[modifierName];

    modifier.set(arg);

    if (arg.status.locked) {
      arg.modifiedCoords.x += arg.status.delta.x;
      arg.modifiedCoords.y += arg.status.delta.y;

      result.delta.x += arg.status.delta.x;
      result.delta.y += arg.status.delta.y;

      result.locked = true;
    }
  }

  const changed =
    interaction.curCoords.page.x !== arg.modifiedCoords.x ||
    interaction.curCoords.page.y !== arg.modifiedCoords.y;

  // a move should be fired if:
  //  - there are no modifiers enabled,
  //  - no modifiers are "locked" i.e. have changed the pointer's coordinates, or
  //  - the locked coords have changed since the last pointer move
  result.shouldMove = !arg.status || !result.locked || changed;

  return result;
}

function resetStatuses (statuses, modifiers) {
  for (const modifierName of modifiers.names) {
    const status = statuses[modifierName] || {};

    status.delta = { x: 0, y: 0 };
    status.locked = false;

    statuses[modifierName] = status;
  }

  return statuses;
}

function start ({ interaction }, modifiers, pageCoords) {
  const arg = {
    interaction,
    pageCoords,
    startOffset: interaction.modifiers.startOffset,
    statuses: interaction.modifiers.statuses,
    preEnd: false,
    requireEndOnly: false,
  };

  startAll(arg, modifiers);
  resetStatuses(arg.statuses, modifiers);

  arg.pageCoords = extend({}, interaction.startCoords.page);
  interaction.modifiers.result = setAll(arg, modifiers);
}

function beforeMove ({ interaction, preEnd, interactingBeforeMove }, modifiers) {
  const modifierResult = setAll(
    {
      interaction,
      preEnd,
      pageCoords: interaction.curCoords.page,
      statuses: interaction.modifiers.statuses,
      requireEndOnly: false,
    }, modifiers);

  interaction.modifiers.result = modifierResult;

  // don't fire an action move if a modifier would keep the event in the same
  // cordinates as before
  if (!modifierResult.shouldMove && interactingBeforeMove) {
    return false;
  }
}

function beforeEnd ({ interaction, event }, modifiers) {
  for (const modifierName of modifiers.names) {
    const options = interaction.target.options[interaction.prepared.name][modifierName];

    // if the endOnly option is true for any modifier
    if (shouldDo(options, true, true)) {
      // fire a move event at the modified coordinates
      interaction.move({ event, preEnd: true });
      break;
    }
  }
}

function setCurCoords (arg, modifiers) {
  const { interaction } = arg;
  const modifierArg = extend({
    page: interaction.curCoords.page,
    client: interaction.curCoords.client,
  }, arg);

  for (let i = 0; i < modifiers.names.length; i++) {
    const modifierName = modifiers.names[i];
    modifierArg.options = interaction.target.options[interaction.prepared.name][modifierName];

    if (!modifierArg.options) {
      continue;
    }

    const modifier = modifiers[modifierName];

    modifierArg.status = interaction.modifiers.statuses[modifierName];

    modifier.modifyCoords(modifierArg);
  }
}

function shouldDo (options, preEnd, requireEndOnly) {
  return (options && options.enabled
    && (preEnd || !options.endOnly)
    && (!requireEndOnly || options.endOnly));
}

export default {
  init,
  startAll,
  setAll,
  resetStatuses,
  start,
  beforeMove,
  beforeEnd,
  shouldDo,
};
