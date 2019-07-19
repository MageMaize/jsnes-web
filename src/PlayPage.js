import Raven from "raven-js";
import React, { Component } from "react";
import { Progress } from "reactstrap";
import "./PlayPage.css";
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
  var path = "http://api.magecorn.com/nes/getUrl";
  req.open("POST", path);
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
  req.send(`{"onlyUrl":1,"id":${id}}`);
  return req;
}

document.oncontextmenu = () => {
  return false;
}

class PlayPage extends Component {
  isRun = false;
  gameSaveDat = null;
  gameRecordData = null;
  playMode = "Normal";
  romId = -1;
  ramGetters = {};
  ppuGetters = {};
  
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
          </div>
        )}
      </div>
    );
  }

  sendMsgToTopWindow = (msg) => {
    if(window.top.location === window.self.location) return;
    window.parent.postMessage(msg,"*");
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
      onAudioSample: this.speakers.writeSample,
      onFrameBegin: this.onFrameBegin,
      onFrameEnd: this.onFrameEnd,
      frameCaller: this,
    });

    // For debugging
    window.nes = this.nes;
    window.page = this;

    //document.body.style.overflowY="hidden";
    //document.body.style.overflowY="scroll";
    //document.body.scroll="no";

    this.frameTimer = new FrameTimer({
      onGenerateFrame: Raven.wrap(this.nes.frame),
      onWriteFrame: Raven.wrap(this.screen.writeBuffer)
    });

    window.addEventListener("message",this.onWindowMessage.bind(this));

    this.keyboardController = new KeyboardController({
      onButtonDown: this.nes.buttonDown,
      onButtonUp: this.nes.buttonUp,
      playPage: this,
    });
    document.addEventListener("keydown", this.keyboardController.handleKeyDown);
    document.addEventListener("keyup", this.keyboardController.handleKeyUp);
    document.addEventListener("keypress",this.keyboardController.handleKeyPress);

    window.addEventListener("resize", this.layout);
    this.layout();

    this.load();
  }

  updatPlayMode(mode) {
    this.playMode = mode;
    this.sendMsgToTopWindow({type:"update-play-mode",mode:this.playMode});
  }

  onFrameBegin() {
    let nes = this.nes;
    
    switch(this.playMode) {
      case "Normal": {
        
        break;
      }
      

      case "Record": {
        let controller = nes.controllers[1];
        let value = 0x00;
        for(let i = 0;i < 8;i ++) {
          if(controller.state[i] === 0x41) {
            // 按键按下
            let keyV = 1 << (7 - i);
            value = value | keyV;
          }
        }
        this.gameRecordData[nes.frameCount] = value;
        break;
      }  
      

      case "Play": {
        if(nes.frameCount >= this.gameRecordData.length) {
          this.updatPlayMode("Normal");
          this.reset();
          this.stop();
          this.sendMsgToTopWindow({type:"record-play-finish"});
          break;
        }
        let controller = nes.controllers[1];
        let value = this.gameRecordData[nes.frameCount];
        for(let i = 0;i < 8;i ++) {
          let keyV = 1 << (7 - i);
          keyV = keyV & value;
          if(keyV > 0) {
            controller.state[i] = 0x41;
          } else {
            controller.state[i] = 0x40;
          }
        }
        this.sendMsgToTopWindow({type:"play-mode-time",pos:nes.frameCount,length:this.gameRecordData.length});
        break;
      }
      

      default:

      break;
    }

  }

  onFrameEnd() {
    let nes = this.nes;

    let ramData = null;
    for(let key in this.ramGetters) {
      if(ramData === null) ramData = {};
      let flag = key;
      let offset = this.ramGetters[key][0];
      let length = this.ramGetters[key][1];
      ramData[flag] = nes.cpu.mem.slice(offset,offset+length);
    }
    if(ramData !== null) {
      this.sendMsgToTopWindow({type:"ram-data",data:ramData});
    }

    let ppuData = null;
    for(let key in this.ppuGetters) {
      if(ppuData === null) ppuData = {};
      let flag = key;
      let offset = this.ppuGetters[key][0];
      let length = this.ppuGetters[key][1];
      ppuData[flag] = nes.ppu.vramMem.slice(offset,offset+length);
    }
    if(ppuData !== null) {
      this.sendMsgToTopWindow({type:"ppu-data",data:ppuData});
    }
  }


  componentWillUnmount() {
    if (this.currentRequest) {
      this.currentRequest.abort();
    }
    this.stop();

    let _self = this;
    window.removeEventListener("message",(e) => {
      _self.onWindowMessage(e)
    });

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
      this.romId = id;
      let self = this;
      getNesUrl(id,function(error,data){
          if(error) {
              window.alert(`Error loading ROM: ${error}`);
          } else {
              if(data === "") {
                  window.alert(`Error loading ROM`);
              } else {
                  //const path = data;
                  const path = "http://nesplay.magecorn.net:8008/1943.nes";
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
    this.gameSaveDat = null;
    this.nes.loadROM(data);
    this.start();
    this.sendMsgToTopWindow({type:"game-loaded",romid:this.romId});
  };

  start = () => {
    if(this.isRun) return ;
    this.isRun = true;
    this.screen.isRun = true;
    //this.setState({ paused: false });
    //this.screen.reWrite();
    this.frameTimer.start();
    this.speakers.start();
    this.fpsInterval = setInterval(() => {
      this.sendMsgToTopWindow({type:"fps",value:this.nes.getFPS()});
    }, 1000);
    this.sendMsgToTopWindow({type:"pause",state:"play"});
  };

  reset = () => {
    if (this.nes.romData !== null) {
      this.nes.reset();
      this.nes.mmap = this.nes.rom.createMapper();
      this.nes.mmap.loadROM();
      this.nes.ppu.setMirroring(this.nes.rom.getMirroringType());
      //this.stop();
      //this.start();
    }
  }

  stop = () => {
    if(!this.isRun) return ;
    this.isRun = false;
    this.screen.isRun = false;
    //this.setState({ paused: true });
    //this.screen.reWrite();
    this.frameTimer.stop();
    this.speakers.stop();
    clearInterval(this.fpsInterval);
    this.sendMsgToTopWindow({type:"pause",state:"pause"});
  };

  handlePauseResume = () => {
    if (!this.isRun) {
      this.start();
    } else {
      this.stop();
    }
    this.sendMsgToTopWindow({type:"manual-pause",state:this.isRun ? "play" : "pause"});
  };

  onWindowMessage = (e)=> {
    let data = e.data;
    if(!data.type) return;
    switch(data.type) {
      case "pause":
        this.handlePauseResume();
      break;

      case "set-volume":
        let v = Math.max(0,Math.min(data.volume,1));
        this.speakers.volume = v;
        this.sendMsgToTopWindow({type:"set-volume",volume:v});
      break;

      case "screen_mode" :
        this.screen.setScreenMode(data.mode);
      break;

      case "screenshot" :
        if(this.screen.isRun) {
          let imgSrc = this.screen.screenshotData();
          this.sendMsgToTopWindow({type:"screenshot",img:imgSrc});
        }
      break;

      case "reset" :
        this.reset();
        this.start();
      break;

      case "start-record":
        if(this.playMode !== "Normal") return;
        this.gameRecordData = [];
        this.reset();
        this.start();
        this.updatPlayMode("Record");
      break;

      case "stop-record":
        if(this.playMode !== "Record") return;
        this.stop();
        this.updatPlayMode("Normal");
        this.sendMsgToTopWindow({type:"record-data",data:this.getRecordData()});
      break;

      case "play-record":
        if(this.playMode === "Record") return;
        this.setRecordData(data.data);
        this.reset();
        this.start();
        this.updatPlayMode("Play");
      break;

      case "loadFormJSON": {
        //this.nes.fromJSON(JSON.parse(data.json));
        let __nesdata = JSON.parse(data.json);
        this.nes.cpu.fromJSON(__nesdata.cpu);
        this.nes.mmap.fromJSON(__nesdata.mmap);
        this.nes.ppu.fromJSON(__nesdata.ppu);
      }
      break;

      case "saveToJSON": {
        let __nesdata = {
          cpu: this.nes.cpu.toJSON(),
          mmap: this.nes.mmap.toJSON(),
          ppu: this.nes.ppu.toJSON()
        };
        var json = JSON.stringify(__nesdata);
        //let json = JSON.stringify(this.nes.toJSON());
        this.sendMsgToTopWindow({type:"saveToJSON",json:json});
      }
      break;

      case "quickLoad":{
        if(this.gameSaveDat == null) break;
        let d = JSON.parse(this.gameSaveDat);
        this.nes.cpu.fromJSON(d.cpu);
        this.nes.mmap.fromJSON(d.mmap);
        this.nes.ppu.fromJSON(d.ppu);
      }
      break;

      case "quickSave":{
        let __nesdata = {
          cpu: this.nes.cpu.toJSON(),
          mmap: this.nes.mmap.toJSON(),
          ppu: this.nes.ppu.toJSON()
        };
        this.gameSaveDat = JSON.stringify(__nesdata);
      }
      break;

      case "regist-ram-getter": {
        if(this.ramGetters[data.flag]) break;
        this.ramGetters[data.flag] = [data.offset,data.length];
        break;
      }

      case "unregist-ram-getter": {
        if(this.ramGetters[data.flag]) {
          delete this.ramGetters[data.flag];
        }
        break;
      }

      case "regist-ppu-getter": {
        if(this.ppuGetters[data.flag]) break;
        this.ppuGetters[data.flag] = [data.offset,data.length];
        break;
      }

      case "unregist-ppu-getter": {
        if(this.ppuGetters[data.flag]) {
          delete this.ppuGetters[data.flag];
        }
        break;
      }
      
      default :
      break;
    }
  }

  layout = () => {
    this.screenContainer.style.height = `${window.innerHeight}px`;
    this.screen.fitInParentPlay();
  };

  toggleControlsModal = () => {
    this.setState({ controlsModal: !this.state.controlsModal });
  };


  getRecordData = () => {
    if(this.gameRecordData == null) return null;
    let array = this.gameRecordData.concat();
    let json = {};
    json["type"] = "MimoeNES Replay File";
    json["version"] = 1;
    json["romid"] = this.romId;
    json["data"] = array;
    let buf = JSON.stringify(json);
    return buf;
  };

  setRecordData = (data) => {
    if(this.playMode === "Record") return;
    try {
      let json = JSON.parse(data);
      if(json["type"] != "MimoeNES Replay File") {
        throw "Replay Json Type Error!";
      };
      if(json["romid"] != this.romId) {
        throw "Replay ROM id Error!";
      }
      this.gameRecordData = json["data"];
    }
    catch(e) {
      this.sendError(e);
      return;
    }
  };

  sendError = (str) => {
    this.sendMsgToTopWindow({type:"error",msg:str});
  }
}

export default PlayPage;
