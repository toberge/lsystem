`use strict`

const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

const config = {
  segmentLength: 50,
  turnAngle: Math.PI/6,
  falloff: 0.9,
  depth: 4,
};

const createSystem = (axiom, rules, depth=5) => {
  let system = axiom.split("");
  console.log(axiom, rules);
  for (let i = 0; i < depth; i++) {
    system = system.flatMap((c) => rules[c] ? rules[c].split("") : c);
    console.log(system.join(""));
  }
  return system.join("");
}

const system = createSystem("F", {"F": "F[+F]"});
//const system = createSystem("F-F-F-F", {"F": "FF-F-F-F-FF"}, 4);
//config.turnAngle = Math.PI/2
//config.falloff = 1
//config.segmentLength = 4
//config.depth = 4

const draw = (path) => {
  context.strokeStyle = "black";
  context.lineWidth = 3;
  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height);
  let params = Object.assign({}, config);
  const stack = [config];
  for (const c of path) {
    switch (c) {
      case "F":
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, -params.segmentLength);
        context.stroke()
        context.translate(0, -params.segmentLength);
        params.segmentLength *= config.falloff;
        break;
      case "+":
        context.rotate(params.turnAngle);
        break;
      case "-":
        context.rotate(-params.turnAngle);
        break;
      case "[":
        context.save();
        stack.push(Object.assign({}, params));
        break;
      case "]":
        context.restore();
        params = stack.pop();
        console.log(params)
        break;
      default:
        break;
    }
  }
}

//draw("F[-F-F[-F+F]+F-F]+F+F[-F+F]+F-F");
console.log(system)
draw(system);
