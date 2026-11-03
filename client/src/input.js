export function createInput(target) {
  const down = new Set();
  const justPressed = new Set();

  target.addEventListener("keydown", (e) => {
    if (!down.has(e.code)) {
      justPressed.add(e.code);
    }
    down.add(e.code);
  });

  target.addEventListener("keyup", (e) => {
    down.delete(e.code);
  });

  return {
    isDown: (code) => down.has(code),
    justPressed: (code) => {
      if (justPressed.has(code)) {
        justPressed.delete(code);
        return true;
      }
      return false;
    },
  };
}