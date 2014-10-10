/**
 * @author Deux Huit Huit
 */
 
 /*
 * Browser Support/Detection
 */
(function ($, global, undefined) {
	
	'use strict';
	
	var queryStringParser = function () {
		var
		a = /\+/g,  // Regex for replacing addition symbol with a space
		r = /([^&=]+)=?([^&]*)/gi,
		d = function (s) { return decodeURIComponent(s.replace(a, ' ')); },
		
		_parse = function (qs) {
			var 
			u = {},
			e,
			q;
			
			//if we dont have the parameter qs, use the window location search value
			if (qs !== '' && !qs) {
				qs = window.location.search;
			}
			
			//remove the first caracter (?)
			q = qs.substring(1);

			while ((e = r.exec(q))) {
				u[d(e[1])] = d(e[2]);
			}
			
			return u;
		};
		
		return {
			parse : _parse
		};
	};
	
	var browserDetector = function () {
		var getUserAgent = function (userAgent) {
			if (!userAgent) {
				return window.navigator.userAgent;
			}
			return userAgent;
		};
		
		var testUserAgent = function (regexp, userAgent) {
			userAgent = getUserAgent(userAgent);
			return regexp.test(userAgent);
		};
		
		var detector = {
		
			isTablette: function (userAgent) {
				return detector.isMobile(userAgent) &&
					!detector.isPhone(userAgent);
			},
			
			isIos: function (userAgent) {
				return detector.isIphone(userAgent) || 
					detector.isIpad(userAgent);
			},
			
			isIphone: function (userAgent) {
				return !detector.isIpad(userAgent) &&
					(testUserAgent(/iPhone/i, userAgent) || testUserAgent(/iPod/i, userAgent));
			},
			
			isIpad: function (userAgent) {
				return testUserAgent(/iPad/i, userAgent);
			},
			
			isAndroid: function (userAgent) {
				return testUserAgent(/Android/i, userAgent);
			},
			
			isAndroidPhone: function (userAgent) {
				return detector.isAndroid(userAgent) && 
					testUserAgent(/mobile/i, userAgent);
			},
			
			isPhone: function (userAgent) {
				return !detector.isIpad(userAgent) && (
					detector.isOtherPhone(userAgent) || 
					detector.isAndroidPhone(userAgent) ||
					detector.isIphone(userAgent));
			},
			
			isOtherPhone: function (userAgent) {
				return testUserAgent(/phone/i, userAgent);
			},
			
			isOtherMobile: function (userAgent) {
				return testUserAgent(/mobile/i, userAgent) ||
					detector.isOtherPhone(userAgent);
			},
			
			isMobile: function (userAgent) {
				return detector.isIos(userAgent) || 
					detector.isAndroid(userAgent) || 
					detector.isOtherMobile(userAgent);
			},
			
			isMsie: function (userAgent) {
				return testUserAgent(/msie/mi, userAgent) || 
					testUserAgent(/trident/mi, userAgent);
			}
			
			/*isUnsupported : function (userAgent) {
				var 
				b;
				userAgent = getUserAgent(userAgent);
				b = $.uaMatch(userAgent);
				
				return b.browser === "" || (b.browser == 'msie' && parseInt(b.version,10)) < 9;
			}*/
		};
		
		// return newly created object
		return detector;
	};
	
	// Query string Parser
	// http://stackoverflow.com/questions/901115/get-query-string-values-in-javascript
	global.QueryStringParser = queryStringParser();
	
	//Parse the query string and store a copy of the result in the global object
	global.QS = global.QueryStringParser.parse();
	
	// Browser detector
	global.BrowserDetector = browserDetector();
	
	// User Agent short-hands
	$.iphone = global.BrowserDetector.isIphone();
	
	$.ipad = global.BrowserDetector.isIpad();
	
	$.ios = global.BrowserDetector.isIos();
	
	$.mobile = global.BrowserDetector.isMobile();
	
	$.android = global.BrowserDetector.isAndroid();
	
	$.phone = global.BrowserDetector.isPhone();
	
	$.tablette = global.BrowserDetector.isTablette();
	
	$.touchClick = $.ios || $.android;
	
	$.click = $.touchClick ? 'touch-click' : 'click';
	
})(jQuery, window);

/**
 * General customization for mobile and default easing
 */
(function ($, global, undefined) {
	'use strict';
	
	// add mobile css class to html
	$.each(['iphone', 'ipad', 'ios', 'mobile', 'android', 'phone', 'touchClick'], function (i, c) {
		if (!!$[c]) {
			$('html').addClass(c);
		}
	});
	
	// easing support
	$.easing.def = ($.mobile ? 'linear' : 'easeOutQuad');
	
	// touch support
	if ($.touchClick) {
		var didMove = false;
		var preventNextClick = false;
		var lastTouch = {x: 0, y: 0};
		
		var preventNextClickExternal = function (target, e) {
			var ret = true;
			if ($.isFunction(global.preventNextClick)) {
				ret = global.preventNextClick.call(target, e);
			}
			return ret;
		};
		
		var getMinMoveValue = function () {
			var value = 0;
			if ($.isNumeric(global.deviceMinMoveValue)) {
				value = parseInt(global.deviceMinMoveValue, 10);
			} else if ($.isFunction(global.deviceMinMoveValue)) {
				value = parseInt(global.deviceMinMoveValue());
			}
			return value || 10; // default value
		};
		
		var minMove = getMinMoveValue() * (window.devicePixelRatio || 1);
		
		$(document).on('touchstart', function (e) {
			didMove = false;
			var touch = e.originalEvent.touches[0];
			lastTouch.x = touch.screenX;
			lastTouch.y = touch.screenY;
			App.log('touchstart', lastTouch);
		}).on('touchmove', function (e) {
			var touch = e.originalEvent.changedTouches[0];
			// only count move when one finger is used
			didMove = e.originalEvent.changedTouches.length === 1 &&
				// and if the gesture was more than accidental
				(Math.abs(lastTouch.x - touch.screenX) > minMove ||
				Math.abs(lastTouch.y - touch.screenY) > minMove);
				
			App.log('touchmove', lastTouch, didMove, touch.screenX, touch.screenY);
		}).on('touchend', function (e) {
			App.log('touchend', lastTouch, didMove);
			
			var t = $(e.target);
			// do not count inputs
			var ignoreInputs = 'input, select, textarea';
			// special ignore class
			var ignoreClass = '.ignore-mobile-click, .ignore-mobile-click *';
			// store de result
			var mustBeIgnored = t.is(ignoreInputs) || t.is(ignoreClass);
			
			// prevent click only if not ignored
			preventNextClick = $.ios && !mustBeIgnored;
			
			if (!didMove && !mustBeIgnored) {
				
				// create a new click event
				var clickEvent = $.Event($.click);
				
				// raise it
				$(e.target).trigger(clickEvent);
				
				// let others prevent defaults...
				if (clickEvent.isDefaultPrevented()) {
					// and do the same
					global.pd(e, clickEvent.isPropagationStopped());
				}
				// or stop propagation
				else if (clickEvent.isPropagationStopped()) {
					e.stopPropagation();
				}
				
				if (e.isDefaultPrevented()) {
					App.log('touchend prevented');
					return false;
				}
			}
		}).on('click', 'a', function (e) {
			App.log('real click');
			
			var isNextClickPrevented = preventNextClick && preventNextClickExternal(this, e);
			preventNextClick = false;
			
			if (isNextClickPrevented) {
				App.log('click prevented');
				global.pd(e);
				return false;
			}
		});
	}
	
	
/**
 * Patching console object.
 */
	
	// see: https://developers.google.com/chrome-developer-tools/docs/console-api
	/*
	 * Snippet
	var c=[];
	$('ol.toc li').each(function () {
		var r = /console\.([a-z]+)/.exec($(this).text());r && c.push(r[1])
	});
	console.log(c);
	 */
	
	var consoleFx = ['assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error', 'group', 
		'group', 'group', 'info', 'log', 'profile', 'profile', 'time', 'time', 'time', 
		'trace', 'warn'];
	
	// console support
	if (!global.console) {
		global.console = {};
	}
	
	$.each(consoleFx, function (i, key) {
		global.console[key] = global.console[key] || $.noop;
	});
	

/**
 * Global tools
 */
	
	var hex = function (x) {
		return ('0' + parseInt(x, 10).toString(16)).slice(-2);
	};
		
	global.rgb2hex = function (rgb) {
		var hexa = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
		if (!hexa) {
			return rgb;
		}
		return hex(hexa[1]) + hex(hexa[2]) + hex(hexa[3]);
	};
	
	// prevent default macro
	global.pd = function (e, stopPropagation) {
		if (!!e) {
			if ($.isFunction(e.preventDefault)) {
				e.preventDefault();
			}
			if (stopPropagation !== false && $.isFunction(e.stopPropagation)) {
				e.stopPropagation();
			}
		}
		return false;
	};
	
})(jQuery, window);
