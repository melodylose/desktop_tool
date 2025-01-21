'use strict';

const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

// 創建一個基本的 JSDOM 實例
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
});

// 設置全局變量
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;

// Mock Event
// class Event {
//     constructor(type, options = {}) {
//         this.type = type;
//         this.bubbles = options.bubbles || false;
//         this.cancelable = options.cancelable || false;
//         this.composed = options.composed || false;
//         this.defaultPrevented = false;
//         this.currentTarget = null;
//         this.target = null;
//         this.timeStamp = Date.now();
//         this.isTrusted = true;
//         this._propagationStopped = false;
//         this._immediatePropagationStopped = false;
//         this.view = options.view || window;
//     }

//     preventDefault() {
//         if (this.cancelable) {
//             this.defaultPrevented = true;
//         }
//     }

//     stopPropagation() {
//         this._propagationStopped = true;
//     }

//     stopImmediatePropagation() {
//         this._immediatePropagationStopped = true;
//         this._propagationStopped = true;
//     }

//     composedPath() {
//         return [];
//     }
// }

// Mock MouseEvent
// class MouseEvent extends Event {
//     constructor(type, options = {}) {
//         super(type, options);
//         this.screenX = options.screenX || 0;
//         this.screenY = options.screenY || 0;
//         this.clientX = options.clientX || 0;
//         this.clientY = options.clientY || 0;
//         this.ctrlKey = options.ctrlKey || false;
//         this.altKey = options.altKey || false;
//         this.shiftKey = options.shiftKey || false;
//         this.metaKey = options.metaKey || false;
//         this.button = options.button || 0;
//         this.buttons = options.buttons || 0;
//         this.relatedTarget = options.relatedTarget || null;
//         this.target = options.target || null;
//     }

//     getModifierState(keyArg) {
//         return false;
//     }
// }

// 使用我們自己的 Event 和 MouseEvent 實現
// global.Event = Event;
// global.MouseEvent = MouseEvent;

// 模擬 navigator
global.navigator = {
    ...dom.window.navigator,
    clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
        readText: jest.fn().mockImplementation(() => Promise.resolve(''))
    }
};

// 模擬 localStorage
global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};

// 模擬 electron 的 ipcRenderer
global.ipcRenderer = {
    on: jest.fn(),
    send: jest.fn(),
    removeListener: jest.fn()
};

// 在每個測試前設置 DOM 環境
beforeEach(() => {
    // No-op
});

// 清理函數
afterEach(() => {
    // 清理所有的 mock
    jest.clearAllMocks();
    // 清理 document body
    document.body.innerHTML = '';
});

// 擴展 HTMLElement 原型
const originalCloneNode = dom.window.HTMLElement.prototype.cloneNode;
const originalReplaceChild = dom.window.Node.prototype.replaceChild;

Object.defineProperties(dom.window.HTMLElement.prototype, {
    offsetWidth: {
        get() { return parseFloat(this.style.width) || 0; }
    },
    offsetHeight: {
        get() { return parseFloat(this.style.height) || 0; }
    },
    offsetLeft: {
        get() { return parseFloat(this.style.left) || 0; }
    },
    offsetTop: {
        get() { return parseFloat(this.style.top) || 0; }
    },
    getBoundingClientRect: {
        value() {
            return {
                top: parseFloat(this.style.top) || 0,
                right: (parseFloat(this.style.left) || 0) + (parseFloat(this.style.width) || 0),
                bottom: (parseFloat(this.style.top) || 0) + (parseFloat(this.style.height) || 0),
                left: parseFloat(this.style.left) || 0,
                width: parseFloat(this.style.width) || 0,
                height: parseFloat(this.style.height) || 0,
                x: parseFloat(this.style.left) || 0,
                y: parseFloat(this.style.top) || 0
            };
        }
    },
    replaceWith: {
        value(newNode) {
            if (this.parentNode) {
                this.parentNode.replaceChild(newNode, this);
            }
            return this;
        }
    },
    cloneNode: {
        value(deep = false) {
            return originalCloneNode.call(this, deep);
        }
    }
});

// 模擬 DOM 方法
document.createElement = (function(create) {
    return function(tagName) {
        const element = create.call(document, tagName);

        // 為 element 添加必要的屬性和方法
        if (!element.style) {
            element.style = {};
        }

        if (!element.querySelector) {
            element.querySelector = jest.fn();
        }

        if (!element.querySelectorAll) {
            element.querySelectorAll = jest.fn().mockReturnValue([]);
        }

        if (!element.addEventListener) {
            element.addEventListener = jest.fn();
        }

        if (!element.removeEventListener) {
            element.removeEventListener = jest.fn();
        }

        if (!element.dispatchEvent) {
            element.dispatchEvent = jest.fn();
        }

        if (!element.classList) {
            element.classList = {
                add: jest.fn(),
                remove: jest.fn(),
                contains: jest.fn()
            };
        }

        // 確保所有必要的 style 屬性都存在
        if (element.style) {
            element.style.display = '';
            element.style.left = '';
            element.style.top = '';
            element.style.position = '';
        }

        // 確保基本的 DOM 屬性都存在
        if (!element.setAttribute) {
            element.setAttribute = jest.fn();
        }

        if (!element.getAttribute) {
            element.getAttribute = jest.fn();
        }

        if (!element.removeAttribute) {
            element.removeAttribute = jest.fn();
        }

        if (!element.getBoundingClientRect) {
            element.getBoundingClientRect = jest.fn().mockReturnValue({
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                width: 0,
                height: 0
            });
        }

        return element;
    };
})(document.createElement);
