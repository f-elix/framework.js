/**
 * @author Deux Huit Huit
 * 
 * Superlight App Framework
 */
(function ($, global, undefined) {
	
	'use strict';
	
	//Default value
	var ROOT = 'body';
	
	/** Mediator **/
	var mediatorIsLoadingPage = false;
	var currentRouteUrl = document.location.href.substring(
		document.location.protocol.length + 2 + document.location.host.length
	);
	
	//Store ref to the current page object
	var currentPage = null;
	
	//Store ref to the previous page object
	var previousPage = null;
	var previousUrl = '';
	
	var _callAction = function (actions, key, data) {
		if (!!actions) {
			var tempFx = actions[key];
			
			if (!$.isFunction(tempFx) && !!~key.indexOf('.')) {
				tempFx = actions;
				// try JSONPath style...
				var paths = key.split('.');
				$.each(paths, function _eachPath() {
					tempFx = tempFx[this];
					if (!$.isPlainObject(tempFx)) {
						return false; // exit
					}
					return true;
				});
			}
			
			return App.callback(tempFx, [key, data]);
			
		} /*else {
			App.log({args: '`actions` is null.', fx: 'error'});
		}*/
	};
	
	var notifyPage = function (key, data, cb) {
		if (!!currentPage) {
			if ($.isFunction(data) && !cb) {
				cb = data;
				data = undefined;
			}
			var res = App._callAction(currentPage.actions(), key, data);
			if (res !== undefined) {
				App.callback(cb, [currentPage.key(), res]);
			}
		}
		return this;
	};
	
	// Validation
	var _validateMediatorState = function () {
		if (mediatorIsLoadingPage) {
			App.log({args: 'Mediator is busy waiting for a page load.', fx: 'error'});
		}
		
		return !mediatorIsLoadingPage;
	};
	
	var _validateNextPage = function (nextPage) {
		var result = true;
			
		if (!nextPage) {
			result = false;
		}
		
		return result;
	};
	
	var _canEnterNextPage = function (nextPage) {
		var result = true;
		
		if (!nextPage.canEnter()) {
			App.log('Cannot enter page %s.', nextPage.key());
			result = false;
		} 
		
		return result;
	};
	
	var _canLeaveCurrentPage = function () {
		var result = false;
		
		if (!currentPage) {
			App.log({args: 'No current page set.', fx: 'error'});
		} else if (!currentPage.canLeave()) {
			App.log('Cannot leave page %s.', currentPage.key());
		} else {
			result = true;
		}
		
		return result;
	};
	
	//Actions
	
	/**
	* Notify all registered component and page
	*
	* @see AER in http://addyosmani.com/largescalejavascript/
	* @see pub/sub http://freshbrewedcode.com/jimcowart/tag/pubsub/
	*/
	var notifyAll = function (key, data, cb) {
		
		// propagate action to current page only
		notifyPage(key, data, cb);
		
		// propagate action to all modules
		App.modules.notify(key, data, cb);
		
		return this;
	};
	
	/** 
	* Change the current page to the requested route
	* Do nothing if the current page is already the requested route
	*/
	var gotoPage = function (obj, previousPoppedUrl) {
		var nextPage;
		var route = '';
		
		var enterLeave = function () {
			//Keep currentPage pointer for the callback in a new variable 
			//The currentPage pointer will be cleared after the next call
			var leavingPage = currentPage;
			
			var _leaveCurrent = function () {
				currentPage = null;  // clean currentPage pointer,this will block all interactions
				
				//set leaving page to be previous one
				previousPage = leavingPage;
				previousUrl = !!previousPoppedUrl ? previousPoppedUrl : 
					document.location.href.substring(
						document.location.protocol.length + 2 + document.location.host.length
					);
				//clear leavingPage
				leavingPage = null;
				
				//notify all module
				App.modules.notify('page.leave', {page: previousPage});
			};
			
			var _enterNext = function () {
				// set the new Page as the current one
				currentPage = nextPage;
				// notify all module
				App.modules.notify('page.enter', {page: nextPage, route: route});
				// Put down the flag since we are finished
				mediatorIsLoadingPage = false;
			};
			
			var pageTransitionData = {
				currentPage: currentPage,
				nextPage: nextPage,
				leaveCurrent: _leaveCurrent,
				enterNext: _enterNext,
				route: route,
				isHandled: false
			};
			
			//Try to find a module to handle page transition
			App.modules.notify('pages.requestPageTransition', pageTransitionData);
			
			if (!nextPage.isInited) {
				nextPage.init();
				nextPage.isInited = true;
			}
			
			//if not, return to classic code
			if (!pageTransitionData.isHandled) {
				//Leave to page the transition job
				
				//notify all module
				App.modules.notify('page.leaving', {page: leavingPage});
				
				//Leave the current page
				leavingPage.leave(_leaveCurrent);
				
				App.modules.notify('page.entering', {page: nextPage, route: route});
				
				nextPage.enter(_enterNext);
			}
		};
		
		var loadSucess = function (data, textStatus, jqXHR) {
			var htmldata = $(data);
			
			// get the node
			var node = htmldata.find(nextPage.key());
			
			// get the root node
			var elem = $(ROOT);
			
			// Check for redirects
			var responseUrl = htmldata.find(ROOT + ' > [data-url]').attr('data-url');
			
			if (!!responseUrl && responseUrl != obj) {
				
				var redirectedPage = nextPage;
				
				// Find the right page
				nextPage = App.pages.getPageForRoute(responseUrl);
				
				// Offer a bail out door
				App.modules.notify('pages.redirected', {
					currentPage: currentPage,
					nextPage: nextPage,
					redirectedPage: redirectedPage,
					requestedRoute: route,
					responseRoute: responseUrl
				});
				
				// Cancel current transition
				App.modules.notify('pages.requestCancelPageTransition', {
					currentPage: currentPage,
					nextPage: nextPage,
					route: route
				});
				
				if (!_validateNextPage(nextPage)) {
					App.modules.notify('pages.routeNotFound', {
						page: currentPage,
						url: obj,
						isRedirect: true
					});
					App.log({args: ['Redirected route "%s" was not found.', obj], fx: 'error'});
					return;
				} else {
					node = htmldata.find(nextPage.key());
					if (nextPage === currentPage) {
						App.modules.notify('pages.navigateToCurrent', {
							page: nextPage,
							route: route,
							isRedirect: true
						});
						App.log('redirected next page is the current one');
					} else {
						// Start new transition
						App.modules.notify('pages.requestBeginPageTransition', {
							currentPage: currentPage,
							nextPage: nextPage,
							route: responseUrl,
							isRedirect: true
						});
						
					}
				}
			}
			
			if (!node.length) {
				
				App.log({args: ['Could not find "%s" in xhr data.', nextPage.key()], fx: 'error'});
				
				// free the mediator
				mediatorIsLoadingPage = false;
				
				// notify
				App.modules.notify('pages.notfound', {
					data: data,
					url: obj,
					xhr: jqXHR,
					status: textStatus
				});
				
			} else {
				
				// append it to the doc, hidden
				elem.append(node.css({opacity: 0}));
				
				// init page
				nextPage.init();
				nextPage.isInited = true;
				
				node.hide();
				
				App.modules.notify('pages.loaded', {
					elem: elem,
					data: data,
					url: obj,
					page: nextPage,
					node: node,
					xhr: jqXHR,
					status: textStatus
				});
				
				// actual goto
				enterLeave();
			}
		};
		
		var progress = function (e) {
			var total = e.originalEvent.total;
			var loaded = e.originalEvent.loaded;
			var percent = total > 0 ? loaded / total : 0;

			App.mediator.notify('pages.loadprogress', {
				event: e,
				url: obj,
				total: total,
				loaded: loaded,
				percent: percent
			});
		};
		
		if (_validateMediatorState() && _canLeaveCurrentPage()) {
			if ($.type(obj) === 'string') {
				nextPage = App.pages.getPageForRoute(obj);
				route = obj;
			} else {
				nextPage = obj;
			}
			
			if (!_validateNextPage(nextPage)) {
				App.modules.notify('pages.routeNotFound', {
					page: currentPage, 
					url: obj
				});
				App.log({args: ['Route "%s" was not found.', obj], fx: 'error'});
			} else {
				if (_canEnterNextPage(nextPage)) {
					if (nextPage === currentPage) {
						App.modules.notify('pages.navigateToCurrent', {
							page: nextPage,
							route: route
						});
						App.log('next page is the current one');
						
					} else {
						
						App.modules.notify('pages.loading', {
							page: nextPage
						});
						
						App.modules.notify('pages.requestBeginPageTransition', {
							currentPage: currentPage,
							nextPage: nextPage,
							route: route
						});
						
						// Load from xhr or use cache copy
						if (!nextPage.loaded()) {
							// Raise the flag to mark we are in the process
							// of loading a new page
							mediatorIsLoadingPage = true;
							
							Loader.load({
								url: obj, // the *actual* route
								priority: 0, // now
								vip: true, // don't queue on fail
								success: loadSucess,
								progress: progress,
								error: function (e) {
									App.modules.notify('pages.loaderror', {
										event: e,
										url: obj
									});
								},
								giveup: function (e) {
									// Free the mediator
									mediatorIsLoadingPage = false;
									// Reset the current page
									
									App.log({args: 'Giving up!', me: 'Loader'});
									
									App.modules.notify('pages.loadfatalerror', {
										event: e,
										url: obj
									});
								}
							});
						} else {
							enterLeave();
							
							App.modules.notify('pages.loaded', {
								elem: $(ROOT),
								url: obj,
								page: nextPage,
							});
						}
					}
				} else {
					App.log({args: ['Route "%s" is invalid.', obj], fx: 'error'});
				}
			}
		}
		return this;
	};
	
	var togglePage = function (route, fallback) {
		if (!!currentPage && _validateMediatorState()) {
			var 
			nextPage = App.pages.getPageForRoute(route);
			
			if (_validateNextPage(nextPage) && _canEnterNextPage(nextPage)) {
				if (nextPage !== currentPage) {
					gotoPage(route);
				} else if (!!previousUrl) {
					gotoPage(previousUrl);
				} else if (!!fallback) {
					gotoPage(fallback);
				} else {
					App.modules.notify('page.toggleNoPreviousUrl', { currentPage: nextPage });
				}
			}
		}
		return this;
	};
	
	/** 
	* Init All the applications
	* Assign root variable
	* Call init on all registered page and modules
	*/
	var initApplication = function (root) {
		
		// assure root node
		if (!!root && !!$(root).length) {
			ROOT = root;
		}
		
		// init each Modules
		$.each(App.modules.models(), function _initModule() {
			this.init();
		});
		
		// init each Page already loaded
		$.each(App.pages.instances(), function _initPage() {
			if (!!this.loaded()) {
				// init page
				this.init({firstTime: true});
				this.isInited = true;
				
				// find if this is our current page
				// current route found ?
				if (!!~App.pages._matchRoute(currentRouteUrl, this.routes())) {
					// initialise page variable
					currentPage = this;
					previousPage = this; // Set the same for the first time
					App.modules.notify('page.entering', {
						page: currentPage,
						route: currentRouteUrl
					});
					// enter the page right now
					currentPage.enter(function _currentPageEnterCallback() {
						App.modules.notify('page.enter', {
							page: currentPage,
							route: currentRouteUrl
						});
					});
				}
			}
		});
		
		notifyAll('app.init', {
			page: currentPage
		});
	};
	
	/** App **/
	var run = function (root) {
		initApplication(root);
		return App;
	};
	
	/** Public Interfaces **/
	global.App = $.extend(global.App, {
		// private
		_callAction: _callAction,
		
		// root node for the pages
		root: function () {
			return ROOT;
		},
		
		// main entrance
		run: run,
		
		// mediator object
		mediator: {
			// private
			_currentPage: function (page) {
				if (!!page) {
					currentPage = page;
				}
				return currentPage;
			},
			
			getCurrentPage: function () {
				return currentPage;
			},
			
			// event dispatcher to the
			// current Page and Modules
			notify: notifyAll,
			
			// event dispatcher to the
			// current Page only
			notifyCurrentPage: notifyPage,
			
			// leave the current Page and
			// enter a new one, specified by the url
			goto: gotoPage,
			
			// toggle the requested page (may be enter or leave the requested page)
			//if leaving (already current page) then the previous page is using for the goto
			toggle: togglePage
		}
	});
	
})(jQuery, window);
