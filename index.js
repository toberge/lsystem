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

const systems = {
  bush: {
    name: "Bush",
    axiom: "F",
    rules: {
      F: "FF-[-F+F+F]+[+F-F-F$]",
    },
    angle: (22.5 / 180) * Math.PI,
    falloff: 1,
    length: 16,
  },
  fork: {
    name: "Fork",
    axiom: "F",
    rules: {
      //F: "F[-F-F[-F+F]+F-F]+F+F[-F+F]+F-F",
      F: "FF[-F[+F$]][+F[-F$]][-F[-F$]]", // add [+F[+FX]] for symmetry
    },
    depth: 3,
    angle: Math.PI / 6,
    length: 50,
    falloff: 0.95,
  },
  menger: {
    name: "Menger Sponge",
    axiom: "F-F-F-F",
    rules: { F: "FF-F-F-F-FF" },
    angle: Math.PI / 2,
    falloff: 1,
    length: 4,
    depth: 4,
  },
};

config = { ...config, ...systems["fork"] };

const createSystem = (axiom, rules, depth = 5) => {
  let system = axiom.split("");
  for (let i = 0; i < depth; i++) {
    system = system.flatMap((c) => (rules[c] ? rules[c].split("") : c));
  }
  return system.join("");
};

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
      case "$":
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

const refresh = () => {
  requestAnimationFrame(() =>
    draw(createSystem(config.axiom, config.rules, config.depth))
  );
};

refresh();

const presetSelect = document.getElementById("preset");
Object.keys(systems).forEach((id) => {
  const option = document.createElement("option");
  option.value = id;
  option.innerHTML = systems[id].name;
  presetSelect.appendChild(option);
});
presetSelect.addEventListener("change", (e) => {
  const system = systems[e.target.value] || systems.fork;
  config = { ...config, ...system };
  refresh();
});

const hookUpInput = (id, transform = (x) => x) => {
  const input = document.getElementById(id);
  input.value = config[id];
  input.addEventListener("change", (e) => {
    config[id] = transform(e.target.value);
    refresh();
  });
  presetSelect.addEventListener("change", () => {
    input.value = config[id];
  });
};
hookUpInput("length", parseFloat);
hookUpInput("angle", parseFloat);
hookUpInput("depth", parseInt);

const axiomInput = document.getElementById("axiom");
axiomInput.value = config.axiom;
presetSelect.addEventListener("change", () => {
  axiomInput.value = config.axiom;
});
axiomInput.addEventListener("change", (e) => {
  config.axiom = e.target.value;
  refresh();
});
axiomInput.addEventListener("keyup", (e) => {
  if (e.key == "Enter" || e.keyCode == 13) {
    config.axiom = axiomInput.value;
    refresh();
  }
});

const rulesInput = document.getElementById("rules");
const setRules = (input) => {
  let result;
  try {
    result = JSON.parse(input);
    if (
      typeof result !== "object" ||
      Object.values(result).some((rule) => typeof rule !== "string")
    ) {
      result = new Error('Rules should be of the form { "X": "Y" }');
    }
  } catch (e) {
    result = new Error("That ain't proper JSON");
  }

  if ("message" in result) {
    console.error(result);
    rulesInput.style.setProperty("border-color", "#E85825");
  } else {
    config.rules = result;
    rulesInput.style.setProperty("border-color", "transparent");
    refresh();
  }
};
rulesInput.value = JSON.stringify(config.rules, null, 2);
presetSelect.addEventListener("change", () => {
  rulesInput.value = JSON.stringify(config.rules, null, 2);
});
rulesInput.addEventListener("change", (e) => {
  setRules(e.target.value);
});
rulesInput.addEventListener("keyup", (e) => {
  if ((e.key == "Enter" || e.keyCode == 13) && (e.ctrlKey || e.altKey)) {
    setRules(rulesInput.value);
  }
});
