/**
 * @description - 用 setTimeout 模拟实现 setInterval
 */
function _setInterval(callback, delay, ...args) {
  let timer = null;
  let isCleared = false;

  function run() {
    try {
      callback(...args);
    } catch(err) {
      console.error(err);
    }
    if (!isCleared) {
      timer = setTimeout(run, delay);
    }
  }

  timer = setTimeout(run, delay);

  return {
    clear() {
      isCleared = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
  }
}

_setInterval(() => console.log(1), 500);