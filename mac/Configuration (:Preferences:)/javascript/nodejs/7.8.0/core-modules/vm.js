'use strict';

const binding = process.binding('contextify');
const Script = binding.ContextifyScript;

// The binding provides a few useful primitives:
// - Script(code, { filename = "evalmachine.anonymous",
//                  displayErrors = true } = {})
//   with methods:
//   - runInThisContext({ displayErrors = true } = {})
//   - runInContext(sandbox, { displayErrors = true, timeout = undefined } = {})
// - makeContext(sandbox)
// - isContext(sandbox)
// From this we build the entire documented API.

const realRunInThisContext = Script.prototype.runInThisContext;
const realRunInContext = Script.prototype.runInContext;

Script.prototype.runInThisContext = function(options) {
  if (options && options.breakOnSigint && process._events.SIGINT) {
    return sigintHandlersWrap(realRunInThisContext, this, [options]);
  } else {
    return realRunInThisContext.call(this, options);
  }
};

Script.prototype.runInContext = function(contextifiedSandbox, options) {
  if (options && options.breakOnSigint && process._events.SIGINT) {
    return sigintHandlersWrap(realRunInContext, this,
                              [contextifiedSandbox, options]);
  } else {
    return realRunInContext.call(this, contextifiedSandbox, options);
  }
};

Script.prototype.runInNewContext = function(sandbox, options) {
  var context = createContext(sandbox);
  return this.runInContext(context, options);
};

function createContext(sandbox) {
  if (sandbox === undefined) {
    sandbox = {};
  } else if (binding.isContext(sandbox)) {
    return sandbox;
  }

  binding.makeContext(sandbox);
  return sandbox;
}

function createScript(code, options) {
  return new Script(code, options);
}

// Remove all SIGINT listeners and re-attach them after the wrapped function
// has executed, so that caught SIGINT are handled by the listeners again.
function sigintHandlersWrap(fn, thisArg, argsArray) {
  // Using the internal list here to make sure `.once()` wrappers are used,
  // not the original ones.
  let sigintListeners = process._events.SIGINT;

  if (Array.isArray(sigintListeners))
    sigintListeners = sigintListeners.slice();
  else
    sigintListeners = [sigintListeners];

  process.removeAllListeners('SIGINT');

  try {
    return fn.apply(thisArg, argsArray);
  } finally {
    // Add using the public methods so that the `newListener` handler of
    // process can re-attach the listeners.
    for (const listener of sigintListeners) {
      process.addListener('SIGINT', listener);
    }
  }
}

function runInDebugContext(code) {
  return binding.runInDebugContext(code);
}

function runInContext(code, contextifiedSandbox, options) {
  return createScript(code, options)
    .runInContext(contextifiedSandbox, options);
}

function runInNewContext(code, sandbox, options) {
  return createScript(code, options).runInNewContext(sandbox, options);
}

function runInThisContext(code, options) {
  return createScript(code, options).runInThisContext(options);
}

module.exports = {
  Script,
  createContext,
  createScript,
  runInDebugContext,
  runInContext,
  runInNewContext,
  runInThisContext,
  isContext: binding.isContext
};

