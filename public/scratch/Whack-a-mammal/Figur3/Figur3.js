/* eslint-disable require-yield, eqeqeq */

import {
  Sprite,
  Trigger,
  Watcher,
  Costume,
  Color,
  Sound,
} from "https://unpkg.com/leopard@^1/dist/index.esm.js";

export default class Figur3 extends Sprite {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("Kostüm1", "./Figur3/costumes/Kostüm1.svg", {
        x: 50.618676188118854,
        y: 42.71078014197275,
      }),
    ];

    this.sounds = [new Sound("Plopp", "./Figur3/sounds/Plopp.wav")];

    this.triggers = [];
  }
}
