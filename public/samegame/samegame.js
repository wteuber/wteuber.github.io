(function(window, document) {

class SameGame {
  // Colors of the balls
  // define CSS classes for each color in samegame.css
  colors = ["blue", "yellow", "red"];

  adj = [];
  main = new Array();

  scores = new Proxy({}, {
    set (obj, key, value) {

      obj[key] = value;

      let fields = document.querySelectorAll(`[name="${key}"]`);
      for (let field of fields) {
        field.textContent = value;
      }

      return true;
    }
  });

  config = new Proxy({}, {
    set (obj, key, value) {

      obj[key] = value;

      let fields = document.querySelectorAll(`[name="${key}"]`);
      for (let field of fields) {
        field.value = value;
      }
      window.SameGame.initGame();
      return true;
    }
  });

  initGame() {
    const board = document.getElementById("gameboard");
    board.innerHTML = "";
    let row, col, ballIdx;
    let tableRow, tableCell, cellSpan, ballDiv;

    this.rows = this.config.rows || 10;
    this.cols = this.config.cols || 15;

    for (row = (this.rows - 1); row > -1; row--) {
      ballIdx = row;
      for (col = 0; col < this.cols; col++) {
        if (ballIdx < this.rows) {
          tableRow = document.createElement("tr");
        }
        tableCell = document.createElement("td");

        cellSpan = document.createElement("span");
        cellSpan.classList.add("cell");
        (function(self, idx) {
          cellSpan.onmouseup = function() { self.clickBall(idx); };
          cellSpan.onmousedown = function() { self.onBall(idx); };
          cellSpan.onmouseover = function() { self.onBall(idx); };
          cellSpan.onmouseout = function() { self.offBall(idx); };
        })(this, ballIdx);

        ballDiv = document.createElement("div");
        ballDiv.classList.add("ball");
        ballDiv.id = "ball" + ballIdx;

        cellSpan.appendChild(ballDiv);
        tableCell.appendChild(cellSpan);
        tableRow.appendChild(tableCell);
        board.appendChild(tableRow);

        ballIdx = ballIdx + this.rows;
      }
    }

    this.registerEventListeners();
    this.seed(true);
  }

  registerEventListeners() {
    const rowsInput = document.querySelector('[name="rows"]')
    if(rowsInput.getAttribute("inputEventListener") !== "true"){
      rowsInput.addEventListener("input", (event) => {
        this.config.rows = parseInt(event.target.value, 10);
      });
      rowsInput.setAttribute("inputEventListener", "true");
    }

    const colsInput = document.querySelector('[name="cols"]');
    if(colsInput.getAttribute("inputEventListener") !== "true"){
      colsInput.addEventListener("input", (event) => {
        this.config.cols = parseInt(event.target.value, 10)
      });
      colsInput.setAttribute("inputEventListener", "true");
    }

    const newGameButton = document.querySelector('[name="new"]');
    if(newGameButton.getAttribute("clickEventListener") !== "true"){
      newGameButton.addEventListener("click", (event) => {
        this.seed(true);
      });
      newGameButton.setAttribute("clickEventListener", "true");
    }
  }

  seed(reset){
    if(reset){
      this.scores.total = 0;
      this.scores.click = 0;
      this.scores.round = 1;
    }

    this.main = new Array();
    for (let i = 0; i < this.cols * this.rows; i++) {
        this.main[i] = this.randomColor();
    }
    this.drawBoard();
  }

  randomColor() {
    const randomIndex = Math.floor((Math.random() * this.colors.length));

    return this.colors[randomIndex];
  }

  drawBoard() {
    for (let i = 0; i < this.main.length; i++) {
      const color = this.main[i];
      const ballClasslist = document.getElementById("ball" + i).classList
      ballClasslist.remove("cleared", "on", ...this.colors)
      ballClasslist.add(color);
    }
  }

  onBall(ballIdx) {
    if (this.main[ballIdx] != "cleared") {
      this.findAdjacent(ballIdx);
      if (this.adj.length > 1) {
        for (let n = 0; n < this.adj.length; n++) {
          document.getElementById("ball" + this.adj[n]).classList.add("on");
          this.scores.click = (this.adj.length-2)*(this.adj.length-2);
        }
      }
    }
  }

  offBall(ballIdx) {
    if (this.main[ballIdx] != "cleared") {
      this.findAdjacent(ballIdx);
      if (this.adj.length > 1) {
        for (let n = 0; n < this.adj.length; n++) {
          document.getElementById("ball" + this.adj[n]).classList.remove("on");

          this.scores.click = 0;
        }
      }
    }
  }

  clickBall(ballIdx) {
    let {main, adj, scores} = this
    if (main[ballIdx] != "cleared") {
      // this.findAdjacent(ballIdx);
      if (adj.length > 1) {
        for (let n = 0; n < adj.length; n++) {
          main[adj[n]] = "cleared";
        }
        this.slideBalls();
        this.drawBoard();
        scores.total += (adj.length - 2) ** 2;
        scores.click = 0;
        if (this.checkWinner()) {
          scores.round += 1;
          this.seed(false);
        }

        if (this.isGameOver()) {
          window.setTimeout(() => {
            alert("Game Over!\n You scored " + scores.total + " points.");
            this.seed(true);
          }, 10);
        }
      }
    }
  }

  isGameOver() {
    for (let ballIdx = 0; ballIdx < this.cols * this.rows; ballIdx++){
      if (this.main[ballIdx] != "cleared") {
        if (this.hasAdjacent(ballIdx)) {
          return false;
        }
      }
    }
    return true;
  }

  checkWinner() {
    if (this.main[0] == "cleared") {
      return true;
    }
  }

  hasAdjacent(ballIdx) {
    const isBottom = ballIdx % this.rows == 0;
    const isHead = (ballIdx + 1) % this.rows == 0;

    if (this.main[ballIdx + 1] == this.main[ballIdx] && !isHead) {
      return true;
    }
    if (this.main[ballIdx + this.rows] == this.main[ballIdx]) {
      return true;
    }
    if (this.main[ballIdx - 1] == this.main[ballIdx] && !isBottom) {
      return true;
    }
    if (this.main[ballIdx - this.rows] == this.main[ballIdx]) {
      return true;
    }
    return false;
  }

  slideBalls() {
    const {main} = this
    let change = 0;
    for (let i = 0; i < this.cols; i++) {
      let clearedCount = 0;
      let column = new Array();
      let newColumn = new Array();
      for (let c = 0; c < this.rows; c++) {
        column[c] = main[c + change];
      }
      for (let c = 0; c < this.rows; c++) {
        if (column[c] == "cleared") {
          clearedCount++;
          newColumn[this.rows - clearedCount] = "cleared";
        }
        else {
          newColumn[c - clearedCount] = column[c];
        }
      }
      for (let c = 0; c < this.rows; c++) {
        main[c + change] = newColumn[c];
      }
      if (clearedCount == this.rows) {
        for (let c = change; c < this.cols * this.rows; c++) {
          main[c] = main[c + this.rows];
        }
        for (let c = (this.cols-1) * this.rows; c < this.cols * this.rows; c++) {
          main[c] = "cleared";
        }
        change -= this.rows;
      }
      change += this.rows;
    }
  }

  findAdjacent(ballIdx) {
    this.adj = new Array();
    this.adj[0] = ballIdx;
    let i = 0;
    let c = 0;
    this.findAdjacent2(this.adj[c], i, c);
  }

  //	Rolls through the "adj" Array and adds adjacent balls of
  //	the same color to the "adj" Array.

  //	Checks in this order: up, right, down, left

  //	Uses isAdjacent() to check whether or not the ball
  //	in question is allready included in the "adj" Array.
  //	Does not add the ball to the array if isAdjacent() returns
  //	false.

  findAdjacent2(ballIdx, i, c) {
    const isBottom = ballIdx % this.rows == 0;
    const isHead = (ballIdx + 1) % this.rows == 0;
    const {main, adj} = this

    if (main[ballIdx+1] == main[ballIdx] && !isHead && this.isAdjacent(ballIdx+1)) {
      i++;
      adj[i] = ballIdx + 1;
    }
    if (main[ballIdx + this.rows] == main[ballIdx] && this.isAdjacent(ballIdx + this.rows)) {
      i++;
      adj[i] = ballIdx + this.rows;
    }
    if (main[ballIdx-1] == main[ballIdx] && !isBottom && this.isAdjacent(ballIdx-1)) {
      i++;
      adj[i] = ballIdx - 1;
    }
    if (main[ballIdx - this.rows] == main[ballIdx] && this.isAdjacent(ballIdx - this.rows)) {
      i++;
      adj[i] = ballIdx - this.rows;
    }
    c++;
    if (c != adj.length) {
      this.findAdjacent2(adj[c], i, c);
    }
  }

  // TODO: refactor using build-in Array.prototype methods
  isAdjacent(ballIdx) {
    let isAdj = true
    for (let n = 0; n < this.adj.length; n++) {
      if (this.adj[n] == ballIdx) {
        isAdj = false
      }
    }
    return isAdj
  }
}

window.SameGame = new SameGame();

})(window, document)
