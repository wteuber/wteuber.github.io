/* eslint-disable require-yield, eqeqeq */

import {
  Sprite,
  Trigger,
  Watcher,
  Costume,
  Color,
  Sound,
} from "https://unpkg.com/leopard@^1/dist/index.esm.js";

export default class Figur4 extends Sprite {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("Kostüm1", "./Figur4/costumes/Kostüm1.svg", {
        x: 50.5,
        y: 39.846663554400806,
      }),
    ];

    this.sounds = [new Sound("Plopp", "./Figur4/sounds/Plopp.wav")];

    this.triggers = [];
  }
}
