/* eslint-disable require-yield, eqeqeq */

import {
  Sprite,
  Trigger,
  Watcher,
  Costume,
  Color,
  Sound,
} from "https://unpkg.com/leopard@^1/dist/index.esm.js";

export default class Figur6 extends Sprite {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("Kostüm1", "./Figur6/costumes/Kostüm1.svg", {
        x: 50.5,
        y: 42.24647947052918,
      }),
    ];

    this.sounds = [
      new Sound("Plopp", "./Figur6/sounds/Plopp.wav"),
      new Sound("Boing", "./Figur6/sounds/Boing.wav"),
    ];

    this.triggers = [];
  }
}
