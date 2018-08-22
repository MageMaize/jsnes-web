import Raven from "raven-js";
import React, { Component } from "react";
import { Progress } from "reactstrap";
import "./PlayPage.css";
import ControlsModal from "./ControlsModal";
import FrameTimer from "./FrameTimer";
import KeyboardController from "./KeyboardController";
import Screen from "./Screen";
import Speakers from "./Speakers";
import { NES } from "jsnes";

function loadBinary(path, callback, handleProgress) {
  var req = new XMLHttpRequest();
  req.open("GET", path);
  req.overrideMimeType("text/plain; charset=x-user-defined");
  req.onload = function() {
    if (this.status === 200) {
      callback(null, this.responseText);
    } else if (this.status === 0) {
      // Aborted, so ignore error
    } else {
      callback(new Error(req.statusText));
    }
  };
  req.onerror = function() {
    callback(new Error(req.statusText));
  };
  req.onprogress = handleProgress;
  req.send();
  return req;
}

function getNesUrl(id,callback) {
  var req = new XMLHttpRequest();
  var path = "http://api.magecorn.com/nes/getUrl?onlyUrl=1&id=" + id;
  req.open("GET", path);
  req.overrideMimeType("text/plain; charset=x-user-defined");
  req.onload = function() {
    if (this.status === 200) {
      callback(null, this.responseText);
    } else if (this.status === 0) {
      // Aborted, so ignore error
    } else {
      callback(new Error(req.statusText));
    }
  };
  req.onerror = function() {
    callback(new Error(req.statusText));
  };
  req.send();
  return req;
}

class PlayPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      running: false,
      paused: false,
      controlsModal: false,
      loading: true,
      loadedPercent: 3,
      error: null
    };
  }

  render() {
    return (
      <div className="PlayPage">
        {this.state.error ? (
          this.state.error
        ) : (
          <div
            className="screen-container"
            ref={el => {
              this.screenContainer = el;
            }}
          >
            {this.state.loading ? (
              <Progress
                value={this.state.loadedPercent}
                style={{
                  position: "absolute",
                  width: "70%",
                  left: "15%",
                  top: "48%"
                }}
              />
            ) : null}
            <Screen
              ref={screen => {
                this.screen = screen;
              }}
              onGenerateFrame={() => {
                this.nes.frame();
              }}
              onMouseDown={(x, y) => {
                // console.log("mouseDown")
                this.nes.zapperMove(x, y);
                this.nes.zapperFireDown();
              }}
              onMouseUp={() => {
                // console.log("mouseUp")
                this.nes.zapperFireUp();
              }}
            />
            <ControlsModal
              isOpen={this.state.controlsModal}
              toggle={this.toggleControlsModal}
            />
          </div>
        )}
      </div>
    );
  }

  componentDidMount() {
    this.speakers = new Speakers({
      onBufferUnderrun: (actualSize, desiredSize) => {
        if (!this.state.running || this.state.paused) {
          return;
        }
        // Skip a video frame so audio remains consistent. This happens for
        // a variety of reasons:
        // - Frame rate is not quite 60fps, so sometimes buffer empties
        // - Page is not visible, so requestAnimationFrame doesn't get fired.
        //   In this case emulator still runs at full speed, but timing is
        //   done by audio instead of requestAnimationFrame.
        // - System can't run emulator at full speed. In this case it'll stop
        //    firing requestAnimationFrame.
        this.nes.frame();
        // desiredSize will be 2048, and the NES produces 1468 samples on each
        // frame so we might need a second frame to be run. Give up after that
        // though -- the system is not catching up
        if (this.speakers.buffer.size() < desiredSize) {
          this.nes.frame();
        }
      }
    });
    this.nes = new NES({
      onFrame: this.screen.setBuffer,
      onStatusUpdate: console.log,
      onAudioSample: this.speakers.writeSample
    });

    // For debugging
    window.nes = this.nes;
    let self = this;
    window.pause = function() {
      self.handlePauseResume();
    };
    //document.body.style.overflowY="hidden";
    //document.body.style.overflowY="scroll";
    //document.body.scroll="no";

    this.frameTimer = new FrameTimer({
      onGenerateFrame: Raven.wrap(this.nes.frame),
      onWriteFrame: Raven.wrap(this.screen.writeBuffer)
    });

    this.keyboardController = new KeyboardController({
      onButtonDown: this.nes.buttonDown,
      onButtonUp: this.nes.buttonUp
    });
    document.addEventListener("keydown", this.keyboardController.handleKeyDown);
    document.addEventListener("keyup", this.keyboardController.handleKeyUp);
    document.addEventListener(
      "keypress",
      this.keyboardController.handleKeyPress
    );

    window.addEventListener("resize", this.layout);
    this.layout();

    this.load();
  }

  componentWillUnmount() {
    if (this.currentRequest) {
      this.currentRequest.abort();
    }
    this.stop();
    document.removeEventListener(
      "keydown",
      this.keyboardController.handleKeyDown
    );
    document.removeEventListener("keyup", this.keyboardController.handleKeyUp);
    document.removeEventListener(
      "keypress",
      this.keyboardController.handleKeyPress
    );
    window.removeEventListener("resize", this.layout);

    window.nes = undefined;
    window.pause = undefined;
  }

  load = () => {
    if (this.props.match.params.id) {
      const id = this.props.match.params.id;
      let self = this;
      getNesUrl(id,function(error,data){
          if(error) {
              window.alert(`Error loading ROM: ${error}`);
          } else {
              if(data === "") {
                  window.alert(`Error loading ROM`);
              } else {
                  const path = data;
                  self.currentRequest = loadBinary(
                    path,
                    (err, data) => {
                      if (err) {
                        window.alert(`Error loading ROM: ${err.toString()}`);
                      } else {
                        self.handleLoaded(data);
                      }
                    },
                    self.handleProgress
                  );
              }
          }
      });
    } else {
      window.alert("No ROM provided");
    }
  };

  handleProgress = e => {
    if (e.lengthComputable) {
      this.setState({ loadedPercent: e.loaded / e.total * 100 });
    }
  };

  handleLoaded = data => {
    this.setState({ uiEnabled: true, running: true, loading: false });
    this.nes.loadROM(data);
    this.start();
  };

  start = () => {
    this.frameTimer.start();
    this.speakers.start();
    this.fpsInterval = setInterval(() => {
      console.log(`FPS: ${this.nes.getFPS()}`);
    }, 1000);
  };

  stop = () => {
    this.frameTimer.stop();
    this.speakers.stop();
    clearInterval(this.fpsInterval);
  };

  handlePauseResume = () => {
    if (this.state.paused) {
      this.setState({ paused: false });
      this.start();
    } else {
      this.setState({ paused: true });
      this.stop();
    }
  };

  layout = () => {
    this.screenContainer.style.height = `${window.innerHeight}px`;
    this.screen.fitInParentPlay();
  };

  toggleControlsModal = () => {
    this.setState({ controlsModal: !this.state.controlsModal });
  };
}

export default PlayPage;
