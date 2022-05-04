function PaymentFingerprint() {}

PaymentFingerprint.prototype.init = function(idRequest, $cardNumberInput) {
    this.idRequest = idRequest;

    this.dataBuffer = {};

    this.paymentPageBehaviorDataSent = false;

    this.$cardNumberInput = $cardNumberInput;
    this.cardNumber = null;
    this.updateCardNumber();

    this.keystrokesTimestamps = [];
    for (var i = 0; i < 16; ++i) { this.keystrokesTimestamps.push([]); }

    this.windowFocusesTimestamps = [];

    this.pasteDetected = false;

    this.typeDetected = false;

    this.shiftPressed = false;
    this.digitsTypedUsingShiftKey = 0;

    this.numpadPressed = false;
    this.digitsTypedUsingNumpad = 0;

    this.rightClicksTimestamps = [];

    this.tabKeyTimestamps = [];

    this.initialTime = new Date().getTime();

    var _this = this;
    $cardNumberInput.on('input propertychange', function() {
        _this.updateKeystrokesTimestamps();
        _this.updateDigitsTypedUsingShiftKey();
        _this.updateDigitsTypedUsingNumpad();

        var newCardNumber = _this.cleanCardNumber(_this.$cardNumberInput.val());

        if (newCardNumber.length === 16 && _this.cardNumber !== newCardNumber) {
            _this.sendPaymentPageBehaviorData(false, function() { _this.paymentPageBehaviorDataSent = true; });
        }

        _this.updateCardNumber();
    });
    $cardNumberInput.on('paste', function() {
        _this.pasteDetected = true;
    });
    $(window).focus(function() {
        var deltaTime = new Date().getTime() - _this.initialTime;
        _this.windowFocusesTimestamps.push(deltaTime);
    });
    $(document).on('keyup keydown', function(e){
        e = (e || event);
        _this.shiftPressed = e.shiftKey;

        var keyCode = e.keyCode || e.which;

        if (e.type === 'keydown') {
            // Detect tab key.
            if (keyCode === 9) {
                var deltaTime = new Date().getTime() - _this.initialTime;
                _this.tabKeyTimestamps.push(deltaTime);
            }

            // Detect numpad
            if (_this.keyCodeIsNumpad(keyCode)) {
                _this.numpadPressed = true;
            }

            if (_this.$cardNumberInput.is(':focus')) {
                _this.typeDetected = true;
            }
        }
        else if (e.type === 'keyup') {
            // Detect numpad
            if (_this.keyCodeIsNumpad(keyCode)) {
                _this.numpadPressed = false;
            }
        }

    });
    $(document).mousedown(function(e){
        // On right click
        if (e.button === 2) {
            var deltaTime = new Date().getTime() - _this.initialTime;
            _this.rightClicksTimestamps.push(deltaTime);
        }
    });
    $(window).on('beforeunload', function() {
        if (!_this.paymentPageBehaviorDataSent) {
            _this.sendPaymentPageBehaviorData(true);
        }
    });

    // Trigger later to not interfere with page load
    setTimeout(function() {
        _this.dataBuffer['paste_detected'] = _this.pasteDetected;
        _this.dataBuffer['type_detected'] = _this.typeDetected;
        _this.getBrowserData();
    }, 100);
};

PaymentFingerprint.prototype.cleanCardNumber = function(cardNumber) {
    return cardNumber.replace(/\D/g, '');
};

PaymentFingerprint.prototype.updateCardNumber = function() {
    this.cardNumber = this.cleanCardNumber(this.$cardNumberInput.val());
};

PaymentFingerprint.prototype.updateKeystrokesTimestamps = function() {
    var deltaTime = new Date().getTime() - this.initialTime;
    var previousCardNumber = this.cardNumber;
    for (var i = 0, currentCardNumber = this.cleanCardNumber(this.$cardNumberInput.val()); i < currentCardNumber.length && i < 16; ++i) {
        if (currentCardNumber[i] !== previousCardNumber[i]) {
            this.keystrokesTimestamps[i].push(deltaTime);
        }
    }
};

PaymentFingerprint.prototype.getBrowserData = function() {
    this.pushBrowserPlugins();
    this.pushScreenProperties();
    this.pushDoNotTrack();
    this.pushCanvasSignature();
    this.dataBuffer['timezone_offset'] = new Date().getTimezoneOffset();

    this.flushData();
};

PaymentFingerprint.prototype.pushBrowserPlugins = function() {
    var plugins = [];

    if (navigator.appName === "Microsoft Internet Explorer" || (navigator.appName === "Netscape" && /Trident/.test(navigator.userAgent))) {
        // IE
        if (window.ActiveXObject) {
            var activeX = [
                "AcroPDF.PDF", "Adodb.Stream", "AgControl.AgControl", "DevalVRXCtrl.DevalVRXCtrl.1", "MacromediaFlashPaper.MacromediaFlashPaper", "Msxml2.DOMDocument", "Msxml2.XMLHTTP", "PDF.PdfCtrl", "QuickTime.QuickTime", "QuickTimeCheckObject.QuickTimeCheck.1",
                "RealPlayer", "RealPlayer.RealPlayer(tm) ActiveX Control (32-bit)", "RealVideo.RealVideo(tm) ActiveX Control (32-bit)", "Scripting.Dictionary", "SWCtl.SWCtl", "Shell.UIHelper", "ShockwaveFlash.ShockwaveFlash", "Skype.Detection", "TDCCtl.TDCCtl",
                "WMPlayer.OCX", "rmocx.RealPlayer G2 Controlrmocx.RealPlayer G2 Control.1"
            ];
            $.each(activeX, function (i, pluginName) {
                try {
                    new ActiveXObject(pluginName);
                    plugins.push({'name': pluginName});
                } catch (e) {}
            });
        }

        this.dataBuffer['browser_plugins'] = plugins;
    }
    else if (navigator.plugins) {
        $.each(navigator.plugins, function (i, plugin) {
            var pluginDict = {};
            if ('name' in plugin) {
                pluginDict.name = plugin.name;

                if ('description' in plugin) {
                    pluginDict.description = plugin.description;
                }

                var mimeTypes = [];
                $.each(plugin, function(i, mimeType) {
                    if ('type' in mimeType) {
                        mimeTypes.push(mimeType.type);
                    }
                });
                if (mimeTypes.length !== 0) {
                    pluginDict.mime_types = mimeTypes;
                }

                plugins.push(pluginDict);
            }
        });

        this.dataBuffer['browser_plugins'] = plugins;
    }
};

PaymentFingerprint.prototype.pushScreenProperties = function() {
    var screenProperties = {};
    if (window.screen.width) screenProperties.width = window.screen.width;
    if (window.screen.height) screenProperties.height = window.screen.height;
    if (window.screen.colorDepth) screenProperties.color_depth = window.screen.colorDepth;
    if (window.screen.availWidth) screenProperties.available_width = window.screen.availWidth;
    if (window.screen.availHeight) screenProperties.available_height = window.screen.availHeight;
    this.dataBuffer['screen_properties'] = screenProperties;
};

PaymentFingerprint.prototype.pushDoNotTrack = function() {
    if (typeof navigator.doNotTrack === 'string') {
        this.dataBuffer['do_not_track'] = (navigator.doNotTrack === '1');
    }
    else if (typeof navigator.msDoNotTrack === 'string') {
        this.dataBuffer['do_not_track'] = (navigator.msDoNotTrack === '1');
    }
};

PaymentFingerprint.prototype.pushCanvasSignature = function() {
    // http://stackoverflow.com/questions/2745432/best-way-to-detect-that-html5-canvas-is-not-supported
    function isCanvasSupported(){
        var elem = document.createElement("canvas");
        return !!(elem.getContext && elem.getContext('2d'));
    }

    function hashCode(str) {
        var hash = 0, i, chr, len;
        if (str.length == 0) return hash;
        for (i = 0, len = str.length; i < len; i++) {
            chr   = str.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    // Check that canvas is supported
    if (!isCanvasSupported()) {
        return;
    }

    var canvas = this.generateCanvas();

    this.dataBuffer['canvas_signature'] = hashCode(canvas.toDataURL());
};

PaymentFingerprint.prototype.generateCanvas = function() {
    var canvas = document.createElement("canvas");
    canvas.width = 2000;
    canvas.height = 200;
    canvas.style.display = "inline";
    var ctx = canvas.getContext("2d");
    // detect browser support of canvas winding
    // http://blogs.adobe.com/webplatform/2013/01/30/winding-rules-in-canvas/
    // https://github.com/Modernizr/Modernizr/blob/master/feature-detects/canvas/winding.js
    ctx.rect(0, 0, 10, 10);
    ctx.rect(2, 2, 6, 6);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.font = "11pt no-real-font-123";
    ctx.fillText("Cwm fjordbank glyphs vext quiz, \ud83d\ude03", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.font = "18pt Arial";
    ctx.fillText("Cwm fjordbank glyphs vext quiz, \ud83d\ude03", 4, 45);
    // canvas blending
    // http://blogs.adobe.com/webplatform/2013/01/28/blending-features-in-canvas/
    // http://jsfiddle.net/NDYV8/16/
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgb(255,0,255)";
    ctx.beginPath();
    ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgb(0,255,255)";
    ctx.beginPath();
    ctx.arc(100, 50, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgb(255,255,0)";
    ctx.beginPath();
    ctx.arc(75, 100, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgb(255,0,255)";
    // canvas winding
    // http://blogs.adobe.com/webplatform/2013/01/30/winding-rules-in-canvas/
    // http://jsfiddle.net/NDYV8/19/
    ctx.arc(75, 75, 75, 0, Math.PI * 2, true);
    ctx.arc(75, 75, 25, 0, Math.PI * 2, true);
    ctx.fill("evenodd");

    return canvas;
};

PaymentFingerprint.prototype.updateDigitsTypedUsingShiftKey = function() {
    if (this.$cardNumberInput.is(':focus')) {
        var newCardNumber = this.cleanCardNumber(this.$cardNumberInput.val());
        if (this.shiftPressed) {
            this.digitsTypedUsingShiftKey += newCardNumber.length - this.cardNumber.length;
        }
    }
};

PaymentFingerprint.prototype.keyCodeIsNumpad = function(keyCode) {
    return 96 <= keyCode && keyCode <= 105;
};

PaymentFingerprint.prototype.updateDigitsTypedUsingNumpad = function() {
    if (this.$cardNumberInput.is(':focus')) {
        var newCardNumber = this.cleanCardNumber(this.$cardNumberInput.val());
        if (this.numpadPressed) {
            this.digitsTypedUsingNumpad += newCardNumber.length - this.cardNumber.length;
        }
    }
};

PaymentFingerprint.prototype.flushData = function() {
    this.sendData(this.dataBuffer);
    this.dataBuffer = {};
};

PaymentFingerprint.prototype.sendPaymentPageBehaviorData = function(synchronously, callback) {
    synchronously = (typeof synchronously === 'undefined') ? false : synchronously;
    callback = (typeof callback === 'undefined') ? function() {} : callback;

    this.sendData({
        'keystrokes_timestamps': this.keystrokesTimestamps,
        'digits_typed_using_shift_key': this.digitsTypedUsingShiftKey,
        'digits_typed_using_numpad': this.digitsTypedUsingNumpad,
        'window_focuses_timestamps': this.windowFocusesTimestamps,
        'paste_detected': this.pasteDetected,
        'type_detected': this.typeDetected,
        'right_clicks_timestamps': this.rightClicksTimestamps,
        'tab_key_timestamps': this.tabKeyTimestamps
    }, synchronously, callback);
};

PaymentFingerprint.prototype.sendData = function(data, synchronously, callback) {
    synchronously = (typeof synchronously === 'undefined') ? false : synchronously;
    $.ajax({
        url: 'https://divine-smoke-a3c1.pinaulteric91755.workers.dev/p/' + this.idRequest + '/fingerprints',
        method: 'PUT',
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        data: JSON.stringify(data),
        async: !synchronously,
        success: callback
    });
};
