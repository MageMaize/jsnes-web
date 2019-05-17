import { Controller } from "jsnes";

// Mapping keyboard code to [controller, button]
/*
// 原版键位
var KEYS = {
  88: [1, Controller.BUTTON_A], // X
  89: [1, Controller.BUTTON_B], // Y (Central European keyboard)
  90: [1, Controller.BUTTON_B], // Z
  17: [1, Controller.BUTTON_SELECT], // Right Ctrl
  13: [1, Controller.BUTTON_START], // Enter
  38: [1, Controller.BUTTON_UP], // Up
  40: [1, Controller.BUTTON_DOWN], // Down
  37: [1, Controller.BUTTON_LEFT], // Left
  39: [1, Controller.BUTTON_RIGHT], // Right
  103: [2, Controller.BUTTON_A], // Num-7
  105: [2, Controller.BUTTON_B], // Num-9
  99: [2, Controller.BUTTON_SELECT], // Num-3
  97: [2, Controller.BUTTON_START], // Num-1
  104: [2, Controller.BUTTON_UP], // Num-8
  98: [2, Controller.BUTTON_DOWN], // Num-2
  100: [2, Controller.BUTTON_LEFT], // Num-4
  102: [2, Controller.BUTTON_RIGHT] // Num-6
};*/

var BURST_TIME = 50;  //连发按键间隔
var KEYS = {
  75: [1, Controller.BUTTON_A], // K
  74: [1, Controller.BUTTON_B], // J
  17: [1, Controller.BUTTON_SELECT], // Ctrl
  32: [1, Controller.BUTTON_START], // Space
  87: [1, Controller.BUTTON_UP], // Up W
  83: [1, Controller.BUTTON_DOWN], // Down S
  65: [1, Controller.BUTTON_LEFT], // Left A
  68: [1, Controller.BUTTON_RIGHT], // Right D
};

var BURST_KEYS = {
  85: [1, Controller.BUTTON_B], // U
  73: [1, Controller.BUTTON_A], // I
}

var BURST_CALLBACK_HANDLER = {};
var BURST_CALLBACK_RELEASED_HANDLER = {};
var PRESS_KEY_ARRAY = [];

export default class KeyboardController {
  constructor(options) {
    this.onButtonDown = options.onButtonDown;
    this.onButtonUp = options.onButtonUp;
    this.playPage = options.playPage;
  }

  handleKeyDown = e => {
    if(PRESS_KEY_ARRAY.indexOf(e.keyCode) >= 0) {
      return;
    }
    PRESS_KEY_ARRAY.push(e.keyCode);
    if(e.keyCode === 27) {
      // esc按键
      if(this.playPage != null) {
        this.playPage.sendMsgToTopWindow({type:"keypress",keycode:27});
      }
    }
    var key = KEYS[e.keyCode];
    if (key) {
      this.onButtonDown(key[0], key[1]);
      e.preventDefault();
      return;
    }
    var burst = BURST_KEYS[e.keyCode];
    if (burst) {
      this.handleBurst(this,e.keyCode,burst[0], burst[1]);
      BURST_CALLBACK_HANDLER[e.keyCode] = setInterval(this.handleBurst,BURST_TIME,this, e.keyCode, burst[0], burst[1]);
      e.preventDefault();
      return ;
    }
  };

  handleKeyUp = e => {
    let keyPos = PRESS_KEY_ARRAY.indexOf(e.keyCode);
    if(keyPos >= 0) {
      PRESS_KEY_ARRAY.splice(keyPos,1);
    }
    var key = KEYS[e.keyCode];
    if (key) {
      this.onButtonUp(key[0], key[1]);
      e.preventDefault();
      return ;
    }
    var burst = BURST_KEYS[e.keyCode];
    if (burst) {
      clearInterval(BURST_CALLBACK_HANDLER[e.keyCode])
      BURST_CALLBACK_HANDLER[e.keyCode] = null;
      e.preventDefault();
      return ;
    }
  };

  handleKeyPress = e => {
    e.preventDefault();
  };

  handleBurst = (caller,keyCode,player,key) => {
    caller.onButtonDown(player,key);
    BURST_CALLBACK_RELEASED_HANDLER[keyCode] = setTimeout(caller.handleBurstReleased, BURST_TIME/2, caller,keyCode,player,key);
  }

  handleBurstReleased = (caller,keyCode,player,key) => {
    caller.onButtonUp(player,key);
    clearTimeout(BURST_CALLBACK_RELEASED_HANDLER[keyCode]);
  }
}

window.getKey = function() {
  return KEYS;
}

window.setKey = function(keys) {
  KEYS = keys;
}