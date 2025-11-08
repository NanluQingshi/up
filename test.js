/*
 * @Author: NanluQingshi
 * @Date: 2025-10-21 16:22:45
 * @LastEditors: NanluQingshi
 * @LastEditTime: 2025-10-23 17:50:33
 * @Description: 
 */
function Counter() {
  const [count, setCount] = useState(0);
  function handleAlertClick() {    
    setTimeout(() => {      
        alert('You clicked on: ' + count);
    }, 3000);
  }
  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
      <button onClick={handleAlertClick}>       
        Show alert
      </button>
    </div>
  );
}

// Let’s say I do this sequence of steps:
// - Increment the counter to 3
// - Press “Show alert”
// - Increment it to 5 before the timeout fires
// Question: what does the alert show?

/**
 * 实现一个 compose 函数
 * 函数接收一个 middleware 数组，数组中每个 middleware 接收一个 next 参数，当执行到 next 时，则调用下一个 middleware，没有则继续当前 middleware
 */

const middlewares = [
  (next) => {
    console.log('middleware 1 start');
    next();
    console.log('middleware 1 end');
  },
  (next) => {
    console.log('middleware 2 start');
    next();
    console.log('middleware 2 end')
  },
]

compose(middlewares)()

// middleware 1 start
// middleware 2 start
// middleware 2 end
// middleware 1 end

function compose(middlewares) {
  if (middlewares.length <= 0) return () => {};

  let index = 0;

  const next = () => {
    if(index === middlewares.length) return;
    return middlewares[index++](next);
  }

  return next;
}