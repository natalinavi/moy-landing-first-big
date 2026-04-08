/**
 * telegram-web-app.js — mock-заглушка для тестирования в браузере.
 *
 * В реальном Telegram Mini App этот файл не нужен —
 * Telegram подключает настоящий SDK автоматически.
 *
 * Заглушка имитирует window.Telegram.WebApp без ошибок,
 * чтобы приложение работало в обычном браузере.
 */
(function () {
  if (window.Telegram && window.Telegram.WebApp) return; // уже загружен настоящий SDK

  var noop = function () {};

  var themeParams = {
    bg_color:           '#ffffff',
    text_color:         '#000000',
    hint_color:         '#8e8e93',
    link_color:         '#2AABEE',
    button_color:       '#2AABEE',
    button_text_color:  '#ffffff',
    secondary_bg_color: '#f2f2f7',
  };

  var WebApp = {
    platform:       'unknown',
    version:        '6.0',
    colorScheme:    'light',
    themeParams:    themeParams,
    isExpanded:     false,
    viewportHeight: window.innerHeight,
    initData:       '',
    initDataUnsafe: { user: null, start_param: '' },

    ready:   noop,
    expand:  noop,
    close:   noop,

    onEvent:  noop,
    offEvent: noop,

    sendData: noop,

    openLink:         function (url) { window.open(url, '_blank'); },
    openTelegramLink: function (url) { window.open(url, '_blank'); },

    MainButton: {
      text:        '',
      color:       '#2AABEE',
      textColor:   '#ffffff',
      isVisible:   false,
      isActive:    true,
      isProgressVisible: false,
      setText:        function (t) { this.text = t; },
      show:           noop,
      hide:           noop,
      enable:         noop,
      disable:        noop,
      showProgress:   noop,
      hideProgress:   noop,
      onClick:        noop,
      offClick:       noop,
    },

    BackButton: {
      isVisible: false,
      show:     noop,
      hide:     noop,
      onClick:  noop,
      offClick: noop,
    },

    HapticFeedback: {
      impactOccurred:       noop,
      notificationOccurred: noop,
      selectionChanged:     noop,
    },

    CloudStorage: {
      setItem:     noop,
      getItem:     function (key, cb) { if (cb) cb(null, null); },
      getItems:    function (keys, cb) { if (cb) cb(null, {}); },
      removeItem:  noop,
      removeItems: noop,
      getKeys:     function (cb) { if (cb) cb(null, []); },
    },
  };

  window.Telegram = { WebApp: WebApp };
})();
