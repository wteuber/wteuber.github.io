let ball, paddle, blocks;
let ballSize = 35;
let paddleWidth = 1000;
let paddleHeight = 20;
let numLives = 3;
let currentLevel = 2;
let maxLevels = 5;
let blockWidth = 100;
let blockHeight = 40;
let blockPadding = 10;
let blockOffsetTop = 200;
let blockOffsetLeft = 10;
let blockColors = ['#ffff00', '#ff00ff', '#00ffff', '#ff0000', '#00ff00'];
var lastBlockHit = -1;

function setup() {
	createCanvas(1904, 1000);
	frameRate(60);
	resetGame();
}

function draw() {
	background(0);
	drawBall();
	drawPaddle();
	drawBlocks();
	moveBall();
	checkCollisions();
	checkGameOver();
	showLives();
	showLevel();
}

function resetGame() {
	ball = {
		x: width / 2,
		y: height / 2,
		dx: 15,
		dy: -15,
	};
	paddle = {
		x: width / 2 - paddleWidth / 2,
		y: height - paddleHeight - 10
	};
	blocks = [];
	for (let i = 0; i < maxLevels; i++) {
		blocks[i] = createBlocks(i + 1);
	}
	numLives = 3;
	currentLevel = 4;
}

function createBlocks(level) {
	let rows = level + 2;
	let cols = floor(width / (blockWidth + blockPadding));
	let blocks = [];
	for (let i = 0; i < rows; i++) {
		blocks[i] = [];
		for (let j = 0; j < cols; j++) {
			blocks[i][j] = {
				x: j * (blockWidth + blockPadding) + blockOffsetLeft,
				y: i * (blockHeight + blockPadding) + blockOffsetTop,
				lives: 1,
				color: blockColors[i % blockColors.length]
			};
		}
	}
	return blocks;
}

function drawBall() {
	// Set the ball color based on the last block hit
	if (lastBlockHit != -1) {
		ball.color = blocks[lastBlockHit].color;
	}

	noStroke();
	fill(255);
	ellipse(ball.x, ball.y, ballSize, ballSize);
}

function drawPaddle() {
	noStroke();
	fill(255);
	rect(paddle.x, paddle.y, paddleWidth, paddleHeight);
}

function drawBlocks() {
	for (let i = 0; i < blocks[currentLevel - 1].length; i++) {
		for (let j = 0; j < blocks[currentLevel - 1][i].length; j++) {
			let block = blocks[currentLevel - 1][i][j];
			if (block.lives > 0) {
				noStroke();
				fill(block.color);
				rect(block.x, block.y, blockWidth, blockHeight);
			}
		}
	}
}

function moveBall() {
	ball.x += ball.dx;
	ball.y += ball.dy;
	if (ball.x + ballSize / 2 > width || ball.x - ballSize / 2 < 0) {
		ball.dx *= -1;
	}
	if (ball.y - ballSize / 2 < 0) {
		ball.dy *= -1;
	}
	if (ball.y + ballSize / 2 > height) {
		numLives--;
		if (numLives > 0) {
			ball = {
				x: width / 2,
				y: height / 2,
				dx: 15,
				dy: -15,
			};
			paddle = {
				x: width / 2 - paddleWidth / 2,
				y: height - paddleHeight - 10
			};
		} else {
			resetGame();
		}
	}
}

function checkCollisions() {
	// check collision with paddle
	if (ball.y + ballSize / 2 > paddle.y && ball.y + ballSize / 2 < paddle.y + paddleHeight && ball.x > paddle.x && ball.x < paddle.x + paddleWidth) {
		ball.dy *= -1;
		let dx = map(ball.x, paddle.x, paddle.x + paddleWidth, -10, 10);
		ball.dx = dx;
	}
	// check collision with blocks
	for (let i = 0; i < blocks[currentLevel - 1].length; i++) {
		for (let j = 0; j < blocks[currentLevel - 1][i].length; j++) {
			let block = blocks[currentLevel - 1][i][j];
			if (block.lives > 0) {
				if (ball.y - ballSize / 2 < block.y + blockHeight && ball.y + ballSize / 2 > block.y && ball.x > block.x && ball.x < block.x + blockWidth) {
					block.lives--;
					ball.dy *= -1;
					if (block.lives == 0) {
						// check for power-ups
						if (block.color == '#ffffff') {
							// add a new ball
							addBall();
						}
					}
				}
			}
		}
	}
}

function checkGameOver() {
	let blocksLeft = 0;
	for (let i = 0; i < blocks[currentLevel - 1].length; i++) {
		for (let j = 0; j < blocks[currentLevel - 1][i].length; j++) {
			if (blocks[currentLevel - 1][i][j].lives > 0) {
				blocksLeft++;
			}
		}
	}
	if (blocksLeft == 0) {
		if (currentLevel < maxLevels) {
			currentLevel++;
			resetGame();
		} else {
			textAlign(CENTER, CENTER);
			textSize(32);
			fill(255);
			text("You win!", width / 2, height / 2);
			noLoop();
		}
	}
	if (numLives == 0) {
		textAlign(CENTER, CENTER);
		textSize(32);
		fill(255);
		text("Game over", width / 2, height / 2);
		noLoop();
	}
}

function addBall() {
	let newBall = {
		x: ball.x,
		y: ball.y,
		dx: random(-5, 5),
		dy: -5,
	};
	balls.push(newBall);
}

function showLives() {
	textAlign(LEFT, CENTER);
	textSize(16);
	fill(255);
	text("Lives: " + numLives, 10, height - 20);
}

function showLevel() {
	textAlign(RIGHT, CENTER);
	textSize(16);
	fill(255);
	text("Level: " + currentLevel, width - 10, height - 20);
}

function mouseMoved() {
	paddle.x = mouseX - paddleWidth / 2;
}
