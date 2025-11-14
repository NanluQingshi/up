/**
 * @description - 用 setInterval 模拟实现 setTimeout
 */
function _setTimeout(callback, delay, ...args) {
  const timer = setInterval(() => {
    callback(...args);
    if (timer) clearInterval(timer);
  }, delay);
}

_setTimeout((name) => console.log('name: ', name), 2000, 'zhangsan');