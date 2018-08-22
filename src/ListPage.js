import React, { Component } from "react";
import "./ListPage.css";
import { ListGroup } from "reactstrap";
import { Link } from "react-router-dom";
import config from "./config";

class ListPage extends Component {
  render() {
    return (
      <div
        className="container ListPage my-4"
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop}
      >
        <div className="row justify-content-center">
          <div className="col-md-8">
            <header className="mb-4">
              <h1 className="mb-3">傲娇玉米站JSNES模拟器</h1>
              <p>模拟器程序由<a href="https://twitter.com/bfirsh">Ben Firshman</a>提供.  - <a href="https://github.com/bfirsh/jsnes">GitHub</a></p>
            </header>
            <ListGroup className="mb-4">
              {Object.keys(config.ROMS).map(key => (
                <Link
                  key={key}
                  to={"/run/" + encodeURIComponent(key)}
                  className="list-group-item"
                >
                  {key}
                  <span className="float-right">&rsaquo;</span>
                </Link>
              ))}
            </ListGroup>
            <p>您也可以拖拽一个NES文件到本窗口来测试是否可以正常运行</p>
            <p>Link: <a href="https://www.magecorn.com/" target="_blank" rel="noopener noreferrer">傲娇玉米站</a></p>
          </div>
        </div>
      </div>
    );
  }

  handleDragOver = e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  handleDrop = e => {
    e.preventDefault();

    const file = e.dataTransfer.items
      ? e.dataTransfer.items[0].getAsFile()
      : e.dataTransfer.files[0];

    this.props.history.push({ pathname: "/run", state: { file } });
  };
}

export default ListPage;
