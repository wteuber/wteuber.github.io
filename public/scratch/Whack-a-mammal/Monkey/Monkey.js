/* eslint-disable require-yield, eqeqeq */

import {
  Sprite,
  Trigger,
  Watcher,
  Costume,
  Color,
  Sound,
} from "https://unpkg.com/leopard@^1/dist/index.esm.js";

export default class Monkey extends Sprite {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("happy", "./Monkey/costumes/happy.svg", { x: 68, y: 99 }),
      new Costume("hit", "./Monkey/costumes/hit.svg", {
        x: 67.8344743665103,
        y: 85.0661741934522,
      }),
    ];

    this.sounds = [
      new Sound("konrad_ah", "./Monkey/sounds/konrad_ah.wav"),
      new Sound("Boing", "./Monkey/sounds/Boing.wav"),
      new Sound("Bonk", "./Monkey/sounds/Bonk.wav"),
    ];

    this.triggers = [
      new Trigger(Trigger.CLICKED, this.whenthisspriteclicked),
      new Trigger(Trigger.GREEN_FLAG, this.whenGreenFlagClicked),
    ];

    this.vars.affeGetroffen = 0;
  }

  *whenthisspriteclicked() {
    if (this.toNumber(this.vars.affeGetroffen) === 0) {
      this.vars.affeGetroffen = 1;
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
    this.vars.affeGetroffen = 0;
    this.stage.vars.lochAffe = this.random(1, 5);
    while (
      !(
        this.compare(this.stage.vars.lochKatze, this.stage.vars.lochAffe) > 0 ||
        this.compare(this.stage.vars.lochKatze, this.stage.vars.lochAffe) < 0
      )
    ) {
      this.stage.vars.lochAffe = this.random(1, 5);
      yield;
    }
    if (this.toNumber(this.stage.vars.lochAffe) === 1) {
      this.goto(-155, -5);
    }
    if (this.toNumber(this.stage.vars.lochAffe) === 2) {
      this.goto(-12, -36);
    }
    if (this.toNumber(this.stage.vars.lochAffe) === 3) {
      this.goto(137, -10);
    }
    if (this.toNumber(this.stage.vars.lochAffe) === 4) {
      this.goto(-89, -151);
    }
    if (this.toNumber(this.stage.vars.lochAffe) === 5) {
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
