import {
  Project,
  Sprite,
} from "https://unpkg.com/leopard@^1/dist/index.esm.js";

import Stage from "./Stage/Stage.js";
import Sprite1 from "./Sprite1/Sprite1.js";
import Monkey from "./Monkey/Monkey.js";
import Figur2 from "./Figur2/Figur2.js";
import Figur3 from "./Figur3/Figur3.js";
import Figur4 from "./Figur4/Figur4.js";
import Figur5 from "./Figur5/Figur5.js";
import Figur6 from "./Figur6/Figur6.js";

const stage = new Stage({ costumeNumber: 1 });

const sprites = {
  Sprite1: new Sprite1({
    x: 69,
    y: -156,
    direction: 90,
    rotationStyle: Sprite.RotationStyle.ALL_AROUND,
    costumeNumber: 1,
    size: 50,
    visible: true,
    layerOrder: 1,
  }),
  Monkey: new Monkey({
    x: -155,
    y: 55,
    direction: 90,
    rotationStyle: Sprite.RotationStyle.ALL_AROUND,
    costumeNumber: 1,
    size: 30,
    visible: true,
    layerOrder: 2,
  }),
  Figur2: new Figur2({
    x: 142.8457459928034,
    y: 18.31608345808253,
    direction: 90,
    rotationStyle: Sprite.RotationStyle.ALL_AROUND,
    costumeNumber: 1,
    size: 100,
    visible: true,
    layerOrder: 3,
  }),
  Figur3: new Figur3({
    x: -7.917466747704907,
    y: -9.718542175862524,
    direction: 90,
    rotationStyle: Sprite.RotationStyle.ALL_AROUND,
    costumeNumber: 1,
    size: 100,
    visible: true,
    layerOrder: 4,
  }),
  Figur4: new Figur4({
    x: -151.41423196011735,
    y: 15.167252903938461,
    direction: 90,
    rotationStyle: Sprite.RotationStyle.ALL_AROUND,
    costumeNumber: 1,
    size: 100,
    visible: true,
    layerOrder: 7,
  }),
  Figur5: new Figur5({
    x: -82.38470292091282,
    y: -124.74876054988795,
    direction: 90,
    rotationStyle: Sprite.RotationStyle.ALL_AROUND,
    costumeNumber: 1,
    size: 100,
    visible: true,
    layerOrder: 5,
  }),
  Figur6: new Figur6({
    x: 72.95447672125145,
    y: -127.80563280708304,
    direction: 90,
    rotationStyle: Sprite.RotationStyle.ALL_AROUND,
    costumeNumber: 1,
    size: 100,
    visible: true,
    layerOrder: 6,
  }),
};

const project = new Project(stage, sprites, {
  frameRate: 30, // Set to 60 to make your project run faster
});
export default project;
