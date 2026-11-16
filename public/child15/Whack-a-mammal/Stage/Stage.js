/* eslint-disable require-yield, eqeqeq */

import {
  Stage as StageBase,
  Trigger,
  Watcher,
  Costume,
  Color,
  Sound,
} from "https://unpkg.com/leopard@^1/dist/index.esm.js";

export default class Stage extends StageBase {
  constructor(...args) {
    super(...args);

    this.costumes = [
      new Costume("Hintergrund1", "./Stage/costumes/Hintergrund1.svg", {
        x: 295.5,
        y: 226.1875,
      }),
      new Costume("Hay Field", "./Stage/costumes/Hay Field.png", {
        x: 480,
        y: 360,
      }),
      new Costume("Galaxy", "./Stage/costumes/Galaxy.png", { x: 480, y: 360 }),
      new Costume("Galaxy2", "./Stage/costumes/Galaxy2.png", {
        x: 480,
        y: 360,
      }),
      new Costume("Hintergrund2", "./Stage/costumes/Hintergrund2.svg", {
        x: 0,
        y: 0,
      }),
    ];

    this.sounds = [new Sound("pop", "./Stage/sounds/pop.wav")];

    this.triggers = [];

    this.vars.lochKatze = 5;
    this.vars.lochAffe = 1;
  }
}
