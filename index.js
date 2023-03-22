`use strict`;

const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
// TODO fix resizing
document.onresize = (e) => {
  canvas.width = e.width;
  canvas.height = e.height;
};

let config = {
  length: 50,
  angle: Math.PI / 6,
  falloff: 0.9,
  depth: 4,
};

const systems = [
  {
    name: "bush",
    axiom: "F",
    rules: {
      F: "FF-[-F+F+F]+[+F-F-FX]",
    },
    angle: (22.5 / 180) * Math.PI,
    falloff: 1,
    length: 16,
  },
  {
    name: "Fork",
    axiom: "F",
    rules: {
      //F: "F[-F-F[-F+F]+F-F]+F+F[-F+F]+F-F",
      F: "FF[-F[+FX]][+F[-FX]][-F[-FX]]", // add [+F[+FX]] for symmetry
    },
    depth: 3,
    angle: Math.PI / 6,
    length: 50,
    falloff: 0.95,
  },
  {
    name: "MengerSponge",
    axiom: "F-F-F-F",
    rules: { F: "FF-F-F-F-FF" },
    angle: Math.PI / 2,
    falloff: 1,
    length: 4,
    depth: 4,
  },
];

const createSystem = (axiom, rules, depth = 5) => {
  let system = axiom.split("");
  console.log(axiom, rules);
  for (let i = 0; i < depth; i++) {
    system = system.flatMap((c) => (rules[c] ? rules[c].split("") : c));
    console.log(system.join(""));
  }
  return system.join("");
};

config = { ...config, ...systems[1] };
const system = createSystem(config.axiom, config.rules, config.depth);

// Palette
// #E8B50E
// #9C7702
// #1AA3E8
// #E85825
// #9C4121

const draw = (path) => {
  context.strokeStyle = "#9C7702";
  context.fillStyle = "#1AA3E8BB";
  context.lineWidth = 3;
  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height);
  let params = Object.assign({}, config);
  const stack = [config];
  for (const c of path) {
    switch (c) {
      case "F":
        context.globalCompositeOperation = "destination-over";
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, -params.length);
        context.stroke();
        context.translate(0, -params.length);
        params.length *= config.falloff;
        context.globalCompositeOperation = "source-over";
        break;
      case "X":
        context.translate(0, params.length / 2);
        context.beginPath();
        context.arc(
          0,
          0,
          params.length,
          1.5 * Math.PI - params.angle,
          1.5 * Math.PI + params.angle
        );
        context.lineTo(0, 0);
        context.fill();
        context.translate(0, -params.length / 2);
        break;
      case "+":
        context.rotate(-params.angle);
        break;
      case "-":
        context.rotate(params.angle);
        break;
      case "[":
        context.save();
        stack.push(Object.assign({}, params));
        break;
      case "]":
        context.restore();
        params = stack.pop();
        break;
      default:
        break;
    }
  }
};

draw(system);
