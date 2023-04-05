`use strict`;

const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const defaultConfig = {
  length: 50,
  angle: Math.PI / 6,
  falloff: 0.9,
  iterations: 4,
  animate: true,
  scale: "pentatonic",
  duration: 120,
};

const systems = {
  fork: {
    name: "Fork",
    axiom: "F",
    rules: {
      //F: "F[-F-F[-F+F]+F-F]+F+F[-F+F]+F-F",
      F: "FF[-F[+F$]][+F[-F$]][-F[-F$]]", // add [+F[+FX]] for symmetry
    },
    iterations: 3,
    angle: Math.PI / 6,
    length: 50,
    falloff: 0.95,
  },
  bush: {
    name: "Edge-rewriting 1",
    axiom: "F",
    rules: {
      F: "FF-[-F+F+F]+[+F-F-F$]",
    },
    angle: (22.5 / 180) * Math.PI,
    falloff: 1,
    length: 16,
  },
  fuzzy: {
    name: "Edge-rewriting 2",
    axiom: "F",
    rules: { F: "F[+F]F[-F][F]" },
    angle: Math.PI / 9,
    falloff: 1,
    iterations: 5,
    length: 14,
  },
  long: {
    name: "Node-rewriting 1",
    axiom: "X",
    rules: { X: "F[+X]F[-X]+X", F: "FF" },
    angle: Math.PI / 9,
    falloff: 1,
    iterations: 6,
    length: 6,
  },
  symmetric: {
    name: "Node-rewriting 2",
    axiom: "X",
    rules: { X: "F[+X][-X]FX$", F: "FF" },
    angle: Math.PI / 7,
    falloff: 1,
    iterations: 6,
    length: 6,
    duration: 80,
  },
  swaying: {
    name: "Node-rewriting 3",
    axiom: "X",
    rules: { X: "F-[[X]+X]+F[+FX]-X", F: "FF" },
    angle: Math.PI / 8,
    falloff: 1,
    iterations: 5,
    length: 10,
  },
  melody1: {
    name: "Melody 1",
    axiom: "GGF",
    rules: { F: "F+G[---G]+G[---G$]" },
    angle: Math.PI / 6,
    falloff: .95,
    iterations: 6,
    length: 50,
    scale: "pentatonic"
  },
  melody2: {
    name: "Melody 2",
    axiom: "GGF",
    rules: { F: "F+G+G+G[--G+F]" },
    angle: Math.PI / 6,
    falloff: .8,
    iterations: 3,
    length: 50,
    scale: "minor"
  },
};

let config = { ...defaultConfig, ...systems["fork"] };
let animation = 0;

const evaluateSystem = (axiom, rules, iterations) => {
  let path = axiom.split("");
  for (let i = 0; i < iterations; i++) {
    path = path.flatMap((c) => (rules[c] ? rules[c].split("") : c));
  }
  return path.join("");
};

const draw = (path, time) => {
  context.strokeStyle = "#9C7702";
  context.fillStyle = "#1AA3E8BB";
  context.lineWidth = 3;
  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height);
  let params = { length: config.length, depth: 0 };
  const scaleByTime = (value) =>
    Math.min(value, Math.sqrt((0.005 * time) / (params.depth + 1)) * value);
  const stack = [];
  for (const c of path) {
    const length = scaleByTime(params.length);
    switch (c) {
      case "F":
      case "G":
        // Draw stems under petals
        context.globalCompositeOperation = "destination-over";
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, -length);
        context.stroke();
        context.translate(0, -length);
        context.globalCompositeOperation = "source-over";
        params.length *= config.falloff;
        params.depth += 1;
        break;
      case "$":
        context.translate(0, length / 2);
        context.beginPath();
        context.arc(
          0,
          0,
          scaleByTime(length),
          1.5 * Math.PI - config.angle,
          1.5 * Math.PI + config.angle
        );
        context.lineTo(0, 0);
        context.fill();
        context.translate(0, -length / 2);
        break;
      case "+":
        context.rotate(-config.angle);
        break;
      case "-":
        context.rotate(config.angle);
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

const timeout = (duration, { signal }) => new Promise((resolve, reject) => {
  if (signal?.aborted) reject(new DOMException("Aborted", "AbortError"));
  else setTimeout(resolve, duration);
});

createSynth = () => {
  const context = new window.AudioContext();
  const oscillators = [context.createOscillator(), context.createOscillator()];
  const gain = context.createGain();
  gain.connect(context.destination);

  oscillators[0].type = "sawtooth";
  oscillators[0].detune.value = -10;
  oscillators[1].type = "triangle";
  oscillators[0].detune.value = 10;

  oscillators.forEach((o) => o.start(context.currentTime));

  const base = 440;
  const factor = Math.pow(2, 1/12);

  const playTone = async (frequency, duration, { signal }) => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (context.state === 'suspended') {
		context.resume();
	}
    oscillators.forEach((o) => o.frequency.value = frequency);
    await timeout(duration, { signal });
  };

  const createScale = (intervals) => {
    intervals = intervals.reduce(((acc, val) => [...acc, acc[acc.length - 1] + val]), [0])
    const octave = intervals[intervals.length - 1]
    intervals = intervals.slice(0, intervals.length - 1);
    const n = intervals.length;
    return (i) => {
      // Omg js why are you like this
      const offset = intervals[(i % n + n) % n] + Math.floor(i / n) * octave;
      return base * Math.pow(factor, offset >= 0 ? offset : 1 / Math.abs(offset));
    }
  }

  const scales = {
    pentatonic: createScale([2, 2, 3, 2, 3]),
    major: createScale([2, 2, 1, 2, 2, 2, 1]),
    minor: createScale([2, 1, 2, 2, 1, 2, 2]),
  };

  const playSequence =  async (sequence, { signal }) => {
    oscillators.forEach((o) => o.connect(gain));
    for (const [frequency, duration] of sequence) {
      await playTone(frequency, duration, { signal });
    }
    oscillators.forEach((o) => o.disconnect(gain));
  };

  let abortController = null;

  return {
    play: (path, scale="pentatonic", duration=100) => {
      if (abortController) {
        abortController.abort();
        oscillators.forEach((o) => o.disconnect(gain));
      }

      const tone = scales[scale];
      sequence = [];
      let toneIndex = 0;
      stack = [toneIndex];
      for (const c of path) {
        switch (c) {
          case "F":
          case "G":
            sequence.push([tone(toneIndex), duration])
            break;
          case "$":
            // TODO flourish parameter?
            break;
          case "+":
            toneIndex++;
            break;
          case "-":
            toneIndex--;
            break;
          case "[":
            stack.push(toneIndex);
            break;
          case "]":
            toneIndex = stack.pop();
            break;
          default:
            break;
        }
      }

      abortController = new AbortController();
      try {
        playSequence(sequence, { signal: abortController.signal });
      } catch(e) {}
    }
  }
}

const synth = createSynth();

const refresh = () => {
  cancelAnimationFrame(animation);
  const path = evaluateSystem(config.axiom, config.rules, config.iterations);
  let time = 0;
  let startTime = 0;
  const redraw = (currentTime) => {
    time += currentTime - startTime;
    draw(path, time);
    animation = requestAnimationFrame(redraw);
  };
  synth.play(path, config.scale, config.duration);
  animation = requestAnimationFrame((currentTime) => {
    startTime = currentTime;
    if (config.iterations > 6 || !config.animate) {
      draw(path, 1e9);
    } else {
      draw(path, time);
      animation = requestAnimationFrame(redraw);
    }
  });
};

refresh();

const debounce = (callback, timeout = 200) => {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      callback();
    }, timeout);
  };
};
window.addEventListener(
  "resize",
  debounce(() => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    refresh();
  })
);

const presetSelect = document.getElementById("preset");
Object.keys(systems).forEach((id) => {
  const option = document.createElement("option");
  option.value = id;
  option.innerHTML = systems[id].name;
  presetSelect.appendChild(option);
});
presetSelect.value = "fork";
presetSelect.addEventListener("change", (e) => {
  const system = systems[e.target.value] || systems.fork;
  config = { ...defaultConfig, ...system };
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
hookUpInput("falloff", parseFloat);
hookUpInput("angle", parseFloat);
hookUpInput("iterations", parseInt);

const hookUpCheckbox = (id) => {
  const checkbox = document.getElementById(id);
  checkbox.checked = config[id];
  checkbox.addEventListener("change", (e) => {
    config[id] = e.target.checked;
    refresh();
  });
  presetSelect.addEventListener("change", () => {
    checkbox.checked = config[id];
  });
};
hookUpCheckbox("animate");

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
