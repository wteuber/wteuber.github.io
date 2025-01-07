/* eslint-disable require-yield, eqeqeq */

import {
  Sprite,
  Trigger,
  Watcher,
  Costume,
  Color,
  Sound,
} from "https://unpkg.com/leopard@^1/dist/index.esm.js";

export default class Sprite1 extends Sprite {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("happy", "./Sprite1/costumes/happy.svg", { x: 48, y: 50 }),
      new Costume("hit", "./Sprite1/costumes/hit.svg", {
        x: 47.678977525244704,
        y: 53.4380744097364,
      }),
    ];

    this.sounds = [
      new Sound("karl_au", "./Sprite1/sounds/karl_au.wav"),
      new Sound("Boing", "./Sprite1/sounds/Boing.wav"),
      new Sound("Bonk", "./Sprite1/sounds/Bonk.wav"),
    ];

    this.triggers = [
      new Trigger(Trigger.CLICKED, this.whenthisspriteclicked),
      new Trigger(Trigger.GREEN_FLAG, this.whenGreenFlagClicked),
    ];

    this.vars.katzeGetroffen = 0;
  }

  *whenthisspriteclicked() {
    if (this.toNumber(this.vars.katzeGetroffen) === 0) {
      this.vars.katzeGetroffen = 1;
      yield* this.startSound("Bonk");
      this.costume = "hit";
      yield* this.glide(0.05, this.x, this.y - 10);
      yield* this.glide(0.05, this.x, this.y + 10);
    }
  }

  *whenGreenFlagClicked() {
    yield* this.erscheinen();
  }

  *erscheinen() {
    this.costume = "happy";
    this.vars.katzeGetroffen = 0;
    this.stage.vars.lochKatze = this.random(1, 5);
    while (
      !(
        this.compare(this.stage.vars.lochKatze, this.stage.vars.lochAffe) > 0 ||
        this.compare(this.stage.vars.lochKatze, this.stage.vars.lochAffe) < 0
      )
    ) {
      this.stage.vars.lochKatze = this.random(1, 5);
      yield;
    }
    if (this.toNumber(this.stage.vars.lochKatze) === 1) {
      this.goto(-155, -5);
    }
    if (this.toNumber(this.stage.vars.lochKatze) === 2) {
      this.goto(-12, -36);
    }
    if (this.toNumber(this.stage.vars.lochKatze) === 3) {
      this.goto(137, -10);
    }
    if (this.toNumber(this.stage.vars.lochKatze) === 4) {
      this.goto(-89, -151);
    }
    if (this.toNumber(this.stage.vars.lochKatze) === 5) {
      this.goto(69, -156);
    }
    yield* this.startSound("Boing");
    yield* this.glide(0.5, this.x, this.y + 60);
    yield* this.wait(this.random(20, 30) / 10);
    yield* this.verstecken();
  }

  *verstecken() {
    this.moveBehind();
    yield* this.glide(0.3, this.x, this.y - 60);
    yield* this.wait(this.random(30, 50) / 10);
    yield* this.erscheinen();
  }
}
