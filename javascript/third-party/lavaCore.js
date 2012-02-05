//LAVA_QUENCH: Allows running on web pages.
if(exports === undefined)
{
	var exports = {};
}

if(require === undefined)
{
	var require = {};
}

var _weakref;

const defaultMethods =
{
	initialize: function()
	{
	},

	classInitialize: function()
	{
	},

	$super: function(func)
	{
		var self = this;
		if (func.__super)
		{
			return function()
			{
				return func.__super.apply(self, arguments);
			}
		}
		else
		{
			var name = func.name;
			for (var p = self; p; p = p.__proto__)
			{
				if (p[name] === func)
				{
					for (p = p.__proto__; p; p = p.__proto__)
					{
						var bfunc = p[name];
						if (bfunc && bfunc !== func)
						{
							func.__super = bfunc;
							return function()
							{
								return bfunc.apply(self, arguments);
							}
						}
					}
					break;
				}
			}
			throw new Error("Base function '" + name + "' not found");
		}
	},
};

var Class = exports.Class = function(superclass, methods)
{
	var f;
	if (!methods)
	{
		methods = superclass || {};
		methods.__proto__ = defaultMethods;
	}
	else
	{
		f = methods.initialize;
		methods.__proto__ = superclass.prototype;
	}

	var finalize = methods.finalize;
	if (finalize)
	{
		try
		{
			if (!_weakref)
			{
				_weakref = require("rockmeltWeakReferences");
			}
			f = function()
			{
				_weakref.createWeakReference(this, finalize);
				this.initialize.apply(this, arguments);
			}
		}
		catch (_)
		{
			console.error("No finalizer support");
		}
	}
	if (!f)
	{
		f = function()
		{
			this.initialize.apply(this, arguments);
		}
	}

	if(!methods.$super)
	{
		methods.$super = defaultMethods.$super;
	}

	methods.constructor = f;
	f.prototype = methods;
	methods.classInitialize();
	return f;
}

if (typeof window !== "undefined")
{
	window.__lava_core_globals = window.__lava_core_globals || undefined;

	exports.__defineGetter__("Globals", function()
	{
		if (!window.__lava_core_globals)
		{
			var win;
			// First look for globals on the background window
			try
			{
				win = chrome.extension.getBackgroundPage();
				window.__lava_core_globals = win && win.__lava_core_globals;
			}
			catch (_)
			{
			}
			try
			{
				// Then look on all other windows for globals.
				var wins = chrome.extension.getViews();
				for (var i = wins.length - 1; i >= 0 && !window.__lava_core_globals; i--)
				{
					win = wins[i];
					window.__lava_core_globals = win && win.__lava_core_globals;
				}
			}
			catch (_)
			{
			}
			// If we dont find any, we create some
			if (!window.__lava_core_globals)
			{
				window.__lava_core_globals = {};
			}
		}
		return window.__lava_core_globals;
	});
}

if (typeof XMLHttpRequest === "undefined")
{
	var http = require("http");
	XMLHttpRequest = Class(
	{
		initialize: function()
		{
			this._headers = {};
			this.readyState = 0;
		},

		open: function(cmd, url)
		{
			this._cmd = cmd;
			this._url = new Url(url);
			var secure = (this._url.protocol === "https:");
			this._client = http.createClient(this._url.port || (secure ? 443 : 80), this._url.host, secure);
			this._headers["Host"] = this._url.host;
			this._headers["User-Agent"] = "Node";
			this.readyState = 1;
			this.onreadystatechange && this.onreadystatechange();
		},

		setRequestHeader: function(key, value)
		{
			this._headers[key] = value;
		},

		send: function(body)
		{
			if (body)
			{
				this._headers["Content-Length"] = body.length;
			}
			//console.log("SEND ", { cmd: this._cmd, path: this._url.pathname + this._url.search + this._url.hash, headers: this._headers, body: body });
			var self = this;
			this._request = this._client.request(this._cmd, this._url.pathname + this._url.search + this._url.hash, this._headers);
			if (body)
			{
				this._request.write(body, "utf8");
			}
			this._request.on("response", function(response)
			{
				self._responseHeaders = response.headers;
				//console.log(response.headers);
				self.status = response.statusCode;
				response.setEncoding("utf8");
				self.readyState = 2;
				self.onreadystatechange && self.onreadystatechange();
				self.responseText = "";
				response.on("data", function(chunk)
				{
					self.readyState = 3;
					self.responseText += chunk;
					self.onreadystatechange && self.onreadystatechange();
				});
				response.on("end", function()
				{
					self.readyState = 4;
					self.onreadystatechange && self.onreadystatechange();
				});
			});
			this._request.end();
		},

		getAllResponseHeaders: function()
		{
			return this._responseHeaders;
		},

		abort: function()
		{
			this._request.socket.destroy();
		}
	});
}
if (typeof exports.Globals === "undefined")
{
	exports.Globals = global.Globals || (global.Globals = {});
}

if (typeof localStorage === "undefined")
{
	localStorage = {};
}
exports.Ajax = Class(
{
	initialize: function(headers)
	{
		this._req = new XMLHttpRequest();
		this._headers = headers || {};
	},

	get: function(url, payload, headers)
	{
		for (var key in headers)
		{
			this._headers[key] = headers[key];
		}
		if (payload)
		{
			url += (url.indexOf("?") == -1 ? "?" : "&") + this._encodeParams(payload);
		}
		return this._request("GET", url);
	},

	post: function(url, payload, headers)
	{
		for (var key in headers)
		{
			this._headers[key] = headers[key];
		}
		if (!this._headers["Content-Type"])
		{
			this._headers["Content-Type"] = "application/x-www-form-urlencoded";
		}
		switch (this._headers["Content-Type"])
		{
			case "application/x-www-form-urlencoded":
				payload = this._encodeParams(payload);
				break;

			case "application/json":
				payload = JSON.stringify(payload);
				break;

			default:
				break;
		}
		return this._request("POST", url, payload);
	},

	put: function(url, payload, headers)
	{
		for (var key in headers)
		{
			this._headers[key] = headers[key];
		}
		if (!this._headers["Content-Type"])
		{
			this._headers["Content-Type"] = "application/x-www-form-urlencoded";
		}
		switch (this._headers["Content-Type"])
		{
			case "application/x-www-form-urlencoded":
				payload = this._encodeParams(payload);
				break;

			case "application/json":
				payload = JSON.stringify(payload);
				break;

			default:
				break;
		}
		return this._request("PUT", url, payload);
	},

	setHeader: function(key, value)
	{
		this._headers[key] = value;
	},

	setTimeout: function(secs)
	{
		this._timeout = secs * 1000;
	},

	setEscapeValues: function(flag)
	{
		this._escapeValues = flag;
	},

	abort: function()
	{
		this._req.abort();
	},

	_encodeParams: function(payload)
	{
		var p = "";
		for (var k in payload)
		{
			if (payload[k] !== undefined)
			{
				var val = payload[k];
				if (Array.isArray(val))
				{
					for (var i = 0; i < val.length; i++)
					{
						p = p + "&" + encodeURIComponent(k) + "=" + (this._escapeValues === false ? val[i] : encodeURIComponent(val[i]));
					}
				}
				else
				{
					p = p + "&" + encodeURIComponent(k) + "=" + (this._escapeValues === false ? val : encodeURIComponent(val));
				}
			}
		}
		return p.substring(1);
	},

	_request: function(cmd, url, payload)
	{
		this._cmd = cmd;
		this._url = url;
		this._req.open(cmd, url, true);
		for (var key in this._headers)
		{
			this._req.setRequestHeader(key, this._headers[key]);
		}
		return this._send(payload);
	},

	_send: function(payload)
	{
		return Co.Routine(this,
		[
			function()
			{
				this._req.onreadystatechange = Co.Callback(this, this._callback);
				this._req.send(payload);
				if (this._timeout)
				{
					var self = this;
					this._timer = setTimeout(function()
					{
						if (self._timer)
						{
							self.abort();
							self._timer = null;
							self._req.readyState = 4;
							self._req.status = -1;
							self._req.responseText = "Timeout";
							self._req.onreadystatechange();
						}
					}, this._timeout);
				}
			}
		]);
	},

	_callback: function()
	{
		switch (this._req.readyState)
		{
			case 1:
				this.onLoading();
				break;

			case 2:
				this.onLoaded();
				break;

			case 3:
				this.onInteractive();
				break;

			case 4:
				return this.onComplete();
		}
	},

	onLoading: function()
	{
	},

	onLoaded: function()
	{
	},

	onInteractive: function()
	{
	},

	onComplete: function()
	{
		var req = this._req;
		if (this._timer)
		{
			clearTimeout(this._timer);
			this._timer = null;
		}
		if (req.status >= 200 && req.status <= 299)
		{
			return {
				status: req.status,
				text: req.responseText,
				_xml: req.responseXML || undefined,
				status: req.status,
				location: this._url,
				get headers()
				{
					try
					{
						var rheaders = req.getAllResponseHeaders();
						if (typeof rheaders === "string")
						{
							var headers = {};
							rheaders.split("\n").forEach(function(header)
							{
								var split = header.replace("\r", "").split(": ");
								headers[split[0]] = split[1];
							});
							return headers;
						}
						else
						{
							return rheaders;
						}
					}
					catch (_)
					{
						return {};
					}
				},
				// Object getters/setters new syntax. Its an ec5 thing!
				get json()
				{
					if (this._json === undefined)
					{
						if (this.text)
						{
							try
							{
								this._json = JSON.parse(this.text);
							}
							catch (_)
							{
								try
								{
									// Attempt to handle JSONP
									this._json = JSON.parse(this.text.replace(/[^{]*({.*})[^}]*/, "$1"));
								}
								catch (_)
								{
									this._json = null;
								}
							}
						}
						else
						{
							this._json = null;
						}
					}
					return this._json;
				},
				get xml()
				{
					if (this._xml === undefined)
					{
						if (this.text && window.DOMParser)
						{
							try
							{
								this._xml = new DOMParser().parseFromString(this.text, "text/xml");
							}
							catch (_)
							{
								this._xml = null;
							}
						}
					}
					return this._xml;
				}

			};
		}
		else
		{
			//console.log("Ajax: status: " + this._req.status + " for " + this._url);
			var error = new Error("Ajax: status: " + req.status + " for " + this._url + " message " + req.responseText);
			error.status = req.status;
			error.url = this._url;
			error.text = req.responseText;
			error.xml = req.responseXML;
			error.__defineGetter__("headers", function()
			{
				try
				{
					var rheaders = req.getAllResponseHeaders();
					if (typeof rheaders === "string")
					{
						var headers = {};
						rheaders.split("\n").forEach(function(header)
						{
							var split = header.replace("\r", "").split(": ");
							headers[split[0]] = split[1];
						});
						return headers;
					}
					else
					{
						return rheaders;
					}
				}
				catch (_)
				{
					return {};
				}
			});
			error.__defineGetter__("json", function()
			{
				if (this._json === undefined)
				{
					if (!this.xml && this.text)
					{
						try
						{
							this._json = JSON.parse(this.text);
						}
						catch (_)
						{
							try
							{
								// Attempt to handle JSONP
								this._json = JSON.parse(this.text.replace(/[^{]*({.*})[^}]*/, "$1"));
							}
							catch (_)
							{
								this._json = null;
							}
						}
					}
					else
					{
						this._json = null;
					}
				}
				return this._json;
			});
			throw error;
		}
	}
});

var Co = exports.Co =
{
	_current: exports.Globals._$cocurrent || (exports.Globals._$cocurrent =
	{
		co: null,
		id: 1,
		yieldId: 1,

		_Info: function(scope, fns, init, ctx)
		{
			this.caller = null;
			this.result = new Co._current._Value(init);
			this.scope = scope;
			this.fns = fns;
			this.pos = 0;
			this.listeners = [];
			this.context = ctx || (Co._current.co && Co._current.co.context) || {};
			this.cookie = 1;
		},

		_Value: function(value)
		{
			this.value = value;
			this.read = false;
		},

		_Exception: function(exception)
		{
			this.exception = exception;
			this.read = false;
		},
	}),

	_dispatch: function(co)
	{
		co.running = true;
		var old = this._current.co;
		this._current.co = co;

		while (co.result)
		{
			if (co.pos < co.fns.length)
			{
				var result = undefined;
				var cookie = co.cookie;
				try
				{
					// Save the current result so the invoked function can retrieve it
					var cresult = co.result;
					co.result = undefined;

					// Call the next function in the co-routine
					result = co.fns[co.pos++].call(co.scope, function()
					{
						if (!cresult)
						{
							return undefined;
						}
						cresult.read = true;
						if (cresult.__proto__.constructor === Co._current._Exception)
						{
							throw cresult.exception;
						}
						return cresult.value;
					});

					// If we had an exception and we didnt see it, pass it to the next function
					if (cresult.__proto__.constructor === Co._current._Exception && !cresult.read)
					{
						result = cresult;
					}
					else if (result !== undefined)
					{
						if (result === null)
						{
							result = new Co._current._Value(null);
						}
						else
						{
							var type = result.__proto__.constructor;
							if (type === Co._current._Info)
							{
								// If we return a co-routine info, this indicates we should
								// allow this child co-routine to return a value to us (caller)
								// when it completes.
								if (result.result === undefined)
								{
									result.caller = co;
								}
								result = result.result;
							}
							else if (type !== Co._current._Value)
							{
								result = new Co._current._Value(result);
							}
						}
					}
				}
				catch (e)
				{
					result = new Co._current._Exception(e);
				}

				// If we have a result and a matching cookie, set the result
				if (result && co.cookie === cookie)
				{
					co.result = result;
					co.cookie++;
				}
			}
			else if (co.caller)
			{
				this._current.co = co.caller;
				co.caller.result = co.result;
				co.caller = null;
				co.running = false;
				co = this._current.co;
				co.running = true;
			}
			else
			{
				if (co.result.__proto__.constructor === Co._current._Exception)
				{
					Log.exception(co.result.exception);
				}
				break;
			}
		}

		this._current.co = old;
		co.running = false;

		return co;
	},

	/**
	 * Performs a CoRoutine. Will execute an array of functions serially on a given scope. Executes the function after the previous function returns (unless it's the first!).
	 * @param {Object} scope The scope on which to perform the CoRoutine.
	 * @param {Array} fns An array of functions to execute serially.
	 * @param init Initial argument to first function. Optional.
	 * @param ctx The context to use. Optional.
	 * @example
	 * Co.Routine(this,
	 * [
	 *     function()
	 *     {
	 *         new Ajax().get("http://www.rockmelt.com/");
	 *     },
	 *     function(r)
	 *     {
	 *         var text = r().text;
	 *         // ...
	 *     }
	 * ]);
	 */
	Routine: function(scope, fns, init, ctx)
	{
		return this._dispatch(new Co._current._Info(scope, fns, init, ctx));
	},

	/**
	 * Allows you to return the return of a callback function.
	 * @param {Object} scope The scope on which to perform this function.
	 * @param {Function} fn The callback function.
	 * @returns The return value of the fn function.
	 * @example
	 * Co.Routine(this,
	 * [
	 *     function()
	 *     {
	 *         var fn = Co.Callback(this, function()
	 *         {
	 *             return 10;
	 *         });
	 *         setTimeout(fn, 500);
	 *     },
	 *     function(r)
	 *     {
	 *         console.log( r() );    // 10, after 500 ms
	 *     }
	 * ]);
	 */
	Callback: function(scope, fn)
	{
		var co = this._current.co || new Co._current._Info(null, []);
		var cookie = co.cookie;
		return function()
		{
			var old = Co._current.co;
			Co._current.co = co;

			var result;
			try
			{
				// Invoke callback
				result = fn.apply(scope, arguments);

				// And wrap the result
				if (result !== undefined)
				{
					if (result === null)
					{
						result = new Co._current._Value(null);
					}
					else
					{
						var type = result.__proto__.constructor;
						if (type === Co._current._Info)
						{
							if (result.result === undefined)
							{
								result.caller = co;
							}
							result = result.result;
						}
						else if (type !== Co._current._Value)
						{
							result = new Co._current._Value(result);
						}
					}
				}
			}
			catch (e)
			{
				result = new Co._current._Exception(e);
			}

			Co._current.co = old;

			// If we have a result and a matching cookie, set the result
			if (result && co.cookie === cookie)
			{
				co.result = result;
				co.cookie++;
				if (!co.running)
				{
					Co._dispatch(co);
				}
			}
		}
	},

	/**
	 * Tell me the ID of an object, in a CoRoutine context.
	 * @param obj The thing to find the ID of.
	 * @returns The ID.
	 */
	Id: function(obj)
	{
		if (typeof obj !== "string")
		{
			return obj._$event || (obj._$event = ("__" + this._current.id++));
		}
		else
		{
			return obj;
		}
	},

	/**
	 * Like a CoRoutine, but it runs forever. Stops at a Co.Break() or if an exception is uncaught.
	 * @see Co#Routine
	 * @param {Object} scope The scope on which to perform the CoRoutine.
	 * @param {Array} fns An array of functions to execute serially.
	 */
	Forever: function(scope, fns)
	{
		return this.Routine(scope, fns.concat(function(value)
		{
			try
			{
				value = value();
				Co._current.co.pos = 0;
				return Co.Value(value);
			}
			catch (e)
			{
				// Exceptions terminate loops
				throw e;
			}
		}));
	},

	/**
	 * Co.Break allows you to break out of a Co.Routine or a Co.Forever loop. It must be returned.
	 * @param [v=true] To return. Optional.
	 * @returns true, or the argument that was passed
	 * @example
	 * var foo = 0;
	 * Co.Forever(this,
	 * [
	 *     function()
	 *     {
	 *         foo ++;
	 *         if (foo < 500)
	 *         {
	 *             return foo;
	 *         }
	 *         else
	 *         {
	 *             return Co.Break();
	 *         }
	 *     }
	 * ]);
	 * // foo is now 500
	 */
	Break: function(v)
	{
		this._current.co.pos = this._current.co.fns.length;
		return arguments.length == 0 ? true : v;
	},

	/**
	 * Co.Continue lets you jump back to the first Co.Routine block (or the first Co.Forever block). It must be returned.
	 * @param [v=true] To return. Optional.
	 * @returns true, or the argument that was passed
	 * @example
	 * Co.Routine(this,
	 * [
	 *     function()
	 *     {
	 *         return Co.Continue();
	 *     },
	 *     function()
	 *     {
	 *         // This runs forever and never gets here :(
	 *     }
	 * ]);
	 */
	Continue: function(v)
	{
		this._current.co.pos = 0;
		return arguments.length == 0 ? true : v;
	},

	/**
	 * Co.Map is like a Co.Routine, but you also pass it an array. Each element in the array will be an argument to the first function.
	 * @param {Object} scope The scope under which to execute this stuff.
	 * @param {Array} fns An array of functions.
	 * @param {Array} data An array to be passed.
	 * @example
	 * var input = [2, 5, 10];
	 * var result = [];
	 * Co.Map(this,
	 * [
	 *     function(x)
	 *     {
	 *         result.push(x());    // x() is going to be 2, then 5, then 10
	 *     }
	 * ]);
	 * // result is now [4, 25, 100]
	 */
	Map: function(scope, fns, data)
	{
		return Co.Routine(this,
		[
			function()
			{
				var hasException = null;
				var results;
				var done = Co.Callback(this, function()
				{
					if (hasException)
					{
						hasException.results = results;
						throw hasException;
					}
					else
					{
						return results;
					}
				});
				var count = 1;
				fns = fns.concat(function(value)
				{
					try
					{
						results[Co.Context().idx] = value();
					}
					catch (e)
					{
						hasException = hasException || e;
						results[Co.Context().idx] = e;
					}
					if (--count == 0)
					{
						done();
					}
				});
				if (Object.prototype.toString.call(data) === "[object Array]")
				{
					results = [];
					for (var idx = 0, len = data.length; idx < len; idx++)
					{
						count++;
						Co.Routine(scope, fns, data[idx], { idx: idx });
					}
				}
				else
				{
					results = {};
					for (var k in data)
					{
						count++;
						Co.Routine(scope, fns, data[k], { idx: k });
					}
				}
				if (--count == 0)
				{
					done();
				}
			}
		]);
	},

	/**
	 * In contrast to a Routine, a Scatter executes each block in tandem.
	 * @param {Object} scope The scope on which to perform the CoRoutine.
	 * @param {Array} fns An array of functions to execute serially.
	 * @example
	 * var foo = 5;
	 * var bar = 10;
	 * Co.Scatter(this,
	 * [
	 *     function()
	 *     {
	 *         var fn = Co.Callback(this, function()
	 *         {
	 *             return foo = 6;
	 *         });
	 *         setTimeout(fn, 500);
	 *     },
	 *     function()
	 *     {
	 *         var fn = Co.Callback(this, function()
	 *         {
	 *             return bar = 12;
	 *         });
	 *         setTimeout(fn, 1000);
	 *     }
	 * ]);
	 * // At the start, foo = 5, bar = 10
	 * // After 600ms, foo = 6, bar = 10
	 * // After 1100ms, foo = 6, bar = 12
	 * // In a regular Routine, this would take 1500ms.
	 */
	Scatter: function(scope, fns)
	{
		return this.Map(scope,
		[
			function(fn)
			{
				return fn().call(this);
			}
		], fns);
	},

	/**
	 * Co.Value allows you to return anything, including undefined (unlike the normal return statement, which breaks the Routine if it's undefined.
	 * @param v Return this.
	 * @returns The argument passed.
	 * @example
	 * Co.Routine(this,
	 * [
	 *     function()
	 *     {
	 *         return Co.Value(5);    // This is like saying "return 5"
	 *     },
	 *     function()
	 *     {
	 *         var x;                 // x is undefined
	 *         return Co.Value(x);    // This continues; "return undefined" breaks out
	 *     }
	 * ]);
	 */
	Value: function(v)
	{
		return new Co._current._Value(v);
	},

	/**
	 * Returns the context you're currently in. Called inside of a CoRoutine.
	 * @returns The context you're in.
	 * @example
	 * Co.Routine(this,
	 * [
	 *     function()
	 *     {
	 *         return Co.Context();    // "foo"
	 *     }
	 * ], null, "foo");
	 */
	Context: function()
	{
		return this._current.co && this._current.co.context;
	},

	/**
	 * Wrapping allows you to make aliases of functions that have success and/or error callbacks.
	 * @param {Object} context The context to use
	 * @param {Function} func The function you're making an alias of
	 * @param {String} fmt One character per argument. S = success callback, E = error callback, _ = any other argument
	 */
	Wrap: function(context, func, fmt)
	{
		// fmt == one char per arg.  S = success callback, E = error callback, _ = any other arg
		var incoming = "";
		var outgoing = "";
		function s()
		{
			switch (arguments.length)
			{
				case 0:
					return Co.Value(undefined);
				case 1:
					return Co.Value(arguments[0]);
				default:
					return Co.Value(Array.prototype.slice.call(arguments));
			}
		}
		function e()
		{
			var e = new Error("Call failed: " + func.name || "unknown");
			if (arguments.length == 1)
			{
				e.returnValue = arguments[0];
			}
			e.returnValues = arguments;
			e.type = "callfailed";
			throw e;
		}
		for (var i = 0, len = fmt.length; i < len; i++)
		{
			switch (fmt[i])
			{
				case "s":
					outgoing += ",s";
					break;

				case "e":
					outgoing += ",e";
					break;

				default:
					incoming += ",a" + i;
					outgoing += ",a" + i;
					break;
			}
		}
		return eval("(function(" + incoming.substring(1) + "){return Co.Routine(this,[ function(){ var s=Co.Callback(this," + s + "),e=Co.Callback(this," + e + "); func.call(context" + outgoing + ");} ]);})");
	},

	/**
	 * Co.Yield is effectively Co.Sleep(0).
	 * @see Co#Timeout
	 * @param {Object} cancel Gives this object a cancel() method, which will cancel this Timeout. Optional.
	 * @example
	 * Co.Routine(this,
	 * [
	 *     function()
	 *     {
	 *         var sleeper = Co.Callback(this, function()
	 *         {
	 *             return Co.Sleep(2);
	 *         });
	 *         var yielder = Co.Callback(this, function()
	 *         {
	 *             return Co.Yield();
	 *         });
	 *         sleeper();
	 *         yielder();
	 *     },
	 *     function(r)
	 *     {
	 *         // Goes here instantly
	 *     }
	 * ]);
	 */
	Yield: function(cancel)
	{
		return typeof postMessage !== "undefined" ? this._fastYield(cancel) : this.Sleep(0, cancel);
	},

	/**
	 * Co.Timeout is like Co.Sleep, but it throws an error on completion. Often used when you want to specify when you want to specify a maximum wait time before you just say "screw it".
	 * @see Co#Sleep
	 * @param {Number} secs The number of seconds to sleep
	 * @param {Object} cancel Gives this object a cancel() method, which will cancel this Timeout. Optional.
	 * @example
	 * Co.Routine(this,
	 * [
	 *     function()
	 *     {
	 *         return SomethingAsynchronous();
	 *         Co.Timeout(5);    // 5 seconds is max wait time
	 *     },
	 *     function(r)
	 *     {
	 *         try
	 *         {
	 *             DoSomethingWithTheReturn(r());
	 *         }
	 *         catch (e)
	 *         {
	 *             if (e == "Timeout")
	 *             {
	 *                 TookTooLong();
	 *             }
	 *         }
	 *     }
	 * ]);
	 */
	Timeout: function(secs, cancel)
	{
		var co = this._current.co;
		co.listeners.push([
			{
				clearTimeout: function(id)
				{
					clearTimeout(id);
				}
			},
			setTimeout(this.Callback(this, function()
			{
				if (cancel)
				{
					delete cancel.cancel;
				}
				Co.Cancel(co);
				var e = new Error("Timeout");
				e.type = "timeout";
				throw e;
			}), secs * 1000)
		]);
		if (cancel)
		{
		    cancel.cancel = function()
		    {
		        Co.Cancel(co);
		    };
		}
		return undefined;
	},

	/**
	 * Co.Sleep sleeps for a given number of seconds.
	 * @param {Number} secs The number of seconds to sleep
	 * @param {Object} cancel Gives this object a cancel() method, which will cancel this Sleep. Optional.
	 * @example
	 * Co.Routine(this,
	 * [
	 *     function()
	 *     {
	 *         Co.Sleep(1);
	 *     },
	 *     function()
	 *     {
	 *         alert("This will alert after 1 second.");
	 *     }
	 * ]);
	 */
	Sleep: function(secs, cancel)
	{
		return Co.Routine(this,
		[
			function()
			{
				Co.Timeout(secs, cancel);
			},
			function(r)
			{
				try
				{
					r();
				}
				catch (_)
				{
				}
				return { type: "timeout" };
			}
		]);
	},

	_fastYield: function(cancel)
	{
		return Co.Routine(this,
		[
			function()
			{
				var co = this._current.co;
				co.cookie++;
				var id = "fast-yield-" + (++this._current.yieldId);
				var callback = Co.Callback(this, function(evt)
				{
					if (evt.source == window && evt.data == id)
					{
						window.removeEventListener(callback, false);
						if (cancel)
						{
							delete cancel.cancel;
						}
						return { type: "timeout" };
					}
				});
				window.addEventListener("message", callback, false);
				window.postMessage(id, "*");
				if (cancel)
				{
				    cancel.cancel = function()
				    {
				        Co.Cancel(co);
				    };
				}
			}
		]);
	},

	/**
	 * WaitFor allows you to wait for something to happen.
	 * @param arguments Put in array(s) that have two values: the object, and its event you're waiting for.
	 * @example
	 * Co.Routine(this,
	 * [
	 *     function()
	 *     {
	 *         var image = new Image();
	 *         image.src = "test.png";
	 *         return Co.WaitFor([image, "load"]);
	 *     },
	 *     function()
	 *     {
	 *         // the image has loaded
	 *     }
	 * ]);
	 */
	WaitFor: function()
	{
		var many = arguments;
		return Co.Routine(this,
		[
			function()
			{
				var co = this._current.co;
				var callback = Co.Callback(this, function()
				{
					Co.Cancel(co);
					switch (arguments.length)
					{
						case 0:
							return Co.Value(undefined);
						case 1:
							return Co.Value(arguments[0]);
						default:
							return Co.Value(Array.prototype.slice.call(arguments));
					}
				});
				for (var i = 0; i < many.length; i++)
				{
					var one = many[i];
					var type = Object.prototype.toString.call(one);
					if (type !== "[object Array]" && type !== "[object Arguments]")
					{
						one = [ one ];
					}
					if (one[0].addEventListener)
					{
						co.listeners.push([ one[0], one[1], one[2], callback ]);
						one[0].addEventListener(one[1], callback, one[2]);
					}
					else if (one[0].addListener)
					{
						if (one[1])
						{
							function check()
							{
								if (arguments.length > 0 && arguments[0].name == one[1])
								{
									callback.apply(null, arguments);
								}
							}
							co.listeners.push([ one[0], check ]);
							one[0].addListener(check);
						}
						else
						{
							co.listeners.push([ one[0], callback ]);
							one[0].addListener(callback);
						}
					}
					else
					{
						var e = new Error("Not observable");
						e.type = "notobservable";
						throw e;
					}
				}
			}
		]);
	},

	_EventQ: Class(
	{
		initialize: function(args)
		{
			this._q = [];
			Co.Forever(this,
			[
				function()
				{
					this._loop = this._current.co;
					Co.WaitFor.apply(Co, args);
				},
				function()
				{
					try
					{
						if (this._callback && !this._q.length)
						{
							this._callback(Co.Value());
						}
						else
						{
							this._q.push(Co.Value());
						}
					}
					catch (e)
					{
						console.log(e.stack || e);
					}
					return true;
				}
			]);
		},

		addListener: function(callback)
		{
			this._callback = callback;
			if (this._q.length)
			{
				callback(this._q.shift());
			}
		},

		removeListener: function()
		{
			this._callback = null;
		},

		cancel: function()
		{
			Co.Cancel(this._loop);
		}
	}),

	EventQ: function()
	{
		return new this._EventQ(arguments);
	},

	/**
	 * Stops a Co.Sleep or a Co.Timeout from happening and break out of the Routine/Forever. Never explicitly called.
     * @example
     * Co.Routine(this,
     * [
     *     function()
     *     {
     *         var obj = {};
     *         Co.Timeout(5, obj);
     *         setTimeout(function()
     *         {
     *             return obj.cancel();
     *         }, 500);
     *     }
     * ]);
     */
	Cancel: function(co)
	{
		if (co.listeners.length)
		{
			for (var i = 0; i < co.listeners.length; i++)
			{
				var one = co.listeners[i];
				if (one[0].removeEventListener)
				{
					one[0].removeEventListener(one[1], one[3], one[2]);
				}
				else if (one[0].removeListener)
				{
					one[0].removeListener(one[1]);
				}
				else if (one[0].clearTimeout)
				{
					one[0].clearTimeout(one[1]);
				}
			}
			co.listeners = [];
		}
	},

	/**
	 * Lock allows you to lock a particular object so that its properties can't be changed until you are done with the Lock.
	 * @param {Object} scope The scope on which to perform the CoRoutine.
	 * @param {Array} fns An array of functions to execute serially.
	 */
	Lock: function(scope, fn /* ... args ... */)
	{
		var args = arguments;
		if (!scope._$lock)
		{
			scope._$lock = { queue: [], locked: undefined };
		}
		if (scope._$lock.locked === undefined)
		{
			return Co.Routine(this,
			[
				function()
				{
					scope._$lock.locked = true;
					return fn.apply(scope, args.length > 2 ? Array.prototype.slice.call(args, 2) : []);
				},
				function(r)
				{
					scope._$lock.locked = undefined;
					if (scope._$lock.queue.length)
					{
						scope._$lock.queue.shift()();
					}
					return r();
				}
			]);
		}
		else
		{
			return Co.Routine(this,
			[
				function()
				{
					scope._$lock.queue.push(Co.Callback(this, function()
					{
						return this.Lock.apply(this, args);
					}));
				}
			]);
		}
	}
};

/**
 * A key value store holding event objects
 * The key is the object name/id
 * The value is an event object
 */
var events = exports.Globals._$lava_core_events || (exports.Globals._$lava_core_events = { events: {} });

/**
 * A key value store holding all listeners for a particular object
 * The key is the object name/id
 * The value is an array of listeners attached to that object.
 *
 * This store is required because onunload, we want to unsubscribe all listeners.
 * LocalEvent could have had a removeAllListeners but chrome.Event doesn't have a
 * removeAllListeners call. So, we keep this store and iterate over it & use removeListener.
 */
var listeners = {};

/**
 * A local event mimics the API of the chrome.Event but is used purely for
 * sending events within an application. Use a chrome.Event if you also want to
 * receive events generated by the system.
 * An example of a LocalEvent is a "change" event fired by a model when it changes.
 */
var LocalEvent = Class(
{
	initialize: function(name)
	{
		this._name = name;
		// Store for all listeners attached to this Event Object
		this.listeners_ = [];
	},

	addListener: function(callback)
	{
		this.listeners_.push(callback);
	},

	removeListener: function(callback)
	{
		var idx = this.listeners_.indexOf(callback);
		if (idx != -1)
		{
			this.listeners_.splice(idx, 1);
		}
	},

	dispatch: function()
	{
		var status = false;
		for (var i = 0; i < this.listeners_.length; i++)
		{
			try
			{
				var r = this.listeners_[i].apply(null, arguments);
				if (r === true)
				{
					status = true;
				}
			}
			catch (e)
			{
				console.log(e.stack || e);
			}
		}
		return status;
	},

	hasListeners: function()
	{
		return this.listeners_.length > 0;
	},

	hasListener: function(fn)
	{
		for (var i = this.listeners_.length - 1; i >= 0; i--)
		{
			if (this.listeners_[i] === fn)
			{
				return true;
			}
		}
		return false;
	}
});

/**
 * A proxy event is created per name per window, and proxies a shared event.
 * A shared event is either a localEvent or a chome.Event.
 */
var ProxyEvent = Class(
{
	initialize: function(name)
	{
		this._name = name;
	},

	addListener: function(callback)
	{
		// Dont proceed if callback is not a function
		if (typeof callback !== "function")
		{
			var e = new Error("Event.addListener: Missing function");
			e.type = "missing_function";
			throw e;
		}

		// Add callback to the list of listeners on this object
		(listeners[this._name] || (listeners[this._name] = [])).push(callback);

		var proxy = events.events[this._name];
		if (!proxy)
		{
			// Check if its a local event or a chrome extensions aka system event
			if (this._name.charAt(0) === "_")
			{
				proxy = events.events[this._name] = new LocalEvent(this._name);
			}
			else
			{
				proxy = events.events[this._name] = new chrome.Event(this._name);
			}
		}
		proxy.addListener(callback);

		return true;
	},

	removeListener: function(callback)
	{
		// Dont proceed if callback is not a function
		if (typeof callback !== "function")
		{
			var e = new Error("Event.removeListener: Missing function");
			e.type = "missing_function";
			throw e;
		}

		// Grab the list of event objects for this object and proceed to remove listeners, only if any
		var proxy = events.events[this._name];
		if (proxy)
		{
			var list = listeners[this._name] || [];
			var idx = list.indexOf(callback);
			if (idx != -1)
			{
				proxy.removeListener(callback);
				list.splice(idx, 1);

				if (list.length == 0)
				{
					delete listeners[this._name];	// Get rid of the entry in the listeners object
				}
				if (!proxy.hasListeners())
				{
					delete events.events[this._name];
				}
				return true;
			}
		}
		return false;
	},

	dispatch: function()
	{
		var proxy = events.events[this._name];
		return proxy ? proxy.dispatch.apply(proxy, arguments) : false;
	},

	hasListeners: function()
	{
		var proxy = events.events[this._name];
		return proxy ? proxy.hasListeners() : false;
	},

	hasListener: function(fn)
	{
		var proxy = events.events[this._name];
		return proxy ? proxy.hasListener(fn) : false;
	},

	id: function()
	{
		return this._name;
	},

	setProxy: function(proxy)
	{
		if (events.events[this._name])
		{
			throw new Error("Cannot set event proxy - already set");
		}
		events.events[this._name] = proxy;
	}
});

/**
 * Return an event object associated with the name or object passed in.
 * We return a local event proxy (because we need to keep them local to the current window)
 * which proxies a shared event object.  The shared event object is either a chrome.Event (if we
 * want to use it go get events from the system) or a localEvent if its purely internal to the
 * application.
 */
exports.Event = function(obj)
{
	return new ProxyEvent(typeof obj !== "string" ? Co.Id(obj) : obj);
};

/**
 * Provide a quick way to see if anyone is listening to an object.
 * No point in sending events if this is the case.
 */
exports.EventHasListeners = function(obj)
{
	var e = events.events[typeof obj !== "string" ? obj._$event : obj];
	return e && e.hasListeners();
};

if (typeof window !== "undefined")
{
	/**
	 * When the window unloads, remove any listeners created in this window from their
	 * shared events.  If we don't do this, we end up keeping the window around even
	 * when it's been closed.
	 */
	window.addEventListener("unload", function()
	{
		for (var name in listeners)
		{
			var proxy = events.events[name];
			if (proxy)
			{
				var list = listeners[name];
				for (var i = list.length - 1; i >= 0; i--)
				{
					proxy.removeListener(list[i]);
					if (!proxy.hasListeners())
					{
						delete events.events[name];
					}
				}
			}
		}
		listeners = null;
	});
}

exports.Event.removeListenerFromAll = function(fn)
{
    for (var name in listeners)
	{
		var proxy = events.events[name];
		if (proxy)
		{
			var list = listeners[name];
			for (var i = list.length - 1; i >= 0; i--)
			{
			    if (fn == list[i])
			    {
    				proxy.removeListener(list[i]);
    				if (!proxy.hasListeners())
    				{
    					delete events.events[name];
    				}
    			}
			}
		}
	}
}

exports.EventAdaptor = function(obj)
{
	return function(evt)
	{
		var name = evt.name;
		if (name)
		{
			var fn = obj["on" + name];
			if (fn)
			{
				return fn.call(obj, evt) === false ? false : true;
			}
			else if (obj.onEvent)
			{
				return obj.onEvent(evt) === false ? false : true;
			}
			else
			{
				return undefined;
			}
		}
		return undefined;
	}
};

/**
 * @class A template.
 */
exports.Template = Class(
{
	_pattern: /{{(.*?)}}/g,

	/**
	 * Creates a new Template.
	 * @constructor
	 * @param {String} template The template to use, which must match the pattern.
	 * @param {RegExp} pattern The pattern to use, if different from the default. Optional.
	 */
	initialize: function(template, pattern)
	{
		var split = template.split(pattern || this._pattern);
		var len = split.length;
		template = new Array(len);
		len--;
		var map = new Array((len / 2) | 0);
		var names = {};
		for (var i = 0; i < len; i += 2)
		{
			template[i] = split[i];
			var name = split[i+1];
			map[i/2] = name;
			names[name] = name;
		}
		template[len] = split[len];
		this._map = map;
		this._template = template;
		this._names = names;
	},

	/**
	 * Does the main bit of a Template: does the fancy find-replace.
	 * @param value Can either be an object with properties to stringify, or a list of arguments to stringify. Depends on the template.
	 * @returns {String} A string that is made by the template.
	 * @example
	 * var template = new exports.Template("foo{{name}}");
	 * var obj = {
	 *     name: "bar"
	 * };
	 * template.eval(obj);    // "foobar"
	 * @example
	 * var template = new exports.Template("{{1}}, {{2}}");
	 * template.eval("foo", "bar");    // "foo, bar"
	 */
	eval: function(value)
	{
		var args = typeof value === "object" && arguments.length === 1 ? value : arguments;
		var map = this._map;
		var template = this._template;
		for (var i = map.length - 1; i >= 0; i--)
		{
		    var name = map[i];
			var arg = name in args ? args[name] : this.missing(name, args);
			template[i * 2 + 1] = typeof arg === "function" ? arg.call(args) : arg;
		}
		return template.join("");
	},

	/**
	 * Returns the number of things it'll need to replace.
	 * @returns {Number} Amount of things this template replaces.
	 * @example
	 * var t = new exports.Template("{{0}} {{1}} {{2}}!");
	 * t.length();    // 3
	 */
	length: function()
	{
		return this._map.length;
	},

	/**
	 * Returns an object that has the names of what it's replacing.
	 * @returns {Object} Hashmap of the names.
	 * @example
	 * var t = new exports.Template("{{name}}, {{title}}!");
	 * t.names();    // {
	 *               //     name: "name",
	 *               //     title: "title"
	 *               // }
	 */
	names: function()
	{
	    return this._names;
	},

	/**
	 * Returns null.
	 * @param name This argument does nothing.
	 * @param values This argument also does nothing.
	 * @returns null
	 */
	missing: function(name, values)
	{
	    return null;
	},

	_expression: function(expr, args)
	{
		var toks = expr.split(/([a-zA-Z_$][a-zA-Z_$0-9]*)|(["'].*['"])/g);
		for (var i = 0, len = toks.length; i < len; i += 3)
		{
			var identifer = tok[i + 1];
			if (identifier in args)
			{
				identifier = "args." + identifier;
				if (typeof identified[model] === "function")
				{
					identifier += "()";
				}
				tok[i + 1] = identifier;
			}
		}
		return eval(expr);
	}
});

var Url = exports.Url = Class(
{
	initialize: function(url)
	{
		if(!url)
		{
			core.Log.log('Request to create empty url object',console.trace());
			return;
		}
		//based on parseURL by brothercake - http://www.brothercake.com/

		//save the unmodified url to href property
		//so that the object we get back contains
		//all the same properties as the built-in location object
		this.href = url;

		//split the URL by single-slashes to get the component parts
		var parts = url.replace('//', '/').split('/');

		//store the protocol and host
		this.protocol = parts[0];
		this.host = parts[1];
		this.origin = this.protocol + "//" + this.host;

		//extract any port number from the host
		//from which we derive the port and hostname
		parts[1] = parts[1].split(':');
		this.hostname = parts[1][0];
		this.port = parts[1].length > 1 ? parts[1][1] : '';

		//splice and join the remainder to get the pathname
		parts.splice(0, 2);
		this.pathname = '/' + parts.join('/');

		//extract any hash and remove from the pathname
		this.pathname = this.pathname.split('#');
		this.hash = this.pathname.length > 1 ? '#' + this.pathname[1] : '';
		this.pathname = this.pathname[0];

		//extract any search query and remove from the pathname
		this.pathname = this.pathname.split('?');
		this.search = this.pathname.length > 1 ? '?' + this.pathname[1] : '';
		this.pathname = this.pathname[0];

		//parse out the search arguments
		var args = {};
		var split = this.search.slice(1).split("&");
		for (var i = 0; i < split.length; i++)
		{
			var parts = split[i].split("=");
			if (parts.length == 2)
			{
				var key = decodeURIComponent(parts[0]);
				if (args[key])
				{
					if (typeof args[key] === "string")
					{
						args[key] = [ args[key], decodeURIComponent(parts[1]) ];
					}
					else
					{
						args[key].push(decodeURIComponent(parts[1]));
					}
				}
				else
				{
					args[key] = decodeURIComponent(parts[1]);
				}
			}
		}
		this.args = args;
	}
});

var __loadCount = 1;
var __main;

/**
 * When all the JavaScript and CSS loads, call a __main() function. If that's not there, call window.main(). If that's not there, put out an error.
 */
function __loadDocOkay()
{
	if (--__loadCount == 0)
	{
		__loadCount = Number.MAX_VALUE;
		(__main || window.main || function() { console.error("No main function"); })();
	}
}

function __loadInDoc(elem)
{
	elem.onload = __loadDocOkay;
	elem.onerror = __loadDocOkay;
	__loadCount++;
}

exports.JS = {};

/**
 * Load new JavaScript files on the fly.
 * @param {String} Any number of files to add. Prepends "javascript/" to whatever you throw at it.
 * @example
 * exports.JS.load("foo.js");    // loads javascript/some_code.js
 * exports.JS.load("../foo.js"); // loads foo.js
 */
if (require.__loadjs)
{
	exports.JS.load = function()
	{
		var len = arguments.length - 1;
		__main = arguments[len];
		if (typeof __main !== "function")
		{
			__main = null;
			len++;
		}
		for (var i = 0; i < len; i++)
		{
			try
			{
				require.__loadjs("javascript/" + arguments[i]);
			}
			catch (e)
			{
				console.log("Failed to load JS: " + arguments[i], e);
			}
		}
		if (document.readyState === "complete")
		{
			__loadDocOkay();
		}
		else
		{
			window.onload = __loadDocOkay;
		}
	}
}
else
{
	exports.JS.load = function()
	{

		var head = document.head;
		var len = arguments.length - 1;
		__main = arguments[len];
		if (typeof main !== "function")
		{
			__main = null;
			len++;
		}
		for (var i = 0; i < len; i++)
		{
			var s = document.createElement("script");
			s.src = "javascript/" + arguments[i];
			__loadInDoc(s);
			head.appendChild(s);
		}
		if (document.readyState === "complete")
		{
			__loadDocOkay();
		}
		else
		{
			window.onload = __loadDocOkay;
		}
	};
}

exports.CSS =
{
	/**
	 * Add any number of CSS files to your page.
	 * @param Any number of CSS files.
	 * @example
	 * exports.CSS.load("foo.css");
	 * @example
	 * exports.CSS.load("foo.css", "bar.css");
	 */
	load: function()
	{
		for (var i = 0; i < arguments.length; i++)
		{
			var path = arguments[i];
			var link = document.createElement("link");
			link.rel = "stylesheet";
			link.type = "text/css";
			link.href = path;
			var fakelink = new Image();
			__loadInDoc(fakelink);
			fakelink.src = path;
			document.head.appendChild(link);
		}
	},

	/**
	 * Add a rule with the given selector.
	 * @param {String} selector The selector to use.
	 * @param {String} body The body of the rule, surrounded by curly braces.
	 * @returns {Object} The rule that was just added.
	 * @example
	 * exports.CSS.addRule(".foo", "{ font-size: 10em }");
	 */
	addRule: function(selector, body)
	{
		var styles = this._styles;
		if (!styles)
		{
			document.head.appendChild(document.createElement("style"));
			this._styles = styles = document.styleSheets[document.styleSheets.length - 1];
		}
		var rules = styles.cssRules;
		styles.insertRule(selector + body, rules.length);
		return { rule: rules[rules.length - 1] };
	},

	/**
	 * Remove the given rule.
	 * @param {Object} rule The rule to remove.
	 * @example
	 * var r = exports.CSS.addRule(".foo", "{ font-size: 10em }");
	 * exports.CSS.removeRule(r);
	 */
	removeRule: function(rule)
	{
		var styles = this._styles;
		if (styles)
		{
			var idx = Array.prototype.indexOf.call(styles.cssRules, rule.rule);
			if (idx != -1)
			{
				styles.removeRule(idx);
				rule.rule = null;
				return
			}
		}
		throw new Error("No CSS rule found");
	},

	/**
	 * Update a rule.
	 * @param {Object} rule The rule to update.
	 * @param {String} body The body of the rule, surrounded by curly braces.
	 * @example
	 * var r = exports.CSS.addRule(".foo", "{ font-size: 10em }");
	 * exports.CSS.updateRule(r, "{ font-size: 100em }");
	 */
	updateRule: function(rule, body)
	{
		var styles = this._styles;
		if (styles)
		{
			var idx = Array.prototype.indexOf.call(styles.cssRules, rule.rule);
			if (idx != -1)
			{
				var selector = rule.rule.selectorText;
				styles.removeRule(idx);
				styles.insertRule(selector + body, idx);
				rule.rule = styles.cssRules[idx];
				return rule;
			}
		}
		throw new Error("No CSS rule found");
	}
};

exports.Resources =
{
	embedHtml: function(config, resources)
	{
		var html = config.html + ".html";
		var css = (config.css || config.html) + ".css";

		var phtml = this.platformSpecific(html, resources);

		(config.node || document.getElementById(config.name)).innerHTML = resources[phtml || html];
		var name = this.getResourceId(config.css || config.html);
		if (!document.getElementById(name))
		{
			var style = document.createElement("style");
			style.textContent = resources[css] ? resources[css] : "";
			style.id = name;
			document.head.appendChild(style);
		}
	},

	get: function(name, resources)
	{
		return resources[name];
	},

	getPlatform: function(name, resources)
	{
		var pname = this.platformSpecific(name, resources);
		return pname ? resources[pname] : null;
	},

	platformSpecific: function(name, resources)
	{
		var idx = name.lastIndexOf(".");
		idx = idx == -1 ? name.length : idx;
		var pname = name.substring(0, idx) + "-" + Environment.platform + name.substring(idx);

		return pname in resources ? pname : null;
	},

	getResourceId: function(name)
	{
		return "embedded-resource-" + name;
	}
};

var _platform;

var Environment = exports.Environment =
{
	/**
	 * Returns "win", "mac", "node", or "unknown", depending on the platform you're using.
	 * @returns {String} "win", "mac", "node", or "unknown".
	 */
	get platform()
	{
		if (!_platform)
		{
			if (typeof navigator === "undefined")
			{
				_platform = "node";
			}
			else switch (navigator.platform)
			{
				case "Win32":
					_platform = "win";
					break;

				case "MacIntel":
					_platform = "mac";
					break;

				default:
					_platform = "unknown";
					break;
			}
		}
		return _platform;
	}
};

exports.Text =
{
	/**
	 * Removes HTML entities from a string.
	 * @param {String} html The HTML to remove HTML tags from.
	 * @param {Number} len Do this many characters before stopping (and append "...". Optional.
	 * @returns {String} The text without HTML entities.
	 * @example
	 * exports.Text.detoxAndTruncate("<b>Hello</b> <i>world</i>");    // "Hello world"
	 * @example
	 * exports.Text.detoxAndTruncate("<b>Hello</b> <i>world</i>", 5);    // "Hello..."
	 */
	detoxAndTruncate: function(html, len)
	{
		var chars = this.safeHtmlNodes(html).textContent;
		if (!len || chars.length < len)
		{
			return chars;
		}

		for (var i = len; i >= 0; i--)
		{
			switch (chars.charAt(i))
			{
				case ' ':
				case '\n':
				case '\t':
					return chars.substring(0, i) + "...";
			}
		}
		return chars.substring(0, len) + "...";
	},

	/**
	 * Splits a string of HTML into DocumentFragment elements.
	 * @param {String} html The HTML to be split into a DocumentFragment.
	 * @returns {DocumentFragment} A document fragment with each element being a DOMElement we can put into the DOM.
	 * @example
	 * var x = exports.Text.safeHtmlNodes("<b>Hello, </b><i>world!</i>");
	 * document.body.appendChild(x);    // Appends the above to the body as DOM elements, not as HTML
	 */
	safeHtmlNodes: function(html)
	{
		var ctx = this._ctx;
		if (!ctx)
		{
			ctx = this._ctx = document.createRange();
			ctx.selectNode(document.body);
		}
		return ctx.createContextualFragment(html);
	},

	/**
	 * Turns an HTML string into a string without any HTML, but instead of removing the tags, it escapes the brackets and quotes.
	 * @param {String} str The HTML to be escaped.
	 * @returns {String} The escaped text.
	 * @example
	 * exports.Text.encodeEntities("Hello, <b>world</b>.");    // "Hello, &lt;b&gt;world&lt;/b&gt;."
	 */
	encodeEntities: function(str)
	{
		return typeof str === "string" ? str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : str;
	},

	/**
	 * Turns escaped HTML into actual HTML.
	 * @param {String} str The HTML to be figured out.
	 * @returns {String} The decoded HTML.
	 * @example
	 * exports.Text.decodeEntities("&lt;b&gt;Hello!&lt;/b&gt;");    // "<b>Hello!</b>"
	 */
	decodeEntities: function(str)
	{
		return typeof str === "string" ? str.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : str;
	},

	/**
	 * Encodes quotes into character codes.
	 * @param {String} str The quotes to escape.
	 * @returns {String} The string with escaped quotes.
	 * @example
	 * expect(exports.Text.encodeQuotes("\"Double quotes\" and 'single quotes.'")).toEqual("%22Double quotes%22 and %27single quotes.%27");
	 */
	encodeQuotes: function(str)
	{
		return typeof str === "string" ? str.replace(/'/g, "%27").replace(/"/g, "%22") : str;
	}
};

var Log = exports.Log =
{
	_enabled: true,
	_lines: [],
	_uuid: localStorage.uuid || (localStorage.uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) { var r = Math.random() * 16; return (c == "x" ? r | 0 : r & 3 | 8).toString(16); })),
	_serviceEndpoint: "https://us-w1.rockmelt.com/extensions/1.0/crash/",

	/**
	 * Wrapper for console.log
	 */
	log: function()
	{
		// Make real array
		var args = Array.prototype.slice.call(arguments);
		console.log.apply(console,args);

		var msg = this._format(args);
		this._lines.push(msg);
	},

	/**
	 * Function to log exceptions
	 * @param {String} action String to define the exception
	 */
	action: function(action /* ... arguments ... */)
	{
		var args = Array.prototype.slice.call(arguments);
		console.error.apply(console,args);

		var msg = this._format(args.slice(1));

		if (this._enabled)
		{
			Co.Routine(this,
			[
				function()
				{
					var id = new core.Url(chrome.extension.getURL("")).host;
					return new core.Ajax().post(
						this._serviceEndpoint + id,
						msg + "\n\nLogging:\n" + this._lines.join("\n"),
						{
							"Content-Type": "application/octet-stream",
							"X-RM-EXTENSIONID": id,
							"X-RM-UUID": this._uuid,
							"X-RM-ACTION": action,
							"X-RM-SUMMARY": msg
						}
					);
				},
				function(r)
				{
					try
					{
						r();
					}
					catch (_)
					{
						// Ignore any errors (otherwise this reporting would get recursive)
					}
				}
			]);
		}
		//clear the buffer
		this._lines = [];
	},

	exception: function(e)
	{
		this.action("exception", e.stack.toString());
	},

	_format: function(args)
	{
		for (var i = 0, il= args.length; i < il; i++)
		{
			// Dont step on user-defined "toString" method on arg, if any
			if (args[i].toString !== Object.prototype.toString)
			{
				args[i] = args[i].toString();
			}
			else if( args[i] && typeof args[i] !== 'object' )	// Check if its an object sans null. typeof null returns "object"
			{
				args[i] = JSON.stringify(arg[i]);
			}
		}
		return args.join(" ");
	}
};

if (typeof window !== "undefined")
{
	window.onerror = function(message, url, linenr)
	{
		Log.action("uncaughtException", url + ":" + linenr + "   Uncaught: " + message);
	}
}

