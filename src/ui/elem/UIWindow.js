/**
 * Copyright (C) 2010 Sergey I. Sharybin
 */

function _UIWindow ()
{
  _UIContainer.call (this);

  /**
   * Build all widgets
   */
  this.buildWidgets = function ()
    {
      this.clientArea.removeAllNodes ();

      for (var i = 0, n = this.container.length; i < n; ++i)
        {
          var dom = uiUtil.getItemDOM (this.container[i]);
          this.clientArea.appendChild (dom);
        }
    };

  /**
   * Create new button in title bar
   *
   * @param title - button's title
   * @param pos - position (left or right)
   * @param handler - click handler
   */
  this.buildTitleButton = function (image, title, pos, className, handler)
    {
      var button = createElement ('DIV');
      pos = '' + defVal (pos, 'left');
      image = '' + defVal (image, '');

      if (pos.toLowerCase() == 'left')
        {
          pos = 'Left';
        }
      else
        {
          pos = 'Right';
        }

      button.className = 'UIWindowTitleButton UIWindowTitleButton' + pos;
      if (className)
        {
          $(button).addClass (className);
        }

      if (image == '')
        {
          button.appendChild (createTextNode (title));
        }

      if (handler)
        {
          /* Need this to prevent dnd stuff starting working on button's click */
          var stopCb = function (event) {stopEvent (event); };
          $(button).mousedown (stopCb);
          $(button).dblclick  (stopCb);

          $(button).click (function (handler) {return function () {
                  window.setTimeout (handler, 10);
                };
              } (handler));
        }

      if (image)
        {
          /*
           * TODO: Fix this to add support of full url
           */
          var src = 'pics/ui/elem/' + image + '.gif';

          var img = createElement ('IMG');
          img.src = src;
          img.title = title;

          button.appendChild (img);
        }

      this.titleButtons.appendChild (button);
    };

  /**
   * Build default buttons in title bar
   */
  this.buildDefaultButtons = function ()
    {
      if (this.menu.length ())
        {
          this.buildTitleButton ('window-menu', 'menu', 'left', 'UIWindowMenuButton',
              wrapMeth (this, 'onMenuClick'));
        }

      this.buildTitleButton ('window-close', 'close', 'right', 'UIWindowCloseButton',
          wrapMeth (this, 'onCloseClick'));
      this.buildTitleButton ('window-maximize', 'maximize', 'right', 'UIWindowMaximizeButton',
          wrapMeth (this, 'onToggleMaximizeClick'));
    }

  /**
   * Build DOM tree
   */
  this.doBuild = function ()
    {
      var result = createElement ('DIV');

      result.className = 'UIWindow';

      /* Title */

      /* Background and shadow */
      var titleBg = createElement ('DIV');
      var span = createElement ('SPAN');
      titleBg.className = 'UIWindowTitleBg';
      span.appendChild (createTextNode (this.title));
      titleBg.appendChild (span);
      result.appendChild (titleBg);

      /* Title */
      var title = createElement ('DIV');
      title.className = 'UIWindowTitle';
      title.appendChild (createTextNode (this.title));
      result.appendChild (title);

      $(title).disableTextSelect ();
      $(titleBg).disableTextSelect ();

      /* Title buttons */
      var buttons = createElement ('DIV');
      buttons.className = 'UIWindowTitleButtons';
      title.appendChild (buttons);

      if (this.resizable)
        {
          var sizer = createElement ('DIV');
          sizer.className = 'UIWindowSizer';
          result.appendChild (sizer);

          UI_MakeResizable (result, {'resizeArea': sizer});

          result.resizeBy = function (self, origHandler) {return function (delta) {
                origHandler.call (result, delta);
                self.onResize (delta);
              }
            } (this, result.resizeBy);
        }

      /* Client area */
      var clientArea = createElement ('DIV');
      clientArea.className = 'UIWindowClient';
      result.appendChild (clientArea);

      /* Set window position */
      result.style.top  = this.top + 'px';
      result.style.left = this.left + 'px';

      /* Set window dimensions */
      result.style.width  = this.width + 'px';
      result.style.height = this.height + 'px';

      UI_MakeMovable (result, {'moveArea': title});

      result.moveBy = function (self, origHandler) {return function (delta) {
            if (self.isMaximized)
              {
                return;
              }

            origHandler.call (result, delta);
          }
        } (this, result.moveBy);

      $(title).dblclick(wrapMeth (this, 'onToggleMaximizeClick'));

      /* Store DOM elements */
      this.titleBg    = titleBg;
      this.titleFg    = title;
      this.sizer      = sizer;
      this.clientArea = clientArea;
      this.titleButtons = buttons;

      this.buildDefaultButtons ();

      uiManager.registerContext (result);
      $(result).click (function (self) { return function () { self.setFocus (); } } (this));

      /* Build widgets */
      this.buildWidgets ();

      return result;
    };

  /**
   * Set focus to window
   */
  this.setFocus = function ()
    {
      uiWindowManager.focusWindow (this);
    };

  /**
   * Raise window
   */
  this.raise = function ()
    {
      uiWindowManager.raiseWindow (this);
      this.onRaise ();
    };

  /**
   * Show window
   *
   * @param viewPort - viewport where window will be shown
   */
  this.show = function (viewPort)
    {
      uiWindowManager.showWindow (this, viewPort);
    };

  /**
   * Hide window
   */
  this.hide = function ()
    {
      uiWindowManager.hideWindow (this);
    };

  /**
   * Close window
   */
  this.close = function ()
    {
      uiWindowManager.closeWindow (this);
    };

  /**
   * Maxinize window
   */
  this.maximize = function ()
    {
      uiWindowManager.maximizeWindow (this);
    };

  /**
   * Restore window size
   */
  this.restore = function ()
    {
      uiWindowManager.restoreWindow (this);
    };

  /* Getters/setters */

  /**
   * Get client area
   */
  this.getClientArea =  function ()
    {
      return this.clientArea;
    };

  /**
   * Get window menu
   */
  this.getMenu = function ()
    {
      return this.menu;
    };

  /**
   * Get window title
   */
  this.getTitle = function ()
    {
      return this.title;
    };

  /* Handlers */

  /**
   * Handler of close title button
   */
  this.onCloseClick = function ()
    {
      this.close ();
    };

  /**
   * Handler of maximize title button
   */
  this.onToggleMaximizeClick = function ()
    {
      if (this.isMaximized)
        {
          this.restore ();
        }
      else
        {
          this.maximize ();
        }
    };

  /**
   * Handler of menu button click
   */
  this.onMenuClick = function ()
    {
      var point = {'x': 0, 'y': 0};
      var offset = this.dom.offset ();

      point['x'] = offset['left'];
      point['y'] = offset['top'] + $(this.titleBg).height ();

      uiPopupManager.popup (this.menu, point);
    };

  /* Event stubs */
  this.onShow   = function () {};
  this.onRaise  = function () {};
  this.onHide   = function () {};
  this.onClose  = function () {};
  this.onClosed = function () {};
  this.onResize = function (delta) {};
  this.onMaximized = function () {};
  this.onRestored  = function () {};
}

/****
 * Constructor
 */
function UIWindow (opts)
{
  opts = opts || {};
  UIContainer.call (this, opts);

  this.title = opts['title'] || '';

  /* Window position */
  this.top = opts['top'] || 0;
  this.left = opts['left'] || 0;

  /* Width of window */
  this.width = opts['width'] || 320;

  /* Height of window */
  this.height = opts['height'] || 240;

  this.resizable = true;
  if (!isUnknown (opts['resizable']))
    {
      this.resizable = isTruth (opts['resizable']);
    }

  this.menu       = new UIMenu ();  /* Window menu */

  this.titleBg    = null;  /* Title background */
  this.titleFg    = null;  /* Title */
  this.sizer      = null;  /* Resizer element */
  this.clientArea = null;  /* Client area */

  uiManager.addHandler (['mousedownCancel', 'clickCancel'], function (self) {
    return function (userData) {
      if (userData['context'] == self.dom)
        {
          self.setFocus ();
        }
    };
  } (this));

  /* Internal use */
  this.abortClose   = false;
  this.isMaximized  = false;
  this.animateSpeed = 100;
}

UIWindow.prototype = new _UIWindow;
UIWindow.prototype.constructor = UIWindow;
