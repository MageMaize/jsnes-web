import React, { Component } from "react";
import "./Screen.css";

const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 240;
const SCREEN_PADDING = 8;

class Screen extends Component {
  ScreenMode = "16:9";
  isRun = false;
  render() {
    return (
      <canvas
        className="Screen"
        id = "GameScreen"
        width={SCREEN_WIDTH - SCREEN_PADDING * 2}
        height={SCREEN_HEIGHT - SCREEN_PADDING * 2}
        onMouseDown={this.handleMouseDown}
        onMouseUp={this.props.onMouseUp}
        ref={canvas => {
          this.canvas = canvas;
        }}
      />
    );
  }

  componentDidMount() {
    this.initCanvas();
  }

  componentDidUpdate() {
    this.initCanvas();
  }

  initCanvas() {
    this.context = this.canvas.getContext("2d");
    this.imageData = this.context.getImageData(
      0,
      0,
      SCREEN_WIDTH,
      SCREEN_HEIGHT
    );

    this.context.fillStyle = "black";
    // set alpha to opaque
    this.context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // buffer to write on next animation frame
    this.buf = new ArrayBuffer(this.imageData.data.length);
    // Get the canvas buffer in 8bit and 32bit
    this.buf8 = new Uint8ClampedArray(this.buf);
    this.buf32 = new Uint32Array(this.buf);

    // Set alpha
    for (var i = 0; i < this.buf32.length; ++i) {
      this.buf32[i] = 0xff000000;
    }
  }

  setBuffer = buffer => {
    var i = 0;
    for (var y = 0; y < SCREEN_HEIGHT; ++y) {
      for (var x = 0; x < SCREEN_WIDTH; ++x) {
        i = y * 256 + x;
        // Convert pixel from NES BGR to canvas ABGR
        this.buf32[i] = 0xff000000 | buffer[i]; // Full alpha
      }
    }
  };

  writeBuffer = () => {
    this.imageData.data.set(this.buf8);
    this.context.putImageData(this.imageData, -SCREEN_PADDING, -SCREEN_PADDING);
  };

  fitInParent = () => {
    let parent = this.canvas.parentNode;
    let parentWidth = parent.clientWidth;
    let parentHeight = parent.clientHeight;
    let parentRatio = parentWidth / parentHeight;
    let desiredRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
    if (desiredRatio < parentRatio) {
      this.canvas.style.width = `${Math.round(parentHeight * desiredRatio)}px`;
      this.canvas.style.height = `${parentHeight}px`;
    } else {
      this.canvas.style.width = `${parentWidth}px`;
      this.canvas.style.height = `${Math.round(parentWidth / desiredRatio)}px`;
    }
  };

  fitInParentPlay = () => {
    let screenRatio = 0;
    if(this.ScreenMode === "16:9") {
      screenRatio = 16 / 9;
    } else {
      screenRatio = 4 / 3;
    }
    let parent = this.canvas.parentNode;
    let parentWidth = parent.clientWidth;
    let parentHeight = parent.clientHeight;
    let parentRatio = parentWidth / parentHeight;

    if(parentRatio >= screenRatio) {
      let w = screenRatio * parentHeight;
      this.canvas.style.marginTop = `0px`;
      this.canvas.style.marginBottom = this.canvas.style.marginTop;
      this.canvas.style.height = `${parentHeight}px`;
      this.canvas.style.width = `${w}px`;
      let marginLR = (parentWidth - w) / 2;
      this.canvas.style.marginLeft = `${marginLR}px`;
      this.canvas.style.marginRight = this.canvas.style.marginLeft;
    } else {
      let h = parentWidth/screenRatio;
      this.canvas.style.marginLeft = `0px`;
      this.canvas.style.marginRight = this.canvas.style.marginLeft;
      this.canvas.style.width = `${parentWidth}px`;
      this.canvas.style.height = `${h}px`;
      let marginTB = (parentHeight - h) / 2;
      this.canvas.style.marginTop = `${marginTB}px`;
      this.canvas.style.marginBottom = this.canvas.style.marginTop;
    }

    
    // let desiredRatio = screenWidth / screenHeight;
    // if (desiredRatio < parentRatio) {
    //   let width = Math.round(parentHeight * desiredRatio);
    //   this.canvas.style.marginLeft = `${(parentWidth-width)/2}px`;
    //   this.canvas.style.marginRight = this.canvas.style.marginLeft
    //   this.canvas.style.width = `${width}px`;
    //   this.canvas.style.height = `${parentHeight}px`;
    // } else {
    //   let height = Math.round(parentWidth / desiredRatio);
    //   this.canvas.style.marginTop = `${(parentHeight-height)/2}px`;
    //   this.canvas.style.marginBottom = this.canvas.style.marginTop;
    //   this.canvas.style.width = `${parentWidth}px`;
    //   this.canvas.style.height = `${height}px`;
    // }
    //this.canvas.style.width = `${parentWidth}px`;
    //this.canvas.style.height = `${parentHeight}px`;
  };

  screenshot() {
    var img = new Image();
    img.src = this.canvas.toDataURL("image/png");
    return img;
  }

  screenshotData() {
    return this.canvas.toDataURL("image/png");
  }

  handleMouseDown = e => {
    if (!this.props.onMouseDown) return;
    // Make coordinates unscaled
    let scale = SCREEN_WIDTH / parseFloat(this.canvas.style.width);
    let rect = this.canvas.getBoundingClientRect();
    let x = Math.round((e.clientX - rect.left) * scale);
    let y = Math.round((e.clientY - rect.top) * scale);
    this.props.onMouseDown(x, y);
  };

  setScreenMode = (mode) => {
    this.ScreenMode = mode;
    this.fitInParentPlay();
  }
}

export default Screen;
