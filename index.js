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
  scale: "pentatonic",
  duration: 0.12,
};

const toggles = {
  animate: true,
  play: true,
  hasClicked: false,
}

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
    duration: 0.09
  },
  symmetric: {
    name: "Node-rewriting 2",
    axiom: "X",
    rules: { X: "F[+X][-X]FX$", F: "FF" },
    angle: Math.PI / 7,
    falloff: 1,
    iterations: 6,
    length: 6,
    duration: 0.09,
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
    angle: Math.PI / 12,
    falloff: .9,
    iterations: 6,
    length: 80,
    scale: "pentatonic"
  },
  melody2: {
    name: "Melody 2",
    axiom: "GGF",
    rules: { F: "F+G+G+G[--G+F]" },
    angle: Math.PI / 36,
    falloff: .93,
    iterations: 4,
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

const timeout = (duration, { signal }) => new Promise((resolve, reject) => {
  if (signal?.aborted) reject(new DOMException("Aborted", "AbortError"));
  else setTimeout(resolve, duration);
});

const createScale = (intervals) => {
  intervals = intervals.reduce(((acc, val) => [...acc, acc[acc.length - 1] + val]), [0])
  const octave = intervals[intervals.length - 1]
  intervals = intervals.slice(0, intervals.length - 1);
  const n = intervals.length;
  return (i) => {
    // Omg js why are you like this
    const offset = intervals[(i % n + n) % n] + Math.floor(i / n) * octave;
    return 440 * Math.pow(2, offset / 12);
  }
}

const scales = {
  major: createScale([2, 2, 1, 2, 2, 2, 1]),
  minor: createScale([2, 1, 2, 2, 1, 2, 2]),
  pentatonic: createScale([2, 2, 3, 2, 3]),
  tetratonic: createScale([3, 2, 2, 1, 4]),
  "major thirds": createScale([4, 4, 4]),
  "minor thirds": createScale([3, 3, 3, 3]),
  "whole-tone": createScale([2, 2, 2, 2, 2, 2]),
  chromatic: createScale([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
};

createSynth = () => {
  const context = new window.AudioContext();
  const output = context.createGain();
  output.connect(context.destination);
  output.gain.value = 0.1;

  const playTone = async (frequency, duration, { signal }) => {
    // Basic setup
    const oscillators = [context.createOscillator(), context.createOscillator()];
    const gain = context.createGain();
    oscillators.forEach((o) => o.connect(gain));
    gain.connect(output);

    // Sound
    oscillators[0].type = "sawtooth";
    oscillators[0].detune.value = -10;
    oscillators[1].type = "triangle";
    oscillators[1].detune.value = 10;

    oscillators.forEach((o) => o.frequency.value = frequency);

    // Envelope
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(1, context.currentTime + .01);
    gain.gain.setValueAtTime(1, context.currentTime + duration - .02);
    gain.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + duration);

    // Start and stop
    oscillators.forEach((o) => o.start(context.currentTime));
    oscillators.forEach((o) => o.stop(context.currentTime + duration));
    oscillators[0].onended = () => gain.disconnect();
    try {
      await timeout(duration * 1000, { signal });
    } catch (e) {
      gain.disconnect();
      throw e;
    }
  };

  const indicator = {
    start: 0,
    end: 0,
  };

  const playSequence =  async (sequence, { signal }) => {
    try {
      for (const [frequency, duration, interval] of sequence) {
        if (signal?.aborted) break;
        indicator.start = interval[0];
        indicator.end = interval[1];
        await playTone(frequency, duration, { signal });
      }
    } catch (e) {}
  };

  let abortController = null;

  return {
    play: (path, scale="pentatonic", duration=.1) => {
      if (!toggles.hasClicked) {
        // Can't play sound until user has clicked on something
        return;
      }
      if (abortController) {
        abortController.abort();
      }

      const tone = scales[scale];
      sequence = [];
      let toneIndex = 0;
      let toneLength = 0;
      let startIndex = 0;
      stack = [toneIndex];
      for (let i = 0; i < path.length; i++) {
        const c = path[i];
        if (c !== "F" && c !== "G" && toneLength > 0) {
            sequence.push([tone(toneIndex), toneLength * duration, [startIndex, i]])
            toneLength = 0;
            startIndex = i;
        }
        switch (c) {
          case "F":
          case "G":
            toneLength++;
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
      if (toneLength > 0) {
          sequence.push([tone(toneIndex), toneLength * duration, [startIndex, path.length - 1]])
      }

      abortController = new AbortController();
      try {
        playSequence(sequence, { signal: abortController.signal });
      } catch(e) {}
    },
    stop: () => {
      if (abortController) {
        abortController.abort();
      }
    },
    setVolume: (volume) => {
      output.gain.value = volume;
    },
    indicator,
  }
}

const synth = createSynth();

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
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    const length = scaleByTime(params.length);
    switch (c) {
      case "F":
      case "G":
        // Indicate where we're playing a tone from
        const isIndicator = toggles.animate && synth.indicator.start <= i && i <= synth.indicator.end;
        if (isIndicator) {
          context.strokeStyle = "#E85825";
          context.lineWidth = 5;
        } else {
          context.strokeStyle = "#9C7702";
          context.lineWidth = 3;
        }
        // Draw stems under petals
        if (!isIndicator) {
          context.globalCompositeOperation = "destination-over";
        }
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, -length);
        context.stroke();
        context.translate(0, -length);
        if (!isIndicator) {
          context.globalCompositeOperation = "source-over";
        }
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
  if (toggles.play) {
    synth.play(path, config.scale, config.duration);
  } else {
    synth.stop();
  }
  animation = requestAnimationFrame((currentTime) => {
    startTime = currentTime;
    if (config.iterations > 6 || !toggles.animate) {
      draw(path, 1e9);
    } else {
      draw(path, time);
      animation = requestAnimationFrame(redraw);
    }
  });
};

refresh();

document.addEventListener("click", () => {
  // Can't play audio until after the user has clicked once
  if (!toggles.hasClicked) {
    toggles.hasClicked = true;
    refresh()
  }
});

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

const fieldset = document.getElementsByTagName("fieldset")[0]
const legend = document.getElementsByTagName("legend")[0]
legend.addEventListener("click", () => {
  const collapsed = fieldset.style.maxHeight === "0px";
  fieldset.style.maxHeight = collapsed ? "800px" : "0px";
  legend.innerText = collapsed ? "Settings ^" : "Settings v "
})

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

const scaleSelect = document.getElementById("scale");
Object.keys(scales).forEach((name) => {
  const option = document.createElement("option");
  option.value = name;
  option.innerHTML = name[0].toLocaleUpperCase() + name.slice(1);
  scaleSelect.appendChild(option);
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
hookUpInput("duration", parseFloat);
hookUpInput("scale");

const volumeSlider = document.getElementById("volume");
volumeSlider.addEventListener("change", (e) => {
  synth.setVolume(parseFloat(e.target.value))
});

const hookUpCheckbox = (id) => {
  const checkbox = document.getElementById(id);
  checkbox.checked = toggles[id];
  checkbox.addEventListener("change", (e) => {
    toggles[id] = e.target.checked;
    if (id === "animate" || e.target.checked) {
      refresh();
    } else {
      synth.stop();
    }
  });
};
hookUpCheckbox("animate");
hookUpCheckbox("play");

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
    rulesInput.style.setProperty("border-color", "#403101");
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
