/**
 * @author Deux Huit Huit
 * 
 * App Debug and Log
 *
 */
;(function ($, undefined) {

	"use strict";
	
	var 
	
	/** Debug **/
	isDebuging = false,
	debug = function (value) {
		if (value === true || value === false) {
			isDebuging = value;
		} else if (value === '!') {
			isDebuging = !isDebuging;
		}
		return isDebuging;
	},
	
	logs = [],
	log = function (arg) {
		if (isDebuging) {
			// no args, exit
			if (!arg) {
				return this;
			}
			
			// ensure that args is an array
			if (!!arg.args && !$.isArray(arg.args)) {
				arg.args = [arg.args];
			}
			
			// our copy
			var a = {
				args: arg.args || arguments,
				fx: arg.fx || 'warn',
				me: arg.me || 'App'
			},
			t1 = $.type(a.args[0]);
			
			if (t1  === 'string' || t1 === 'number' || t1 == 'boolean') {
				// append me before a.args[0]
				a.args[0] = '[' + a.me + '] ' + a.args[0];
			}
			
			if (!!window.console) {
				// make sure fx exists
				if (!$.isFunction(console[a.fx])) {
					a.fx = 'log';
				}
				// call it
				if (!!window.console[a.fx].apply) {
					window.console[a.fx].apply(window.console, a.args);
				} else {
					$.each(a.args, function _logArgs(index, arg) {
						window.console[a.fx](arg);
					});
				}
			}
			
			logs.push(a);
		}
		return this;
	};
	
	/** Public Interfaces **/
	window.App = $.extend(window.App, {
		
		// get/set the debug flag
		debug: debug,
		
		// log
		log: log,
		
		// logs
		logs: function () {return logs;}
		
	});
	
})(jQuery);
