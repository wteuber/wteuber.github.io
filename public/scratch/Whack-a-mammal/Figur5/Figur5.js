/* eslint-disable require-yield, eqeqeq */

import {
  Sprite,
  Trigger,
  Watcher,
  Costume,
  Color,
  Sound,
} from "https://unpkg.com/leopard@^1/dist/index.esm.js";

export default class Figur5 extends Sprite {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("Kostüm1", "./Figur5/costumes/Kostüm1.svg", {
        x: 50.5,
        y: 42.74697067934781,
      }),
    ];

    this.sounds = [new Sound("Plopp", "./Figur5/sounds/Plopp.wav")];

    this.triggers = [];
  }
}
